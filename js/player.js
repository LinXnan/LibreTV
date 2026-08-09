const selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]'); // 存储自定义API列表

// 改进返回功能
function goBack(event) {
    // 防止默认链接行为
    if (event) event.preventDefault();
    
    // 1. 优先检查URL参数中的returnUrl
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('returnUrl');
    
    if (returnUrl) {
        // 如果URL中有returnUrl参数，优先使用
        window.location.href = decodeURIComponent(returnUrl);
        return;
    }
    
    // 2. 检查localStorage中保存的lastPageUrl
    const lastPageUrl = localStorage.getItem('lastPageUrl');
    if (lastPageUrl && lastPageUrl !== window.location.href) {
        window.location.href = lastPageUrl;
        return;
    }
    
    // 3. 检查是否是从搜索页面进入的播放器
    const referrer = document.referrer;
    
    // 检查 referrer 是否包含搜索参数
    if (referrer && (referrer.includes('/s=') || referrer.includes('?s='))) {
        // 如果是从搜索页面来的，返回到搜索页面
        window.location.href = referrer;
        return;
    }
    
    // 4. 如果是在iframe中打开的，尝试关闭iframe
    if (window.self !== window.top) {
        try {
            // 尝试调用父窗口的关闭播放器函数
            window.parent.closeVideoPlayer && window.parent.closeVideoPlayer();
            return;
        } catch (e) {
            console.error('调用父窗口closeVideoPlayer失败:', e);
        }
    }
    
    // 5. 无法确定上一页，则返回首页
    if (!referrer || referrer === '') {
        window.location.href = '/';
        return;
    }
    
    // 6. 以上都不满足，使用默认行为：返回上一页
    window.history.back();
}

// 页面加载时保存当前URL到localStorage，作为返回目标
window.addEventListener('load', function () {
    // 保存前一页面URL
    if (document.referrer && document.referrer !== window.location.href) {
        localStorage.setItem('lastPageUrl', document.referrer);
    }

    // 提取当前URL中的重要参数，以便在需要时能够恢复当前页面
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    const sourceCode = urlParams.get('source');

    if (videoId && sourceCode) {
        // 保存当前播放状态，以便其他页面可以返回
        localStorage.setItem('currentPlayingId', videoId);
        localStorage.setItem('currentPlayingSource', sourceCode);
    }
});


// =================================
// ============== PLAYER ==========
// =================================
// 全局变量
let currentVideoTitle = '';
let currentEpisodeIndex = 0;
let art = null; // 用于 ArtPlayer 实例
let currentHls = null; // 跟踪当前HLS实例
let currentEpisodes = [];
let episodesReversed = false;
let autoplayEnabled = true; // 默认开启自动连播
let videoHasEnded = false; // 跟踪视频是否已经自然结束
let userClickedPosition = null; // 记录用户点击的位置
let shortcutHintTimeout = null; // 用于控制快捷键提示显示时间
let adFilteringEnabled = true; // 默认开启广告过滤
let totalAdsFiltered = 0; // 广告过滤计数器
let adFilterHideTimer = null; // 广告过滤胶囊自动隐藏计时器
let currentVideoUrl = ''; // 记录当前实际的视频URL
let currentVodPic = ''; // 当前视频封面（切源时随新源更新，历史记录/最近观看封面跟随）

// 获取当前节目的标识符：优先 sourceName_id，回退 firstEpisode / videoUrl

/**
 * 获取本次 show 的唯一标识字符串。
 * 优先使用 sourceName 与 id_from_params 拼接；回退到 currentEpisodes 的首条，
 * 或在无 available eps 时使用 URL 作为唯一标识。
 * options: {
 *   sourceName: string,
 *   id_from_params: string
 * }
 */
function getShowIdentifier(sourceName, id_from_params) {
    if (sourceName && id_from_params) {
        return `${sourceName}_${id_from_params}`;
    }
    return (currentEpisodes && currentEpisodes.length > 0) ? currentEpisodes[0] : currentVideoUrl;
}

// 构建 custom API 查询参数（与 switchToResource/testVideoSourceSpeed 共享）
function buildCustomApiParams(customApi) {
    var base = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
    if (customApi.detail) {
        base = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
    }
    return base;
}

// 统一的剧集按钮 HTML 模板。
// onClick: 回调函数名 (如 "playEpisode")。
// withId: 为 true 时生成 id = "episode-N"，inline 按钮用它来做样式和
//        快捷键定位。Modal 按钮不需要 id。
// extraClass: 附加的 CSS 类（如 inline 版的 "hover:!shadow-none episode-btn"）。
function episodeButtonHTML(realIndex, isActive, opts) {
    var onClick = opts.onClick;
    var withId = opts.withId;
    var extraClass = opts.extraClass || '';
    var idAttr = withId ? 'id="episode-' + realIndex + '" ' : '';
    return '<button ' + idAttr + 'onclick="' + onClick + '(' + realIndex + ')" ' +
        'class="px-4 py-2 ' + (isActive ? 'episode-active' : '!bg-[#222] hover:!bg-[#333]') +
        ' !border ' + (isActive ? '!border-blue-500' : '!border-[#333]') +
        ' rounded-lg transition-colors text-center ' + extraClass + '">' +
        (realIndex + 1) + '</button>';
}
const isWebkit = (typeof window.webkitConvertPointFromNodeToPage === 'function')
Artplayer.FULLSCREEN_WEB_IN_BODY = true;

// 页面加载
document.addEventListener('DOMContentLoaded', function () {
    // 先检查用户是否已通过密码验证
    if (window.isPasswordProtected && window.isPasswordProtected()) {
        if (!window.isPasswordVerified || !window.isPasswordVerified()) {
            // 显示密码模态框
            if (window.showPasswordModal) {
                window.showPasswordModal();
            }
            return;
        }
    }

    initializePageContent();
});

// 监听密码验证成功事件
document.addEventListener('passwordVerified', () => {
    initializePageContent();
});

// 初始化页面内容
function initializePageContent() {

    // 解析URL参数
    const urlParams = new URLSearchParams(window.location.search);
    let videoUrl = urlParams.get('url');
    const title = urlParams.get('title');
    const sourceCode = urlParams.get('source');
    let index = parseInt(urlParams.get('index') || '0');
    const episodesList = urlParams.get('episodes'); // 从URL获取集数信息
    const savedPosition = parseInt(urlParams.get('position') || '0'); // 获取保存的播放位置
    // 解决历史记录问题：检查URL是否是player.html开头的链接
    // 如果是，说明这是历史记录重定向，需要解析真实的视频URL
    if (videoUrl && videoUrl.includes('player.html')) {
        try {
            // 尝试从嵌套URL中提取真实的视频链接
            const nestedUrlParams = new URLSearchParams(videoUrl.split('?')[1]);
            // 从嵌套参数中获取真实视频URL
            const nestedVideoUrl = nestedUrlParams.get('url');
            // 检查嵌套URL是否包含播放位置信息
            const nestedPosition = nestedUrlParams.get('position');
            const nestedIndex = nestedUrlParams.get('index');
            const nestedTitle = nestedUrlParams.get('title');

            if (nestedVideoUrl) {
                videoUrl = nestedVideoUrl;

                // 更新当前URL参数
                const url = new URL(window.location.href);
                if (!urlParams.has('position') && nestedPosition) {
                    url.searchParams.set('position', nestedPosition);
                }
                if (!urlParams.has('index') && nestedIndex) {
                    url.searchParams.set('index', nestedIndex);
                }
                if (!urlParams.has('title') && nestedTitle) {
                    url.searchParams.set('title', nestedTitle);
                }
                const nestedVodPic = nestedUrlParams.get('vod_pic');
                if (!urlParams.has('vod_pic') && nestedVodPic) {
                    url.searchParams.set('vod_pic', nestedVodPic);
                }
                // 替换当前URL
                window.history.replaceState({}, '', url);
            } else {
                showError('历史记录链接无效，请返回首页重新访问');
            }
        } catch (e) {
            console.error('解析视频URL失败:', e);
        }
    }

    // 保存当前视频URL
    currentVideoUrl = videoUrl || '';

    // 初始化当前封面（嵌套解析后 URL 已同步 vod_pic）
    const initVodPicParam = urlParams.get('vod_pic');
    if (initVodPicParam) {
        try {
            const decodedUrl = decodeURIComponent(initVodPicParam);
            currentVodPic = isValidImageUrl(decodedUrl) ? decodedUrl : '';
        } catch (e) {
            console.warn('Invalid vod_pic URL encoding:', e);
            currentVodPic = '';
        }
    }

    // 从localStorage获取数据
    currentVideoTitle = title || localStorage.getItem('currentVideoTitle') || '未知视频';
    currentEpisodeIndex = index;

    // 设置自动连播开关状态
    autoplayEnabled = localStorage.getItem('autoplayEnabled') !== 'false'; // 默认为true
    document.getElementById('autoplayToggle').checked = autoplayEnabled;

    // 获取广告过滤设置
    adFilteringEnabled = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true

    // 根据广告过滤设置控制广告统计显示
    updateAdFilterStatsVisibility();

    // 监听自动连播开关变化
    document.getElementById('autoplayToggle').addEventListener('change', function (e) {
        autoplayEnabled = e.target.checked;
        localStorage.setItem('autoplayEnabled', autoplayEnabled);
    });

    // 优先使用URL传递的集数信息，否则从localStorage获取
    try {
        if (episodesList) {
            // 如果URL中有集数数据，优先使用它
            currentEpisodes = JSON.parse(decodeURIComponent(episodesList));

        } else {
            // 否则从localStorage获取
            currentEpisodes = JSON.parse(localStorage.getItem('currentEpisodes') || '[]');

        }

        // 检查集数索引是否有效，如果无效则调整为0
        if (index < 0 || (currentEpisodes.length > 0 && index >= currentEpisodes.length)) {
            // 如果索引太大，则使用最大有效索引
            if (index >= currentEpisodes.length && currentEpisodes.length > 0) {
                index = currentEpisodes.length - 1;
            } else {
                index = 0;
            }

            // 更新URL以反映修正后的索引
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('index', index);
            window.history.replaceState({}, '', newUrl);
        }

        // 更新当前索引为验证过的值
        currentEpisodeIndex = index;

        episodesReversed = localStorage.getItem('episodesReversed') === 'true';
    } catch (e) {
        console.error('解析剧集数据失败:', e);
        currentEpisodes = [];
        currentEpisodeIndex = 0;
        episodesReversed = false;
    }

    // 设置页面标题
    document.title = currentVideoTitle + ' - LibreTV播放器';
    document.getElementById('videoTitle').textContent = currentVideoTitle;

    // 初始化播放器
    if (videoUrl) {
        initPlayer(videoUrl);
    } else {
        showError('无效的视频链接');
    }

    // 绑定集数分页按钮（静态按钮，绑定一次）
    bindEpisodePagination();

    // 渲染源信息
    renderResourceInfoBar();

    // 异步加载侧栏切换资源列表（不阻塞播放器初始化）
    loadResourceSwitchList();

    // 更新集数信息
    updateEpisodeInfo();

    // 渲染集数列表
    renderEpisodes();

    // 更新播放器内控制栏的上一集/下一集按钮状态
    updatePlayerEpisodeControls();

    // 更新排序按钮状态
    updateOrderButton();

    // 初始化右侧面板收起/展开状态，并同步侧栏高度与左栏对齐
    initPlayerSidebar();
    initSidebarHeightSync();

    // 添加对进度条的监听，确保点击准确跳转
    setTimeout(() => {
        setupProgressBarPreciseClicks();
    }, 1000);

    // 添加键盘快捷键事件监听
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // 添加页面离开事件监听，保存播放位置
    window.addEventListener('beforeunload', saveCurrentProgress);

    // 新增：页面隐藏（切后台/切标签）时也保存
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            saveCurrentProgress();
        }
    });

    // 优化10: 智能进度保存 - 使用节流避免频繁写入
    const waitForVideo = setInterval(() => {
        if (art && art.video) {
            let lastSaveTime = 0;
            let lastSavedPosition = 0;
            const SAVE_INTERVAL = 10000; // 10秒间隔
            const POSITION_THRESHOLD = 5; // 位置变化超过5秒才保存

            // 节流保存函数
            const throttledSave = function() {
                const now = Date.now();
                const currentPosition = art.video.currentTime;

                // 只在满足以下条件时保存：
                // 1. 距离上次保存超过10秒
                // 2. 播放位置变化超过5秒
                if (now - lastSaveTime > SAVE_INTERVAL &&
                    Math.abs(currentPosition - lastSavedPosition) > POSITION_THRESHOLD) {
                    saveCurrentProgress();
                    lastSaveTime = now;
                    lastSavedPosition = currentPosition;
                }
            };

            // 视频暂停时立即保存
            art.video.addEventListener('pause', function() {
                saveCurrentProgress();
                lastSaveTime = Date.now();
                lastSavedPosition = art.video.currentTime;
            });

            // 播放进度变化时节流保存
            art.video.addEventListener('timeupdate', throttledSave);

            clearInterval(waitForVideo);
        }
    }, 200);
}

