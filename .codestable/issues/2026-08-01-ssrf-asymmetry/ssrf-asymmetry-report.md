---
doc_type: issue-report
issue: ssrf-asymmetry
slug: ssrf-asymmetry
status: confirmed
severity: P1
nature: security
source: audit-2026-08-01-core-subsystems-finding-02
issue_path: fast-track
tags: [security, ssrf, proxy, vercel, netlify, cloudflare]
created: 2026-08-01
---

# SSRF 防护不对称——Serverless 平台缺少内网/IP 黑名单

## 问题

`server.mjs:97-118` 有 `isValidUrl()` 实现可配置的黑名单（默认拦截 `localhost`、`127.0.0.1`、`192.168.*`、`10.*`、`172.*`）。但 Vercel、Netlify、CF 的代理入口仅检查 URL 是否匹配 `http(s)://`，不验证目标 IP/域名是否指向内网。

## 根因

`isValidUrl` 逻辑编写在 server.mjs 内部，未作为共用函数引入 Serverless 三平台。

## 修复方案

将 `isValidUrl()` 移植到三个平台文件，在目标 URL 解析后、出站 fetch 前调用：
- Vercel: `api/proxy/[...path].mjs` — 在 handler 中 `getTargetUrlFromPath` 后调用
- Netlify: `netlify/functions/proxy.mjs` — 同上
- CF: `functions/proxy/[[path]].js` — 同上

每端环境变量读取方式不同（Vercel/Netlify 用 `process.env`，CF 用 `env.*`），按各平台适配。

## 快速通道判定

- 根因：已有 Express 实现模板（明确）
- 修复范围：三个文件各新增 `isValidUrl()` 函数 + handler 中插入校验调用
- 跨模块影响：无——纯安全加固，不影响现有功能
