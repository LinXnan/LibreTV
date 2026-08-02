---
doc_type: refactor-scan
refactor: 2026-08-02-password-inject-consolidation
status: user-reviewed
scope: 3 套密码注入中间件（Vercel middleware.js / Netlify inject-env.js / CF _middleware.js）收敛为共享 injectPassword 模块
summary: 基于 lightweight-resources 审计 finding-03，消解 3 套中间件中的密码哈希与注入逻辑重复
---

# password-inject-consolidation scan

## 总览

- 扫描范围：`middleware.js`（Vercel）、`netlify/edge-functions/inject-env.js`（Netlify）、`functions/_middleware.js`（CF）——三套中间件逻辑高度重复；`js/sha256.js` 作为现成共享模块被 Vercel/CF 已引用，Netlify 尚未引用
- 发现 2 条优化点：结构 2
- 按风险：低 2 / 中 0 / 高 0
- 建议先做：#1（收敛 Netlify 内联 sha256，最小改动）→ #2（抽共享 injectPassword 模板函数）
- 前置检查 7 条：
  1. 行为改动？✓ 无（SHA-256 输出一致，占位符替换目标一致，已逐行对比内联 sha256 与 js/sha256.js 逻辑等价）
  2. 测试覆盖？✓ 豁免（相同输入 PASSWORD → 固定 SHA-256 输出，可 grep 对比确认替换字符串一致）
  3. 跨模块？✓ 本次目标即消解跨模块重复，非"解决不了才中止"的跨模块问题
  4. 风格口味？✓ 无
  5. 生成/第三方？✓ 无（均为手写）
  6. 范围太大？✓ 4 文件 < 15
  7. 零候选？✓ 有候选

## 本轮不做

- **server.mjs 密码注入不改**：Express 端用 Node `crypto.createHash('sha256')`（同步），中间件用 Web Crypto Subtle（异步），底层不同且 server.mjs 的 `renderPage` 还涉及文件路径解析，不在本次范围
- **libs/sha256.min.js → js/sha256.js 浏览器端替换**：`js/sha256.js` 是 ES module 语法，浏览器 `<script defer>` 无法直接加载，需改写为非 module 形式或保留 CDN 引入——留后续批次

## 条目

### [1] Netlify inject-env.js 内联 sha256 改为引用共享 js/sha256.js

- **位置**：`netlify/edge-functions/inject-env.js:23-29`（内联 sha256）
- **分类**：结构
- **现状**：`inject-env.js` 在函数内部重复了一份 sha256（`crypto.subtle.digest('SHA-256', ...)` 转 hex），与 `js/sha256.js:1-6` **逐行一致**。`middleware.js` 和 `_middleware.js` 已正确引用 `js/sha256.js`，只有 Netlify 是内联的
- **问题**：同一逻辑三份：js/sha256.js（313B ES module）、Netlify inject-env 内联（重复）、Netlify ~~Edge 独立实现~~（实际就是内联这份）。已构成不对称——其他两平台引用共享模块，Netlify 自己写了一遍
- **建议**：删除 `inject-env.js:23-29` 内联 sha256，顶部加 `import { sha256 } from '../../js/sha256.js';`；grep 确认原内联函数名 `sha256` 无残留引用
- **建议映射的方法**：M-L2-02（内联 → 函数调用，反向删除重复实现）
- **风险**：低（逻辑逐行相同，import 路径在 Netlify Edge 部署时需确认可解析；如不可行则保留内联）
- **验证**：AI 自证（grep 内联 sha256 无残留；re import 路径可解析）
- **范围**：约 6 行删 + 1 行 import / 1 文件

### [2] 抽取共享注入函数 injectPassword，3 套中间件引用同一实现

- **位置**：新增 `js/password-inject.js`；`middleware.js:28-44`、`inject-env.js:32-48`、`_middleware.js:11-24`
- **分类**：结构
- **现状**：三套中间件的核心逻辑完全相同——获取 PASSWORD、哈希、替换 `{{PASSWORD}}` 占位符、返回 Response。差异仅在各平台获取 PASSWORD 的方式（`process.env` / `Netlify.env.get` / `env`）和 Response 构造方式（Vercel `new Response` / Netlify `context.next()` / CF `next()`）
- **问题**："检测 HTML / 哈希 / 替换占位符" 三段论在 3 个文件各写一式，后续改占位符格式需同步 3 个地方
- **建议**：新建 `js/password-inject.js`，导出 `async function injectPassword(html, password) { ... }`（接收 HTML 字符串和明文密码，返回注入后的 HTML）；三套中间件改为调用此函数，各平台只保留平台特有的 PASSWORD 读取 + Response 构造
- **建议映射的方法**：M-L3-07（职责分离——平台适配 vs 注入逻辑） + M-L2-01（提取共享函数）
- **风险**：低（替换逻辑等价，唯一风险是 Netlify inject-env 的 import 路径，已在 #1 验证）
- **验证**：AI 自证（grep `{{PASSWORD}}` 替换字符串三处一致；三文件 import 路径正确）
- **范围**：新增 1 文件（~20 行），修改 3 文件各约 8 行
