# 移动端面板互斥显隐：单一激活类 + 高特异性覆盖，替代"展开态类 + JS 高度同步"

## 背景

LibreTV 播放页移动端（≤640px）"选集/视频源"从"外层展开/收起按钮 + 两面板并排 + JS 等高同步"改造为"Tab 页切换 + 默认直接展示"。旧方案用 `.mobile-panel-open` 展开态类 + `syncMobilePanelHeight`（ResizeObserver 等高）——两面板同时可见、靠 JS 测量同步高度；新方案两面板互斥可见、无等高需求。

改造成 UX 与代码结构双重简化，踩了两个可复用的布局坑（网格高度坍塌、断点残留），值得沉淀。

## 结论

1. **互斥显隐用单一激活类（`is-tab-active`）**：两个面板同一时刻只有一个带 `is-tab-active`，CSS 用 `:not(.is-tab-active)` 隐藏另一个。JS 只做 `classList.toggle`，不触碰面板内部渲染逻辑；HTML 静态给默认面板预置激活类，无 JS 或 init 延迟时默认面板仍可见（兜底）。
2. **互斥规则需高特异性选择器前缀覆盖既有 `display:none`**：`.player-sidebar-body #episodesGridContainer:not(.is-tab-active)` 特异性 (1,2,0) 覆盖既有 `#episodesGridContainer { display:none }` 的 (1,0,0)。若只写裸 `.is-tab-active` 类会被 `!important` 的既有规则压过。
3. **父容器无固定高度时，子元素 `flex: 1 1 0 + max-height: none` 会坍塌为 0**：桌面分栏时 `.player-sidebar-body` 有固定高度可撑开 flex 子项；移动端 `.player-sidebar-body` 是内容撑高的 auto 高度，选集网格 `flex: 1 1 0` 无伸展空间 → 网格高度为 0（集数"显示分页但网格空白"）。移动端必须给网格**显式高度上限**（`max-height: 40vh + overflow-y: auto`）而非依赖 flex 伸展。
4. **断点切换用 `matchMedia` change 监听清理激活类，不靠 resize 计算**：`(max-width: 640px)` / `(min-width: 641px)` 两个独立监听器；进入桌面清理面板类（Tab 栏 CSS 隐藏），回到移动端重置默认激活。避免跨断点残留类导致侧栏污染。

## 证据

- `js/mobile-panel-tabs.js` — 模块全部逻辑：`activate()` 切换 `is-tab-active`、`cleanup()` 断点清理、`matchMedia` 监听
- `css/player.css` 移动端块 — `:not(.is-tab-active)` 互斥规则、`#episodesGridContainer` 默认 flex、`.episode-grid { max-height: 40vh; overflow-y: auto }`
- `player.html` — `#mobilePanelTabs` Tab 容器 + `#episodesGridContainer` 静态预置 `is-tab-active`
- `.codestable/features/2026-08-14-mobile-episode-resource-tabs/mobile-episode-resource-tabs-acceptance.md` — M1 失败（网格坍塌 0 高）→ 修复 `max-height` 后用户复测通过
- 取代了 `.codestable/compound/2026-08-08-mobile-player-panels.md` 中的等高方案（`syncMobilePanelHeight` 已随展开按钮一并删除）
