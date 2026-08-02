---
doc_type: refactor-apply-notes
refactor: 2026-08-02-dead-code-cleanup
---

# dead-code-cleanup apply notes

## 步骤 1: 删除 js/swipe-actions.js 并移除 app.js 守卫调用
- 完成时间: 2026-08-02
- 改动文件: js/swipe-actions.js（删除）、js/app.js（删守卫块 ~295-298）
- 验证结果: grep 'SwipeActions' 全项目 0 引用
- 偏离: 无

## 步骤 2: 删除 js/undo-toast.js 并清理 app.js 分支与 index.html 引用
- 完成时间: 2026-08-02
- 改动文件: js/undo-toast.js（删除）、js/app.js（UndoToast 分支改走 showToast 兜底）、index.html（删 #undoToast 容器）
- 验证结果: grep 'UndoToast'/'undoToast' 全项目 0 引用
- 偏离: 无

## 步骤 3: 删除 js/daily-quote.js 并清理 app.js / douban.js 守卫
- 完成时间: 2026-08-02
- 改动文件: js/daily-quote.js（删除）、js/app.js（删守卫块 ~630-633）、js/douban.js（删守卫块 ~582-584）
- 验证结果: grep 'daily-quote'/'updateDailyQuoteVisibility' 全项目 0 引用
- 偏离: 无

## 步骤 4: 删除无引用的 css/modals.css
- 完成时间: 2026-08-02
- 改动文件: css/modals.css（删除）
- 验证结果: grep 'modals.css' 全项目 0 引用
- 偏离: 无

## 步骤 5: 删除根目录杂项 nul / browser_check.html / image/nomedia.psd
- 完成时间: 2026-08-02
- 改动文件: nul（删除）、browser_check.html（删除）、image/nomedia.psd（删除）
- 验证结果: grep 'browser_check' 全项目 0 引用；三文件已从磁盘移除
- 偏离: 无

## 步骤 6（review 后追加，用户确认一并处理）: 清理死 CSS 与注释残留
- 完成时间: 2026-08-02
- 改动文件: css/mobile-optimize.css（删 .undo-toast 系列 + prefers-reduced-motion 中 .undo-toast 引用）、css/index.css（删 #dailyQuoteSection / .daily-quote-* / typing-cursor 系列）、css/styles.css（删 #dailyQuoteToggle 系列 + 头部注释中 modals.css 行）、js/app.js（删 "SwipeActions 仅在移动端激活" 注释残留）、CLAUDE.md（文件树去掉 modals.css、ui.js/index.css 描述去掉每日一言）
- 验证结果: grep '\.undo-toast|#dailyQuoteSection|\.daily-quote|#dailyQuoteToggle|undoToast|modals\.css' 仅剩 ui.js 的 history-undo-toast（独立功能，正确保留）；三个 CSS 文件 lint 0 错误
- 偏离: review 环节 A 发现的 nit N1-N4 + suggestion S1/S2，经用户确认一并处理

## 步骤 7（提交前追加）: 修复 IDE 报错 "Unknown pseudo selector 'inline'" 并清理搜索区死 CSS
- 完成时间: 2026-08-02
- 改动文件: css/mobile-optimize.css（删 .search-button .sm\\:inline 段——IDE 误读 \: 为伪选择器且全项目 0 引用；删 .search-box 引用保留 #searchArea .h-14）、css/index.css（删 .search-box / .search-button / .search-input 系列，全项目 0 引用）、css/styles.css（删 .search-button 系列）
- 验证结果: IDE 报错已消除；read_lints 仅剩 pre-existing warning（top 覆盖 / background shorthand / float px / duplicated fragment，均不在本轮改动范围）；grep 'search-button|search-box|search-input' HTML/JS 0 引用
- 偏离: 用户报告 IDE 报错，确认与本轮死代码清理主题同源，一并处理
