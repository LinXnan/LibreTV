/**
 * 滑动操作管理器
 * 职责：处理自定义 API 卡片的滑动删除手势
 */

const SwipeActions = {
    config: {
        activationThreshold: 24,
        directionLockRatio: 2,
        deleteDistanceRatio: 0.4,
        deleteVelocity: 0.6,
        actionWidth: 72,
        animationDuration: 180,
        snapBackDuration: 120,
        disabledZoneTop: 60
    },

    state: {
        activeCard: null,
        startX: 0,
        startY: 0,
        startTime: 0,
        currentX: 0,
        isLocked: false,
        direction: null,
        initialized: false
    },

    init(container) {
        if (!container) return;
        if (this.state.initialized && this.container === container) return;

        this.destroy();

        const supportsPointerEvents = 'PointerEvent' in window;
        const eventTypes = supportsPointerEvents
            ? { start: 'pointerdown', move: 'pointermove', end: 'pointerup', cancel: 'pointercancel' }
            : { start: 'touchstart', move: 'touchmove', end: 'touchend', cancel: 'touchcancel' };

        this.eventTypes = eventTypes;
        this.container = container;

        this.boundHandleStart = this.handleStart.bind(this);
        this.boundHandleMove = this.handleMove.bind(this);
        this.boundHandleEnd = this.handleEnd.bind(this);

        container.addEventListener(eventTypes.start, this.boundHandleStart, { passive: false });
        document.addEventListener(eventTypes.move, this.boundHandleMove, { passive: false });
        document.addEventListener(eventTypes.end, this.boundHandleEnd);
        document.addEventListener(eventTypes.cancel, this.boundHandleEnd);

        this.state.initialized = true;
    },

    handleStart(e) {
        const swipeContainer = e.target.closest('.swipe-container');
        if (!swipeContainer) return;

        const panelRect = document.getElementById('settingsPanel')?.getBoundingClientRect();
        if (panelRect) {
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            const relativeY = clientY - panelRect.top;
            if (relativeY <= this.config.disabledZoneTop) return;
        }

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        this.state.startX = clientX;
        this.state.startY = clientY;
        this.state.startTime = Date.now();
        this.state.currentX = clientX;
        this.state.isLocked = false;
        this.state.direction = null;
        this.state.activeCard = swipeContainer;

        const content = swipeContainer.querySelector('.swipe-content');
        if (content) {
            content.classList.add('swiping');
        }
    },

    handleMove(e) {
        if (!this.state.activeCard) return;

        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel && settingsPanel.classList.contains('dragging')) {
            this.closeCard(this.state.activeCard);
            this.state.activeCard = null;
            return;
        }

        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const dx = clientX - this.state.startX;
        const dy = clientY - this.state.startY;

        if (!this.state.isLocked && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            if (Math.abs(dx) >= this.config.directionLockRatio * Math.abs(dy)) {
                this.state.direction = 'horizontal';
                this.state.isLocked = true;
            } else {
                this.state.direction = 'vertical';
                this.state.isLocked = true;
            }
        }

        if (this.state.direction === 'horizontal') {
            e.preventDefault();
            e.stopPropagation();

            this.state.currentX = clientX;
            const distance = Math.min(0, dx);
            const content = this.state.activeCard.querySelector('.swipe-content');
            if (content) {
                content.style.transform = `translateX(${distance}px)`;
            }
        } else if (this.state.direction === 'vertical') {
            this.closeCard(this.state.activeCard);
            this.state.activeCard = null;
        }
    },

    handleEnd(e) {
        if (!this.state.activeCard) return;

        const content = this.state.activeCard.querySelector('.swipe-content');
        if (!content) {
            this.state.activeCard = null;
            return;
        }

        content.classList.remove('swiping');

        if (this.state.direction !== 'horizontal') {
            this.state.activeCard = null;
            return;
        }

        const dx = this.state.currentX - this.state.startX;
        const dt = Date.now() - this.state.startTime;
        const velocity = Math.abs(dx) / dt;
        const cardWidth = this.state.activeCard.offsetWidth;

        const shouldOpen = Math.abs(dx) > cardWidth * this.config.deleteDistanceRatio ||
                          velocity > this.config.deleteVelocity;

        if (shouldOpen && dx < 0) {
            this.openCard(this.state.activeCard);
        } else {
            this.closeCard(this.state.activeCard);
        }

        this.state.activeCard = null;
    },

    openCard(card) {
        this.closeAllCards();

        const content = card.querySelector('.swipe-content');
        if (content) {
            content.classList.add('snap-back');
            content.style.transform = `translateX(-${this.config.actionWidth}px)`;
            card.classList.add('open');

            setTimeout(() => {
                content.classList.remove('snap-back');
            }, this.config.snapBackDuration);
        }
    },

    closeCard(card) {
        if (!card) return;

        const content = card.querySelector('.swipe-content');
        if (content) {
            content.classList.add('snap-back');
            content.style.transform = 'translateX(0)';
            card.classList.remove('open');

            setTimeout(() => {
                content.classList.remove('snap-back');
            }, this.config.snapBackDuration);
        }
    },

    closeAllCards() {
        if (!this.container) return;

        const openCards = this.container.querySelectorAll('.swipe-container.open');
        openCards.forEach(card => this.closeCard(card));
    },

    destroy() {
        if (!this.state.initialized || !this.container || !this.eventTypes) return;

        this.container.removeEventListener(this.eventTypes.start, this.boundHandleStart);
        document.removeEventListener(this.eventTypes.move, this.boundHandleMove);
        document.removeEventListener(this.eventTypes.end, this.boundHandleEnd);
        document.removeEventListener(this.eventTypes.cancel, this.boundHandleEnd);

        this.container = null;
        this.state.activeCard = null;
        this.state.initialized = false;
        this.boundHandleStart = null;
        this.boundHandleMove = null;
        this.boundHandleEnd = null;
    }
};
