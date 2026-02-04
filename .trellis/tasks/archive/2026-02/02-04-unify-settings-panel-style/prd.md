# 统一设置面板样式风格

## Background

数据源设置区域已完成赛博朋克风格改造（commit a85fbcf），将蓝色从 #00ccff 调整为 #009fbf（降低约25%亮度），实现了：
- 渐变背景
- 霓虹边框
- 多层阴影效果
- 扫光动画
- 悬停效果增强

现在需要将设置面板的其他三个板块也改成相同的视觉风格，保持整个设置面板的一致性。

## Goals

将设置面板的以下三个板块改成与数据源设置完全一致的赛博朋克风格：

1. **自定义API管理区域**
2. **内容过滤设置区域**
3. **一般功能区域**

## Requirements

### 需要修改的板块

#### 1. 自定义API管理区域
- **位置**: `index.html` line 198-229
- **当前样式**: `p-3 bg-[#151515] rounded-lg shadow-inner`
- **目标**: 使用 `.custom-api-section` 类，继承数据源样式
- **包含元素**:
  - 标题: "自定义API"
  - 添加按钮
  - API列表
  - 添加表单

#### 2. 内容过滤设置区域
- **位置**: `index.html` line 232-289
- **当前样式**: `p-3 bg-[#151515] rounded-lg shadow-inner`
- **目标**: 使用 `.filter-settings-section` 类，继承数据源样式
- **包含元素**:
  - 标题: "功能开关"
  - 黄色内容过滤开关
  - 广告过滤开关
  - 每日一言开关
  - 豆瓣热门开关

#### 3. 一般功能区域
- **位置**: `index.html` line 292-297
- **当前样式**: `p-3 bg-[#151515] rounded-lg shadow-inner`
- **目标**: 使用 `.general-functions-section` 类，继承数据源样式
- **包含元素**:
  - 标题: "一般功能"
  - 导入配置按钮
  - 导出配置按钮
  - 清除Cookie按钮

### 样式规范（参考 .datasource-section）

#### 容器样式
```css
- 渐变背景: linear-gradient(135deg, #0a0e1a 0%, #121829 100%)
- 霓虹边框: border: 1px solid rgba(0, 159, 191, 0.2)
- 圆角: border-radius: 12px
- 内边距: padding: 1.25rem
- 多层阴影:
  - 0 4px 20px rgba(0, 0, 0, 0.5)
  - 0 0 15px rgba(0, 159, 191, 0.1)
  - inset 0 1px 0 rgba(0, 159, 191, 0.1)
```

#### 扫光动画
```css
- 使用 ::before 伪元素
- 初始位置: left: -100%
- 渐变: linear-gradient(90deg, transparent, rgba(0, 159, 191, 0.08), transparent)
- 过渡: left 0.6s ease
```

#### 悬停效果
```css
- 边框颜色: rgba(0, 159, 191, 0.4)
- 增强阴影:
  - 0 6px 25px rgba(0, 0, 0, 0.6)
  - 0 0 25px rgba(0, 159, 191, 0.2)
  - inset 0 1px 0 rgba(0, 159, 191, 0.15)
- 扫光动画触发: left: 100%
```

#### 标题样式
```css
- 使用 gradient-text 类
- 字体大小: 0.875rem (14px)
- 字体粗细: 600
- 下边距: 1rem
- 下边框: 1px solid rgba(0, 159, 191, 0.2)
- 文字阴影: 0 0 10px rgba(0, 159, 191, 0.3)
```

### 实现策略

#### CSS 实现
1. 创建通用基类 `.settings-section`，包含所有共享样式
2. 为每个板块创建特定类：
   - `.custom-api-section`
   - `.filter-settings-section`
   - `.general-functions-section`
3. 这些特定类继承 `.settings-section` 的所有样式

#### HTML 修改
1. 替换三个板块的容器类名
2. 为标题添加统一的类名（如果还没有）

### 约束条件

1. **功能不变**: 只改样式，不改功能逻辑
2. **兼容性**: 保持所有现有功能正常工作（开关、按钮、表单等）
3. **响应式**: 适配移动端和PC端
4. **颜色统一**: 所有蓝色使用 #009fbf (rgba(0, 159, 191, x))
5. **不影响其他区域**: 只修改这三个板块，不影响页面其他部分

## Acceptance Criteria

### Functional Requirements
- [ ] 三个板块的容器样式与数据源设置区域完全一致
- [ ] 标题使用渐变文字效果和发光阴影
- [ ] 所有板块都有扫光动画
- [ ] 悬停时有边框和阴影增强效果
- [ ] 所有现有功能正常工作（开关、按钮、表单等）

### Visual Requirements
- [ ] 渐变背景正确应用
- [ ] 霓虹边框颜色正确 (rgba(0, 159, 191, 0.2))
- [ ] 多层阴影效果正确
- [ ] 扫光动画流畅
- [ ] 悬停效果符合预期
- [ ] 标题样式统一

### Technical Requirements
- [ ] CSS 代码复用良好（使用基类）
- [ ] HTML 类名语义化
- [ ] 移动端和PC端都正常显示
- [ ] 不影响页面其他部分
- [ ] 代码通过 lint 检查

## Reference Files

### 样式参考
- `css/styles.css` (line 1237-1475): `.datasource-section` 完整样式定义

### HTML 结构
- `index.html` (line 152-299): 设置面板完整结构

### 相关提交
- commit a85fbcf: 数据源设置样式调整的实现

## Technical Notes

### 颜色值对照
- 旧蓝色: #00ccff / rgba(0, 204, 255, x)
- 新蓝色: #009fbf / rgba(0, 159, 191, x)

### CSS 类命名规范
- 容器类: `{feature}-section` (如 `custom-api-section`)
- 标题类: 使用现有的 `gradient-text` 类
- 基类: `.settings-section` (新增)

### 移动端适配
- 确保在移动端底部抽屉模式下样式正常
- 参考 `css/mobile-optimize.css` 中的相关样式
