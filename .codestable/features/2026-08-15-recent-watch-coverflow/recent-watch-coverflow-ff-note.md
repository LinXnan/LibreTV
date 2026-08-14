---
doc_type: feature-ff-note
feature: recent-watch-coverflow
date: 2026-08-15
requirement:
tags: [home, history, carousel, ui, coverflow]
---

## 做了什么
首页"最近观看"轮播从"纯封面横向滚动"升级为 **Coverflow 焦点流**：滚动时离视口中心最近的卡片放大提亮（焦点态），两侧卡片透视缩小压暗；焦点/hover 时卡片底部浮现标题信息层、右上角弹出霓虹播放徽章；左右边缘加渐变遮罩营造"向两侧无限延伸"感；区域背景加霓虹光晕、标题改渐变文字+左侧渐变竖条；渲染时卡片按序淡入上浮（staggered 入场动画）。

## 改了哪些
- `css/index.css` — 重写 `.recent-watch-*` 块：
  - Coverflow 焦点：卡片用独立 `scale` 属性（0.86→1）承担缩放 + `filter` 提亮 + `transform: perspective(900px)`；`.active` 焦点态放大提亮、霓虹光晕；hover 态放大浮出（z-index 层叠保证任何位置 hover 有反馈）
  - 信息层 `.recent-watch-info`（底部渐变 + 单行省略标题）与播放徽章 `.recent-watch-play`（弹性弹出），焦点/hover 浮现
  - 左右边缘渐变遮罩 `.recent-watch-track::before/::after`（桌面 72px / 移动 32px，`pointer-events:none`）
  - 入场动画 `@keyframes recent-watch-card-in`（只动 opacity+translateY，不与 scale 焦点态冲突）
  - 区域氛围 `#recentWatchArea::before` 径向光晕 + 标题渐变文字/竖条
  - 移动端适配 + `prefers-reduced-motion` 关闭动画/过渡
- `js/recent-watch.js`：
  - 卡片模板加 `.recent-watch-play`（SVG 播放三角）与 `.recent-watch-info`（标题，`aria-hidden` 避免读屏重复朗读）
  - 新增 `updateActiveCard`（离视口中心最近的卡片为 `.active`）+ `scheduleActiveUpdate`（rAF 节流）
  - scroll 事件同步焦点；`render` 结束时同步一次 + `applyEntranceDelays`（真实卡片按 60ms 递增延迟）
  - `init` 绑 resize 监听重新计算焦点（只绑一次）

## 怎么验证的
- `read_lints`（js/recent-watch.js、css/index.css）0 报错；`node --check` 因本机 pwsh 带空格路径不可用（已知环境限制，见 attention.md），以 read_lints 替代语法验证
- 浏览器手动验证待用户执行：滚动时焦点卡片平滑切换、hover 浮现标题/播放徽章、边缘渐暗、入场动画、`prefers-reduced-motion` 下无动画、移动端尺寸

## 设计要点（防回归）
- 缩放用独立 `scale` 属性而非 `transform: scale()`：入场动画的 `transform` 动画不会覆盖焦点态缩放，避免"动画结束瞬间跳变"（CSS 动画优先级高于普通样式，若共用 transform 会在动画播放期间丢失 0.86/1 缩放）
- 入场动画只动 opacity+translateY，动画结束回落值与普通样式一致，无跳变
- `.active`/`:hover` 的 z-index 层叠：active=5、hover=10、边缘遮罩=30（盖在边缘卡片之上实现渐暗）
- 3 段式无缝循环结构、needsLoop 测量、自动轮播/暂停/恢复逻辑均未改动，仅叠加焦点样式与事件

## 收敛迭代（2026-08-15，用户反馈"底色和阴影割裂"）

`css/index.css` 三处收敛：
- **去掉区域氛围光晕**：删除 `#recentWatchArea` 的 `background` 渐变 + `::before` 径向光晕，区域与页面统一深蓝黑渐变
- **去掉外阴影**（迭代 2，2026-08-15，用户反馈"还是有/底部有边距"）：`.active` 用 `inset` 内嵌边框替代外部阴影；hover 无阴影只靠 scale + filter；轨道 padding 收紧到 12px。Coverflow 焦点表现不再用下投阴影，规避"焦点卡片底面多一块阴影"的视错觉
- **彻底去掉"方框"**（迭代 3，2026-08-15，用户反馈"有个方框重叠在封面上"）：inset 内嵌边框本身就是"方框"，删除；`.active` 只靠 scale + filter 表达焦点；`.recent-watch-play` / `.recent-watch-info` 从"active 常显"改为**仅 hover 浮现**，静态时封面零边框、零色块、零阴影
- **彻底干掉 hover 叠加层**（迭代 4，2026-08-15，用户反复反馈"还是有方框"）：hover 浮现的 `.recent-watch-info`（深色矩形渐变 + 标题）和 `.recent-watch-play`（霓虹蓝圆点）正是用户感知的"方框"。直接 `.recent-watch-play { display: none }` + `.recent-watch-info, .recent-watch-title { display: none }`。封面上零色块。标题仍可从卡片原生 `title` 属性 / `aria-label` 获取（鼠标悬停会有浏览器原生 tooltip）。Coverflow 焦点表现最终收敛到只剩 **scale + filter**：放大提亮，不画任何边框/阴影/信息层
- **删除边缘渐变遮罩（真凶）**（迭代 5，2026-08-15，用户最终定位"影片收尾连接时有个框展示在影片上"）：`.recent-watch-track::before/::after` 是覆盖所有卡片之上（z-index 30）的左右边缘实心深色渐变块，滚动到 3 段无缝循环"收尾衔接"（S3 末尾 ↔ S2 开头）时，克隆边界恰好经过视口边缘，遮罩的不透明端就会在影片封面边缘盖出一个"深色框"。删除整个伪元素遮罩（含移动端 32px 版本），彻底移除"方框"来源

