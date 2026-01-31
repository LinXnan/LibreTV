# 移动端数据源设置卡片重构

## 变更概述

针对移动端主流操作习惯，重构设置面板中的数据源设置卡片，提升移动端用户体验的人性化程度。

## 背景与动机

### 当前问题

通过代码库分析（`index.html` 第 165-216 行，`js/app.js` 第 82-498 行），发现当前数据源设置卡片在移动端存在以下问题：

1. **触摸目标过小**
   - 复选框尺寸约 12x12px，远低于移动端推荐的 44x44px 最小触摸目标
   - 批量操作按钮间距过小，容易误触

2. **交互方式不符合移动端习惯**
   - 使用固定高度 `max-h-40` 的滚动区域，不够直观
   - 缺乏滑动删除等移动端常见手势
   - 自定义 API 的编辑/删除按钮过小（文字符号 ✎ ✕）

3. **信息密度过高**
   - 自定义 API 卡片在小屏幕上信息拥挤
   - 批量操作按钮横向排列，在小屏幕上换行混乱

4. **视觉反馈不足**
   - 选中状态不够明显
   - 缺乏触摸反馈动画

### 用户需求

移动端用户期望：
- 大触摸目标，易于点击
- 卡片化设计，清晰的视觉层次
- 支持滑动手势操作
- 明确的选中状态反馈
- 底部操作栏，符合拇指操作区

## 发现的约束条件

### 硬约束（技术限制）

1. **技术栈约束**
   - 必须使用 Tailwind CSS 框架
   - 数据存储在 localStorage（`selectedAPIs`, `customAPIs`）
   - 必须兼容现有的 `API_SITES` 配置结构
   - 必须保持桌面端功能不受影响

2. **功能约束**
   - 必须支持内置 API 和自定义 API 两种类型
   - 必须区分普通资源和成人资源（`api.adult` 属性）
   - 必须支持批量操作（全选/全不选/全选普通资源）
   - 必须显示已选 API 数量统计
   - 自定义 API 必须支持添加/编辑/删除操作
   - 必须支持 detail 地址配置（可选）

3. **集成约束**
   - 必须与现有的底部抽屉式面板系统集成（`mobile-panel-gestures.js`）
   - 必须与密码保护系统兼容
   - 必须与黄色内容过滤器联动（选中成人 API 时禁用过滤器）

### 软约束（设计偏好）

1. **设计风格**
   - 保持暗色主题（`bg-[#111]`, `bg-[#151515]`）
   - 使用渐变色强调（`from-indigo-500 via-purple-500 to-pink-500`）
   - 圆角设计（`rounded-lg`）
   - 保持与现有 UI 风格一致

2. **移动端优化**
   - 触摸目标至少 44x44px（已在 `mobile-optimize.css` 中定义）
   - 支持触摸反馈动画（`:active` 状态）
   - 隐藏滚动条（已在 `mobile-optimize.css` 中实现）
   - 适配安全区域（刘海屏、圆角屏）

3. **性能要求**
   - 避免过度动画（支持 `prefers-reduced-motion`）
   - 使用 CSS transform 而非 position 动画
   - 懒加载非关键内容

### 依赖关系

1. **前置依赖**
   - `js/config.js` - API 配置定义
   - `js/mobile-panel-gestures.js` - 手势系统
   - `css/mobile-optimize.css` - 移动端样式基础

2. **影响范围**
   - `index.html` - 设置面板 HTML 结构（第 165-216 行）
   - `js/app.js` - API 管理逻辑（第 82-498 行）
   - `css/mobile-optimize.css` - 可能需要新增样式

3. **风险点**
   - 修改 HTML 结构可能影响桌面端布局
   - 修改 JavaScript 逻辑可能影响 API 选择功能
   - 新增手势可能与现有手势冲突

## 成功标准

### 可验证的场景

#### 场景 1：触摸目标符合标准
**Given**: 用户在移动端打开设置面板
**When**: 查看数据源设置区域
**Then**:
- 所有可点击元素的触摸区域 ≥ 44x44px
- 使用 Chrome DevTools 的触摸模拟可以轻松点击任何元素
- 不会出现误触相邻元素的情况

#### 场景 2：卡片化设计清晰
**Given**: 用户在移动端查看 API 列表
**When**: 滚动浏览 API 源
**Then**:
- 每个 API 源显示为独立卡片
- 卡片间有明显间距（至少 8px）
- 选中状态有明显视觉反馈（边框/背景色变化）
- 卡片内信息层次清晰（名称、状态、操作按钮）

#### 场景 3：滑动删除自定义 API
**Given**: 用户添加了自定义 API
**When**: 在自定义 API 卡片上向左滑动
**Then**:
- 显示删除按钮（红色背景）
- 点击删除按钮后弹出确认提示
- 确认后从列表中移除该 API
- 支持向右滑动取消删除操作

#### 场景 4：底部操作栏易于操作
**Given**: 用户需要批量操作 API
**When**: 查看设置面板底部
**Then**:
- 批量操作按钮固定在底部（拇指易达区域）
- 按钮间距合理（至少 8px）
- 按钮高度 ≥ 44px
- 按钮文字清晰可读（字号 ≥ 14px）

#### 场景 5：添加自定义 API 流程优化
**Given**: 用户点击添加自定义 API 按钮
**When**: 进入添加流程
**Then**:
- 使用底部抽屉式表单（而非内联展开）
- 表单字段逐步引导输入
- 输入框高度 ≥ 44px
- 支持键盘自动弹出和收起
- 提交按钮固定在底部

#### 场景 6：桌面端功能不受影响
**Given**: 用户在桌面端打开设置面板
**When**: 操作数据源设置
**Then**:
- 保持原有的侧边栏布局
- 保持原有的复选框交互
- 保持原有的批量操作按钮位置
- 所有功能正常工作

### 性能指标

- 设置面板打开动画 < 400ms
- API 列表渲染时间 < 100ms（50 个 API）
- 滑动操作响应延迟 < 16ms（60fps）
- 内存占用增加 < 1MB

### 可访问性要求

- 所有交互元素支持键盘导航
- 使用语义化 HTML 标签
- 提供 ARIA 标签（`aria-label`, `aria-checked`）
- 支持屏幕阅读器

## 实施建议

### 阶段 1：HTML 结构重构
- 将 API 复选框改为卡片式布局
- 添加滑动删除容器
- 调整批量操作按钮位置

### 阶段 2：JavaScript 逻辑增强
- 实现滑动删除手势
- 优化卡片点击事件
- 添加底部抽屉式表单

### 阶段 3：CSS 样式优化
- 增大触摸目标
- 添加卡片样式
- 实现滑动动画

### 阶段 4：测试与优化
- 移动端真机测试
- 桌面端回归测试
- 性能优化

## 相关文件

- `index.html` - 设置面板 HTML（第 151-286 行）
- `js/app.js` - API 管理逻辑（第 82-498 行）
- `js/mobile-panel-gestures.js` - 手势系统
- `css/mobile-optimize.css` - 移动端样式

## 参考资料

- [Material Design - Touch Targets](https://material.io/design/usability/accessibility.html#layout-and-typography)
- [iOS Human Interface Guidelines - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/adaptivity-and-layout/)
- [WCAG 2.1 - Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
