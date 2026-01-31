/**
 * 撤销提示管理器
 * 职责：显示删除撤销提示，处理撤销操作
 */

const UndoToast = {
    config: {
        duration: 5000,
        animationDuration: 200
    },

    state: {
        timer: null,
        deletedItem: null,
        deletedIndex: null,
        wasSelected: false
    },

    show(item, index, wasSelected) {
        this.hide();

        this.state.deletedItem = item;
        this.state.deletedIndex = index;
        this.state.wasSelected = wasSelected;

        const toast = document.getElementById('undoToast');
        const message = document.getElementById('undoToastMessage');

        if (toast && message) {
            message.textContent = `已删除 "${item.name}"`;
            toast.classList.add('visible');

            this.state.timer = setTimeout(() => {
                this.hide();
            }, this.config.duration);
        }
    },

    hide() {
        if (this.state.timer) {
            clearTimeout(this.state.timer);
            this.state.timer = null;
        }

        const toast = document.getElementById('undoToast');
        if (toast) {
            toast.classList.remove('visible');
        }

        setTimeout(() => {
            this.state.deletedItem = null;
            this.state.deletedIndex = null;
            this.state.wasSelected = false;
        }, this.config.animationDuration);
    },

    undo() {
        if (!this.state.deletedItem) return;

        const normalizeAPI = window.normalizeCustomAPI || (api => api);

        if (typeof window.customAPIs !== 'undefined') {
            window.customAPIs.splice(this.state.deletedIndex, 0, normalizeAPI(this.state.deletedItem));
            localStorage.setItem('customAPIs', JSON.stringify(window.customAPIs));
        } else {
            const customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]').map(normalizeAPI);
            customAPIs.splice(this.state.deletedIndex, 0, normalizeAPI(this.state.deletedItem));
            localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
        }

        if (this.state.wasSelected) {
            if (typeof window.selectedAPIs !== 'undefined') {
                const customKey = `custom_${this.state.deletedIndex}`;

                window.selectedAPIs = window.selectedAPIs.map(api => {
                    if (api.startsWith('custom_')) {
                        const idx = parseInt(api.split('_')[1]);
                        if (idx >= this.state.deletedIndex) {
                            return `custom_${idx + 1}`;
                        }
                    }
                    return api;
                });

                window.selectedAPIs.push(customKey);
                localStorage.setItem('selectedAPIs', JSON.stringify(window.selectedAPIs));
            } else {
                const selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
                const customKey = `custom_${this.state.deletedIndex}`;

                const updatedSelected = selectedAPIs.map(api => {
                    if (api.startsWith('custom_')) {
                        const idx = parseInt(api.split('_')[1]);
                        if (idx >= this.state.deletedIndex) {
                            return `custom_${idx + 1}`;
                        }
                    }
                    return api;
                });

                updatedSelected.push(customKey);
                localStorage.setItem('selectedAPIs', JSON.stringify(updatedSelected));
            }
        }

        this.hide();

        if (typeof renderCustomAPIsList === 'function') {
            renderCustomAPIsList();
        }
        if (typeof updateSelectedAPIs === 'function') {
            updateSelectedAPIs();
        }
    },

    destroy() {
        this.hide();
    }
};
