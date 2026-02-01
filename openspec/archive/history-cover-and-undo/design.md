# 技术设计文档

## 决策记录

### 关键技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 异步鉴权方案 | LazyImageLoader集成鉴权 | 不阻塞渲染，性能最优，符合现有架构 |
| 封面数据传递 | 全局变量 | 简单直接，页面刷新可从API重新获取 |
| 撤销逻辑统一 | 响应式单一实现 | 减少代码重复，易于维护 |
| 存储清理策略 | 基于大小的自动清理 | 防止localStorage溢出，用户无感知 |

---

## 架构设计

### 1. 数据流架构

```
搜索页面 (index.html)
    ↓
  点击播放
    ↓
设置 window.currentVideoCover = vod_pic
    ↓
跳转到 player.html
    ↓
player.js 读取 window.currentVideoCover
    ↓
saveToHistory() 保存到 localStorage
    ↓
历史记录包含 vod_pic 字段
    ↓
loadViewingHistory() 渲染
    ↓
LazyImageLoader 异步鉴权并加载图片
```

### 2. 异步鉴权集成方案

**修改 LazyImageLoader 类**：

```javascript
class LazyImageLoader {
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            { rootMargin: '50px' }
        );
    }

    async handleIntersection(entries) {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                const img = entry.target;
                const originalSrc = img.dataset.src;

                // 如果是代理URL，先进行鉴权
                if (originalSrc && originalSrc.includes('/proxy/')) {
                    try {
                        // 异步获取带签名的URL
                        const signedUrl = await window.ProxyAuth.addAuthToProxyUrl(originalSrc);
                        img.src = signedUrl;
                    } catch (e) {
                        console.error('图片鉴权失败:', e);
                        img.src = img.dataset.fallback || 'https://via.placeholder.com/300x450?text=无封面';
                    }
                } else {
                    img.src = originalSrc;
                }

                this.observer.unobserve(img);
            }
        }
    }

    observe(img) {
        this.observer.observe(img);
    }
}
```

**渲染时使用 data-src**：

```javascript
// 在 loadViewingHistory() 中
const coverUrl = item.vod_pic || 'https://via.placeholder.com/300x450?text=无封面';
const proxiedCoverUrl = coverUrl.startsWith('http')
    ? `/proxy/${encodeURIComponent(coverUrl)}`
    : coverUrl;

const coverHtml = `
    <img data-src="${proxiedCoverUrl}"
         data-fallback="https://via.placeholder.com/300x450?text=无封面"
         alt="${safeTitle}"
         class="lazy-load">
`;

// 渲染完成后初始化懒加载
const lazyLoader = new LazyImageLoader();
document.querySelectorAll('.lazy-load').forEach(img => lazyLoader.observe(img));
```

### 3. 统一撤销系统架构

**单一响应式实现**：

```javascript
// 统一的撤销删除函数
function deleteHistoryItemWithUndo(encodedUrl, itemIndex) {
    const isMobile = window.innerWidth <= 640;

    try {
        const url = decodeURIComponent(encodedUrl);
        const history = getViewingHistory();
        const item = history.find(h => h.url === url);

        if (!item) return;

        // 清除之前的撤销状态
        if (window.historyUndoState && window.historyUndoState.timerId) {
            clearTimeout(window.historyUndoState.timerId);
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
                hideHistoryUndoToast();
            }, 3000)
        };

        // UI立即移除
        removeHistoryItemFromDOM(url);

        // 显示响应式Toast
        showHistoryUndoToast(item.title, isMobile);

    } catch (e) {
        console.error('删除历史记录项失败:', e);
        showToast('删除记录失败', 'error');
    }
}

// 响应式Toast显示
function showHistoryUndoToast(title, isMobile) {
    hideHistoryUndoToast();

    const truncatedTitle = title.length > 15 ? title.slice(0, 15) + '...' : title;
    const toast = document.createElement('div');
    toast.className = isMobile ? 'history-undo-toast-mobile' : 'history-undo-toast-pc';
    toast.id = 'history-undo-toast';
    toast.innerHTML = `
        <span>已删除 "${truncatedTitle}"</span>
        <button class="undo-btn" onclick="undoHistoryDeletion()">撤销</button>
    `;
    document.body.appendChild(toast);
}

// 统一的Toast隐藏
function hideHistoryUndoToast() {
    const toast = document.getElementById('history-undo-toast');
    if (toast) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 180);
    }
}
```

### 4. localStorage大小管理

**自动清理策略**：

```javascript
// 存储管理器
const StorageManager = {
    // 计算localStorage使用量（字节）
    getStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    },

    // 计算单个key的大小
    getKeySize(key) {
        const value = localStorage.getItem(key);
        return value ? value.length + key.length : 0;
    },

    // 检查是否需要清理
    needsCleanup(threshold = 1024 * 1024) { // 默认1MB阈值
        return this.getStorageSize() > threshold;
    },

    // 清理最旧的历史记录
    cleanupHistory(targetSize = 800 * 1024) { // 目标800KB
        const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');

        // 按时间戳排序（最新的在前）
        history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // 逐步删除最旧的记录，直到满足大小要求
        while (history.length > 10 && this.getStorageSize() > targetSize) {
            history.pop(); // 删除最旧的
        }

        localStorage.setItem('viewingHistory', JSON.stringify(history));
        console.log(`清理后历史记录数量: ${history.length}`);
    }
};

// 在 saveToHistory 中集成
function saveToHistory(url, title, episodeIndex, position, sourceName, vod_id, showIdentifier) {
    // ... 现有逻辑

    // 保存前检查存储空间
    if (StorageManager.needsCleanup()) {
        console.warn('localStorage接近限制，执行自动清理');
        StorageManager.cleanupHistory();
    }

    // 保存历史记录
    try {
        localStorage.setItem('viewingHistory', JSON.stringify(history));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.error('localStorage已满，强制清理');
            StorageManager.cleanupHistory(500 * 1024); // 更激进的清理
            // 重试保存
            try {
                localStorage.setItem('viewingHistory', JSON.stringify(history));
            } catch (retryError) {
                showToast('存储空间不足，请清空历史记录', 'error');
            }
        }
    }
}
```

