---
doc_type: issue-fix
issue: 2026-08-15-recent-watch-left-empty-on-load
status: confirmed
path: standard
fix_date: 2026-08-15
related: [2026-08-15-recent-watch-left-empty-on-load-analysis.md]
tags: [recent-watch, animation, entrance-delay]
---

# 最近观看左侧空白加载延迟 修复记录

## 1. 根因摘要

`js/recent-watch.js` 的 `applyEntranceDelays()`（原 :222-229）按卡片 **DOM index**（= 历史顺序，最新在前）递增设置 `animationDelay = Math.min(index * 60, 800)ms`。配合 `css/index.css:165` 的 `.recent-watch-card { animation: recent-watch-card-in 0.55s ... backwards }`（`backwards` 填充使 delay 期间保持 `from { opacity: 0 }`），整卡（含占位符）在 delay 期间完全透明。

`updateCoverflow()` 的槽位排版中 `activeIndex=0` 时左侧卡片恰是 DOM index 最大的几张，因此左侧卡片透明最久（最多 800ms delay + 550ms 动画 ≈ 1.35s）——用户感知为"左边空白，过一会才加载出来"。封面懒加载有占位符兜底，并非空白根因。

## 2. 实际采用方案

方案 A（analysis 推荐，owner 确认）：`applyEntranceDelays()` 改为按卡片**距中央槽位的视觉距离**（`dist = |delta|`，算法与 `updateCoverflow` 相同）分配延迟，`animationDelay = Math.min(dist * 80, 400)ms`。中央先出、左右两侧对称同时淡入，消除左右不对称的"左边空白"，保留层次感。

## 3. 改动文件清单

- `js/recent-watch.js` — `applyEntranceDelays()` 重写（:221-237）：
  - 原：`realCards.forEach((card, index) => { card.style.animationDelay = Math.min(index * 60, 800)ms })`
  - 新：先计算 `count` / `half`，按 `activeIndex` 折叠 delta 取 `dist`，`animationDelay = Math.min(dist * 80, 400)ms`；`count === 0` 时提前 return（防御，与 `updateCoverflow` 一致）
- `.codestable/issues/2026-08-15-recent-watch-left-empty-on-load/2026-08-15-recent-watch-left-empty-on-load-analysis.md` — status → confirmed
- `.codestable/issues/2026-08-15-recent-watch-left-empty-on-load/approval-report.md` — issue-fix-plan → approved

## 4. 验证结果

- **lint**：`read_lints` 0 错误
- **逻辑推导**（4 卡场景，用户截图）：index 0 中央（dist 0 → 0ms）、右侧 1/2/3（dist 1/2/3 → 80/160/240ms）、左侧 4（dist 1 → 80ms）→ 中央 + 左右第 1 级同时淡入，左侧不再空白
- **多卡场景**：`dist * 80` 封顶 400ms，最长 400ms + 550ms 动画 ≈ 0.95s，短于原 1.35s
- **回归**：`prefers-reduced-motion: reduce` 用户不受影响（守卫保留）；懒加载 / 切换 / 自动轮流 / 点击跳转路径未改动
- **浏览器验证**：用户确认通过——刷新首页后左侧卡片与右侧对称同时淡入，无"左边空白"

## 5. 遗留事项

无。桌面 / 移动端共用同一条代码路径，本次修复同时覆盖两端。
