// 首页最近观看轮播（槽位式 Coverflow）
// 读取 localStorage.viewingHistory（最新在前），历史有多少条就展示多少条（按 title 去重，上限 50）。
// 中央槽位固定：当前凸显的影片始终停在正中央放大，两侧卡片逐级缩小压暗；
// 自动轮流时下一部平滑滑入中央凸显，循环连播。点击卡片跳转历史记录对应播放链接。
(function() {
    'use strict';

    const HISTORY_KEY = 'viewingHistory';
    // 展示数量与历史记录面板拉齐：历史存储上限 50 条（见 ui.js addToViewingHistory / player.js saveToHistory）
    const MAX_ITEMS = 50;
    const AUTO_SCROLL_INTERVAL = 3000; // 自动轮流间隔（毫秒）
    // 中央卡放大凸显；两侧保持原始尺寸（scale 1，与最初全宽一致）
    const CENTER_SCALE = 1.1;
    // 距中央每远一级的亮度衰减
    const BRIGHTNESS_STEP = 0.06;
    // 超过该槽位距离的卡片完全隐藏（不参与视觉）
    const MAX_VISIBLE_DIST = 3;

    let autoScrollTimer = null;
    let resumeTimer = null;
    let activeIndex = 0; // 当前中央凸显的卡片索引
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

    // 卡片像素宽度（响应断点）：用于等视觉间距位置算法
    function getCardWidth(track) {
        const card = track.querySelector('.recent-watch-card');
        if (card && card.offsetWidth > 0) return card.offsetWidth;
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
        return isMobile ? 140 : 180;
    }

    // 等视觉间距位置计算：从中央(0)向两侧按 |delta| 升序累加，
    // 单个槽位位置：从中央(0)向 |delta| 逐级累加，每级视觉间距恒为 visualGap。
    // pos(delta) = sign(delta) * Σ [visualGap + (scale(k-1) + scale(k)) * cardWidth / 2]，k = 1..|delta|
    function slotPosition(delta, cardWidth, visualGap) {
        const scaleForDist = dist => (dist === 0 ? CENTER_SCALE : 1);
        const sign = delta > 0 ? 1 : -1;
        let pos = 0;
        for (let k = 1; k <= Math.abs(delta); k++) {
            const step = visualGap + (scaleForDist(k - 1) + scaleForDist(k)) * cardWidth / 2;
            pos += sign * step;
        }
        return pos;
    }

    // 槽位式 Coverflow 排版（环形最短距离）：
    // delta 折叠到 [-half, half]，两侧对称展开；切换时 activeIndex 环形 +1，
    // 循环轮流连播。中央卡放大凸显，两侧同宽；距中央超过 MAX_VISIBLE_DIST 的卡淡出隐藏
    function updateCoverflow(track) {
        const cards = track.querySelectorAll('.recent-watch-card');
        const count = cards.length;
        if (!count) return;
        const cardWidth = getCardWidth(track);
        const half = Math.floor(count / 2);
        cards.forEach((card, i) => {
            let delta = ((i - activeIndex) % count + count) % count;
            if (delta > half) delta -= count;
            const dist = Math.abs(delta);
            // 中央放大凸显，两侧保持原始尺寸
            const scale = dist === 0 ? CENTER_SCALE : 1;
            const brightness = Math.max(1 - dist * BRIGHTNESS_STEP, 0.6);
            card.style.transform = `translate(-50%, -50%) translateX(${slotPosition(delta, cardWidth, 24)}px)`;
            card.style.scale = scale;
            card.style.filter = `brightness(${brightness}) saturate(${Math.max(1 - dist * 0.12, 0.6)})`;
            card.style.zIndex = count - dist;
            card.style.opacity = dist > MAX_VISIBLE_DIST ? '0' : '1';
        });
    }

    // 推进到下一张：下一部平滑滑入中央凸显（CSS transition 驱动动画），环形循环
    function advance(track) {
        const count = track.querySelectorAll('.recent-watch-card').length;
        if (count < 2) return;
        activeIndex = (activeIndex + 1) % count;
        updateCoverflow(track);
    }

    function render() {
        const area = document.getElementById('recentWatchArea');
        if (!area) return;
        const track = document.getElementById('recentWatchTrack');

        // 过滤非对象条目（如 [null]）避免渲染崩溃；
        // 按 title 归一化去重（保留最新一条）：历史可能因旧版本残留/不同源写入同影片多条记录，
        // 归一化（trim + 小写 + 去空白）可合并 "赌神" 与 "赌神 "、"GOD OF GAMBLERS" 与 "god of gamblers" 等细微差异
        const seenTitles = new Set();
        const history = getHistory()
            .filter(item => item && typeof item === 'object')
            .filter(item => {
                const titleKey = String(item.title || '').trim().toLowerCase().replace(/\s+/g, '');
                if (!titleKey || seenTitles.has(titleKey)) return false;
                seenTitles.add(titleKey);
                return true;
            })
            .slice(0, MAX_ITEMS);
        historyCount = history.length;

        if (history.length === 0) {
            track.innerHTML = '';
            stopAutoScroll();
            clearTimeout(resumeTimer);
            resumeTimer = null;
            applyVisibility();
            return;
        }

        const itemsHtml = history.map((item) => {
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
                    <div class="recent-watch-play" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
                    </div>
                    <div class="recent-watch-info" aria-hidden="true">
                        <span class="recent-watch-title">${safeTitle}</span>
                    </div>
                </div>
            `;
        }).join('');
        // 先应用可见性再渲染：display:none 下 offsetWidth 为 0，gap 会回退到断点值，
        // 但显示路径（app.js updateRecentWatchVisibility）会重新 render，排版随即正确
        applyVisibility();

        track.innerHTML = itemsHtml;
        activeIndex = 0; // 第一部影片在中央凸显，然后逐张轮流
        updateCoverflow(track);

        applyEntranceDelays(track);

        // 多于 1 部影片时自动轮流连播；单张/无动画偏好下静态展示
        if (history.length > 1) {
            refreshCarousel();
        } else {
            stopAutoScroll();
        }

        clearTimeout(resumeTimer);
        resumeTimer = null;
    }

    // 入场动画延迟：卡片按序递增淡入（槽位位移由 updateCoverflow 一次性排版，不依赖延迟）
    function applyEntranceDelays(track) {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;
        const realCards = track.querySelectorAll('.recent-watch-card:not([aria-hidden])');
        realCards.forEach((card, index) => {
            card.style.animationDelay = `${Math.min(index * 60, 800)}ms`;
        });
    }

    function stopAutoScroll() {
        if (autoScrollTimer) {
            clearInterval(autoScrollTimer);
            autoScrollTimer = null;
        }
    }

    function startAutoScroll(track) {
        stopAutoScroll();
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;
        autoScrollTimer = setInterval(() => {
            const area = document.getElementById('recentWatchArea');
            if (!area || area.classList.contains('hidden') || document.hidden) return;
            advance(track);
        }, AUTO_SCROLL_INTERVAL);
    }

    // 用户交互后暂停自动轮流，一段时间后恢复
    function pauseFor(track) {
        stopAutoScroll();
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => startAutoScroll(track), 6000);
    }

    // 一次性绑定控件事件（事件只绑一次，重复渲染不会累积监听器）
    function bindCarouselControls() {
        const track = document.getElementById('recentWatchTrack');
        if (!track) return;

        // 跳转前把该历史条目的集数列表同步到 localStorage.currentEpisodes，
        // 与 ui.js playFromHistory 行为一致，避免播放页读到上一次播放的剧集列表导致集数显示错误
        function prepareEpisodeContextForNavigation(itemUrl) {
            if (!itemUrl) return;
            try {
                const item = getHistory().find(h => h && h.url === itemUrl);
                if (item && Array.isArray(item.episodes) && item.episodes.length > 0) {
                    localStorage.setItem('currentEpisodes', JSON.stringify(item.episodes));
                } else if (!item) {
                    // url 与当前历史失配（如跨标签页对同名剧就地更新 url）时记录日志，
                    // 避免"播放页读到上一次播放集数"的问题在边缘场景下静默复发
                    console.warn('[recent-watch] 观看历史中未找到匹配项，集数列表未同步:', itemUrl);
                }
            } catch (e) { /* 集数同步失败不阻断跳转 */ }
        }

        // 卡片点击/键盘事件委托到轨道
        track.addEventListener('click', (e) => {
            const card = e.target.closest('.recent-watch-card');
            if (!card) return;
            const url = card.getAttribute('data-url');
            prepareEpisodeContextForNavigation(url);
            navigateTo(url);
        });
        track.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.recent-watch-card');
            if (!card) return;
            e.preventDefault();
            const url = card.getAttribute('data-url');
            prepareEpisodeContextForNavigation(url);
            navigateTo(url);
        });

        // 鼠标移入影片停止轮流，移出恢复
        track.addEventListener('mouseenter', stopAutoScroll);
        track.addEventListener('mouseleave', () => startAutoScroll(track));
        track.addEventListener('touchstart', () => pauseFor(track), { passive: true });
    }

    // 内容变化后刷新自动轮流（事件已由 bindCarouselControls 一次性绑定）
    function refreshCarousel() {
        const track = document.getElementById('recentWatchTrack');
        if (!track) return;
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
