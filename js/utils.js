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

// localStorage 管理类（带防抖）
class StorageManager {
    constructor(debounceTime = 1000) {
        this.debounceTime = debounceTime;
        this.timers = new Map();
        this.cache = new Map();
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

    // 立即写入（用于关键数据）
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
}

// 图片懒加载类
class LazyImageLoader {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            this.observer.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px'
            });
        }
    }

    observe(img) {
        if (this.observer && img.dataset.src) {
            this.observer.observe(img);
        } else if (img.dataset.src) {
            // 降级方案：直接加载
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        }
    }

    observeAll(selector = 'img[data-src]') {
        document.querySelectorAll(selector).forEach(img => {
            this.observe(img);
        });
    }
}

// 创建全局实例
window.storageManager = new StorageManager(1000);
window.concurrentPool = new ConcurrentPool(3);
window.lazyImageLoader = new LazyImageLoader();
