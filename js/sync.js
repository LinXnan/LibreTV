/**
 * 数据同步管理器
 * 使用 Cloudflare KV 实现跨设备数据同步
 */

class SyncManager {
    constructor() {
        this.syncCode = localStorage.getItem('syncCode') || null;
        // 使用完整 URL，绕过前端 api.js 拦截
        this.apiBase = window.location.origin + '/api/sync';
    }

    // 生成唯一同步码
    generateSyncCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segments = [4, 4, 4];
        return segments.map(len => {
            let segment = '';
            for (let i = 0; i < len; i++) {
                segment += chars[Math.floor(Math.random() * chars.length)];
            }
            return segment;
        }).join('-');
    }

    // 检查同步码是否已存在
    async checkSyncCodeExists(syncCode) {
        try {
            const response = await fetch(`${this.apiBase}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ syncCode })
            });
            const data = await response.json();
            return data.exists;
        } catch (error) {
            console.error('检查同步码失败:', error);
            return false;
        }
    }

    // 获取同步数据
    async getSyncData(syncCode) {
        try {
            const response = await fetch(`${this.apiBase}/data?syncCode=${encodeURIComponent(syncCode)}`);
            if (!response.ok) {
                throw new Error('获取数据失败');
            }
            return await response.json();
        } catch (error) {
            console.error('获取同步数据失败:', error);
            throw error;
        }
    }

    // 保存同步数据
    async saveSyncData(syncCode, data) {
        try {
            const response = await fetch(`${this.apiBase}/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ syncCode, data })
            });
            if (!response.ok) {
                throw new Error('保存数据失败');
            }
            return await response.json();
        } catch (error) {
            console.error('保存同步数据失败:', error);
            throw error;
        }
    }

    // 收集所有需要同步的数据
    collectAllData() {
        return {
            selectedAPIs: JSON.parse(localStorage.getItem('selectedAPIs') || '[]'),
            customAPIs: JSON.parse(localStorage.getItem('customAPIs') || '[]'),
            yellowFilterEnabled: localStorage.getItem('yellowFilterEnabled'),
            adFilterEnabled: localStorage.getItem('adFilterEnabled'),
            doubanEnabled: localStorage.getItem('doubanEnabled'),
            searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
            viewingHistory: JSON.parse(localStorage.getItem('viewingHistory') || '[]'),
            timestamp: Date.now()
        };
    }

    // 应用同步数据到本地
    applyDataToLocal(data) {
        if (data.selectedAPIs) localStorage.setItem('selectedAPIs', JSON.stringify(data.selectedAPIs));
        if (data.customAPIs) localStorage.setItem('customAPIs', JSON.stringify(data.customAPIs));
        if (data.yellowFilterEnabled) localStorage.setItem('yellowFilterEnabled', data.yellowFilterEnabled);
        if (data.adFilterEnabled) localStorage.setItem('adFilterEnabled', data.adFilterEnabled);
        if (data.doubanEnabled) localStorage.setItem('doubanEnabled', data.doubanEnabled);
        if (data.searchHistory) localStorage.setItem('searchHistory', JSON.stringify(data.searchHistory));
        if (data.viewingHistory) localStorage.setItem('viewingHistory', JSON.stringify(data.viewingHistory));
    }

    // 上传本地数据到服务器
    async uploadData() {
        if (!this.syncCode) {
            throw new Error('未设置同步码');
        }
        const data = this.collectAllData();
        await this.saveSyncData(this.syncCode, data);
    }

    // 从服务器下载数据
    async downloadData(syncCode) {
        const data = await this.getSyncData(syncCode);
        this.applyDataToLocal(data);
        this.syncCode = syncCode;
        localStorage.setItem('syncCode', syncCode);
    }

    // 设置同步码
    async setSyncCode(syncCode, isCustom = false) {
        if (isCustom) {
            const exists = await this.checkSyncCodeExists(syncCode);
            if (exists) {
                throw new Error('该同步码已被使用，请更换');
            }
        }
        this.syncCode = syncCode;
        localStorage.setItem('syncCode', syncCode);
        await this.uploadData();
    }
}

// 创建全局实例
window.syncManager = new SyncManager();

// 首次打开检查同步码
(function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkSyncCodeOnLoad);
    } else {
        checkSyncCodeOnLoad();
    }

    function checkSyncCodeOnLoad() {
        setTimeout(() => {
            if (!window.syncManager.syncCode) {
                showSyncCodeModal();
            }
        }, 1000);
    }
})();

