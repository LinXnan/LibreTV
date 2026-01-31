# 历史记录封面展示与PC端撤销删除功能

## Context

用户需求：
1. 在播放历史记录里展示影片封面（需要缓存封面）
2. PC端和移动端均需要展示，考虑兼容性
3. 移动端历史记录卡片展示播放进度条（已实现）
4. PC端历史记录删除增加撤销删除功能（与移动端一致）

用户选择：
- **PC端布局**: 左侧封面 + 右侧信息（横向布局）
- **移动端布局**: 背景封面 + 前景信息（带半透明遮罩）
- **PC端撤销功能**: 是，与移动端保持一致（3秒撤销窗口）
- **PC端进度条**: 保持当前样式（带时间文本 mm:ss / mm:ss）

---

## 约束集合

### 硬约束 (Hard Constraints)

| ID | 约束 | 来源 |
|----|------|------|
| HC-1 | 历史记录数据结构必须添加 `vod_pic` 字段 | 技术需求 |
| HC-2 | 必须向后兼容旧的历史记录数据（无封面字段时显示占位图） | 数据兼容 |
| HC-3 | 响应式断点：640px (window.innerWidth <= 640) | 现有约定 |
| HC-4 | localStorage限制：5-10MB，需要监控存储使用 | 浏览器限制 |
| HC-5 | 封面URL必须通过代理鉴权系统（ProxyAuth.addAuthToProxyUrl） | 安全约束 |
| HC-6 | 图片必须使用lazy loading（loading="lazy"） | 性能要求 |
| HC-7 | PC端面板宽度：320px（固定） | 现有布局 |
| HC-8 | 移动端面板宽度：80-90vw（响应式） | 现有布局 |
| HC-9 | 撤销时间窗口：3000ms（3秒） | 移动端现有实现 |
| HC-10 | 撤销状态存储在 window.historyUndoState | 移动端现有实现 |

### 软约束 (Soft Constraints)

| ID | 约束 | 来源 |
|----|------|------|
| SC-1 | 封面比例：2:3（与搜索结果保持一致） | 视觉一致性 |
| SC-2 | PC端封面尺寸：100x150px | 用户选择 |
| SC-3 | 移动端封面作为背景，带半透明遮罩 | 用户选择 |
| SC-4 | 占位图：https://via.placeholder.com/300x450?text=无封面 | 现有约定 |
| SC-5 | PC端Toast位置：右下角 | UX最佳实践 |
| SC-6 | 移动端Toast位置：底部80px | 现有实现 |
| SC-7 | 图片加载失败时显示占位图 | 容错处理 |

---

## 确认的决策

### 数据层决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| 封面字段名 | `vod_pic` | 与API返回字段保持一致 |
| 封面获取时机 | 保存历史记录时 | 从videoInfo或全局变量获取 |
| 旧数据兼容 | 显示占位图 | `item.vod_pic \|\| PLACEHOLDER_URL` |
| 存储位置 | localStorage: viewingHistory | 现有存储位置 |

### UI布局决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| PC端布局 | Flex横向布局 | 左侧封面（100x150px）+ 右侧信息 |
| 移动端布局 | 背景封面 + 前景信息 | 封面作为背景，带半透明遮罩 |
| 封面比例 | 2:3 | 与搜索结果、豆瓣推荐保持一致 |
| 图片懒加载 | IntersectionObserver | 使用现有LazyImageLoader类 |

### 撤销功能决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| PC端撤销 | 实现 | 复用移动端逻辑，调整Toast位置 |
| 撤销时间 | 3000ms | 与移动端保持一致 |
| Toast位置 | PC: 右下角, Mobile: 底部80px | 响应式调整 |
| 状态管理 | window.historyUndoState | 复用移动端状态 |

---

## PBT 属性 (Property-Based Testing)

