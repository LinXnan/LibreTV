---
doc_type: refactor-design
refactor: 2026-08-13-search-multi-source
status: approved
scope: 搜索并发编排（js/app.js search 主流程 + 增量渲染 + 最终收尾）+ js/search.js + js/config.js，不含 4 平台代理
summary: 4 条全部实施：时间窗竞速(#1)、取消在途旧请求(#2)、同名去重合并(#3)、maxPages 3→2(#4)
---

# search-multi-source refactor design

## 1. 本次范围

- scan 全部 4 条勾选 ✓（含 #3 #4 两条行为变化条目，用户已明确批准）
- 不做：无（全部勾选）。恢复测活/改默认全选不在范围（datasource-simplify 决策，见 scan 背景约束）
- 总工作量：约 200 行改动 / 3 文件；总风险档位：中（#1 竞速收尾重构 + #3 去重与筛选语义交互为风险集中点）

## 2. 前置依赖

- **测试覆盖**：项目无自动化测试基建（attention.md 明确"手动验证"）。行为等价验证以 HUMAN 目视 + 浏览器 Network 面板为主；结构类以 grep/node --check 自证。沿用 2026-08-09-search-latency 先例。
- **调用方搜索**：
  - `searchByAPIAndKeyWord` 被 `js/app.js:900`（search 主循环）与 `js/player.js:2083` 调用。**改签名必须兼容 player.js 调用点**（新参数可选，缺省不传）
  - `buildSearchCardHTML` 被增量渲染（`:879`）与最终渲染（`renderSearchResults :1902`）共用；`renderCachedResults:762` 走最终渲染
  - `filterBanned` 被 search() 增量/最终两处调用
- **#1/#2 交叉陷阱（已识别）**：
  - `search()` 的 `finally { searchInProgress = false }`（`:1021-1024`）无代际保护——abort 旧搜索后旧 `finally` 抢先解锁会导致双搜索并发。必须引入代际 token `searchGeneration`，所有异步回调（增量渲染 `:872-896`、最终收尾、`finally`）都校验 `myGen === searchGeneration` 才执行
  - 增量渲染为 append 模式（`insertAdjacentHTML`），#1 早退收尾会整卡重排——窗口后新结果到达不能走 append，需节流后重跑收尾
  - `buildSearchCardHTML` 两阶段共用：增量阶段每项是单源原样，最终阶段是去重项——卡片必须兼容两者（`merged_sources` 存在时展开）

## 3. 执行顺序

执行顺序依据：独立低风险先行（#4）→ 请求生命周期（#2，为 #1 提供代际隔离基础）→ 收尾重构（#1，依赖 #2 的 token）→ 去重（#3，在 #1 抽出的 finalize 内排序后做，避免重复劳动）。

### 步骤 1：每源拉页上限 3→2（#4）

- **引用方法**：M-L4-02（Batching——控制单源批量拉页规模）
- **具体操作**：`js/config.js:34` `maxPages: 3` → `maxPages: 2`。`search.js:59` 自动生效（每源第 1 页 + 最多 1 额外页，最多 2 请求）
- **退出信号**：`config.js` `maxPages === 2`；搜索请求量降 1/3（Network 面板每源最多 2 请求）
- **验证责任**：AI 自证（config 值检查 + node --check）｜ HUMAN（结果数量/耗时对比）
- **回滚**：git revert 本步 commit

### 步骤 2：取消在途旧请求 + 代际隔离（#2）

- **引用方法**：M-L4-06（Async & Cancellation——取消在途请求 + 代际 token 防串扰）
- **具体操作**：
  1. `js/app.js`：模块级新增 `let searchGeneration = 0;`。`search()` 开头（`searchInProgress = true` 后）`const myGen = ++searchGeneration;`；若 `myGen !== searchGeneration` 直接 return（被更新的搜索取代）
  2. `search()` 内维护 `let searchAbortController = null;`，每次 search 开头 `searchAbortController?.abort(); searchAbortController = new AbortController();`（abort 触发旧搜索内部 fetch 取消，AbortError 已被 `:1016` 捕获）
  3. `js/search.js`：`searchByAPIAndKeyWord(apiId, query, externalSignal)` 增加可选第三参；两处 fetch（`:31` 第一页、`:82` 额外页）的 signal 合并：`const signal = externalSignal ? AbortSignal.any([controller.signal, externalSignal]) : controller.signal;`（保留内部 4s 超时语义）
  4. `search()` 主循环回调（`:899-906`）：`Promise.allSettled(selectedAPIs.map(async apiId => { if (myGen !== searchGeneration) return; const r = await searchByAPIAndKeyWord(apiId, query, searchAbortController.signal); ... }))`——回调开头与 scheduleIncrementalRender 内都校验 token
  5. `search()` 的 `finally`：`if (myGen === searchGeneration) { searchInProgress = false; hideLoading(); }`——防止旧搜索解锁新搜索的锁
- **退出信号**：连续搜索（搜 A 紧接搜 B）Network 面板确认 A 的在途请求被 abort；`searchInProgress` 锁不因旧搜索 finally 提前解锁；player.js:2083 调用点不传第三参仍正常
- **验证责任**：AI 自证（grep 调用点 + node --check + 逻辑检查）｜ HUMAN（连续搜索 Network 面板）
- **回滚**：git revert 本步 commit

### 步骤 3：搜索首屏时间窗竞速（#1）

- **引用方法**：M-L4-06（Async & Cancellation——超时优先的竞速交付）
- **具体操作**：`js/app.js` search() 内重构（`:858-1024`）：
  1. 定义竞速窗口 `const RACE_WINDOW_MS = 2000;`
  2. 将现有"全部 settle 后统一收尾"改为：
     ```js
     const allSettledPromise = Promise.allSettled(selectedAPIs.map(...));  // 保留现有增量渲染回调
     const raceTimeout = new Promise(resolve => setTimeout(() => resolve('timeout'), RACE_WINDOW_MS));
     const winner = await Promise.race([allSettledPromise, raceTimeout]);
     if (winner === 'timeout' && myGen === searchGeneration) {
         finalizeSearchResults();  // 早退收尾：对当前 allResults 排序/统计/筛选/分页/渲染
         showPartialLoadingHint(); // 显示"部分片源仍在加载"轻量提示
     }
     await allSettledPromise;  // 等剩余源 settle
     if (myGen !== searchGeneration) return;
     finalizeSearchResults();  // 最终收尾（幂等覆盖早退）
     hidePartialLoadingHint();
     ```
  3. **抽取收尾函数** `finalizeSearchResults()`：把现有 `:915-1024` 的排序/统计/筛选/分页/缓存/skeleton 收尾逻辑整体抽出（含 yellow 过滤、`window.searchResults`、`filteredResults`、`currentPage=1`、`searchCache.set` + LRU）；**早退时 `searchCache.set` 跳过**（数据不完整，不写缓存），最终收尾才写缓存
  4. **窗口后新结果到达**：`allSettledPromise` 内部回调中，若已早退（`earlyFinalized = true`）且该源有新结果 → 不 append（避免打乱排序），改为节流（300ms）触发一次 `finalizeSearchResults()`；空结果（失效源）不触发
  5. **提示**：新增轻量提示条——`resultsArea` 内动态创建/复用一个小 div（id `partialLoadingHint`，文案"正在加载剩余片源…"），早退且仍有 pending 时显示，全部 settle 后隐藏
  6. 竞速窗口内全部 settle（winner 为 allSettled）→ 走现有单一收尾路径（感知与改前一致）
- **退出信号**：多源+失效源场景首屏完整 UI（排序/统计/筛选/分页）< 2s 出现；最终统计/筛选/分页与全量 settle 结果一致；加载提示在全部完成后消失
- **验证责任**：HUMAN（Network 面板 + 目视首屏时间与最终一致性）｜ AI 自证（node --check + 逻辑检查）
- **回滚**：git revert 本步 commit
- **风险**：渲染管线重构；需确认早退收尾 → 窗口后新结果重收尾 → 最终收尾三态下筛选/分页不闪乱、缓存只写最终态

### 步骤 4：同名多源结果去重合并（#3）

- **引用方法**：M-L4-08（Loop Fusion——单次遍历去重 + 合并源计数）
- **具体操作**：`js/app.js` 最终收尾内（`finalizeSearchResults` 排序后）：
  1. 新增 `dedupeSearchResults(results)`：单次 `Map` 遍历，key = `${vod_name}|${vod_year}`（缺 year 时 `vod_name|`），保留首次出现项（排序后首个源），并累计 `item.merged_sources`（源名数组）与 `item.source_count`（源数量）
  2. `finalizeSearchResults` 与 `renderCachedResults` 均调用 `dedupeSearchResults`（缓存路径也去重，保证缓存/非缓存一致）
  3. `buildSearchCardHTML`：兼容 `merged_sources`——存在时 sourceInfo 显示首个源 + `source_count > 1` 时追加"N 个源"徽标；不存在（增量阶段单源）走原逻辑
  4. 筛选/统计展开合并源：`updateSearchStatistics`、`generateSearchFilters`、`applySearchFilters` 遍历 `item.merged_sources || [item.source_name]` 计数与匹配，保证"按源筛选"仍能命中去重项
- **退出信号**：搜索结果同名卡片合并为一张且标注"N 个源"；统计数与卡片一致；按某源筛选仍能看到该源对应合并卡片；同名不同年（如不同季）不误合并
- **验证责任**：HUMAN（目视去重结果 + 筛选/统计一致性）｜ AI 自证（node --check + 逻辑检查）
- **回滚**：git revert 本步 commit
- **风险**：行为变化（用户已批）；去重键稳定性（同名不同片不同年不误并）；播放入口变为"首个源"（资源切换功能可切源，已记录权衡）

## 4. 风险与看点

- **高风险**：#1（竞速收尾重构，search() 主流程三态收尾）；#3（去重与"按源筛选/统计"语义交互，需展开 merged_sources）
- **中风险**：#2（代际隔离引入，finally/回调/收尾三处 token 校验缺一处即出双搜索或串扰）
- **容易出错**：
  - #2 与 #1 共用 search() 主体：先做 #2 的 token（独立小步），再做 #1 重构收尾，避免一次改太多
  - #1 早退收尾**不写缓存**、最终收尾才写缓存——否则缓存半成品结果
  - #3 去重只作用于最终收尾与缓存路径，增量阶段保持原样（先到先展示）——数量从"重复多"收敛到"去重后"，属已批准行为变化
  - `AbortSignal.any` 需现代浏览器；`AbortError` 静默吞掉（已有 catch）
- **验证总览**：#4 #2（结构部分）AI 自证为主；#1 #3 及 #2（并发行为）需 HUMAN 目视/Network 面板
