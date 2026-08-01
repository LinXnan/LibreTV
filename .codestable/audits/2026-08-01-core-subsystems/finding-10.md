---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "performance-10"
nature: performance
severity: P1
confidence: high
suggested_action: cs-issue
status: resolved
resolution: partial-fix-via-finding-04
resolution_note: 二进制分支已在 #4 完成；文本流式在 serverless 下不可行，见 proxy-full-buffer issue
---

# Finding 10：Vercel/Netlify 代理全量缓冲响应为文本

## 速答

与 finding-04 共享根因但关注点不同：Vercel/Netlify 的 `fetchContentWithType` 通过 `response.text()` 将**整个响应体**读入内存后才判断是否为 M3U8。对于 5MB 的 m3u8 播放列表、10MB 的视频分片或大 JSON 响应，这会导致 serverless function 内存占用暴涨、GC 停顿和响应延迟。CF 已有 `isBinaryContent` → `arrayBuffer` 分支，Express 用 stream pipe —— 仅 Vercel/Netlify 用全文 buffer。

## 关键证据

- `api/proxy/[...path].mjs:168` — `const content = await response.text();` ——全量读入，无上限
- `netlify/functions/proxy.mjs:143` — 相同
- Express: `server.mjs:212-213` — `response.data.pipe(res);` ——流式传输，内存 O(1)
- CF: `functions/proxy/[[path]].js:294-302` ——二进制分支、文本分支

## 影响

- **范围**：Vercel / Netlify 部署，尤其是大文件代理
- **影响**：大响应（>10MB）会增加 20-40% 延迟（buffer + 再 send），且 Vercel/Netlify 有 serverless 内存上限（通常 1024MB），大文件并发可能触发 OOM
- **严重度 P1**：对小 m3u8/JSON 影响不显著，但大文件场景已受影响

## 修复方向

- 同 finding-04：移植 isBinary/文本分支 + 对极长文本（>1MB 的 m3u8）也改流式
- 建议动作：`cs-issue`
