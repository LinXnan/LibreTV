---
doc_type: feature-ff-note
feature: home-recent-watch-carousel
date: 2026-08-09
requirement:
tags: [home, history, carousel, ui]
---

## 做了什么
首页搜索框下方新增"最近观看"区域：读取 `localStorage.viewingHistory`（最新在前）取最近 10 部影片，以小卡片横向轮播展示，卡片尺寸与历史记录封面一致（约 110px 宽、2:3 竖版），支持左右箭头、自动轮播、触摸滑动，点击卡片跳转历史记录对应的播放链接。

## 改了哪些
- `index.html` — 搜索区与豆瓣区之间插入 `#recentWatchArea`（标题 + 轨道 + 左右箭头），引入 `js/recent-watch.js`
- `js/recent-watch.js`（新增）— 历史读取、封面代理（复用 ui.js 逻辑）、XSS 转义、卡片渲染、箭头/自动轮播（hover/触摸/手动滚动暂停、`prefers-reduced-motion` 尊重）、显示隐藏
- `css/index.css` — `.recent-watch-*` 轮播卡片与箭头样式（移动端 96px 卡片、隐藏箭头）
- `js/app.js` — 5 处同步：`resetSearchArea` / `renderCachedResults` / `search` 结果渲染 / `showVideoPlayer` 隐藏，`closeVideoPlayer` 恢复（复用 `updateRecentWatchVisibility`）

## 怎么验证的
`node --check` 语法通过；本地 `node server.mjs` 启动后首页 200，HTML 含 `recentWatchArea` 与脚本引用；linter 无报错。浏览器手动验证（有历史时显示轮播、搜索时隐藏、回首页恢复、箭头与自动轮播、点击跳播放页）待用户执行。

2026-08-09 review-fix（round 1 review changes-requested）：修复 REV-001（episodeIndex 数值归一化防 XSS）与 REV-002（事件绑定一次性化 + 卡片事件委托），顺手统一全局函数调用、touchstart 改走暂停-恢复；`node --check` 复验通过，进入 round 2 完整独立复审。

2026-08-09 review-fix（round 2 复审 changes-requested）：修复 REV-007（对外 updateRecentWatchVisibility 改走 render，回首页同步最新历史数据）、REV-008（跳转前 new URL 校验 http/https scheme）、REV-009（episodeIndex 显式排除 null/undefined）；`node --check` 复验通过，进入 round 3 完整独立复审。

2026-08-09 review-fix（round 3 复审 changes-requested）：修复 I-1（title 强制 String() 化后再传渐变/图标函数，异常数据类型不再拖垮整体渲染）、I-2（ui.js clearViewingHistory / commitHistoryDeletion 补调 updateRecentWatchVisibility，清空/删除历史后轮播同步刷新）；I-3 经核验 item.url 为自足 player.html 链接（含 source/position），直接跳转可播放续播，记录为差异不改；`node --check` 复验通过，进入 round 4 完整独立复审。

2026-08-09 review-fix（round 4 复审 changes-requested）：修复 J-1（render 空历史分支补 stopAutoScroll，清空历史后释放自动轮播定时器）；round 4 的 J-2（撤销删除后刷新轮播）经核验不成立——commitHistoryDeletion 是唯一删除入口，撤销时 localStorage 未变无需刷新；`node --check` 复验通过，进入 round 5 完整独立复审。

2026-08-09 review-fix（round 5/6 复审）：修复 IMP-1（Array.isArray 校验 + 非对象条目 filter）、IMP-2（空历史分支清 resumeTimer）、N-1（空 title 渐变兜底）、nit-1（非空分支对称清 resumeTimer）；round 6 important 两项经核验为已收敛差异 / 范围外顺手发现（ui.js:getViewingHistory 无校验，建议后续独立加固）；`node --check` 通过。round 6 完整独立复审 verdict = passed，见 `home-recent-watch-carousel-review.md`（6 轮无 blocking，全部 important 已修复或核验排除）。待用户浏览器验收。

## 顺手发现（可选，不阻塞）
- 无

## 设计迭代（2026-08-09，用户截图反馈）

按用户提供的截图调整：去掉卡片下方标题/剧集文字，卡片改为大尺寸竖版海报（桌面 180px / 移动 140px，去边框加阴影，hover 微放大），间距收紧（gap 0.5rem）。当前没有数字元素（无需移除）。

- 改动：`css/index.css`（卡片尺寸、gap、阴影、hover；删除已不使用的 `.recent-watch-info/title/episode` 样式）、`js/recent-watch.js`（删模板中信息区、清理未使用的 `safeEpisode`）
- 验证：`node --check` 通过、lint 无报错；浏览器视觉确认待用户执行
- 注：卡片尺寸由初版"和历史记录封面一致（110px，不用太大）"调整为截图风格（180px），与首版诉求相反，按用户最新指示（截图）为准

