// 首页最近观看轮播
// 读取 localStorage.viewingHistory（最新在前），取前 10 条以小卡片轮播展示，点击跳转历史记录对应播放链接
(function() {
    'use strict';

    const HISTORY_KEY = 'viewingHistory';
    const MAX_ITEMS = 10;
    const AUTO_SCROLL_INTERVAL = 4000; // 自动轮播间隔（毫秒）

    let autoScrollTimer = null;
    let resumeTimer = null;
    let programmaticScroll = false;
    let historyCount = 0; // 当前历史条数，供显示隐藏判断，避免高频路径重复解析 localStorage

    function getHistory() {
        try {
            const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            // 健壮性：非数组数据（对象/原始值）一律视为空历史，避免渲染崩溃
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    // 封面代理 URL，与 ui.js 历史列表同一逻辑
    function buildCoverUrl(rawCoverUrl) {
        if (!rawCoverUrl) return '';
        const url = String(rawCoverUrl).trim();
        try {
            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
                const normalized = url.startsWith('//') ? window.location.protocol + url : url;
                return `/proxy/${encodeURIComponent(normalized).replace(/'/g, '%27')}`;
            }
            if (url.startsWith('/')) return url;
        } catch (e) { /* ignore */ }
        return '';
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 应用可见性：搜索结果显示时隐藏，无历史时隐藏
    function applyVisibility() {
        const area = document.getElementById('recentWatchArea');
        if (!area) return;
        const resultsArea = document.getElementById('resultsArea');
        const searching = resultsArea && !resultsArea.classList.contains('hidden');
        if (searching || historyCount === 0) {
            area.classList.add('hidden');
        } else {
            area.classList.remove('hidden');
        }
    }

    // 仅允许 http/https 链接跳转，避免 javascript: 等 scheme 注入执行
    function navigateTo(url) {
        if (!url) return;
        try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                window.location.href = url;
            }
        } catch (e) { /* 非法 URL 忽略 */ }
    }

    function render() {
        const area = document.getElementById('recentWatchArea');
        if (!area) return;
        const track = document.getElementById('recentWatchTrack');

        // 过滤非对象条目（如 [null]），避免渲染崩溃
        const history = getHistory().filter(item => item && typeof item === 'object').slice(0, MAX_ITEMS);
        historyCount = history.length;

        if (history.length === 0) {
            track.innerHTML = '';
            stopAutoScroll();
            clearTimeout(resumeTimer);
            resumeTimer = null;
            applyVisibility();
            return;
        }

        track.innerHTML = history.map((item) => {
            // title 先强制字符串化：异常数据类型（对象/数组/数字）不会让 ui.js 的渐变/图标函数抛错拖垮整个渲染
            const rawTitle = String(item.title || '');
            const safeTitle = escapeHtml(rawTitle || '未知视频');
            const coverUrl = buildCoverUrl(item.vod_pic);
            const safeCoverUrl = escapeHtml(coverUrl);
            const gradientBg = window.generateGradientFromString
                ? generateGradientFromString(rawTitle || '未知视频')
                : 'linear-gradient(135deg, #333, #222)';
            const contentIcon = window.getContentTypeIcon
                ? getContentTypeIcon(rawTitle)
                : '📺';
            const safeUrl = escapeHtml(item.url || '');

            // 占位符在底层（默认显示），封面加载成功覆盖、失败自动隐藏露出占位符
            const coverHtml = coverUrl
                ? `<img data-src="${safeCoverUrl}" alt="${safeTitle}" class="lazy-load recent-watch-cover-img">`
                : '';

            return `
                <div class="recent-watch-card" data-url="${safeUrl}" role="button" tabindex="0" aria-label="${safeTitle}" title="${safeTitle}">
                    <div class="recent-watch-cover">
                        <div class="recent-watch-placeholder" style="background:${gradientBg};">
                            <span class="recent-watch-icon">${contentIcon}</span>
                        </div>
                        ${coverHtml}
                    </div>
                </div>
            `;
        }).join('');

        clearTimeout(resumeTimer);
        resumeTimer = null;
        applyVisibility();
        refreshCarousel();
    }

    // 单步滚动距离：一张卡片宽 + 间距
    function stepWidth(track) {
        const card = track.querySelector('.recent-watch-card');
        const gap = parseFloat(getComputedStyle(track).columnGap) || 12;
        return card ? card.offsetWidth + gap : 200;
    }

    function updateArrows(track) {
        const prev = document.getElementById('recentWatchPrev');
        const next = document.getElementById('recentWatchNext');
        if (!prev || !next) return;
        const maxScroll = track.scrollWidth - track.clientWidth;
        prev.classList.toggle('disabled', track.scrollLeft <= 5);
        next.classList.toggle('disabled', track.scrollLeft >= maxScroll - 5);
    }

    function stopAutoScroll() {
        if (autoScrollTimer) {
            clearInterval(autoScrollTimer);
            autoScrollTimer = null;
        }
    }

    function scrollByStep(track) {
        programmaticScroll = true;
        const maxScroll = track.scrollWidth - track.clientWidth;
        if (track.scrollLeft >= maxScroll - 2) {
            track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            track.scrollBy({ left: stepWidth(track), behavior: 'smooth' });
        }
        // smooth 滚动动画期间保持程序滚动标记，避免被 scroll 事件当作用户交互
        setTimeout(() => { programmaticScroll = false; }, 800);
    }

    function startAutoScroll(track) {
        stopAutoScroll();
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;
        autoScrollTimer = setInterval(() => {
            const area = document.getElementById('recentWatchArea');
            if (!area || area.classList.contains('hidden') || document.hidden) return;
            scrollByStep(track);
        }, AUTO_SCROLL_INTERVAL);
    }

    // 用户交互后暂停自动轮播，一段时间后恢复
    function pauseFor(track) {
        stopAutoScroll();
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => startAutoScroll(track), 6000);
    }

    // 一次性绑定控件事件（事件只绑一次，重复渲染不会累积监听器）
    function bindCarouselControls() {
        const track = document.getElementById('recentWatchTrack');
        const prev = document.getElementById('recentWatchPrev');
        const next = document.getElementById('recentWatchNext');
        if (!track) return;

        // 卡片点击/键盘事件委托到轨道
        track.addEventListener('click', (e) => {
            const card = e.target.closest('.recent-watch-card');
            if (!card) return;
            navigateTo(card.getAttribute('data-url'));
        });
        track.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.recent-watch-card');
            if (!card) return;
            e.preventDefault();
            navigateTo(card.getAttribute('data-url'));
        });

        if (prev) {
            prev.addEventListener('click', () => {
                track.scrollBy({ left: -stepWidth(track), behavior: 'smooth' });
            });
        }
        if (next) {
            next.addEventListener('click', () => {
                track.scrollBy({ left: stepWidth(track), behavior: 'smooth' });
            });
        }

        track.addEventListener('scroll', () => {
            updateArrows(track);
            if (!programmaticScroll) pauseFor(track);
        }, { passive: true });
        track.addEventListener('mouseenter', stopAutoScroll);
        track.addEventListener('mouseleave', () => startAutoScroll(track));
        track.addEventListener('touchstart', () => pauseFor(track), { passive: true });
    }

    // 内容变化后刷新箭头与自动轮播（事件已由 bindCarouselControls 一次性绑定）
    function refreshCarousel() {
        const track = document.getElementById('recentWatchTrack');
        if (!track) return;
        updateArrows(track);
        startAutoScroll(track);
    }

    function init() {
        bindCarouselControls();
        render();
        // 打开播放页/搜索结果后由 app.js 显式隐藏，这里兜底处理"回退/前进"导航（同步最新历史并应用可见性）
        window.addEventListener('popstate', render);
    }

    document.addEventListener('DOMContentLoaded', init);

    // 暴露给 app.js 在搜索/播放状态切换时调用：同步最新历史数据并应用可见性（render 幂等）
    window.updateRecentWatchVisibility = render;
    window.reloadRecentWatch = render;
})();
