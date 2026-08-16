---
doc_type: feature-design-review
feature: desktop-episode-resource-tabs
date: 2026-08-16
review_state: passed
review_reason: "首轮 changes-requested（2 项 non-blocking）→ focused closure 修复闭合"
reviewer_id: task-agent-independent
---

# Design Review：桌面/平板端选集 / 视频源 改 Tab 页切换

## 审查范围

独立 Task agent reviewer 逐项核对三项必查（spec 覆盖率 / 占位符扫描 / 术语类型一致），并对照仓库事实核查 design 声称的现状行号与安全性判断。

## 结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| A. spec 覆盖率 | PASS（1 处漏步已补） | US-1~US-9、M1~M11 均映射到 checklist；原回归清单 §5.3 无对应步骤 → 已补 s7 |
| B. 占位符扫描 | PASS | 无 TBD / 空泛表述；"可选/不强制"均为明确取舍决策 |
| C. 术语/类型一致 | PASS（1 处表述已修） | `is-tab-active` / `#mobilePanelTabs` / `MobilePanelTabs` / `sidebar-collapsed` 前后一致；特异性 (1,2,0) 仅对 id 分支成立 → 已修正措辞 |

## 仓库事实核查（独立 reviewer 确认）

- 移动端 Tab 样式（414-444）、≥641 隐藏块（484-489）、桌面 flex:1（738-743 / 764-769）行号与源码一致
- `mobile-panel-tabs.js` matchMedia 分支（≤640 activate / ≥641 cleanup + 2 change 监听）与 design §4.2 描述一致
- `player.js:1809-1831` 收起逻辑行号一致
- 删除 `cleanup` 安全：全仓库 `MobilePanelTabs` 仅模块自身定义，无外部调用
- 互斥规则上移通用与移动端 `display:flex !important`(0,1,0) 无冲突（互斥更高特异性 + `!important` 胜出，且仅在不带激活类时命中）
- `.resource-module` margin-top 归零安全：无 Tab 场景仅 `sidebar-collapsed` 整体隐藏 body，margin 不参与布局

## 首轮 findings 与修复

| # | severity | finding | 修复 |
|---|---|---|---|
| A1 | non-blocking | 回归清单 §5.3 未映射到 checklist 任一步 | checklist 新增 s7 回归验证步骤（含自动连播/切源/art.resize） |
| C1 | non-blocking | 互斥规则特异性 "(1,2,0)" 仅对 `#episodesGridContainer` 分支成立，`.resource-module` 分支实际 (0,3,0) | design §4.3(2) 措辞修正为 id 分支 (1,2,0) / class 分支 (0,3,0)，注明均带 `!important` |

## 总评

首轮 `changes-requested`；两项 finding 均 non-blocking 且只涉文字/清单补全，不改变契约，按 focused closure 修复后闭合为 `passed`。design 与 checklist 现已对齐，可提交用户整体 review。
