/**
 * 优化应用脚本
 * 在页面加载时自动应用各项优化
 */

(function() {
    'use strict';

    // 优化9: 搜索防抖
    function applySearchDebounce() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && typeof debounce === 'function') {
            const debouncedHandler = debounce((e) => {
                const query = e.target.value.trim();
                if (query.length > 0) {
                    // 未来可以在这里添加搜索建议功能
                    console.log('Search input:', query);
                }
            }, 300);

            searchInput.addEventListener('input', debouncedHandler);
        }
    }

    // 优化6: 图片懒加载
    function applyImageLazyLoading() {
        if (window.lazyImageLoader) {
            // 监听 DOM 变化，自动应用懒加载
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // 查找新添加的图片
                            const images = node.querySelectorAll ? node.querySelectorAll('img[data-src]') : [];
                            images.forEach(img => window.lazyImageLoader.observe(img));

                            // 如果节点本身是图片
                            if (node.tagName === 'IMG' && node.dataset.src) {
                                window.lazyImageLoader.observe(node);
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 初始化已存在的图片
            window.lazyImageLoader.observeAll();
        }
    }

    // 优化3: localStorage 防抖 - 提供辅助函数
    function setupStorageHelpers() {
        if (window.storageManager) {
            // 为常用的 localStorage 操作提供便捷方法
            window.saveConfig = function(key, value) {
                window.storageManager.setItem(key, value);
            };

            window.getConfig = function(key) {
                return window.storageManager.getItem(key);
            };

            window.saveConfigImmediate = function(key, value) {
                window.storageManager.setItemImmediate(key, value);
            };
        }
    }

    // 页面加载完成后应用优化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                applySearchDebounce();
                applyImageLazyLoading();
                setupStorageHelpers();
                console.log('✅ 优化已应用');
            }, 100);
        });
    } else {
        setTimeout(() => {
            applySearchDebounce();
            applyImageLazyLoading();
            setupStorageHelpers();
            console.log('✅ 优化已应用');
        }, 100);
    }
})();
