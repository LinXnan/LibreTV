---
doc_type: feature-review
feature: 2026-08-10-datasource-simplify
status: passed
reviewer: subagent
reviewed: 2026-08-10
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装（where.exe 无输出），环节 B 不可用，不阻塞；环节 A 独立 Task agent 已完成"
---

# datasource-simplify 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-10-datasource-simplify/datasource-simplify-design.md`
- Checklist: `.codestable/features/2026-08-10-datasource-simplify/datasource-simplify-checklist.yaml`
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: 实现完成汇报（Step 1-3 + 语法校验 + HTTP 验证）
- Diff basis: git diff 工作区未提交改动（js/config.js、js/app.js、index.html、js/site_health.js 删除）
- Review mode: initial
- Baseline dirty files: none（工作区仅本 feature 改动 + 既有 untracked node_modules/.idea）

### Independent Review

- Detection: 独立 Task agent 可用；ocr CLI 未安装（`where.exe ocr` 无输出）
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 环节 A findings 由主 agent 逐条本地核验后合并；环节 B 不可用
- Gate effect: none（环节 B 不可用经确认不阻塞，环节 A 已完成）

## 2. Diff Summary

- 新增：none
- 修改：`js/config.js`（删 DEFAULT_UNSELECTED_APIS）、`js/app.js`（默认全选 + V2 迁移 + 删测活过滤段 + cacheKey/主循环改 selectedAPIs + 迁移块提前）、`index.html`（删 site_health.js 引用）
- 删除：`js/site_health.js`
- 未跟踪 / staged：none（未 commit）
- 风险热点：UI 初始化时序 / localStorage 迁移 / 并发搜索路径

## 3. Adversarial Pass

- 假设的生产 bug：迁移逻辑时序——`initAPICheckboxes()` 在迁移块之前执行，导致旧用户 UI 显示旧勾选而实际 selectedAPIs 已全选，S2 目视失败。
- 主动攻击过的反例：设计不一致（迁移块位置）、边界值（首次/旧/已迁移三态用户）、错误路径（search 无 effectiveAPIs 残留）、并发时序（DOMContentLoaded 内顺序）、持久化（selectedAPIsV2 写入）、测试假阳性（grep 验证）
- 结果：B1 升级为 blocking finding（确认属实）；其余攻击点（custom_* 保留、index.html 引用、其他文件 SiteHealth 依赖）均通过。

## 4. Findings

### blocking

- [x] REV-001 `js/app.js:41-47` 迁移块在 `initAPICheckboxes()`/`updateSelectedApiCount()` 之后执行
  - Evidence: DOMContentLoaded 回调内 :41 `initAPICheckboxes()`、:47 `updateSelectedApiCount()` 先于 :49-67 迁移块；旧用户迁移后 UI 用旧 selectedAPIs 渲染
  - Impact: 旧用户迁移场景 S2 目视失败，UI 显示与实际勾选不一致；搜索（用迁移后全选值）与 UI 不符
  - Expected fix scope: 迁移块须在渲染函数之前执行（已修复：迁移块移至 DOMContentLoaded 回调开头，`initAPICheckboxes()` 之前）

### important

- none

### nit

- none

### suggestion

- none

### learning

- 删除模块前必须 grep 其全局暴露与内部函数的外部引用（window.SiteHealth / applyOne / applyAll 均无外部调用，删除安全）
- DOMContentLoaded 内"先改状态后渲染"的顺序是迁移类逻辑的高发坑

### praise

- 删除范围界定清晰（文件 + index.html 引用 + app.js 读取段），无残留
- 迁移保留 custom_* 的设计在 review 前已由 design review 阶段修复

## 5. Test And QA Focus

- QA 必须重点复核：S1（新用户全选）、S2（旧用户迁移保留 custom_* + UI 同步）、S4（取消勾选刷新保持）、S5（搜索直接全量并发）、S8（grep 无测活残留）
- Evidence pack residual risks / gate warnings：none
- 建议新增或加强的测试：无自动化基建，手工验证为主
- 不能靠 review 完全确认的点：浏览器实测 UI 勾选状态与搜索请求行为（需 HUMAN 目视 + Network 面板）

## 6. Residual Risk

- 63 个源全选后搜索请求量增大（所有勾选源并发，失效源多等 4s 超时）——acceptance 验证 S5 时观察，属设计预期（用户明确选择"直接全部勾选 + 搜索"）
- 迁移逻辑幂等（hasInitializedDefaults || selectedAPIsV2 双条件），重复执行无副作用——acceptance S2 验证

## 7. Verdict

- Status: passed
- Next: Standard feature → accept-inline

## 8. Focused Closure（无则写 none）

- Closed findings: REV-001
- Attributed delta: `js/app.js` DOMContentLoaded 回调内迁移块移至 `initAPICheckboxes()` 之前（约 -8/+8 行，含注释）
- Targeted verification: `node --check js/app.js` 通过（SYNTAX OK）；复核 selectedAPIs 顶层声明（:2）与 API_SITES 常量作用域，迁移块提前无作用域问题
- Classification: 纯时序调整（先迁移后渲染），行为等价于 design 第 2.2 节变化后主流程，未改变公开契约/安全/数据/并发/架构；focused closure 通过
