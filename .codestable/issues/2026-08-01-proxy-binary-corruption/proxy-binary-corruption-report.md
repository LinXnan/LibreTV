---
doc_type: issue-report
issue: proxy-binary-corruption
slug: proxy-binary-corruption
status: confirmed
severity: P1
nature: bug
source: audit-2026-08-01-core-subsystems-finding-04
issue_path: fast-track
tags: [proxy, binary, vercel, netlify]
created: 2026-08-01
---

# Vercel/Netlify 代理对二进制内容使用 response.text() 导致损坏

## 问题

Vercel（`api/proxy/[...path].mjs:168`）和 Netlify（`netlify/functions/proxy.mjs:143`）的 `fetchContentWithType` 始终用 `response.text()` 读取上游响应。二进制内容（jpg/png/webp/音频等）被文本解码后损坏。CF 端已在 commit `65c0877` 修复（增 `isBinaryContent()` + `arrayBuffer()` 分支），但修复仅命中 CF，Vercel 和 Netlify 未同步。

## 根因

`fetchContentWithType` 对 Content-Type 仅有 M3U8 分支，对非 M3U8 无条件走 `text()`。缺少二进制检测（扩展名 / MIME 类型 / `application/octet-stream`）。

## 修复方案

将 CF 的 `isBinaryContent()`、`MEDIA_FILE_EXTENSIONS`、`MEDIA_CONTENT_TYPES` 常量移植到 Vercel 和 Netlify：
- `fetchContentWithType` 中插入 `isBinary → arrayBuffer()` 分支
- 非 M3U8 且 isBinary 时，用 `Buffer.from(arrayBuffer)`（Vercel）或 base64 编码（Netlify）返回

## 快速通道判定

- 根因：CF 已有修复模板（明确）
- 修复范围：两个文件各新增常量 + isBinaryContent 函数 + 修改 fetchContentWithType 分支（中等但不复杂）
- 跨模块影响：无——只修改代理层内容读取方式
