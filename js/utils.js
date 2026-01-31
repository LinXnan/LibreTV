/**
 * 优化工具类
 * 包含防抖、并发控制、localStorage 优化等工具函数
 */

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// URL安全验证
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch (e) {
        return false;
    }
}


// 并发池控制类
class ConcurrentPool {
    constructor(limit = 3) {
        this.limit = limit;
        this.running = 0;
        this.queue = [];
    }

    async run(fn) {
        while (this.running >= this.limit) {
            await new Promise(resolve => this.queue.push(resolve));
        }
        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

// localStorage 管理类（带防抖和配额管理）
class StorageManager {
    constructor(debounceTime = 1000) {
        this.debounceTime = debounceTime;
        this.timers = new Map();
        this.cache = new Map();
        this.MAX_SIZE = 5 * 1024 * 1024;
        this.MIN_RECORDS = 10;
    }

    setItem(key, value) {
        this.cache.set(key, value);

        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        const timer = setTimeout(() => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                this.timers.delete(key);
            } catch (e) {
                console.error('localStorage write error:', e);
            }
        }, this.debounceTime);

        this.timers.set(key, timer);
    }

    getItem(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        try {
            const value = localStorage.getItem(key);
            const parsed = value ? JSON.parse(value) : null;
            this.cache.set(key, parsed);
            return parsed;
        } catch (e) {
            console.error('localStorage read error:', e);
            return null;
        }
    }

    removeItem(key) {
        this.cache.delete(key);
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        localStorage.removeItem(key);
    }

    setItemImmediate(key, value) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        this.cache.set(key, value);
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('localStorage write error:', e);
        }
    }

    getStorageSize() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += (localStorage[key].length + key.length) * 2;
            }
        }
        return total;
    }

    needsCleanup() {
        return this.getStorageSize() > this.MAX_SIZE;
    }

    cleanupHistory() {
        const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');
        history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        while (history.length > this.MIN_RECORDS && this.getStorageSize() > this.MAX_SIZE) {
            history.pop();
        }

        localStorage.setItem('viewingHistory', JSON.stringify(history));
        return history.length;
    }

    saveWithRetry(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, cleaning up...');
                this.cleanupHistory();
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (retryError) {
                    console.error('Save failed after cleanup');
                    return false;
                }
            }
            throw e;
        }
    }
}

// 图片本地缓存管理类
class ImageCacheManager {
    constructor(maxSize = 3 * 1024 * 1024) {
        this.maxSize = maxSize; // 默认 3MB
        this.indexKey = 'img_cache_index';
        this.prefix = 'img_cache_data_';
        this.isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.preloadingUrls = new Set(); // 防止重复下载
    }

    _getIndex() {
        try {
            return JSON.parse(localStorage.getItem(this.indexKey) || '[]');
        } catch (e) { return []; }
    }

    _saveIndex(index) {
        try {
            localStorage.setItem(this.indexKey, JSON.stringify(index));
        } catch (e) { console.error('[ImageCache] Index save failed', e); }
    }

    get(url) {
        const index = this._getIndex();
        const entry = index.find(e => e.url === url);
        if (entry) {
            const data = localStorage.getItem(this.prefix + entry.id);
            if (data) {
                entry.lastAccess = Date.now();
                this._saveIndex(index);
                return data;
            }
        }
        return null;
    }

    async preload(url) {
        if (!url || typeof url !== 'string') return;

        // 1. 尝试从缓存获取，如果已有则跳过
        if (this.get(url)) {
            if (this.isDev) console.log('[ImageCache] Already cached, skipping:', url);
            return;
        }

        // 2. 检查是否正在下载中，避免重复请求
        if (this.preloadingUrls.has(url)) {
            if (this.isDev) console.log('[ImageCache] Already preloading, skipping:', url);
            return;
        }

        this.preloadingUrls.add(url);
        if (this.isDev) console.log('[ImageCache] Starting preload:', url);

        try {
            let finalSrc = url;
            const isProxy = url.startsWith('/proxy/');

            // 如果是代理图片，尝试添加鉴权参数
            if (isProxy && window.ProxyAuth) {
                try {
                    finalSrc = await window.ProxyAuth.addAuthToProxyUrl(url);
                    if (this.isDev) console.log('[ImageCache] Auth added:', finalSrc);
                } catch (e) {
                    if (this.isDev) console.error('[ImageCache] Preload auth failed:', e);
                }
            }

            const response = await fetch(finalSrc);
            if (response.ok) {
                const blob = await response.blob();
                const result = await this.compressAndStore(url, blob);
                if (this.isDev) {
                    if (result) {
                        console.log('[ImageCache] Preload successful, size:', result.length, 'chars');
                    } else {
                        console.warn('[ImageCache] Preload compress failed');
                    }
                }
            } else {
                if (this.isDev) console.warn('[ImageCache] Preload fetch failed, status:', response.status);
            }
        } catch (e) {
            if (this.isDev) console.warn('[ImageCache] Preload failed:', e);
        } finally {
            this.preloadingUrls.delete(url);
        }
    }

