---
doc_type: feature-design-review
feature: 2026-08-16-detail-source-switch
status: passed
review_state: passed
review_reason: ""
reviewer_id: ""
reviewed: 2026-08-16
round: 2
---

# detail-source-switch feature design 审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-16-detail-source-switch/detail-source-switch-design.md`
- Checklist: `.codestable/features/2026-08-16-detail-source-switch/detail-source-switch-checklist.yaml`
- Intent / brainstorm: none（需求来自用户对话：详情页添加视频源选择）
- Roadmap: none
- Related docs: compound `2026-08-08-history-dedup-key`（vod_id 源相关）、`2026-08-14-resource-load-race`（竞态教训）、`2026-08-15-cover-lazy-load-auth`（图片加载约定）
- Code facts checked: `js/app.js`（dedupeSearchResults L780-803 / showDetails L1091-1273 / renderEpisodes L1365-1377 / toggleEpisodeOrder L1391-1408 / playVideo L1277-1313 / copyLinks L1380-1388 / buildSearchCardHTML L1831-1900 / renderCachedResults L806-837）、`js/search.js`（L1-131）、`js/api.js`（L9-47）、`css/styles.css`（L1098+）

### Independent Review

- Status: completed
- Detection: independent-agent（round 1 与 round 2 各一个独立 Task agent reviewer）
- Provider / agent: code-explorer subagent（两个独立 reviewer）
- Raw output: 两轮 Task agent 输出（已本地核验合并）
- Merge policy: 逐条本地代码事实核验后合并 / 驳回
- Gate effect: 无（两轮均 completed 后定稿）

## 2. Design Summary

- Goal: 搜索去重合并后的多源影片，首页详情弹窗（`showDetails`）内新增数据源选择器（Tab 胶囊），切源后用目标源自己的 `vod_id` + `source_code` 重新拉 `/api/detail` 并整体重渲染详情，播放跳转携带选中源参数。
- Key contracts:
  - 名词层：`dedupeSearchResults` 新增 `merged_source_items: [{name, code, vod_id}]`（保留 `merged_sources` 字符串数组，兼容既有 6 处消费与旧缓存）；`showDetails` 从 `window.searchResults` 匹配合并项；抽取 `renderDetailIntoModal(detailData, sourceItems, activeIndex, vodName, vodYear)` 整体渲染；新增 `switchDetailSource(sourceItems, targetIndex)`
  - 编排层：线性 pipeline + 多源切换分支；切源请求序号令牌防竞态；错误回滚高亮
- Steps: 4（数据契约 → 详情渲染 → 交互逻辑 → 联调收尾）
- Checks: 11（名词契约 / 流程级约束 / 挂载点 / 范围守护 / 验收场景）
- Baseline / validation: `node --check js/app.js` + `npm run dev` 浏览器手动 S1-S10 + grep 反向核对

## 3. Findings

### blocking

none

### important

- [x] FDR-001 `design §2.1 变化3-4 / §2.2 / §3 S7` 切源后若只局部重渲染剧集网格，工具栏倒序按钮 `toggleEpisodeOrder('${sourceCode}','${vodId}')`（app.js L1239）onclick 仍是旧源参数；切源后点"倒序排列"会重渲染出携带**旧源** code/vodId 的剧集按钮，导致播放 URL 错乱。
  - Evidence: `renderEpisodes` L1371 与 `toggleEpisodeOrder` L1239 的 onclick 均内嵌 sourceCode/vodId；`toggleEpisodeOrder` L1396 重渲染 `episodesGrid` 用传入参数
  - Impact: 切源后"倒序排列"场景播放参数错误（可观察行为缺陷），验收 S7/S3 组合暴露
  - Expected fix scope: 已修复——`switchDetailSource` 更新全局详情状态后调用抽取的 `renderDetailIntoModal` **整体重渲染 modalContent**（hero + 来源 Tab + 工具栏 + 剧集网格），所有按钮 onclick 自动携带当前源参数；验收 S7 补充"点剧集播放 URL 仍带当前源 code/vodId"回归点

### nit

- [ ] FDR-003 `design §2.1` 切源后 hero 的 tags/description 是否随源更新未明示。
  - 处理结论：`renderDetailIntoModal` 接收 detailData（新源 `/api/detail` 响应），整体重渲染时 tags/desc 自然随 detailData 更新，无需额外处理；记录为已解决。

### suggestion

- [ ] FDR-002 `design §2.1 变化4` custom 源详情参数构建（`getCustomApiInfo` → `customApi`/`customDetail`）在 `showDetails` 与 `switchDetailSource` 两处重复。
  - 处理结论：design 保持"custom_ 分支同现状"表述，实现时可视情况抽 `buildDetailApiParams(sourceCode)` 小 helper（不阻塞，交由 implement 自决）。

### learning

