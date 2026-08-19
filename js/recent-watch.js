// 首页豆瓣热播轮播（槽位式 Coverflow）
// 数据源：豆瓣 API（movie.douban.com/j/search_subjects），电影/电视剧可切换。
// 中央槽位固定：当前凸显的影片始终停在正中央放大，两侧卡片逐级缩小压暗；
// 自动轮流时下一部平滑滑入中央凸显，循环连播。点击卡片触发该影片搜索。
(function() {
    'use strict';

    const PAGE_LIMIT = 10; // 每标签最多展示的影片数（豆瓣接口 page_limit，即每批条数）
    const MAX_ITEMS = 50; // 展示截断上限（防超长渲染，保留兜底）
    // 首次渲染只展示前 FIRST_BATCH 部影片（封面就绪即整批展示），
    // 剩余影片在首批展示后渐进追加——首屏只需等 5 张封面而非全部 10 张
    const FIRST_BATCH = 5;
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
    let batchPending = false; // 换一批加载互斥：fetch 期间阻止连点导致 pageStart 无监督累加
    let pageStart = 0; // 当前页偏移（豆瓣 page_start）：换一批时 += PAGE_LIMIT
    const CACHE_TTL = 60 * 1000; // 热播数据缓存有效期（秒）
    const CACHE_MAX = 20; // 缓存键上限：容纳全部标签（movie 17 / tv 10）+ 少量翻页键，超限淘汰最旧（LRU）
    // 多槽缓存：键 = `${type}|${tag}|${pageStart}` → { items, ts }。
    // 相比单槽缓存，切走再切回已浏览过的标签直接命中，不用重新请求；
    // 键含 pageStart，避免换一批后仍命中同类型同标签的旧页数据
    let cacheMap = new Map();
    // 预取防重：正在预取中的键集合，避免同一标签被重复拉取
    const prefetching = new Set();
    let prefetchScheduled = false; // 空闲预取调度互斥：一次渲染只排一次空闲任务

    // 拉取豆瓣热播数据；复用 douban.js 的 fetchDoubanData（全局，script 顺序在其后）。
    // 类型/标签/页偏移读当前状态，但必须在发起请求时捕获快照 reqType/reqTag/start：
    // URL 构造与 cache 写入共用同一时刻状态，避免快速切换后旧请求乱序返回污染缓存键。
    // 带独立总超时：douban.js 的 allorigins fallback 无 signal，可能长期悬挂，
    // 必须保证轮播在有限时间内降级为空态而不是永久空白（首次首页必经路径）
    function fetchDoubanSubjects(reqType, reqTag, start) {
        const target = `https://movie.douban.com/j/search_subjects?type=${reqType}&tag=${encodeURIComponent(reqTag)}&sort=recommend&page_limit=${PAGE_LIMIT}&page_start=${start}`;
        if (typeof fetchDoubanData !== 'function') {
            console.warn('[douban-hot] fetchDoubanData 不可用，豆瓣热播为空');
            return Promise.resolve([]);
        }
        const timedOut = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('douban-hot 拉取超时')), 12000);
        });
        return Promise.race([fetchDoubanData(target).then(data => (data && data.subjects) || []), timedOut]);
    }

    // 读取热播数据：多槽缓存命中（同类型同标签同页偏移且未过期）直接返回，否则拉取并更新缓存。
    // 缓存键与数据来自同一快照（发起请求时刻的 reqType/reqTag/start），乱序返回不污染当前状态
    function getSubjects() {
        const reqType = doubanMovieTvCurrentSwitch;
        const reqTag = doubanCurrentTag;
        const start = pageStart;
        const key = `${reqType}|${reqTag}|${start}`;
        const hit = cacheMap.get(key);
        if (hit && Date.now() - hit.ts < CACHE_TTL) {
            return Promise.resolve(hit.items);
        }
        return fetchDoubanSubjects(reqType, reqTag, start).then((subjects) => {
            cacheMap.set(key, { items: subjects || [], ts: Date.now() });
            trimCache();
            return cacheMap.get(key).items;
        });
    }

    // 缓存超限淘汰最旧（Map 按插入序迭代，第一个即最久未更新的键）
    function trimCache() {
        while (cacheMap.size > CACHE_MAX) {
            cacheMap.delete(cacheMap.keys().next().value);
        }
    }

    // 相邻标签预取：当前标签渲染成功后，空闲时预取相邻标签（前后各 1 个）第一页数据写入缓存。
    // 用户连续切换标签时大概率命中缓存秒开，消除"切标签 → 空白等待 → 数据到达"的卡顿。
    // 预取为 fire-and-forget：失败静默（用户手动切换时仍会正常拉取），不阻塞主线程渲染。
    // 只在渲染成功后调度（schedulePrefetch），不在页面前台与数据请求抢占带宽。
    // 数据到达后联动预取该标签封面（preloadCovers）：仅预取数据不预取封面时，
    // 切换命中缓存数据后 watchCoverReadiness 仍要等全部封面现下载 → 用户感知仍是慢。
    function prefetchTag(tag, withCovers) {
        const key = `${doubanMovieTvCurrentSwitch}|${tag}|0`;
        if (prefetching.has(key)) return; // 数据在途防重
        const hit = cacheMap.get(key);
        let dataPromise;
        if (hit && Date.now() - hit.ts < CACHE_TTL) {
            // 数据已缓存：无在途请求，不占 prefetching；直接走封面预取
            dataPromise = Promise.resolve(hit.items);
        } else {
            prefetching.add(key);
            dataPromise = fetchDoubanSubjects(doubanMovieTvCurrentSwitch, tag, 0)
                .then((subjects) => {
                    const items = subjects || [];
                    if (items.length) {
                        cacheMap.set(key, { items, ts: Date.now() });
                        trimCache();
                    }
                    return items;
                })
                .catch(() => [])
                .finally(() => prefetching.delete(key));
        }
        if (withCovers) {
            dataPromise.then((items) => {
                if (items && items.length) preloadCovers(items);
            });
        }
    }

    // 相邻标签（前后各 1）数据 + 封面联动预取
    function prefetchAdjacentTags() {
        const tags = currentTagsList();
        const idx = tags.indexOf(doubanCurrentTag);
        if (idx === -1) return;
        if (idx > 0) prefetchTag(tags[idx - 1], true);
        if (idx < tags.length - 1) prefetchTag(tags[idx + 1], true);
    }

    // 当前类型标签列表（douban.js 全局；未加载时回退空数组）
    function currentTagsList() {
        return doubanMovieTvCurrentSwitch === 'movie'
            ? (typeof movieTags !== 'undefined' ? movieTags : [])
            : (typeof tvTags !== 'undefined' ? tvTags : []);
    }

    // 全标签数据分片预取：首次进入页面空闲时，把当前类型全部标签的第一页数据
    // 逐个预取（仅数据，不含封面——避免一次拉 17+ 标签封面挤占带宽/主线程）。
    // 用户首次点击任意标签时数据已缓存，仅剩封面下载，感知显著提速。
    // 分片限速：每次调度最多预取 3 个标签，防止瞬间打满代理；未取完时自续排。
    let allTagsCursor = 0; // 全标签预取游标
    let allTagsDone = false; // 当前类型全标签是否已取完（false 时才续排；init 后首次渲染即开始预取）
    const ALL_TAGS_BATCH = 3; // 每次调度预取标签数
    function prefetchAllTagsData() {
        if (allTagsDone) return;
        const tags = currentTagsList();
        if (!tags.length) { allTagsDone = true; return; } // 标签未就绪/无标签：视为完成，防空转续排
        let batch = 0;
        while (allTagsCursor < tags.length && batch < ALL_TAGS_BATCH) {
            const tag = tags[allTagsCursor++];
            if (tag !== doubanCurrentTag) { // 当前标签数据已在渲染路径预取
                prefetchTag(tag, false);
                batch++;
            }
        }
        if (allTagsCursor >= tags.length) {
            allTagsDone = true; // 一轮取完；切类型后由 setType 重置
        }
    }

    // 空闲调度预取（渲染成功后调用，节流：一次渲染只排一次）。
    // 全标签未取完时自续排下一批（requestIdleCallback 天然低优先级，不抢渲染/交互）。
    // timeout 上限防饥饿：idle 始终繁忙（如动画循环）时也保证 3s 内执行一次。
    function schedulePrefetch() {
        if (prefetchScheduled) return;
        // 区域隐藏（搜索/播放器打开）时预取无意义且与搜索请求抢带宽，跳过本轮；
        // 下次区域显示 render 会再次调度
        const area = document.getElementById('recentWatchArea');
        if (!area || area.classList.contains('hidden')) return;
        prefetchScheduled = true;
        const run = () => {
            prefetchScheduled = false;
            prefetchAdjacentTags(); // 相邻标签：数据 + 封面（用户最可能下一步切换）
            prefetchAllTagsData(); // 全标签：仅数据（首次点击任意标签提速）
            if (!allTagsDone) schedulePrefetch(); // 未取完自续排（此时 prefetchScheduled 已复位）
        };
        if (window.requestIdleCallback) {
            window.requestIdleCallback(run, { timeout: 3000 });
        } else {
            setTimeout(run, 800);
        }
    }

    // 预取封面到本地缓存：切换标签/类型时新数据封面多为未缓存 URL，
    // 立即预取（ImageCacheManager.preload 带防重 + 缓存命中跳过），
    // 让轮播渲染后 IntersectionObserver 触发时缓存命中直接显示，消除"占位符→封面"等待跳变。
    // 限并发（默认 4）：避免 20 张封面同时 fetch + canvas 压缩阻塞主线程，
    // 也降低重复下载与并发写 index 的竞态面；预取为 fire-and-forget，不阻塞渲染。
    const PREFETCH_CONCURRENCY = 4;
    function preloadCovers(items) {
        if (!window.imageCacheManager || !items || !items.length) return;
        const urls = items.map((item) => item.coverUrl).filter(Boolean);
        let cursor = 0;
        // 每个 worker 串行取一个 URL，preload 完成后（含失败 finally）再取下一条；
        // 最多 PREFETCH_CONCURRENCY 个 worker 并发，真正限制同时下载/压缩的封面数
        const worker = () => {
            if (cursor >= urls.length) return;
            const url = urls[cursor++];
            window.imageCacheManager.preload(url).finally(worker);
        };
        for (let i = 0; i < Math.min(PREFETCH_CONCURRENCY, urls.length); i++) {
            worker();
        }
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

    // 单张轮播卡片 HTML（封面就绪前整卡 cover-pending 隐藏）：
    // 占位符在底层（默认显示），封面加载成功覆盖、失败自动隐藏露出占位符；
    // 评分行有评分才显示；入场动画在数据到达时渐进式展示（applyEntranceDelays 按距中央距离分批淡入）
    function buildCardHtml(item) {
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

        const coverHtml = item.coverUrl
            ? `<img data-src="${safeCoverUrl}" alt="${safeTitle}" class="lazy-load recent-watch-cover-img">`
            : '';

        const rateHtml = item.rate
            ? `<span class="recent-watch-rate">★ <span class="recent-watch-rate-value">${safeRate}</span></span>`
            : '';

        return `
                <div class="recent-watch-card cover-pending" data-title="${safeTitle}" role="button" tabindex="0" aria-label="${ariaLabel}" title="${ariaLabel}">
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
    }

    // 批量构建卡片 HTML（分批渲染用：首批 FIRST_BATCH 张，剩余后续追加）
    function buildCardsHtml(items) {
        return items.map(buildCardHtml).join('');
    }

    // 按评分从高到低排序（评分高的优先轮播）；无评分（''）排最后。
    // rate 为归一化后的字符串（如 "8.9"），无评分是空串；parseFloat 兼容小数。
    // NaN（parseFloat 无法解析的非数字串，如 "暂无"）与无评分同等落底：
    // 映射为 -Infinity，保证比较器为严格全序（两两可比较），不依赖引擎实现。
    // 评分相等时保持豆瓣原始顺序（Array.prototype.sort 稳定，ES2019+）
    function sortByRateDesc(a, b) {
        const sortValue = (rate) => {
            if (rate === '') return -Infinity;
            const num = parseFloat(rate);
            return Number.isNaN(num) ? -Infinity : num;
        };
        const ra = sortValue(a.rate);
        const rb = sortValue(b.rate);
        if (ra === rb) return 0;
        return ra > rb ? -1 : 1;
    }

    // 应用可见性：
    // - 搜索结果显示时：隐藏整个热播区（含筛选区）
    // - 轮播空态（某标签无数据）：隐藏轨道与轮播按钮，但保留筛选区——
    //   用户仍能切标签/类型，避免"空结果把筛选控件一起藏掉导致锁死"
    // 隐藏时同步停掉自动轮播定时器，避免区域不可见时空转（显示路径 render 会重新 start）
    function applyVisibility() {
        const area = document.getElementById('recentWatchArea');
        if (!area) return;
        const filter = document.getElementById('recentWatchFilter');
        const resultsArea = document.getElementById('resultsArea');
        const searching = resultsArea && !resultsArea.classList.contains('hidden');
        if (searching) {
            area.classList.add('hidden');
            stopAutoScroll();
        } else if (itemCount === 0) {
            // 空态：区域可见但轨道隐藏（筛选区保留可见）
            area.classList.remove('hidden');
            if (filter) filter.classList.remove('hidden');
            const track = document.getElementById('recentWatchTrack');
            if (track) track.classList.add('hidden');
            stopAutoScroll();
        } else {
            area.classList.remove('hidden');
            if (filter) filter.classList.remove('hidden');
            const track = document.getElementById('recentWatchTrack');
            if (track) track.classList.remove('hidden');
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

    // 上次渲染的类型/标签快照：用于识别"切换标签/类型"（数据源变化）
    let lastRenderKey = '';

    // 显示"三点"加载过渡：清空 track、隐藏左右按钮、停自动轮播。
    // 切换标签/换一批时调用，数据到齐后由 render 的 .then 内替换为卡片
    function showTrackLoading() {
        const track = document.getElementById('recentWatchTrack');
        if (!track) return;
        clearCoverWatch(); // 清空 track 前解除旧封面监听，避免监听已删除的孤儿 img
        track.innerHTML = '<div class="recent-watch-loading" aria-hidden="true">'
            + '<span class="recent-watch-loading-dot"></span>'
            + '<span class="recent-watch-loading-dot"></span>'
            + '<span class="recent-watch-loading-dot"></span>'
            + '</div>';
        // 若轨道处于空态隐藏（某标签无数据），先恢复显示让 loading 可见，
        // 否则用户切换时只见筛选区无加载反馈；数据到达后 applyVisibility 正常分支保持显示
        track.classList.remove('hidden');
        activeIndex = 0;
        stopAutoScroll();
        updateNavButtons(0);
    }

    // 封面就绪监听：等待所有封面加载到终态后整批展示，避免"先露占位符再闪到封面"。
    // 卡片渲染时带 .cover-pending（visibility:hidden，占位符也不可见）；
    // 全部封面就绪（成功 is-loaded / 失败 display:none / 无封面）或超时（COVER_LOAD_TIMEOUT）
    // 后移除 .cover-pending，卡片连同封面一起渐进淡入（入场动画）。
    let coverObserver = null; // 封面就绪 MutationObserver
    let coverTimeout = null;  // 封面加载超时兜底定时器
    const COVER_LOAD_TIMEOUT = 12000; // 与数据 fetch 超时一致；超时后强制展示（占位符兜底）

    function clearCoverWatch() {
        if (coverObserver) { coverObserver.disconnect(); coverObserver = null; }
        if (coverTimeout) { clearTimeout(coverTimeout); coverTimeout = null; }
    }

    // 移除指定范围（或全部）卡片的 cover-pending，展示（封面全部就绪或超时兜底）。
    // scope：卡片数组；缺省 = track 内全部卡片。onReady：封面展示后回调（分批渲染衔接用）
    function revealTrack(track, scope, onReady) {
        clearCoverWatch();
        const cards = scope && scope.length ? scope : track.querySelectorAll('.recent-watch-card');
        cards.forEach(card => {
            card.classList.remove('cover-pending');
        });
        if (typeof onReady === 'function') onReady();
    }

    // 等待 scope 范围内所有封面到终态后整批展示；超时强制展示（未就绪封面由占位符兜底，加载完成仍会淡入覆盖）。
    // scope：卡片数组；缺省 = track 内全部卡片。onReady：封面展示后回调。
    // 分批渲染：布局一次到位（全部卡片渲染排版，避免追加导致的环形位置跳变），
    // 封面分批等待——首批 FIRST_BATCH 张封面就绪展示，剩余再分批等待展示
    function watchCoverReadiness(track, scope, onReady) {
        clearCoverWatch();
        const cards = scope && scope.length ? scope : track.querySelectorAll('.recent-watch-card');
        const imgs = Array.from(cards).map(card => card.querySelector('.recent-watch-cover-img')).filter(Boolean);
        if (!imgs.length) { revealTrack(track, cards, onReady); return; } // 范围全无封面，直接展示
        // 同步预检：全部命中缓存可能已就绪（onload 微任务先于 observer 挂载），
        // 直接展示避免 12s 超时空窗
        if (imgs.every(img => img.classList.contains('is-loaded') || img.style.display === 'none')) {
            revealTrack(track, cards, onReady);
            return;
        }
        const checkAllReady = () => {
            return cards.every(card => {
                const img = card.querySelector('.recent-watch-cover-img');
                // 无封面卡视为就绪；成功（is-loaded）或失败（display:none）都算终态
                return !img || img.classList.contains('is-loaded') || img.style.display === 'none';
            });
        };
        coverObserver = new MutationObserver(() => {
            if (checkAllReady()) revealTrack(track, cards, onReady);
        });
        imgs.forEach(img => {
            coverObserver.observe(img, { attributes: true, attributeFilter: ['class', 'style'] });
        });
        coverTimeout = setTimeout(() => revealTrack(track, cards, onReady), COVER_LOAD_TIMEOUT);
    }

    // 全部影片渲染完成后的收尾：启动自动轮播（多于 1 部时）、空闲预取相邻标签、清理互斥标志。
    // 在最后一批封面展示（或超时兜底）后调用一次
    function finishCarouselAfterRender() {
        const track = document.getElementById('recentWatchTrack');
        // 多于 1 部影片时自动轮流连播；单张/无动画偏好下静态展示
        if (track && track.querySelectorAll('.recent-watch-card').length > 1) {
            refreshCarousel();
        } else {
            stopAutoScroll();
        }
        // 当前标签渲染完成后空闲预取相邻标签（切换标签秒开的懒加载优化）
        schedulePrefetch();
        clearTimeout(resumeTimer);
        resumeTimer = null;
        batchPending = false;
    }

    function render() {
        const area = document.getElementById('recentWatchArea');
        // 早退前清除 batchPending/coverWatch：nextBatch 置 true 后若元素缺失会永久泄漏互斥标志
        if (!area) { batchPending = false; clearCoverWatch(); return; }
        const track = document.getElementById('recentWatchTrack');
        if (!track) { batchPending = false; clearCoverWatch(); return; }

        // 切换标签/类型时立即清空旧卡片并显示"三点"加载过渡：
        // 否则 getSubjects 异步取数期间 track 残留旧内容，数据到达后整体替换，
        // 叠加卡片入场动画重播 → 视觉"闪"。清空 + 加载指示让切换有过渡、
        // 数据到齐后卡片渐进式展示（入场动画按距中央距离分批次淡入）。
        // 切换判定含标签/类型：type/tag 任一变化都视为"切换"（重置分页 + 三点加载）
        const currentKey = `${doubanMovieTvCurrentSwitch}:${doubanCurrentTag}`;
        const isSwitch = lastRenderKey !== '' && currentKey !== lastRenderKey;
        lastRenderKey = currentKey;
        if (isSwitch) {
            pageStart = 0; // 切换标签/类型回到第一页
            // 在途"换一批"作废：其 renderRequestId 已过期会被 .then 丢弃，这里显式复位互斥
            batchPending = false;
            showTrackLoading();
        }

        const requestId = ++renderRequestId;

        getSubjects()
            .then((subjects) => {
                if (requestId !== renderRequestId) return; // 类型切换后旧请求作废
                // 换一批翻到末尾（豆瓣返回空数组）：回绕到第一页重新拉取。
                // 回绕后 pageStart=0 且 isSwitch=false（type/tag 未变），
                // 不会重复 loading；第一页也空（标签无数据）时走下方 items.length===0 分支，无死循环。
                // batchPending 保持 true：回绕后的 render 完成后才清除，期间阻止再点换一批
                if (pageStart > 0 && (!subjects || subjects.length === 0)) {
                    pageStart = 0;
                    if (typeof showToast === 'function') {
                        showToast('已回到第一页', 'info');
                    }
                    render();
                    return;
                }
                const items = (subjects || [])
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
                    })
                    .sort(sortByRateDesc)
                    // 截断必须在排序之后：先保证"评分高者优先"完整作用于全量数据，
                    // 再截断展示上限（否则超限数据中最高分可能被排在截断区外）
                    .slice(0, MAX_ITEMS);

                itemCount = items.length;
                updateNavButtons(items.length);

                if (items.length === 0) {
                    track.innerHTML = '';
                    activeIndex = 0;
                    stopAutoScroll();
                    clearTimeout(resumeTimer);
                    resumeTimer = null;
                    applyVisibility();
                    clearCoverWatch();
                    batchPending = false;
                    return;
                }

                // 先应用可见性再渲染：display:none 下 offsetWidth 为 0，gap 会回退到断点值，
                // 但显示路径（app.js updateRecentWatchVisibility）会重新 render，排版随即正确
                applyVisibility();

                // 分批展示：全部卡片一次渲染排版（布局一次到位，避免分批追加导致的环形位置跳变），
                // 但封面分批等待——首批 FIRST_BATCH 张封面就绪即展示（首屏只需等 5 张封面），
                // 剩余封面在首批展示后继续等待，就绪后渐进展示（用户诉求"先出 5 部再慢慢加载剩余"）。
                track.innerHTML = buildCardsHtml(items);
                activeIndex = 0; // 第一部影片在中央凸显，然后逐张轮流
                updateCoverflow(track);
                applyEntranceDelays(track);

                // 首批封面优先预取（剩余封面在首批展示后再预取，让首屏更快）
                preloadCovers(items.slice(0, FIRST_BATCH));

                const allCards = Array.from(track.querySelectorAll('.recent-watch-card'));
                const firstCards = allCards.slice(0, FIRST_BATCH);
                const restCards = allCards.slice(FIRST_BATCH);

                // 等待首批封面就绪后展示（超时兜底）；展示后继续等待剩余封面
                watchCoverReadiness(track, firstCards, () => {
                    if (requestId !== renderRequestId) return; // 期间被切换/换批，作废
                    if (!restCards.length) {
                        finishCarouselAfterRender();
                        return;
                    }
                    // 首批已展示，再预取剩余封面并等待其就绪展示
                    preloadCovers(items.slice(FIRST_BATCH));
                    watchCoverReadiness(track, restCards, () => {
                        if (requestId !== renderRequestId) return;
                        finishCarouselAfterRender();
                    });
                });
            })
            .catch((e) => {
                console.error('[douban-hot] 加载豆瓣热播失败:', e);
                itemCount = 0;
                track.innerHTML = '';
                stopAutoScroll();
                applyVisibility();
                clearCoverWatch();
                batchPending = false;
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
        // 类型切换：全标签预取列表变化，重置游标重新预取
        allTagsCursor = 0;
        allTagsDone = false;
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

    // 换一批：翻到下一页（page_start += PAGE_LIMIT），显示加载过渡后重新渲染。
    // isSwitch 判定基于 type/tag，换一批时未变 → render 不会重复 loading，只拉新页数据。
    // batchPending 互斥：fetch 期间再点直接忽略，防止连点 pageStart 无监督累加跳页
    function nextBatch() {
        if (batchPending) return;
        batchPending = true;
        pageStart += PAGE_LIMIT;
        showTrackLoading();
        render();
    }

    // 一次性绑定"换一批"按钮
    function bindMoreBatch() {
        const moreBtn = document.getElementById('recentWatchMoreBtn');
        if (!moreBtn) return;
        moreBtn.addEventListener('click', () => {
            const area = document.getElementById('recentWatchArea');
            if (!area || area.classList.contains('hidden')) return; // 区域隐藏时不响应
            nextBatch();
        });
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
        bindMoreBatch();
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