// 处理键盘快捷键
function handleKeyboardShortcuts(e) {
    // 忽略输入框中的按键事件
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Alt + 左箭头 = 上一集
    if (e.altKey && e.key === 'ArrowLeft') {
        if (currentEpisodeIndex > 0) {
            playPreviousEpisode();
            showShortcutHint('上一集', 'left');
            e.preventDefault();
        }
    }

    // Alt + 右箭头 = 下一集
    if (e.altKey && e.key === 'ArrowRight') {
        if (currentEpisodeIndex < currentEpisodes.length - 1) {
            playNextEpisode();
            showShortcutHint('下一集', 'right');
            e.preventDefault();
        }
    }

    // 左箭头 = 快退
    if (!e.altKey && e.key === 'ArrowLeft') {
        if (art && art.currentTime > 5) {
            art.currentTime -= 5;
            showShortcutHint('快退', 'left');
            e.preventDefault();
        }
    }

    // 右箭头 = 快进
    if (!e.altKey && e.key === 'ArrowRight') {
        if (art && art.currentTime < art.duration - 5) {
            art.currentTime += 5;
            showShortcutHint('快进', 'right');
            e.preventDefault();
        }
    }

    // 上箭头 = 音量+
    if (e.key === 'ArrowUp') {
        if (art && art.volume < 1) {
            art.volume += 0.1;
            showShortcutHint('音量+', 'up');
            e.preventDefault();
        }
    }

    // 下箭头 = 音量-
    if (e.key === 'ArrowDown') {
        if (art && art.volume > 0) {
            art.volume -= 0.1;
            showShortcutHint('音量-', 'down');
            e.preventDefault();
        }
    }

    // 空格 = 播放/暂停
    if (e.key === ' ') {
        if (art) {
            art.toggle();
            showShortcutHint('播放/暂停', 'play');
            e.preventDefault();
        }
    }

    // f 键 = 切换全屏
    if (e.key === 'f' || e.key === 'F') {
        if (art) {
            art.fullscreen = !art.fullscreen;
            showShortcutHint('切换全屏', 'fullscreen');
            e.preventDefault();
        }
    }
}

// 显示快捷键提示
function showShortcutHint(text, direction) {
    const hintElement = document.getElementById('shortcutHint');
    const textElement = document.getElementById('shortcutText');
    const iconElement = document.getElementById('shortcutIcon');

    // 清除之前的超时
    if (shortcutHintTimeout) {
        clearTimeout(shortcutHintTimeout);
    }

    // 设置文本和图标方向
    textElement.textContent = text;

    if (direction === 'left') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>';
    } else if (direction === 'right') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>';
    }  else if (direction === 'up') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>';
    } else if (direction === 'down') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
    } else if (direction === 'fullscreen') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"></path>';
    } else if (direction === 'play') {
        iconElement.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z"></path>';
    }

    // 显示提示
    hintElement.classList.add('show');

    // 两秒后隐藏
    shortcutHintTimeout = setTimeout(() => {
        hintElement.classList.remove('show');
    }, 2000);
}