- `vod_id` 源相关（compound `2026-08-08-history-dedup-key`）在本 feature 中再次生效：切源详情请求必须用目标源自己的 `vod_id`，合并数据结构需记录三元组而非仅 name。
- 内嵌 onclick 参数的 UI（字符串拼接生成按钮）在"状态切换 + 重渲染"场景下必须整体重渲染或同步更新全部按钮，局部重渲染会留下陈旧参数。

### praise

- 保留 `merged_sources` 字符串数组 + 新增 `merged_source_items` 的兼容策略，避免破坏 6 处既有消费与 localStorage 旧缓存。
- 参考 compound `2026-08-14-resource-load-race` 教训，切源请求用序号令牌防竞态（"后发覆盖前发"场景）。

## 4. User Review Focus

- 用户需要重点拍板：
  1. 详情页来源选择器采用 **Tab 胶囊**（互斥高亮，默认当前源）而非下拉框 —— 是否接受
  2. 切源后 hero 的简介 / 标签随源更新（整体重渲染的自然结果）—— 是否符合预期
  3. 不持久化"上次选中的源"（每次打开详情默认当前源）—— 是否接受
- implement 需要重点遵守：
  - `merged_source_items` 幂等构建（缓存路径不覆盖）；`merged_sources` 保持字符串数组
  - `renderDetailIntoModal` 取参来源：当前源 code/vodId 从 `sourceItems[activeIndex]` 取
  - 切源整体重渲染 modalContent（FDR-001 回归点）
  - 序号令牌防竞态；custom_ 源走 `getCustomApiInfo` 分支
- code review / QA / acceptance 需要重点复核：
  - S3（播放 URL 携带选中源参数）/ S6（快速切源竞态）/ S7（切源后倒序 + 播放参数）
  - 旧缓存兼容（S5）与自定义源（S9）

## 5. Evidence Confidence Ledger

| Check | Verdict | Evidence Class | Basis | Follow-up |
|---|---|---|---|---|
| Acceptance Coverage Matrix | pass | E | design §3.3 S1-S10 全部映射推进策略 step + 浏览器验证命令 | none |
| DoD Contract | pass | E | design §3.4 DOD-001~004 + CMD-001~003 | none |
| Steps and checks traceability | pass | C | checklist 4 steps / 11 checks 均可追溯到 design 对应节 | none |
| Roadmap contract compliance | n/a | - | 无 roadmap（frontmatter 无 roadmap/roadmap_item） | none |
| Module interface design | pass | C | `renderDetailIntoModal` / `switchDetailSource` / `merged_source_items` 契约经两轮独立 reviewer + 本地代码核验；无新增跨模块 seam/adapter（纯 app.js 内部函数） | none |
| Validation and artifacts | pass | C | CMD-001~003 + 交付物清单（design/checklist/design-review/review/acceptance） | none |

Summary: E=2, C=3, H=0, H-only core checks=none

## 6. Residual Risk

- `showDetails` 从 `window.searchResults` 匹配合并项依赖 `String(vod_id) === id && source_code === sourceCode`：不同源对同一影片返回的 `vod_id` 格式可能不一致（如数字 vs 带前缀字符串），极端情况下匹配失败会回退单源（功能降级但不报错）。下游：implement 时对匹配键做容错（如同时尝试 `item.vod_name === vod_name` 兜底），acceptance S5 覆盖。
- 去重合并按 `vod_name|vod_year` 键，跨源片名格式差异大的影片可能不被合并（compound 既有取舍），本 feature 不改变该合并语义。
- `renderDetailIntoModal` 抽取自 showDetails L1216-1256，抽取时需保证 `currentEpisodes` 等全局状态先于渲染赋值（showDetails L1213-1214 现状顺序）；implement 需保持"先更新状态后渲染"顺序。

## 7. Verdict

- Status: passed
- Next: 交给用户整体 review（cs-feat design 阶段第 6 节）；用户确认后进入 implementation

## 8. Focused Closure（FDR-004，round 2 后主 agent 核验）

- Closed findings: FDR-004（round 2 reviewer 提出：`renderDetailIntoModal` 接口未明确当前源 code/vodId 取参来源与 activeIndex 确定方式）
- Attributed delta: `detail-source-switch-design.md` §2.1 变化3 —— 接口示例补充"取参来源（显式契约）：当前源 code = `sourceItems[activeIndex].code`、vodId = `sourceItems[activeIndex].vod_id`" + "activeIndex 语义：初次 showDetails 为合并项中 `code === 传入 sourceCode` 的项下标，switchDetailSource 时 = targetIndex"
- Verification: 本地核验 showDetails 渲染段（L1216-1256）依赖 `safeSourceCode`/`safeId`（L1159-1160）由入参推导；修订后 `renderDetailIntoModal` 从 `sourceItems[activeIndex]` 取参可完整生成这两者；初次调用时匹配项自身的 code/vod_id 与 showDetails 入参一致（design D4 匹配键保证）
- Classification: 纯接口契约表述完备化，不改变验收语义（S1-S10 不变）、范围、公开契约或编排拓扑；按 focused closure 处理，不重启独立 reviewer
