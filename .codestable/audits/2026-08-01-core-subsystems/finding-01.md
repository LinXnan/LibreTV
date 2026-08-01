---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "security-01"
nature: security
severity: P0
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 01：server.mjs 日志暴露完整 PASSWORD 哈希

## 速答

`server.mjs:138` 在鉴权失败时将完整的 SHA-256 密码哈希写入 `console.warn`。任何能读取服务端日志的人/系统可直接拿到哈希值，绕过前端密码验证直接调用代理接口。

## 关键证据

- `server.mjs:137-138` — `console.warn('代理请求鉴权失败：密码哈希不匹配'); console.warn(`期望: ${serverPasswordHash}, 收到: ${authHash}`);` — 完整 64 字符 hex 写入日志
- 代理鉴权契约只比较 `auth` 查询参数与 `sha256(PASSWORD)` 的一次性等同匹配 — 持有哈希即可构造带合法 `auth` 的代理请求（`server.mjs:122-152`）

## 影响

- **范围**：所有以 `node server.mjs` 启动的本地部署
- **影响**：日志聚合系统（如 CloudWatch、Loki、文件日志）会持久记录明文级别凭证。攻击者从日志获得哈希后可绕过前端密码门、直接调用 `/proxy` 出站
- **触发条件**：任意一次代理鉴权失败（错误密码 / 过期时间戳）即会记录。正常使用（正确密码）反而不会触发

## 修复方向

- 删除 `server.mjs:138` 输出哈希值整行
- 或改为 `<期望值后4位: ${serverPasswordHash.slice(-4)}>` 便于运维排查而不泄露全值
- 同样检查 `server.mjs:137` 和其他平台的 `validateAuth` 中是否有类似的完整哈希日志（Vercel/Netlify/CF 目前仅输出"不匹配"无值 —— 安全）
- 建议动作：`cs-issue`
