---
doc_type: refactor-review
refactor: 2026-08-09-search-latency
status: passed
reviewer: subagent
reviewed: 2026-08-09
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装（OCR_NOT_FOUND），按协议不阻塞本轮"
---

# search-latency 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/refactors/2026-08-09-search-latency/search-latency-refactor-design.md`
- Checklist: `.codestable/refactors/2026-08-09-search-latency/search-latency-checklist.yaml`
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `search-latency-apply-notes.md`（7 步全 done）
- Diff basis: git diff（9 文件 +66/-464，未提交）
- Review mode: initial
- Baseline dirty files: none（本次 refactor 全部改动可归因）

### Independent Review

- Detection: 环节 A 独立 Task agent（code-explorer）可用并已执行；环节 B OCR CLI 不可用（`where ocr` → OCR_NOT_FOUND）
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 环节 A findings 已逐条本地核验后合并
- Gate effect: none（环节 A 已完成，`reviewer: subagent` 满足 gate）

## 2. Diff Summary

- 修改：`js/app.js`（search() 全流程 + searchWithConcurrencyLimit + searchCache LRU + 死函数删除）、`js/search.js`（两处超时）、`js/config.js`（maxPages、删 AGGREGATED_SEARCH_CONFIG）、`js/api.js`（删 352 行死代码）、`js/optimize-apply.js`（删 applySearchConcurrency）、`server.mjs`（timeout/maxRetries）
- 删除（净）：约 464 行死代码
- 未跟踪 / staged：none
- 风险热点：并发/异步（全量并发 + 增量渲染）、跨 4 平台代理同步（#3）、行为变化（#2 #7 已获用户批准）

## 3. Adversarial Pass

- 假设的生产 bug：增量渲染节流 timer 与最终渲染竞争，导致最终渲染被增量渲染覆盖或顺序错乱
- 主动攻击过的反例：
  - 增量 timer 与 allSettled 竞态：单源返回设置 timer → 后续源在 timer 触发前返回 → allSettled resolve 时 clearTimeout → 无增量渲染直接最终渲染（安全）；慢源在 timer 触发后才返回 → timer 先渲染部分、最终渲染覆盖（安全）。JS 单线程下 clearTimeout 在同步段内生效，无竞态
  - `getApiPageSize` 误删：review 期间独立 agent 发现本函数被我误删（101 行仍引用），已恢复，语法 + lint 通过
  - `searchWithConcurrencyLimit` 变死代码：search() 步骤 7 内联改写后该函数无调用点，违反"清理死代码"目标（important，见 REV-001），已删除
  - cacheKey 与 effectiveAPIs：cacheKey 已改用 effectiveAPIs，不会命中"含失效源旧缓存"
  - filterBanned 双重过滤：缓存命中路径 renderCachedResults 再过滤一次，幂等无害
  - LRU 边界：`size > 50` 删除最旧（Map 插入序），set 已有 key 不改变迭代序，符合设计声明
- 结果：1 条 important（REV-001）已修复；其余进入 residual risk / QA focus

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/app.js:88-91` `searchWithConcurrencyLimit` 在步骤 7 内联改写后成为无调用点的死函数
  - Evidence: grep 全项目仅 1 处定义、0 处调用；本 refactor 步骤 1 刚清理死代码，此处又引入新死代码
  - Impact: 违反 refactor 目标；遗留误导（未来维护者可能误以为 search 仍走该函数）
  - Expected fix scope: 删除该函数（函数体逻辑已内联进 search()）
  - 处理: 已删除，grep 0 引用、语法/lint 通过

### nit

- [ ] REV-002 `js/app.js` search() 增量渲染实现与 design 步骤 7 第 5 点的 "renderInProgress 防抖锁" 命名不同
  - 实现用 `incrementalTimer` + 最终渲染前 `clearTimeout` 达成相同效果（防止增量覆盖最终渲染），功能等价
  - 建议：接受现状或补一行注释说明等价性（非阻塞）

### suggestion

none

### learning

- 全量并发 + 增量渲染组合：并发 Promise 全量发起 + 每源 resolve 触发节流渲染，是"先到先展示"的简洁实现；关键是在最终渲染前 clearTimeout 未触发的增量 timer，避免覆盖
- 跨 4 平台代理改超时/重试时，需逐文件确认 fetch 实现形态（node-fetch vs 原生 fetch），AbortSignal.timeout 两者均支持

### praise

- `searchWithConcurrencyLimit` 保留签名但函数体一次改到位，减少调用点改动
- #7 增量渲染与 #1 全量并发协同设计，感知延迟从"最慢批次"降为"首批结果"
- LRU 利用 Map 迭代序，实现极简且符合设计声明

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 搜索多源并发：Network 面板确认多个源同时发出（不再分批）
  2. 增量渲染：搜索后首条结果 < 2s 出现，最终统计/筛选/分页正确，无"先显示后消失"
  3. 失效源约 4s 放弃（Network 面板），可用源正常返回
  4. 已知失效源不出现在请求中（effectiveAPIs 生效）
  5. 结果数量少于改前（maxPages 3），但仍覆盖前 3 页
  6. 设置面板重新测活后搜索仍正常
- Evidence pack residual risks / gate warnings: none
- 建议新增或加强的测试：none（项目无自动化测试基建，attention.md 明确手动验证）
- 不能靠 review 完全确认的点：真实网络环境下各源实际延迟分布、增量渲染在弱网/超时源的交互表现

## 6. Residual Risk

- 缩短超时（8s→4s）可能放弃"慢但可用"的源（#3，scan 已声明轻微行为变化，用户已批准）
- 测活缓存 1h 内源恢复会被跳过（#7，scan 已声明，用户已批准）
- 增量渲染过程中统计/筛选/分页仅最终态正确，中间态只有卡片 + 计数（设计如此）
- serverless 3 平台超时改动需在对应平台部署后实测（本地只能验证 Express）

## 7. Verdict

- Status: passed
- Next: 按「进入来源」表 → refactor 收尾提交（commit 前先完成 HUMAN 验证项）