    async compressAndStore(url, blob) {
        try {
            const base64 = await this._compress(blob);
            const size = base64.length * 2; // 估算 UTF-16 字节大小
            let index = this._getIndex();

            // 检查并清理空间
            this._ensureQuota(size, index);

            const id = Math.random().toString(36).substring(2, 9);
            localStorage.setItem(this.prefix + id, base64);

            // 移除同 URL 的旧记录（如果存在）
            index = index.filter(e => e.url !== url);
            index.push({ url, id, size, lastAccess: Date.now() });

            this._saveIndex(index);
            return base64;
        } catch (e) {
            if (this.isDev) console.warn('[ImageCache] Caching failed:', e);
            return null;
        }
    }

    _ensureQuota(newSize, index) {
        let currentSize = index.reduce((sum, e) => sum + (e.size || 0), 0);
        if (currentSize + newSize > this.maxSize) {
            // LRU: 按最后访问时间排序
            index.sort((a, b) => (a.lastAccess || 0) - (b.lastAccess || 0));
            // 删除最旧的 20%
            const removeCount = Math.max(1, Math.floor(index.length * 0.2));
            const removed = index.splice(0, removeCount);
            removed.forEach(e => localStorage.removeItem(this.prefix + e.id));
            if (this.isDev) console.debug(`[ImageCache] LRU Evicted ${removeCount} items`);
        }
    }

    _compress(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 限制宽度 200px，按比例缩放
                const maxWidth = 200;
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 导出为 JPEG，质量 0.7
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                URL.revokeObjectURL(objectUrl);
                resolve(dataUrl);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Compression failed'));
            };
            img.src = objectUrl;
        });
    }
}

// 图片懒加载类
/**
 * LazyImageLoader - Handles lazy loading of images with authentication support
 *
 * For images that require proxy authentication (marked with data-needs-auth="true"),
 * this loader automatically adds auth parameters before loading the image.
 * This ensures images load correctly on Cloudflare deployment.
 */
class LazyImageLoader {
    constructor() {
        this.observer = null;
        this.loadingImages = new Map();
        this.isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.handleIntersection(entry.target);
                    }
                });
            }, {
                rootMargin: '50px'
            });
        }
    }

    async handleIntersection(img) {
        const originalSrc = img.dataset.src;
        if (!originalSrc) return;

        if (this.observer) {
            this.observer.unobserve(img);
        }

        // 1. 尝试从缓存获取
        if (window.imageCacheManager) {
            const cached = window.imageCacheManager.get(originalSrc);
            if (cached) {
                if (this.isDev) console.log('[LazyImageLoader] Cache HIT:', originalSrc);
                img.src = cached;
                return;
            } else {
                if (this.isDev) console.log('[LazyImageLoader] Cache MISS:', originalSrc);
            }
        }

        const timeoutId = setTimeout(() => {
            this.handleLoadError(img);
        }, 60000);

        this.loadingImages.set(img, timeoutId);

        let finalSrc = originalSrc;
        const needsAuth = img.dataset.needsAuth === 'true' || originalSrc.startsWith('/proxy/');

        if (needsAuth && window.ProxyAuth) {
            try {
                finalSrc = await window.ProxyAuth.addAuthToProxyUrl(originalSrc);
            } catch (e) {
                if (this.isDev) console.error('[LazyImageLoader] Auth failed:', e);
            }
        }

        // 2. 如果是代理图片，下载并缓存
        if (needsAuth && window.imageCacheManager) {
            try {
                if (this.isDev) console.log('[LazyImageLoader] Fetching and caching:', finalSrc);
                const response = await fetch(finalSrc);
                if (response.ok) {
                    const blob = await response.blob();
                    const compressed = await window.imageCacheManager.compressAndStore(originalSrc, blob);
                    if (compressed) {
                        finalSrc = compressed;
                        if (this.isDev) console.log('[LazyImageLoader] Cached successfully');
                    }
                }
            } catch (e) {
                if (this.isDev) console.warn('[LazyImageLoader] Cache process failed, using direct src:', e);
            }
        }

        img.onload = () => {
            clearTimeout(this.loadingImages.get(img));
            this.loadingImages.delete(img);
        };

        img.onerror = () => {
            clearTimeout(this.loadingImages.get(img));
            this.loadingImages.delete(img);
            if (this.isDev) console.error('[LazyImageLoader] Load failed:', finalSrc);
            this.handleLoadError(img);
        };

        img.src = finalSrc;
    }

    handleLoadError(img) {
        clearTimeout(this.loadingImages.get(img));
        this.loadingImages.delete(img);

        const parent = img.parentElement;
        if (parent) {
            parent.classList.remove('has-cover');
            img.style.display = 'none';
        }
    }

    observe(img) {
        if (this.observer && img.dataset.src) {
            this.observer.observe(img);
        } else if (img.dataset.src) {
            this.handleIntersection(img);
        }
    }

    observeAll(selector = 'img[data-src]') {
        const images = document.querySelectorAll(selector);

        // Log only in development
        if (this.isDev) {
            console.debug(`[LazyImageLoader] Observing ${images.length} images with selector: ${selector}`);
        }

        images.forEach(img => {
            this.observe(img);
        });
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.storageManager = new StorageManager(1000);
    window.concurrentPool = new ConcurrentPool(3);
    window.imageCacheManager = new ImageCacheManager(3 * 1024 * 1024);
    window.lazyImageLoader = new LazyImageLoader();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, ConcurrentPool, StorageManager, ImageCacheManager, isValidImageUrl };
}
