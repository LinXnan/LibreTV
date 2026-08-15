---
doc_type: feature-review
feature: 2026-08-15-datasource-per-page-6
status: passed
reviewer: subagent
reviewed: 2026-08-15
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装/不可用，按协议记 not-available，不阻塞"
---

# datasource-per-page-6 代码审查报告

## 1. Scope And Inputs

- Design: none（Quick lane，仅 ff-note）
- Checklist: none（Quick lane）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `.codestable/features/2026-08-15-datasource-per-page-6/datasource-per-page-6-ff-note.md` + 对话内实现汇报
- Diff basis: `git diff -- js/app.js`（唯一改动文件）
- Review mode: initial
- Baseline dirty files: none（`js/app.js` 修改 + ff-note 新增目录均属本轮归因）

### Independent Review

- Detection: 主 agent 可用 Task 工具启动独立 subagent reviewer；`ocr` CLI 不可用（`where.exe ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed（code-explorer，返回完整 findings）
- 环节 B OCR CLI: unavailable（未安装）
- OCR severity mapping: High→blocking/important, Medium→nit/suggestion, Low→discarded（未运行）
- Merge policy: 环节 A 结果已由主 agent 本地逐条核验后合并
- Gate effect: none（环节 A 为 gate 必需且已完成；环节 B 可选）

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-15-datasource-per-page-6/datasource-per-page-6-ff-note.md`
- 修改：`js/app.js`（`getApiPageSize` 函数体）
- 删除：none
- 未跟踪 / staged：ff-note 目录未跟踪；`js/app.js` 修改未 staged
- 风险热点：UI（设置面板数据源分页）；无跨模块 / 权限 / 数据 / 并发改动

## 3. Adversarial Pass

- 假设的生产 bug：pageSize 固定后跨断点 resize 重渲染是否引入可见状态副作用或分页错位
- 主动攻击过的反例：getApiTotalPages 边界（0 个源 / 非 6 倍数）、initAPICheckboxes 切片与占位补足、resize 断点重渲染死逻辑与成人检测副作用、apiPage 越界 clamp、搜索结果分页（PAGINATION_CONFIG）是否被波及
- 结果：确认改动为纯常量替换，未引入直接生产 bug；发现 1 项既有死逻辑副作用（见 REV-001，非本次引入）；搜索结果分页逻辑独立未受影响

## 4. Findings

### blocking

none

### important

- [ ] REV-001 `js/app.js:615-632` resize 断点重渲染成为死逻辑，跨断点会无意义重建 API 列表 DOM 并触发 `checkAdultAPIsSelected()`（强制禁用黄色过滤器开关 + 写 localStorage），还可能 scrollTo 打断用户滚动
  - Evidence: resize 监听原注释目的为"每页数量随断点变化时避免切片错位"（615 行）；pageSize 固定 6 后跨断点不再改变每页数量，重渲染失去目的；`initAPICheckboxes` 末尾调用 `checkAdultAPIsSelected`（223 行 → 289-306 行）
  - Impact: 用户仅调整窗口宽度跨 640px，就可能观测到黄色过滤器开关被无意的成人检测逻辑重置；属既有行为，非本次改动引入
  - 处置：本次不修（超出"每页 6 个"范围，且为既有行为），移入 Residual Risk，待后续独立跟进

### nit

- [ ] REV-002 `js/app.js:98-101` `getApiPageSize()` 固定返回常量，函数抽象语义变冗余，但保留利于未来可配置化，不阻塞

### suggestion

- [ ] REV-003 `js/app.js:107-109` 数据源实际数量由运行时 `extendAPISites()` 注入，QA 建议用 0/1/5/6/7/11/12/13 等不同数量回归切片边界

### learning

- 本次改动消除了一个潜在旧 bug 源：旧代码 pageSize 随断点 12/6 切换时，`apiPage` 依赖 `initAPICheckboxes` 内部 clamp（177 行）就地修正；固定 6 后跨断点 apiPage 恒有效，该隐患自然消失

### praise

- 改动最小化：只动一个纯函数，下游 `getApiTotalPages` / 切片 / 占位补足均复用同一 `getApiPageSize()`，无散落的魔法数 6/12
- ff-note 诚实记录了 resize 死逻辑残留，边界标注清晰
- 占位补足（206-211 行）用 `visibility:hidden` 保留布局高度且不暴露给辅助技术，实现正确

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 数据源数量为 6 的倍数 / 末页不足 6 / 极端 0 个时，分页与占位高度一致，占位项不可选中
  2. 首页/末页"上一页/下一页"disabled 状态与越界 clamp（119、134、149 行）
  3. 跨断点 resize 时复选框勾选状态保留；**黄色过滤器开关是否被无意重置**（REV-001 关键回归点）
  4. 成人 API 组与自定义 API 列表不受本次分页影响，勾选状态保留
- Evidence pack residual risks / gate warnings: none
- 建议新增或加强的测试：none（项目无自动化测试框架）
- 不能靠 review 完全确认的点：运行时实际注入的普通 API 数量、640 断点下 scrollTo 实际观感

## 6. Residual Risk

- REV-001 resize 死逻辑副作用：跨 640px 窗口拖拽会触发 API 列表 DOM 重建 + 成人检测 + 可能 scrollTo。含大量成人/自定义 API 时 `checkAdultAPIsSelected` 重置黄色过滤器控件状态的行为可观测。未在本次改动范围，建议后续独立 commit 移除或收敛 resize 重渲染分支（保留 177 行 clamp 兜底）。QA 在验收时按 Test And QA Focus 第 3 条重点回归。

## 7. Verdict

- Status: passed
- Next: ff 来源通过后去向 → 收尾提交（询问用户是否代为 scoped-commit）

## 8. Focused Closure（无则写 none）

none
