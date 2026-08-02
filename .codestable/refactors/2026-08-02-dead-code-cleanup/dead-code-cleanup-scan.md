---
doc_type: refactor-scan
refactor: 2026-08-02-dead-code-cleanup
status: user-reviewed
scope: 3 个未加载的 JS 死文件 + 相关引用清理 + 死 CSS 与杂项文件删除（共约 9 文件，其中删除 7、修改 2）
summary: 审计 lightweight-resources 的 finding-04/05 落地：删除从未加载/无引用的死文件，行为等价
---

# dead-code-cleanup scan

## 总览

- 扫描范围：`js/swipe-actions.js`、`js/undo-toast.js`、`js/daily-quote.js` + 引用点（`js/app.js`、`js/douban.js`、`index.html`）+ `css/modals.css` + 根目录杂项（`nul` / `browser_check.html` / `image/nomedia.psd`）
- 发现 5 条优化点：结构 5（死文件删除）
- 按风险：低 5 / 中 0 / 高 0
- 建议先做：#1 #2 #3（删除未加载 JS + 清理引用，AI 可 grep 自证）
- 建议慎做 / 后做：无
- 前置检查 7 条：
  1. 行为改动？✓ 无（均为未生效/无引用代码，删除等价）
  2. 测试覆盖？✓ 豁免（纯删除未接线模块，grep 自证；项目无自动化测试）
  3. 跨模块？✓ 无（finding-02/03 多平台收口本轮不做，见下）
  4. 风格口味？✓ 无
  5. 生成/第三方？✓ 无（均为手写/垃圾文件）
  6. 范围太大？✓ 9 文件 < 15
  7. 零候选？✓ 有候选

## 本轮不做（明确排除）

- **finding-01 Tailwind Play CDN 运行时替换**：需引入 Tailwind CLI 构建工具链 + 改动所有 HTML/JS 中数百个 Tailwind 类，范围远超单次 refactor，需 HUMAN 目视验证 → 后续单独开 refactor
- **finding-02/03 4 套代理/密码注入收口**：跨 Express/Vercel/Netlify/CF 4 个平台模块，命中前置检查第 3 条（跨模块）→ 需先 cs-domain 定边界或拆成单平台批次

## 条目

### [1] 删除 js/swipe-actions.js 并移除 app.js 的 SwipeActions 守卫调用

- **位置**：`js/swipe-actions.js`（全文件）、`js/app.js:295-298`
- **分类**：结构
- **现状**：`swipe-actions.js:6` 定义 `const SwipeActions`（滑动删除手势管理器），但 `index.html:566-583` / `player.html:309-318` 的 script 列表均未加载它；`app.js:296-297` 用 `if (typeof SwipeActions !== 'undefined')` 守卫调用
- **问题**：文件约 200 行从未执行，滑动删除功能实际未生效；守卫掩盖了死代码
- **建议**：删除 `js/swipe-actions.js`；删除 `app.js:295-298` 的守卫调用块（`.swipe-container` DOM 结构与 CSS 保留，行为不变）
- **建议映射的方法**：M-L2-02（Inline Function 的反向——删除无引用的死代码）
- **风险**：低（文件从未加载，DOM/CSS 保留）
- **验证**：AI 自证（grep `SwipeActions` 全项目 0 引用）
- **范围**：约 200 行删 / 2 文件

### [2] 删除 js/undo-toast.js 并清理 index.html 的 UndoToast 引用

- **位置**：`js/undo-toast.js`（全文件）、`js/app.js:513-518`、`index.html:199-202`
- **分类**：结构
- **现状**：`undo-toast.js:6` 定义 `const UndoToast`（撤销提示管理器），未在任何 HTML 加载；`index.html:199-202` 有 `#undoToast` 容器和 `onclick="UndoToast.undo()"`（点击即 ReferenceError）；`app.js:514` 守卫调用，未命中时走 `else` 分支 `showToast(...)`
- **问题**：文件从未加载，`index.html` 的撤销按钮是死引用（点击报错）
- **建议**：删除 `js/undo-toast.js`；删除 `app.js:513-518` 的 `if (typeof UndoToast...)` 分支保留 `showToast` 兜底；清理 `index.html:199-202` 的 `#undoToast` 容器与内联 `onclick`
- **建议映射的方法**：M-L2-02（删除无引用的死代码）
- **风险**：低（删除后仍走 `showToast` 兜底，行为与现状一致）
- **验证**：AI 自证（grep `UndoToast` 全项目 0 引用；确认 app.js 删除分支后只剩 `showToast` 调用）
- **范围**：约 60 行删 / 3 文件

### [3] 删除 js/daily-quote.js 并清理 app.js / douban.js 守卫

- **位置**：`js/daily-quote.js`（全文件）、`js/app.js:640-641`、`js/douban.js:582-583`
- **分类**：结构
- **现状**：`daily-quote.js` 定义每日一言模块（约 420 行），未在任何 HTML 加载；`app.js:640`、`douban.js:582` 用 `if (typeof updateDailyQuoteVisibility === 'function')` 守卫调用
- **问题**：文件约 420 行从未执行，每日一言功能从未展示
- **建议**：删除 `js/daily-quote.js`；删除 `app.js:640-641`、`douban.js:582-583` 两处守卫调用块
- **建议映射的方法**：M-L2-02（删除无引用的死代码）
- **风险**：低（文件从未加载，HTML 无对应元素）
- **验证**：AI 自证（grep `daily-quote` / `updateDailyQuoteVisibility` 全项目 0 引用）
- **范围**：约 420 行删 / 3 文件

### [4] 删除无引用的 css/modals.css

- **位置**：`css/modals.css`（全文件）
- **分类**：结构
- **现状**：4 个 HTML 的 `<link>` 只引 styles / index / player / watch / mobile-optimize / performance-optimize，`modals.css` 无任何引用
- **问题**：死 CSS 文件，约 100+ 行从未加载
- **建议**：删除 `css/modals.css`
- **建议映射的方法**：M-L2-02（删除无引用的死代码）
- **风险**：低（无引用）
- **验证**：AI 自证（grep `modals.css` 全项目 0 引用）
- **范围**：约 100+ 行删 / 1 文件

### [5] 删除根目录杂项：nul / browser_check.html / image/nomedia.psd

- **位置**：根目录 `nul`、`browser_check.html`、`image/nomedia.psd`
- **分类**：结构
- **现状**：`nul` 是 Windows 重定向垃圾文件；`browser_check.html` 是一次性调试工具页（"历史记录图片URL检查工具"）；`nomedia.psd` 是设计源文件
- **问题**：三文件均非产品资源，不应随站点部署（psd/调试页可能被爬虫收录）
- **建议**：删除三个文件
- **建议映射的方法**：M-L2-02（删除无引用的死代码）
- **风险**：低（无引用）
- **验证**：AI 自证（grep `browser_check` 全项目 0 引用）
- **范围**：3 文件删
