---
doc_type: issue-fix-note
issue: proxy-binary-corruption
slug: proxy-binary-corruption
status: done
date: 2026-08-01
---

# Fix Note：Vercel/Netlify 代理二进制内容损坏

## 根因

`api/proxy/[...path].mjs` 和 `netlify/functions/proxy.mjs` 的 `fetchContentWithType()` 无条件执行 `response.text()`，二进制内容经文本解码后损坏。CF 端 (`functions/proxy/[[path]].js`) 在 commit `65c0877` 已引入 `isBinaryContent()` + `arrayBuffer()` 分支，但 Vercel/Netlify 未跟随修复。

## 改动

### Vercel (`api/proxy/[...path].mjs`)

1. **新增常量** (line 42-47)：`MEDIA_FILE_EXTENSIONS`（30 种扩展名）、`MEDIA_CONTENT_TYPES`（`video/` / `audio/` / `image/`）
2. **新增 `isBinaryContent()`** (line 147-158)：按 MIME 类型 / 扩展名 / `application/octet-stream` 判断
3. **`fetchContentWithType` 分支** (line 199-202)：`isBinary → arrayBuffer()`、否则 `text()`
4. **handler 分流** (line 452-462)：isBinary 时 `Buffer.from(arrayBuffer) → res.send(buf)`，跳过 M3U8 判断

### Netlify (`netlify/functions/proxy.mjs`)

1. **新增常量** (line 36-41)：同上
2. **新增 `isBinaryContent()`** (line 100-110)：同上
3. **`fetchContentWithType` 分支** (line 173-176)：同上
4. **handler 分流** (line 301-315)：isBinary 时 `Buffer.from(arrayBuffer) → toString('base64')`，设 `isBase64Encoded: true`

## 验证

- [x] Vercel proxy 新增引用：`isBinaryContent` × 1、`arrayBuffer` × 1、`isBinary` × 3
- [x] Netlify proxy 新增引用：`isBinaryContent` × 2、`arrayBuffer` × 1、`isBinary` × 4、`isBase64Encoded` × 1
- [x] 三个平台（CF + Vercel + Netlify）现在使用同源逻辑（`MEDIA_FILE_EXTENSIONS` / `MEDIA_CONTENT_TYPES` / `isBinaryContent` 一致）
- [x] Express 使用 stream pipe 天然不需要此修复

## 遗留风险

- 两个新文件各有独立的 `MEDIA_FILE_EXTENSIONS` 数组——后续新增文件类型需三处同步（关联 finding-08 代理代码重复）
- Netlify base64 增加 33% 体积开销，但对图片/缩略图场景影响可忽略
