/**
 * 优化应用脚本
 * 在页面加载时自动应用各项优化
 */

(function() {
    'use strict';

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

    // 页面加载完成后应用优化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                applyImageLazyLoading();
                console.log('✅ 优化已应用');
            }, 100);
        });
    } else {
        setTimeout(() => {
            applyImageLazyLoading();
            console.log('✅ 优化已应用');
        }, 100);
    }
})();
