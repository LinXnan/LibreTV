---
doc_type: fix-note
issue: search-cache
slug: search-cache
status: fixed
severity: P2
nature: performance
fix_date: 2026-08-01
---

# 搜索结果缓存

## 根因

`search()` 对相同 query + 相同源列表无缓存，每次重新拉取所有 API 源。

## 改动

**`js/app.js`**（3 处）：

1. 全局 `searchCache = new Map()`（行 36）
2. `search()` 入口加缓存检查（行 828-836）：命中 5 分钟 TTL 内缓存直接走 `renderCachedResults`
3. 搜索完成后 `searchCache.set(cacheKey, { results, timestamp })`（行 965）

新增 `renderCachedResults()` 函数，复制搜索渲染管线（过滤→统计→筛选按钮→分页），但不触发 API 请求和骨架屏。

## 验证

- 首次搜索触发 API 请求，结果写入缓存
- 5 分钟内相同 query + 相同 API 源：即时返回，无网络请求
- 切换 API 源集合自动生成不同 cache key，不会返回过期结果
- 黄色内容过滤在缓存命中时仍正确生效（`renderCachedResults` 重放过滤逻辑）
- 缓存 TTL 过期后自动重新拉取

## 遗留风险

- 同一关键词在 5 分钟内新增的内容不会出现在搜索结果中（TTL 窗口内的新鲜度偏差）。可接受：视频源更新频率低。
- 缓存无大小上限。当前典型使用场景（<50 次不同搜索/5 分钟）下可忽略。若未来需要，加 LRU 淘汰。
