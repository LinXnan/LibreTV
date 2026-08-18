---
doc_type: feature-review
feature: 2026-08-18-douban-hot-cover-prefetch
status: passed
reviewer: subagent
reviewed: 2026-08-18
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 未安装（where ocr 未找到）"
---

# douban-hot-cover-prefetch 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-cover-prefetch/douban-hot-cover-prefetch-ff-note.md`（Quick lane，ff-note 即 spec，含 REV-001~006 修复记录）
- Checklist: none（Quick lane 无 checklist）
- Implementation evidence: 对话实现 + node 模拟验证（互斥队列 20 并发、REV-006 纯只读 get）
- Diff basis: `git status --short` → 本轮可归因：`js/recent-watch.js`（M，preloadCovers）、`js/utils.js`（M，互斥队列/get/is-loaded/onerror 兜底）、`css/index.css`（M，淡入过渡）+ `.codestable/features/2026-08-18-douban-hot-cover-prefetch/`（?? 新目录）
- Review mode: full-rereview（round 2，REV-001~005 修复 + REV-006 复审发现修复后完整独立复审）
- Baseline dirty files: `js/recent-watch.js` 含 douban-hot-sort（另一 feature）的 sortByRateDesc/排序管道，已审 baseline，非本轮审查对象

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到，见 attention.md 命令陷阱）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 REV-001~005：2 blocking + 2 important + 1 nit；round 2 确认 REV-001~005 闭环，新发现 REV-006 important 并修复，无新 blocking/important）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮 findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-cover-prefetch/douban-hot-cover-prefetch-ff-note.md`
- 修改：`js/recent-watch.js`（preloadCovers 限并发 + render 调用）、`js/utils.js`（_storeChain 互斥队列、_enqueueStore、get 纯只读、is-loaded 标记、onerror 缓存兜底、handleLoadError 清标记）、`css/index.css`（封面淡入 + reduced-motion）
- 删除：none
- 未跟踪 / staged：`.codestable/features/2026-08-18-douban-hot-cover-prefetch/`（新目录）
- 风险热点：并发竞态（index 读改写）、缓存损坏、死循环、主线程阻塞、XSS（无）、跨模块复用（continue-watch）

## 3. Adversarial Pass

- 假设的生产 bug：切换标签时封面被钉死在占位符，或并发预取导致缓存条目互相覆盖丢失
- 主动攻击过的反例：预取与懒加载双路径并发；fetch 失败后预取才完成；缓存 data URL 损坏反复 onerror；20 张封面并发压缩主线程；快速连切标签废弃预取；get 与 enqueue 交错写 index；continue-watch 复用回归
- 结果：REV-001（compressAndStore 并发读改写竞态，blocking）、REV-002（MISS 后 fetch 失败钉死封面，blocking）、REV-003（重复下载/主线程阻塞/废弃预取，important）round 1 发现并修复；REV-006（get 未加锁写 lastAccess 覆盖条目，important）round 2 发现并修复；REV-004/005（nit）round 1 提出，REV-004 修复、REV-005 归并

## 4. Findings

### blocking

- [x] REV-001 `js/utils.js` ImageCacheManager.compressAndStore 并发读改写竞态：`_compress` 异步期间多个写回各自持有过期 index 快照，互相覆盖丢条目、孤儿 data key 累积（首次启用 preload 并发激活的潜伏 bug）
  - Evidence: `_getIndex()`（utils.js:43）→ `_saveIndex()`（utils.js:47）之间隔 `_compress` 异步回调；preloadCovers 对 20 封面并发发起
  - Impact: 随机丢失封面缓存（切回时 MISS 回慢路径）；孤儿 key 累积占满 3MB 配额触发 QuotaExceeded
  - Fix: 新增 `_storeChain` 互斥队列 + `_enqueueStore` 串行化 index 读-改-写段（`.then(task, task)` + `run.catch` 防卡链）；压缩仍链外并发不拖慢下载
  - 验证: node 模拟 20 并发随机延迟压缩 → index 长度 20、URL 唯一、data key 齐全
- [x] REV-002 `js/utils.js` LazyImageLoader 懒加载 MISS 后 fetch 失败 → handleLoadError 钉死封面，而预取随后完成写入缓存不可见
  - Evidence: onerror → handleLoadError → display:none（utils.js:315）；preloadCovers 异步 fire-and-forget，缓存命中检查只在 handleIntersection 开头一次
  - Impact: 封面永久占位符直到下次 re-render，feature 初衷失效
  - Fix: onerror 隐藏前再查缓存，命中恢复显示；`dataset.prefetchRetried` 防损坏缓存 data URL 死循环
  - 验证: 逻辑推演（第二次 onerror 时 prefetchRetried=1 走 handleLoadError）；round 2 确认 is-loaded 时序（兜底命中才 add，handleLoadError remove 无害）

### important

- [x] REV-003 `js/recent-watch.js` preloadCovers 全量并发放飞：与懒加载对同一 URL 重复下载（preloadingUrls 只防 preload 内部）、canvas 压缩主线程阻塞、快速切换时废弃渲染预取持续落盘
  - Evidence: preloadCovers 原 forEach 全部 preload；LazyImageLoader fetch 不检查 preloadingUrls；_compress 用 ctx.drawImage + toDataURL 同步
  - Impact: 双倍带宽/双倍请求、移动端掉帧、缓存写压力与配额消耗
  - Fix: `PREFETCH_CONCURRENCY=4` 限并发——worker 串行取 URL、`.finally(worker)` 接力，真正限制同时下载/压缩数
  - 验证: round 2 确认 cursor 共享正确（worker 不重复取、不越界）
- [x] REV-006 `js/utils.js` get() 命中时更新 lastAccess 并 _saveIndex，该读-改-写未走 _enqueueStore 互斥队列，与写回交错时覆盖刚写入条目（REV-001 同类竞态经另一路径重现）
  - Evidence: get()（utils.js:53-65）命中分支 entry.lastAccess + _saveIndex；onerror 兜底/懒加载命中/preload 命中三处调用 get，均未加锁
  - Impact: index 条目丢失 + 孤儿 data key（功能降级：封面 MISS 重新下载）
  - Fix: get() 改纯只读（命中不再写 lastAccess）；lastAccess 仅在 compressAndStore 写回时设置，LRU 驱逐仍基于存储时 lastAccess，精度损失可忽略
  - 验证: node 模拟 20 并发写 + 全部 get 命中 → index 长度 20、URL 唯一、data key 齐全

### nit

- [x] REV-004 `js/utils.js` handleLoadError 补 `img.classList.remove('is-loaded')`：失败隐藏时若残留 is-loaded，未来复用该 img 且重置 display 会露出损坏封面盖住占位符
- [x] REV-005 `js/utils.js` preload 缓存命中跳过无异步保护：get 读到过期 index 时偶发重复下载——归并 REV-001（队列后 get 读到的 index 已最新），不单独修

### suggestion

- S-1 `_compress` 仍链外并发（4 worker 同帧 canvas 压缩）：相比原 20 并发已大幅改善，低端机可能仍轻微掉帧——可作为后续 requestIdleCallback 优化，本轮不阻断（round 2 提出）

### 用户反馈修复复审（REV-007，2026-08-18）

- REV-007（用户反馈"还是会一闪"）：缓存命中分支与 onerror 兜底分支先 `add('is-loaded')`（opacity 立即 1）再设 `img.src`——data URL 解码期间 img 空白，解码完成瞬间内容硬出现，即"闪"根源；预取后最常见路径正是缓存命中，故最常被感知
  - Fix: 两处改为先设 src、等 onload 解码完成后再 add is-loaded（CSS 0.3s 淡入）；缓存命中分支补 onerror 降级（损坏 data URL 隐藏露出占位符）
  - 复审结论: 独立 reviewer 聚焦核验 5 项（修复正确性、return 路径无遗漏、兜底 onload 衔接、无新回归、最小改动）全部通过；无 blocking/important；learning：is-loaded 必须加在 src 的 onload 中、绝不可在设 src 前同步加（可沉淀为通用约定）

### 用户反馈修复复审（REV-008，2026-08-18）

- REV-008（用户反馈"还是会有"）：切换标签/类型的"闪"来自整体重建流程——异步取数期间 track 残留旧卡片 + 数据到达后整体替换 + 每张卡片重播 0.55s 入场动画（backwards 填充下 delay 期间透明）+ 封面淡入叠加
  - Fix: `lastRenderKey`（type:tag 快照）识别切换，`render()` 开头立即清空旧卡片（消除残留→突变）；切换渲染加 `no-entrance` class（CSS `animation: none`）跳过入场动画重播，视觉变化收敛为仅封面淡入一次；首次加载/普通刷新不触发
  - 复审结论: 独立 reviewer 5 项核验全部通过；无 blocking/important；learning：同步清空/重置与异步请求作废两阶段分离是处理切换闪动类问题的通用骨架；顺手采纳 N-1 补 `if (!track) return` 健壮性一行

### 用户反馈改进复审（REV-009，2026-08-18）

- REV-009（用户反馈"切换很生硬，要三点加载过渡 + 渐进式展示"）：REV-008 的"立即清空"消除闪但造成切换生硬（空白窗口 + 直接显示）。改为过渡式加载：
  - isSwitch 时 `track.innerHTML` 填三点跳动 loading（`.recent-watch-loading` + 3 `.recent-watch-loading-dot`，absolute 居中于 350px 轨道）
  - 恢复入场动画（删除 no-entrance class 与 CSS 规则，全仓库 0 残留）：数据到达后 `applyEntranceDelays` 按距中央距离分批淡入 = 渐进式展示
  - 视觉流程：旧内容 → 三点加载 → 新卡片渐进淡入；reduced-motion 补 `.recent-watch-loading-dot { animation: none }`
  - 采纳 N-2（review 提出）：isSwitch 分支顺带 `updateNavButtons(0)` 隐藏左右按钮，加载期间不悬浮空按钮，数据到达后 .then 自动恢复
  - 复审结论: 独立 reviewer 5 项核验全部通过；无 blocking/important；3 nit（三点→卡片微空档、N-2 已采纳、选择器冗余）+ 1 suggestion（缓存命中 loading 一闪而过，用户已接受）均不阻塞；learning：切换类视觉问题要看完整时间轴状态序列，"过渡态设计"（加载占位填空白窗口 + 渐进淡入软化数据到达）是通用骨架

### 用户反馈改进复审（REV-010 + REV-011，2026-08-18）

- REV-010（用户反馈"不想展示时闪兜底封面，等封面都加载到再展示，超时才用兜底"）：
  - Fix: 卡片模板加 `.cover-pending`（`visibility:hidden` 整卡隐藏含占位符）；`watchCoverReadiness` MutationObserver 监听封面 img class/style，全部就绪（is-loaded / display:none / 无封面）→ `revealTrack` 整批渐进淡入；`COVER_LOAD_TIMEOUT=12000` 超时兜底；`clearCoverWatch` 各路径清理
  - 复审结论: verdict **passed**（无 blocking/important）；3 nit + 1 suggestion，其中 2 个 nit 采纳为 REV-011：
    - render() 早退补 clearCoverWatch
    - watchCoverReadiness 同步预检已就绪封面（避免全缓存命中空窗）
    - 未采纳：auto-scroll 在 cover-pending 期间已启动（非功能性，仅首屏中央卡可能非首部）；suggestion opacity 叠加（视觉影响可忽略）
  - learning: `visibility:hidden` 不阻止 IntersectionObserver（与 display:none 不同）——封面懒加载在隐藏期间仍正常启动，选择 visibility 而非 display 是正确的，否则懒加载永不触发会形成 blocking
  - praise: 全终态覆盖干净（成功/失败/无封面三类）；超时兜底后 observer disconnect 不影响后续淡入（is-loaded + CSS transition 由 LazyImageLoader 独立驱动，与 cover observer 解耦）

### learning

- 首次启用「既有但未使用」的异步能力会激活隐藏竞态：`preload` 契约从未被调用，本轮启用即暴露 compressAndStore 并发读改写 bug——审查时应把首次启用路径当新代码对待
- 互斥队列用 `.then(task, task)` + `run.catch(() => {})` 是异常安全的链式串行：单次 task 抛错不卡死整条链，错误仍传给调用方 await
- 缓存键设计正确值得保留：preload 与懒加载共用未带 auth 的 `/proxy/` URL 作键（auth 时间戳 t 只加在 fetch 侧），两路径天然命中同一缓存

### praise

- renderRequestId 门卫正确覆盖 preloadCovers（调用在其后），快速切换标签旧 DOM 与旧预取发起被正确丢弃
- CSS 分层干净：opacity:0 默认 + is-loaded 显式恢复；prefers-reduced-motion 只关 transition 不关 opacity 值，减动效下仍显示封面
- continue-watch 复用 .recent-watch-cover-img 走同一 LazyImageLoader 淡入生效，且不进 preloadCovers（不预取），不与并发写叠加，复用无回归
- 无封面 item 由 buildCoverUrl 返回 '' 且 preloadCovers 跳过、coverHtml 不生成 img，opacity:0 不对纯占位符卡片产生空白

## 5. Test And QA Focus

- QA 必须重点复核：
  - 快速连切多个标签/类型：切回已访问标签封面秒显（缓存命中）；无封面「先显示再被删/占位符」
  - 弱网/代理抖动切换：制造一次 fetch 失败（DevTools 限速），确认封面不永久卡占位符（REV-002 回归）
  - 并发预取 localStorage 占用：切 3 标签后检查 img_cache_index 条目数与孤儿 key（REV-001/006 回归）
  - 移动端真机切换：预取压缩期卡顿程度（I-2/S-1）、封面淡入正常
  - continue-watch 弹窗封面：淡入生效、失败降级占位符、关闭再打开恢复
  - prefers-reduced-motion：封面直接显示无淡入
  - 首次加载（无缓存）：慢路径 + 淡入正常，占位符→封面不硬跳
- 建议新增或加强的测试：none（项目无自动化测试；node 模拟已覆盖互斥队列与纯只读 get）
- 不能靠 review 完全确认的点：竞态触发频率与用户可感知影响、并发 canvas 压缩低端机掉帧量、3MB 配额多标签连切真实耗尽速度

## 6. Residual Risk

- 极低：get() 纯只读后 LRU 精度下降（驱逐基于存储时 lastAccess 而非访问时）——3MB 配额下影响可忽略，属可接受权衡
- 极低：_compress 4 并发 canvas 压缩在低端移动设备可能轻微掉帧（S-1），feature 目标（减少跳变）净收益仍显著
- 无自动化测试（attention.md:17），视觉层回归依赖手动验证

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾提交（ff-note + review 均已落盘）

## 8. Focused Closure（无则写 none）

none（round 2 为完整独立复审，非 focused closure）
