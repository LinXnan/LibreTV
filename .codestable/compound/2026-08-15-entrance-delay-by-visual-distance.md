# 入场动画延迟按 DOM index 递增 + CSS backwards 填充会造成左右不对称的"一边空白"

## 背景

用户反馈首页"最近观看"轮播初次加载时左侧整片空白，等约 1~2 秒才"加载出来"。排查后发现问题不在懒加载：封面有渐变占位符兜底，真正的空白是**整卡 `opacity: 0`**。

根因在 `js/recent-watch.js` 的 `applyEntranceDelays()`：入场动画延迟按卡片 **DOM index**（= 历史顺序，最新在前）递增设置 `animationDelay = Math.min(index * 60, 800)ms`。而 `updateCoverflow()` 的槽位排版中 `activeIndex=0` 时**左侧卡片恰是 DOM index 最大的几张**。配合 `css/index.css:165` 的 `animation: recent-watch-card-in 0.55s ... backwards`（`backwards` 填充使 delay 期间保持 `from { opacity: 0 }`），左侧卡片透明最久（最多 800ms delay + 550ms 动画 ≈ 1.35s），形成"中央 + 右侧先出、左侧空白"。

## 结论

1. **入场动画延迟必须按卡片距中央槽位的视觉距离分配，不能按 DOM 顺序**。修复方式：复用 `updateCoverflow` 的 delta 折叠算法（`((i - activeIndex) % count + count) % count`，`delta > half` 时减 count，取 `dist = |delta|`），`animationDelay = Math.min(dist * 80, 400)ms`——中央先出、左右两侧对称同时淡入。两处视觉距离口径必须一致，避免引入第二套排版逻辑。
2. **CSS `backwards` 填充模式下，`animation-delay` 期间元素保持起始帧（常为 `opacity: 0`）**。任何"按顺序错峰淡入"的延迟分配都要自问：这个顺序在视觉上对称吗？不对称就会产生用户感知的"某侧空白/加载慢"。
3. 同一轮播的动画延迟只影响首次渲染：`advance()` 切换只改 transform（transition），不重触发入场动画，因此延迟分配不用随 `activeIndex` 实时更新。
4. 遗留脆弱点：`applyEntranceDelays` 用 `.recent-watch-card:not([aria-hidden])` 而 `updateCoverflow` 用 `.recent-watch-card`，当前渲染无卡片带 `aria-hidden` 所以 index 一致；未来若给卡片加该属性会导致两处 count/index 错位，应统一 selector。

## 证据

- `js/recent-watch.js:221-237` — `applyEntranceDelays()` 修复后实现（按视觉距离分配）
- `js/recent-watch.js:99-124` — `updateCoverflow()` delta 折叠算法（延迟分配复用的口径）
- `css/index.css:165` — `.recent-watch-card { animation: recent-watch-card-in 0.55s ... backwards }`
- `css/index.css:213-220` — `@keyframes recent-watch-card-in { from { opacity: 0 } to { opacity: 1 } }`
- 修复记录：`.codestable/issues/2026-08-15-recent-watch-left-empty-on-load/`
