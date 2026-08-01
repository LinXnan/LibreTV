---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "bug-03"
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
status: open
---

# Finding 03：CF proxy 死代码——validateAuth 被调用两次，第二次缺少 await

## 速答

`functions/proxy/[[path]].js:32` 正确执行 `await validateAuth(request, env)` 并处理 401 返回。但随后 `functions/proxy/[[path]].js:119-120` 再次调用 `if (!validateAuth(request, env))` 且**没有 await**——async 函数返回的是 Promise 对象，`!Promise` 恒为 `false`，该 if 块永不会进入。这是一段无用的死代码，同时还重复创建了对同一请求的冗余 Promise。

## 关键证据

- `functions/proxy/[[path]].js:32` — `const isValidAuth = await validateAuth(request, env);` ——正确鉴权
- `functions/proxy/[[path]].js:76` — `async function validateAuth(request, env)` ——实际定义
- `functions/proxy/[[path]].js:119-129` — `if (!validateAuth(request, env)) { return new Response('Unauthorized', ...) }` ——无 await，Promise 始终 truthy，从不入 if 体

## 影响

- **范围**：Cloudflare Pages 部署的实例
- **影响**：死代码本身不造成运行时错误，但浪费一次 SHA-256 计算(Promise 实际上被创建并异步执行到底)、给维护者造成"有双重安全检查"的错觉
- **严重度 P1**：虽非功能 bug，但对鉴权代码的冗余调用让审计/修改时容易真绕过

## 修复方向

- 删除 `functions/proxy/[[path]].js:119-129` 整段死代码
- 建议动作：`cs-issue`
