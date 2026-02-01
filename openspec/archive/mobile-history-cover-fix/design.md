# Design: Mobile History Cover Fix

## Technical Decisions

### Decision 1: HTML Structure

**选择**: 使用 `<img>` 标签 + 绝对定位，复用 `LazyImageLoader`

**理由**:
- 复用现有鉴权机制 (`ProxyAuth.addAuthToProxyUrl()`)
- 与桌面端实现保持一致
- 减少重复代码

**替代方案 (已否决)**:
- 渲染后异步替换 `background-image` URL - 需要新增异步处理逻辑

### Decision 2: Z-index Stack

**选择**: 4 层分离

| Layer | Z-index | Element |
|-------|---------|---------|
| Base | 0 | `<img>` cover image |
| Overlay | 1 | `::before` gradient |
| Text | 2 | `.history-title`, `.history-meta`, etc. |
| Controls | 3 | `.history-item-corner-delete` |

**理由**: 确保删除按钮始终可点击，文字始终可见

### Decision 3: Overlay Implementation

**选择**: `::before` 伪元素

```css
.history-item-content::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8));
    z-index: 1;
    pointer-events: none;
}
```

**理由**: 无额外 DOM 节点，更简洁

### Decision 4: LazyImageLoader Integration

**选择**: 扩展选择器为 `.history-item-content img.lazy-load`

**变更位置**: `js/ui.js` - `loadViewingHistory()` 函数末尾

```javascript
// 现有调用
lazyImageLoader.observeAll('.history-cover img.lazy-load');
// 新增调用
lazyImageLoader.observeAll('.history-item-content img.lazy-load');
```

---

## File Changes

### js/ui.js

**位置**: `loadViewingHistory()` 函数，移动端分支 (约 452-493 行)

**变更 1**: 移除内联 `background-image` 样式

```javascript
// Before
const backgroundStyle = coverUrl
    ? `background-image: linear-gradient(...), url('/proxy/${encodeURIComponent(coverUrl)}');`
    : `background: linear-gradient(135deg, ${generateColorFromTitle(item.title)});`;

// After
const backgroundStyle = coverUrl
    ? ''  // 由 CSS ::before 处理渐变
    : `background: linear-gradient(135deg, ${generateColorFromTitle(item.title)});`;
```

**变更 2**: 添加 `<img>` 封面层

```javascript
// 封面图片 HTML
const coverImgHtml = coverUrl
    ? `<img class="history-cover-img lazy-load"
           data-src="/proxy/${encodeURIComponent(coverUrl)}"
           alt="${safeTitle}"
           loading="lazy">`
    : '';
```

**变更 3**: 更新卡片 HTML 结构

```javascript
return `
    <div class="history-item" data-url="${safeURL}" data-index="${index}">
        <div class="history-item-content ${coverUrl ? 'has-cover' : ''}" style="${backgroundStyle}" onclick="...">
            ${coverImgHtml}
            <button class="history-item-corner-delete" ...>...</button>
            <div class="history-title">...</div>
            ...
        </div>
    </div>
`;
```

**变更 4**: 添加 LazyImageLoader 调用

```javascript
// 函数末尾，渲染完成后
if (window.lazyImageLoader) {
    lazyImageLoader.observeAll('.history-item-content img.lazy-load');
}
```

### css/mobile-optimize.css

**位置**: 移动端历史记录卡片样式区域 (约 1149-1244 行)

**变更 1**: 固定卡片高度

```css
.history-item-content {
    position: relative;
    height: 140px;  /* 固定高度替代 min-height */
    overflow: hidden;
    /* ... 其他样式保持不变 */
}
```

**变更 2**: 添加封面图片样式

```css
.history-item-content .history-cover-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
}
```

**变更 3**: 添加渐变遮罩层

```css
.history-item-content.has-cover::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8));
    z-index: 1;
    pointer-events: none;
}
```

**变更 4**: 更新文字和控件 z-index

```css
.history-item-content .history-title,
.history-item-content .history-meta,
.history-item-content .history-timestamp,
.history-item-content .history-progress-bar {
    position: relative;
    z-index: 2;
}

.history-item-corner-delete {
    z-index: 3;
}
```

---

## Error Handling

### Image Load Failure

`LazyImageLoader.handleLoadError()` 已处理:
1. 清除超时计时器
2. 从 `loadingImages` Map 移除
3. 在父元素上应用 `generateColorFromTitle()` 渐变背景

### Auth Failure

`LazyImageLoader.handleIntersection()` 已处理:
1. `ProxyAuth.addAuthToProxyUrl()` 抛异常时调用 `handleLoadError()`
2. 显示渐变色占位符

---

## Browser Compatibility

| Feature | Support |
|---------|---------|
| IntersectionObserver | Modern browsers (Chrome 51+, Firefox 55+, Safari 12.1+) |
| `object-fit: cover` | Modern browsers (Chrome 31+, Firefox 36+, Safari 10+) |
| `::before` pseudo | All browsers |
| `inset` shorthand | Chrome 87+, Firefox 66+, Safari 14.1+ |

**Fallback**: 对于不支持 `inset` 的浏览器，使用 `top: 0; right: 0; bottom: 0; left: 0;`