## 迭代 6（2026-08-15，用户反馈"影片展示重复"）

`js/recent-watch.js` 的 `render()` 增加**展示层按 title 归一化去重**：`addToViewingHistory`（js/ui.js）的去重键是 `title + sourceName + showIdentifier`，同一影片在不同采集源看过（sourceName 不同）或 showIdentifier 缺失时 fallback 不同（剧集 URL/集数），历史中会留下多条同封面记录，轮播原样 `slice(0,10)` 导致同一影片重复展示。修复：过滤非对象条目后按 `String(item.title)` 归一化（trim + 小写 + 去空白）去重（`Set`，保留最新一条），再 `slice(0, MAX_ITEMS)`。只改展示层，不动 localStorage 数据。

## 迭代 7（2026-08-15，用户澄清"数量与历史记录不一致，拉齐"）

`MAX_ITEMS` 10 → **50**（与历史存储上限一致，见 ui.js `addToViewingHistory` / player.js `saveToHistory` 的 50 条限制）：轮播展示全部历史影片，与历史记录面板（`loadViewingHistory` 展示全部）覆盖范围一致。同步：入场动画延迟封顶 `Math.min(index * 60, 800)`ms，避免卡片增多后最后几张等太久。

## 迭代 8（2026-08-15，用户要求"不用那么复杂，历史多少就显示多少"）

**移除 3 段式无缝循环**（`js/recent-watch.js`）：
- `render()`：去掉 `needsLoop` 判断与 S1/S3 克隆拼接，单段直出历史全部卡片；`scrollLeft = 0`；内容溢出视口才启动自动轮播，不足则居中展示不轮播
- `scrollByStep()`：去掉"滚到 S3 跳回 S2"的闭环逻辑，改为滚到最右（`scrollLeft + clientWidth >= scrollWidth - 1`）即 `stopAutoScroll()`，到末尾停止不再循环
- 数据源逻辑不变（按 title 归一化去重、上限 50、入场动画封顶、Coverflow 焦点）

## 迭代 9（2026-08-15，用户明确"中间固定不动，下一部轮流在中间凸显变大"）

先改为"滚动到中央"方案（`scrollToCenterCard`），用户反馈仍不满足——滚动式整排一起平移，中间凸显卡会漂移。

## 迭代 10（2026-08-15，用户再次明确"一开始中间凸显，下一部平滑到中间凸显，慢慢滚动连播"）

改为**槽位式 Coverflow**（重写 `js/recent-watch.js` + `css/index.css`）：
- **CSS**：`.recent-watch-track` 改为 `position:relative; height:296px; overflow:hidden`（移动端 236px）；`.recent-watch-card` 改为 `position:absolute; top/left:50%; transform:translate(-50%,-50%)`，卡片中心锚定容器中心；transition 0.6s 驱动位移/缩放/亮度/透明度；入场动画 keyframes 只淡入（不再动 transform，避免与槽位定位冲突）
- **JS**：
  - `updateCoverflow(track)`：按"距 activeIndex 的环形最短距离"计算每张卡 `translateX(delta*gap)`、`scale`（中央 1，每远一级 -0.16）、`brightness`、`zIndex`、`opacity`（距中央 >3 隐藏）；环形距离保证最后一张接第一张时从右侧滑入中央，无长距离回卷
  - `advance(track)`：`activeIndex = (activeIndex+1) % count`，CSS transition 平滑滑入中央
  - `render()`：`activeIndex = 0`（第一部影片在中央凸显）→ 每 3 秒 `advance` 逐张轮流连播；`>1` 张才启动自动轮流
  - `getCardGap()`：优先读实际卡宽 +56，隐藏时按断点回退（桌面 236 / 移动 190）
- **效果**：中央槽位固定不动，当前影片在正中央放大凸显、两侧逐级缩小压暗；下一部平滑滑入中央凸显，循环连播；DOM 无克隆无滚动
- **删除**：scroll 监听、`scrollToAdjacentCard`/`scrollToCenterCard`/`scrollByStep`/`updateActiveCard`/`scheduleActiveUpdate`/`programmaticScroll`、resize 监听（槽位不依赖窗口宽度）
- **删除未用的 `CARD_GAP_DESKTOP`/`CARD_GAP_MOBILE`**（位置算法改用像素间距后已无引用）

