---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "performance-11"
nature: performance
severity: P2
confidence: medium
suggested_action: cs-refactor
status: resolved
---

# Finding 11：搜索结果不缓存，每次重新拉所有源

## 速答

`search()` 每次被调用时都从头并发拉取所有 selectedAPIs 的搜索结果，相同查询间没有缓存机制。`api.js:2` 里的 `apiCache` 仅为 `/api/search` 端点的单次响应生效，不覆盖 `search()` 的多源聚合层。对于「切错筛选条件后重置」或「翻页」的常见操作，相同查询被重复发送到所有源，增加代理负载和用户感知延迟。

## 关键证据

- `js/app.js:757-922` — `search()` 每次都执行 `searchWithConcurrencyLimit(selectedAPIs, query, 3)`，无前置缓存 check
- `js/api.js:2-31` — `apiCache` 是 Map，缓存 key 为完整请求 URL（含 source），只在 `handleApiRequest` 中使用
- `js/app.js:1622` — `filterByCategory` 直接操纵 `filteredResults` 重新分页，不重拉数据（合理），但 `resetSearchFilters` 也不重拉 —— 所以缓存只在初始搜索级别有用

## 影响

- **范围**：首页搜索、切换筛选条件
- **影响**：相同查询重复拉取所有源 → 代理/服务端额外负载 x 源数量 → 用户感知延迟翻倍（尤其 4 个源并行）
- **置信度 medium**：取决于用户是否频繁用相同关键词搜索（大概率不多，但误触或反复切源时触发）
- **严重度 P2**：现有并发控制（批大小 3）已缓解最坏情况，缓存是可叠加优化

## 修复方向

- 在 `search()` 开头检查内存缓存（相同 query + 相同 源列表）→ 命中直接调用 `renderSearchResults(cached)`
- 缓存 TTL 建议 2-5 分钟（免重复拉），可受 apiCache 的同策略
- 建议动作：`cs-refactor`
