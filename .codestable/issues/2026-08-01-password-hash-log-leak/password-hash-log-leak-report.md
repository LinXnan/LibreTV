---
doc_type: issue-report
issue: password-hash-log-leak
slug: password-hash-log-leak
status: confirmed
severity: P0
nature: security
source: audit-2026-08-01-core-subsystems-finding-01
issue_path: fast-track
tags: [security, log, password, proxy]
created: 2026-08-01
---

# 密码哈希泄露到服务端日志

## 问题

`server.mjs:138` 在代理鉴权失败时将完整的 64 字符 SHA-256 PASSWORD 哈希写入 `console.warn`。日志聚合器/文件系统持久记录后，任何有日志读取权限的人都可以用该哈希值作为 `auth` 查询参数调用 `/proxy` 接口，完全绕过前端密码门。

## 根因

`validateProxyAuth` 函数在比对失败时同时输出了期望值和实际值（`server.mjs:137-138`）。期望值是被保护的服务端凭证，不应出现在任何非受控存储中。

## 修复方案

删除 `server.mjs:138` 整行。保留 `server.mjs:137`（提示鉴权失败，不泄露哈希）。改为输出哈希值的末 4 位作为排查辅助：

```diff
- console.warn(`期望: ${serverPasswordHash}, 收到: ${authHash}`);
+ console.warn(`哈希末4位不匹配: 期望=${serverPasswordHash.slice(-4)}, 收到=${authHash.slice(-4)}`);
```

## 快速通道判定

- 根因：单行日志语句泄露凭证（明确）
- 修复范围：1 行替换（微小）
- 跨模块影响：无——只影响 server.mjs 本地部署的日志输出，不改变任何功能行为
