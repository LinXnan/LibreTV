---
doc_type: refactor-apply-notes
refactor: 2026-08-02-password-inject-consolidation
---

# password-inject-consolidation apply notes

## 步骤 1: Netlify inject-env 内联 sha256 改为 import js/sha256.js
- 完成时间: 2026-08-02
- 改动文件: netlify/edge-functions/inject-env.js（删内联 sha256 函数 23-29 行，顶部加 import）
- 验证结果: grep 'async function sha256' / 'crypto.subtle.digest' 在该文件 0 残留
- 偏离: 无

## Review-fix: I-1 替换字符串粒度统一
- 完成时间: 2026-08-02
- 改动文件: js/password-inject.js（统一有密码/空密码分支均为 `replace('{{PASSWORD}}', ...)` 字面量替换，删除 `// SHA-256 hash` 注释，修正 JSDoc）
- 验证结果: 两分支对称；与 server.mjs 的替换逻辑一致（都是用 `replace('{{PASSWORD}}', ...)`）；grep 确认 `{{PASSWORD}}` 在三个中间件 import 的模块中只有 password-inject.js 处理

## 步骤 2: 创建共享 injectPassword 函数，3 套中间件统一调用
- 完成时间: 2026-08-02
- 改动文件: js/password-inject.js（新增）、middleware.js（Vercel，改 import + 注入逻辑）、netlify/edge-functions/inject-env.js（Netlify，改 import + 注入逻辑）、functions/_middleware.js（CF，改 import + 注入逻辑）
- 验证结果:
  - 三套中间件均无直接 sha256 import（grep 0），全部通过 password-inject.js 间接调用
  - password-inject.js 是 sha256 的唯一引用入口
  - {{PASSWORD}} 替换字符串集中在 password-inject.js，三平台天然一致
- 偏离: 无

## Review-fix: I-1 替换字符串粒度统一
- 完成时间: 2026-08-02
- 改动文件: js/password-inject.js（统一有密码/空密码分支均为 `replace('{{PASSWORD}}', ...)` 字面量替换，删除 `// SHA-256 hash` 注释，修正 JSDoc）
- 验证结果: 两分支对称；与 server.mjs 的替换逻辑一致；grep 确认 `{{PASSWORD}}` 仅 password-inject.js 处理

## Review-fix: I-1 替换字符串粒度统一
- 完成时间: 2026-08-02
- 改动文件: js/password-inject.js（统一有密码/空密码分支均为 `replace('{{PASSWORD}}', ...)` 字面量替换，删除 `// SHA-256 hash` 注释，修正 JSDoc）
- 验证结果: 两分支对称；与 server.mjs 的替换逻辑一致（都是用 `replace('{{PASSWORD}}', ...)`）；grep 确认 `{{PASSWORD}}` 在三个中间件 import 的模块中只有 password-inject.js 处理
