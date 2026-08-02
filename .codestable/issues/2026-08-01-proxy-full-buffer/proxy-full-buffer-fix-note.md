---
doc_type: fix-note
issue: proxy-full-buffer
slug: proxy-full-buffer
status: cancelled
severity: P1
nature: performance
fix_date: 2026-08-01
related_issue: proxy-binary-corruption
---

# Vercel/Netlify 代理全量缓冲修复

## 根因

`fetchContentWithType` 对二进制和文本响应统一使用 `response.text()` 全量读入内存。大型二进制文件（视频分片、图片）不仅内存暴涨，在 serverless 函数中被当作文本处理还会损坏内容。审计 finding-10 与 finding-04 共享此根因。

## 改动

**已在 `proxy-binary-corruption`（#4）修复中完成，无需额外改动：**

| 文件 | 改动 |
|---|---|
| `api/proxy/[...path].mjs` | `isBinaryContent()` + `arrayBuffer()` 分支 + 二进制响应直返 |
| `netlify/functions/proxy.mjs` | 同上 |

## 验证

- 图片/视频/音频通过 `isBinaryContent()` 走 `arrayBuffer()` 路径，不再经 `response.text()`
- 二进制响应正确返回 Buffer/base64，不会被当作文本编码损坏
- M3U8 文本继续走 `response.text()` → URL 重写流程，功能不受影响

## 遗留风险

文本流式传输不可行（见 report 评估）。非 M3U8 大文本响应仍会全量缓冲，但当前使用场景中不存在此问题：

- Netlify 函数签名 `{ body: string }` 从根本上不支持流式返回
- Vercel 端 M3U8 必须全量加载才能做 URL 重写
- 非 M3U8 文本（JSON/HTML）典型响应 <100KB

若未来出现 >10MB JSON 代理场景，应迁移至长连接 server 端（Express 已有 stream pipe），而非在 serverless 函数内实现流式。