// 初始化播放器
function initPlayer(videoUrl) {
    if (!videoUrl) {
        return
    }

    // 销毁旧实例
    if (art) {
        art.destroy();
        art = null;
    }

    // 优化4: 智能缓冲策略 - 根据网络速度动态调整
    function getAdaptiveHlsConfig() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const effectiveType = connection?.effectiveType || '4g';

        // 根据网络类型调整缓冲参数
        const networkConfigs = {
            'slow-2g': { maxBufferLength: 20, backBufferLength: 10, maxMaxBufferLength: 40 },
            '2g': { maxBufferLength: 30, backBufferLength: 15, maxMaxBufferLength: 60 },
            '3g': { maxBufferLength: 45, backBufferLength: 20, maxMaxBufferLength: 90 },
            '4g': { maxBufferLength: 60, backBufferLength: 30, maxMaxBufferLength: 120 }
        };

        const networkConfig = networkConfigs[effectiveType] || networkConfigs['4g'];

        return {
            debug: false,
            loader: adFilteringEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader,
            enableWorker: true,
            lowLatencyMode: false,

            // 动态缓冲参数
            backBufferLength: networkConfig.backBufferLength,
            maxBufferLength: networkConfig.maxBufferLength,
            maxMaxBufferLength: networkConfig.maxMaxBufferLength,
            maxBufferSize: 60 * 1000 * 1000,

            // seek 性能优化：放宽片段对齐精度 + 快重试间隔
            maxBufferHole: 1.0,
            maxFragLookUpTolerance: 0.5,
            nudgeMaxRetry: 5,
            fragLoadingMaxRetry: 6,
            fragLoadingMaxRetryTimeout: 64000,
            fragLoadingRetryDelay: 300,
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 300,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 500,

            startLevel: -1,
            abrEwmaDefaultEstimate: 500000,
            abrBandWidthFactor: 0.8,
            abrBandWidthUpFactor: 0.6,
            abrMaxWithRealBitrate: true,

            stretchShortVideoTrack: true,
            appendErrorMaxRetry: 5,
            liveSyncDurationCount: 2,
            liveDurationInfinity: false
        };
    }

    const hlsConfig = getAdaptiveHlsConfig();

    // Create new ArtPlayer instance
    art = new Artplayer({
        container: '#player',
        url: videoUrl,
        type: 'm3u8',
        title: videoTitle,
        volume: 0.8,
        isLive: false,
        muted: false,
        autoplay: true,
        loading: false, // 关闭 ArtPlayer 内置"加载中..."提示框，切源/首屏加载均不显示中央提示
        pip: true,
        autoSize: false,
        autoMini: true,
        screenshot: false,
        setting: false,
        loop: false,
        flip: false,
        playbackRate: false,
        aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        hotkey: false,
        theme: '#23ade5',
        lang: navigator.language.toLowerCase(),
        moreVideoAttr: {
            crossOrigin: 'anonymous',
            preload: 'auto',  // 优化6: 自动预加载视频
            // 优化8: 启用硬件加速
            style: 'transform: translateZ(0); will-change: transform;'
        },
        controls: [
            {
                name: 'prevEpisode',
                index: 5,
                position: 'left',
                html: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>',
                tooltip: '上一集',
                style: {
                    padding: '0 6px',
                },
                click: function() {
                    if (currentEpisodeIndex > 0) {
                        playPreviousEpisode();
                    }
                },
                mounted: function($control) {
                    // 保存控件引用，供 updatePlayerEpisodeControls 同步禁用状态
                    window.prevEpisodeControl = $control;
                    updatePlayerEpisodeControls();
                }
            },
            {
                name: 'nextEpisode',
                index: 15,
                position: 'left',
                html: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>',
                tooltip: '下一集',
                style: {
                    padding: '0 6px',
                },
                click: function() {
                    if (currentEpisodeIndex < currentEpisodes.length - 1) {
                        playNextEpisode();
                    }
                },
                mounted: function($control) {
                    window.nextEpisodeControl = $control;
                    updatePlayerEpisodeControls();
                }
            },
            {
                position: 'right',
                html: '<span style="font-size: 13px; font-weight: bold;">1.0x</span>',
                tooltip: '播放速度',
                style: {
                    padding: '0 10px',
                },
                click: function() {
                    showPlaybackRateMenu();
                },
                mounted: function($control) {
                    // 保存控制按钮的引用，用于更新显示
                    window.playbackRateControl = $control;
                }
            }
        ],
        customType: {
            m3u8: function (video, url) {
                // 清理之前的HLS实例
                if (currentHls && currentHls.destroy) {
                    try {
                        currentHls.destroy();
                    } catch (e) {
                        console.error('销毁HLS实例失败:', e);
                    }
                }

                // 创建新的HLS实例
                const hls = new Hls(hlsConfig);
                currentHls = hls;

                // 跟踪是否已经显示错误
                let errorDisplayed = false;
                // 跟踪是否有错误发生
                let errorCount = 0;
                // 跟踪视频是否开始播放
                let playbackStarted = false;
                // 跟踪视频是否出现bufferAppendError
                let bufferAppendErrorCount = 0;
                // 优化9: 智能错误恢复 - 记录恢复尝试次数
                let networkRecoverCount = 0;
                let mediaRecoverCount = 0;
                const MAX_RECOVER_ATTEMPTS = 3;

                // 监听视频播放事件 — 标记已播放 / 隐藏错误
                // loading 的隐藏由下方的 onPlaying 统一调度（进度条→100%→延迟300ms隐藏）
                video.addEventListener('playing', function () {
                    playbackStarted = true;
                    document.getElementById('error').style.display = 'none';
                });

                // 监听视频进度事件
                video.addEventListener('timeupdate', function () {
                    if (video.currentTime > 1) {
                        // 视频进度超过1秒，隐藏错误（如果存在）
                        document.getElementById('error').style.display = 'none';
                    }
                });

                hls.loadSource(url);
                hls.attachMedia(video);

                // enable airplay, from https://github.com/video-dev/hls.js/issues/5989
                // 检查是否已存在source元素，如果存在则更新，不存在则创建
                let sourceElement = video.querySelector('source');
                if (sourceElement) {
                    // 更新现有source元素的URL
                    sourceElement.src = videoUrl;
                } else {
                    // 创建新的source元素
                    sourceElement = document.createElement('source');
                    sourceElement.src = videoUrl;
                    video.appendChild(sourceElement);
                }
                video.disableRemotePlayback = false;

                hls.on(Hls.Events.MANIFEST_PARSED, function () {
                    video.play().catch(e => {
                    });
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    // 增加错误计数
                    errorCount++;

                    // 处理bufferAppendError
                    if (data.details === 'bufferAppendError') {
                        bufferAppendErrorCount++;
                        // 如果视频已经开始播放，则忽略这个错误
                        if (playbackStarted) {
                            return;
                        }

                        // 如果出现多次bufferAppendError但视频未播放，尝试恢复
                        if (bufferAppendErrorCount >= 3) {
                            hls.recoverMediaError();
                        }
                    }

                    // 优化9: 改进错误恢复机制 - 智能降级和重试
                    if (data.fatal && !playbackStarted) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                // 网络错误：智能重试
                                if (networkRecoverCount < MAX_RECOVER_ATTEMPTS) {
                                    networkRecoverCount++;
                                    console.log(`网络错误恢复尝试 ${networkRecoverCount}/${MAX_RECOVER_ATTEMPTS}`);
                                    // 延迟重试，避免立即重试
                                    setTimeout(() => {
                                        hls.startLoad();
                                    }, 500 * networkRecoverCount); // 递增延迟
                                } else {
                                    if (!errorDisplayed) {
                                        errorDisplayed = true;
                                        showError('网络连接失败，请检查网络或更换片源');
                                    }
                                }
                                break;

                            case Hls.ErrorTypes.MEDIA_ERROR:
                                // 媒体错误：尝试恢复
                                if (mediaRecoverCount < MAX_RECOVER_ATTEMPTS) {
                                    mediaRecoverCount++;
                                    console.log(`媒体错误恢复尝试 ${mediaRecoverCount}/${MAX_RECOVER_ATTEMPTS}`);
                                    hls.recoverMediaError();
                                } else {
                                    if (!errorDisplayed) {
                                        errorDisplayed = true;
                                        showError('视频格式不兼容，请更换片源');
                                    }
                                }
                                break;

                            default:
                                // 其他错误：显示错误提示
                                if (errorCount > 2 && !errorDisplayed) {
                                    errorDisplayed = true;
                                    showError('视频加载失败，可能是格式不兼容或源不可用');
                                }
                                break;
                        }
                    }
                });

                // 监听分段加载事件 — 仅进度更新在 FRAG_LOADING/FRAG_LOADED 进度条处处理
                // 不在此隐藏 loading；隐藏由 playing 事件统一调度

                // 优化11: 智能画质调整 - 根据缓冲情况自动调整画质
                let bufferStallCount = 0;
                let lastBufferCheck = 0;
                const BUFFER_CHECK_INTERVAL = 3000; // 每3秒检查一次
                const STALL_THRESHOLD = 3; // 连续卡顿3次则降低画质
                const LOW_BUFFER_THRESHOLD = 5; // 缓冲低于5秒视为可能卡顿

                video.addEventListener('waiting', function() {
                    bufferStallCount++;
                    console.log(`视频缓冲中，卡顿计数: ${bufferStallCount}`);

                    // 如果连续卡顿次数过多，主动降低画质
                    if (bufferStallCount >= STALL_THRESHOLD && hls.levels && hls.levels.length > 1) {
                        const currentLevel = hls.currentLevel;
                        // 降低一级画质（如果不是最低级）
                        if (currentLevel > 0) {
                            hls.currentLevel = currentLevel - 1;
                            console.log(`智能降低画质: ${currentLevel} → ${currentLevel - 1}`);
                            bufferStallCount = 0; // 重置计数
                        }
                    }
                });

                video.addEventListener('playing', function() {
                    // 播放恢复时重置计数
                    bufferStallCount = Math.max(0, bufferStallCount - 1);
                });

                // 定期检查缓冲区健康度
                video.addEventListener('timeupdate', function() {
                    const now = Date.now();
                    if (now - lastBufferCheck < BUFFER_CHECK_INTERVAL) return;
                    lastBufferCheck = now;

                    // 检查当前缓冲区长度
                    const buffered = video.buffered;
                    if (buffered.length > 0) {
                        const currentTime = video.currentTime;
                        const bufferedEnd = buffered.end(buffered.length - 1);
                        const bufferLength = bufferedEnd - currentTime;

                        // 如果缓冲区过小且有多个画质级别
                        if (bufferLength < LOW_BUFFER_THRESHOLD && hls.levels && hls.levels.length > 1) {
                            const currentLevel = hls.currentLevel;
                            // 预防性降低画质
                            if (currentLevel > 0) {
                                hls.currentLevel = currentLevel - 1;
                                console.log(`预防性降低画质（缓冲不足 ${bufferLength.toFixed(1)}s）: ${currentLevel} → ${currentLevel - 1}`);
                            }
                        }
                    }
                });
            }
        }
    });

    // artplayer 没有 'fullscreenWeb:enter', 'fullscreenWeb:exit' 等事件
    // 所以原控制栏隐藏代码并没有起作用
    // 实际起作用的是 artplayer 默认行为，它支持自动隐藏工具栏
    // 但有一个 bug： 在副屏全屏时，鼠标移出副屏后不会自动隐藏工具栏
    // 下面进一并重构和修复：
    let hideTimer;

    // 隐藏控制栏
    function hideControls() {
        if (art && art.controls) {
            art.controls.show = false;
        }
    }

    // 重置计时器，计时器超时时间与 artplayer 保持一致
    function resetHideTimer() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hideControls();
        }, Artplayer.CONTROL_HIDE_TIME);
    }

    // 处理鼠标离开浏览器窗口
    function handleMouseOut(e) {
        if (e && !e.relatedTarget) {
            resetHideTimer();
        }
    }

    // 全屏状态切换时注册/移除 mouseout 事件，监听鼠标移出屏幕事件
    // 从而对播放器状态栏进行隐藏倒计时
    function handleFullScreen(isFullScreen, isWeb) {
        if (isFullScreen) {
            document.addEventListener('mouseout', handleMouseOut);
        } else {
            document.removeEventListener('mouseout', handleMouseOut);
            // 退出全屏时清理计时器
            clearTimeout(hideTimer);
        }

        if (!isWeb) {
            if (window.screen.orientation && window.screen.orientation.lock) {
                window.screen.orientation.lock('landscape')
                    .then(() => {
                    })
                    .catch((error) => {
                    });
            }
        }
    }

    // 播放器加载完成后初始隐藏工具栏
    art.on('ready', () => {
        hideControls();
    });

    // 全屏 Web 模式处理
    art.on('fullscreenWeb', function (isFullScreen) {
        handleFullScreen(isFullScreen, true);
    });

    // 全屏模式处理
    art.on('fullscreen', function (isFullScreen) {
        handleFullScreen(isFullScreen, false);
    });

    art.on('video:loadedmetadata', function() {
        videoHasEnded = false; // 视频加载时重置结束标志
        // 优先使用URL传递的position参数
        const urlParams = new URLSearchParams(window.location.search);
        const savedPosition = parseInt(urlParams.get('position') || '0');

        if (savedPosition > 10 && savedPosition < art.duration - 2) {
            // 如果URL中有有效的播放位置参数，直接使用它
            art.currentTime = savedPosition;
            showPositionRestoreHint(savedPosition);
        } else {
            // 否则尝试从本地存储恢复播放进度
            try {
                const progressKey = 'videoProgress_' + getVideoId();
                const progressStr = localStorage.getItem(progressKey);
                if (progressStr && art.duration > 0) {
                    const progress = JSON.parse(progressStr);
                    if (
                        progress &&
                        typeof progress.position === 'number' &&
                        progress.position > 10 &&
                        progress.position < art.duration - 2
                    ) {
                        art.currentTime = progress.position;
                        showPositionRestoreHint(progress.position);
                    }
                }
            } catch (e) {
                console.error('恢复播放进度失败:', e);
            }
        }

        // 恢复播放速度（仅针对当前影片）
        try {
            let playbackRateToRestore = 1.0; // 默认播放速度

            // 1. 优先尝试从观看历史中恢复该影片的播放速度
            const urlParams = new URLSearchParams(window.location.search);
            const sourceName = urlParams.get('source') || '';
            const id_from_params = urlParams.get('id');

            const show_identifier = getShowIdentifier(sourceName, id_from_params);

            const historyRaw = localStorage.getItem('viewingHistory');
            if (historyRaw) {
                const history = JSON.parse(historyRaw);
                const historyItem = history.find(item =>
                    item.title === currentVideoTitle &&
                    item.sourceName === sourceName &&
                    item.showIdentifier === show_identifier
                );
                if (historyItem && historyItem.playbackRate) {
                    playbackRateToRestore = historyItem.playbackRate;
                }
            }

            // 2. 如果历史中没有，尝试从播放进度数据中恢复
            if (playbackRateToRestore === 1.0) {
                const progressKey = 'videoProgress_' + getVideoId();
                const progressStr = localStorage.getItem(progressKey);
                if (progressStr) {
                    const progress = JSON.parse(progressStr);
                    if (progress && progress.playbackRate) {
                        playbackRateToRestore = progress.playbackRate;
                    }
                }
            }

            // 验证并应用播放速度
            if (playbackRateToRestore >= 0.5 && playbackRateToRestore <= 3) {
                art.playbackRate = playbackRateToRestore;
                // 更新自定义播放倍速按钮显示
                updatePlaybackRateButton(playbackRateToRestore);
            }
        } catch (e) {
            console.error('恢复播放速度失败:', e);
        }

        // 设置进度条点击监听
        setupProgressBarPreciseClicks();

        // 视频加载成功后，在稍微延迟后将其添加到观看历史
        setTimeout(saveToHistory, 3000);

        // 优化10: 移除冗余的定期保存，已在timeupdate中实现节流保存
    })

    // 错误处理
    art.on('video:error', function (error) {
        // 如果正在切换视频，忽略错误
        if (window.isSwitchingVideo) {
            return;
        }

        // 隐藏所有加载指示器

        showError('视频播放失败: ' + (error.message || '未知错误'));
    });

    // 添加移动端长按三倍速播放功能
    setupLongPressSpeedControl();

    // 监听播放速度变化，仅保存到当前影片
    art.on('video:ratechange', function() {
        try {
            const currentRate = art.playbackRate;

            // 保存到当前影片的播放进度
            saveCurrentProgress();

            // 立即更新观看历史中的播放速度
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const sourceName = urlParams.get('source') || '';
                const id_from_params = urlParams.get('id');

                const show_identifier = getShowIdentifier(sourceName, id_from_params);

                const historyRaw = localStorage.getItem('viewingHistory');
                if (historyRaw) {
                    const history = JSON.parse(historyRaw);
                    const idx = history.findIndex(item =>
                        item.title === currentVideoTitle &&
                        item.sourceName === sourceName &&
                        item.showIdentifier === show_identifier
                    );

                    if (idx !== -1) {
                        // 找到了历史记录，更新播放速度
                        history[idx].playbackRate = currentRate;
                        history[idx].timestamp = Date.now();
                        localStorage.setItem('viewingHistory', JSON.stringify(history));
                        console.log(`播放速度已更新: ${currentRate}x (影片: ${currentVideoTitle})`);
                    } else {
                        // 历史记录还不存在，先创建一个基础记录
                        console.log(`历史记录不存在，创建新记录并保存播放速度: ${currentRate}x`);
                        saveToHistory(); // 立即创建历史记录
                    }
                }
            } catch (e) {
                console.error('更新历史记录播放速度失败:', e);
            }
        } catch (e) {
            console.error('保存播放速度失败:', e);
        }
    });

    // 视频播放结束事件
    art.on('video:ended', function () {
        videoHasEnded = true;

        clearVideoProgress();

        // 如果自动播放下一集开启，且确实有下一集
        if (autoplayEnabled && currentEpisodeIndex < currentEpisodes.length - 1) {
            // 稍长延迟以确保所有事件处理完成
            setTimeout(() => {
                // 确认不是因为用户拖拽导致的假结束事件
                playNextEpisode();
                videoHasEnded = false; // 重置标志
            }, 1000);
        } else {
            art.fullscreen = false;
        }
    });

    // 添加双击全屏支持
    art.on('video:playing', () => {
        // 绑定双击事件到视频容器
        if (art.video) {
            art.video.addEventListener('dblclick', () => {
                art.fullscreen = !art.fullscreen;
                art.play();
            });
        }
    });

    // 10秒后如果仍在加载，但不立即显示错误
    setTimeout(function () {
        // 如果视频已经播放开始，则不显示错误
        if (art && art.video && art.video.currentTime > 0) {
            return;
        }
    }, 10000);
}

