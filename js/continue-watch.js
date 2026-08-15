// 继续观看弹窗：访问首页时弹出最近一次播放的影片，询问是否继续观看
// 读取 localStorage.viewingHistory（最新在前）取第一条；
// 设置开关 continueWatchPromptEnabled 控制是否弹窗（默认开启，见 app.js 开关初始化）。
// 与免责声明弹窗排队：首次访问先接受声明，再弹继续观看；密码未验证时不叠加弹窗。
(function() {
    'use strict';

    const STORAGE_KEY = 'continueWatchPromptEnabled';
    const HISTORY_KEY = 'viewingHistory';

    let latestItem = null;
    let waitingForDisclaimer = false;
    let userDismissed = false; // 用户主动关闭过弹窗（暂不/遮罩/Esc/关闭），本会话不再自动弹出（刷新后重置）

    // 封面代理 URL，与 ui.js / recent-watch.js 同一逻辑
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

    // 播放进度格式化（秒 → m:ss），进度太短不展示
    function formatPosition(seconds) {
        if (!seconds || seconds <= 10) return '';
        const total = Math.floor(seconds);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `已播放 ${m}:${String(s).padStart(2, '0')}`;
    }

    // 取最近一条观看历史（title/url 均有效才视为可继续观看）
    function getLatestHistoryItem() {
        try {
            const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            const list = Array.isArray(parsed) ? parsed : [];
            return list.find(item => item && typeof item === 'object' && item.title && item.url) || null;
        } catch (e) {
            return null;
        }
    }

    function isEnabled() {
        return localStorage.getItem(STORAGE_KEY) !== 'false'; // 默认开启
    }

    // 与 passwordModal 一致：移除 hidden 类再加 flex 类显示
    // （index.html 内联 .hidden 带 !important，style.display 会被其覆盖）
    function closeModal() {
        const modal = document.getElementById('continueWatchModal');
        if (!modal) return;
        // 任何路径关闭都视为用户主动放弃：清 latestItem + 置 userDismissed，
        // 防止 passwordVerified 重放时弹窗复现（CW-1）
        latestItem = null;
        userDismissed = true;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function openModal() {
        const modal = document.getElementById('continueWatchModal');
        if (!modal || !latestItem) return;

        const title = document.getElementById('continueWatchTitle');
        if (title) title.textContent = latestItem.title || '未知视频';

        // 集数 + 播放进度（episodeIndex 归一化为数字，防历史数据被写成字符串导致 "2"+1 拼接）
        const metaParts = [];
        const epIndex = Number(latestItem.episodeIndex);
        if (Number.isFinite(epIndex) && epIndex >= 0) {
            metaParts.push(`第${epIndex + 1}集`);
        }
        const position = formatPosition(latestItem.playbackPosition);
        if (position) metaParts.push(position);
        const meta = document.getElementById('continueWatchMeta');
        if (meta) meta.textContent = metaParts.join(' · ');

        // 封面：底层渐变占位（标题色相渐变 + 内容类型图标）+ img 覆盖。
        // img 用 data-src + lazy-load，由 optimize-apply.js 的 MutationObserver
        // 交给 LazyImageLoader 接管：自动补 /proxy/ 鉴权参数（auth + t）、缓存、
        // 加载失败降级（隐藏 img 露出占位）——与历史面板/最近观看完全同一路径。
        // 若直接 img src= 请求 /proxy/xxx，不带 auth 参数会被代理拒绝（403）导致封面不显示。
        const cover = document.getElementById('continueWatchCover');
        if (cover) {
            const rawTitle = latestItem.title || '未知视频';
            const gradientBg = window.generateGradientFromString
                ? generateGradientFromString(rawTitle)
                : 'linear-gradient(135deg, #333, #222)';
            const contentIcon = window.getContentTypeIcon
                ? getContentTypeIcon(rawTitle)
                : '📺';
            const coverUrl = buildCoverUrl(latestItem.vod_pic);
            const safeCoverUrl = escapeHtml(coverUrl);
            const safeTitle = escapeHtml(rawTitle);
            const coverImg = coverUrl
                ? `<img class="lazy-load recent-watch-cover-img" data-src="${safeCoverUrl}" alt="${safeTitle}" referrerpolicy="no-referrer">`
                : '';
            cover.innerHTML = `
                <div class="recent-watch-placeholder" style="background:${gradientBg};">
                    <span class="recent-watch-icon">${contentIcon}</span>
                </div>
                ${coverImg}
            `;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    // 显示弹窗（含前置条件检查）
    function showIfNeeded() {
        // 播放页由 watch.html 处理，不弹
        if (window.location.pathname.startsWith('/watch')) return;
        if (!isEnabled()) return;
        // 用户本会话已主动关闭过弹窗，不再自动弹出（刷新页面后重置）
        if (userDismissed) return;
        // 部署未设置密码时（强制密码弹窗无关闭按钮，z-65 在最上层），不叠加继续观看弹窗避免锁死
        if (typeof isPasswordRequired === 'function' && isPasswordRequired()) return;
        // 密码未验证时不叠加弹窗；验证成功后由 passwordVerified 事件重试
        if (typeof requirePasswordOrPrompt === 'function' && !requirePasswordOrPrompt({ silent: true })) return;

        latestItem = getLatestHistoryItem();
        if (!latestItem) return;

        const disclaimerVisible = !localStorage.getItem('hasSeenDisclaimer');
        if (disclaimerVisible) {
            // 免责声明正在显示（首次访问）：等用户接受后再弹，避免两个弹窗叠加
            if (!waitingForDisclaimer) {
                waitingForDisclaimer = true;
                const acceptBtn = document.getElementById('acceptDisclaimerBtn');
                if (acceptBtn) {
                    acceptBtn.addEventListener('click', function once() {
                        waitingForDisclaimer = false;
                        openModal();
                    }, { once: true });
                } else {
                    waitingForDisclaimer = false;
                    openModal();
                }
            }
            return;
        }
        openModal();
    }

    function bindEvents() {
        const resumeBtn = document.getElementById('continueWatchResumeBtn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', function () {
                const item = latestItem;
                closeModal(); // 内部清理 latestItem 并置 userDismissed，防 passwordVerified 重放二次弹出
                if (item && typeof playFromHistory === 'function') {
                    // 与 openModal 显示口径一致：episodeIndex 归一化为数字（防字符串历史数据）
                    const epIndex = Number(item.episodeIndex);
                    const safeIndex = Number.isFinite(epIndex) && epIndex >= 0 ? epIndex : 0;
                    playFromHistory(item.url, item.title, safeIndex, item.playbackPosition || 0);
                }
            });
        }

        const laterBtn = document.getElementById('continueWatchLaterBtn');
        if (laterBtn) laterBtn.addEventListener('click', closeModal);

        const closeBtn = document.getElementById('continueWatchCloseBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        const modal = document.getElementById('continueWatchModal');
        if (modal) {
            // 点击遮罩关闭
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeModal();
            });
            // Esc 关闭
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
            });
        }

        // 密码验证通过后补弹（首次访问场景：密码 → 免责声明 → 继续观看）
        document.addEventListener('passwordVerified', showIfNeeded);
    }

    document.addEventListener('DOMContentLoaded', function () {
        bindEvents();
        showIfNeeded();
    });
})();