---

## 性能优化

### 1. 图片加载优化

- **懒加载**：使用 IntersectionObserver，仅加载可见区域图片
- **异步鉴权**：不阻塞UI渲染
- **占位图**：立即显示占位图，避免布局抖动
- **错误处理**：加载失败时回退到占位图

### 2. DOM操作优化

- **批量更新**：使用 innerHTML 一次性渲染所有历史项
- **事件委托**：删除按钮使用事件委托，减少事件监听器数量
- **CSS containment**：使用 `contain: layout style paint` 隔离历史项

### 3. 存储优化

- **自动清理**：基于大小的智能清理策略
- **压缩存储**：考虑使用相对URL而非完整URL
- **定期检查**：在关键操作前检查存储空间

---

## 安全考虑

### 1. XSS防护

- **URL编码**：所有URL使用 `encodeURIComponent` 编码
- **HTML转义**：标题等文本内容转义特殊字符
- **协议验证**：仅允许 http/https 协议的图片URL

### 2. 代理鉴权

- **时间戳验证**：代理URL包含时间戳，防止重放攻击
- **密码哈希**：使用SHA-256哈希密码
- **过期处理**：鉴权失败时回退到占位图

---

## 兼容性处理

### 1. 向后兼容

```javascript
// 渲染时处理旧数据
function loadViewingHistory() {
    let history = getViewingHistory();

    // 过滤掉待删除的项
    if (window.historyUndoState && window.historyUndoState.deletedItem) {
        history = history.filter(item => item.url !== window.historyUndoState.deletedItem.url);
    }

    // 兼容旧数据：添加默认封面
    history = history.map(item => ({
        ...item,
        vod_pic: item.vod_pic || '' // 旧数据没有封面字段
    }));

    // ... 渲染逻辑
}
```

### 2. 浏览器兼容

- **IntersectionObserver**：现代浏览器支持，旧浏览器降级为立即加载
- **CSS Grid**：移动端使用，PC端使用Flex（更好的兼容性）
- **Async/Await**：ES2017特性，目标浏览器均支持

---

## 测试策略

### 1. 单元测试

- **StorageManager**：测试大小计算和清理逻辑
- **LazyImageLoader**：测试异步鉴权和错误处理
- **撤销系统**：测试状态管理和定时器

### 2. 集成测试

- **数据流**：从搜索到播放到历史记录的完整流程
- **响应式**：不同视口宽度下的布局切换
- **错误场景**：网络失败、存储溢出、鉴权失败

### 3. 性能测试

- **加载时间**：50条历史记录的渲染时间 < 100ms
- **内存使用**：图片懒加载后的内存占用
- **存储大小**：50条记录的localStorage占用 < 1MB

---

## 回滚计划

如果出现严重问题，可以快速回滚：

1. **数据层回滚**：移除 `vod_pic` 字段的保存逻辑
2. **UI回滚**：恢复原有的历史记录渲染模板
3. **撤销系统回滚**：PC端恢复直接删除，移动端保持不变
4. **存储管理回滚**：移除自动清理逻辑

**回滚触发条件**：
- localStorage溢出导致应用崩溃
- 图片加载失败率 > 50%
- 用户投诉撤销功能异常

---

## 监控指标

### 关键指标

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| 历史记录渲染时间 | < 100ms | Performance API |
| 图片加载成功率 | > 95% | onerror事件统计 |
| localStorage使用率 | < 80% | StorageManager.getStorageSize() |
| 撤销操作成功率 | 100% | 错误日志 |

### 错误监控

```javascript
// 全局错误监控
window.addEventListener('error', (e) => {
    if (e.message.includes('QuotaExceededError')) {
        console.error('localStorage溢出', {
            size: StorageManager.getStorageSize(),
            historyCount: getViewingHistory().length
        });
    }
});
```

---

## 部署计划

### 阶段1：数据层（低风险）
- 添加 `vod_pic` 字段到历史记录
- 实现 StorageManager
- 测试向后兼容性

### 阶段2：UI渲染（中风险）
- 修改 LazyImageLoader
- 更新历史记录渲染模板
- 测试响应式布局

### 阶段3：撤销系统（低风险）
- 统一PC端和移动端撤销逻辑
- 测试Toast显示和交互

### 阶段4：全面测试（必需）
- 端到端测试
- 性能测试
- 兼容性测试

---

## 文档更新

需要更新的文档：
- `CLAUDE.md`：添加新的数据字段说明
- `js/CLAUDE.md`：更新历史记录相关函数文档
- `css/CLAUDE.md`：添加新的样式类说明