// 自定义M3U8 Loader用于过滤广告
class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config) {
        super(config);
        const load = this.load.bind(this);
        this.load = function (context, config, callbacks) {
            // 拦截manifest和level请求
            if (context.type === 'manifest' || context.type === 'level') {
                const onSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function (response, stats, context) {
                    // 如果是m3u8文件，处理内容以移除广告分段
                    if (response.data && typeof response.data === 'string') {
                        // 过滤掉广告段 - 实现更精确的广告过滤逻辑
                        response.data = filterAdsFromM3U8(response.data, true);
                    }
                    return onSuccess(response, stats, context);
                };
            }
            // 执行原始load方法
            load(context, config, callbacks);
        };
    }
}

// 过滤可疑的广告内容（单轮遍历：同时做过滤 + 统计，避免二次 O(n) 开销）
function filterAdsFromM3U8(m3u8Content, strictMode = false) {
    if (!m3u8Content) return '';

    const lines = m3u8Content.split('\n');
    const filteredLines = [];
    const tsFiles = [];
    const discontinuityPositions = new Set();
    let nextIsAfterDiscontinuity = false;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        // 过滤 #EXT-X-DISCONTINUITY 行
        if (line.includes('#EXT-X-DISCONTINUITY')) {
            nextIsAfterDiscontinuity = true;
            continue; // 不加入 filteredLines
        }

        // 保留原始行
        filteredLines.push(rawLine);

        // 广告过滤开启时同步做统计：匹配 .ts 文件序号和 DISCONTINUITY 位置
        if (adFilteringEnabled && line.endsWith('.ts')) {
            const match = line.match(/(\d+)\.ts$/);
            if (match) {
                const idx = tsFiles.length;
                tsFiles.push({ sequence: parseInt(match[1], 10) });
                if (nextIsAfterDiscontinuity) {
                    discontinuityPositions.add(idx);
                    nextIsAfterDiscontinuity = false;
                }
            }
        }
    }

    // 统计广告区间数（不在主循环中阻塞）
    if (adFilteringEnabled && tsFiles.length > 1) {
        let discontinuityCount = 0;
        let inAdSegment = false;

        for (let i = 1; i < tsFiles.length; i++) {
            const diff = tsFiles[i].sequence - tsFiles[i - 1].sequence;
            const hasDiscontinuity = discontinuityPositions.has(i);

            if (diff > 1 && hasDiscontinuity && !inAdSegment) {
                discontinuityCount++;
                inAdSegment = true;
            } else if (diff < 0 && hasDiscontinuity && inAdSegment) {
                inAdSegment = false;
            }
        }

        if (discontinuityCount > 0) {
            totalAdsFiltered += discontinuityCount;
            updateAdFilterDisplay();
        }
    }

    return filteredLines.join('\n');
}

// 更新广告过滤显示（只更新数字与动画，不重置胶囊的自动隐藏计时）
function updateAdFilterDisplay() {
    const adFilterCountElement = document.getElementById('adFilterCount');
    if (adFilterCountElement) {
        adFilterCountElement.textContent = totalAdsFiltered;

        // 添加动画效果
        adFilterCountElement.classList.add('scale-125');
        setTimeout(() => {
            adFilterCountElement.classList.remove('scale-125');
        }, 300);
    }
}

// 显示广告过滤胶囊，5秒后自动隐藏
function showAdFilterStats() {
    const adFilterStatsElement = document.getElementById('adFilterStats');
    if (!adFilterStatsElement) return;

    clearTimeout(adFilterHideTimer);
    adFilterStatsElement.style.display = 'flex';

    adFilterHideTimer = setTimeout(() => {
        adFilterStatsElement.style.display = 'none';
    }, 5000);
}

// 更新广告统计区域的显示/隐藏状态
function updateAdFilterStatsVisibility() {
    const adFilterStatsElement = document.getElementById('adFilterStats');
    if (adFilterStatsElement) {
        if (adFilteringEnabled) {
            showAdFilterStats();
        } else {
            clearTimeout(adFilterHideTimer);
            adFilterStatsElement.style.display = 'none';
        }
    }
}


// 显示错误
function showError(message) {
    // 在视频已经播放的情况下不显示错误
    if (art && art.video && art.video.currentTime > 1) {
        return;
    }
    const errorEl = document.getElementById('error');
    if (errorEl) errorEl.style.display = 'flex';
    const errorMsgEl = document.getElementById('error-message');
    if (errorMsgEl) errorMsgEl.textContent = message;
}

// 更新集数信息（仅顶部副标题）
function updateEpisodeInfo() {
    const info = currentEpisodes.length > 0
        ? `第 ${currentEpisodeIndex + 1}/${currentEpisodes.length} 集`
        : '无集数信息';
    document.getElementById('episodeInfo').textContent = info;
}

// 更新播放器内控制栏（播放键两侧）上一集/下一集按钮的禁用状态
function updatePlayerEpisodeControls() {
    const prevControl = window.prevEpisodeControl;
    const nextControl = window.nextEpisodeControl;

    if (prevControl) {
        prevControl.classList.toggle('disabled', !(currentEpisodeIndex > 0));
    }
    if (nextControl) {
        nextControl.classList.toggle('disabled', !(currentEpisodeIndex < currentEpisodes.length - 1));
    }
}

// 集数分页状态（分页控件与资源面板一致）
let episodePage = 0;
const EPISODES_PER_PAGE = 20;

// 渲染集数按钮（分页显示）
function renderEpisodes() {
    const episodesList = document.getElementById('episodesList');
    if (!episodesList) return;

    if (!currentEpisodes || currentEpisodes.length === 0) {
        episodePage = 0; // 空集数时收敛页码（REV-005）
        episodesList.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">没有可用的集数</div>';
        updateEpisodePagination();
        return;
    }

    const displayList = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    const totalPages = Math.max(1, Math.ceil(displayList.length / EPISODES_PER_PAGE));
    episodePage = Math.min(Math.max(0, episodePage), totalPages - 1);

    const start = episodePage * EPISODES_PER_PAGE;
    const end = Math.min(start + EPISODES_PER_PAGE, displayList.length);

    let html = '';
    for (let i = start; i < end; i++) {
        // 根据倒序状态计算真实的剧集索引
        const realIndex = episodesReversed ? displayList.length - 1 - i : i;
        const isActive = realIndex === currentEpisodeIndex;

        html += episodeButtonHTML(realIndex, isActive, { onClick: 'playEpisode', withId: true, extraClass: 'hover:!shadow-none episode-btn' });
    }

    episodesList.innerHTML = html;
    updateEpisodePagination();
}

// 更新集数分页控件状态（页码 + 翻页按钮禁用态）
function updateEpisodePagination() {
    const info = document.getElementById('episodePageInfo');
    const prev = document.getElementById('episodePagePrev');
    const next = document.getElementById('episodePageNext');
    const totalPages = Math.max(1, Math.ceil(currentEpisodes.length / EPISODES_PER_PAGE));
    if (info) info.textContent = `${episodePage + 1}/${totalPages}`;
    if (prev) prev.disabled = episodePage <= 0;
    if (next) next.disabled = episodePage >= totalPages - 1;
}

// 绑定集数翻页按钮（静态按钮，页面加载时绑定一次）
function bindEpisodePagination() {
    const prev = document.getElementById('episodePagePrev');
    const next = document.getElementById('episodePageNext');
    if (!prev || !next) return;
    prev.onclick = () => {
        if (episodePage > 0) { episodePage--; renderEpisodes(); }
    };
    next.onclick = () => {
        const totalPages = Math.max(1, Math.ceil(currentEpisodes.length / EPISODES_PER_PAGE));
        if (episodePage < totalPages - 1) { episodePage++; renderEpisodes(); }
    };
}

// 播放指定集数
function playEpisode(index) {
    // 确保index在有效范围内
    if (index < 0 || index >= currentEpisodes.length) {
        return;
    }

    // 重置广告过滤计数器
    totalAdsFiltered = 0;
    updateAdFilterDisplay();

    // 新一集开始播放时展示胶囊（仅当广告过滤开启；5秒后自动隐藏）
    if (adFilteringEnabled) {
        showAdFilterStats();
    }

    // 保存当前播放进度（如果正在播放）
    if (art && art.video && !art.video.paused && !videoHasEnded) {
        saveCurrentProgress();
    }

    // 首先隐藏之前可能显示的错误
    document.getElementById('error').style.display = 'none';

    // 获取 sourceCode
    const urlParams2 = new URLSearchParams(window.location.search);
    const sourceCode = urlParams2.get('source_code');

    // 准备切换剧集的URL
    const url = currentEpisodes[index];

    // 更新当前剧集索引
    currentEpisodeIndex = index;
    currentVideoUrl = url;
    videoHasEnded = false; // 重置视频结束标志

    // 切集后跳转到包含当前集数的分页页，保证当前集高亮可见（REV-001）
    const displayIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
    episodePage = Math.floor(displayIndex / EPISODES_PER_PAGE);

    clearVideoProgress();

    // 更新URL参数（不刷新页面）
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('index', index);
    currentUrl.searchParams.set('url', url);
    currentUrl.searchParams.delete('position');
    window.history.replaceState({}, '', currentUrl.toString());

    if (isWebkit) {
        initPlayer(url);
    } else {
        art.switch = url;
    }

    // 更新UI
    updateEpisodeInfo();
    updatePlayerEpisodeControls();
    renderEpisodes();

    // 重置用户点击位置记录
    userClickedPosition = null;

    // 三秒后保存到历史记录
    setTimeout(() => saveToHistory(), 3000);
}

