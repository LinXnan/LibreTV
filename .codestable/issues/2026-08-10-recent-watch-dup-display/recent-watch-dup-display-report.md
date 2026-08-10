---
doc_type: issue-report
issue: 2026-08-10-recent-watch-dup-display
status: confirmed
issue_path: fast-track
severity: P3
summary: 首页最近观看历史条数较少时同一影片在视口内重复展示
tags: [recent-watch, carousel, clone, index-page]
---

# 首页最近观看重复展示 Issue Report

## 1. 问题现象

首页"最近观看"轮播区域，当观看历史记录较少（约 1~5 条）时，同一部影片会在同一屏内重复出现多次。例如只有 2 条历史时，界面上一部影片看起来出现 3 次。

## 2. 复现步骤

1. 清空观看历史，只保留 1~5 条记录（或新装环境只观看 1 部影片）。
2. 打开首页，查看"最近观看"轮播区域。
3. 观察到：同一部影片在视口内重复展示。

复现频率：稳定（历史条数少时必现）。

## 3. 期望 vs 实际

**期望行为**：每部影片在轮播中只出现一次；只有横向滚动到边缘时，无缝循环才将首尾影片衔接展示。

**实际行为**：历史条数少时，同一部影片同时多份出现在视口内，看起来像重复记录。

## 4. 环境信息

- 涉及模块 / 功能：首页最近观看轮播
- 相关文件 / 函数：`js/recent-watch.js` 的 `render()`（3 段式克隆）；`css/index.css` 的 `.recent-watch-track` / `.recent-watch-card`
- 运行环境：dev（本地 `npm run dev`）
- 其他上下文：数据层 `saveToHistory()`（`js/player.js:1533`）已按标题去重，历史面板不重复，可排除数据重复。

## 5. 严重程度

**P3** — 历史条数较少时的边界场景 UI 瑕疵，不阻塞使用，影响首页观感。

## 备注

根因（report 阶段读代码确认，供快速通道 fix 使用）：

- `js/recent-watch.js:124-126` `render()` 始终按"3 段式无缝循环"渲染：`track.innerHTML = hiddenHtml + itemsHtml + hiddenHtml`，S1/S3 是完整列表的视觉可见克隆（`aria-hidden` 只屏蔽读屏不隐藏视觉）。
- 卡片宽 180px（移动端 140px）+ 0.5rem gap；当一段真实内容的总宽度 ≤ 视口宽度时，克隆段在初始定位 `scrollLeft = scrollWidth/3` 后仍裸露在视口内 → 同一影片重复展示。
- 附带：`css/index.css:290-296` `.recent-watch-track > .recent-watch-card:first-child/last-child { margin: auto }` 在克隆模式下作用于 S1 首卡，可能加剧错位。

已批准方案（快速通道，用户已确认）：内容不足视口时改单段渲染不克隆；仅当可横向滚动时才 3 段克隆，并抑制克隆模式下的首尾 auto margin。
