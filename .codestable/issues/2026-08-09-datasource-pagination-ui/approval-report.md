---
doc_type: approval-report
unit: issues/2026-08-09-datasource-pagination-ui
status: approved
reason: issue-fix-completion
approvals:
  issue-fast-path: approved
  issue-fix-completion: approved
created_at: 2026-08-09
---

# Approval Report

## Decision History

- 2026-08-09：owner 批准快速通道修复方案（`issue-fast-path` approved）。
- 2026-08-09：owner 确认修复完成（`issue-fix-completion` approved）。

## Decision Needed

是否批准快速通道修复方案：去掉数据源面板分页信息中的"每页 N 个"字眼；PC 端点击下一页时不再自动滚动面板。

## Why Now

两个问题均为既有行为异常，根因已通过读代码确认，修复点共 2 处且集中于 `js/app.js` 同一模块，无跨模块影响，满足快速通道条件，无需完整 analysis。

## Context

### 根因

**问题 1（多余字眼）**：`js/app.js:132` 分页信息行直接拼接了"每页 N 个"：

```javascript
info.textContent = `第 ${apiPage}/${totalPages} 页 · 每页 ${API_PAGE_SIZE} 个`;
```

**问题 2（PC 端翻页跳动）**：`js/app.js:154-159` 的 `changeApiPage()` 在翻页重建 DOM 后无条件执行平滑滚动到 API 列表顶部：

```javascript
const panel = document.getElementById('settingsPanel');
const anchor = document.getElementById('apiCheckboxes');
if (panel && anchor && typeof panel.scrollTo === 'function') {
    panel.scrollTo({ top: anchor.offsetTop - 24, behavior: 'smooth' });
}
```

PC 端（窗口宽度 > 640px）点击位于列表下方的"下一页"按钮时，该逻辑将整个面板平滑滚回 API 列表顶部，表现为"面板往上跳"。

### 修复方案

1. `js/app.js:132`：信息行改为只显示 `第 ${apiPage}/${totalPages} 页`，去掉 `· 每页 ${API_PAGE_SIZE} 个`。
2. `js/app.js:154-159`：滚动逻辑限定为仅移动端（`window.innerWidth <= 640`）执行，PC 端翻页后保持原滚动位置，不再跳动。与 `toggleSettings()` 等现有移动端/桌面端区分判断保持一致。

## Options

- A. 快速通道：按上述方案直接修复（推荐）
- B. 标准路径：先做正式根因分析（analysis）再修复
- C. 不改，接受当前文案与跳动行为

## Recommendation

A。根因明确、修复点 ≤2 且局限于 `js/app.js` 数据源面板模块，无跨模块影响，符合快速通道条件。

## Risks And Tradeoffs

- 移动端翻页后仍会滚动到 API 列表顶部（保留原行为），仅 PC 端不再滚动；若移动端原滚动本属多余，可在后续单独评估。
- 改动仅限文案字符串与滚动条件，不影响分页数据、勾选状态与冒泡处理。

## Non-Automatic Actions

不会自动提交 git commit；不会改动其他文件；不会执行其他重构。

## After You Answer

批准后：report 标记为 confirmed + fast-track，进入 fix 阶段改代码并写 fix-note。拒绝则改走标准路径（analyze）。
