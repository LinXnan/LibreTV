---
doc_type: issue-report
issue: proxy-full-buffer
slug: proxy-full-buffer
status: confirmed
severity: P1
nature: performance
source: audit-2026-08-01-core-subsystems-finding-10
issue_path: fast-track
tags: [proxy, performance, vercel, netlify]
created: 2026-08-01
---

# Vercel/Netlify 代理全量缓冲文本响应

## 问题

审计 finding-10 指出 Vercel (`api/proxy/[...path].mjs`) 和 Netlify (`netlify/functions/proxy.mjs`) 的 `fetchContentWithType` 对**所有响应类型**均使用 `response.text()` 全量读入内存，无二进制/文本分支，也无大小限制。大响应（二进制文件、大 M3U8）导致内存暴涨。

## 当前状态

二进制分支已在 finding-04（proxy-binary-corruption）修复中完成，两个 proxy 文件均已有 `isBinaryContent()` → `arrayBuffer()` 分支。本次 issue 仅覆盖**文本全量缓冲**问题。

## 评估：文本流式传输可行性

| 平台 | M3U8 内容 | 非 M3U8 文本 |
|---|---|---|
| Vercel | 必须全量加载（URL 重写依赖完整文本） | `res` 可 pipe，但典型 JSON/HTML 响应 <100KB，不构成实际问题 |
| Netlify | 同上 | 函数签名 `{ body: string }` 强制全量，流式从根本上不可行 |

## 结论

文本全量缓冲**在 serverless 架构下是固有约束**，不是可修复 bug：
- M3U8 URL 重写必须持有完整内容
- Netlify 返回格式不支持流式
- 非 M3U8 文本典型尺寸不构成瓶颈

二进制分支（已在 #4 中完成）覆盖了此 issue 的实际影响场景。文本流式作为未来增强项（如大 JSON API 代理），需重新设计代理架构（长连接 server 端）。
