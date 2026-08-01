---
doc_type: issue-report
issue: search-cache
slug: search-cache
status: confirmed
severity: P2
nature: performance
source: audit-2026-08-01-core-subsystems-finding-11
issue_path: fast-track
tags: [search, cache, performance]
created: 2026-08-01
---

# 搜索结果不缓存

## 问题

`search()` 每次调用都从头拉取所有 selectedAPIs 数据源，相同查询间无缓存。重复查询导致代理/服务端额外负载和用户感知延迟。

## 修复

- 内存 Map 缓存，key = `query:源列表排序.join`
- TTL 5 分钟
- 命中直接跳过 API 请求，用 `renderCachedResults` 渲染
- 缓存重放黄色内容过滤（跟随当前开关状态）
