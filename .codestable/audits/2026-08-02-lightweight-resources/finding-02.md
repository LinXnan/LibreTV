---
doc_type: audit-finding
audit: 2026-08-02-lightweight-resources
finding_id: "maintainability-02"
nature: maintainability
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 02：4 套代理实现重复（Express / Vercel / Netlify / CF）

## 速答

同一份代理逻辑（SSRF 黑名单、鉴权、超时重试、响应转发）在 `server.mjs`、`api/proxy/[...path].mjs`、`netlify/functions/proxy.mjs`、`functions/proxy/[[path]].js` 各实现一遍，合计上千行高度重复代码，平台间行为易漂移。

## 关键证据

- `server.mjs`（259 行）— Express 内联代理，`import axios from 'axios'`（`server.mjs:3,181`）
- `api/proxy/[...path].mjs`（497 行）— Vercel 函数代理，`import fetch from 'node-fetch'`（`api/proxy/[...path].mjs:3`）
- `netlify/functions/proxy.mjs`（327 行）— Netlify 函数代理，同样 `node-fetch`（`netlify/functions/proxy.mjs:3`）
- `functions/proxy/[[path]].js`（623 行）— Cloudflare Pages 函数代理
- 三份文件都含 SSRF 防护、`PASSWORD` 校验、超时、响应头转发等相同逻辑块

## 影响

改代理逻辑必须同步 4 个文件（attention.md 已明文提醒"代理改动必须同步 4 个平台实现"）。之前 core-subsystems 审计的 finding-02/04/08 均源于平台间不对称——多份复制正是不对称 bug 的温床。维护成本高，体积冗余 ~1500 行。

## 修复方向

抽公共代理核心（鉴权 + SSRF + 转发），各平台入口只留薄适配层；或至少把 SSRF/鉴权逻辑收敛成共享模块。

## 建议动作

`cs-refactor`，因为这是行为等价的重复消除与结构收敛。
