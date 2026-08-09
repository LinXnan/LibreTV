---
doc_type: approval-report
unit: issues/2026-08-09-player-toast-above-player
status: approved
reason: route-choice
approvals:
  issue-fast-path: approved
  issue-fix-completion: approved
created_at: 2026-08-09
---

# Approval Report

## Decision History

- 2026-08-09：owner 批准快速通道修复方案（`issue-fast-path` approved）。
- 2026-08-09：独立 code review 通过（reviewer=subagent，round 6 `status: passed`），blocking REV-001/REV-005 与 important REV-008/REV-009 均已核验关闭。
- 2026-08-09：owner 确认修复完成（`issue-fix-completion` approved），随后按 scoped-commit 提交。

## Fix Completion Decision

修复已完成并通过独立 code review（reviewer=subagent，round 4 复审 `status: passed`，blocking REV-001 / REV-005 均已修复并核验关闭）：

- 改动文件：`css/player.css`、`player.html`、`js/ui.js`
  - 第一波：`.shortcut-hint` / `#toast` 统一到播放器上方居中（`body #toast` 特异性覆盖后加载的 `mobile-optimize.css`）。
  - 第二波（owner 反馈恢复位置提示未播放器居中）：三个提示框（快捷键 / Toast / 恢复位置）改为相对播放器容器 `#playerContainer` 绝对定位（`top:0; left:50%`），桌面分栏时水平对齐播放器中心；`#shortcutHint` 移入播放器容器；`ui.js` 在播放页把 Toast 挂到播放器容器内（首页无该容器保持原行为）。
  - round 3 修复：移动端补 `top:24px` 避让固定 header（移动端播放器容器顶部 60px+safe 低于 header 约 78px）。
- 验证：IDE lint 无错误；逻辑级推演通过；独立 Task agent 四轮审查（round 1/2/3/4）无未决 blocking/important。
- 遗留风险：移动端 `top:24px` 依赖 header 约 78px 的推导，裕量 6px，待浏览器实测移动端 header 真实高度；移动端 `.container.mx-auto` margin-top（44px+safe）与 header 高度的落差可能让播放器主内容顶部被遮（既有问题，非本次引入）；无自动化测试，依赖手动验证。

是否确认本次修复完成？

## Decision Needed

是否批准快速通道（fast-path）修复方案：把播放页快捷键提示（`.shortcut-hint`）与通用 Toast（`#toast`）的定位统一到"播放器上方居中"（`top: calc(88px + 16px)`，与既有 `.position-restore-hint` 一致）。

## Why Now

该问题为既有行为异常（提示框位置偏离），根因已通过读代码确认（纯 CSS 定位），修复点集中在 `css/player.css` 一处，满足快速通道条件，无需完整 analysis。

## Context

### 根因

1. **快捷键提示**：`css/player.css:280-296` 的 `.shortcut-hint` 使用 `top: 50%; transform: translate(-50%, -50%)`，将提示框垂直居中于视口（屏幕正中间）。该元素只在 `player.html` 使用（`js/player.js` `showShortcutHint`），无跨页影响。

2. **通用 Toast**：`js/ui.js:38,79` 与 `index.html:501` 的 `#toast` 使用 `fixed top-4`（视口顶部 16px），悬浮于播放页固定 header（z-index 9000）之上。`#toast` 为全局共享组件，首页 `top-4` 是合理位置，**不能全局改动**；但 `player.html` 单独加载 `player.css`，可在页内覆盖。

3. **既有基准**：`.position-restore-hint`（`css/player.css:200-221`）已实现"播放器上方居中"：`top: calc(88px + 16px)`（播放器容器顶部 = header 约 88px + main padding 16px），并含移动端 `env(safe-area-inset-top)` 适配。本次统一以此为准。

### 修复方案

只改 `css/player.css` 两处：

1. `.shortcut-hint`（约 280-296 行）：
   - `top: 50%` → `top: calc(88px + 16px)`
   - `transform: translate(-50%, -50%)` → `translateX(-50%)`（去掉垂直位移）

2. 新增播放页 `#toast` 定位覆盖（仅 `player.html` 加载 `player.css`，首页不受影响）：
   - `#toast { top: calc(88px + 16px) !important; }`

3. 移动端适配：在既有 `@media(max-width:640px)` 块内，为 `.shortcut-hint` 与 `#toast` 追加 `top: max(calc(88px + 16px), calc(88px + env(safe-area-inset-top) + 16px))`，与 `.position-restore-hint` 一致。

不动 `js/ui.js`、`index.html`（保护首页 Toast 位置）；`.error-container` 为播放器内部错误状态遮罩、`#loading` 播放流程不触发，均不属本次"轻量提示框"范围。

## Options

- A. 快速通道：按上述方案直接修复（推荐）
- B. 标准路径：先做正式根因分析（analysis）再修复
- C. 不改，接受当前位置不一致

## Recommendation

A。根因明确、修复点 ≤2 且局限于 `css/player.css` 单文件，与既有 `.position-restore-hint` 基准一致，无跨模块影响，符合快速通道条件。

## Risks And Tradeoffs

- `#toast` 覆盖用 `!important`，仅作用于播放页（`player.css` 只在 `player.html` 加载），首页不受影响。
- `.shortcut-hint` 为播放页专用元素，改动无跨页风险。
- 移动端 safe-area 与 `.position-restore-hint` 采用同一基准（88px），保持三类提示框位置一致。

## Non-Automatic Actions

不会自动提交 git commit；不会改动其他文件；不会执行其他重构。

## After You Answer

批准后：report 标记为 confirmed + fast-track，进入 fix 阶段改代码并写 fix-note。拒绝则改走标准路径（analyze）。
