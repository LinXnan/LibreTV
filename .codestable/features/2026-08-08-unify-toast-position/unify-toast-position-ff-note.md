---
doc_type: feature-ff-note
feature: unify-toast-position
date: 2026-08-08
requirement:
tags: [ui, notification, css]
---

## 做了什么
把全系统通知中仍显示在底部的两个提示统一为「顶部居中」：历史删除撤销条（`.history-undo-toast`）与恢复播放位置提示（`.position-restore-hint`）。范围经用户确认：通用 `#toast`（本就顶部居中）作基准不动，快捷键提示、广告统计、ArtPlayer 倍速提示均不改。

## 改了哪些
- `css/styles.css` — `.history-undo-toast` 从「PC 右下角 / 移动底部居中」统一改为顶部居中（`top:16px` + `left:50%`），移动端加 `max(1rem, env(safe-area-inset-top))` 规避刘海屏；动画由右侧/下方滑入改为从上方滑入（keyframes 收敛为 `toast-slide-in-down/out-up`）；删除 `.position-restore-hint` 旧定义块（opacity 显隐收敛进 player.css）
- `css/player.css` — `.position-restore-hint` 从底部居中（`bottom:20px`）改为顶部居中 `top: calc(88px + 16px)`（避开播放页固定 header 约 88px），初始 transform 改 `translateY(-100%)` 从上方滑入；新增移动端 `@media(max-width:640px)` safe-area 叠加 header 高度；补 `opacity:0`/`.show{opacity:1}` 显隐控制
- `js/ui.js:797` — `hideHistoryUndoToast` 移除时序 180→220ms，避免与 180ms 滑出动画竞态截断

## 怎么验证的
本地 `node server.mjs` 启动，`player.html` / `index.html` / `styles.css` / `player.css` / `js/ui.js` 全部 200 且内容完整；CSS 无 lint 错误。独立 code review（round 1 发现 header 遮挡 blocking，round 2 完整复审通过）。手动路径待浏览器确认：删除历史出现撤销条于顶部居中、从历史继续播放出现「已从 mm:ss 继续播放」于 header 下方顶部居中。

## 顺手发现（可选，不阻塞）
- `js/ui.js:761-799` — `showHistoryUndoToast` 创建 `history-undo-toast` 类；CSS 中 `.history-undo-toast-pc` 兼容类已无 JS 消费者，属残留，不在本次范围
- `css/player.css` — `.position-restore-hint` 隐藏时 opacity 瞬时消失（transition 仅作用于 transform），与修复前行为一致，未加 opacity 过渡，不属回归
