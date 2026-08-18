// 首页豆瓣热播轮播（槽位式 Coverflow）
// 数据源：豆瓣 API（movie.douban.com/j/search_subjects），电影/电视剧可切换。
// 中央槽位固定：当前凸显的影片始终停在正中央放大，两侧卡片逐级缩小压暗；
// 自动轮流时下一部平滑滑入中央凸显，循环连播。点击卡片触发该影片搜索。
(function() {
    'use strict';

    const PAGE_LIMIT = 20; // 豆瓣接口单次返回条数
    const MAX_ITEMS = 50; // 展示截断上限（豆瓣单次最多 20，防超长渲染）
    const AUTO_SCROLL_INTERVAL = 3000; // 自动轮流间隔（毫秒）
    // 中央卡放大凸显；两侧保持原始尺寸（scale 1，与最初全宽一致）
    const CENTER_SCALE = 1.2;
    // 距中央每远一级的亮度衰减（增强后两侧更暗，衬托中央凸显）
    const BRIGHTNESS_STEP = 0.08;
    // 超过该槽位距离的卡片完全隐藏（不参与视觉）
    const MAX_VISIBLE_DIST = 3;

    let autoScrollTimer = null;
    let resumeTimer = null;
    let activeIndex = 0; // 当前中央凸显的卡片索引
    let itemCount = 0; // 当前条数，供显示隐藏判断
    let renderRequestId = 0; // 渲染请求序号，用于处理类型/标签切换竞态
    const CACHE_TTL = 60 * 1000; // 热播数据缓存有效期（秒）
    let cache = { type: null, tag: null, items: [], ts: 0 }; // 最近一次拉取的类型/标签/数据/时间戳

    // 拉取豆瓣热播数据；复用 douban.js 的 fetchDoubanData（全局，script 顺序在其后）。
    // 类型与标签读 douban.js 全局状态 doubanMovieTvCurrentSwitch / doubanCurrentTag，
    // 但必须在发起请求时捕获快照 reqType/reqTag：URL 构造与 cache 写入共用同一时刻状态，
    // 避免快速切换类型/标签后旧请求乱序返回污染缓存键（电视剧标签下混入电影内容）。
    // 带独立总超时：douban.js 的 allorigins fallback 无 signal，可能长期悬挂，
    // 必须保证轮播在有限时间内降级为空态而不是永久空白（首次首页必经路径）
    function fetchDoubanSubjects(reqType, reqTag) {
        const target = `https://movie.douban.com/j/search_subjects?type=${reqType}&tag=${encodeURIComponent(reqTag)}&sort=recommend&page_limit=${PAGE_LIMIT}&page_start=0`;
        if (typeof fetchDoubanData !== 'function') {
            console.warn('[douban-hot] fetchDoubanData 不可用，豆瓣热播为空');
            return Promise.resolve([]);
        }
        const timedOut = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('douban-hot 拉取超时')), 12000);
        });
        return Promise.race([fetchDoubanData(target).then(data => (data && data.subjects) || []), timedOut]);
    }

    // 读取热播数据：缓存命中（同类型同标签且未过期）直接返回，否则拉取并更新缓存。
    // 缓存键与数据来自同一快照（发起请求时刻的 reqType/reqTag），乱序返回不污染当前状态
    function getSubjects() {
        const reqType = doubanMovieTvCurrentSwitch;
        const reqTag = doubanCurrentTag;
        if (cache.type === reqType &&
            cache.tag === reqTag &&
            Date.now() - cache.ts < CACHE_TTL) {
            return Promise.resolve(cache.items);
        }
        return fetchDoubanSubjects(reqType, reqTag).then((subjects) => {
            cache = { type: reqType, tag: reqTag, items: subjects || [], ts: Date.now() };
            return cache.items;
        });
    }

    // 封面代理 URL：仅同步构造 /proxy/ 前缀，auth 参数与缓存由 LazyImageLoader 统一追加
    //（optimize-apply.js MutationObserver 接管 img.lazy-load[data-src]），避免重复鉴权
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

    // 应用可见性：搜索结果显示时隐藏，无数据时隐藏。
    // 隐藏时同步停掉自动轮播定时器，避免区域不可见时空转（显示路径 render 会重新 start）
    function applyVisibility() {
        const area = document.getElementById('recentWatchArea');
        if (!area) return;
        const resultsArea = document.getElementById('resultsArea');
        const searching = resultsArea && !resultsArea.classList.contains('hidden');
        if (searching || itemCount === 0) {
            area.classList.add('hidden');
            stopAutoScroll();
        } else {
            area.classList.remove('hidden');
        }
    }

    // 卡片像素宽度（响应断点）：用于等视觉间距位置算法
    function getCardWidth(track) {
        const card = track.querySelector('.recent-watch-card');
        if (card && card.offsetWidth > 0) return card.offsetWidth;
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
        return isMobile ? 140 : 180;
    }

    // 等中心距位置计算：让所有相邻对卡片的中心距恒为 cardWidth + visualGap，
    // 视觉上"距离感"一致。中央卡放大（scale=1.2）使中央卡与第1级卡的留白比外侧对略窄，
    // 反而强化中央焦点（贴近两侧卡），符合 Coverflow 风格。
    function slotPosition(delta, cardWidth, visualGap) {
        const step = cardWidth + visualGap;
        return delta * step;
    }

    // 槽位式 Coverflow 排版（环形最短距离）：
    // delta 折叠到 [-half, half]，两侧对称展开；切换时 activeIndex 环形 ±1，
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
            // scale 必须并入 transform 末尾：独立 scale 属性围绕固定 transform-origin 缩放，
            // 会与 translateX 定位产生叠加偏移（中央卡 scale>1 时整体错位，左右空隙不对称）。
            // translate(-50%,-50%) translateX(pos) scale(s) 中 scale 先围绕卡片中心缩放、
            // translate 后移动，卡片中心精确落在槽位点，向两侧对称扩展。
            card.style.transform = `translate(-50%, -50%) translateX(${slotPosition(delta, cardWidth, 30)}px) scale(${scale})`;
            card.style.filter = `brightness(${brightness}) saturate(${Math.max(1 - dist * 0.15, 0.6)})`;
            card.style.zIndex = count - dist;
            card.style.opacity = dist > MAX_VISIBLE_DIST ? '0' : '1';
        });
    }

    // 推进到上一张/下一张：目标卡平滑滑入中央凸显（CSS transition 驱动动画），环形循环
    function advance(track, dir = 1) {
        const count = track.querySelectorAll('.recent-watch-card').length;
        if (count < 2) return;
        activeIndex = ((activeIndex + dir) % count + count) % count;
        updateCoverflow(track);
    }

    function render() {
        const area = document.getElementById('recentWatchArea');
        if (!area) return;
        const track = document.getElementById('recentWatchTrack');

        const requestId = ++renderRequestId;

        getSubjects()
            .then((subjects) => {
                if (requestId !== renderRequestId) return; // 类型切换后旧请求作废
                const items = (subjects || [])
                    .slice(0, MAX_ITEMS)
                    .map((s) => {
                        // 豆瓣 rate 为字符串（如 "8.9"），无评分影片返回 "0.0"；
                        // 归一化：0 / "0" / "0.0" 视为无评分（空串），保留原始字符串避免丢小数
                        const rawRate = String((s && s.rate) || '');
                        const rate = /^\s*0+(\.0+)?\s*$/.test(rawRate) ? '' : rawRate;
                        return {
                            title: String((s && s.title) || '未知影片'),
                            rate,
                            coverUrl: buildCoverUrl(s && s.cover)
                        };
                    });

                itemCount = items.length;
                updateNavButtons(items.length);

                if (items.length === 0) {
                    track.innerHTML = '';
                    activeIndex = 0;
                    stopAutoScroll();
                    clearTimeout(resumeTimer);
                    resumeTimer = null;
                    applyVisibility();
                    return;
                }

                const itemsHtml = items.map((item) => {
                    const rawTitle = item.title;
                    const safeTitle = escapeHtml(rawTitle || '未知影片');
                    const safeRate = escapeHtml(item.rate);
                    const safeCoverUrl = escapeHtml(item.coverUrl);
                    const gradientBg = window.generateGradientFromString
                        ? generateGradientFromString(rawTitle || '未知影片')
                        : 'linear-gradient(135deg, #333, #222)';
                    const contentIcon = window.getContentTypeIcon
                        ? getContentTypeIcon(rawTitle)
                        : '📺';
                    const ariaLabel = safeRate ? `${safeTitle} ${safeRate}分` : safeTitle;

                    // 占位符在底层（默认显示），封面加载成功覆盖、失败自动隐藏露出占位符
                    const coverHtml = item.coverUrl
                        ? `<img data-src="${safeCoverUrl}" alt="${safeTitle}" class="lazy-load recent-watch-cover-img">`
                        : '';

                    // 评分行：有评分才显示（★ 8.9），无评分整行省略
                const rateHtml = item.rate
                    ? `<span class="recent-watch-rate">★ <span class="recent-watch-rate-value">${safeRate}</span></span>`
                    : '';

                return `
                <div class="recent-watch-card" data-title="${safeTitle}" role="button" tabindex="0" aria-label="${ariaLabel}" title="${ariaLabel}">
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
                        ${rateHtml}
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
                if (items.length > 1) {
                    refreshCarousel();
                } else {
                    stopAutoScroll();
                }

                clearTimeout(resumeTimer);
                resumeTimer = null;
            })
            .catch((e) => {
                console.error('[douban-hot] 加载豆瓣热播失败:', e);
                itemCount = 0;
                track.innerHTML = '';
                stopAutoScroll();
                applyVisibility();
            });
    }

    // 入场动画延迟：按卡片距中央槽位的视觉距离（dist=|delta|）分配，
    // 中央先出、左右两侧对称淡入——避免按 DOM index 递增导致左侧卡（index 最大）透明最久，
    // 形成"左侧空白、过一会才加载出来"的视觉割裂（槽位位移由 updateCoverflow 一次性排版，不依赖延迟）
    function applyEntranceDelays(track) {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;
        const realCards = track.querySelectorAll('.recent-watch-card:not([aria-hidden])');
        const count = realCards.length;
        if (!count) return;
        const half = Math.floor(count / 2);
        realCards.forEach((card, i) => {
            let delta = ((i - activeIndex) % count + count) % count;
            if (delta > half) delta -= count;
            const dist = Math.abs(delta);
            card.style.animationDelay = `${Math.min(dist * 80, 400)}ms`;
        });
    }

    // 左右切换按钮可见性：超过 1 部影片才需要手动切换，否则隐藏
    function updateNavButtons(count) {
        const prevBtn = document.getElementById('recentWatchPrevBtn');
        const nextBtn = document.getElementById('recentWatchNextBtn');
        const show = count > 1;
        if (prevBtn) prevBtn.classList.toggle('hidden', !show);
        if (nextBtn) nextBtn.classList.toggle('hidden', !show);
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

        // 卡片点击/键盘事件委托到轨道：点击热播影片触发豆瓣搜索（与豆瓣推荐区行为一致）
        function triggerSearch(title) {
            if (title && typeof fillAndSearchWithDouban === 'function') {
                fillAndSearchWithDouban(title);
            }
        }

        track.addEventListener('click', (e) => {
            const card = e.target.closest('.recent-watch-card');
            if (!card) return;
            triggerSearch(card.getAttribute('data-title'));
        });
        track.addEventListener('keydown', (e) => {
            // 左右方向键手动切换上一部/下一部（与左右按钮行为一致）
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                pauseFor(track);
                advance(track, e.key === 'ArrowRight' ? 1 : -1);
                return;
            }
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.recent-watch-card');
            if (!card) return;
            e.preventDefault();
            triggerSearch(card.getAttribute('data-title'));
        });

        // 鼠标移入影片停止轮流，移出恢复
        track.addEventListener('mouseenter', stopAutoScroll);
        track.addEventListener('mouseleave', () => startAutoScroll(track));

        // 左右切换按钮：点击切换上一部/下一部，交互时暂停自动轮流（6s 后恢复）
        const prevBtn = document.getElementById('recentWatchPrevBtn');
        const nextBtn = document.getElementById('recentWatchNextBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                pauseFor(track);
                advance(track, -1);
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                pauseFor(track);
                advance(track, 1);
            });
        }
    }

    // 电影/电视剧切换：更新 douban.js 全局类型状态、重置标签为「热门」、
    // 重渲染标签条并刷新轮播（renderRequestId 递增保证旧请求结果被丢弃）
    function setType(type) {
        if (doubanMovieTvCurrentSwitch === type) return;
        doubanMovieTvCurrentSwitch = type;
        doubanCurrentTag = '热门';
        const movieBtn = document.getElementById('doubanHotMovieBtn');
        const tvBtn = document.getElementById('doubanHotTvBtn');
        if (movieBtn && tvBtn) {
            const active = ['bg-pink-600', 'text-white'];
            const idle = ['text-gray-300'];
            if (type === 'movie') {
                movieBtn.classList.add(...active);
                movieBtn.classList.remove(...idle);
                tvBtn.classList.remove(...active);
                tvBtn.classList.add(...idle);
            } else {
                tvBtn.classList.add(...active);
                tvBtn.classList.remove(...idle);
                movieBtn.classList.remove(...active);
                movieBtn.classList.add(...idle);
            }
        }
        // 标签条随类型切换（douban.js 全局函数，按 movieTags/tvTags 重渲染并高亮「热门」）
        if (typeof renderDoubanTags === 'function') {
            renderDoubanTags();
        }
        render();
    }

    // 一次性绑定电影/电视剧切换按钮事件
    function bindTypeSwitch() {
        const movieBtn = document.getElementById('doubanHotMovieBtn');
        const tvBtn = document.getElementById('doubanHotTvBtn');
        if (movieBtn) movieBtn.addEventListener('click', () => setType('movie'));
        if (tvBtn) tvBtn.addEventListener('click', () => setType('tv'));
    }

    // 内容变化后刷新自动轮流（事件已由 bindCarouselControls 一次性绑定）
    function refreshCarousel() {
        const track = document.getElementById('recentWatchTrack');
        if (!track) return;
        startAutoScroll(track);
    }

    function init() {
        bindCarouselControls();
        bindTypeSwitch();
        // 确保标签数据已加载并渲染标签条（douban.js 全局；loadUserTags 幂等）
        if (typeof loadUserTags === 'function') {
            loadUserTags();
        }
        if (typeof renderDoubanTags === 'function') {
            renderDoubanTags();
        }
        render();
        // 打开播放页/搜索结果后由 app.js 显式隐藏，这里兜底处理"回退/前进"导航（同步数据并应用可见性）
        window.addEventListener('popstate', render);
    }

    document.addEventListener('DOMContentLoaded', init);

    // 暴露给 app.js 在搜索/播放状态切换时调用：同步最新数据并应用可见性（render 幂等）
    window.updateRecentWatchVisibility = render;
    window.reloadRecentWatch = render;
})();