## 迭代 2（2026-08-09，用户反馈"点击搜索时最近观看要隐藏"）

`search()` 中 `showLoading()` 后立即隐藏 `recentWatchArea`（及 doubanArea），搜索请求返回前先收起；删除上轮在结果渲染处的重复隐藏块。缓存命中路径（`renderCachedResults`）此前已隐藏。`node --check` 与 lint 通过。

## 迭代 3（2026-08-09，用户反馈"点击首页时最近观看被推到页面底部"）

`resetSearchArea()` 中不再给 `searchArea` 加 `flex-1`（之前为了让搜索框垂直居中而加，把后续最近观看/豆瓣区域挤出正常视觉位置），改为 `remove('mb-2')` 清理搜索时的紧凑 margin，让搜索框与最近观看在首页自上而下自然流式排列。`node --check` 与 lint 通过。

## 迭代 4（2026-08-09，用户反馈"标题居中，左右各放一个按钮"）

把"最近观看"标题居中显示，左右箭头按钮从卡片轨道两侧（绝对定位）移到标题行左右两侧：HTML 改为 `flex items-center`（左箭头 + 标题 flex-1 text-center + 右箭头）；CSS 移除 `.recent-watch-wrapper` 与箭头的绝对定位/top/transform/left/right。卡片轨道不再被箭头覆盖。`node --check` 与 lint 通过。

## 迭代 6（2026-08-09，用户要求"循环轮播 + 去掉左右按钮 + 鼠标移入停止轮播"）

- `index.html`：删除左右箭头按钮，标题行与轨道简化
- `js/recent-watch.js`：
  - 无缝循环：渲染时克隆一份卡片拼在末尾（克隆部分 `aria-hidden`/`tabindex=-1`），自动轮播滚动到后半时瞬间跳回前半对应位置，画面连续无限循环
  - 删除 prev/next 事件绑定与 `updateArrows`/箭头相关逻辑；`refreshCarousel` 只重启自动轮播
  - 鼠标移入影片区 `stopAutoScroll`、移出恢复；滚动/触摸视为用户交互暂停 6s 后恢复
- `css/index.css`：删除 `.recent-watch-arrow` 样式
- `node --check` 与 lint 通过

2026-08-09 迭代 6 补：自动轮播间隔 4000→3000ms；无缝循环由"2 倍克隆"升级为"3 段式"（S1/S3 隐藏克隆 + S2 真实，初始定位中段，滚到 S3 瞬间跳回 S2 对应位置），保证跳转前后画面完全一致（视口恒小于一段宽度），实现"末尾直接衔接开头"无跳变。

2026-08-09 迭代 7（用户要求"鼠标移入卡片时抽取浮出突出显示"）：`.recent-watch-card` 加 `position: relative` + `will-change`，hover 时 `scale(1.06) translateY(-6px)` 浮出、增强投影 + 青色发光、`z-index:10` 浮于相邻卡片之上；`.recent-watch-track` 上下 padding 由 0.375rem 改为 1rem，容纳放大浮出不被裁剪。lint 通过。

## 迭代 5（2026-08-09，用户反馈"播放页切换视频源后，历史记录封面不更新"）

问题根源：`saveToHistory`（player.js）的 `vod_pic` 只从 URL 参数读取；切源（`switchToResource`）是同页 `replaceState`，URL 的 `vod_pic` 参数未更新，导致历史封面始终是旧源的。

修复（js/player.js）：
1. 新增全局变量 `currentVodPic`
2. `initializePageContent`：嵌套 URL（历史重定向）解析时同步 `vod_pic` 参数；页面加载时从 URL 初始化 `currentVodPic`
3. `switchToResource`：从 detail 响应 `data.vod_pic` 校验后更新 `currentVodPic`，并同步 URL 参数
4. `saveToHistory`：封面优先 `currentVodPic`，其次回退 URL 参数

切源后 3s（`initPlayer` 内 `saveToHistory`）历史封面即更新；回首页 `updateRecentWatchVisibility`（render）使最近观看封面同步。`node --check` 与 lint 通过。

## 迭代 4 修正（2026-08-09，用户澄清：标题保持左侧，影片居中，箭头在影片行两侧）

用户澄清实际想要的布局：标题"最近观看"仍左对齐在标题行；影片卡片行水平居中；左右箭头按钮在影片卡片那一行的左右两侧。调整：标题行恢复 `mb-4` 左对齐；卡片行改为 `flex items-center gap-3`（左箭头 + 轨道 flex:1 + 右箭头）；轨道内卡片用首尾 `margin: auto` 实现"不满一行时居中、溢出时正常滚动"。`node --check` 与 lint 通过。
