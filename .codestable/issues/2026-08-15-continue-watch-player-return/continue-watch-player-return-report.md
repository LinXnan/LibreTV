---
doc_type: issue-report
issue: 2026-08-15-continue-watch-player-return
status: confirmed
issue_path: fast-track # undecided | standard | fast-track
severity: P3
summary: 从播放页点 logo 回首页也会弹「继续观看」弹窗，应去掉
tags: [继续观看弹窗, player.html, 首页, 弹窗]
---

# 从播放页返回首页仍弹继续观看 Issue Report

## 1. 问题现象

在播放页（`player.html`）点击左上角 logo 回到首页时，首页仍会弹出「继续观看」弹窗（提示最近一次播放的影片）。该弹窗本意是"访问网站时"提醒，但从播放页主动返回首页时用户刚离开播放器，再弹此窗属打扰。

## 2. 复现步骤

1. 从首页进入任一影片的播放页（`player.html`）
2. 点击左上角 logo（OpenPlay 图标/标题）
3. 页面跳转回首页
4. 观察到：首页弹出「继续观看」弹窗

复现频率：稳定

## 3. 期望 vs 实际

**期望行为**：从播放页点击 logo 返回首页时，不弹「继续观看」弹窗（直接回到首页正常浏览）

**实际行为**：回到首页后仍弹出「继续观看」弹窗，需要手动关闭

## 4. 环境信息

- 涉及模块 / 功能：继续观看弹窗（`js/continue-watch.js`）+ 播放页首页跳转（`player.html` 内联脚本）
- 相关文件 / 函数：`js/continue-watch.js` 的 `showIfNeeded()`；`player.html` 的 `#homeButton` 点击处理（约 255-289 行）
- 运行环境：dev（`npm run dev`）
- 其他上下文：弹窗开关默认开启；`showIfNeeded` 在首页 `DOMContentLoaded` 无条件检查历史并弹出，不区分"直接访问首页"还是"从播放页返回"

## 5. 严重程度

**P3** — 非核心功能受损，仅交互打扰，用户可手动关闭（推荐值，待确认）

## 备注

- 播放页 logo 有两种跳转路径：iframe 嵌入场景调用父窗口 `closeVideoPlayer(true)`；独立打开场景 `window.location.href = '/'`，两条路径均会回到首页并触发弹窗
