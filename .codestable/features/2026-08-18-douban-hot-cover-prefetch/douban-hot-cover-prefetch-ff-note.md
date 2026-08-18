---
doc_type: feature-ff-note
feature: douban-hot-cover-prefetch
date: 2026-08-18
requirement:
tags: [home, douban, carousel, cover, performance]
execution_lane: quick
---

## 做了什么
优化首页豆瓣热播轮播切换标签/类型时的封面加载体验：原先新数据封面均为未缓存 URL，懒加载触发后要经历「代理 fetch + 压缩 + 存缓存」完整流程，期间只显示渐变占位符，完成后硬切换到封面——即用户看到的「兜底封面再跳转」。本次**数据到达即预取封面**，并给封面加载补**淡入过渡**，消除等待与跳变。

## 改了哪些
- `js/recent-watch.js`：
  - 新增 `preloadCovers(items)`：按 `PREFETCH_CONCURRENCY=4` 限并发调用 `window.imageCacheManager.preload(coverUrl)`（既有能力，此前从未被调用；内部带缓存命中跳过 + preloadingUrls 防重；worker 串行取 URL、`.finally` 接力，真正限制同时下载/压缩数）
  - `render()` 数据管道生成 items 后立即调用 `preloadCovers(items)`——切换标签/类型时新封面在渲染前就开始预取入 localStorage，IntersectionObserver 触发时大概率缓存命中直接显示
- `js/utils.js`：
  - `ImageCacheManager`：新增 `_storeChain` 互斥队列，`compressAndStore` 的 index 读-改-写段抽出 `_enqueueStore` 串行化（压缩留在链外并发）——修复并发预取下 index 快照互相覆盖丢条目的竞态
  - `LazyImageLoader.handleIntersection` 缓存命中分支：设 `img.src = cached` 前先 `img.classList.add('is-loaded')`
  - `img.onload`：加载完成 `img.classList.add('is-loaded')`
  - `img.onerror`：隐藏前再查一次缓存（预取可能刚完成写入），命中则恢复显示而非钉死占位符；`dataset.prefetchRetried` 防损坏缓存 data URL 死循环
  - `handleLoadError`：补 `img.classList.remove('is-loaded')`，失败后语义干净
- `css/index.css`：
  - `.recent-watch-cover-img` 默认 `opacity: 0` + `transition: opacity 0.3s ease`
  - 新增 `.recent-watch-cover-img.is-loaded { opacity: 1 }`——加载完成淡入，非硬跳变
  - `prefers-reduced-motion: reduce` 块补充 `.recent-watch-cover-img { transition: none }`（减动效直接显示）

## 怎么验证的
- `read_lints`（js/recent-watch.js、js/utils.js、css/index.css）0 报错；`node --check` 两 JS 文件语法通过
- node 模拟互斥队列：20 个并发 `compressAndStore`（随机延迟压缩）后 index 长度=20、URL 唯一、data key 齐全——无条目丢失（修复前同场景会丢条目）
- 浏览器手动验证待用户执行：切换标签/类型后封面明显更快出现且淡入而非跳变；缓存命中标签（如切回热门）秒显；减动效系统下直接显示

## 用户反馈修复（2026-08-18，REV-007）
- REV-007（用户反馈"还是会一闪"）：缓存命中分支与 onerror 兜底分支都是**先 `add('is-loaded')`（opacity 立即 1）再设 `img.src`**——data URL 解码期间 img 空白，解码完成瞬间内容硬出现（无淡入过渡），即"闪"的根源；且预取后最常见的路径正是缓存命中，所以闪烁最常被感知。
  - 修复：两处都改为**先设 src、等图片 `onload` 解码完成后再加 `is-loaded`**，CSS transition 从 0→1 平滑淡入；缓存命中分支补 onerror 降级（损坏 data URL 隐藏露出占位符）。
  - 验证：read_lints + node --check 通过；逻辑推演（设 src→解码→onload→淡入 0.3s，无硬出现窗口）。

## 用户反馈修复（2026-08-18，REV-008）
- REV-008（用户反馈"还是会有"）：**切换标签/类型时的"闪"来自整个重建流程**——点击标签后 `getSubjects()` 异步取数期间 `track` 残留旧标签卡片，数据到达后 `track.innerHTML` 整体替换，且每张卡片重播 0.55s 入场动画（`backwards` 填充下 delay 期间卡片透明），叠加封面淡入 = 多重视觉变化叠加的"闪"。
  - 修复（js/recent-watch.js + css/index.css）：
    1. `lastRenderKey`（type:tag 快照）识别"切换标签/类型"，`render()` 开头**立即清空旧卡片**（`track.innerHTML=''` + `activeIndex=0` + `stopAutoScroll()`）——消除"旧内容残留→数据到达后突变"
    2. 切换渲染时卡片加 `no-entrance` class（CSS `animation: none`）——跳过 0.55s 入场动画重播，只保留封面淡入一次
    3. 首次加载/普通刷新（popstate/可见性）不受影响：`lastRenderKey` 为空或 type/tag 未变时不清空、不跳动画
  - 验证：read_lints + node --check 通过；逻辑推演（切换→立即清空→新数据渲染直接显示占位符→封面淡入，视觉变化仅封面淡入一次）

