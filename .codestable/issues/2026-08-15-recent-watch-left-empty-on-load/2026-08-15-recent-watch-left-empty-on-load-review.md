---
doc_type: issue-review
issue: 2026-08-15-recent-watch-left-empty-on-load
status: passed
reviewer: subagent
reviewed: 2026-08-15
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: ocr CLI not installed
---

# 2026-08-15-recent-watch-left-empty-on-load 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/issues/2026-08-15-recent-watch-left-empty-on-load/2026-08-15-recent-watch-left-empty-on-load-analysis.md`（confirmed）
- Checklist: none（issue 流程）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: fix-note（`2026-08-15-recent-watch-left-empty-on-load-fix-note.md`）+ 对话修复汇报
- Diff basis: `git status --short`（`M js/recent-watch.js` + untracked issue 目录）+ `git diff`
- Review mode: initial
- Baseline dirty files: none

### Independent Review

- Detection: 独立 Task agent（code-explorer，独立上下文）可用；`ocr` CLI 未安装
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（`ocr` 命令不存在，不阻塞本轮）
- OCR severity mapping: 未启用
- Merge policy: 环节 A findings 已逐条本地事实核验后合并
- Gate effect: 环节 A completed → gate 放行（`reviewer: subagent`）

## 2. Diff Summary

- 新增：`.codestable/issues/2026-08-15-recent-watch-left-empty-on-load/`（report / analysis / fix-note / approval-report）
- 修改：`js/recent-watch.js`（`applyEntranceDelays` 函数，+8/-3 行）
- 删除：none
- 未跟踪 / staged：issue 目录为 untracked（CodeStable 产物，不入代码 review 行级范围）
- 风险热点：UI（入场动画延迟算法）；无跨模块 / 权限 / 数据 / 并发风险

## 3. Adversarial Pass

- 假设的生产 bug：延迟分配与槽位排版（updateCoverflow）的 delta 算法不一致，导致卡片延迟与实际位置错位
- 主动攻击过的反例：
  - count=1/2/4/5/6 奇偶边界 → 已验证对称正确（count=4：dist [0,1,2,1] → delay [0,80,160,80]）
  - activeIndex 变化（advance）时 animationDelay 是否错乱 → 入场动画仅在 `render()` 触发一次，`advance()` 只改 transform 不重触发动画，无影响
  - selector 不一致（`:not([aria-hidden])` vs 裸类）→ 当前渲染无卡片带 aria-hidden，实际 index 一致；列为 residual risk
  - `prefers-reduced-motion` 分支 → JS 提前 return + CSS 媒体查询双保险，正确
- 结果：无 blocking / important；1 residual risk、1 nit

## 4. Findings

### blocking

none

### important

none

### nit

- [ ] REV-001 `js/recent-watch.js:223` `window.matchMedia` 缺失时 `reduceMotion` 恒为 false，仍会设置 animationDelay。建议：`if (!window.matchMedia) return;` 或在调用前兜底。影响极小（现代浏览器均支持 matchMedia）。

### suggestion

none

### learning

- CSS `animation` shorthand（`0.55s ... backwards`）未指定 delay 时重置为 0s，JS inline `animationDelay` 优先级更高，可正常覆盖——本次修复依赖此机制。

### praise

- 修复复用 `updateCoverflow` 的 delta 折叠算法（`((i - activeIndex) % count + count) % count` + `half` 修正），两处视觉距离口径一致，避免引入第二套排版逻辑。
- 保留了 `prefers-reduced-motion` 守卫，且 `count === 0` 防御与 `updateCoverflow` 保持一致。

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 首页刷新（历史 ≥ 4 条）：最近观看左侧卡片与右侧对称同时淡入，无"左边空白"
  2. 历史恰好 2 条：左右各 1 张，延迟 0/80ms 对称淡入
  3. 历史 1 条：单卡立即显示（delay 0）
  4. 点击左右按钮 / 方向键切换：切换功能正常，不触发入场动画重播
  5. 系统开启"减弱动态效果"（prefers-reduced-motion）：无入场动画
- 建议新增或加强的测试：none（无测试设施，前端手动验证）
- 不能靠 review 完全确认的点：无自动化测试，动画视觉效果需浏览器实测

## 6. Residual Risk

- `js/recent-watch.js:225`（applyEntranceDelays）用 `.recent-watch-card:not([aria-hidden])`，`updateCoverflow`（:103）用 `.recent-watch-card`。当前渲染中卡片不带 `aria-hidden`，两者 index 一致；但未来若给卡片加 `aria-hidden`，两处 count / index 将错位。QA 时若正常可不处理，建议后续统一 selector。

## 7. Verdict

- Status: passed
- Next: 进入 cs-issue fix 收尾提交（用户确认浏览器验证后 commit）

## 8. Focused Closure（无则写 none）

none
