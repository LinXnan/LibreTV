---
doc_type: issue-report
issue: 2026-08-09-recent-watch-episode-mismatch
status: confirmed
issue_path: fast-track
severity: P2
summary: 从首页"最近观看"轮播进入播放页时，集数列表读到上一次播放的 localStorage 数据，显示不正确
tags: [player, history, recent-watch, localStorage]
---

# 最近观看进入播放页集数显示不正确 Issue Report

## 1. 问题现象

从首页"最近观看"轮播点击某部剧进入播放页后，播放页的集数列表 / 集数总数（如"第 X/Y 集"）显示的不是该剧的集数，而是**上一次播放的其他剧（或其他源）**的集数。

## 2. 复现步骤

1. 播放一部 40 集的剧 A（任意源），产生观看历史记录
2. 再播放一部 10 集的剧 B（任意源），等待其写入观看历史
3. 返回首页，从"最近观看"轮播点击剧 A 的卡片进入播放页

观察到：播放页顶部显示"第 1/10 集"（应为 1/40），集数按钮列表也只有剧 B 的 10 集。

复现频率：稳定（需先看过 2 部不同集数的剧）。

## 3. 期望 vs 实际

**期望行为**：从最近观看进入剧 A 播放页时，集数列表与历史记录中剧 A 保存的 `episodes` 一致（40 集），当前集高亮。

**实际行为**：播放页从 `localStorage.currentEpisodes` 读到剧 B 的 10 集，集数显示、切集、连播全部基于错误列表。

## 4. 环境信息

- 涉及模块 / 功能：首页最近观看轮播 → 播放页集数恢复链路
- 相关文件 / 函数：
  - `js/recent-watch.js`：`bindCarouselControls` 点击/键盘跳转直接 `navigateTo(item.url)`，不同步集数
  - `js/player.js`：`initializePageContent()`（约 252-261 行）URL 无 `episodes` 参数时回退读 `localStorage.currentEpisodes`
  - `js/player.js`：`saveToHistory()`（约 1541 行）生成的历史 URL 不含 `episodes` 参数（对比 `ui.js` 的 `playFromHistory` 在跳转前会写 `currentEpisodes`）
- 运行环境：dev（本地 npm run dev）
- 其他上下文：无数据库，localStorage 持久化；`ui.js` 历史记录列表入口已正确同步集数，仅首页最近观看轮播入口缺失

## 5. 严重程度

**P2** — 核心使用路径受损：用户从最近观看恢复追剧时集数列表错误，直接影响选集与自动连播，但可绕开（回搜索页重新进入）。
