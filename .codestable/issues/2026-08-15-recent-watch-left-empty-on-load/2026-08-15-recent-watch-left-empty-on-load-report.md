---
doc_type: issue-report
issue: 2026-08-15-recent-watch-left-empty-on-load
status: confirmed
issue_path: standard # undecided | standard | fast-track
severity: P2
summary: 首页"最近观看"模块初次加载时，左侧槽位长时间空白，等一会内容才出现
tags: [recent-watch, layout, lazy-load]
---

# 最近观看左侧空白加载延迟 Issue Report

## 1. 问题现象

首页初次加载（有 `viewingHistory` 的情况）"最近观看"轮播模块：

- 模块标题"最近观看"立即显示在最左侧
- 右侧槽位（中央卡 + 右侧 1~2 张）相对快速显示
- **左侧槽位长时间空白**——一段时间后（约 1~2 秒）才"加载出来"

用户截图证据（用户提供）：

- 共 4 张卡片可见：中央大卡（"庆余年"）+ 右侧 3 张小卡（"爱情公寓"、"潜龙楼"、"Fuel..."）
- 左侧完全没有卡片显示（按当前 activeIndex=0 分布算法，左侧应有 1 张 i=3 的卡片在 translateX(-210) 处）
- 标题"最近观看"在最左侧，下方是大片空白直到右侧卡片开始

## 2. 复现步骤

1. 浏览器中打开首页（OpenPlay，`http://localhost:8080`）
2. 确保 `localStorage.viewingHistory` 有 ≥ 4 条历史记录
3. **刷新页面**（首次加载）
4. 观察到：左侧空白；等待约 1~2 秒后左侧卡片才出现

复现频率：稳定（每次刷新均可观察到）

## 3. 期望 vs 实际

**期望行为**：刷新首页时，"最近观看"轮播 4 张卡片应当同时就位——按当前 `activeIndex=0` 分布，应呈现"左侧 1 张（小）— 中央 1 张（大）— 右侧 2 张（小）"的对称 Coverflow 布局，无空白间隙。

**实际行为**：刷新首页时，左侧槽位长时间保持空白，右侧 3 张卡片（中央大卡 + 右侧 2 张）相对及时就位；约 1~2 秒后左侧卡片才出现。

## 4. 环境信息

- 涉及模块 / 功能：首页"最近观看"轮播（Coverflow 焦点流）
- 相关文件 / 函数：
  - `js/recent-watch.js:134-219`（`render()` 同步流程：`applyVisibility()` → `track.innerHTML` → `updateCoverflow()` → `applyEntranceDelays()`）
  - `js/recent-watch.js:99-124`（`updateCoverflow(track)`，按 activeIndex=0 计算 delta 与 transform）
  - `js/recent-watch.js:178-181`（占位符底层 + `<img data-src class="lazy-load recent-watch-cover-img">` 覆盖层）
  - `js/utils.js:212-335`（`LazyImageLoader` 通过 `IntersectionObserver` + `rootMargin: '50px'` 接管懒加载）
  - `js/optimize-apply.js:13-34`（`MutationObserver` 在 DOM 变化时把新插入的 `img[data-src]` 交给 `lazyImageLoader.observe`）
  - `css/index.css:147-198`（`.recent-watch-card` 定位 / `.recent-watch-placeholder` 占位符 / `.recent-watch-cover-img` 覆盖）
- 运行环境：dev（http://localhost:8080）
- 其他上下文：桌面浏览器，窗口宽度估计 1280~1400px（OpenPlay 标题居中显示）。CSS 中 `.mx-auto max-w-screen-xl px-2` 容器宽 1280px 居中。`recent-watch-track` 高度 350px，`overflow: hidden`。

## 5. 严重程度

**P2** — UI 瑕疵，不影响轮播功能本身（点击/键盘交互、自动轮流、跳转都正常），但初次加载时左侧明显空白产生视觉割裂感，影响首屏观感；用户会误以为"左侧还没加载完"。

## 备注

- 截图由用户提供，已确认中央卡 + 右侧 3 张卡可见，左侧完全空白
- 截图符合"4 张卡 activeIndex=0 应为 左1 + 中央1 + 右2"——左侧第 4 张卡（i=3, delta=-1, translateX(-210)）缺失/延迟
- 根因候选（待阶段 2 analyze 确认）：
  - **LazyImageLoader 时序**：img 标签没有 src，依赖 IntersectionObserver 触发后由 `handleIntersection` 设置 src；左侧卡在 track 中心向左 210px 处，可能与 rootMargin: '50px' / 视口边界存在边缘情况
  - **占位符 + 覆盖层结构**：`.recent-watch-placeholder`（底层渐变）应默认显示，但若 JS 给 `<div class="recent-watch-cover">` 设置了 `display: none` 或 transform 异常会一起隐藏
  - **CSS 覆盖**：可能某个全局规则（如 `.mx-auto max-w-screen-xl` 外层）导致左侧卡片 `clip` / 不可见
  - **`activeIndex` 起始值 / `applyEntranceDelays` 动画**：入场动画 `animationDelay: index * 60ms` —— 若 i=3 第 4 张卡延迟到 `3*60=180ms` 才 `opacity: 0→1`，但用户描述是 1~2 秒级延迟，与该变量不符

> 本节仅作 issue 登记线索，根因验证在阶段 2 analyze。