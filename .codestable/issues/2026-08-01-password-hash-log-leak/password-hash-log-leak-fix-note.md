---
doc_type: issue-fix-note
issue: password-hash-log-leak
slug: password-hash-log-leak
status: done
date: 2026-08-01
---

# Fix Note：密码哈希泄露到服务端日志

## 根因

`server.mjs:138` 的 `validateProxyAuth` 函数在鉴权失败时将完整 PASSWORD SHA-256 哈希写入 `console.warn`，导致日志系统持久记录可重放的代理凭证。

## 改动

**`server.mjs:138`** — 1 行替换

```diff
- console.warn(`期望: ${serverPasswordHash}, 收到: ${authHash}`);
+ console.warn(`哈希末4位不匹配: 期望=${serverPasswordHash.slice(-4)}, 收到=${authHash.slice(-4)}`);
```

## 验证

- [x] 改动后日志仅输出末 4 位（`slice(-4)`），无法被用于构造代理鉴权请求
- [x] 其他三平台（Vercel `api/proxy/[...path].mjs:321`、Netlify `netlify/functions/proxy.mjs:109`、CF `functions/proxy/[[path]].js:98`）只输出"不匹配"无任何哈希字符，无需改动
- [x] 鉴权逻辑本身未被修改——比对仍用完整哈希

## 遗留风险

- 无。修复范围极小，不改变鉴权行为。
