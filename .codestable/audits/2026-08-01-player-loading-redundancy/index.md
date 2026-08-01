---
doc_type: audit-index
date: 2026-08-01
slug: player-loading-redundancy
scope:
  - js/player.js
  - player.html
  - js/watch.js
dimensions: [bug, performance, maintainability]
status: resolved
---

# 审计：播放页加载动作冗余

## 范围

- `js/player.js`（~3000 行，播放器初始化与 HLS 管理）
- `player.html`（DOM 中的 loading 元素与遮罩）
- `js/watch.js`（重定向中转页）

## 总评

存在**显著的加载动作冗余**。`#player-loading` 这一个 DOM 元素在 `player.js` 中被至少 **8 处独立逻辑**反复操作 `style.display`，其中多处监听同一事件、职责重叠、触发顺序互相打架。同时页面存在 **3 个相互独立的全屏 loading 遮罩**（`#style-loader` / `#player-loading` / `#loading`），启动期叠加显示。换集时还会**重写 loading 元素的 innerHTML**，把进度条 DOM 一并清掉，导致后续集数进度条失效。

## 解决方式

最终采用**删除自定义 loading 层**的方案：移除 `#player-loading` 及其全部 JS/CSS 配套代码，播放加载状态完全由 ArtPlayer 自带的 loading indicator 管理。相比"统一入口 + 修 bug"的方案更彻底——直接消除第二 loading 层的存在，同时自然消解全部 5 条发现。

## 发现清单

| ID | 性质 | 严重度 | 置信度 | 概要 | 处理结果 |
|---|---|---|---|---|---|
| 01 | bug | P1 | high | `playing` 事件被注册 3 次，3 处各自隐藏 loading，逻辑重复且竞态 | ✅ 已消解：`#player-loading` 整体移除 |