## 用户反馈改进（2026-08-18，REV-009）
- REV-009（用户反馈"切换很生硬，要三点加载过渡 + 渐进式展示"）：REV-008 的"立即清空"消除了闪但造成切换生硬（空白窗口 + 直接显示）。本次改为**过渡式加载**：
  - 切换标签/类型时 `track.innerHTML` 填入**三点跳动加载动画**（`.recent-watch-loading` + 3 个 `.recent-watch-loading-dot`，居中于 350px 轨道）
  - **恢复入场动画**（删除 no-entrance class 与 CSS 规则）：数据到齐后 `applyEntranceDelays` 按距中央距离分批次淡入 = 用户要的"渐进式展示"
  - 视觉流程：旧内容 → 三点加载 → 新卡片渐进淡入（平滑衔接，不空白不突变）
  - reduced-motion 块补充 `.recent-watch-loading-dot { animation: none }`
  - 验证：read_lints + node --check 通过；逻辑推演（isSwitch 填 loading → .then 渲染替换 → 入场动画渐进展示；缓存命中时 loading 一闪而过属正常）

## 用户反馈改进（2026-08-18，REV-010）
- REV-010（用户反馈"不想展示时闪一下兜底封面，等封面都加载到了再展示，超时才用兜底"）：此前卡片渲染即显示占位符（渐变底+图标），封面加载完成后淡入覆盖——短暂"兜底封面闪现"。
  - 修复（js/recent-watch.js + css/index.css）：
    1. 卡片模板加 `cover-pending` 类：`visibility:hidden` 整卡隐藏（含占位符），等封面就绪再展示
    2. 新增 `watchCoverReadiness(track)`：MutationObserver 监听所有封面 img 的 class/style 变化，全部就绪（成功 `is-loaded` / 失败 `display:none` / 无封面视为就绪）→ `revealTrack` 移除 cover-pending 整批渐进淡入
    3. 超时兜底：`COVER_LOAD_TIMEOUT=12000`（与数据 fetch 超时一致），超时强制展示，未就绪封面由占位符兜底，后续加载完成仍淡入覆盖
    4. `clearCoverWatch()` 清理监听/定时器：showTrackLoading 清空 track 前、items.length===0 分支、catch 分支均调用，避免孤儿监听
  - CSS 用 `visibility:hidden` 而非 `opacity:0`：`updateCoverflow` 会设置内联 `opacity`（可见卡为 1）会覆盖 CSS 类；visibility 不受影响。移除 pending 后入场动画从头播放（backwards 填充），渐进式淡入保留
  - 验证：read_lints + node --check 通过；逻辑推演（渲染→cover-pending 隐藏→封面就绪/超时→移除→入场动画淡入；无封面卡直接展示；失败卡 display:none 视为就绪）

## Code Review 修复（2026-08-18，REV-011）
- REV-011（reviewer nit 采纳）：
  - `render()` 早退分支补 `clearCoverWatch()`（area/track 缺失时清理封面监听，防孤儿 observer）
  - `watchCoverReadiness` 建立 observer 前**同步预检**已就绪封面（全缓存命中场景 onload 微任务先于 observer 挂载，避免 12s 超时空窗），全部就绪直接 `revealTrack`

## Code Review 修复（2026-08-18，REV-001~005）
- REV-001（blocking）：`compressAndStore` 并发读改写竞态——`_compress` 异步期间多个写回各自持有过期 index 快照，互相覆盖丢条目、孤儿 data key 累积（首次启用 preload 并发激活的潜伏 bug）。修复：`_enqueueStore` 互斥队列串行化 index 读-改-写，压缩仍并发。
- REV-002（blocking）：懒加载 MISS 后 fetch 失败 → `handleLoadError` 钉死封面，而预取随后完成写入缓存不可见。修复：`onerror` 隐藏前再查缓存命中则恢复；`dataset.prefetchRetried` 防死循环。
- REV-003（important）：预取与懒加载对同一 URL 重复下载 + 并发压缩阻塞主线程 + 废弃渲染预取落盘。修复：`preloadCovers` 限并发 4（worker 串行 + finally 接力）。
- REV-004（nit）：`handleLoadError` 补 `remove('is-loaded')`。
- REV-005（nit，未修）：`preload` 缓存命中跳过无异步保护——归并到 REV-001（队列后读到的 index 已是最新）。
- REV-006（important，round 2）：`get()` 命中时更新 `lastAccess` 并 `_saveIndex`，该读-改-写路径未走 `_enqueueStore` 互斥队列——与 `_enqueueStore` 交错时可能覆盖刚写入的条目（REV-001 同类竞态经另一路径重现）。修复：`get()` 改**纯只读**（命中不再写 lastAccess），LRU 精度略有损失（驱逐基于存储时 lastAccess），但消除了最后的未加锁 index 写路径；lastAccess 仅在 `compressAndStore` 写回时设置，LRU 驱逐仍正常。

## 设计要点（防回归）
- `preload` 复用 `ImageCacheManager` 既有契约，不新增网络/代理协议，不改 auth 逻辑
- `is-loaded` 类只做「加载完成」标记；`opacity:0` 默认态依赖 LazyImageLoader 必定调用（命中/onload 两分支全覆盖），加载失败走 `handleLoadError` 隐藏并清标记，占位符自然露出
- `.recent-watch-cover-img` 同时被 continue-watch.js 复用，淡入对继续观看卡片同样生效（一致体验），无需单独处理
- 不触碰 `getSubjects()` 缓存层与排序逻辑，纯封面加载侧优化
