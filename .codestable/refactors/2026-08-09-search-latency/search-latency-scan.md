---
doc_type: refactor-scan
refactor: 2026-08-09-search-latency
status: user-reviewed
scope: 搜索链路前端（js/app.js 的 search/searchWithConcurrencyLimit、js/search.js、js/config.js、js/site_health.js、js/optimize-apply.js、js/api.js）+ Express 代理（server.mjs 超时/重试），不含 serverless 平台实现
summary: 发现 7 条优化点：性能 5 / 结构 1 / 性能（缓存）1；其中 2 条会改变外部可观察行为（需用户决策）
---

# search-latency scan

## 总览

- 扫描范围：`js/app.js`（search 主流程 796-982、searchWithConcurrencyLimit 89-100）、`js/search.js`（searchByAPIAndKeyWord 全文件）、`js/config.js`（search 配置）、`js/site_health.js`（测活缓存）、`js/optimize-apply.js`（死代码）、`js/api.js`（聚合搜索死代码）、`server.mjs`（代理超时/重试）
- 发现 7 条优化点：性能 6 / 结构 1
- 按风险：低 3 / 中 3 / 高 1
- 建议先做：#1（并发调度）、#3（超时对齐）、#5（死代码清理）
- 建议慎做 / 后做：#2 #7（行为变化，需先决策是否接受结果集变化）、#4（渲染管线改造，需目视验证）
- 前置检查 7 条：
  1. 行为改动？✓ 无（用户诉求为性能，未夹带新需求）
  2. 测试覆盖？**命中**（搜索核心路径无自动化测试；项目无测试基建，history 先例 dead-code-cleanup 用 grep 自证豁免，本 scan 性能类条目验证以 HUMAN 目视 + Network 面板为准，如实说明见下文）
  3. 跨模块？✓ 无（前端搜索逻辑集中在 app.js/search.js；代理超时调整涉及 4 平台实现需同步，已在 #3 标注）
  4. 风格口味？✓ 无
  5. 生成/第三方？✓ 无
  6. 范围太大？✓ 约 6 文件 < 15，核心 < 1000 行
  7. 零候选？✓ 有候选

### 关于命中第 2 条（无测试覆盖）的说明

项目无自动化测试基建（package.json 无 test 脚本，attention.md 明确"无自动化测试，手动验证"）。搜索性能优化的行为等价验证以 **HUMAN 目视 + 浏览器 Network 面板计时** 为主：改前记录总耗时与结果数，改后对比"结果集一致、耗时下降"。若用户希望更强保障，可先补刻画测试（需引入测试 runner，成本高，见 #2 前置依赖讨论）。

## 条目

### [1] 搜索批次串行等待改为全量并发 + 按超时收敛 ✓

- **位置**：`js/app.js:89-100`
- **分类**：性能
- **现状**：`searchWithConcurrencyLimit` 每批 3 个源，`for` 循环 `await Promise.allSettled(batchPromises)`，批次间严格串行；每批必须等该批内最慢（甚至超时 8s）的源返回才进下一批
- **问题**：默认勾选 10 个源 → 4 批；若每批都有 1 个源慢/超时，总时长 ≈ 每批最慢之和，最坏 4×8s=32s。快源 1s 返回也要陪跑到批内慢源结束
- **建议**：去掉批次循环，一次并发发起全部选中源（或把并发提到 6-8 并用 Promise.allSettled 收齐）；每个源独立超时，快的先落、慢的各自等
- **建议映射的方法**：M-L4-06（Async & Cancellation）
- **风险**：低-中（并发数提高对代理/源站瞬时压力；不改结果集与顺序）
- **验证**：HUMAN（Network 面板对比改前后请求并发数与总耗时；确认结果集一致）
- **范围**：约 12 行 / 1 文件

### [2] 单源拉页上限 5 页降低（**行为变化，需决策**） ✓（接受结果变少）

- **位置**：`js/config.js:52`（maxPages）、`js/search.js:63-128`
- **分类**：性能
- **现状**：每源第一页串行返回后，按 pagecount 并行再拉最多 4 页（共 5 页），每页独立 8s 超时；10 源 × 5 页 = 最多 50 个代理请求
- **问题**：请求量放大 5 倍，单源最坏等待 16s；绝大多数用户只看前几页
- **建议**：maxPages 降到 2-3，或"首页结果已达 N 条就不再翻页"。**注意：降低页数会减少结果数量，是外部可观察行为变化**——如接受"更快但结果变少"，属需求决策（可走 cs-feat 或作为配置项）；如要求结果集不变，则本条目不做
- **建议映射的方法**：无直接对应（M-L4-02 Batching 不贴切；本质是需求权衡）
- **风险**：高（改变结果集）
- **验证**：HUMAN（对比降页前后结果数与耗时）
- **范围**：约 10 行 / 2 文件

### [3] 前端 8s 超时与代理层 5s+2 重试不对齐，慢源拖满超时 ✓