// 播放上一集
function playPreviousEpisode() {
    if (currentEpisodeIndex > 0) {
        playEpisode(currentEpisodeIndex - 1);
    }
}

// 播放下一集
function playNextEpisode() {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
    }
}

// 切换集数排序
function toggleEpisodeOrder() {
    episodesReversed = !episodesReversed;

    // 保存到localStorage
    localStorage.setItem('episodesReversed', episodesReversed);

    // 排序切换后回到第一页
    episodePage = 0;

    // 重新渲染集数列表
    renderEpisodes();

    // 更新排序按钮
    updateOrderButton();
}

// 更新排序按钮状态
function updateOrderButton() {
    const orderText = document.getElementById('orderText');
    const orderIcon = document.getElementById('orderIcon');

    if (orderText && orderIcon) {
        orderText.textContent = episodesReversed ? '正序排列' : '倒序排列';
        orderIcon.style.transform = episodesReversed ? 'rotate(180deg)' : '';
    }
}

// 设置进度条准确点击处理
function setupProgressBarPreciseClicks() {
    // 查找DPlayer的进度条元素
    const progressBar = document.querySelector('.dplayer-bar-wrap');
    if (!progressBar || !art || !art.video) return;

    // 移除可能存在的旧事件监听器
    progressBar.removeEventListener('mousedown', handleProgressBarClick);

    // 添加新的事件监听器
    progressBar.addEventListener('mousedown', handleProgressBarClick);

    // 在移动端也添加触摸事件支持
    progressBar.removeEventListener('touchstart', handleProgressBarTouch);
    progressBar.addEventListener('touchstart', handleProgressBarTouch);

    // 处理进度条点击
    function handleProgressBarClick(e) {
        if (!art || !art.video) return;

        // 计算点击位置相对于进度条的比例
        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;

        // 计算点击位置对应的视频时间
        const duration = art.video.duration;
        let clickTime = percentage * duration;

        // 处理视频接近结尾的情况
        if (duration - clickTime < 1) {
            // 如果点击位置非常接近结尾，稍微往前移一点
            clickTime = Math.min(clickTime, duration - 1.5);

        }

        // 记录用户点击的位置
        userClickedPosition = clickTime;

        // 阻止默认事件传播，避免DPlayer内部逻辑将视频跳至末尾
        e.stopPropagation();

        // 直接设置视频时间
        art.seek(clickTime);
    }

    // 处理移动端触摸事件
    function handleProgressBarTouch(e) {
        if (!art || !art.video || !e.touches[0]) return;

        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = (touch.clientX - rect.left) / rect.width;

        const duration = art.video.duration;
        let clickTime = percentage * duration;

        // 处理视频接近结尾的情况
        if (duration - clickTime < 1) {
            clickTime = Math.min(clickTime, duration - 1.5);
        }

        // 记录用户点击的位置
        userClickedPosition = clickTime;

        e.stopPropagation();
        art.seek(clickTime);
    }
}

// 优化8: 播放历史优化 - 使用Map结构加速查找
function saveToHistory() {
    // 确保 currentEpisodes 非空且有当前视频URL
    if (!currentEpisodes || currentEpisodes.length === 0 || !currentVideoUrl) {
        return;
    }

    // 尝试从URL中获取参数
    const urlParams = new URLSearchParams(window.location.search);
    const sourceName = urlParams.get('source') || '';
    const sourceCode = urlParams.get('source') || '';
    const id_from_params = urlParams.get('id');

    // 获取并验证封面URL（优先使用切源后同步的 currentVodPic，其次回退 URL 参数）
    const vodPicParam = urlParams.get('vod_pic');
    let vod_pic = currentVodPic || '';
    if (!vod_pic && vodPicParam) {
        try {
            const decodedUrl = decodeURIComponent(vodPicParam);
            vod_pic = isValidImageUrl(decodedUrl) ? decodedUrl : '';
        } catch (e) {
            console.warn('Invalid vod_pic URL encoding:', e);
            vod_pic = '';
        }
    }

    // 获取当前播放进度
    let currentPosition = 0;
    let videoDuration = 0;

    if (art && art.video) {
        currentPosition = art.video.currentTime;
        videoDuration = art.video.duration;
    }

    // Define a show identifier
    const show_identifier_for_video_info = getShowIdentifier(sourceName, id_from_params);

    // 构建唯一键用于Map查找：以规范化片名为跨源稳定身份（源相关 id/sourceName 随切源变化，不能用做去重键）
    const uniqueKey = currentVideoTitle.trim();

    // 构建要保存的视频信息对象
    const videoInfo = {
        title: currentVideoTitle,
        directVideoUrl: currentVideoUrl,
        url: `player.html?url=${encodeURIComponent(currentVideoUrl)}&title=${encodeURIComponent(currentVideoTitle)}&source=${encodeURIComponent(sourceName)}&source_code=${encodeURIComponent(sourceCode)}&id=${encodeURIComponent(id_from_params || '')}&index=${currentEpisodeIndex}&position=${Math.floor(currentPosition || 0)}`,
        episodeIndex: currentEpisodeIndex,
        sourceName: sourceName,
        vod_id: id_from_params || '',
        sourceCode: sourceCode,
        showIdentifier: show_identifier_for_video_info,
        timestamp: Date.now(),
        playbackPosition: currentPosition,
        duration: videoDuration,
        playbackRate: art && art.playbackRate ? art.playbackRate : 1.0,
        episodes: currentEpisodes && currentEpisodes.length > 0 ? [...currentEpisodes] : [],
        vod_pic: vod_pic
    };

    try {
        const history = JSON.parse(localStorage.getItem('viewingHistory') || '[]');

        // 使用Map加速查找
        const historyMap = new Map();
        history.forEach((item, index) => {
            const key = (item.title || '').trim();
            if (!key) return; // 空 title 不进 Map，避免空键误合并
            const existing = historyMap.get(key);
            // 同 title 多条时保留 timestamp 最新的一条（自愈去重时以最新记录为准）
            if (!existing || (item.timestamp || 0) > (existing.item.timestamp || 0)) {
                historyMap.set(key, { item, index });
            }
        });

        if (uniqueKey && historyMap.has(uniqueKey)) {
            // 存在则更新
            const { item: existingItem, index: existingIndex } = historyMap.get(uniqueKey);

            existingItem.title = videoInfo.title;
            existingItem.episodeIndex = videoInfo.episodeIndex;
            existingItem.timestamp = videoInfo.timestamp;
            existingItem.sourceName = videoInfo.sourceName;
            existingItem.sourceCode = videoInfo.sourceCode;
            existingItem.vod_id = videoInfo.vod_id;
            existingItem.showIdentifier = videoInfo.showIdentifier;
            existingItem.directVideoUrl = videoInfo.directVideoUrl;
            existingItem.url = videoInfo.url;
            existingItem.playbackPosition = videoInfo.playbackPosition > 10 ? videoInfo.playbackPosition : (existingItem.playbackPosition || 0);
            existingItem.duration = videoInfo.duration || existingItem.duration;
            existingItem.playbackRate = videoInfo.playbackRate;
            existingItem.vod_pic = videoInfo.vod_pic || existingItem.vod_pic || '';

            // 更新集数列表（切源后同步为新源集数）
            if (videoInfo.episodes && videoInfo.episodes.length > 0) {
                existingItem.episodes = [...videoInfo.episodes];
            }

            // 移到最前面，并移除同片名的其他残留记录（自愈去重，切源/切集不再叠加重复条目）
            const updatedItem = history.splice(existingIndex, 1)[0];
            for (let i = history.length - 1; i >= 0; i--) {
                if ((history[i].title || '').trim() === uniqueKey) {
                    history.splice(i, 1);
                }
            }
            history.unshift(updatedItem);
        } else {
            // 添加新记录到最前面
            history.unshift(videoInfo);
        }

        // 限制历史记录数量为50条
        if (history.length > 50) history.splice(50);

        localStorage.setItem('viewingHistory', JSON.stringify(history));
    } catch (e) {
        console.error('保存历史记录失败:', e);
    }
}

// 显示恢复位置提示
function showPositionRestoreHint(position) {
    if (!position || position < 10) return;

    // 创建提示元素
    const hint = document.createElement('div');
    hint.className = 'position-restore-hint';
    hint.innerHTML = `
        <div class="hint-content">
            已从 ${formatTime(position)} 继续播放
        </div>
    `;

    // 添加到播放器容器
    const playerContainer = document.querySelector('.player-container'); // Ensure this selector is correct
    if (playerContainer) { // Check if playerContainer exists
        playerContainer.appendChild(hint);
    } else {
        return; // Exit if container not found
    }

    // 显示提示
    setTimeout(() => {
        hint.classList.add('show');

        // 3秒后隐藏
        setTimeout(() => {
            hint.classList.remove('show');
            setTimeout(() => hint.remove(), 300);
        }, 3000);
    }, 100);
}

// 格式化时间为 mm:ss 格式
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 优化5: 进度保存优化 - 使用防抖+批量更新
const progressQueue = new Map();
let progressSaveTimer = null;

function saveCurrentProgress() {
    if (!art || !art.video) return;
    const currentTime = art.video.currentTime;
    const duration = art.video.duration;
    if (!duration || currentTime < 1) return;

    const progressKey = getVideoId();
    const progressData = {
        position: currentTime,
        duration: duration,
        playbackRate: art.playbackRate || 1.0,
        timestamp: Date.now()
    };

    // 添加到队列
    progressQueue.set(progressKey, progressData);

    // 防抖：500ms后批量写入
    clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(flushProgressQueue, 500);
}

function flushProgressQueue() {
    if (progressQueue.size === 0) return;

    try {
        // 批量写入所有待保存的进度
        progressQueue.forEach((data, key) => {
            localStorage.setItem(`videoProgress_${key}`, JSON.stringify(data));
        });

        // 同步更新 viewingHistory
        const historyRaw = localStorage.getItem('viewingHistory');
        if (historyRaw) {
            const history = JSON.parse(historyRaw);
            let historyUpdated = false;

            progressQueue.forEach((data, key) => {
                const idx = history.findIndex(item =>
                    item.title === currentVideoTitle &&
                    (item.episodeIndex === undefined || item.episodeIndex === currentEpisodeIndex)
                );

                if (idx !== -1) {
                    if (
                        Math.abs((history[idx].playbackPosition || 0) - data.position) > 2 ||
                        Math.abs((history[idx].duration || 0) - data.duration) > 2
                    ) {
                        history[idx].playbackPosition = data.position;
                        history[idx].duration = data.duration;
                        history[idx].playbackRate = data.playbackRate;
                        history[idx].timestamp = data.timestamp;
                        historyUpdated = true;
                    }
                }
            });

            if (historyUpdated) {
                localStorage.setItem('viewingHistory', JSON.stringify(history));
            }
        }

        progressQueue.clear();
    } catch (e) {
        console.error('批量保存进度失败:', e);
    }
}

