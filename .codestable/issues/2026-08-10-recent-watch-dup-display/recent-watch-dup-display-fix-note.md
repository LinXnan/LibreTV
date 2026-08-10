---
doc_type: issue-fix
issue: 2026-08-10-recent-watch-dup-display
status: confirmed
path: fast-track
fix_date: 2026-08-10
tags: [recent-watch, carousel, clone, index-page]
---

# 首页最近观看重复展示 修复记录

## 1. 问题描述

首页"最近观看"轮播在观看历史条数较少（约 1~5 条）时，同一部影片在同一屏内重复出现多次。

## 2. 根因

`js/recent-watch.js` 的 `render()`（原 124-126 行）无条件按"3 段式无缝循环"渲染：`track.innerHTML = hiddenHtml + itemsHtml + hiddenHtml`，S1/S3 是完整列表的**视觉可见**克隆（`aria-hidden` 只屏蔽读屏不隐藏视觉）。卡片宽 180px + 0.5rem gap，当一段真实内容总宽 ≤ 视口宽（历史条数少时）且 `scrollLeft = scrollWidth/3` 定位到中段后，前后克隆段仍裸露在视口内，同一影片因此重复展示。

数据层 `saveToHistory()`（`js/player.js:1533`）已按标题去重，历史面板不重复，可排除数据重复。

## 3. 修复方案

按内容宽度决定是否启用无缝循环克隆：

- 先以**单段**渲染并测量 `track.scrollWidth > track.clientWidth + 1`。
- 内容**可横向滚动**（历史够多）时，维持原 3 段式无缝克隆，行为与修复前完全一致。
- 内容**不足视口**（历史少）时，改为单段展示：同一影片只出现一次，首尾 `auto margin`（`css/index.css:290-296`，注释明确"内容溢出时自动归零"，3 段克隆模式下本就归零，无需改 CSS）使卡片居中。

## 4. 改动文件清单

仅 `js/recent-watch.js` 的 `render()` 一处：

- 120-121 行：新增注释 + 将 `applyVisibility()` 提前到测量前调用——`display:none` 下 `scrollWidth/clientWidth` 均为 0，首次渲染时 `recentWatchArea` 默认隐藏，必须先显示才能测得真实宽度。
- 123-125 行：先单段渲染 `itemsHtml`，以 `scrollWidth > clientWidth + 1` 判定 `needsLoop`。
- 127-140 行：`needsLoop` 为真走原 3 段克隆 + `refreshCarousel()`（自动轮播）；为假走单段展示 + `scrollLeft = 0` + `stopAutoScroll()`（内容不足视口时自动轮播无意义，滚动目标均在可视区内）。

## 5. 验证结果

- 语法检查：`node --check js/recent-watch.js` 通过；IDE lint 无新增错误。
- 逻辑级推演：
  1. 历史 1~5 条（一段 ≤ 视口）：`needsLoop=false` → 单段展示，同一影片仅出现一次，问题不再复现。
  2. 历史 ≥ 6 条（如 10 条，约 1880px > 视口 1260px）：`needsLoop=true` → 3 段克隆，无缝循环与自动轮播行为与修复前一致。
  3. 首次渲染隐藏测量：`applyVisibility()` 提前到测量前，`recentWatchArea` 从 `hidden` 变为可见后再测量，避免 `display:none` 下误判。
  4. 单段模式下 `mouseleave` 会再次 `startAutoScroll`，但 `scrollWidth ≤ clientWidth` 时 `scrollTo` 无法移动，无视觉影响（非阻断）。
  5. `scrollByStep` 的 `third = scrollWidth/3` 仅在 3 段克隆（`needsLoop=true`）时被自动轮播调用，逻辑不受影响。
- 待浏览器验证（attention.md 硬要求，无自动化测试）：本地 `npm run dev` → 清空历史只留 1~2 条 → 首页确认同一影片只展示一次；再积累 10 条 → 确认无缝循环轮播仍正常。

## 6. 遗留事项

- 窗口 `resize` 不触发 `render`（既有行为）：超宽屏下历史不足视口时保持单段，超宽屏需要重新触发 `render` 的场景（搜索切换/前进后退/历史变更）均已有调用路径，不属本次范围。
- 单段模式无"末尾衔接开头"循环效果：内容不足视口时本就无需循环，属正确行为。
- 无自动化测试，依赖浏览器手动验证。
