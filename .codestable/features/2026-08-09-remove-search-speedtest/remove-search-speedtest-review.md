---
doc_type: feature-review
feature: 2026-08-09-remove-search-speedtest
status: passed
reviewer: subagent
reviewed: 2026-08-09
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI not installed"
---

# remove-search-speedtest 代码审查报告

## 1. Scope And Inputs

- Design: 无（Quick lane，仅 ff-note）
- Checklist: 无（Quick lane）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: 实现汇报（当前对话）+ `remove-search-speedtest-ff-note.md`
- Diff basis: `git status --short` + `git diff`：`css/mobile-optimize.css`、`index.html`、`js/app.js`、`js/search.js`（4 文件，净删 64 行）
- Review mode: initial
- Baseline dirty files: 工作区另有 `.commit_msg_tmp.txt`、`.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`（均为历史未跟踪，与本次无关）

### Independent Review

- Detection: 主 agent 自检——Task agent（code-explorer，独立上下文、只读）可用；`ocr` CLI 未安装
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable
- OCR severity mapping: 未启用（OCR 未安装，不阻塞）
- Merge policy: 环节 A 结果已逐条对照工作区代码核验后合并；无 OCR finding
- Gate effect: 环节 B 缺失不阻塞；gate 锚点为 `reviewer: subagent`

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-09-remove-search-speedtest/remove-search-speedtest-ff-note.md`
- 修改：`js/search.js`、`js/app.js`、`index.html`、`css/mobile-optimize.css`
- 删除：无独立删除文件
- 未跟踪 / staged：`.codestable/features/2026-08-09-remove-search-speedtest/`（未跟踪）
- 风险热点：UI（卡片/筛选面板移除）、行为回归（排序 tiebreak 移除后确定性）

## 3. Adversarial Pass

- 假设的生产 bug：删除后残留对 `latency` / `filterByLatency` / `latencyFilters` 的引用导致运行时 ReferenceError；`searchByAPIAndKeyWord` 返回值结构变更破坏调用方
- 主动攻击过的反例：残留引用 grep、3 个调用方（`app.js:894`、`player.js:2083`）返回值契约、排序退化后的稳定性、HTML/CSS orphan 依赖、增量渲染/筛选/分页链路
- 结果：残留引用清零、调用方契约兼容（均为正）；排序确定性缺陷升级为 important REV-001 并已修复；`search()` 不重置 `currentFilters` 为既有缺陷，移入 Residual Risk

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/app.js` 排序比较器 删除 latency tiebreak 后，同名同源条目的相对顺序依赖到达时序，cache/no-cache 两路径顺序可能不一致
  - Evidence: 排序比较器仅剩 `vod_name → source_name`，全等时返回 0；V8 sort 稳定，相对顺序退化为到达顺序；缓存路径 `renderCachedResults` 不经过排序代码
  - Impact: 同一关键词两次搜索第 1 页卡片顺序可能不同，分页时卡片跨页漂移，影响验收可信度
  - Expected fix scope: 比较器第 3 级补确定性 tiebreak（`vod_id`）
  - 处理结果：已修复，比较器追加 `vod_id` 字符串比较；`node --check` 通过，lint 0

### nit

- [ ] REV-002 `js/app.js:909` 注释与 `.codestable/compound/2026-08-09-search-incremental-append-render.md` 第 4 点仍描述"按延迟排序"，行为已变更为"按名称排序"（ff-note 顺手发现已自曝，未阻塞）

### suggestion

- [ ] REV-003 `js/app.js` `buildSearchCardHTML` 输出 `data-api-url` 全仓库无读取方，`search.js` 每条结果附加的 `api_url` 字段同属死数据，可在后续清理
- [ ] REV-004 `js/app.js` 增量渲染期间 `searchSourcesCount`（"来自 N 个片源"）只在最终 `updateSearchStatistics` 更新，加载过程不同步（既有行为）

### learning

- `searchByAPIAndKeyWord` 返回值仅 `{ results }` 后，3 个调用方均只依赖 `results`，删除 `latency` 零破坏——改动前调用方契约本就未绑定 latency
- `search.js` 保留 4s AbortController 超时而非连同 latency 一起删除，是正确的"只删测速、不动超时"边界

### praise

- 删除范围精准：卡片徽标、筛选面板、排序、测量四层全覆盖，未误伤播放器独立的资源测速功能（`player.js` `testVideoSourceSpeed` / `speed-badge` 保留）
- 对 `.latency` / `filterByLatency` 清理彻底（0 残留），优于"只删 UI 留逻辑"的浅改动
- CSS 与 HTML 同步干净，无 orphaned 选择器/节点

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 搜索任意关键词，卡片无 `xx ms` 徽标；筛选面板仅剩"按片源/按分类"
  2. 进入播放器后切源面板 `🟢/🟡/🔴 xx ms` 速度徽标仍正常（播放器侧测速保留属预期）
  3. 同一关键词连续搜两次（no-cache + 5 分钟内 cache 命中），对比两次第 1 页卡片顺序是否一致（重点：同名多版本影片），确认 REV-001 修复生效
  4. 搜"A"→ 选片源筛选 → 直接改搜"B"：结果是否被残留 `currentFilters` 意外过滤（对应 Residual Risk #1）
  5. 多源搜索慢词：增量渲染先到先显示、计数持续更新、最终按名称排序、分页正常
  6. 移动端（≤640px）：筛选面板换行、卡片单列、分页均正常
- 建议新增或加强的测试：none（项目无自动化测试基建，以手动验证为准）
- 不能靠 review 完全确认的点：增量渲染实际视觉、cache/no-cache 顺序实测、播放器切源面板速度徽标——需浏览器实测

## 6. Residual Risk

- REV-005 `js/app.js` `search()` 与 `renderCachedResults` 进入时不重置 `currentFilters`（既有缺陷，非本次引入）：跨搜索残留片源/分类筛选会导致按钮高亮与实际生效条件错位。本次未修（超出移除测速范围），建议后续 issue 收口；QA 场景 4 显式覆盖
- 播放器内速度徽标与搜索速度徽标的"双轨"保留属产品决策，review 只能标记，需 owner 确认预期

## 7. Verdict

- Status: passed
- Next: 收尾提交（scoped-commit）；可顺带确认 residual-risk #1 是否另开 issue

## 8. Focused Closure（无则写 none）

none
