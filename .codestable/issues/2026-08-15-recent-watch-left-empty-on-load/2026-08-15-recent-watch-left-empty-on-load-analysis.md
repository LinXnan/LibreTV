---
doc_type: issue-analysis
issue: 2026-08-15-recent-watch-left-empty-on-load
status: confirmed
root_cause_type: logic
related: [2026-08-15-recent-watch-left-empty-on-load-report.md]
tags: [recent-watch, animation, entrance-delay]
---

# 最近观看左侧空白加载延迟 根因分析

## 1. 问题定位

| 关键位置 | 说明 |
|---|---|
| `js/recent-watch.js:222-229` | `applyEntranceDelays(track)`：按卡片 **DOM index** 递增设置 `animationDelay = Math.min(index * 60, 800)ms` |
| `js/recent-watch.js:208` | `render()` 在 `updateCoverflow()` 之后调用 `applyEntranceDelays(track)` |
| `css/index.css:165` | `.recent-watch-card { animation: recent-watch-card-in 0.55s ... backwards; }` |
| `css/index.css:213-220` | `@keyframes recent-watch-card-in { from { opacity: 0 } to { opacity: 1 } }` |
| `js/recent-watch.js:99-124` | `updateCoverflow()`：`activeIndex=0` 时左侧卡片是 DOM 中 index 最大的几张（`delta` 为负） |

## 2. 失败路径还原

**正常路径**（期望）：渲染后所有卡片立即就位（占位符渐变 + 图标可见），封面图懒加载逐步替换。

**失败路径**（实际）：
1. `render()` 生成卡片 → `track.innerHTML` → `updateCoverflow` 排版（占位符本应立即可见）
2. `applyEntranceDelays` 给每张卡设置 `animationDelay = index * 60ms`（第 1 张 0ms，第 14 张起封顶 800ms）
3. CSS 动画 `recent-watch-card-in` 使用 **`backwards` 填充模式**：在 `animation-delay` 期间保持 `from { opacity: 0 }`，即**整个卡片（含占位符）完全透明**
4. 首屏时：中央卡（index 0）立即淡入；右侧卡（index 1、2、3，delay 60/120/180ms）随后出现；**左侧卡（index 4、5，delay 240/300ms）最后淡入**
5. 用户看到"中央 + 右侧已显示，左侧整片空白"，直到 delay 结束 + 0.55s 动画完成左侧才"加载出来"

**分叉点**：`js/recent-watch.js:227` — `animationDelay` 按 **DOM index**（= 历史顺序，最新在前）递增，而不是按**距中央槽位的视觉距离**；而 `activeIndex=0` 时左侧卡片恰是 index 最大的几张，透明时间最长。

## 3. 根因

**根因类型**：logic（动画延迟分配不对称）

**根因描述**：
最近观看轮播的入场动画延迟按卡片在 DOM 中的顺序（index）递增，而不是按卡片相对中央槽位的视觉距离。配合 CSS `backwards` 填充模式（delay 期间保持 `opacity: 0`），导致视觉上"中央 → 右侧 → 左侧"依次淡入。首屏加载时左侧槽位的卡片因 index 最大而透明最久（最多 800ms delay + 550ms 动画 ≈ 1.35s），用户感知为"左边空白，过一会才加载出来"。

**是否有多个根因**：否（封面图懒加载有占位符兜底，不是"空白"的原因；真正的空白是整卡 `opacity: 0`）

## 4. 影响面

- **影响范围**：首页"最近观看"轮播初次渲染的入场动画。历史 ≥ 2 条即有左右槽位；条数越多左侧延迟越明显
- **潜在受害模块**：仅 `recent-watch.js` 入场动画；不影响懒加载、切换、自动轮流、点击跳转。桌面/移动端均有此问题（同一条代码路径）
- **数据完整性风险**：无
- **严重程度复核**：**维持 P2**。属于首屏视觉瑕疵，不影响功能；但"左边空白"观感明显、稳定复现，值得修

## 5. 修复方案

### 方案 A：按距中央槽位的视觉距离分配延迟（推荐）
- **做什么**：`applyEntranceDelays` 不再用 DOM index，而是用与 `updateCoverflow` 相同的 delta 计算，取 `dist = |delta|`，`animationDelay = Math.min(dist * 80, 400)ms`。
  ```js
  const cards = track.querySelectorAll('.recent-watch-card:not([aria-hidden])');
  const count = cards.length;
  const half = Math.floor(count / 2);
  cards.forEach((card, i) => {
      let delta = ((i - activeIndex) % count + count) % count;
      if (delta > half) delta -= count;
      const dist = Math.abs(delta);
      card.style.animationDelay = `${Math.min(dist * 80, 400)}ms`;
  });
  ```
- **优点**：中央卡先出，左右两侧**对称**同时淡入，从中央向两侧扩散，无"左边空白"；保留层次感；改动仅 1 处函数
- **缺点 / 风险**：无。`backwards` 填充仍保留，但延迟不再有左右不对称
- **影响面**：仅 `js/recent-watch.js` 的 `applyEntranceDelays`，不影响其他模块

### 方案 B：去掉入场动画延迟（全部同时淡入）
- **做什么**：`applyEntranceDelays` 中全部设 `animationDelay = 0`（或直接不设）
- **优点**：改动最小（2 行）
- **缺点 / 风险**：丢失"中央先出、两侧次之"的层次感，所有卡片同时淡入观感较平
- **影响面**：仅 `js/recent-watch.js`

### 方案 C：对称延迟 + 封顶更小（变体 A）
- **做什么**：同方案 A，但 `Math.min(dist * 60, 300)ms`
- **优点**：总延迟更短，首屏更快完整
- **缺点 / 风险**：层次感略弱于 A
- **影响面**：仅 `js/recent-watch.js`

### 推荐方案

**推荐方案 A**。理由：改动范围最小且最直接——问题根源就是"延迟按 DOM index 而非视觉距离分配"，方案 A 精准修复不对称性，保留设计意图（中央凸显 + 层次淡入），无副作用；方案 B 虽最简单但丢失层次，方案 C 只是 A 的参数变体。
