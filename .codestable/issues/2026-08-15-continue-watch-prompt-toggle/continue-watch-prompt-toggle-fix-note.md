---
doc_type: issue-fix
issue: 2026-08-15-continue-watch-prompt-toggle
status: confirmed
path: fast-track
fix_date: 2026-08-15
tags: [settings, toggle, css]
---

# 继续观看弹窗开关无法点击 修复记录

## 1. 问题描述

首页设置面板「继续观看弹窗」开关点击后无任何视觉变化（圆点不滑动、背景不变色），用户感知为"无法点击"；同面板其他开关（黄色内容过滤 / 分片广告过滤）正常。

## 2. 根因

`css/styles.css` 的开关 `:checked` 视觉样式（第 368-410 行）只覆盖了 `#yellowFilterToggle` 和 `#adFilterToggle` 两个选择器。提交 `eccd26a`（2026-08-15 "首页继续观看弹窗"）新增 `continueWatchPromptToggle` 开关时只改了 `index.html`（HTML 结构）与 `js/app.js`（初始化 + change 事件），**未补充对应的 CSS `:checked` 样式**。

开关 checkbox 本身的点击状态切换与 `localStorage` 写入（`js/app.js:710-715`）实际正常，纯属视觉反馈缺失，表现为"点了没反应"。

## 3. 修复方案

在 `css/styles.css` 的 `#adFilterToggle` 样式块之后，为 `#continueWatchPromptToggle` 补齐与其他开关同款的 4 组规则：`:checked + .toggle-bg` 背景高亮、`:checked ~ .toggle-dot` 圆点右移、`:focus/:hover + .toggle-bg` 光晕、`:checked ~ .toggle-dot` 发光。纯 CSS 追加，1 处。

## 4. 改动文件清单

- `css/styles.css:395-411` — 新增 `#continueWatchPromptToggle` 的 `:checked` / `:focus` / `:hover` 样式块

## 5. 验证结果

- [x] CSS lint 通过（read_lints 0 错误）
- [x] 样式与 `#yellowFilterToggle` / `#adFilterToggle` 逐条对齐（背景 `var(--primary-color)`、位移 `translateX(1.5rem)`、光晕 `rgba(0, 204, 255, 0.3)`）
- [x] 选择器与 `index.html:269` 的 `id="continueWatchPromptToggle"` 一致，且 `+` / `~` 相邻兄弟选择器匹配 DOM 结构（input → .toggle-bg → .toggle-dot）
- [x] 未触碰分析范围外文件，未引入新抽象/新结构

浏览器验证：需用户本地 `npm run dev` 后打开首页 → 设置面板 → 点击「继续观看弹窗」开关确认视觉反馈，并将结果反馈以完成最终验收。

## 6. 遗留事项

- **顺手发现（不在本次范围）**：`doubanToggle`（豆瓣热门推荐开关，`index.html:256`）同样缺少 `:checked` 视觉样式（CSS 全文件无 `doubanToggle` 选择器，遗漏可追溯至 2025-04 提交 `20f3c8d`）。存在同类"点击无视觉反馈"问题，建议另开 issue 处理。
- 浏览器实测待用户确认后关闭本 issue。
