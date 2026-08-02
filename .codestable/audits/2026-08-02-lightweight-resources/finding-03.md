---
doc_type: audit-finding
audit: 2026-08-02-lightweight-resources
finding_id: "maintainability-03"
nature: maintainability
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 03：4 套密码注入实现重复 + sha256 三份实现

## 速答

"把 `window.__ENV__.PASSWORD = "{{PASSWORD}}"` 替换成 SHA-256 哈希"这一逻辑在 4 个平台各写一遍，且 sha256 存在 3 份实现（服务端 `js/sha256.js`、浏览器 `libs/sha256.min.js`、Netlify Edge 内联实现），冗余且易不对称。

## 关键证据

- `server.mjs:47-64` — `sha256Hash()` + `renderPage()` 替换占位符（Express 用 `crypto`）
- `middleware.js:1-40` — Vercel middleware，`import { sha256 } from './js/sha256.js'` 替换占位符
- `functions/_middleware.js:1-28` — Cloudflare Pages 中间件，同样引 `../js/sha256.js` 替换
- `netlify/edge-functions/inject-env.js:23-41` — Netlify Edge 函数，**内联**了一份 sha256 实现再替换
- sha256 实现三处：`js/sha256.js`（313B，ES module）、`libs/sha256.min.js`（8.81KB，浏览器全局）、`netlify/edge-functions/inject-env.js:24-29`（内联）

## 影响

4 个平台注入行为需人工保持一致（Netlify 用内联、其他引共享文件，已是漂移起点）；`libs/sha256.min.js` 8.81KB 仅为了浏览器端算密码哈希，而 `js/sha256.js` 313B 的 ES module 实现与它重复。安全相关逻辑多份复制，错一处即鉴权不对称。

## 修复方向

Netlify Edge 改为引共享 `sha256` 模块（与 Vercel/CF 对齐），并评估浏览器端 `libs/sha256.min.js` 是否能被 `js/sha256.js` 替代（或反过来），收敛为一份实现。

## 建议动作

`cs-refactor`，因为这是多平台重复实现的收口，行为等价。
