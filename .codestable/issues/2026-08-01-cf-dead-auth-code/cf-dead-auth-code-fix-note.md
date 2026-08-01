---
doc_type: issue-fix-note
issue: cf-dead-auth-code
slug: cf-dead-auth-code
status: done
date: 2026-08-01
---

# Fix Note：CF proxy 死代码

## 根因

`functions/proxy/[[path]].js:32` 已做 `await validateAuth()` 并正确 401。Lines 119-129 的二次 `validateAuth()` 调用缺少 `await`（Promise 恒 truthy，if 块永不进入），是重构残留。

## 改动

删除 `functions/proxy/[[path]].js:119-129`（11 行）。

## 验证

- [x] 入口鉴权仅保留 `await validateAuth()` 一处（line 32）
- [x] 无其他未 await 的 async 函数调用痕迹
