---
doc_type: fix-note
issue: search-debounce
slug: search-debounce
status: fixed
severity: P1
nature: bug
fix_date: 2026-08-01
---

# 搜索按钮防抖修复

## 根因

`search()` 函数入口无并发守卫，用户快速重复按 Enter/点击搜索按钮时，多次调用同时拉取所有 API 源，导致 UI 闪烁和代理负载浪费。

## 改动

**`js/app.js`**（3 处）：

1. 声明守卫变量 `let searchInProgress = false;`（行 35）
2. `search()` 入口加互斥锁（行 777-779）：
   ```js
   if (searchInProgress) return;
   searchInProgress = true;
   ```
3. 所有退出路径统一在 `finally` 块重置 `searchInProgress = false`（行 932），覆盖正常完成、catch 异常、early return（空输入/未选 API 源）三个通道

## 验证

- 快速双击搜索：第二次调用被 `searchInProgress` 拦截，不会发起重复请求
- 搜索完成后可正常发起新搜索（`finally` 重置锁）
- 空输入 / 未选 API 源时能正常弹出提示，锁正确释放
- 搜索出错时 `catch` 不吞锁，`finally` 保证释放

## 遗留风险

无。此为本地并发守卫，不涉及异步竞态。若未来引入 AbortController 取消飞行中的请求，可作为增强项，非必须。
