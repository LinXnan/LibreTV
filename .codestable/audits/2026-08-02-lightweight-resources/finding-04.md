---
doc_type: audit-finding
audit: 2026-08-02-lightweight-resources
finding_id: "maintainability-04"
nature: maintainability
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 04：3 个 JS 死文件——定义了全局对象但未在任何 HTML 加载

## 速答

`js/swipe-actions.js`（滑动删除手势）、`js/undo-toast.js`（撤销提示）、`js/daily-quote.js`（每日一言）都定义了完整全局对象/函数，但 `index.html` / `player.html` 的 script 列表里**都没有它们**，相关 UI 功能实际未生效——app.js 用 `typeof` 守卫兜底导致不报错，反而掩盖了死代码。

## 关键证据

- `js/swipe-actions.js:6` — `const SwipeActions = {...}`（滑动删除管理器）
- `js/undo-toast.js:6` — `const UndoToast = {...}`（撤销提示管理器）
- `js/daily-quote.js:3-15` — `DAILY_QUOTE_CONFIG` + `updateDailyQuoteVisibility` 等（每日一言）
- `index.html:566-583` — script 列表：utils / config / proxy-auth / customer_site / ui / mobile-panel-gestures / api / douban / password / search / app / optimize-apply / pwa-register / index-page，**无这三个**
- `player.html:309-318` — 同样无这三个
- `js/app.js:296-297` — `if (typeof SwipeActions !== 'undefined') SwipeActions.init(container)`（守卫）
- `js/app.js:514-515` — `if (typeof UndoToast !== 'undefined') UndoToast.show(...)`（守卫）
- `js/app.js:640-641`、`js/douban.js:582-583` — `if (typeof updateDailyQuoteVisibility === 'function')`（守卫）
- `index.html:201` — `onclick="UndoToast.undo()"`（内联引用，但脚本未加载 → 点击会报 ReferenceError）

## 影响

三个文件约几百行死代码；`index.html` 的"撤销"按钮因 `UndoToast` 未加载点击即报错（已由 `ui.js` 的 `showHistoryUndoToast` 承担实际撤销 UI，属重复实现）。swipe / daily-quote 是"写了但没接线"的完整功能模块，删除或接线二选一。

## 修复方向

确认三项功能是否仍需要：不需要则删文件并清理 app.js 守卫与 index.html 内联引用；需要则把对应 script 标签加回 HTML 并核对与 ui.js 现有实现的职责边界。

## 建议动作

`cs-refactor`，因为这是死代码清理 / 接线决策，行为收口。
