/**
 * 移动端弹框管理模块
 * 实现底部抽屉式面板的打开/关闭、焦点管理等功能
 */

// 焦点管理（使用 WeakMap）
const focusMap = new WeakMap();

// body overflow 原始值
let originalBodyOverflow = '';

// 初始化标志
let isInitialized = false;

/**
 * 初始化面板支持
 */
function initMobilePanelGestures() {
    if (window.innerWidth > 640) return;
    if (isInitialized) return; // 防止重复初始化

    const overlay = document.getElementById('panelOverlay');

    // 设置遮罩层点击事件
    if (overlay) {
        overlay.addEventListener('click', handleOverlayClick);
    }

    setupBackButtonSupport();
    isInitialized = true;
}

/**
 * 关闭面板
 */
function closePanel(panel) {
    if (!panel) return;

    // 获取统一的遮罩层
    const overlay = document.getElementById('panelOverlay');

    if (!overlay) return;

    panel.classList.remove('show');
    overlay.classList.remove('show');
    panel.style.transform = '';
    overlay.style.opacity = '';
    panel.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');

    const triggerElement = focusMap.get(panel);
    if (triggerElement && typeof triggerElement.focus === 'function') {
        triggerElement.focus({ preventScroll: true });
    }

    if (originalBodyOverflow) {
        document.body.style.overflow = originalBodyOverflow;
    } else {
        document.body.style.removeProperty('overflow');
    }

    const liveRegion = document.getElementById('panelLiveRegion');
    if (liveRegion) {
        const panelTitle = panel.querySelector('h3, h2')?.textContent || '面板';
        liveRegion.textContent = `${panelTitle}已关闭`;
    }
}

/**
 * 遮罩点击处理
 */
function handleOverlayClick(e) {
    const historyPanel = document.getElementById('historyPanel');
    const settingsPanel = document.getElementById('settingsPanel');

    if (historyPanel && historyPanel.classList.contains('show')) {
        closePanel(historyPanel);
    }

    if (settingsPanel && settingsPanel.classList.contains('show')) {
        closePanel(settingsPanel);
    }
}

/**
 * 返回键支持
 */
function setupBackButtonSupport() {
    window.addEventListener('popstate', function(e) {
        if (e.state?.mobilePanel === true) {
            const panelId = e.state.panelId;
            let panel;

            if (panelId === 'history') {
                panel = document.getElementById('historyPanel');
            } else if (panelId === 'settings') {
                panel = document.getElementById('settingsPanel');
            }

            if (panel && panel.classList.contains('show')) {
                closePanel(panel);
            }
        }
    });
}

/**
 * 打开面板
 */
function openPanel(panel, triggerElement) {
    if (!panel) return;

    // 获取统一的遮罩层
    const overlay = document.getElementById('panelOverlay');

    if (!overlay) return;

    const historyPanel = document.getElementById('historyPanel');
    const settingsPanel = document.getElementById('settingsPanel');

    if (historyPanel && historyPanel !== panel && historyPanel.classList.contains('show')) {
        closePanel(historyPanel);
    }
    if (settingsPanel && settingsPanel !== panel && settingsPanel.classList.contains('show')) {
        closePanel(settingsPanel);
    }

    if (triggerElement) {
        focusMap.set(panel, triggerElement);
    }

    originalBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    panel.classList.add('show');
    overlay.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');

    const closeButton = panel.querySelector('[aria-label="关闭面板"]') || panel.querySelector('.close-btn');
    if (closeButton) {
        closeButton.focus({ preventScroll: true });
    }

    const liveRegion = document.getElementById('panelLiveRegion');
    if (liveRegion) {
        const panelTitle = panel.querySelector('h3, h2')?.textContent || '面板';
        liveRegion.textContent = `${panelTitle}已打开`;
    }

    const panelType = panel.id === 'historyPanel' ? 'history' : (panel.id === 'settingsPanel' ? 'settings' : 'episode');
    history.pushState({ mobilePanel: true, panelId: panelType }, null, location.href);
}

document.addEventListener('DOMContentLoaded', initMobilePanelGestures);

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        initMobilePanelGestures();
    }, 250);
});

window.openPanel = openPanel;
window.closePanel = closePanel;
