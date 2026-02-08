# 历史记录显示影片封面图片

## Goal
将历史记录中的渐变色占位符替换为实际的影片封面图片，提升用户体验。

## Requirements
- 在PC端历史记录中显示实际的封面图片（替换当前的渐变色占位符）
- 在移动端历史记录中使用封面图片作为背景（替换当前的纯渐变背景）
- 使用项目现有的跨域处理机制（代理服务器 + 鉴权）
- 使用 LazyImageLoader 进行懒加载和鉴权
- 处理封面图片不存在的情况（降级到渐变色占位符）

## Acceptance Criteria
- [ ] PC端历史记录显示实际封面图片
- [ ] 移动端历史记录使用封面图片作为背景
- [ ] 封面图片通过代理服务器加载，避免跨域问题
- [ ] 使用 LazyImageLoader 进行懒加载和鉴权
- [ ] 没有封面的历史记录降级显示渐变色占位符
- [ ] 图片加载失败时显示降级UI

## Technical Notes

### 数据来源
- 历史记录数据已包含 `vod_pic` 字段（在 `js/player.js:1563` 保存）
- 需要在 `js/ui.js` 的 `loadViewingHistory()` 函数中读取并渲染

### 跨域处理
项目已有完整的跨域处理机制：
1. **代理服务器**: `/proxy/` 路径用于代理外部资源
2. **鉴权系统**: `js/proxy-auth.js` 的 `addAuthToProxyUrl()` 函数
3. **图片加载器**: `js/utils.js` 中的 `LazyImageLoader` 类
   - 支持 `data-src` 属性进行懒加载
   - 自动处理代理URL的鉴权（检测 `/proxy/` 前缀）
   - 集成 ImageCacheManager 进行本地缓存

### 实现方案

#### PC端
替换 `placeholderHtml`，使用实际封面图片：
```javascript
const coverUrl = item.vod_pic || '';
const coverHtml = coverUrl
    ? `<img data-src="/proxy/${encodeURIComponent(coverUrl)}"
           alt="${safeTitle}"
           class="lazy-load history-cover-img"
           onerror="this.style.display='none'; this.parentElement.querySelector('.history-icon-placeholder').style.display='flex';">`
    : '';

const placeholderHtml = `
    <div class="history-cover">
        ${coverHtml}
        <div class="history-icon-placeholder" style="background: ${gradientBg}; ${coverUrl ? 'display:none;' : ''}">
            <span class="history-icon">${contentIcon}</span>
        </div>
    </div>
`;
```

#### 移动端
在 `.history-item-content` 中添加背景图片：
```javascript
const coverUrl = item.vod_pic || '';
const backgroundImage = coverUrl
    ? `<img data-src="/proxy/${encodeURIComponent(coverUrl)}"
           alt="${safeTitle}"
           class="lazy-load history-bg-img">`
    : '';

// 在 .history-item-content 内部第一个位置插入
<div class="history-item-content" style="background: ${gradientBg};" onclick="playFromHistoryByIndex(${index})">
    ${backgroundImage}
    <!-- 其他内容 -->
</div>
```

#### LazyImageLoader 初始化
在渲染完成后初始化懒加载：
```javascript
// 在 loadViewingHistory() 函数末尾
if (window.lazyImageLoader) {
    window.lazyImageLoader.observeAll('.lazy-load');
}
```

### CSS 需求
需要添加样式来正确显示封面图片（如果不存在则添加到 `css/style.css`）。

## Files to Modify
- `js/ui.js` - `loadViewingHistory()` 函数（约478-660行）
  - 修改移动端渲染逻辑（532-575行）
  - 修改PC端渲染逻辑（577-648行）
  - 添加 LazyImageLoader 初始化（659行附近）
