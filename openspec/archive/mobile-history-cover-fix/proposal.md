# Mobile History Cover Fix

> **Status**: ✅ Archived
> **Archived Date**: 2026-01-31
> **Implementation**: Completed
> **Related Commits**: d351bc2, 8426112, 82db593

---

## Context

移动端历史记录面板存在两个问题：
1. 封面图片加载返回 401 错误
2. 历史卡片大小不固定，多条记录时布局不一致

### 问题根因分析

**问题 1: 401 错误**

当前移动端实现（`js/ui.js:471-472`）：
```javascript
const backgroundStyle = coverUrl
    ? `background-image: linear-gradient(...), url('/proxy/${encodeURIComponent(coverUrl)}');`
    : ...;
```

直接在 CSS `background-image` 中使用代理 URL，**未经过 `ProxyAuth.addAuthToProxyUrl()` 鉴权**。

对比 PC 端实现（`js/ui.js:505-511`）：
```javascript
const coverHtml = proxiedCoverUrl
    ? `<div class="history-cover">
           <img data-src="${proxiedCoverUrl}" class="lazy-load" loading="lazy">
       </div>`
    : ...;
```

PC 端使用 `<img data-src>` + `LazyImageLoader`（`js/utils.js:196-230`），在图片进入视口时调用鉴权。

**问题 2: 卡片大小不固定**

当前 CSS（`css/mobile-optimize.css:1150-1158`）：
```css
.history-item-content {
    min-height: 120px;  /* 仅设置最小高度 */
}
```

无固定高度约束，导致卡片随内容高度变化。

---

## Requirements

### R1: 移动端封面图片鉴权

**场景**: 用户打开移动端历史记录面板

**约束**:
- 必须通过 `ProxyAuth.addAuthToProxyUrl()` 获取带鉴权的 URL
- 鉴权是异步操作，需要在渲染后处理
- 保持封面作为背景的视觉效果

**验收标准**:
- [ ] 封面图片正常加载，无 401 错误
- [ ] 图片加载失败时显示渐变色占位

### R2: 移动端历史卡片固定尺寸

**场景**: 历史记录面板显示多条记录

**约束**:
- 卡片高度固定，不随内容变化
- 保持 2 列网格布局
- 文字内容超出时截断

**验收标准**:
- [ ] 所有卡片高度一致
- [ ] 多条记录时布局整齐

---

## Technical Approach

### 方案 A: 改用 `<img>` 标签 + 绝对定位背景层

将移动端封面从 CSS `background-image` 改为 `<img>` 标签，复用现有 `LazyImageLoader`。

**优点**: 复用现有鉴权机制，代码改动小
**缺点**: 需要调整 HTML 结构

### 方案 B: 渲染后异步替换背景 URL

渲染完成后，遍历卡片，异步获取鉴权 URL 并更新 `background-image`。

**优点**: 保持现有 HTML 结构
**缺点**: 需要新增异步处理逻辑

### 推荐: 方案 A

复用现有 `LazyImageLoader` 机制，减少重复代码，保持一致性。

---

## Implementation Tasks

### Task 1: 修改移动端历史卡片 HTML 结构

**文件**: `js/ui.js`
**位置**: `loadViewingHistory()` 函数，移动端分支（约 452-493 行）

**变更**:
1. 移除 `background-image` 内联样式
2. 添加 `<img data-src>` 封面层
3. 使用绝对定位实现背景效果

### Task 2: 添加移动端封面图片 CSS

**文件**: `css/mobile-optimize.css`
**位置**: 移动端历史记录卡片样式区域（约 1149-1244 行）

**变更**:
1. 添加 `.history-item-cover-img` 样式
2. 设置固定卡片高度 `height: 140px`
3. 添加图片加载失败占位样式

### Task 3: 确保 LazyImageLoader 处理新增图片

**文件**: `js/ui.js`
**位置**: `loadViewingHistory()` 函数末尾

**变更**:
1. 渲染完成后初始化懒加载观察器
2. 对移动端封面图片应用懒加载

---

## Success Criteria

1. **功能验证**:
   - 移动端历史记录封面图片正常显示
   - 网络请求无 401 错误

2. **视觉验证**:
   - 所有历史卡片高度一致（140px）
   - 封面图片覆盖卡片背景
   - 图片加载失败时显示渐变色

3. **兼容性验证**:
   - iOS Safari 正常
   - Android Chrome 正常
   - 极窄屏幕（<360px）单列布局正常

---

## Files Affected

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `js/ui.js` | 修改 | 移动端历史卡片 HTML 结构 |
| `css/mobile-optimize.css` | 修改 | 卡片固定高度 + 封面图片样式 |
