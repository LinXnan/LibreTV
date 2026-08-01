---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "security-02"
nature: security
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 02：SSRF 防护不对称——Express 有 IP/域名黑名单，Serverless 平台无

## 速答

`server.mjs:97-118` 通过 `isValidUrl()` 实施可配置的 SSRF 防护（`BLOCKED_HOSTS` + `BLOCKED_IP_PREFIXES`），默认证拦 `localhost`、`127.0.0.1`、`192.168.*`、`10.*`、`172.*`。但 Vercel（`api/proxy/[...path].mjs:55-78`）、Netlify（`netlify/functions/proxy.mjs:43-54`）、CF（`functions/proxy/[[path]].js:139-164`）只校验 URL 是否像 `http(s)://...`，不验证目标 IP/域名。

## 关键证据

- `server.mjs:103-113` — `BLOCKED_HOSTS` + `BLOCKED_IP_PREFIXES` 黑名单 ，默认拦截本地与 C 类私网
- `api/proxy/[...path].mjs:63` — 仅 `decodedUrl.match(/^https?:\/\/.+/i)` ——不在 Vercel 环境做 SSRF 检查
- `netlify/functions/proxy.mjs:47` — 同逻辑
- `functions/proxy/[[path]].js:149` — 同逻辑

## 影响

- **范围**：部署在 Vercel / Netlify / Cloudflare Pages 的实例
- **影响**：攻击者可构造 `http://169.254.169.254/latest/meta-data/`（云元数据端点）或 `http://10.0.0.1/internal-api` 等内网地址，通过代理间接访问
- **严重度 P1（非 P0）**：Serverless 函数通常运行在隔离沙箱中，内网访问能力受平台限制，实际利用面取决于平台网络策略

## 修复方向

- 把 `isValidUrl()` 逻辑提取为共用函数，注入到 Vercel/Netlify/CF 代理入口
- 对 Serverless 函数出口限制加注文档说明不同平台的网络隔离差异
- 建议动作：`cs-issue`