- **位置**：`js/search.js:27,82`、`server.mjs:19-20`（timeout 5000, maxRetries 2）
- **分类**：性能
- **现状**：前端每请求 8s AbortController；Express 代理 5s 超时 + 最多 2 次重试（最坏 15s）。前端 abort 后代理端 axios 仍可能继续重试（资源浪费），且前端等待期间源站慢响应直接拖满 8s
- **问题**：慢/失效源固定拖满 8s 才放弃；代理重试与前端超时不匹配，放大无效负载
- **建议**：前端超时降到 4-5s；代理 timeout ≤ 前端超时；失效源快速失败（参考 site_health 已有 4s 测活超时经验）。**注意：缩短超时可能放弃"慢但可用"的源，轻微行为变化；且 server.mjs 与 Vercel/Netlify/CF 3 套 serverless 代理需同步改动**
- **建议映射的方法**：M-L4-06（Async & Cancellation）
- **风险**：中（跨 4 平台同步；轻微行为变化）
- **验证**：HUMAN（Network 面板测失效源响应时间；确认可用源仍能返回）
- **范围**：约 10 行 / 2-5 文件

### [4] 所有批次完成后才一次性渲染，改为增量交付 ✓

- **位置**：`js/app.js:855-970`（search 主流程）
- **分类**：性能
- **现状**：全部源（4 批）都完成才渲染结果；期间只显示骨架屏
- **问题**：前 3 个源 1s 就返回了，但用户要等最慢批次（可能 8s+）结束才看到任何结果——感知延迟 ≈ 最慢源，而非"大部分源"
- **建议**：每批完成即增量渲染已到结果（Append-only）；统计/筛选/分页基于已到结果更新。与 #1 配合效果最佳
- **建议映射的方法**：M-L4-06（Async & Cancellation，增量交付属异步管线改造）
- **风险**：中（渲染管线改动，需目视验证筛选/分页/统计在增量场景下正确）
- **验证**：HUMAN（改前后各搜一次，观察首条结果出现时间）
- **范围**：约 30-50 行 / 1 文件

### [5] 清理搜索相关死代码（optimize-apply 并发函数 / api.js 聚合搜索 / AGGREGATED_SEARCH_CONFIG） ✓

- **位置**：`js/optimize-apply.js:26-91`（applySearchConcurrency，被注释，依赖不存在的 `window.concurrentPool`）、`js/api.js:403-618`（handleAggregatedSearch / handleMultipleCustomSearch，无调用方）、`js/config.js:38-44`（AGGREGATED_SEARCH_CONFIG，定义后未使用）
- **分类**：结构
- **现状**：`applySearchConcurrency` 依赖的 `concurrentPool` 全项目 grep 0 结果；聚合搜索两函数无任何调用方；聚合配置定义了但 `search()` 实际走 `searchByAPIAndKeyWord`，不经 `/api/search`
- **问题**：约 250 行死代码 + 一个误导性配置项，增加维护负担与误读风险（如有人以为聚合搜索已启用）
- **建议**：grep 确认 0 引用后删除死函数与死配置；`optimize-apply.js` 保留防抖与图片懒加载，仅删并发改写块
- **建议映射的方法**：M-L2-02（Inline Function 反向——删除无引用死代码）
- **风险**：低（无引用，grep 可证）
- **验证**：AI 自证（grep `concurrentPool` / `handleAggregatedSearch` / `AGGREGATED_SEARCH_CONFIG` 全项目 0 引用）
- **范围**：约 250 行删 / 3 文件

### [6] searchCache 增加 LRU 上限（承接 search-cache 遗留风险） ✓

- **位置**：`js/app.js:36,966`（searchCache Map）
- **分类**：性能
- **现状**：`searchCache` 为无限 Map，search-cache fix-note 已记录"无大小上限"遗留风险
- **问题**：长期使用内存无界增长（当前典型场景可忽略，但顺手可治）
- **建议**：加简单 LRU（如上限 50 条，超出删最旧）
- **建议映射的方法**：M-L4-05（Index & Cache）
- **风险**：低（不改行为，只限内存）
- **验证**：AI 自证（缓存命中逻辑不变，仅加淘汰）
- **范围**：约 10 行 / 1 文件

### [7] 搜索前用 site_health 测活缓存跳过已知失效源（**行为变化，需决策**） ✓（接受结果集变化）

- **位置**：`js/site_health.js`（已有 1h TTL 测活缓存）、`js/app.js`（search 起点）
- **分类**：性能
- **现状**：`site_health.js` 会把失效源自动取消勾选、活源自动勾选，结果缓存 1 小时；但 `search()` 不读该缓存，失效源只要在 selectedAPIs 里就照常请求、白等 8s
- **问题**：已知失效源每次搜索都空耗批次时间；58 源中约 48 个默认不勾选（失效/不可靠），用户手动勾选后更明显
- **建议**：搜索前读 siteHealthCache，把已知失效源临时跳过（不请求、不等待）。**注意：这会改变"实际搜索的源集合" → 结果集变化，属外部可观察行为**；且缓存 1h 内源可能恢复，需在 UI 上说明
- **建议映射的方法**：M-L4-05（Index & Cache）
- **风险**：中（结果集变化；缓存过期期间可能误跳过刚恢复的源）
- **验证**：HUMAN（对比跳过前后结果集与耗时）
- **范围**：约 15 行 / 2 文件
