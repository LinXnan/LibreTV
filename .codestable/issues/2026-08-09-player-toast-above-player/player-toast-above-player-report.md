---
doc_type: issue-report
issue: 2026-08-09-player-toast-above-player
status: confirmed
issue_path: fast-track
severity: P3
summary: 播放页部分提示框显示在屏幕中间/视口顶部，未统一到播放器上方居中
tags: [player, ui, toast, css]
---

# 播放页提示框未在播放器上方居中 Issue Report

## 1. 问题现象

播放页的轻量提示框位置不统一：

- **快捷键提示**（`#shortcutHint`，按方向键/空格/`F` 等触发，如"快进/音量+/播放暂停"）：显示在**屏幕正中间**（`top: 50%`），遮挡视频画面中心。
- **通用 Toast**（`#toast`，如"切换资源失败""未找到播放资源"）：显示在**视口最顶部**（`top: 16px`），悬浮在固定 header 之上。

用户期望：播放页**所有提示框**统一显示在**播放器上方居中**（即固定 header 下方、播放器容器顶部区域），而不是屏幕中间或视口顶部。

## 2. 复现步骤

1. 进入任意播放页，开始播放
2. 按方向键（如 `→` 快进）→ 快捷键提示出现在屏幕正中间
3. 触发一次失败 Toast（如切到一个无效资源源）→ 红色提示出现在屏幕最顶部，盖在 header 上

复现频率：稳定（每次触发均如此）。

## 3. 期望 vs 实际

**期望行为**：播放页所有提示框（快捷键提示、通用 Toast、恢复位置提示、广告过滤胶囊）统一出现在播放器上方、水平居中，不遮挡画面中心也不悬浮于 header 之上。

**实际行为**：

| 提示框 | 当前定位 | 是否符合 |
|---|---|---|
| `#shortcutHint` 快捷键提示 | `top: 50%`（屏幕正中） | ❌ |
| `#toast` 通用提示 | `top: 16px`（视口顶部，header 之上） | ❌ |
| `.position-restore-hint` 恢复位置 | `top: calc(88px + 16px)`（播放器上方） | ✅ |
| `#adFilterStats` 广告过滤胶囊 | 播放器内顶部居中 | ✅ |

## 4. 环境信息

- 涉及模块 / 功能：播放页提示框定位
- 相关文件：
  - `css/player.css` — `.shortcut-hint`（约 280-296 行）`top: 50%` 屏幕居中
  - `js/ui.js` — `showToast`（约 38、79 行）`fixed top-4` 视口顶部；`index.html:501` 同款静态定义
  - `css/player.css` — `.position-restore-hint`（约 200-221 行）已实现的"播放器上方居中"基准
- 运行环境：dev（本地 npm run dev）
- 其他上下文：`player.html` 单独加载 `player.css`，首页不加载；`#toast` 为全局共享组件（首页 `top-4` 合理），播放页需页内覆盖

## 5. 严重程度

**P3** — 纯视觉/交互位置问题：提示框可读、不阻碍功能，但遮挡画面中心且与既有"播放器上方居中"风格不一致，影响播放体验。
