---
doc_type: feature-ff-note
feature: remove-search-speedtest
date: 2026-08-09
requirement:
tags: [search, speedtest, latency]
---

## 做了什么

移除搜索结果中的响应速度（测速）功能：卡片上的 `xx ms` 延迟徽标、"按响应速度筛选"筛选面板，以及按延迟排序。

## 改了哪些

- `js/search.js` — 移除 `performance.now()` 延迟测量、结果条目上的 `latency` 字段与返回值
- `js/app.js` — 移除按延迟排序（保留视频名称 + 来源排序）、`filterByLatency` 函数、筛选逻辑中的延迟分支、`currentFilters`/`resetSearchFilters` 中 `latency` 维度、卡片延迟徽标渲染
- `index.html` — 移除"按响应速度筛选"筛选器 UI 块
- `css/mobile-optimize.css` — 移除 `#latencyFilters` 选择器

## 怎么验证的

`node --check` 校验 `search.js` / `app.js` / `player.js` 语法通过；grep `latency` / `filterByLatency` 残留清零（仅剩 `player.js` 的 HLS `lowLatencyMode` 配置，与搜索无关）；`index.html` 筛选面板结构完整。运行 `npm run dev` 后浏览器搜索即可目视确认：卡片无延迟徽标、筛选面板无"按响应速度筛选"。

独立代码审查后按 findings 补修复：排序比较器在名称/来源相同后追加 `vod_id` 确定性 tiebreak（`js/app.js`），避免 cache/no-cache 两路径下同名同源条目的相对顺序依赖到达时序。

## 顺手发现（可选，不阻塞）

- `.codestable/compound/2026-08-09-search-incremental-append-render.md` 第 4 点仍写"最终渲染按延迟排序"，行为已变更，沉淀文档未同步
