/**
 * 移动端弹框手势处理模块
 * 实现底部抽屉式面板的触摸手势、拖拽、焦点管理等功能
 */

// 手势状态管理
const gestureState = {
    isDragging: false,
    startY: 0,
    currentY: 0,
    startTime: 0,
    startX: 0,
    currentPanel: null,
    panelHeight: 0,
    lastMoveY: 0,
    lastMoveTime: 0,
    prevMoveY: 0,
    prevMoveTime: 0
};

// 焦点管理（使用 WeakMap）
const focusMap = new WeakMap();

// body overflow 原始值
let originalBodyOverflow = '';

// 配置常量
const GESTURE_CONFIG = {
    closeThreshold: 100,
    velocityThreshold: 0.5,
    dampingFactor: 0.3,
    dragHandleHeight: 60,
    horizontalThreshold: 10
};

/**
 * 初始化手势支持
 */
function initMobilePanelGestures() {
    if (window.innerWidth > 640) return;

    const historyPanel = document.getElementById('historyPanel');
    const settingsPanel = document.getElementById('settingsPanel');
    const overlay = document.getElementById('panelOverlay');

    if (!historyPanel || !settingsPanel || !overlay) {
        return;
    }

    setupPanelGestures(historyPanel);
    setupPanelGestures(settingsPanel);
    overlay.addEventListener('click', handleOverlayClick);
    setupBackButtonSupport();
}

/**
 * 设置面板手势
 */
function setupPanelGestures(panel) {
    panel.addEventListener('touchstart', handleTouchStart, { passive: false });
    panel.addEventListener('touchmove', handleTouchMove, { passive: false });
    panel.addEventListener('touchend', handleTouchEnd, { passive: false });
}

/**
 * 触摸开始
 */
function handleTouchStart(e) {
    if (e.touches.length !== 1) return;

    const panel = e.currentTarget;
    const touch = e.touches[0];
    const rect = panel.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;

    if (relativeY >= GESTURE_CONFIG.dragHandleHeight) return;

    const now = Date.now();
    gestureState.isDragging = true;
    gestureState.startY = touch.clientY;
    gestureState.startX = touch.clientX;
    gestureState.currentY = touch.clientY;
    gestureState.startTime = now;
    gestureState.lastMoveY = touch.clientY;
    gestureState.lastMoveTime = now;
    gestureState.prevMoveY = touch.clientY;
    gestureState.prevMoveTime = now;
    gestureState.currentPanel = panel;
    gestureState.panelHeight = panel.getBoundingClientRect().height;

    panel.classList.add('dragging');
}

/**
 * 触摸移动
 */
function handleTouchMove(e) {
    if (!gestureState.isDragging) return;
    if (e.touches.length !== 1) {
        gestureState.isDragging = false;
        return;
    }

    const touch = e.touches[0];
    const panel = gestureState.currentPanel;
    const deltaY = touch.clientY - gestureState.startY;
    const deltaX = touch.clientX - gestureState.startX;

    if (Math.abs(deltaX) > GESTURE_CONFIG.horizontalThreshold) {
        gestureState.isDragging = false;
        panel.classList.remove('dragging');
        return;
    }

    if (deltaY < 0) return;

    e.preventDefault();

    const panelHeight = gestureState.panelHeight;
    let translateY;
    if (deltaY <= panelHeight) {
        translateY = deltaY;
    } else {
        translateY = panelHeight + (deltaY - panelHeight) * GESTURE_CONFIG.dampingFactor;
    }

    panel.style.transform = `translateY(${translateY}px)`;

    const overlay = document.getElementById('panelOverlay');
    if (overlay) {
        const progress = Math.min(1, deltaY / panelHeight);
        overlay.style.opacity = 0.5 * (1 - progress);
    }

    // 记录瞬时速度计算所需的数据（保存上一帧数据）
    const now = Date.now();
    gestureState.prevMoveY = gestureState.lastMoveY;
    gestureState.prevMoveTime = gestureState.lastMoveTime;
    gestureState.lastMoveY = touch.clientY;
    gestureState.lastMoveTime = now;
    gestureState.currentY = touch.clientY;
}

/**
 * 触摸结束
 */
function handleTouchEnd(e) {
    if (!gestureState.isDragging) return;

    const panel = gestureState.currentPanel;
    const deltaY = gestureState.currentY - gestureState.startY;

    // 计算瞬时速度（使用最后两帧之间的数据）
    const timeDiff = gestureState.lastMoveTime - gestureState.prevMoveTime;
    const moveDiff = gestureState.lastMoveY - gestureState.prevMoveY;

    // 仅向下方向的速度计入
    const velocity = (moveDiff > 0 && timeDiff > 0) ? moveDiff / timeDiff : 0;

    const shouldClose = deltaY > GESTURE_CONFIG.closeThreshold || velocity > GESTURE_CONFIG.velocityThreshold;

    if (shouldClose) {
        closePanel(panel);
    } else {
        panel.style.transform = '';
        const overlay = document.getElementById('panelOverlay');
        if (overlay) {
            overlay.style.opacity = '';
        }
    }

    panel.classList.remove('dragging');
    gestureState.isDragging = false;
    gestureState.currentPanel = null;
}

/**
 * 关闭面板
 */
function closePanel(panel) {
    if (!panel) return;

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
        triggerElement.focus();
    }

    if (originalBodyOverflow) {
        document.body.style.overflow = originalBodyOverflow;
    } else {
        document.body.style.removeProperty('overflow');
    }

    const liveRegion = document.getElementById('panelLiveRegion');
    if (liveRegion) {
        const panelTitle = panel.querySelector('h3')?.textContent || '面板';
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
            const panel = panelId === 'history'
                ? document.getElementById('historyPanel')
                : document.getElementById('settingsPanel');

            if (panel && panel.classList.contains('show')) {
                closePanel(panel);
            }
        }
    });
}

/**
 * 打开面板（增强版）
 */
function openPanel(panel, triggerElement) {
    if (!panel) return;

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
        closeButton.focus();
    }

    const liveRegion = document.getElementById('panelLiveRegion');
    if (liveRegion) {
        const panelTitle = panel.querySelector('h3')?.textContent || '面板';
        liveRegion.textContent = `${panelTitle}已打开`;
    }

    const panelId = panel.id === 'historyPanel' ? 'history' : 'settings';
    history.pushState({ mobilePanel: true, panelId: panelId }, null, location.href);
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
