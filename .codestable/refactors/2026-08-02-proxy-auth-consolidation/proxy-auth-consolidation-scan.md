---
doc_type: refactor-scan
refactor: 2026-08-02-proxy-auth-consolidation
status: pending-user-selection
scope: 抽取 4 套代理的 isValidUrl（SSRF）和 validateAuth（密码鉴权）为共享模块
summary: 基于 lightweight-resources 审计 finding-02，消解 4 套代理中逐行相同的 SSRF 检查与鉴权验证逻辑
---

# proxy-auth-consolidation scan

## 总览

- 扫描范围：`server.mjs` / `api/proxy/[...path].mjs` / `netlify/functions/proxy.mjs` / `functions/proxy/[[path]].js` 中的 `isValidUrl`（SSRF 黑名单检查）和 `validateAuth`（PASSWORD 鉴权）
- 发现 2 条优化点：结构 2
- 按风险：低 2 / 中 0 / 高 0
- 建议先做：#1（isValidUrl，改动最小）→ #2（validateAuth，SHA-256 依赖已通过 password-inject-consolidation 收口）
- 前置检查 7 条：
  1. 行为改动？✓ 无（两个函数逻辑逐行相同，仅统一变量名与日志前缀）
  2. 测试覆盖？✓ 豁免（相同输入 → 相同输出；可 grep 确认 logic 未变，且项目无自动化测试）
  3. 跨模块？✓ 本次目标即消解跨模块安全逻辑重复——不改会影响正确的维护问题；用户已确认
  4. 风格口味？✓ 无
  5. 生成/第三方？✓ 无
  6. 范围太大？✓ 4 文件各 ~30 行改动 < 15 文件
  7. 零候选？✓ 有候选

## 本轮不做（明确排除）

- **请求构造/响应转发/M3U8 处理收口**：四平台 fetch/axios API 差异大，且 M3U8 处理仅 3 套有、Express 不需要。强行统一需引入 adapter 层，风险/收益不成比例——留后续评估
- **server.mjs crypto vs Web Crypto 统一**：Express 用 Node crypto（同步风格），其他用 fetch/Web Crypto（异步），底层不同，不改

## 条目

### [1] 抽取共享 isValidUrl（SSRF 黑名单检查）

- **位置**：`server.mjs:97-119`、`api/proxy/[...path].mjs:63-78`、`netlify/functions/proxy.mjs:55-70`、`functions/proxy/[[path]].js:130-145`
- **分类**：结构
- **现状**：四套代理各自实现完全相同的 SSRF 检查逻辑——协议白名单（http/https）、域名黑名单（localhost/127.0.0.1/0.0.0.0/::1）、IP 前缀黑名单（192.168./10./172.）、try/catch 错误兜底。差异仅在日志前缀
- **问题**：SSRF 防护是安全关键路径，四份独立实现意味着黑名单更新需同步 4 处（attention.md 已明文警告"代理改动必须同步 4 个平台实现"），且平台间已有不对称——之前 core-subsystems finding-02 指出 CF 的 `isValidUrl` 私有 IP 范围缺失 127.0.0.1 特殊处理
- **建议**：创建 `js/proxy-ssrf.js`，导出 `isValidUrl(url, blockedHostnames?, blockedPrefixes?)`；四套代理改为 import 此模块替代本地实现
- **建议映射的方法**：M-L2-01（Extract Function 提取共享逻辑）
- **风险**：低（纯函数，无副作用，相同输入 → 相同输出）
- **验证**：AI 自证（grep `isValidUrl` 四文件均正确 import；对比共享模块与原逻辑等价）
- **范围**：新增 1 文件（~30 行），修改 4 文件各 ~10 行

### [2] 抽取共享 validateAuth（PASSWORD 鉴权）

- **位置**：`server.mjs:122-153`、`api/proxy/[...path].mjs:363-393`、`netlify/functions/proxy.mjs:140-171`、`functions/proxy/[[path]].js:76-117`
- **分类**：结构
- **现状**：四套代理各自实现完全相同的鉴权逻辑——提取 auth/t 参数、检查 PASSWORD 是否设置、60 分钟时间戳有效期、失败返回相同 401 JSON。差异仅在 sha256 实现方式（server.mjs 用 Node crypto，三套中间件用 Web Crypto）和日志前缀
- **问题**：鉴权是入口安全控制，四份独立实现且 sha256 调用方式不同。之前 password-inject-consolidation 已收口了中间件层的密码注入，但代理鉴权层的 sha256 仍然分散
- **建议**：创建 `js/proxy-auth.js`（注意：已有同名文件是浏览器端鉴权加签，改为 `js/proxy-auth-shared.js`），导出 `async validateAuth(params, password)`；server.mjs 保留 Node crypto 的 sha256 但引用共享 validateAuth 外壳；三套中间件引用共享模块替换内联逻辑
- **建议映射的方法**：M-L2-01（Extract Function）+ M-L3-07（职责分离——鉴权规则 vs SHA-256 实现）
- **风险**：低（相同输入 → 相同输出；鉴权失败返回相同 JSON）
- **验证**：AI 自证（grep `validateAuth` 四文件均正确 import；比对鉴权逻辑等价）
- **范围**：新增 1 文件（~50 行），修改 4 文件各 ~20 行
