---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "maintainability-08"
nature: maintainability
severity: P2
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 08：Vercel proxy ≈ Netlify proxy 约 400 行重复代码

## 速答

`api/proxy/[...path].mjs`（497 行，Vercel serverless function）和 `netlify/functions/proxy.mjs`（327 行，Netlify function）的代理逻辑本质相同：目标 URL 提取 + 鉴权 + fetch + M3U8 主/媒体列表处理 + 错误处理器。仅在接口适配层不同（Vercel 用 `req`/`res`、Netlify 用 `event`/return 对象）。约有 400 行函数从 Vercel 复制到 Netlify，任一逻辑修正需要在两处同步编辑。

## 关键证据

- 共享函数（命名、逻辑、变量名完全一致）：
  - `getTargetUrlFromPath`：`api/proxy/[...path].mjs:55-78` ≈ `netlify/functions/proxy.mjs:43-54`
  - `getBaseUrl` / `resolveUrl` / `rewriteUrlToProxy`：完全相同
  - `fetchContentWithType`：逻辑相同，仅 headers 原为 `requestHeaders` vs `event.headers`
  - `isM3u8Content` / `processKeyLine` / `processMapLine` / `processMediaPlaylist` / `processM3u8Content` / `processMasterPlaylist`：逐行相同
- 仅差异：`validateAuth` 在网络端读取鉴权参数的方式不同

## 影响

- **范围**：所有对代理的修改（安全修补、性能优化、功能增强）
- **影响**：任何逻辑修正需要两次编辑（可能遗漏一边），属于经典的复制粘贴技术债
- **严重度 P2**：不影响功能，但先修 finding-04（二进制修复）时会撞上这个重复，同一次改两处就是实际阻力

## 修复方向

- 提取共用 `proxy-core.mjs`（目标解析 + fetch + M3U8 处理函数）
- Vercel/Netlify handle 函数各自适配请求/响应形态，调用共用核心
- 建议动作：`cs-refactor`