// 设置移动端长按三倍速播放功能
function setupLongPressSpeedControl() {
    if (!art || !art.video) return;

    const playerElement = document.getElementById('player');
    let longPressTimer = null;
    let originalPlaybackRate = 1.0;
    let isLongPress = false;

    // 显示快速提示
    function showSpeedHint(speed) {
        showShortcutHint(`${speed}倍速`, 'right');
    }

    // 禁用右键
    playerElement.oncontextmenu = () => {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // 只在移动设备上禁用右键
        if (isMobile) {
            const dplayerMenu = document.querySelector(".dplayer-menu");
            const dplayerMask = document.querySelector(".dplayer-mask");
            if (dplayerMenu) dplayerMenu.style.display = "none";
            if (dplayerMask) dplayerMask.style.display = "none";
            return false;
        }
        return true; // 在桌面设备上允许右键菜单
    };

    // 触摸开始事件
    playerElement.addEventListener('touchstart', function (e) {
        // 检查视频是否正在播放，如果没有播放则不触发长按功能
        if (art.video.paused) {
            return; // 视频暂停时不触发长按功能
        }

        // 保存原始播放速度
        originalPlaybackRate = art.video.playbackRate;

        // 设置长按计时器
        longPressTimer = setTimeout(() => {
            // 再次检查视频是否仍在播放
            if (art.video.paused) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                return;
            }

            // 长按超过500ms，设置为3倍速
            art.video.playbackRate = 3.0;
            isLongPress = true;
            showSpeedHint(3.0);

            // 只在确认为长按时阻止默认行为
            e.preventDefault();
        }, 500);
    }, { passive: false });

    // 触摸结束事件
    playerElement.addEventListener('touchend', function (e) {
        // 清除长按计时器
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // 如果是长按状态，恢复原始播放速度
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
            showSpeedHint(originalPlaybackRate);

            // 阻止长按后的点击事件
            e.preventDefault();
        }
        // 如果不是长按，则允许正常的点击事件（暂停/播放）
    });

    // 触摸取消事件
    playerElement.addEventListener('touchcancel', function () {
        // 清除长按计时器
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // 如果是长按状态，恢复原始播放速度
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
        }
    });

    // 触摸移动事件 - 防止在长按时触发页面滚动
    playerElement.addEventListener('touchmove', function (e) {
        if (isLongPress) {
            e.preventDefault();
        }
    }, { passive: false });

    // 视频暂停时取消长按状态
    art.video.addEventListener('pause', function () {
        if (isLongPress) {
            art.video.playbackRate = originalPlaybackRate;
            isLongPress = false;
        }

        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
}

// 清除视频进度记录
function clearVideoProgress() {
    const progressKey = `videoProgress_${getVideoId()}`;
    try {
        localStorage.removeItem(progressKey);
    } catch (e) {
        console.error('清除播放进度失败:', e);
    }
}

// 获取视频唯一标识
function getVideoId() {
    // 使用视频标题和集数索引作为唯一标识
    // If currentVideoUrl is available and more unique, prefer it. Otherwise, fallback.
    if (currentVideoUrl) {
        return `${encodeURIComponent(currentVideoUrl)}`;
    }
    return `${encodeURIComponent(currentVideoTitle)}_${currentEpisodeIndex}`;
}

// ========== 右侧面板收起/展开 ==========
function togglePlayerSidebar() {
    const layout = document.getElementById('playerLayout');
    if (!layout) return;
    const collapsed = layout.classList.toggle('sidebar-collapsed');
    localStorage.setItem('playerSidebarCollapsed', String(collapsed));

    // 容器宽度变化后通知播放器重新计算尺寸（等宽度过渡动画结束）
    if (art && typeof art.resize === 'function') {
        setTimeout(() => art.resize(), 250);
    }
}

function initPlayerSidebar() {
    const layout = document.getElementById('playerLayout');
    if (!layout) return;
    // 折叠状态仅桌面端分栏（≥1024px）生效，避免跨端污染 DOM class
    if (window.matchMedia('(min-width: 1024px)').matches) {
        layout.classList.toggle('sidebar-collapsed', localStorage.getItem('playerSidebarCollapsed') === 'true');
    } else {
        layout.classList.remove('sidebar-collapsed');
    }
}

// 侧栏高度同步函数（可被资源加载等事件兜底调用）
let sidebarHeightSync = null;

// 桌面端分栏时，侧栏高度实时同步为左栏高度（含 padding-bottom），保证左右严格对齐
// 左栏 .player-layout-main 高度 = 播放器实际高度 + padding-bottom 1rem（替代原 #playerContainer mb-4）
function initSidebarHeightSync() {
    const main = document.querySelector('.player-layout-main');
    const sidebar = document.getElementById('playerSidebar');
    if (!main || !sidebar) return;

    sidebarHeightSync = () => {
        if (window.matchMedia('(min-width: 1024px)').matches) {
            sidebar.style.height = main.offsetHeight + 'px';
        } else {
            sidebar.style.height = '';
        }
    };

    // 播放器随宽度自适应（16:9），左栏高度变化时同步侧栏
    if (window.ResizeObserver) {
        new ResizeObserver(sidebarHeightSync).observe(main);
    }
    window.addEventListener('resize', sidebarHeightSync);
    sidebarHeightSync();
}

// 支持在iframe中关闭播放器
function closeEmbeddedPlayer() {
    try {
        if (window.self !== window.top) {
            // 如果在iframe中，尝试调用父窗口的关闭方法
            if (window.parent && typeof window.parent.closeVideoPlayer === 'function') {
                window.parent.closeVideoPlayer();
                return true;
            }
        }
    } catch (e) {
        console.error('尝试关闭嵌入式播放器失败:', e);
    }
    return false;
}

function renderResourceInfoBar() {
    // 获取容器元素
    const container = document.getElementById('resourceInfoBarContainer');
    if (!container) return;

    // 获取当前视频 source_code
    const urlParams = new URLSearchParams(window.location.search);
    const currentSource = urlParams.get('source') || '';

    // 查找当前源名称，从 API_SITES 和 custom_api 中查找即可
    let resourceName = currentSource;
    if (currentSource && API_SITES[currentSource]) {
        resourceName = API_SITES[currentSource].name;
    }
    if (resourceName === currentSource) {
        const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');
        const customIndex = parseInt(currentSource.replace('custom_', ''), 10);
        if (customAPIs[customIndex]) {
            resourceName = customAPIs[customIndex].name || '自定义资源';
        }
    }

    container.innerHTML = `
      <div class="resource-info-bar-left flex">
        <span>${resourceName}</span>
      </div>
      <div class="panel-pagination">
        <button type="button" class="panel-scroll-btn" id="resourcePagePrev" title="上一页" aria-label="上一页">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <span id="resourcePageInfo" class="panel-page-info">-</span>
        <button type="button" class="panel-scroll-btn" id="resourcePageNext" title="下一页" aria-label="下一页">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>
    `;
    bindResourcePagination();
}

// 测试视频源速率的函数
async function testVideoSourceSpeed(sourceKey, vodId) {
    try {
        const startTime = performance.now();
        
        // 构建API参数
        let apiParams = '';
        if (sourceKey.startsWith('custom_')) {
            const customIndex = sourceKey.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                return { speed: -1, error: 'API配置无效' };
            }
            apiParams = buildCustomApiParams(customApi);
        } else {
            apiParams = '&source=' + sourceKey;
        }
        
        // 添加时间戳防止缓存
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        
        // 获取视频详情
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}${cacheBuster}`, {
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            return { speed: -1, error: '获取失败' };
        }
        
        const data = await response.json();
        
        if (!data.episodes || data.episodes.length === 0) {
            return { speed: -1, error: '无播放源' };
        }
        
        // 测试第一个播放链接的响应速度
        const firstEpisodeUrl = data.episodes[0];
        if (!firstEpisodeUrl) {
            return { speed: -1, error: '链接无效' };
        }
        
        // 测试视频链接响应时间
        const videoTestStart = performance.now();
        try {
            const videoResponse = await fetch(firstEpisodeUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: AbortSignal.timeout(5000) // 5秒超时
            });
            
            const videoTestEnd = performance.now();
            const totalTime = videoTestEnd - startTime;
            
            // 返回总响应时间（毫秒）
            return { 
                speed: Math.round(totalTime),
                episodes: data.episodes.length,
                error: null 
            };
        } catch (videoError) {
            // 如果视频链接测试失败，只返回API响应时间
            const apiTime = performance.now() - startTime;
            return { 
                speed: Math.round(apiTime),
                episodes: data.episodes.length,
                error: null,
                note: 'API响应' 
            };
        }
        
    } catch (error) {
        return { 
            speed: -1, 
            error: error.name === 'AbortError' ? '超时' : '测试失败' 
        };
    }
}

// 格式化速度显示
function formatSpeedDisplay(speedResult) {
    if (speedResult.speed === -1) {
        return `<span class="speed-indicator error">❌ ${speedResult.error}</span>`;
    }
    
    const speed = speedResult.speed;
    let className = 'speed-indicator good';
    let icon = '🟢';
    
    if (speed > 2000) {
        className = 'speed-indicator poor';
        icon = '🔴';
    } else if (speed > 1000) {
        className = 'speed-indicator medium';
        icon = '🟡';
    }
    
    const note = speedResult.note ? ` (${speedResult.note})` : '';
    return `<span class="${className}">${icon} ${speed}ms${note}</span>`;
}

// 侧栏内切换资源列表：异步加载（搜索全部源 + 测速 + 排序），横向滑动展示
// 与播放器初始化解耦：内部全部为异步 fetch，不阻塞播放页加载
async function loadResourceSwitchList() {
    const container = document.getElementById('resourceSwitchList');
    if (!container) return;

    container.innerHTML = '<div class="loading-text">正在加载资源...</div>';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const currentSourceCode = urlParams.get('source');
        const currentVideoId = urlParams.get('id');

        // 搜索
        const resourceOptions = selectedAPIs.map((curr) => {
            if (API_SITES[curr]) {
                return { key: curr, name: API_SITES[curr].name };
            }
            const customIndex = parseInt(curr.replace('custom_', ''), 10);
            if (customAPIs[customIndex]) {
                return { key: curr, name: customAPIs[customIndex].name || '自定义资源' };
            }
            return { key: curr, name: '未知资源' };
        });
        let allResults = {};
        await Promise.all(resourceOptions.map(async (opt) => {
            let queryResult = await searchByAPIAndKeyWord(opt.key, currentVideoTitle);
            if (queryResult.results.length == 0) {
                return
            }
            // 优先取完全同名资源，否则默认取第一个
            let result = queryResult.results[0]
            queryResult.results.forEach((res) => {
                if (res.vod_name == currentVideoTitle) {
                    result = res;
                }
            })
            allResults[opt.key] = result;
        }));

        // 同时测试所有资源的速率
        const speedResults = {};
        await Promise.all(Object.entries(allResults).map(async ([sourceKey, result]) => {
            if (result) {
                speedResults[sourceKey] = await testVideoSourceSpeed(sourceKey, result.vod_id);
            }
        }));

        // 对结果进行排序：当前源最前，其余按速率
        const sortedResults = Object.entries(allResults).sort(([keyA, resultA], [keyB, resultB]) => {
            const isCurrentA = String(keyA) === String(currentSourceCode) && String(resultA.vod_id) === String(currentVideoId);
            const isCurrentB = String(keyB) === String(currentSourceCode) && String(resultB.vod_id) === String(currentVideoId);

            if (isCurrentA && !isCurrentB) return -1;
            if (!isCurrentA && isCurrentB) return 1;

            const speedA = speedResults[keyA]?.speed || 99999;
            const speedB = speedResults[keyB]?.speed || 99999;

            if (speedA === -1 && speedB !== -1) return 1;
            if (speedA !== -1 && speedB === -1) return -1;
            if (speedA === -1 && speedB === -1) return 0;

            return speedA - speedB;
        });

        // 保存排序结果与分页上下文，渲染当前页（每页 RESOURCE_PAGE_SIZE 个）
        resourceResults = sortedResults.filter(([, result]) => result);
        resourcePageCtx = { currentSourceCode, currentVideoId, resourceOptions, speedResults };
        resourcePage = 0;
        renderResourcePage();
    } catch (e) {
        console.error('加载切换资源列表失败:', e);
        container.innerHTML = '<div class="loading-text">资源加载失败，请刷新重试</div>';
    }
}

// ========== 切换资源分页展示 ==========
let resourceResults = [];    // 排序后的 [sourceKey, result] 列表
let resourcePage = 0;        // 当前页（0 基）
let resourcePageCtx = null;  // 渲染所需上下文：当前源/资源选项/速率结果
const RESOURCE_PAGE_SIZE = 3; // 每页显示的视频源数量

// 渲染当前页的资源卡片
function renderResourcePage() {
    const container = document.getElementById('resourceSwitchList');
    if (!container || !resourcePageCtx) return;

    const totalPages = Math.max(1, Math.ceil(resourceResults.length / RESOURCE_PAGE_SIZE));
    resourcePage = Math.min(Math.max(0, resourcePage), totalPages - 1);

    const start = resourcePage * RESOURCE_PAGE_SIZE;
    const pageItems = resourceResults.slice(start, start + RESOURCE_PAGE_SIZE);

    const { currentSourceCode, currentVideoId, resourceOptions, speedResults } = resourcePageCtx;
    let html = '';
    pageItems.forEach(([sourceKey, result]) => {
        const isCurrentSource = String(sourceKey) === String(currentSourceCode) && String(result.vod_id) === String(currentVideoId);
        const sourceName = resourceOptions.find(opt => opt.key === sourceKey)?.name || '未知资源';
        const speedResult = speedResults[sourceKey] || { speed: -1, error: '未测试' };
        html += resourceCardHTML(sourceKey, result, isCurrentSource, sourceName, speedResult);
    });

    container.innerHTML = html || '<div class="loading-text">未找到可切换的资源</div>';

    // 更新页码与翻页按钮状态
    const info = document.getElementById('resourcePageInfo');
    const prev = document.getElementById('resourcePagePrev');
    const next = document.getElementById('resourcePageNext');
    if (info) info.textContent = `${resourcePage + 1}/${totalPages}`;
    if (prev) prev.disabled = resourcePage <= 0;
    if (next) next.disabled = resourcePage >= totalPages - 1;

    // 资源渲染完成后确保侧栏整体高度与左栏一致
    if (typeof sidebarHeightSync === 'function') sidebarHeightSync();
}

// 单个资源卡片 HTML
function resourceCardHTML(sourceKey, result, isCurrentSource, sourceName, speedResult) {
    return `
        <div class="resource-switch-card ${isCurrentSource ? 'is-current' : ''}"
             ${!isCurrentSource ? `onclick="switchToResource('${sourceKey}', '${result.vod_id}')"` : ''}>
            <div class="resource-switch-card-poster">
                <img src="${result.vod_pic}"
                     alt="${result.vod_name}"
                     class="w-full h-full object-cover"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjE3IDggMTIgMyA3IDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEyIDN2MTIiPjwvcGF0aD48L3N2Zz4='">
                <div class="absolute top-1 right-1 speed-badge bg-black bg-opacity-75">
                    ${formatSpeedDisplay(speedResult)}
                </div>
                ${isCurrentSource ? `
                    <div class="resource-switch-card-current">
                        <span>当前播放</span>
                    </div>
                ` : ''}
            </div>
            <div class="resource-switch-card-info">
                <div class="text-xs font-medium text-gray-200 truncate">${result.vod_name}</div>
                <div class="text-[10px] text-gray-400 truncate">${sourceName}</div>
                <div class="text-[10px] text-gray-500 mt-1">
                    ${speedResult.episodes ? `${speedResult.episodes}集` : ''}
                </div>
            </div>
        </div>
    `;
}

// 绑定翻页按钮（资源信息条每次渲染新按钮后调用）
function bindResourcePagination() {
    const prev = document.getElementById('resourcePagePrev');
    const next = document.getElementById('resourcePageNext');
    if (!prev || !next) return;

    prev.onclick = () => {
        if (resourcePage > 0) {
            resourcePage--;
            renderResourcePage();
        }
    };
    next.onclick = () => {
        const totalPages = Math.max(1, Math.ceil(resourceResults.length / RESOURCE_PAGE_SIZE));
        if (resourcePage < totalPages - 1) {
            resourcePage++;
            renderResourcePage();
        }
    };
}

// 切换资源的函数
async function switchToResource(sourceKey, vodId) {
    // 记录当前播放位置，切源后恢复到相同进度
    const resumePosition = art && art.video && art.video.currentTime ? Math.floor(art.video.currentTime) : 0;

    // 切换前保存当前进度（使用当前 videoUrl 作为进度 key，需在更新 currentVideoUrl 前调用）
    if (art && art.video && !art.video.paused && !videoHasEnded) {
        saveCurrentProgress();
    }

    // 不显示全屏 loading：由播放器自身（ArtPlayer）展示加载状态
    try {
        // 构建API参数
        let apiParams = '';

        // 处理自定义API源
        if (sourceKey.startsWith('custom_')) {
            const customIndex = sourceKey.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                showToast('自定义API配置无效', 'error');
                return;
            }
            // 传递 detail 字段
            apiParams = buildCustomApiParams(customApi);
        } else {
            // 内置API
            apiParams = '&source=' + sourceKey;
        }

        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        const response = await fetch(`/api/detail?id=${encodeURIComponent(vodId)}${apiParams}${cacheBuster}`);

        const data = await response.json();

        if (!data.episodes || data.episodes.length === 0) {
            showToast('未找到播放资源', 'error');
            return;
        }

        // 确定要播放的集数索引（保留当前集数，若超出则从第 1 集开始）
        let targetIndex = 0;
        if (currentEpisodeIndex < data.episodes.length) {
            targetIndex = currentEpisodeIndex;
        }
        const targetUrl = data.episodes[targetIndex];

        // 更新本地状态（同页切换，不刷新页面）
        const newTitle = data.vod_name || currentVideoTitle;
        currentVideoTitle = newTitle;
        currentEpisodes = data.episodes;
        currentEpisodeIndex = targetIndex;
        currentVideoUrl = targetUrl;
        videoHasEnded = false;
        totalAdsFiltered = 0;
        updateAdFilterDisplay();
        if (adFilteringEnabled) {
            showAdFilterStats();
        }

        // 保存当前状态到localStorage
        try {
            localStorage.setItem('currentVideoTitle', newTitle);
            localStorage.setItem('currentEpisodes', JSON.stringify(data.episodes));
            localStorage.setItem('currentEpisodeIndex', targetIndex);
            localStorage.setItem('currentSourceCode', sourceKey);
            localStorage.setItem('lastPlayTime', Date.now());
        } catch (e) {
            console.error('保存播放状态失败:', e);
        }

        // 更新 URL（history.replaceState，不触发页面刷新）
        const url = new URL(window.location.href);
        url.searchParams.set('id', vodId);
        url.searchParams.set('source', sourceKey);
        url.searchParams.set('url', targetUrl);
        url.searchParams.set('index', String(targetIndex));
        url.searchParams.set('title', newTitle);
        // 同步新源封面：历史记录/最近观看封面跟随切源变化
        const rawNewVodPic = data.vod_pic || '';
        const newVodPic = rawNewVodPic && isValidImageUrl(rawNewVodPic) ? rawNewVodPic : '';
        currentVodPic = newVodPic;
        if (newVodPic) {
            url.searchParams.set('vod_pic', newVodPic);
        } else {
            url.searchParams.delete('vod_pic');
        }
        // 携带切源前播放位置，播放器加载完成后恢复到相同进度
        if (resumePosition > 0) {
            url.searchParams.set('position', String(resumePosition));
        } else {
            url.searchParams.delete('position');
        }
        window.history.replaceState({}, '', url.toString());

        // 更新页面标题与标题栏
        document.title = newTitle + ' - LibreTV播放器';
        const titleEl = document.getElementById('videoTitle');
        if (titleEl) titleEl.textContent = newTitle;

        // 重新初始化播放器（不刷新页面）
        initPlayer(targetUrl);

        // 刷新侧栏 UI：集数信息、播放器上一集/下一集控制、集数网格、源信息
        updateEpisodeInfo();
        updatePlayerEpisodeControls();
        renderEpisodes();
        renderResourceInfoBar();

        // 其他视频源面板不重新搜索/测速：仅更新"当前播放"标记并重渲染当前页
        if (resourcePageCtx) {
            resourcePageCtx.currentSourceCode = sourceKey;
            resourcePageCtx.currentVideoId = vodId;
            renderResourcePage();
        } else {
            // 资源列表尚未加载完成（首次进入即切源），走一次完整加载
            loadResourceSwitchList();
        }

    } catch (error) {
        console.error('切换资源失败:', error);
        showToast('切换资源失败，请稍后重试', 'error');
    }
}

// 更新播放倍速按钮显示
function updatePlaybackRateButton(rate) {
    if (window.playbackRateControl) {
        const span = window.playbackRateControl.querySelector('span');
        if (span) {
            span.textContent = rate + 'x';
        }
    }
}

// 显示播放倍速菜单
function showPlaybackRateMenu() {
    if (!art) return;

    // 常用播放倍速选项
    const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
    const currentRate = art.playbackRate || 1.0;

    // 检测是否为移动端
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        // 移动端：底部弹出式菜单（参考B站）
        showMobilePlaybackRateMenu(rates, currentRate);
    } else {
        // PC端：右侧弹出菜单
        showDesktopPlaybackRateMenu(rates, currentRate);
    }
}

// PC端播放倍速菜单（参考B站设计）
function showDesktopPlaybackRateMenu(rates, currentRate) {
    // 移除已存在的菜单
    const existingMenu = document.getElementById('desktop-playback-rate-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'desktop-playback-rate-menu';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;

    // 创建菜单容器
    const menuContainer = document.createElement('div');
    menuContainer.style.cssText = `
        background: #1a1a1a;
        border-radius: 12px;
        padding: 0;
        animation: scaleIn 0.2s ease;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
        min-width: 360px;
        max-width: 480px;
    `;

    // 创建标题栏
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #333;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
        font-size: 16px;
        font-weight: bold;
        color: #fff;
    `;
    title.textContent = '播放速度';

    const closeButton = document.createElement('div');
    closeButton.style.cssText = `
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s ease;
        color: #999;
        font-size: 20px;
        line-height: 1;
    `;
    closeButton.innerHTML = '×';
    closeButton.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 255, 255, 0.1)';
        this.style.color = '#fff';
    });
    closeButton.addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
        this.style.color = '#999';
    });
    closeButton.addEventListener('click', closeDesktopMenu);

    header.appendChild(title);
    header.appendChild(closeButton);
    menuContainer.appendChild(header);

    // 创建倍速选项网格
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding: 20px;
    `;

    rates.forEach(rate => {
        const isActive = Math.abs(rate - currentRate) < 0.01;
        const button = document.createElement('div');
        button.style.cssText = `
            padding: 14px;
            text-align: center;
            font-size: 15px;
            font-weight: ${isActive ? 'bold' : 'normal'};
            color: ${isActive ? '#23ade5' : '#fff'};
            background: ${isActive ? 'rgba(35, 173, 229, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
            border: 2px solid ${isActive ? '#23ade5' : 'transparent'};
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        `;
        button.textContent = rate + 'x';

        // 鼠标悬停效果
        button.addEventListener('mouseenter', function() {
            if (!isActive) {
                this.style.background = 'rgba(255, 255, 255, 0.1)';
                this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        });

        button.addEventListener('mouseleave', function() {
            if (!isActive) {
                this.style.background = 'rgba(255, 255, 255, 0.05)';
                this.style.borderColor = 'transparent';
            }
        });

        button.addEventListener('click', function() {
            setPlaybackRate(rate);
            closeDesktopMenu();
        });

        gridContainer.appendChild(button);
    });

    menuContainer.appendChild(gridContainer);

    // 组装
    overlay.appendChild(menuContainer);
    document.body.appendChild(overlay);

    // 点击遮罩层关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeDesktopMenu();
        }
    });

    // 添加动画样式
    if (!document.getElementById('desktop-menu-animations')) {
        const style = document.createElement('style');
        style.id = 'desktop-menu-animations';
        style.textContent = `
            @keyframes scaleIn {
                from {
                    transform: scale(0.9);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            @keyframes scaleOut {
                from {
                    transform: scale(1);
                    opacity: 1;
                }
                to {
                    transform: scale(0.9);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 关闭菜单函数
    function closeDesktopMenu() {
        const menu = document.getElementById('desktop-playback-rate-menu');
        if (menu) {
            const container = menu.querySelector('div');
            if (container) {
                container.style.animation = 'scaleOut 0.2s ease';
            }
            menu.style.opacity = '0';
            setTimeout(() => {
                menu.remove();
            }, 200);
        }
    }

    // ESC键关闭
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeDesktopMenu();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}


// 移动端播放倍速菜单（参考B站设计）
function showMobilePlaybackRateMenu(rates, currentRate) {
    // 移除已存在的菜单
    const existingMenu = document.getElementById('mobile-playback-rate-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'mobile-playback-rate-menu';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9999;
        display: flex;
        align-items: flex-end;
        animation: fadeIn 0.3s ease;
    `;

    // 创建底部菜单容器
    const menuContainer = document.createElement('div');
    menuContainer.style.cssText = `
        width: 100%;
        background: #1a1a1a;
        border-radius: 16px 16px 0 0;
        padding: 20px 0 env(safe-area-inset-bottom);
        animation: slideUp 0.3s ease;
        max-height: 70vh;
        overflow-y: auto;
    `;

    // 创建标题
    const title = document.createElement('div');
    title.style.cssText = `
        padding: 0 20px 16px;
        font-size: 16px;
        font-weight: bold;
        color: #fff;
        text-align: center;
        border-bottom: 1px solid #333;
    `;
    title.textContent = '播放速度';
    menuContainer.appendChild(title);

    // 创建倍速选项网格
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        padding: 20px;
    `;

    rates.forEach(rate => {
        const isActive = Math.abs(rate - currentRate) < 0.01;
        const button = document.createElement('div');
        button.style.cssText = `
            padding: 16px;
            text-align: center;
            font-size: 16px;
            font-weight: ${isActive ? 'bold' : 'normal'};
            color: ${isActive ? '#23ade5' : '#fff'};
            background: ${isActive ? 'rgba(35, 173, 229, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
            border: 2px solid ${isActive ? '#23ade5' : 'transparent'};
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
        button.textContent = rate + 'x';

        // 触摸反馈
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
            this.style.background = isActive ? 'rgba(35, 173, 229, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        });

        button.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
            this.style.background = isActive ? 'rgba(35, 173, 229, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        });

        button.addEventListener('click', function() {
            setPlaybackRate(rate);
            closeMobileMenu();
        });

        gridContainer.appendChild(button);
    });

    menuContainer.appendChild(gridContainer);

    // 创建取消按钮
    const cancelButton = document.createElement('div');
    cancelButton.style.cssText = `
        margin: 0 20px 10px;
        padding: 16px;
        text-align: center;
        font-size: 16px;
        color: #fff;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    `;
    cancelButton.textContent = '取消';

    cancelButton.addEventListener('touchstart', function() {
        this.style.background = 'rgba(255, 255, 255, 0.1)';
    });

    cancelButton.addEventListener('touchend', function() {
        this.style.background = 'rgba(255, 255, 255, 0.05)';
    });

    cancelButton.addEventListener('click', closeMobileMenu);

    menuContainer.appendChild(cancelButton);

    // 组装
    overlay.appendChild(menuContainer);
    document.body.appendChild(overlay);

    // 点击遮罩层关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeMobileMenu();
        }
    });

    // 添加动画样式
    if (!document.getElementById('mobile-menu-animations')) {
        const style = document.createElement('style');
        style.id = 'mobile-menu-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            @keyframes slideDown {
                from { transform: translateY(0); }
                to { transform: translateY(100%); }
            }
        `;
        document.head.appendChild(style);
    }

    // 关闭菜单函数
    function closeMobileMenu() {
        const menu = document.getElementById('mobile-playback-rate-menu');
        if (menu) {
            const container = menu.querySelector('div');
            if (container) {
                container.style.animation = 'slideDown 0.3s ease';
            }
            menu.style.opacity = '0';
            setTimeout(() => {
                menu.remove();
            }, 300);
        }
    }
}

// 设置播放倍速
function setPlaybackRate(rate) {
    if (!art) return;

    art.playbackRate = rate;

    // 更新按钮显示
    updatePlaybackRateButton(rate);

    // 显示提示
    art.notice.show = `播放速度: ${rate}x`;
}


// ========== 移动端选集列表（就地展开） ==========

// 切换选集/数据源面板展开/收起（移动端，替代弹框方式）
function toggleMobileEpisodes() {
    const container = document.getElementById('episodesGridContainer');
    const btnContainer = document.getElementById('mobileEpisodeSelectContainer');
    const body = document.querySelector('.player-sidebar-body');
    if (!container) return;
    const open = container.classList.toggle('mobile-episodes-open');
    // 同步按钮容器状态（箭头旋转）与面板区域状态（等高布局）
    if (btnContainer) btnContainer.classList.toggle('mobile-episodes-open', open);
    if (body) body.classList.toggle('mobile-panel-open', open);
    // 按钮文字与 PC 端"收起"语义一致：收起态"展开" / 展开态"收起"
    const toggleText = document.getElementById('mobileEpisodeToggleText');
    if (toggleText) toggleText.textContent = open ? '收起' : '展开';
    if (open) {
        startMobilePanelHeightSync();
    } else {
        stopMobilePanelHeightSync();
        container.style.height = '';
    }
}

// REV-004：跨断点（≤640px → ≥641px）时清理移动端展开状态与内联高度残留，避免桌面端侧栏被污染
if (window.matchMedia) {
    window.matchMedia('(min-width: 641px)').addEventListener('change', function (e) {
        if (!e.matches) return;
        const container = document.getElementById('episodesGridContainer');
        const btnContainer = document.getElementById('mobileEpisodeSelectContainer');
        const body = document.querySelector('.player-sidebar-body');
        if (container) { container.classList.remove('mobile-episodes-open'); container.style.height = ''; }
        if (btnContainer) btnContainer.classList.remove('mobile-episodes-open');
        if (body) body.classList.remove('mobile-panel-open');
        const toggleText = document.getElementById('mobileEpisodeToggleText');
        if (toggleText) toggleText.textContent = '展开';
        stopMobilePanelHeightSync();
    });
}

// ===== 移动端：选集面板高度跟随资源面板（等高） =====
let mobilePanelHeightObserver = null;

// 同步选集面板高度 = 资源面板当前实际高度
function syncMobilePanelHeight() {
    const ep = document.getElementById('episodesGridContainer');
    const res = document.querySelector('.player-sidebar-body .resource-module');
    if (!ep || !res) return;
    const h = res.offsetHeight;
    if (h > 0) ep.style.height = h + 'px';
}

// 展开后监听资源面板尺寸变化（加载中→加载完成、分页翻页），自动重新同步高度（REV-007）
function startMobilePanelHeightSync() {
    stopMobilePanelHeightSync();
    const res = document.querySelector('.player-sidebar-body .resource-module');
    if (!res) return;
    syncMobilePanelHeight();
    if (window.ResizeObserver) {
        mobilePanelHeightObserver = new ResizeObserver(syncMobilePanelHeight);
        mobilePanelHeightObserver.observe(res);
    }
}

function stopMobilePanelHeightSync() {
    if (mobilePanelHeightObserver) {
        mobilePanelHeightObserver.disconnect();
        mobilePanelHeightObserver = null;
    }
}

// ========== 移动端选集列表（就地展开） ==========
// 说明：原"移动端集数选择弹框"（#episodeModal / openEpisodeModal / renderEpisodesToModal 等）
// 已被就地展开方式取代，弹框链路于 REV-006 清理移除（2026-08-08）。


// ========== 其他辅助函数 ==========