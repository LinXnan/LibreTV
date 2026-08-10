---
doc_type: approval-report
unit: issues/2026-08-10-recent-watch-dup-display
status: approved
reason: fast-path
approvals:
  issue-fast-path: approved
approval_groups: {}
created_at: 2026-08-10
---

# Approval Report

## Decision History

- 2026-08-10：owner 确认复现条件（历史 1~5 条）、严重程度 P3，批准快速通道直接修复。ref: `approval-report.md#issue-fast-path`。

## Decision Needed

是否按快速通道直接修复"首页最近观看重复展示"？

## Why Now

根因已在 report 阶段通过读代码确认，修复点小（2 处），无跨模块风险，符合快速通道条件。

## Context

- 现象：历史记录少时同一影片在视口内重复展示。
- 根因：`js/recent-watch.js` `render()` 的 3 段式无缝克隆（S1/S3 视觉可见）在"一段内容宽度 ≤ 视口宽度"时裸露，导致同一影片重复出现；`css/index.css` 首尾 auto margin 在克隆模式下加剧错位。
- 数据层已按标题去重，非数据重复。

## Options

1. **快速通道直接修复**（推荐）：`render()` 内容不足视口时单段渲染；仅可滚动时才 3 段克隆，并加 `looping` 类抑制首尾 auto margin。
2. 走标准流程：先写完整根因分析再修复（本问题根因已明确，收益低）。

## Recommendation

选项 1：快速通道直接修复。改动仅 `js/recent-watch.js` + `css/index.css` 各一处。

## Risks And Tradeoffs

- 单段渲染时失去"末尾衔接开头"的无缝循环效果——但内容本身不足以填满视口，无需循环，此为正确行为。
- 视口宽度变化（响应式）下 `scrollWidth > clientWidth` 判断以渲染时为准；历史不变时 CSS 响应式宽度变化由重渲染兜底（已有 `popstate`/`updateRecentWatchVisibility` 触发 `render`）。

## Non-Automatic Actions

以下动作不会自动发生：不提交 git、不修改本 issue 范围外的文件、不顺手重构。

## After You Answer

已批准。进入 fix 阶段：修改 `js/recent-watch.js` 与 `css/index.css`，验证后写 fix-note 并进入 code review。
