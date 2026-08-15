---
doc_type: issue-fix
issue: 2026-08-15-history-clear-btn-overlap
status: confirmed
path: fast-track
fix_date: 2026-08-15
tags: [历史面板, 布局, CSS]
---

# 清空历史记录按钮与历史记录重叠 修复记录

## 1. 问题描述

历史记录面板中底部"清空历史记录"按钮与历史记录列表内容重叠，滚动时按钮悬浮盖在卡片上方。

## 2. 根因

- 桌面端 `.history-panel` 是整体 `overflow-y: scroll` 滚动容器（`css/styles.css:630`），未使用 flex 布局，头部、列表、底部按钮都在同一个滚动流中。
- 底部"清空历史记录"按钮容器用 `position: sticky; bottom: 0`（`index.html:144-148`），滚动时悬浮在可视区底部，历史记录卡片从按钮下方滚过 → 重叠遮挡。

## 3. 修复方案

桌面端与移动端现有布局对齐（移动端已是 flex column + `#historyList` 独立滚动）：

- `.history-panel` 改为 `display: flex; flex-direction: column; overflow: hidden`，面板不再整体滚动。
- `#historyList` 改为 `flex: 1; min-height: 0; overflow-y: auto`，列表独立滚动。
- 新增 `.history-panel > div:last-child { flex-shrink: 0 }`，底部按钮固定在面板底部，不再悬浮遮挡列表。
- 新增 `.history-panel > .flex { flex-shrink: 0 }`，头部标题行固定，极矮视口下不被压缩（review REV-001 important 项）。

纯 CSS 改动，无 JS / DOM 改动。

## 4. 改动文件清单

- `css/styles.css:630-663` — 桌面端历史面板布局改为 flex column，列表独立滚动，按钮固定在底部。

## 5. 验证结果

- lint 检查通过（read_lints 无诊断）。
- 移动端规则（`@media max-width:640px`）已有 `flex: 1 !important; min-height: 0 !important; overflow-y: auto !important` 覆盖，与本次桌面端基础规则一致，无冲突；`h-full` 固定高度父容器下 flex 子项 `flex:1 + min-height:0` 不会坍塌（对照沉淀 `2026-08-14-mobile-panel-mutex-active-class.md` 第 3 条，其坍塌场景是父容器 auto 高度）。
- 独立 code review（`2026-08-15-history-clear-btn-overlap-review.md`）通过：无 blocking；important 项（桌面端头部缺 `flex-shrink:0`）已修复。
- 待浏览器实测：桌面端历史列表滚动时按钮固定在底部不遮挡；移动端回归无异常。

## 6. 遗留事项

- 无。若后续调整面板容器结构，注意保持 flex column + 列表独立滚动。
