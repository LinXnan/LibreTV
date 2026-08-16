/**
 * 播放页 Tab 切换模块（选集 / 视频源）
 *
 * 职责：全部断点（≤640 / 641-1023 / ≥1024）默认直接展示 Tab 栏，控制两个面板的互斥显隐。
 * - 只负责类切换，不触碰两个面板的内部渲染逻辑（选集分页 / 资源加载 / 切源）
 * - 资源列表由 player.js 的 loadVideo（含密码门禁后 passwordVerified 路径）无条件启动
 *   loadResourceSwitchList()；该函数是异步 fire-and-forget，加载完成前 resourcePageCtx
 *   保持 null。因此本模块绝不主动调用它——任何"兜底调用"都会与首次请求并发，导致
 *   互相覆盖与分页归零（B-1 修复）
 * - 三断点同行为，无需断点清理：is-tab-active 恒定，仅由 activate() 切换
 */
(function () {
    'use strict';

    let initialized = false;
    let activeTab = null; // 'episodes' | 'resources' | null（未初始化）

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

    function getActiveTab() {
        return activeTab;
    }

    /**
     * 三断点统一默认"选集"（HTML 已静态预置 is-tab-active，此处核对同步）。
     * 无断点监听/清理：三端同行为，is-tab-active 恒定，仅由 activate() 切换。
     */
    function init() {
        if (initialized) return;
        initialized = true;

        const tabEpisodes = document.getElementById('mobileTabEpisodes');
        const tabResources = document.getElementById('mobileTabResources');
        if (tabEpisodes) tabEpisodes.addEventListener('click', function () { activate('episodes'); });
        if (tabResources) tabResources.addEventListener('click', function () { activate('resources'); });

        activate('episodes');
    }

    window.MobilePanelTabs = {
        init: init,
        activate: activate,
        getActiveTab: getActiveTab
    };

    document.addEventListener('DOMContentLoaded', init);
})();