// 显示同步码设置弹窗
function showSyncCodeModal() {
    const modal = document.createElement('div');
    modal.id = 'syncCodeModal';
    modal.className = 'fixed inset-0 bg-black/95 flex items-center justify-center z-[70]';
    modal.innerHTML = `
        <div class="bg-[#111] p-8 rounded-lg w-11/12 max-w-md border border-[#333]">
            <h2 class="text-2xl font-bold gradient-text mb-4">设置同步码</h2>
            <p class="text-gray-300 mb-4">同步码用于在不同设备间同步您的数据</p>
            <div class="mb-4">
                <label class="block text-sm text-gray-400 mb-2">同步码</label>
                <input type="text" id="syncCodeInput" class="w-full bg-[#222] border border-[#333] text-white px-4 py-2 rounded" readonly>
            </div>
            <div class="flex items-center mb-4">
                <input type="checkbox" id="customSyncCode" class="mr-2">
                <label for="customSyncCode" class="text-sm text-gray-400">自定义同步码</label>
            </div>
            <div class="flex space-x-2">
                <button onclick="generateNewSyncCode()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">生成新码</button>
                <button onclick="confirmSyncCode()" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">确认</button>
            </div>
            <p id="syncCodeError" class="text-red-500 text-sm mt-2 hidden"></p>
        </div>
    `;
    document.body.appendChild(modal);

    // 生成初始同步码
    generateNewSyncCode();

    // 监听自定义同步码选项
    document.getElementById('customSyncCode').addEventListener('change', (e) => {
        const input = document.getElementById('syncCodeInput');
        input.readOnly = !e.target.checked;
        if (e.target.checked) {
            input.value = '';
            input.focus();
        } else {
            generateNewSyncCode();
        }
    });
}

// 生成新同步码
function generateNewSyncCode() {
    const syncCode = window.syncManager.generateSyncCode();
    document.getElementById('syncCodeInput').value = syncCode;
}

// 确认同步码
async function confirmSyncCode() {
    const syncCode = document.getElementById('syncCodeInput').value.trim();
    const isCustom = document.getElementById('customSyncCode').checked;
    const errorEl = document.getElementById('syncCodeError');

    if (!syncCode || syncCode.length < 4) {
        errorEl.textContent = '同步码格式错误';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        await window.syncManager.setSyncCode(syncCode, isCustom);
        document.getElementById('syncCodeModal').remove();
        showToast && showToast('同步码设置成功', 'success');
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

// 导入数据（输入同步码）
async function importSyncData() {
    const syncCode = prompt('请输入同步码：');
    if (!syncCode) return;

    try {
        showLoading && showLoading();
        await window.syncManager.downloadData(syncCode);
        hideLoading && hideLoading();
        showToast && showToast('数据导入成功，请刷新页面', 'success');
        setTimeout(() => location.reload(), 1500);
    } catch (error) {
        hideLoading && hideLoading();
        showToast && showToast('导入失败：' + error.message, 'error');
    }
}

// 导出数据（显示同步码）
function exportSyncData() {
    const syncCode = window.syncManager.syncCode;
    if (!syncCode) {
        showToast && showToast('未设置同步码', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/95 flex items-center justify-center z-[70]';
    modal.innerHTML = `
        <div class="bg-[#111] p-8 rounded-lg w-11/12 max-w-md border border-[#333]">
            <h2 class="text-2xl font-bold gradient-text mb-4">您的同步码</h2>
            <p class="text-gray-300 mb-4">在其他设备输入此同步码即可同步数据</p>
            <div class="bg-[#222] p-4 rounded mb-4 text-center">
                <p class="text-2xl font-mono text-white">${syncCode}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">关闭</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// 变化检测自动同步
(function() {
    let syncTimeout;
    let lastDataSnapshot = null;

    // 防抖同步函数（3秒内无变化才同步）
    function debouncedSync() {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            if (window.syncManager.syncCode) {
                const currentData = JSON.stringify(window.syncManager.collectAllData());
                if (lastDataSnapshot !== currentData) {
                    lastDataSnapshot = currentData;
                    window.syncManager.uploadData().catch(err => {
                        console.error('自动同步失败:', err);
                    });
                }
            }
        }, 3000);
    }

    // 监听 localStorage 变化
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        debouncedSync();
    };

    // 初始化快照
    if (window.syncManager.syncCode) {
        lastDataSnapshot = JSON.stringify(window.syncManager.collectAllData());
    }
})();