### 数据完整性

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 封面字段存在性 | 新保存的历史记录必须包含 `vod_pic` 字段 | 保存历史后检查localStorage，断言包含vod_pic |
| 向后兼容性 | 旧历史记录（无vod_pic）渲染时不报错 | 生成无vod_pic的历史数据，断言正常渲染 |
| 占位图回退 | `!item.vod_pic` 时必须显示占位图 | 测试null、undefined、空字符串，断言显示占位图 |
| localStorage大小 | 50条记录 + 封面URL < 1MB | 生成50条记录，测量存储大小 |

### 视觉一致性

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 响应式布局 | `width <= 640` → 移动端布局, `width > 640` → PC端布局 | 随机化视口宽度639-641，验证布局切换 |
| 封面比例 | 封面容器宽高比始终为 2:3 | 随机化视口和DPR，验证aspect-ratio |
| PC端封面尺寸 | PC端封面固定 100x150px | 测量DOM元素尺寸，断言精确匹配 |
| 移动端背景封面 | 移动端封面作为background-image | 检查CSS属性，断言background-image存在 |
| 图片懒加载 | 图片元素包含 `loading="lazy"` 属性 | 查询所有img元素，断言包含lazy属性 |

### 撤销功能

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 延迟持久化 | localStorage仅在3秒后更新 | 删除后<3s检查存储未变，≥3s检查已更新 |
| 原位恢复 | 撤销后项目回到原始索引 | 删除随机项，撤销，断言顺序深度相等 |
| Toast响应式 | PC端Toast在右下角，移动端在底部80px | 切换视口，断言Toast位置 |
| 幂等删除 | 撤销窗口内重复删除同一项只删除一次 | 3s内尝试删除两次，断言只删除一次 |
| 往返删除→撤销 | 删除后撤销恢复完全相同状态 | 快照→删除→撤销→断言深度相等 |

### 图片加载

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 错误处理 | 图片加载失败时显示占位图 | 使用无效URL，断言显示占位图 |
| 代理鉴权 | 封面URL包含auth参数 | 检查img.src，断言包含auth和t参数 |
| CORS处理 | 使用代理URL加载图片 | 检查URL前缀，断言包含/proxy/ |

### 幂等性与往返

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 幂等保存 | 重复保存同一视频只更新timestamp | 保存两次，断言历史记录数量不变 |
| 往返序列化 | localStorage → parse → stringify → 深度相等 | 保存→读取→再保存，断言数据一致 |
| 幂等渲染 | 连续调用loadViewingHistory()结果一致 | 调用两次，断言DOM结构相同 |

---

## 零决策实施计划

### 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `js/player.js` | 修改 | saveToHistory() 添加vod_pic字段 |
| `js/ui.js` | 修改 | addToViewingHistory() 添加vod_pic参数 |
| `js/ui.js` | 修改 | loadViewingHistory() 渲染封面 |
| `js/ui.js` | 修改 | deleteHistoryItem() 实现PC端撤销 |
| `css/styles.css` | 修改 | 添加PC端封面样式 |
| `css/mobile-optimize.css` | 修改 | 添加移动端背景封面样式 |

### Task 1: 数据层 - 添加封面字段

**文件**: `js/player.js`

**位置**: `saveToHistory()` 函数（约1503-1601行）

**变更**:

1. 在 `videoInfo` 对象中添加 `vod_pic` 字段
```javascript
const videoInfo = {
    url: url,
    title: title,
    episodeIndex: episodeIndex,
    playbackPosition: position,
    timestamp: Date.now(),
    sourceName: sourceName,
    vod_id: vod_id,
    showIdentifier: showIdentifier,
    episodes: currentEpisodes && currentEpisodes.length > 0 ? [...currentEpisodes] : [],
    vod_pic: currentVideoCover || '' // 新增：从全局变量获取封面
};
```

2. 在文件顶部添加全局变量（如果不存在）
```javascript
let currentVideoCover = ''; // 当前视频封面URL
```

3. 在视频加载成功后设置封面URL（在适当位置）
```javascript
// 从API返回的videoInfo中获取封面
if (videoInfo && videoInfo.cover) {
    currentVideoCover = videoInfo.cover;
}
```

**文件**: `js/ui.js`

**位置**: `addToViewingHistory()` 函数（约916-998行）

