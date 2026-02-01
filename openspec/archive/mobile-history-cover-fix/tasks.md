# Tasks: Mobile History Cover Fix

## Zero-Decision Implementation Plan

所有决策点已解决，以下任务为纯机械执行。

---

## Task 1: 修改移动端历史卡片 HTML 结构

**文件**: `js/ui.js`
**位置**: `loadViewingHistory()` 函数，移动端分支 (约 452-493 行)
**依赖**: 无

### Step 1.1: 修改封面 URL 处理

**行号**: 约 465-468

**Before**:
```javascript
// 封面URL处理
const coverUrl = item.vod_pic && isValidImageUrl(item.vod_pic)
    ? item.vod_pic
    : '';
```

**After**: 保持不变

### Step 1.2: 修改背景样式生成

**行号**: 约 470-473

**Before**:
```javascript
// 背景样式
const backgroundStyle = coverUrl
    ? `background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('/proxy/${encodeURIComponent(coverUrl)}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, ${generateColorFromTitle(item.title)});`;
```

**After**:
```javascript
// 背景样式 - 有封面时由 CSS ::before 处理渐变，无封面时使用渐变色
const backgroundStyle = coverUrl
    ? ''
    : `background: linear-gradient(135deg, ${generateColorFromTitle(item.title)});`;

// 封面图片 HTML
const coverImgHtml = coverUrl
    ? `<img class="history-cover-img lazy-load" data-src="/proxy/${encodeURIComponent(coverUrl)}" alt="${safeTitle}" loading="lazy">`
    : '';
```

### Step 1.3: 修改卡片 HTML 模板

**行号**: 约 475-492

**Before**:
```javascript
return `
    <div class="history-item" data-url="${safeURL}" data-index="${index}">
        <div class="history-item-content" style="${backgroundStyle}" onclick="playFromHistoryByIndex(${index})">
            <button class="history-item-corner-delete" onclick="event.stopPropagation(); deleteHistoryItemWithUndo('${safeURL}', ${index})" title="删除">
                ...
            </button>
            <div class="history-title">${safeTitle}</div>
            ...
        </div>
    </div>
`;
```

**After**:
```javascript
return `
    <div class="history-item" data-url="${safeURL}" data-index="${index}">
        <div class="history-item-content${coverUrl ? ' has-cover' : ''}" style="${backgroundStyle}" onclick="playFromHistoryByIndex(${index})">
            ${coverImgHtml}
            <button class="history-item-corner-delete" onclick="event.stopPropagation(); deleteHistoryItemWithUndo('${safeURL}', ${index})" title="删除">
                ...
            </button>
            <div class="history-title">${safeTitle}</div>
            ...
        </div>
    </div>
`;
```

---

## Task 2: 添加 LazyImageLoader 调用

**文件**: `js/ui.js`
**位置**: `loadViewingHistory()` 函数末尾
**依赖**: Task 1

### Step 2.1: 定位现有 LazyImageLoader 调用

搜索 `lazyImageLoader.observeAll` 在 `loadViewingHistory()` 函数中的位置。

### Step 2.2: 添加移动端封面图片观察

在现有 `lazyImageLoader.observeAll('.history-cover img.lazy-load')` 调用后添加:

```javascript
// 移动端封面图片懒加载
lazyImageLoader.observeAll('.history-item-content img.lazy-load');
```

---

## Task 3: 添加移动端封面图片 CSS

**文件**: `css/mobile-optimize.css`
**位置**: 移动端历史记录卡片样式区域 (约 1149-1244 行)
**依赖**: 无

### Step 3.1: 修改卡片高度

**行号**: 约 1150-1158

**Before**:
```css
.history-item-content {
    position: relative;
    min-height: 120px;
    background-size: cover;
    background-position: center;
    padding: 10px 12px;
    width: 100%;
    box-sizing: border-box;
}
```

**After**:
```css
.history-item-content {
    position: relative;
    height: 140px;
    overflow: hidden;
    padding: 10px 12px;
    width: 100%;
    box-sizing: border-box;
}
```

### Step 3.2: 添加封面图片样式

在 `.history-item-content` 样式块后添加:

```css
/* 移动端封面图片 - 绝对定位作为背景 */
.history-item-content .history-cover-img {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
}

/* 有封面时的渐变遮罩层 */
.history-item-content.has-cover::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8));
    z-index: 1;
    pointer-events: none;
}
```

### Step 3.3: 更新文字 z-index

**行号**: 约 1160-1167

**Before**:
```css
.history-item-content .history-title,
.history-item-content .history-meta,
.history-item-content .history-timestamp {
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    position: relative;
    z-index: 1;
}
```

**After**:
```css
.history-item-content .history-title,
.history-item-content .history-meta,
.history-item-content .history-timestamp {
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    position: relative;
    z-index: 2;
}
```

### Step 3.4: 更新进度条 z-index

在进度条样式块中添加 `z-index: 2`:

```css
.history-item-content .history-progress-bar {
    /* ... 现有样式 ... */
    position: relative;
    z-index: 2;
}
```

### Step 3.5: 更新删除按钮 z-index

**行号**: 约 1169-1185

**Before**:
```css
.history-item-corner-delete {
    /* ... */
    z-index: 2;
    /* ... */
}
```

**After**:
```css
.history-item-corner-delete {
    /* ... */
    z-index: 3;
    /* ... */
}
```

---

## Verification Checklist

### 功能验证
- [x] 移动端历史记录封面图片正常显示
- [x] 网络请求无 401 错误
- [x] 图片加载失败时显示渐变色占位

### 视觉验证
- [x] 所有历史卡片高度一致 (海报比例 2:3)
- [x] 封面图片覆盖卡片背景
- [x] 文字清晰可读 (渐变遮罩有效)
- [x] 删除按钮可点击

### 安全验证
- [x] 修复 inline onclick 单引号注入风险
- [x] 修复 generateColorFromTitle 空值异常

### 兼容性验证
- [ ] iOS Safari 正常
- [ ] Android Chrome 正常
- [ ] 极窄屏幕 (<360px) 单列布局正常

---

## Code Review Summary

### Codex Review
- ✅ R1: ProxyAuth 鉴权正确集成
- ✅ R1: 图片加载失败显示渐变占位
- ✅ R2: 2:3 比例 grid 布局无重叠
- ⚠️ 修复: inline onclick 单引号转义
- ⚠️ 修复: title 空值兜底

### Gemini Review
- ✅ XSS 防护: safeTitle/safeURL 编码
- ✅ Z-index 层级正确
- ✅ LazyImageLoader 正确初始化
- ℹ️ 设计变更: 3列海报布局 (用户确认)
- ℹ️ 设计变更: aspect-ratio 替代固定高度 (用户确认)

---

## Files Summary

| 文件 | 变更类型 | 任务 |
|------|----------|------|
| `js/ui.js` | 修改 | Task 1, Task 2, 安全修复 |
| `js/utils.js` | 修改 | LazyImageLoader 修复 |
| `css/mobile-optimize.css` | 修改 | Task 3, 海报样式 |
