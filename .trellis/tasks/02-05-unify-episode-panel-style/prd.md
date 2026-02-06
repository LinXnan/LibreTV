# 统一选集面板赛博朋克风格

## Overview
将播放页面的选集面板（`#episodeModal`）调整为与首页数据源设置页面相同的赛博朋克风格，实现整体视觉统一。保持所有现有功能不变，确保移动端和桌面端都具有一致的视觉体验。

## Requirements

### 样式统一范围
- [ ] **容器背景**：应用渐变背景 `linear-gradient(135deg, #0a0e1a 0%, #121829 100%)`
- [ ] **霓虹边框**：使用 `rgba(0, 159, 191, 0.2)` 实现柔和的霓虹蓝边框
- [ ] **多层阴影**：外阴影 + 霓虹光晕 + 内高光的三层叠加效果
- [ ] **扫光动画**：使用 `::before` 伪元素实现悬停时的光效扫过
- [ ] **集数按钮**：应用赛博朋克风格的按钮样式（渐变背景、霓虹边框、悬停发光）
- [ ] **Tab 分组栏**：统一 Tab 按钮的赛博朋克风格
- [ ] **标题样式**：使用 `.gradient-text` 类实现渐变文字效果

### 功能保持
- [ ] Tab 分组功能正常工作
- [ ] 移动端手势关闭（下拉关闭）功能保持
- [ ] 自动连播开关功能保持
- [ ] 排序功能（正序/倒序）保持
- [ ] 集数选择和播放功能保持
- [ ] 所有事件处理器（onclick 等）保持不变

### 平台适配
- [ ] **桌面端**：居中模态框样式，应用完整的赛博朋克效果
- [ ] **移动端**：底部抽屉式面板，保持拖拽指示器，应用赛博朋克风格
- [ ] 响应式布局保持正常（集数按钮网格自适应）

### Bug 修复
- [ ] **移动端定位问题**：修复面板飘到顶部的问题，确保使用 `position: fixed` 而非 `position: relative`
- [ ] **桌面端定位问题**：确保居中定位正常工作，使用 `position: fixed` 支持 `top: 50%` / `left: 50%` 居中

## Acceptance Criteria

- [ ] 选集面板具有明显的赛博朋克风格，与首页数据源设置区域视觉一致
- [ ] 霓虹边框和发光效果在深色背景下清晰可见
- [ ] 悬停状态有流畅的扫光动画和边框增强效果
- [ ] 所有现有功能（Tab 分组、手势关闭、自动连播、排序）完全正常
- [ ] 移动端和桌面端都有良好的视觉效果和交互体验
- [ ] 不影响页面其他部分的样式和功能
- [ ] 代码遵循项目的前端开发规范
- [ ] 无运行时错误，无样式冲突

## Technical Notes

### 参考样式来源
**index.html 中的 `.datasource-section`** (css/styles.css 第 435-459 行)：
```css
.datasource-section {
    position: relative;
    padding: 1.25rem;
    background: linear-gradient(135deg, #0a0e1a 0%, #121829 100%);
    border-radius: 12px;
    border: 1px solid rgba(0, 159, 191, 0.2);
    box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.5),
        0 0 15px rgba(0, 159, 191, 0.1),
        inset 0 1px 0 rgba(0, 159, 191, 0.1);
    overflow: hidden;
    transition: all 0.3s ease;
}

.datasource-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(0, 159, 191, 0.08), transparent);
    transition: left 0.6s ease;
    pointer-events: none;
}

.datasource-section:hover::before {
    left: 100%;
}
```

### 目标文件
**player.html** (第 245-291 行)：
- `#episodeModal`：主容器
- `.episode-modal-header`：头部区域
- `#episodeTabBar`：Tab 分组栏
- `.episode-list-group`：集数列表容器（第 285 行）
- `#episodeModalList`：集数按钮网格

### 需要修改的文件
1. **css/styles.css**
   - 新增 `#episodeModal` 的赛博朋克样式类
   - 新增集数按钮的赛博朋克样式
   - 新增 Tab 按钮的赛博朋克样式
   - 复用 `.datasource-section` 的样式模式

2. **css/mobile-optimize.css**
   - 调整移动端的 `#episodeModal.episode-panel` 样式
   - 确保赛博朋克风格在移动端也能正常显示
   - 保持拖拽指示器和底部抽屉式布局

3. **player.html** (可选)
   - 如需要，可以为容器添加额外的 CSS 类名
   - 确保不破坏现有的 ID 和事件处理器

### 颜色方案
- **主色调**：`#009fbf` (RGB: 0, 159, 191) - 柔和的霓虹蓝
- **透明度变体**：`rgba(0, 159, 191, x)` 其中 x 为 0.03 ~ 0.5
- **渐变背景起点**：`#0a0e1a` (深蓝黑)
- **渐变背景终点**：`#121829` (深靛蓝)

### 设计原则
- 使用现有的赛博朋克配色系统，保持视觉一致性
- 不破坏现有功能和交互逻辑
- 遵循项目的纯 JavaScript + Tailwind CSS 架构
- 注重性能，避免过度使用动画导致卡顿
- 移动端优先考虑触摸体验和手势交互

### 关键技术点
1. **扫光动画**：使用 `::before` 伪元素 + `pointer-events: none` 确保不影响交互
2. **多层阴影**：三层 box-shadow 叠加营造立体感
3. **响应式适配**：使用媒体查询区分移动端和桌面端样式
4. **功能保持**：只修改 CSS，不改变 HTML 结构和 JavaScript 逻辑

## Out of Scope
- 不修改选集面板的功能逻辑
- 不改变集数按钮的布局和数量
- 不调整移动端手势交互的实现方式
- 不修改其他页面或组件的样式
- 不添加新的动画效果（仅复用现有的扫光动画）
