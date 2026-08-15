---
doc_type: issue-fix
issue: 2026-08-15-recent-watch-nav-mobile-jump
status: confirmed
path: fast-track
fix_date: 2026-08-15
tags: [mobile, recent-watch, css]
---

# 移动端最近观看左右按钮点击后位置跳动 修复记录

## 1. 问题描述

移动端（≤640px）首页"最近观看"轮播的左右切换按钮，点击时按钮从轨道两侧垂直居中位置向下跳动约半个按钮高度；触摸设备上点击后 `:hover` 状态持续期间按钮可能保持下移，需点击别处才恢复。

## 2. 根因

`css/mobile-optimize.css` 的全局移动端触摸反馈样式覆盖了 `.recent-watch-nav` 的垂直定位：

- `css/mobile-optimize.css:270-275`（`@media (max-width: 640px)`）`button:active { transform: scale(0.98) }`（特异性 0,1,1）在按下时覆盖 `.recent-watch-nav { transform: translateY(-50%) }`（特异性 0,1,0，`css/index.css:119-122`），`translateY(-50%)` 垂直居中偏移丢失 → 按钮向下跳。
- `css/mobile-optimize.css:283-285`（`@media (hover: none)`）`button:hover { transform: none }` 同样覆盖垂直定位；触摸设备点击后 `:hover` 持续期间按钮保持下移。

## 3. 修复方案

在 `css/index.css` 的移动端媒体查询块（`@media (max-width: 640px)`）内，为 `.recent-watch-nav` 显式声明 `:hover` / `:active` 的 transform，以更高特异性（0,2,0）保留 `translateY(-50%)` 垂直居中，`:active` 仅叠加 `scale(0.95)` 缩放反馈，按钮中心位置不变。

## 4. 改动文件清单

- `css/index.css` — 移动端媒体查询块内新增：
  ```css
  .recent-watch-nav:hover {
      transform: translateY(-50%);
  }
  .recent-watch-nav:active {
      transform: translateY(-50%) scale(0.95);
  }
  ```
- `.codestable/issues/2026-08-15-recent-watch-nav-mobile-jump/2026-08-15-recent-watch-nav-mobile-jump-report.md` — status → confirmed，issue_path → fast-track
- `.codestable/issues/2026-08-15-recent-watch-nav-mobile-jump/approval-report.md` — issue-fast-path → approved

## 5. 验证结果

- 特异性静态核对：`.recent-watch-nav:active`（0,2,0）> `button:active`（0,1,1）、`.recent-watch-nav:hover`（0,2,0）> `button:hover`（0,1,1），且规则在 `@media (max-width: 640px)` 内，桌面端不受影响。
- lint 检查通过（0 错误）。
- 浏览器验证（用户确认）：移动端刷新后点击左右按钮，按钮保持垂直居中、不再下移，点击切换功能正常。

## 6. 遗留事项

无。桌面端（>640px）无此问题，`hover` 状态不涉及。
