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


// 图片本地缓存管理类
class ImageCacheManager {
    constructor(maxSize = 3 * 1024 * 1024) {
        this.maxSize = maxSize; // 默认 3MB
        this.indexKey = 'img_cache_index';
        this.prefix = 'img_cache_data_';
        this.isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.preloadingUrls = new Set(); // 防止重复下载
        // index「读-改-写」互斥队列：compressAndStore 的 _compress 是异步的，
        // 多个并发写入各自持有过期 index 快照会互相覆盖丢失条目（预取多封面时触发）。
        // 只串行化写回段（_getIndex→_saveIndex），压缩仍在链外并发，不拖慢下载
        this._storeChain = Promise.resolve();
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
            // 压缩留在互斥队列外并发执行（canvas 压缩是耗时主线程操作，不排队拖慢下载）
            const base64 = await this._compress(blob);
            if (!base64) return null;
            const size = base64.length * 2; // 估算 UTF-16 字节大小
            // index 读-改-写走互斥队列，避免并发写入互相覆盖丢失条目
            await this._enqueueStore(url, base64, size);
            return base64;
        } catch (e) {
            if (this.isDev) console.warn('[ImageCache] Caching failed:', e);
            return null;
        }
    }

    // index 写回互斥段：_getIndex→_ensureQuota→setItem→_saveIndex 全程串行。
    // _compress 异步导致多个 compressAndStore 并发时各自持有过期 index 快照，
    // 直接写回会互相覆盖（A 的条目丢失/孤儿数据累积）。链式队列保证同一时刻只一个写回。
    _enqueueStore(url, base64, size) {
        const task = () => {
            let index = this._getIndex();

            // 检查并清理空间
            this._ensureQuota(size, index);

            const id = Math.random().toString(36).substring(2, 9);
            localStorage.setItem(this.prefix + id, base64);

            // 移除同 URL 的旧记录（如果存在）
            index = index.filter(e => e.url !== url);
            index.push({ url, id, size, lastAccess: Date.now() });

            this._saveIndex(index);
        };
        // 链上挂本次任务；catch 兜底防止单次失败卡死整条链
        const run = this._storeChain.then(task, task);
        this._storeChain = run.catch(() => {});
        return run;
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
            // 使用 FileReader 读取 blob，避免 CSP 阻止 blob: URL
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    try {
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
                        resolve(dataUrl);
                    } catch (error) {
                        reject(error);
                    }
                };

                img.onerror = () => {
                    reject(new Error('Image load failed'));
                };

                // 直接使用 base64 data URL，不使用 blob URL
                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new Error('FileReader failed'));
            };

            // 读取为 data URL
            reader.readAsDataURL(blob);
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
                // 先设 src、等 onload 解码完成后再标记淡入：data URL 解码期间 img 空白，
                // 若提前加 is-loaded（opacity 立即 1）会在解码完成瞬间硬出现——"闪"的根源
                img.onload = () => {
                    img.classList.add('is-loaded');
                };
                img.onerror = () => {
                    // 缓存 data URL 损坏：降级隐藏露出占位符
                    this.handleLoadError(img);
                };
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
            // 加载完成标记：CSS 据此淡入封面（.is-loaded），消除占位符→封面硬切换
            img.classList.add('is-loaded');
        };

        img.onerror = () => {
            clearTimeout(this.loadingImages.get(img));
            this.loadingImages.delete(img);
            if (this.isDev) console.error('[LazyImageLoader] Load failed:', finalSrc);
            // 兜底：预取可能在本 img 进入 fetch 路径后才异步完成写入缓存。
            // 隐藏前再查一次，命中则恢复显示，避免「预取已就绪但封面被钉死在占位符」。
            // dataset 标记防死循环：缓存 data URL 若损坏，重试仍失败时不再查第二次。
            const retry = !img.dataset.prefetchRetried && window.imageCacheManager
                ? window.imageCacheManager.get(originalSrc)
                : null;
            if (retry) {
                img.dataset.prefetchRetried = '1';
                if (this.isDev) console.log('[LazyImageLoader] Prefetch finished during load, using cache:', originalSrc);
                // 不提前标记：设 src 后外层 img.onload 会在解码完成时加 is-loaded 淡入，
                // 避免"提前标记→硬出现"闪烁
                img.src = retry;
                return;
            }
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
        // 清掉加载标记：失败隐藏时若残留 is-loaded，未来复用该 img 且重置 display
        // 会暴露出损坏封面盖住占位符；保持「无标记=未加载」语义干净
        img.classList.remove('is-loaded');
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
    window.imageCacheManager = new ImageCacheManager(3 * 1024 * 1024);
    window.lazyImageLoader = new LazyImageLoader();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, ImageCacheManager, isValidImageUrl };
}
