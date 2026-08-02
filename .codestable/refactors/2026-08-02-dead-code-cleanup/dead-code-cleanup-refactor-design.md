---
doc_type: refactor-design
refactor: 2026-08-02-dead-code-cleanup
status: approved
scope: 删除 3 个未加载的 JS 死文件 + 清理相关引用 + 删除死 CSS 与杂项文件（共 9 文件：删 7、改 2）
summary: 落地 lightweight-resources 审计 finding-04/05：swipe-actions/undo-toast/daily-quote 三死文件删除并清理引用，modals.css 与根目录杂项清理
---

# dead-code-cleanup refactor design

## 1. 本次范围

- 从 scan 勾选全部 5 条：#1 swipe-actions.js、#2 undo-toast.js、#3 daily-quote.js、#4 modals.css、#5 根目录杂项
- **不做**：finding-01（Tailwind 运行时替换，需构建工具链 + 全页面改动）、finding-02/03（多平台代理/注入收口，跨模块）——留后续独立批次
- 预估总工作量：5 步，全部 AI 自证，无 HUMAN 目视
- 总风险档位：**低**（全部为删除未生效/无引用代码，行为等价）

## 2. 前置依赖

- 无测试覆盖需求（项目无自动化测试；删除的是从未加载/无引用的死文件，grep 自证即可）
- 调用方已搜：swipe/undo-toast/daily-quote 均未在任何 HTML 加载；app.js/douban.js 用 typeof 守卫兜底

## 3. 执行顺序

### 步骤 1：删除 js/swipe-actions.js 并移除 app.js 守卫调用
- 引用方法：M-L2-02（Inline Function 反向——删除无引用的死代码）
- 具体操作：删除 `js/swipe-actions.js`；删除 `js/app.js:295-298` 的 `if (typeof SwipeActions !== 'undefined')` 块（保留 .swipe-container DOM 结构与 CSS）
- 退出信号：grep `SwipeActions` 全项目 0 引用
- 验证责任：AI 自证
- 回滚：git 恢复两文件

### 步骤 2：删除 js/undo-toast.js 并清理 app.js 分支与 index.html 引用
- 引用方法：M-L2-02
- 具体操作：删除 `js/undo-toast.js`；`js/app.js:513-518` 移除 `if (typeof UndoToast...)` 分支，保留 `showToast('已移除自定义API: ...')` 兜底调用；`index.html:199-202` 删除 `#undoToast` 容器及内联 `onclick="UndoToast.undo()"`
- 退出信号：grep `UndoToast` 全项目 0 引用；app.js 处仅剩 showToast 调用
- 验证责任：AI 自证
- 回滚：git 恢复三文件

### 步骤 3：删除 js/daily-quote.js 并清理 app.js / douban.js 守卫
- 引用方法：M-L2-02
- 具体操作：删除 `js/daily-quote.js`；删除 `js/app.js:640-641`、`js/douban.js:582-583` 的 `if (typeof updateDailyQuoteVisibility === 'function')` 调用块
- 退出信号：grep `daily-quote` / `updateDailyQuoteVisibility` 全项目 0 引用
- 验证责任：AI 自证
- 回滚：git 恢复三文件

### 步骤 4：删除无引用的 css/modals.css
- 引用方法：M-L2-02
- 具体操作：删除 `css/modals.css`
- 退出信号：grep `modals.css` 全项目 0 引用
- 验证责任：AI 自证
- 回滚：git 恢复该文件

### 步骤 5：删除根目录杂项（nul / browser_check.html / image/nomedia.psd）
- 引用方法：M-L2-02
- 具体操作：删除根目录 `nul`、`browser_check.html`、`image/nomedia.psd`
- 退出信号：grep `browser_check` 全项目 0 引用；三文件已从磁盘移除
- 验证责任：AI 自证
- 回滚：git 恢复（nul 为 untracked 垃圾文件，无需恢复）

## 4. 风险与看点

- 高风险步骤：无（全部低风险删除）
- 容易出错的点：
  - 步骤 2 的 `index.html` 撤销按钮是死引用（点击报 ReferenceError）——删除容器后需确认 `ui.js` 的 `showHistoryUndoToast` 走的是另一套 `#history-undo-toast`，不受影响
  - 步骤 1 删除守卫后，`.swipe-container` / `.swipe-actions` DOM 结构仍在 app.js 渲染，CSS 仍生效，移动端显示逻辑不变（仅手势失效，现状即失效）
