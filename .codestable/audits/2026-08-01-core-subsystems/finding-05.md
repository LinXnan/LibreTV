---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "bug-05"
nature: bug
severity: P1
confidence: medium
suggested_action: cs-issue
status: open
---

# Finding 05：搜索按钮无防抖保护

## 速答

`app.js:637` 的搜索绑定只监听 `Enter` 键，没有任何防抖或节流限制。代码库中已有 `utils.js:7` 的 `debounce()` 函数和 `optimize-apply.js:10-23` 的骨架——但后者仅做 `console.log` 而不调用 `search()`。快速连续按下 Enter（或搜索按钮）会导致多组并发请求竞争，增加代理端负载并可能产生竞态相关的 UI 抖动。

## 关键证据

- `app.js:637-641` — `document.getElementById('searchInput').addEventListener('keypress', function (e) { if (e.key === 'Enter') { search(); } });` ——无 debounce
- `app.js:885` — 搜索按钮（通过 `onclick="search()"` 绑定）同样无限制
- `utils.js:7-16` — `debounce()` 已实现但未接入搜索
- `optimize-apply.js:10-23` — 调用 `debounce((e) => { ... console.log('Search input:', query); }, 300)` ——只记录输入不执行搜索

## 影响

- **范围**：首页搜索，所有平台
- **影响**：快速重复点击搜索或长按 Enter 会触发多个并发搜索请求 → UI 闪烁（旧结果被新结果覆盖反复）、代理负载浪费
- **置信度 medium**：普通用户很少快速重复触发多次搜索（需要 <300ms 连续输入），但脚本/自动化更容易命中

## 修复方向

- 给 `search()` 访问路径加防抖锁（如"正在搜索中"标志位 + 禁用搜索输入直到结果返回）
- 或复用 `utils.js debounce` 包装 `search()` 并限制调用频率
- 建议动作：`cs-issue`
