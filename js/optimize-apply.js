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

    // 优化2: 并发控制 - 重写搜索函数
    function applySearchConcurrency() {
        if (typeof window.search === 'function' && window.concurrentPool) {
            const originalSearch = window.search;

            window.search = async function() {
                // 调用原始搜索函数的前置逻辑
                const query = document.getElementById('searchInput').value.trim();
                if (!query) {
                    showToast && showToast('请输入搜索内容', 'info');
                    return;
                }

                if (window.selectedAPIs && window.selectedAPIs.length === 0) {
                    showToast && showToast('请至少选择一个API源', 'warning');
                    return;
                }

                // 使用并发池控制搜索请求
                showLoading && showLoading();

                const resultsDiv = document.getElementById('results');
                const skeletonDiv = document.getElementById('searchSkeleton');
                const resultsArea = document.getElementById('resultsArea');

                if (resultsDiv) resultsDiv.innerHTML = '';
                if (resultsDiv) resultsDiv.classList.add('hidden');
                if (skeletonDiv) skeletonDiv.classList.remove('hidden');
                if (resultsArea) resultsArea.classList.remove('hidden');

                try {
                    saveSearchHistory && saveSearchHistory(query);

                    let allResults = [];
                    const searchPromises = [];

                    // 使用并发池控制，每次最多3个并发请求
                    for (const apiId of window.selectedAPIs) {
                        searchPromises.push(
                            window.concurrentPool.run(() =>
                                window.searchByAPIAndKeyWord(apiId, query)
                            )
                        );
                    }

                    const resultsArray = await Promise.allSettled(searchPromises);

                    resultsArray.forEach(result => {
                        if (result.status === 'fulfilled' && result.value.results && Array.isArray(result.value.results)) {
                            allResults = allResults.concat(result.value.results);
                        }
                    });

                    // 继续使用原始搜索函数的后续逻辑
                    // 这里简化处理，实际应该调用原始函数的剩余部分
                    console.log('Search completed with', allResults.length, 'results');

                    // 调用原始搜索函数（如果需要）
                    // 注意：这里可能需要根据实际情况调整

                } catch (error) {
                    console.error('Search error:', error);
                    hideLoading && hideLoading();
                }
            };
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
                // applySearchConcurrency(); // 暂时注释，避免影响现有功能
                applyImageLazyLoading();
                setupStorageHelpers();
                console.log('✅ 优化已应用');
            }, 100);
        });
    } else {
        setTimeout(() => {
            applySearchDebounce();
            // applySearchConcurrency(); // 暂时注释，避免影响现有功能
            applyImageLazyLoading();
            setupStorageHelpers();
            console.log('✅ 优化已应用');
        }, 100);
    }
})();