**变更**:

1. 修改函数签名，添加 `vod_pic` 参数
```javascript
function addToViewingHistory(videoInfo) {
    // videoInfo 应包含 vod_pic 字段
    const {
        url, title, episodeIndex, episodes,
        sourceName, vod_id, playbackPosition,
        duration, playbackRate, showIdentifier,
        vod_pic // 新增
    } = videoInfo;

    // ... 现有逻辑

    const historyItem = {
        url, title, episodeIndex, episodes,
        sourceName, sourceCode: sourceName,
        vod_id, playbackPosition, duration,
        playbackRate, timestamp: Date.now(),
        showIdentifier,
        vod_pic: vod_pic || '' // 新增：保存封面URL
    };

    // ... 保存到localStorage
}
```

### Task 2: UI渲染 - PC端封面展示

**文件**: `js/ui.js`

**位置**: `loadViewingHistory()` 函数（约413-549行）

**变更**:

1. 在PC端渲染逻辑中添加封面容器（约519-543行）
```javascript
// PC端渲染
if (!isMobile) {
    historyList.innerHTML = history.map((item, index) => {
        // ... 现有变量定义

        // 新增：封面URL处理
        const coverUrl = item.vod_pic || 'https://via.placeholder.com/300x450?text=无封面';
        const proxiedCoverUrl = coverUrl.startsWith('http')
            ? `/proxy/${encodeURIComponent(coverUrl)}`
            : coverUrl;

        // 新增：封面HTML
        const coverHtml = `
            <div class="history-cover">
                <img src="${proxiedCoverUrl}"
                     alt="${safeTitle}"
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=无封面';">
            </div>
        `;

        return `
            <div class="history-item cursor-pointer relative group"
                 onclick="playFromHistory('${item.url}', '${safeTitle}', ${item.episodeIndex || 0}, ${item.playbackPosition || 0})">
                ${coverHtml}
                <div class="history-info">
                    <button onclick="event.stopPropagation(); deleteHistoryItemWithUndo('${safeURL}', ${index})"
                            class="absolute right-2 top-2 md:opacity-0 md:group-hover:opacity-100 ...">
                        <!-- 删除按钮SVG -->
                    </button>
                    <div class="history-title">${safeTitle}</div>
                    <!-- ... 其他信息 -->
                </div>
            </div>
        `;
    }).join('');
}
```

### Task 3: UI渲染 - 移动端背景封面

**文件**: `js/ui.js`

**位置**: `loadViewingHistory()` 函数，移动端分支（约429-476行）

**变更**:

1. 在移动端渲染逻辑中添加背景封面
```javascript
// 移动端渲染
if (isMobile) {
    historyList.innerHTML = history.map((item, index) => {
        // ... 现有变量定义

        // 新增：封面URL处理
        const coverUrl = item.vod_pic || '';
        const backgroundStyle = coverUrl
            ? `background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('${coverUrl}'); background-size: cover; background-position: center;`
            : 'background: #1a1a1a;';

        return `
            <div class="history-item" data-url="${safeURL}" data-index="${index}">
                <div class="history-item-content"
                     style="${backgroundStyle}"
                     onclick="playFromHistoryByIndex(${index})">
                    <!-- ... 现有内容 -->
                </div>
            </div>
        `;
    }).join('');
}
```

### Task 4: CSS样式 - PC端封面

**文件**: `css/styles.css`

**位置**: 历史记录样式区域（约682-817行）

**变更**:

1. 修改 `.history-item` 为flex布局
```css
.history-item {
    background: #1a1a1a;
    border-radius: 6px;
    border: 1px solid #333;
    overflow: hidden;
    transition: all 0.2s ease;
    position: relative;
    margin-bottom: 8px;
    width: 100%;
    display: flex; /* 新增 */
    flex-direction: row; /* 新增 */
    gap: 12px; /* 新增 */
}
```

2. 添加封面容器样式
```css
.history-cover {
    flex-shrink: 0;
    width: 100px;
    height: 150px;
    overflow: hidden;
    background: #191919;
}

.history-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}

.history-item:hover .history-cover img {
    transform: scale(1.05);
}
```

