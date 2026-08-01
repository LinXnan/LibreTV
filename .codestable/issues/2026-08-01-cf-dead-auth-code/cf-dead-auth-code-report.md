---
doc_type: issue-report
issue: cf-dead-auth-code
slug: cf-dead-auth-code
status: confirmed
severity: P1
nature: bug
source: audit-2026-08-01-core-subsystems-finding-03
issue_path: fast-track
tags: [proxy, cloudflare, dead-code, auth]
created: 2026-08-01
---

# CF proxy 死代码：validateAuth 无 await 的二次调用永不到达

## 问题

`functions/proxy/[[path]].js:32` 已正确 `await validateAuth()` 并处理 401。但 87 行后（lines 119-129）再次调用 `if (!validateAuth(request, env))` 无 await，async 返回的 Promise 恒 truthy，整个 if 块永不执行。

## 根因

复制/重构残留——二次鉴权调用缺少 `await` 且已被第一次 await 覆盖。

## 快速通道判定

- 删除 11 行死代码（微小）
- 无跨模块影响
