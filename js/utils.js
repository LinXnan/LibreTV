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

// 根据标题生成渐变色
function generateColorFromTitle(title) {
    const hash = Array.from(title).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue1 = hash % 360;
    const hue2 = (hash * 137) % 360;
    return `hsl(${hue1}, 60%, 30%), hsl(${hue2}, 60%, 20%)`;
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

        const timeoutId = setTimeout(() => {
            this.handleLoadError(img);
        }, 60000);

        this.loadingImages.set(img, timeoutId);

        let finalSrc = originalSrc;

        // Check if image needs authentication (both attribute AND URL prefix required)
        if (img.dataset.needsAuth === 'true' && originalSrc.startsWith('/proxy/')) {
            try {
                // Check ProxyAuth availability
                if (window.ProxyAuth && typeof window.ProxyAuth.addAuthToProxyUrl === 'function') {
                    finalSrc = await window.ProxyAuth.addAuthToProxyUrl(originalSrc);

                    // Log only in development
                    if (this.isDev) {
                        console.debug('[LazyImageLoader] Added auth to image URL');
                    }
                } else if (this.isDev) {
                    console.warn('[LazyImageLoader] ProxyAuth not available, image may fail to load');
                }
            } catch (e) {
                if (this.isDev) {
                    console.error('[LazyImageLoader] Failed to add auth to image URL:', e);
                }
                // Fall back to original URL (will return 401 but provides error visibility)
            }
        } else if (originalSrc.startsWith('/proxy/')) {
            // Backward compatibility: handle proxy URLs without data-needs-auth attribute
            if (window.ProxyAuth && typeof window.ProxyAuth.addAuthToProxyUrl === 'function') {
                try {
                    finalSrc = await window.ProxyAuth.addAuthToProxyUrl(originalSrc);
                } catch (e) {
                    if (this.isDev) {
                        console.error('图片鉴权失败:', e);
                    }
                    // Fall back to original URL instead of failing immediately
                }
            }
        }

        // Set event handlers before setting src to avoid missing cached-load events
        img.onload = () => {
            clearTimeout(this.loadingImages.get(img));
            this.loadingImages.delete(img);
        };

        img.onerror = () => {
            clearTimeout(this.loadingImages.get(img));
            this.loadingImages.delete(img);
            if (this.isDev) {
                console.error('[LazyImageLoader] Failed to load image:', finalSrc);
            }
            this.handleLoadError(img);
        };

        img.src = finalSrc;
    }

    handleLoadError(img) {
        clearTimeout(this.loadingImages.get(img));
        this.loadingImages.delete(img);

        const title = img.alt || '未知';
        const parent = img.parentElement;
        if (parent) {
            parent.style.background = `linear-gradient(135deg, ${generateColorFromTitle(title)})`;
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
    window.lazyImageLoader = new LazyImageLoader();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, ConcurrentPool, StorageManager, isValidImageUrl, generateColorFromTitle };
}