3. 调整信息区域样式
```css
.history-info {
    flex: 1;
    padding: 10px 14px 10px 0; /* 调整padding */
    min-height: 150px; /* 与封面高度一致 */
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
```

### Task 5: CSS样式 - 移动端背景封面

**文件**: `css/mobile-optimize.css`

**位置**: 移动端历史记录样式区域（约1120-1222行）

**变更**:

1. 修改 `.history-item-content` 样式
```css
@media (max-width: 640px) {
    .history-item-content {
        position: relative;
        background: #1a1a1a;
        padding: 10px 12px;
        width: 100%;
        box-sizing: border-box;
        min-height: 120px; /* 新增：确保有足够高度显示背景 */
        background-size: cover; /* 新增 */
        background-position: center; /* 新增 */
        border-radius: 8px; /* 新增 */
    }

    /* 新增：确保文字在背景上可读 */
    .history-item-content .history-title,
    .history-item-content .history-meta,
    .history-item-content .history-timestamp {
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        position: relative;
        z-index: 1;
    }
}
```

### Task 6: PC端撤销删除功能

**文件**: `js/ui.js`

**位置**: `deleteHistoryItem()` 函数（约562-585行）

**变更**:

1. 重命名现有函数为 `deleteHistoryItemDirectly()`（保留作为fallback）

2. 修改 `deleteHistoryItem()` 为撤销版本
```javascript
// 删除单个历史记录项（PC端 - 带撤销）
function deleteHistoryItem(encodedUrl, itemIndex) {
    // 检测是否为移动端
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
        // 移动端使用现有的撤销逻辑
        deleteHistoryItemWithUndo(encodedUrl, itemIndex);
    } else {
        // PC端使用新的撤销逻辑
        deleteHistoryItemWithUndoPC(encodedUrl, itemIndex);
    }
}

// PC端撤销删除实现
function deleteHistoryItemWithUndoPC(encodedUrl, itemIndex) {
    try {
        const url = decodeURIComponent(encodedUrl);
        const history = getViewingHistory();
        const item = history.find(h => h.url === url);

        if (!item) return;

        // 清除之前的撤销状态
        if (window.historyUndoState && window.historyUndoState.timerId) {
            clearTimeout(window.historyUndoState.timerId);
            // 立即提交之前的删除
            if (window.historyUndoState.deletedItem) {
                commitHistoryDeletion(window.historyUndoState.deletedItem.url);
            }
        }

        // 保存到撤销缓冲区
        window.historyUndoState = {
            deletedItem: item,
            originalIndex: itemIndex,
            timerId: setTimeout(() => {
                commitHistoryDeletion(url);
                hideHistoryUndoToastPC();
            }, 3000)
        };

        // UI立即移除
        removeHistoryItemFromDOM(url);

        // 显示PC端撤销Toast
        showHistoryUndoToastPC(item.title);

    } catch (e) {
        console.error('删除历史记录项失败:', e);
        showToast('删除记录失败', 'error');
    }
}

// PC端Toast显示
function showHistoryUndoToastPC(title) {
    // 移除已有toast
    hideHistoryUndoToastPC();

    const truncatedTitle = title.length > 15 ? title.slice(0, 15) + '...' : title;
    const toast = document.createElement('div');
    toast.className = 'history-undo-toast-pc';
    toast.id = 'history-undo-toast-pc';
    toast.innerHTML = `
        <span>已删除 "${truncatedTitle}"</span>
        <button class="undo-btn" onclick="undoHistoryDeletion()">撤销</button>
    `;
    document.body.appendChild(toast);
}

// PC端Toast隐藏
function hideHistoryUndoToastPC() {
    const toast = document.getElementById('history-undo-toast-pc');
    if (toast) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 180);
    }
}
```

