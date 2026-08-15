---
doc_type: issue-report
issue: 2026-08-15-recent-watch-nav-mobile-jump
status: confirmed
issue_path: fast-track # undecided | standard | fast-track
severity: P3
summary: 移动端最近观看模块的左右切换按钮，点击后按钮位置会跳动/下移
tags: [mobile, recent-watch, css]
---

# 移动端最近观看左右按钮点击后位置跳动 Issue Report

## 1. 问题现象

移动端（≤640px）首页"最近观看"轮播模块中，左右切换按钮（`recentWatchPrevBtn` / `recentWatchNextBtn`）在点击时会移动位置——按钮从轨道两侧垂直居中的位置向下跳动约半个按钮高度，部分情况下跳下后不会自动恢复。

## 2. 复现步骤

1. 移动端浏览器（≤640px）打开首页
2. 观看历史 ≥ 2 条，使最近观看轮播显示左右切换按钮
3. 点击"上一部"或"下一部"按钮
4. 观察到：按钮位置跳动/下移

复现频率：稳定（点击即触发）

## 3. 期望 vs 实际

**期望行为**：左右切换按钮始终固定在轨道两侧垂直居中，点击时仅呈现轻微缩放/压暗的触摸反馈，不改变按钮自身位置。

**实际行为**：点击瞬间按钮垂直定位丢失、向下跳动约半高（约 16px）；在触摸设备上点击后 `:hover` 状态持续期间，按钮可能保持下移位置，需点击页面其他位置才恢复。

## 4. 环境信息

- 涉及模块 / 功能：首页"最近观看"轮播（`recent-watch`）
- 相关文件 / 函数：
  - `css/index.css:119-145` — `.recent-watch-nav` 定位（`top: 50%` + `transform: translateY(-50%)`）
  - `css/mobile-optimize.css:268-289` — 全局移动端触摸反馈（`button:active` / `button:hover` 覆盖 transform）
- 运行环境：dev（http://localhost:8080）
- 其他上下文：左右按钮为 2026-08-15 `8af57ac` 提交新增，此问题疑似该次改动引入

## 5. 严重程度

**P3** — UI 瑕疵，不影响轮播切换功能本身，仅影响移动端按钮视觉稳定性。

## 备注

待用户确认：跳下后是"点击瞬间跳一下弹回"还是"跳下后保持住直到点击别处"（推测与设备 `:hover` 行为有关）。
