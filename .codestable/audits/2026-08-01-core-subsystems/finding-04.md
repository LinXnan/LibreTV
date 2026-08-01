---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "bug-04"
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 04：Vercel/Netlify 代理对二进制内容使用 response.text() 导致损坏

## 速答

Vercel（`api/proxy/[...path].mjs:168`）和 Netlify（`netlify/functions/proxy.mjs:143`）的 `fetchContentWithType` 永远用 `response.text()` 读取上游响应。二进制内容（图片/jpg/png/webp、音频等）在被文本解码后损坏并可能造成后续请求失败。CF 端已在 commit `65c0877` 修复（增加 `isBinaryContent()` → `arrayBuffer()` 分支），但修复仅限 CF 文件，Vercel/Netlify 未同步。

## 关键证据

- `api/proxy/[...path].mjs:168` — `const content = await response.text();` ——所有非 M3U8 内容都用 text 解码
- `netlify/functions/proxy.mjs:143` — 完全相同
- `functions/proxy/[[path]].js:249-304` — CF 已有的 `isBinaryContent()` + `arrayBuffer()` 分支（幂等修复）
- git 历史：`65c0877 fix(proxy): 修复图片等二进制内容无法显示的问题` —— 修复仅命中 CF

## 影响

- **范围**：部署在 Vercel / Netlify 的实例
- **影响**：通过代理拉取的图片、音频等二进制文件无法正常显示/播放；可能造成页面白屏或封面图片缺失
- **严重度 P1**：影响 UX 而非核心播放，但 Vercel/Netlify 部署用户已受实际影响

## 修复方向

- 将 CF 的 `isBinaryContent()` + MEDIA_FILE_EXTENSIONS + MEDIA_CONTENT_TYPES 常量移植到 Vercel/Netlify
- 在 `fetchContentWithType` 中插入 `isBinary ? arrayBuffer() : text()` 分支
- 或将三平台代理提取共用代码（关联 finding-08）
- 建议动作：`cs-issue`