3. 修改 `undoHistoryDeletion()` 函数，支持PC端
```javascript
// 撤销删除（PC端和移动端通用）
function undoHistoryDeletion() {
    const state = window.historyUndoState;
    if (!state || !state.deletedItem) return;

    // 取消定时器
    clearTimeout(state.timerId);

    // 恢复项目
    const history = getViewingHistory();
    history.splice(state.originalIndex, 0, state.deletedItem);
    localStorage.setItem('viewingHistory', JSON.stringify(history));

    // 重新加载历史记录
    loadViewingHistory();

    // 清理状态
    window.historyUndoState = { deletedItem: null, originalIndex: -1, timerId: null };

    // 隐藏Toast
    const isMobile = window.innerWidth <= 640;
    if (isMobile) {
        hideHistoryUndoToast();
    } else {
        hideHistoryUndoToastPC();
    }

    // 显示成功提示
    showToast('已恢复记录', 'success');
}
```

### Task 7: CSS样式 - PC端撤销Toast

**文件**: `css/styles.css`

**位置**: 在文件末尾添加

**变更**:

```css
/* PC端撤销Toast */
.history-undo-toast-pc {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: toast-slide-in 180ms ease-out;
}

.history-undo-toast-pc.hiding {
    animation: toast-slide-out 180ms ease-out forwards;
}

.history-undo-toast-pc .undo-btn {
    background: transparent;
    border: 1px solid #60a5fa;
    color: #60a5fa;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
}

.history-undo-toast-pc .undo-btn:hover {
    background: #60a5fa;
    color: white;
}

@keyframes toast-slide-in {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes toast-slide-out {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100%);
    }
}

/* 移动端隐藏PC端Toast */
@media (max-width: 640px) {
    .history-undo-toast-pc {
        display: none;
    }
}
```

---

## 成功判据

| ID | 判据 | 验证方式 |
|----|------|----------|
| S-1 | 新保存的历史记录包含封面字段 | 检查localStorage数据结构 |
| S-2 | PC端历史记录显示左侧封面（100x150px） | 视觉检查 + 测量DOM尺寸 |
| S-3 | 移动端历史记录显示背景封面 | 视觉检查 + 检查CSS background-image |
| S-4 | 旧历史记录（无封面）显示占位图 | 测试旧数据，验证占位图显示 |
| S-5 | 图片加载失败时显示占位图 | 使用无效URL测试 |
| S-6 | 图片使用lazy loading | 检查img元素loading属性 |
| S-7 | PC端删除显示撤销Toast（右下角） | 手动测试 |
| S-8 | 移动端删除显示撤销Toast（底部80px） | 手动测试 |
| S-9 | 3秒内点击撤销可恢复 | 手动测试 |
| S-10 | 3秒后自动提交删除 | 手动测试 |
| S-11 | 响应式切换时布局正确 | 调整视口宽度测试 |
| S-12 | localStorage大小 < 1MB（50条记录） | 测量存储大小 |
| S-13 | 封面URL包含代理鉴权参数 | 检查img.src |
| S-14 | 移动端进度条正常显示 | 视觉检查（已有功能） |
| S-15 | PC端进度条带时间文本 | 视觉检查（已有功能） |

---

## 实施顺序

1. **Task 1**: 数据层 - 添加封面字段（player.js, ui.js）
2. **Task 4**: CSS样式 - PC端封面（styles.css）
3. **Task 2**: UI渲染 - PC端封面展示（ui.js）
4. **Task 5**: CSS样式 - 移动端背景封面（mobile-optimize.css）
5. **Task 3**: UI渲染 - 移动端背景封面（ui.js）
6. **Task 7**: CSS样式 - PC端撤销Toast（styles.css）
7. **Task 6**: PC端撤销删除功能（ui.js）

---

## 风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| localStorage溢出 | 应用崩溃 | 监控存储大小，超过阈值时清理最旧记录 |
| 布局破坏 | UI错乱 | 使用flex布局，充分测试响应式 |
| 图片加载慢 | 性能下降 | lazy loading + IntersectionObserver |
| XSS注入 | 安全漏洞 | encodeURIComponent编码URL，验证协议 |
| 旧数据不兼容 | 显示错误 | 向后兼容处理，使用占位图 |
