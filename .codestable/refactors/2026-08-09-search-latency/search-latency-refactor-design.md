---
doc_type: refactor-design
refactor: 2026-08-09-search-latency
status: approved
scope: 前端搜索链路（js/app.js search 主流程 + searchWithConcurrencyLimit、js/search.js、js/config.js、js/site_health.js、js/optimize-apply.js、js/api.js）+ 4 平台代理超时/重试（server.mjs、api/proxy/[...path].mjs、netlify/functions/proxy.mjs、functions/proxy/[[path]].js）
summary: 7 条全部实施：全量并发(#1)、降 maxPages(#2)、超时对齐(#3)、增量渲染(#4)、死代码清理(#5)、searchCache LRU(#6)、测活缓存跳过失效源(#7)
---

# search-latency refactor design

## 1. 本次范围

- scan 全部 7 条勾选 ✓（含 #2 #7 两条行为变化条目，用户已明确接受结果集变化）
- 不做：无（全部勾选）
- 总工作量：约 350 行改动 / 10 个文件；总风险档位：中（#4 渲染管线 + #3 跨 4 平台为风险集中点）

## 2. 前置依赖

- **测试覆盖**：项目无自动化测试基建（无 test 脚本，attention.md 明确"手动验证"）。行为等价验证以 HUMAN 目视 + 浏览器 Network 面板为主；#5 死代码删除以 grep 自证
- **#5 删除边界已确认**（grep 实证）：
  - `optimize-apply.js:26-91` `applySearchConcurrency` 依赖的 `window.concurrentPool` 全项目 0 引用，调用点已被注释
  - `api.js:403-513` `handleAggregatedSearch`、`api.js:516-618` `handleMultipleCustomSearch`、`api.js:655-676` `testSiteAvailability` 均无调用方
  - `api.js:1-31` `apiCache`/`getCacheKey`/`getFromCache`/`saveToCache` 只被 `/api/search` 分支使用，`/api/detail` 分支（活跃，被 player.js/ui.js/app.js 调用）不使用缓存
  - `config.js:38-44` `AGGREGATED_SEARCH_CONFIG` 定义后未使用
  - ⚠️ `searchByAPIAndKeyWord` 被 `player.js:2083` 使用（保留）；`handleApiRequest` 的 `/api/detail` 分支与 fetch 拦截器保留
- **#3 跨平台确认**：仅 Express `server.mjs` 有 timeout=5s + maxRetries=2；Vercel/Netlify/CF 代理用 node-fetch/原生 fetch **无显式超时**（依赖平台级兜底 Vercel 10s / Netlify 10s / CF 30s），需补兜底超时
- **#7 数据源**：`site_health.js` 已有 `readHealthCache()`（localStorage key `siteHealthCache`，1h TTL，结构 `{timestamp, ok:[]}`），search() 直接读 localStorage 复用

## 3. 执行顺序

执行顺序依据：低风险独立项先行 → 行为等价核心收益 → 行为变化项 → 渲染管线改造最后（依赖 #1 的全量并发结构）。

### 步骤 1：清理搜索链路死代码（#5）

- **引用方法**：M-L2-02（Inline Function——删除无引用函数体）
- **具体操作**：
  1. `js/optimize-apply.js`：删 `applySearchConcurrency` 函数（26-91 行）与两处 `// applySearchConcurrency();` 注释调用（147、156 行）；保留防抖/懒加载/storage helpers
  2. `js/api.js`：删 `/api/search` 分支（40-117 行）内层；删 `apiCache` 缓存机制（1-31 行，含 `CACHE_DURATION`/`getCacheKey`/`getFromCache`/`saveToCache`）；删 `handleAggregatedSearch`（403-513）、`handleMultipleCustomSearch`（516-618）、`testSiteAvailability`（655-676）；保留 `handleApiRequest` 的 `/api/detail` 分支、`handleCustomApiSpecialDetail`、`handleSpecialSourceDetail`、fetch 拦截器（621-653）
  3. `js/config.js`：删 `AGGREGATED_SEARCH_CONFIG`（38-44 行）
- **退出信号**：grep `applySearchConcurrency|concurrentPool|handleAggregatedSearch|handleMultipleCustomSearch|testSiteAvailability|AGGREGATED_SEARCH_CONFIG|getFromCache|saveToCache` 全项目 0 引用；`handleApiRequest|handleCustomApiSpecialDetail|handleSpecialSourceDetail` 仍存在
- **验证责任**：AI 自证（grep）
- **回滚**：git revert 本步 commit 或手动恢复删块

### 步骤 2：searchCache 加 LRU 上限（#6）

- **引用方法**：M-L4-05（Index & Cache）
- **具体操作**：
  1. `js/app.js:36` 定义处：将 `searchCache` 改为带上限的 LRU Map——在 `searchCache.set(cacheKey, ...)`（966 行）前加淘汰逻辑：`if (searchCache.size >= 50) searchCache.delete(searchCache.keys().next().value)`（Map 迭代序即插入序，删除最旧）；缓存命中逻辑（836-841）不变
- **退出信号**：连续搜索 > 50 个不同关键词后 `searchCache.size` 不超过 50；缓存命中行为与改前一致
- **验证责任**：AI 自证（逻辑检查 + console 观察）
- **回滚**：git revert 本步 commit

### 步骤 3：搜索批次串行改为全量并发（#1）

- **引用方法**：M-L4-06（Async & Cancellation——调整异步并发调度）
- **具体操作**：`js/app.js:89-100` `searchWithConcurrencyLimit` 函数体改为：
  ```js
  async function searchWithConcurrencyLimit(apiIds, query, limit = 3) {
      // 全量并发：一次发起所有源请求。浏览器对同源代理（/proxy/）的连接池会自然限制实际并发（约 6）
      return Promise.allSettled(apiIds.map(apiId => searchByAPIAndKeyWord(apiId, query)));
  }
  ```
  保留函数签名（避免改调用方 app.js:863），删除批次循环与逐批 await。**行为等价**：返回 settled 数组顺序 = apiIds 顺序，结果集合与排序不变，仅等待时间从"各批最慢之和"降为"全局最慢"
- **退出信号**：HUMAN 打开首页搜索，Network 面板确认多个源请求同时发出（不再分批），结果集与改前一致
- **验证责任**：HUMAN（Network 面板看并发）｜ AI 自证（逻辑检查）
- **回滚**：git revert 本步 commit

### 步骤 4：降 maxPages 5→3（#2，行为变化已批）

- **引用方法**：M-L4-02（Batching——控制单源批量拉页规模）
- **具体操作**：`js/config.js:52` `maxPages: 5` → `maxPages: 3`。`search.js:66` 自动生效（每源第一页 + 最多 2 额外页，最多 3 请求）
- **退出信号**：HUMAN 搜索确认结果数量少于改前、耗时下降；结果仍覆盖前 3 页
- **验证责任**：HUMAN（结果数量/耗时对比）｜ AI 自证（config 值检查）
- **回滚**：git revert 本步 commit

### 步骤 5：前端超时与代理超时/重试对齐（#3）

- **引用方法**：M-L4-06（Async & Cancellation——超时与取消对齐）
- **具体操作**：
  1. `js/search.js:27,82`：两处 `8000` 超时 → `4000`（与 site_health 测活超时一致）
  2. `server.mjs:19-20`：`timeout: 5000` → `4000`；`maxRetries: 2` → `1`（搜索场景代理重试意义低，前端已 4s abort）
  3. 三个 serverless 代理补兜底超时（避免挂死，搜索场景前端 4s 已截断，兜底主要防资源泄漏）：
     - `api/proxy/[...path].mjs`：`fetchContentWithType` 的 `fetch` 加 `signal: AbortSignal.timeout(10000)`
     - `netlify/functions/proxy.mjs`：同上加 `AbortSignal.timeout(10000)`
     - `functions/proxy/[[path]].js`：同上加 `AbortSignal.timeout(10000)`
- **退出信号**：HUMAN 用 Network 面板测一个失效源，确认前端约 4s 放弃；可用源仍正常返回结果
- **验证责任**：HUMAN（失效源/可用源对比）｜ AI 自证（4 平台改动一致性检查）
- **回滚**：git revert 本步 commit（注意 4 文件需一起回滚）
- **风险**：缩短超时可能放弃"慢但可用"的源（scan 已声明轻微行为变化，用户接受）

### 步骤 6：搜索前用测活缓存跳过失效源（#7，行为变化已批）

- **引用方法**：M-L4-05（Index & Cache——复用既有测活缓存）
- **具体操作**：`js/app.js` search() 内、`selectedAPIs.length===0` 检查后（831 行后）插入：
  1. 读 `localStorage.getItem('siteHealthCache')`，解析 `{timestamp, ok}`
  2. 若缓存新鲜（`Date.now() - timestamp < 3600_000`）：构造 `effectiveAPIs = selectedAPIs.filter(k => k.startsWith('custom_') || ok.includes(k))`
  3. 若 `effectiveAPIs` 为空则回退用原 `selectedAPIs`（避免空结果）；否则后续 `searchWithConcurrencyLimit` 与 cacheKey 都用 `effectiveAPIs`
  4. cacheKey（835 行）同步改为基于 `effectiveAPIs`
- **退出信号**：HUMAN 搜索确认已知失效源不再出现在请求中（Network 面板），结果集为可用源结果
- **验证责任**：HUMAN（Network 面板请求源对比）｜ AI 自证（缓存解析逻辑检查）
- **回滚**：git revert 本步 commit
- **风险**：缓存 1h 内源恢复会被跳过（scan 已声明，用户接受）

### 步骤 7：搜索结果增量渲染（#4）

- **引用方法**：M-L4-02（Batching——按到达批次增量交付）
- **具体操作**：`js/app.js` search() 内重构（863-970 行）：
  1. 将 `const resultsArray = await searchWithConcurrencyLimit(...)` 拆为逐源回调版：`Promise.allSettled(effectiveAPIs.map(async apiId => { const r = await searchByAPIAndKeyWord(apiId, query); if (r.results?.length) { allResults.push(...r.results); scheduleIncrementalRender(); } return r; }))`——**源列表用步骤 6 的 `effectiveAPIs`**（与 cacheKey 一致）
  2. 新增轻量增量渲染函数 `scheduleIncrementalRender()`（rAF 或 100ms 节流）：隐藏骨架屏 → 显示结果区域 → 渲染当前 `allResults` 卡片（复用 `renderSearchResults`）+ 更新 `searchResultsCount`；**不做**统计/筛选/分页重建
  3. 增量渲染同样应用黄色过滤：`yellowFilterEnabled` 时先 `filterBanned(currentAllResults)` 再渲染，避免"先显示后消失"的闪烁（与最终渲染过滤一致）
  4. 全部 settle 后保留现有最终收尾（排序 873-886、统计/筛选/分页 954-963、缓存 966）——最终渲染覆盖增量渲染，保证顺序/筛选/分页正确
  5. 在增量渲染与最终渲染之间加 `renderInProgress` 防抖锁，避免最终渲染被增量渲染打断
- **退出信号**：HUMAN 搜索时先看到部分结果出现（首条 < 2s），再看到全部结果补齐，统计/筛选/分页最终正确
- **验证责任**：HUMAN（目视增量渲染 + 最终完整性）
- **回滚**：git revert 本步 commit（本步改动面最大，建议单独验证充分后再进下一步）
- **风险**：渲染管线改动；需确认筛选/分页在增量场景不闪乱、最终状态正确

## 4. 风险与看点

- **高风险**：#4（增量渲染，search() 主流程重构，渲染多次触发）；#3（跨 4 平台同步，5 个文件）
- **中风险**：#7（结果集变化 + cacheKey 语义变化，需确认缓存与增量渲染不冲突）
- **容易出错**：
  - #5 删 `apiCache` 时勿伤 `/api/detail` 分支（detail 用 `customApi`/`customDetail` 变量，保留 35-37 行声明）
  - #7 的 cacheKey 若仍用原 `selectedAPIs`，会命中"包含失效源的旧缓存"→ 必须同步改
  - #4 的最终渲染必须覆盖增量渲染，否则排序/筛选错乱；增量渲染勿触发 `renderPagination`（页码状态未就绪）
- **验证总览**：#5 #6 #1 AI 自证为主；#2 #3 #7 #4 需 HUMAN 目视/Network 面板
