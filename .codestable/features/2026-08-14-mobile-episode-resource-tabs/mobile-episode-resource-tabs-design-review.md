---
doc_type: feature-design-review
feature: 2026-08-14-mobile-episode-resource-tabs
status: passed
reviewer: independent-agent
reviewed: 2026-08-14
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_reason: "ocr CLI 未安装（where.exe ocr 无结果）"
---

# mobile-episode-resource-tabs 设计审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-14-mobile-episode-resource-tabs/mobile-episode-resource-tabs-design.md`
- 审查方式：只读对照 `player.html` / `css/player.css` / `js/player.js` 及全仓库检索
- 审查点：代码引用一致性、删除清单完整性、互斥显隐特异性、断点处理、边界与回归

## 2. Round 1 结论

**Verdict: changes-requested**（1 blocking + 2 important + 2 nit）

### blocking

- [ ] B1 `js/player.js:314` `loadVideo` 在页面加载时已**无条件**调用 `loadResourceSwitchList()`；重复调用会重置 `resourcePage = 0` 并重渲染。design 4.2 的"首次激活 resources 时调用加载"守卫在该前提下恒为真 → 破坏 US-3（分页保留）/ US-6，产生多余请求与闪烁。

### important

- [ ] I1 design 4.4 改写后的 `.episode-toolbar` 选择器丢失作用域前缀（`player.css:487` 原规则含 `.player-sidebar-body.mobile-panel-open` 完整前缀）→ 特异性下降，潜在潜伏回归
- [ ] I2 `cleanup()` 是否清理 Tab 按钮的 `is-tab-active` 未明确；断点往返后 Tab 按钮激活高亮可能丢失

### nit

- [ ] N1 无 JS 兜底：若 init 未运行且两面板均无 `is-tab-active`，互斥规则将两面板都隐藏 → 侧栏空白（建议 HTML 静态预置面板类）
- [ ] N2 断点往返丢弃"视频源"Tab 选择（design 已明确接受，记录为已知取舍）

## 3. Round 2 修复记录

- B1 已修：design 4.2 改为"`activate('resources')` 绝不主动调用 `loadResourceSwitchList()`；仅 `resourcePageCtx === null`（异常兜底）时调用"。目标 2.1 / US-2 / M12 / 风险表同步更新
- I1 已修：改写规则恢复完整作用域 `.player-sidebar-body #episodesGridContainer .episode-toolbar`
- I2 已修：`cleanup()` 仅清理两面板的 `is-tab-active`，不动 Tab 按钮；返回 ≤640 用 `activate('episodes')` 统一恢复面板与按钮
- N1 已修：`#episodesGridContainer` 静态预置 `is-tab-active`，无 JS 时选集默认可见
- N2 接受为已知取舍（不持久化 Tab 选择）

## 4. Focused Closure 结论

修复均为审查员建议范围内的定向修改，无新契约变化。设计可通过，进入 implementation。

## 5. Test And QA Focus（沿用 design 5.2 / 5.3）

- M12 资源 Tab 反复切换不重复触发加载、分页不被重置（B1 验证点）
- M8 断点往返无残留类、Tab 按钮激活态正确（I2 验证点）
- M9/M10 桌面/平板无 Tab 栏、行为不变
- 回归：集数分页、自动连播跨页高亮、切源、断点切换
