---
doc_type: issue-fix-note
issue: ssrf-asymmetry
slug: ssrf-asymmetry
status: done
date: 2026-08-01
---

# Fix Note：SSRF 防护不对称

## 根因

`isValidUrl()` 仅在 `server.mjs` 中实现，Vercel/Netlify/CF 的代理入口仅检查 URL 是否匹配 `http(s)://`，未验证目标 IP/域名是否指向内网。

## 改动

### Vercel (`api/proxy/[...path].mjs`)

- 新增 `isValidUrl()` (line 63-76)：从 `process.env.BLOCKED_HOSTS` / `BLOCKED_IP_PREFIXES` 读取黑名单
- handler 在 `targetUrl` 解析后调用 (line 470-473)

### Netlify (`netlify/functions/proxy.mjs`)

- 新增 `isValidUrl()` (line 55-68)：同 Vercel
- handler 在 `targetUrl` 解析后调用 (line 315-323)

### Cloudflare Pages (`functions/proxy/[[path]].js`)

- 新增 `isValidUrl()` (line 130-143)：从 `env.BLOCKED_HOSTS` / `env.BLOCKED_IP_PREFIXES` 读取
- handler 在 `targetUrl` 解析后调用 (line 539-542)

### 默认黑名单（所有平台一致）

```
BLOCKED_HOSTS: localhost,127.0.0.1,0.0.0.0,::1
BLOCKED_IP_PREFIXES: 192.168.,10.,172.
```

## 验证

- [x] 四平台（Express + Vercel + Netlify + CF）现在都有 `isValidUrl()` 拦截
- [x] 拦截发生在目标 URL 解析后、fetch 出站前
- [x] 默认黑名单与 server.mjs 一致
- [x] 每个平台使用其原生环境变量读取方式（`process.env` vs `env.*`）

## 遗留风险

- 四个文件的 `isValidUrl()` 是复制品（关联 finding-08）。修改默认黑名单需四端同步更新
- Serverless 沙箱内网可达性取决于平台网络策略，黑名单是端口级防御而非网络层隔离
