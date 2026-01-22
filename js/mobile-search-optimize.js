/*
 * LibreTV 移动端搜索展示优化 JavaScript
 * 搜索框固定 + 返回顶部 + 图片懒加载
 */

(function() {
    'use strict';

    // 仅在移动端执行
    if (window.innerWidth > 640) return;

    // ========================================
    // 1. 搜索框固定功能
    // ========================================

    let lastScrollTop = 0;
    let isSearchFixed = false;
    const searchArea = document.getElementById('searchArea');
    const resultsArea = document.getElementById('resultsArea');

    function handleSearchFixed() {
        // 只在搜索结果显示时才固定搜索框
        if (!resultsArea || resultsArea.classList.contains('hidden')) {
            return;
        }

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // 滚动超过200px时固定搜索框
        if (scrollTop > 200 && !isSearchFixed) {
            searchArea.classList.add('fixed-search');
            document.body.classList.add('search-fixed');
            isSearchFixed = true;
        } else if (scrollTop <= 200 && isSearchFixed) {
            searchArea.classList.remove('fixed-search');
            document.body.classList.remove('search-fixed');
            isSearchFixed = false;
        }

        lastScrollTop = scrollTop;
    }

    // ========================================
    // 2. 返回顶部按钮功能
    // ========================================

    const backToTopBtn = document.getElementById('backToTop');

    function handleBackToTop() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // 滚动超过300px时显示返回顶部按钮
        if (scrollTop > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    }

    // 点击返回顶部
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ========================================
    // 3. 滚动事件监听（节流优化）
    // ========================================

    let scrollTimeout;
    function handleScroll() {
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }

        scrollTimeout = window.requestAnimationFrame(function() {
            handleSearchFixed();
            handleBackToTop();
        });
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    // ========================================
    // 4. 图片懒加载优化
    // ========================================

    // 监听搜索结果的变化，为新添加的图片添加懒加载
    const originalCreateResultCard = window.createResultCard;
    if (typeof originalCreateResultCard === 'function') {
        window.createResultCard = function(...args) {
            const card = originalCreateResultCard.apply(this, args);

            // 为卡片中的图片添加懒加载
            const img = card.querySelector('img');
            if (img && !img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
                img.setAttribute('decoding', 'async');

                // 图片加载完成后添加loaded类
                img.addEventListener('load', function() {
                    img.classList.add('loaded');
                }, { once: true });
            }

            return card;
        };
    }

    // ========================================
    // 5. 窗口大小变化时重新检查
    // ========================================

    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // 如果窗口变大，移除移动端优化
            if (window.innerWidth > 640) {
                if (isSearchFixed) {
                    searchArea.classList.remove('fixed-search');
                    document.body.classList.remove('search-fixed');
                    isSearchFixed = false;
                }
                backToTopBtn.classList.remove('show');
            }
        }, 250);
    });

    // ========================================
    // 6. 初始化
    // ========================================

    // 页面加载时检查滚动位置
    handleScroll();

    console.log('移动端搜索优化已加载');
})();