## 迭代 14（2026-08-15，用户"算了，还原到前面两版本"）

放弃克隆循环方案，还原为**环形最短距离的槽位式 Coverflow**（即用户说"可以了"的迭代 11 状态）：
- `render()`：`track.innerHTML = itemsHtml`（不再克隆）
- `updateCoverflow()`：环形折叠 delta（`((i - activeIndex) % count + count) % count`，超 half 减 count），中央 `CENTER_SCALE 1.1` 放大、两侧 scale 1、等视觉间距 24px、超 MAX_VISIBLE_DIST 淡出
- `advance()`：`activeIndex = (activeIndex + 1) % count` 环形循环
- CSS：删除 `.recent-watch-no-anim` 瞬移类

## 迭代 13 补充（2026-08-15，用户坚持"要有循环效果"）

纯 DOM 环形折叠必有 half 边界跳变；纯线性无跳变但不循环。最终方案：**克隆 DOM + 线性推进 + 无感瞬移复位**（`js/recent-watch.js` + `css/index.css`）：
- `render()`：`itemsHtml + hiddenHtml`（克隆整份追加右侧，`aria-hidden` + `tabindex="-1"`）
- `advance()`：线性 `activeIndex = next`（0..N，N 为真实卡数）。`next > N` 时（克隆卡 0 已在中央）加 `.recent-watch-no-anim` 瞬移复位 `activeIndex=0`，双 rAF 后移除——瞬时中央区克隆卡与真实卡内容/位置完全一致，视觉无感
- CSS：恢复 `.recent-watch-track.recent-watch-no-anim .recent-watch-card { transition:none }`
- 效果：中央卡始终凸显，每 3 秒下一部平滑滑入中央，无限循环，无任何长距离飞越跳变

## 迭代 13（2026-08-15，用户反馈"左边一部会从后面跳到右边，不要跳动"）

**根因**：环形折叠的 Coverflow 用"环形最短距离"，当某卡的有向距离跨过 half 边界（如 10 张时 `directed=5` 处）会从负号翻转正号，卡片 CSS transition 瞬间飞越整屏。纯 DOM 无克隆的环形轮播无法避免该跳变。

**修复**：改为**线性 Coverflow**（`js/recent-watch.js`）：
- `delta = i - activeIndex`（纯线性，去掉环形折叠/连续性 `cardDeltas`）
- 切换时所有卡片同步左移一格，CSS transition 天然平滑，无跳变
- `advance()`：滚到末尾（最后一部进中央）即 `stopAutoScroll()`，不再循环回绕
- 初始 `activeIndex=0` 第一部在中央，右侧逐张排开，左侧空（从第一部开始滚动浏览）
- 删除 `cardDeltas` 状态、`recent-watch-no-anim` CSS、render 里的重置

## 迭代 12（2026-08-15，用户要求"鼠标移上去有选中光晕 + 放大效果"，随后撤回）

已实现 hover 放大 + 霓虹光晕（JS 委托 + 内联样式），但用户体验后撤回，全部还原（`hoveredCard`/`applyHoverEffect`/`clearHoverEffect`/mouseover/mouseout 委托删除，CSS 高度与 box-shadow transition 还原）。当前卡片 hover 仅保留浏览器原生 `title` tooltip。

## 迭代 11 补充（2026-08-15，用户反馈"收缩的有点小了，想要和最初一样宽"）

`SCALE_STEP`（两侧逐级缩小）替换为 `CENTER_SCALE = 1.1`：**中央卡放大凸显，两侧卡片保持原始全尺寸（scale 1）**。亮度仍按 `BRIGHTNESS_STEP 0.06` 逐级递减。同步：`.recent-watch-track` 高度 296→318px（容纳中央放大卡 297px），移动端 236→252px。

## 迭代 11（2026-08-15，用户反馈"中间和左右的边距不一样"）

**根因**：原位置算法 `translateX = delta * (cardWidth + 56)` 用等槽中心距，但中央卡 `scale=1` 占宽 180，第 2 级 `scale=0.68` 占宽 122，造成"中央→第1级空隙小，第1级→第2级空隙大"的视觉不等距。

**修复**（`js/recent-watch.js`）：新增 `computeSlotPositions(count, cardWidth, visualGap)` 等视觉间距位置算法——从中央(0)向两侧按 `|delta|` 升序累加：
```
step = visualGap + (scale|d-1| + scale|d|) * cardWidth / 2
pos(d) = pos(d-1) + sign(d) * step
```
保证每对相邻卡的视觉间距恒为 `visualGap`（默认 24px），不被各卡缩放扭曲。结果：中央到第1级、第1级到第2级、所有相邻级别 = **完全等距**。
- **恢复纯白标题**：去掉 `#recentWatchArea h2` 的渐变文字（`background-clip: text`）和 `-webkit-text-fill-color: transparent`，保留左侧 3px 渐变竖条作为轻装饰，与页面其他标题风格统一
