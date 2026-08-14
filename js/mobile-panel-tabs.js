/**
 * 移动端播放页 Tab 切换模块（选集 / 视频源）
 *
 * 职责：移动端（≤640px）默认直接展示 Tab 栏，控制两个面板的互斥显隐。
 * - 只负责类切换，不触碰两个面板的内部渲染逻辑（选集分页 / 资源加载 / 切源）
 * - 资源列表由 player.js 的 loadVideo（含密码门禁后 passwordVerified 路径）无条件启动
 *   loadResourceSwitchList()；该函数是异步 fire-and-forget，加载完成前 resourcePageCtx
 *   保持 null。因此本模块绝不主动调用它——任何"兜底调用"都会与首次请求并发，导致
 *   互相覆盖与分页归零（B-1 修复）
 * - 桌面端（≥641px）Tab 栏由 CSS 隐藏，本模块仅在断点切换时清理状态类
 */
(function () {
    'use strict';

    let initialized = false;
    let activeTab = null; // 'episodes' | 'resources' | null（桌面端/未激活）

    // 面板元素引用
    function getEpisodesPanel() {
        return document.getElementById('episodesGridContainer');
    }

    function getResourceModule() {
        return document.querySelector('.player-sidebar-body .resource-module');
    }

    /**
     * 切换激活 Tab。
     * @param {string} tabKey 'episodes' | 'resources'
     */
    function activate(tabKey) {
        const episodesPanel = getEpisodesPanel();
        const resourceModule = getResourceModule();
        if (!episodesPanel || !resourceModule) return;

        const isEpisodes = tabKey === 'episodes';
        episodesPanel.classList.toggle('is-tab-active', isEpisodes);
        resourceModule.classList.toggle('is-tab-active', !isEpisodes);

        const tabEpisodes = document.getElementById('mobileTabEpisodes');
        const tabResources = document.getElementById('mobileTabResources');
        if (tabEpisodes) tabEpisodes.classList.toggle('is-tab-active', isEpisodes);
        if (tabResources) tabResources.classList.toggle('is-tab-active', !isEpisodes);

        activeTab = tabKey;
    }

    /**
     * 进入桌面断点（≥641px）时清理两个面板的 is-tab-active。
     * 不动 Tab 按钮的激活类——按钮在桌面端由 CSS 隐藏，无需清理。
     */
    function cleanup() {
        const episodesPanel = getEpisodesPanel();
        const resourceModule = getResourceModule();
        if (episodesPanel) episodesPanel.classList.remove('is-tab-active');
        if (resourceModule) resourceModule.classList.remove('is-tab-active');
        activeTab = null;
    }

    function getActiveTab() {
        return activeTab;
    }

    function init() {
        if (initialized) return;
        initialized = true;

        const tabEpisodes = document.getElementById('mobileTabEpisodes');
        const tabResources = document.getElementById('mobileTabResources');
        if (tabEpisodes) tabEpisodes.addEventListener('click', function () { activate('episodes'); });
        if (tabResources) tabResources.addEventListener('click', function () { activate('resources'); });

        // 初始状态：移动端默认"选集"（HTML 已静态预置 is-tab-active，此处核对同步）；
        // 桌面端清理静态预置类，避免跨断点残留。
        if (window.matchMedia('(max-width: 640px)').matches) {
            activate('episodes');
        } else {
            cleanup();
        }

        // 断点切换：进入移动端恢复默认选集；进入桌面端清理面板激活类（继承 REV-004 语义）
        if (window.matchMedia) {
            window.matchMedia('(max-width: 640px)').addEventListener('change', function (e) {
                if (e.matches) activate('episodes');
            });
            window.matchMedia('(min-width: 641px)').addEventListener('change', function (e) {
                if (e.matches) cleanup();
            });
        }
    }

    window.MobilePanelTabs = {
        init: init,
        activate: activate,
        getActiveTab: getActiveTab,
        cleanup: cleanup
    };

    document.addEventListener('DOMContentLoaded', init);
})();
