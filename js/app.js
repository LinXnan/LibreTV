// 全局变量
let selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || JSON.stringify(Object.keys(API_SITES).filter(key => !DEFAULT_UNSELECTED_APIS.includes(key)))); // 默认全选（除失效/不可靠源）

// 规范化自定义 API 数据格式，支持 api/adult 和 url/isAdult 两种格式
function normalizeCustomAPI(api) {
    return {
        name: api.name || '',
        url: api.url || api.api || '',
        detail: api.detail || '',
        isAdult: api.isAdult ?? api.adult ?? false
    };
}

// 暴露为全局函数供其他模块使用
window.normalizeCustomAPI = normalizeCustomAPI;

// 加载并规范化自定义 API 列表
let customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]').map(normalizeCustomAPI);

// HTML 转义函数，防止 XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加当前播放的集数索引
let currentEpisodeIndex = 0;
// 添加当前视频的所有集数
let currentEpisodes = [];
// 添加当前视频的标题
let currentVideoTitle = '';
// 全局变量用于倒序状态
let episodesReversed = false;
let searchInProgress = false; // 防抖锁，防止重复搜索
const searchCache = new Map(); // 搜索结果缓存 { key: {results, timestamp} }

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    // 初始化API复选框
    initAPICheckboxes();

    // 初始化自定义API列表
    renderCustomAPIsList();

    // 初始化显示选中的API数量
    updateSelectedApiCount();

    // 设置默认API选择（如果是第一次加载）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        // 默认全选（排除 DEFAULT_UNSELECTED_APIS 中失效/不可靠的源）
        selectedAPIs = Object.keys(API_SITES).filter(key => !DEFAULT_UNSELECTED_APIS.includes(key));
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

        // 默认选中过滤开关
        localStorage.setItem('yellowFilterEnabled', 'true');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');

        // 默认关闭豆瓣功能
        localStorage.setItem('doubanEnabled', 'false');

        // 标记已初始化默认值
        localStorage.setItem('hasInitializedDefaults', 'true');
    }

    // 设置黄色内容过滤器开关初始状态
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.checked = localStorage.getItem('yellowFilterEnabled') === 'true';
    }

    // 设置广告过滤开关初始状态
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true
    }

    // 设置事件监听器
    setupEventListeners();

    // 初始检查成人API选中状态
    setTimeout(checkAdultAPIsSelected, 100);

    // 豆瓣模块懒加载 - 优化首屏加载速度
    lazyLoadDoubanModule();
});

// 普通资源分页状态
let apiPage = 1;

// 每页显示数量：PC 端 12 个，移动端 6 个
function getApiPageSize() {
    return window.innerWidth <= 640 ? 6 : 12;
}

function getNormalApiKeys() {
    return Object.keys(API_SITES).filter(apiKey => !API_SITES[apiKey].adult);
}

function getApiTotalPages() {
    return Math.max(1, Math.ceil(getNormalApiKeys().length / getApiPageSize()));
}

// 分页控件：上一页 / 页码信息 / 下一页
function buildPagination(totalPages) {
    const pag = document.createElement('div');
    pag.className = 'flex items-center justify-center space-x-3 my-2';

    const prev = document.createElement('button');
    prev.className = 'datasource-action-btn disabled:opacity-40';
    prev.textContent = '上一页';
    prev.disabled = apiPage <= 1;
    prev.addEventListener('click', (event) => {
        // 阻止冒泡：翻页同步重建 DOM 后 e.target 已脱离面板，document 的
        // "点击外部关闭面板"判断会误判为面板外点击，需在此截断冒泡
        event.stopPropagation();
        changeApiPage(-1);
    });

    const info = document.createElement('span');
    info.className = 'text-xs text-gray-400';
    info.textContent = `第 ${apiPage}/${totalPages} 页`;

    const next = document.createElement('button');
    next.className = 'datasource-action-btn disabled:opacity-40';
    next.textContent = '下一页';
    next.disabled = apiPage >= totalPages;
    next.addEventListener('click', (event) => {
        event.stopPropagation();
        changeApiPage(1);
    });

    pag.appendChild(prev);
    pag.appendChild(info);
    pag.appendChild(next);
    return pag;
}

// 翻页并重新渲染
function changeApiPage(delta) {
    const totalPages = getApiTotalPages();
    apiPage = Math.min(Math.max(1, apiPage + delta), totalPages);
    initAPICheckboxes();
    // 仅移动端滚动设置面板到 API 选择区域，PC 端保持原滚动位置避免面板跳动
    if (window.innerWidth <= 640) {
        const panel = document.getElementById('settingsPanel');
        const anchor = document.getElementById('apiCheckboxes');
        if (panel && anchor && typeof panel.scrollTo === 'function') {
            panel.scrollTo({ top: anchor.offsetTop - 24, behavior: 'smooth' });
        }
    }
}

// 初始化API复选框（普通资源分页渲染）
function initAPICheckboxes() {
    const container = document.getElementById('apiCheckboxes');
    container.innerHTML = '';

    // 添加普通API组标题
    const normaldiv = document.createElement('div');
    normaldiv.id = 'normaldiv';
    normaldiv.className = 'mobile-api-grid';
    const normalTitle = document.createElement('div');
    normalTitle.className = 'api-group-title';
    normalTitle.textContent = '普通资源';
    normaldiv.appendChild(normalTitle);

    // 按当前页切片渲染
    const totalPages = getApiTotalPages();
    if (apiPage > totalPages) apiPage = totalPages;
    const pageSize = getApiPageSize();
    const pageKeys = getNormalApiKeys().slice((apiPage - 1) * pageSize, apiPage * pageSize);

    // 创建普通API源的复选框 — 统一使用 mobile-api-item 结构，CSS 响应式处理布局
    pageKeys.forEach(apiKey => {
        const api = API_SITES[apiKey];
        const checked = selectedAPIs.includes(apiKey);
        const item = document.createElement('label');
        item.className = 'mobile-api-item';
        item.innerHTML = `
            <div class="mobile-api-content">
                <span class="mobile-api-name">${api.name}</span>
            </div>
            <input type="checkbox" id="api_${apiKey}"
                   class="mobile-api-checkbox"
                   ${checked ? 'checked' : ''}
                   data-api="${apiKey}">
        `;
        normaldiv.appendChild(item);

        item.querySelector('input').addEventListener('change', function () {
            updateSelectedAPIs();
            checkAdultAPIsSelected();
        });
    });

    // 补足空白占位项，保持每页面板高度一致（末页不足 pageSize 项时）
    // 复用 mobile-api-item 的 min-height 占位，visibility:hidden 保留布局且不暴露给辅助技术
    for (let i = pageKeys.length; i < pageSize; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'mobile-api-item';
        placeholder.style.visibility = 'hidden';
        normaldiv.appendChild(placeholder);
    }
    container.appendChild(normaldiv);

    // 分页控件（普通组下方）
    if (totalPages > 1) {
        container.appendChild(buildPagination(totalPages));
    }

    // 添加成人API列表
    addAdultAPI();

    // 初始检查成人内容状态
    checkAdultAPIsSelected();
}

// 添加成人API列表
function addAdultAPI() {
    // 仅在隐藏设置为false时添加成人API组
    if (!HIDE_BUILTIN_ADULT_APIS && (localStorage.getItem('yellowFilterEnabled') === 'false')) {
        const container = document.getElementById('apiCheckboxes');

        // 添加成人API组标题
        const adultdiv = document.createElement('div');
        adultdiv.id = 'adultdiv';
        adultdiv.className = 'mobile-api-grid';
        const adultTitle = document.createElement('div');
        adultTitle.className = 'api-group-title adult';
        adultTitle.innerHTML = `黄色资源采集站 <span class="adult-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </span>`;
        adultdiv.appendChild(adultTitle);

        // 创建成人API源的复选框 — 统一结构，CSS 响应式处理布局
        Object.keys(API_SITES).forEach(apiKey => {
            const api = API_SITES[apiKey];
            if (!api.adult) return;

            const checked = selectedAPIs.includes(apiKey);
            const item = document.createElement('label');
            item.className = 'mobile-api-item adult';
            item.innerHTML = `
                <div class="mobile-api-content">
                    <span class="mobile-api-name">${api.name}</span>
                    <span class="adult-badge">18+</span>
                </div>
                <input type="checkbox" id="api_${apiKey}"
                       class="mobile-api-checkbox api-adult"
                       ${checked ? 'checked' : ''}
                       data-api="${apiKey}">
            `;
            adultdiv.appendChild(item);

            item.querySelector('input').addEventListener('change', function () {
                updateSelectedAPIs();
                checkAdultAPIsSelected();
            });
        });
        container.appendChild(adultdiv);
    }
}

// 检查是否有成人API被选中
function checkAdultAPIsSelected() {
    // 查找所有内置成人API复选框
    const adultBuiltinCheckboxes = document.querySelectorAll('#apiCheckboxes .api-adult:checked');

    // 查找所有自定义成人API复选框
    const customApiCheckboxes = document.querySelectorAll('#customApisList .api-adult:checked');

    const hasAdultSelected = adultBuiltinCheckboxes.length > 0 || customApiCheckboxes.length > 0;

    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    const yellowFilterContainer = yellowFilterToggle.closest('div').parentNode;
    const filterDescription = yellowFilterContainer.querySelector('p.filter-description');

    // 如果选择了成人API，禁用黄色内容过滤器
    if (hasAdultSelected) {
        yellowFilterToggle.checked = false;
        yellowFilterToggle.disabled = true;
        localStorage.setItem('yellowFilterEnabled', 'false');

        // 添加禁用样式
        yellowFilterContainer.classList.add('filter-disabled');

        // 修改描述文字
        if (filterDescription) {
            filterDescription.innerHTML = '<strong class="text-pink-300">选中黄色资源站时无法启用此过滤</strong>';
        }

        // 移除提示信息（如果存在）
        const existingTooltip = yellowFilterContainer.querySelector('.filter-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    } else {
        // 启用黄色内容过滤器
        yellowFilterToggle.disabled = false;
        yellowFilterContainer.classList.remove('filter-disabled');

        // 恢复原来的描述文字
        if (filterDescription) {
            filterDescription.innerHTML = '过滤"伦理片"等黄色内容';
        }

        // 移除提示信息
        const existingTooltip = yellowFilterContainer.querySelector('.filter-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }
}

// 渲染自定义API列表
function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;

    if (customAPIs.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
        return;
    }

    container.innerHTML = '';

    customAPIs.forEach((api, index) => {
        const escapedName = escapeHtml(api.name || '');
        const escapedUrl = escapeHtml(api.url || '');

        // 统一使用 swipe 结构，桌面端 CSS 隐藏 swipe-actions
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'swipe-container mb-1';
        swipeContainer.innerHTML = `
            <div class="swipe-content">
                <label class="mobile-api-item ${api.isAdult ? 'adult' : ''}">
                    <input type="checkbox" id="custom_api_${index}"
                           class="mobile-api-checkbox ${api.isAdult ? 'api-adult' : ''}"
                           ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''}
                           data-custom-index="${index}">
                    <div class="mobile-api-content">
                        <div class="mobile-api-name">${escapedName}</div>
                        <div class="mobile-api-url">${escapedUrl}</div>
                        ${api.detail ? `<div class="text-[10px] text-gray-500 truncate">detail: ${escapeHtml(api.detail)}</div>` : ''}
                    </div>
                    ${api.isAdult ? '<span class="adult-badge">18+</span>' : ''}
                </label>
            </div>
            <div class="swipe-actions">
                <button class="edit-btn" onclick="editCustomApi(${index})" aria-label="编辑">✎</button>
                <button class="delete-btn" onclick="removeCustomApi(${index})" aria-label="删除">✕</button>
            </div>
        `;
        container.appendChild(swipeContainer);

        swipeContainer.querySelector('input').addEventListener('change', function () {
            updateSelectedAPIs();
            checkAdultAPIsSelected();
        });
    });
}

// 编辑自定义API
function editCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const api = customAPIs[index];
    document.getElementById('customApiName').value = api.name;
    document.getElementById('customApiUrl').value = api.url;
    document.getElementById('customApiDetail').value = api.detail || '';
    const isAdultInput = document.getElementById('customApiIsAdult');
    if (isAdultInput) isAdultInput.checked = api.isAdult || false;
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
        const buttonContainer = form.querySelector('div:last-child');
        buttonContainer.innerHTML = `
            <button onclick="updateCustomApi(${index})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">更新</button>
            <button onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
        `;
    }
}

// 读取并校验自定义 API 表单：name/url 非空 + http(s) 协议 + 去尾斜杠。
// 校验失败时弹 toast 并返回 null（调用方应立即 return）。
function readValidatedCustomApiInput() {
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const detailInput = document.getElementById('customApiDetail');
    const isAdultInput = document.getElementById('customApiIsAdult');
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!name || !url) {
        showToast('请输入API名称和链接', 'warning');
        return null;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('API链接格式不正确，需以http://或https://开头', 'warning');
        return null;
    }
    if (url.endsWith('/')) url = url.slice(0, -1);
    return {
        name,
        url,
        detail: detailInput ? detailInput.value.trim() : '',
        isAdult: isAdultInput ? isAdultInput.checked : false,
    };
}

// 清空自定义 API 表单（name/url/detail/isAdult）并隐藏表单容器。
// 不负责恢复添加按钮（restoreAddCustomApiButtons 由调用方按需调用）。
function resetCustomApiForm() {
    document.getElementById('customApiName').value = '';
    document.getElementById('customApiUrl').value = '';
    const detailInput = document.getElementById('customApiDetail');
    if (detailInput) detailInput.value = '';
    const isAdultInput = document.getElementById('customApiIsAdult');
    if (isAdultInput) isAdultInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
}

// 更新自定义API
function updateCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const input = readValidatedCustomApiInput();
    if (!input) return;
    const { name, url, detail, isAdult } = input;
    // 保存 detail 字段
    customAPIs[index] = { name, url, detail, isAdult };
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    renderCustomAPIsList();
    checkAdultAPIsSelected();
    restoreAddCustomApiButtons();
    resetCustomApiForm();
    showToast('已更新自定义API: ' + name, 'success');
}

// 取消编辑自定义API
function cancelEditCustomApi() {
    resetCustomApiForm();
    // 恢复添加按钮
    restoreAddCustomApiButtons();
}

// 恢复自定义API添加按钮
function restoreAddCustomApiButtons() {
    const form = document.getElementById('addCustomApiForm');
    const buttonContainer = form.querySelector('div:last-child');
    buttonContainer.innerHTML = `
        <button onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
        <button onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
    `;
}

// 更新选中的API列表
function updateSelectedAPIs() {
    // 获取所有内置API复选框
    const builtInApiCheckboxes = document.querySelectorAll('#apiCheckboxes input:checked');

    // 获取选中的内置API
    const builtInApis = Array.from(builtInApiCheckboxes).map(input => input.dataset.api);

    // 获取选中的自定义API
    const customApiCheckboxes = document.querySelectorAll('#customApisList input:checked');
    const customApiIndices = Array.from(customApiCheckboxes).map(input => 'custom_' + input.dataset.customIndex);

    // 合并内置和自定义API
    selectedAPIs = [...builtInApis, ...customApiIndices];

    // 保存到localStorage
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 更新显示选中的API数量
    updateSelectedApiCount();
}

// 更新选中的API数量显示
function updateSelectedApiCount() {
    const countEl = document.getElementById('selectedApiCount');
    if (countEl) {
        countEl.textContent = selectedAPIs.length;
    }
}

// 全选或取消全选API
function selectAllAPIs(selectAll = true, excludeAdult = false) {
    const checkboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        if (excludeAdult && checkbox.classList.contains('api-adult')) {
            checkbox.checked = false;
        } else {
            checkbox.checked = selectAll;
        }
    });

    updateSelectedAPIs();
    checkAdultAPIsSelected();
}

// 显示添加自定义API表单
function showAddCustomApiForm() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
    }
}

// 取消添加自定义API - 修改函数来重用恢复按钮逻辑
function cancelAddCustomApi() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        resetCustomApiForm();
        // 确保按钮是添加按钮
        restoreAddCustomApiButtons();
    }
}

// 添加自定义API
function addCustomApi() {
    const input = readValidatedCustomApiInput();
    if (!input) return;
    const { name, url, detail, isAdult } = input;
    // 保存 detail 字段
    customAPIs.push({ name, url, detail, isAdult });
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    const newApiIndex = customAPIs.length - 1;
    selectedAPIs.push('custom_' + newApiIndex);
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();
    updateSelectedApiCount();
    checkAdultAPIsSelected();
    resetCustomApiForm();
    showToast('已添加自定义API: ' + name, 'success');
}

// 移除自定义API
function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;

    const deletedItem = customAPIs[index];
    const customApiId = 'custom_' + index;
    const wasSelected = selectedAPIs.includes(customApiId);

    // 从列表中移除API
    customAPIs.splice(index, 1);
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    // 从选中列表中移除此API
    selectedAPIs = selectedAPIs.filter(id => id !== customApiId);

    // 更新大于此索引的自定义API索引
    selectedAPIs = selectedAPIs.map(id => {
        if (id.startsWith('custom_')) {
            const currentIndex = parseInt(id.replace('custom_', ''));
            if (currentIndex > index) {
                return 'custom_' + (currentIndex - 1);
            }
        }
        return id;
    });

    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // 重新渲染自定义API列表
    renderCustomAPIsList();

    // 更新选中的API数量
    updateSelectedApiCount();

    // 重新检查成人API选中状态
    checkAdultAPIsSelected();

    // 显示撤销提示
    showToast('已移除自定义API: ' + deletedItem.name, 'info');
}

function toggleSettings(e) {
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel) return;

    const triggerElement = e?.currentTarget || document.activeElement;

    // 移动端使用增强版打开/关闭
    if (window.innerWidth <= 640) {
        if (settingsPanel.classList.contains('show')) {
            window.closePanel && window.closePanel(settingsPanel);
        } else {
            window.openPanel && window.openPanel(settingsPanel, triggerElement);
        }
    } else {
        // 桌面端保持原有逻辑
        settingsPanel.classList.toggle('show');
    }

    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 窗口宽度跨越移动端阈值（640px）时重渲染分页，避免每页数量变化导致切片/页码错位
    let mobileBreakpointActive = window.innerWidth <= 640;
    window.addEventListener('resize', debounce(function () {
        const isMobile = window.innerWidth <= 640;
        if (isMobile !== mobileBreakpointActive) {
            mobileBreakpointActive = isMobile;
            initAPICheckboxes();
            // 跨入移动端且面板打开时，滚动到 API 选择区域顶部，与 changeApiPage 移动端行为一致
            // 面板关闭时不滚动，避免对离屏面板执行无意义 scrollTo
            if (isMobile) {
                const panel = document.getElementById('settingsPanel');
                const anchor = document.getElementById('apiCheckboxes');
                if (panel && anchor && typeof panel.scrollTo === 'function' && panel.classList.contains('show')) {
                    panel.scrollTo({ top: anchor.offsetTop - 24, behavior: 'smooth' });
                }
            }
        }
    }, 200));

    // 回车搜索
    document.getElementById('searchInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            search();
        }
    });

    // 点击外部关闭设置面板和历史记录面板
    document.addEventListener('click', function (e) {
        const panelOverlay = document.getElementById('panelOverlay');
        let panelClosed = false;

        // 关闭设置面板
        const settingsPanel = document.querySelector('#settingsPanel.show');
        const settingsButton = document.querySelector('#settingsPanel .close-btn');

        if (settingsPanel && settingsButton &&
            !settingsPanel.contains(e.target) &&
            !settingsButton.contains(e.target)) {
            settingsPanel.classList.remove('show');
            panelClosed = true;
        }

        // 关闭历史记录面板
        const historyPanel = document.querySelector('#historyPanel.show');
        const historyButton = document.querySelector('#historyPanel .close-btn');

        if (historyPanel && historyButton &&
            !historyPanel.contains(e.target) &&
            !historyButton.contains(e.target)) {
            historyPanel.classList.remove('show');
            panelClosed = true;
        }

        // 同步隐藏遮罩层
        if (panelClosed && panelOverlay) {
            panelOverlay.classList.remove('show');
        }
    });

    // 黄色内容过滤开关事件绑定
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.addEventListener('change', function (e) {
            localStorage.setItem('yellowFilterEnabled', e.target.checked);

            // 控制黄色内容接口的显示状态
            const adultdiv = document.getElementById('adultdiv');
            if (adultdiv) {
                if (e.target.checked === true) {
                    adultdiv.style.display = 'none';
                } else if (e.target.checked === false) {
                    adultdiv.style.display = ''
                }
            } else {
                // 添加成人API列表
                addAdultAPI();
            }
        });
    }

    // 广告过滤开关事件绑定
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.addEventListener('change', function (e) {
            localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked);
        });
    }
}

// 重置搜索区域
function resetSearchArea() {
    // 清理搜索结果
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchInput').value = '';

    // 恢复搜索区域的样式（不在首页给搜索框加 flex-1，避免把后续的最近观看/豆瓣区域挤到屏幕外）
    document.getElementById('searchArea').classList.remove('mb-2');
    document.getElementById('resultsArea').classList.add('hidden');

    // 确保页脚正确显示，移除相对定位
    const footer = document.querySelector('.footer');
    if (footer) {
        footer.style.position = '';
    }

    // 如果有豆瓣功能，检查是否需要显示豆瓣推荐区域
    if (typeof updateDoubanVisibility === 'function') {
        updateDoubanVisibility();
    }

    // 同步最近观看区域的显示状态
    if (typeof updateRecentWatchVisibility === 'function') {
        updateRecentWatchVisibility();
    }

    // 重置URL为主页
    try {
        window.history.pushState(
            {},
            `LibreTV - 免费在线视频搜索与观看平台`,
            `/`
        );
        // 更新页面标题
        document.title = `LibreTV - 免费在线视频搜索与观看平台`;
    } catch (e) {
        console.error('更新浏览器历史失败:', e);
    }
}

// 获取自定义API信息
function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) {
        return null;
    }
    return customAPIs[index];
}

// 黄色内容过滤：敏感关键词清单统一在此定义，避免多处复制导致分岔
const BANNED_KEYWORDS = ['伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑', '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码', '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频', '福利片'];

// 按片名分类字段过滤敏感内容（仅在 yellowFilterEnabled 时由调用方包裹判断）
function filterBanned(results) {
    return results.filter(item => {
        const typeName = item.type_name || '';
        return !BANNED_KEYWORDS.some(keyword => typeName.includes(keyword));
    });
}

// 从缓存渲染搜索结果（跳过 API 请求）
function renderCachedResults(allResults) {
    const resultsDiv = document.getElementById('results');
    const resultsArea = document.getElementById('resultsArea');

    // 黄色内容过滤
    const yellowFilterEnabled = localStorage.getItem('yellowFilterEnabled') === 'true';
    if (yellowFilterEnabled) {
        allResults = filterBanned(allResults);
    }

    window.searchResults = allResults;
    filteredResults = allResults;
    currentPage = 1;

    document.getElementById('searchArea').classList.remove('flex-1');
    document.getElementById('searchArea').classList.add('mb-2');
    resultsArea.classList.remove('hidden');

    const doubanArea = document.getElementById('doubanArea');
    if (doubanArea) doubanArea.classList.add('hidden');

    const recentWatchArea = document.getElementById('recentWatchArea');
    if (recentWatchArea) recentWatchArea.classList.add('hidden');

    updateSearchStatistics(allResults);
    generateSearchFilters(allResults);
    renderSearchResults(allResults);
    renderPagination(allResults.length);
}

// 搜索功能 - 修改为支持多选API和多页结果
async function search() {
    // 强化的密码保护校验 - 防止绕过
    try {
        if (window.ensurePasswordProtection) {
            window.ensurePasswordProtection();
        } else {
            // 兼容性检查
            if (window.isPasswordProtected && window.isPasswordVerified) {
                if (window.isPasswordProtected() && !window.isPasswordVerified()) {
                    showPasswordModal && showPasswordModal();
                    return;
                }
            }
        }
    } catch (error) {
        console.warn('Password protection check failed:', error.message);
        return;
    }

    // 防抖：搜索正在进行中则跳过本次调用
    if (searchInProgress) return;
    searchInProgress = true;

    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        searchInProgress = false;
        showToast('请输入搜索内容', 'info');
        return;
    }

    if (selectedAPIs.length === 0) {
        searchInProgress = false;
        showToast('请至少选择一个API源', 'warning');
        return;
    }

    // 复用测活缓存跳过已知失效源：新鲜缓存（1h）内过滤掉不在 ok 列表的内置源，自定义源保留
    let effectiveAPIs = selectedAPIs;
    try {
        const health = JSON.parse(localStorage.getItem('siteHealthCache') || 'null');
        if (health && Array.isArray(health.ok) && Date.now() - health.timestamp < 3600 * 1000) {
            const okSet = new Set(health.ok);
            const filtered = selectedAPIs.filter(key => key.startsWith('custom_') || okSet.has(key));
            if (filtered.length > 0) effectiveAPIs = filtered; // 空则回退全量，避免空结果
        }
    } catch { /* 缓存损坏则忽略，走全量 */ }

    // 缓存检查：相同 query + 相同源列表命中直接返回
    const CACHE_TTL = 5 * 60 * 1000; // 5 分钟
    const cacheKey = `${query}:${[...effectiveAPIs].sort().join(',')}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        searchInProgress = false;
        renderCachedResults(cached.results);
        return;
    }

    showLoading();

    // 点击搜索立即隐藏首页推荐与最近观看区域（结果返回前先收起）
    const doubanAreaHidden = document.getElementById('doubanArea');
    if (doubanAreaHidden) doubanAreaHidden.classList.add('hidden');
    const recentWatchAreaHidden = document.getElementById('recentWatchArea');
    if (recentWatchAreaHidden) recentWatchAreaHidden.classList.add('hidden');

    // 优化2: 显示骨架屏，隐藏之前的结果
    const resultsDiv = document.getElementById('results');
    const skeletonDiv = document.getElementById('searchSkeleton');
    const resultsArea = document.getElementById('resultsArea');

    resultsDiv.innerHTML = '';
    resultsDiv.classList.add('hidden');
    skeletonDiv.classList.remove('hidden');
    resultsArea.classList.remove('hidden');

    try {
        // 保存搜索历史
        saveSearchHistory(query);

        // 从所有选中的API源搜索 - 全量并发 + 增量渲染
        let allResults = [];
        const yellowFilterEnabled = localStorage.getItem('yellowFilterEnabled') === 'true';

        // 增量渲染：首源立即渲染（消除 100ms 启动延迟），后续源 100ms 节流合并
        // 追加式渲染：只把新到结果 append 到卡片列表尾部，不整体重建 innerHTML，
        // 避免已渲染卡片/图片被反复销毁重建导致空白闪烁
        let incrementalTimer = null;
        let firstRenderDone = false;
        let renderedCount = 0; // 已追加卡片数（以 displayResults 口径累计）
        const renderIncremental = () => {
            incrementalTimer = null;
            if (allResults.length === 0) return;
            currentPage = 1;
            const displayResults = yellowFilterEnabled ? filterBanned(allResults) : allResults;
            if (displayResults.length > renderedCount) {
                const newItems = displayResults.slice(renderedCount);
                resultsDiv.insertAdjacentHTML('beforeend', newItems.map(buildSearchCardHTML).join(''));
                renderedCount = displayResults.length;
            }
            const searchResultsCount = document.getElementById('searchResultsCount');
            if (searchResultsCount) searchResultsCount.textContent = displayResults.length;
            const paginationDiv = document.getElementById('pagination');
            if (paginationDiv) paginationDiv.classList.add('hidden');
            skeletonDiv.classList.add('hidden');
            resultsDiv.classList.remove('hidden');
        };
        const scheduleIncrementalRender = () => {
            if (!firstRenderDone) {
                renderIncremental();
                firstRenderDone = true;
            } else if (!incrementalTimer) {
                incrementalTimer = setTimeout(renderIncremental, 100);
            }
        };

        // 逐源发起并发请求，每完成一个源立即触发增量渲染
        const resultsArray = await Promise.allSettled(effectiveAPIs.map(async apiId => {
            const r = await searchByAPIAndKeyWord(apiId, query);
            if (r && Array.isArray(r.results) && r.results.length > 0) {
                allResults.push(...r.results);
                scheduleIncrementalRender();
            }
            return r;
        }));

        // 清掉未触发的增量渲染，交由最终渲染
        if (incrementalTimer) {
            clearTimeout(incrementalTimer);
            incrementalTimer = null;
        }
        firstRenderDone = false;

        // 对搜索结果进行排序：按视频名称排序，名称相同则按来源排序
        allResults.sort((a, b) => {
            const nameCompare = (a.vod_name || '').localeCompare(b.vod_name || '');
            if (nameCompare !== 0) return nameCompare;

            // 如果名称也相同，则按照来源排序
            const sourceCompare = (a.source_name || '').localeCompare(b.source_name || '');
            if (sourceCompare !== 0) return sourceCompare;

            // 名称与来源都相同时按 id 稳定排序，保证 cache/no-cache 路径顺序一致
            return (a.vod_id || '').toString().localeCompare((b.vod_id || '').toString());
        });

        // 更新搜索结果计数
        const searchResultsCount = document.getElementById('searchResultsCount');
        if (searchResultsCount) {
            searchResultsCount.textContent = allResults.length;
        }

        // 显示结果区域，调整搜索区域
        document.getElementById('searchArea').classList.remove('flex-1');
        document.getElementById('searchArea').classList.add('mb-2');
        document.getElementById('resultsArea').classList.remove('hidden');

        // 隐藏豆瓣推荐区域（如果存在）
        const doubanArea = document.getElementById('doubanArea');
        if (doubanArea) {
            doubanArea.classList.add('hidden');
        }

        const resultsDiv = document.getElementById('results');

        // 如果没有结果
        if (!allResults || allResults.length === 0) {
            resultsDiv.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
                    <p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p>
                </div>
            `;
            hideLoading();
            return;
        }

        // 有搜索结果时，才更新URL
        try {
            // 使用URI编码确保特殊字符能够正确显示
            const encodedQuery = encodeURIComponent(query);
            // 使用HTML5 History API更新URL，不刷新页面
            window.history.pushState(
                { search: query },
                `搜索: ${query} - LibreTV`,
                `/s=${encodedQuery}`
            );
            // 更新页面标题
            document.title = `搜索: ${query} - LibreTV`;
        } catch (e) {
            console.error('更新浏览器历史失败:', e);
            // 如果更新URL失败，继续执行搜索
        }

        // 处理搜索结果过滤：如果启用了黄色内容过滤，则过滤掉分类含有敏感内容的项目
        if (yellowFilterEnabled) {
            allResults = filterBanned(allResults);
        }

        // 优化1: 保存完整的搜索结果用于筛选
        window.searchResults = allResults;
        filteredResults = allResults;

        // 重置到第一页
        currentPage = 1;

        // 优化1: 生成统计信息
        updateSearchStatistics(allResults);

        // 优化1: 生成筛选按钮
        generateSearchFilters(allResults);

        // 渲染搜索结果（带分页）
        renderSearchResults(allResults);

        // 渲染分页控件
        renderPagination(allResults.length);

        // 缓存本次搜索结果
        searchCache.set(cacheKey, { results: allResults, timestamp: Date.now() });
        // LRU 上限：Map 迭代序即插入序，超出上限删除最旧
        if (searchCache.size > 50) {
            searchCache.delete(searchCache.keys().next().value);
        }

        // 优化2: 隐藏骨架屏，显示实际结果
        skeletonDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');
    } catch (error) {
        console.error('搜索错误:', error);
        if (error.name === 'AbortError') {
            showToast('搜索请求超时，请检查网络连接', 'error');
        } else {
            showToast('搜索请求失败，请稍后重试', 'error');
        }
    } finally {
        searchInProgress = false;
        hideLoading();
    }
}

// 切换清空按钮的显示状态
function toggleClearButton() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearchInput');
    if (searchInput.value !== '') {
        clearButton.classList.remove('hidden');
    } else {
        clearButton.classList.add('hidden');
    }
}

// 清空搜索框内容
function clearSearchInput() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    const clearButton = document.getElementById('clearSearchInput');
    clearButton.classList.add('hidden');
}

// 劫持搜索框的value属性以检测外部修改
function hookInput() {
    const input = document.getElementById('searchInput');
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    // 重写 value 属性的 getter 和 setter
    Object.defineProperty(input, 'value', {
        get: function () {
            // 确保读取时返回字符串（即使原始值为 undefined/null）
            const originalValue = descriptor.get.call(this);
            return originalValue != null ? String(originalValue) : '';
        },
        set: function (value) {
            // 显式将值转换为字符串后写入
            const strValue = String(value);
            descriptor.set.call(this, strValue);
            this.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // 初始化输入框值为空字符串（避免初始值为 undefined）
    input.value = '';
}
document.addEventListener('DOMContentLoaded', hookInput);

// 显示详情 - 修改为支持自定义API
async function showDetails(id, vod_name, sourceCode, vod_pic = '') {
    // 密码保护校验
    if (!window.requirePasswordOrPrompt()) return;
    if (!id) {
        showToast('视频ID无效', 'error');
        return;
    }

    showLoading();
    try {
        // 构建API参数
        let apiParams = '';

        // 处理自定义API源
        if (sourceCode.startsWith('custom_')) {
            const customIndex = sourceCode.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) {
                showToast('自定义API配置无效', 'error');
                hideLoading();
                return;
            }
            // 传递 detail 字段
            if (customApi.detail) {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
            } else {
                apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
            }
        } else {
            // 内置API
            apiParams = '&source=' + sourceCode;
        }

        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime();
        const cacheBuster = `&_t=${timestamp}`;
        const response = await fetch(`/api/detail?id=${encodeURIComponent(id)}${apiParams}${cacheBuster}`);

        const data = await response.json();

        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');

        // 保存封面URL到全局变量（优先使用传递的vod_pic，否则从API响应获取）
        window.currentVodPic = vod_pic || (data.videoInfo && data.videoInfo.vod_pic ? data.videoInfo.vod_pic : '');

        // 显示来源信息
        const sourceName = data.videoInfo && data.videoInfo.source_name ?
            ` <span class="text-sm font-normal text-gray-400">(${data.videoInfo.source_name})</span>` : '';

        // 不对标题进行截断处理，允许完整显示
        // modalTitle 为 sr-only 元素（仅供屏幕阅读器），视觉标题由 detail-hero 承载
        modalTitle.textContent = vod_name || '未知视频';
        currentVideoTitle = vod_name || '未知视频';

        if (data.episodes && data.episodes.length > 0) {
            // ----- Coming-Soon / 预告式详情卡 ——
            // 属性安全转义：除 escapeHtml 外再处理单引号，避免 HTML 属性内拼接被破坏
            const attrEsc = (s) => String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            const safeVodName = escapeHtml(vod_name || '未知视频');
            const safeSourceName = escapeHtml((data.videoInfo && data.videoInfo.source_name) || '');
            const safeId = attrEsc(String(id));
            const safeSourceCode = attrEsc(sourceCode);

            // 副标题（hero 左下浮层下方）：优先展示数据源名称
            const subtitleText = safeSourceName;

            // 标签胶囊（年份/类型/地区/class/备注）
            const vi = data.videoInfo || {};
            const tagItems = [];
            if (vi.year) tagItems.push(escapeHtml(String(vi.year)));
            if (vi.type) tagItems.push(escapeHtml(String(vi.type)));
            if (vi.area) tagItems.push(escapeHtml(String(vi.area)));
            if (vi.class) tagItems.push(escapeHtml(String(vi.class)));
            else if (vi.remarks) tagItems.push(escapeHtml(String(vi.remarks)));
            const tagsHtml = tagItems
                .map(t => `<span class="detail-tag">${t}</span>`)
                .join('');

            // 描述（清洗 HTML 标签后再 escape）
            const descriptionRaw = vi.desc ? String(vi.desc).replace(/<[^>]+>/g, '').trim() : '';
            const safeDescription = escapeHtml(descriptionRaw);
            const hasDescription = descriptionRaw.length > 0;

            // 背景海报：复用 ui.js 历史封面代理逻辑，保证同源可加载
            let backdropUrl = '';
            const rawPic = String(window.currentVodPic || '').trim();
            if (rawPic) {
                try {
                    if (rawPic.startsWith('http://') || rawPic.startsWith('https://')) {
                        backdropUrl = `/proxy/${encodeURIComponent(rawPic).replace(/'/g, '%27')}`;
                    } else if (rawPic.startsWith('//')) {
                        const normalized = `${window.location.protocol}${rawPic}`;
                        backdropUrl = `/proxy/${encodeURIComponent(normalized).replace(/'/g, '%27')}`;
                    } else if (rawPic.startsWith('/')) {
                        backdropUrl = rawPic;
                    }
                } catch (e) { backdropUrl = ''; }
            }
            const safeBackdropUrl = escapeHtml(backdropUrl);

            // 右上角源名称首字角标
            const sourceBadgeInitial = safeSourceName
                ? Array.from(safeSourceName)[0].toUpperCase()
                : '影';
            const sourceBadgeTitle = `来源: ${safeSourceName}`;

            // 背景海报交给 LazyImageLoader：img.lazy-load[data-src] 会被 MutationObserver
            // 自动接管，补 proxy 鉴权参数、缓存、加载失败降级（隐藏 img 露出纯色占位底）
            const heroBgImg = backdropUrl
                ? `<img class="detail-hero-bg lazy-load" data-src="${safeBackdropUrl}" alt="" aria-hidden="true" referrerpolicy="no-referrer">`
                : '';
            // 无封面时的居中占位：源名首字（或「影」）
            const heroEmptyMark = backdropUrl ? '' : `<div class="detail-hero-empty-mark">${escapeHtml(sourceBadgeInitial)}</div>`;

            currentEpisodes = data.episodes;
            currentEpisodeIndex = 0;

            modalContent.innerHTML = `
                <div class="detail-hero">
                    ${heroBgImg}
                    ${heroEmptyMark}
                    <div class="detail-hero-shade"></div>
                    <div class="detail-hero-source-badge" title="${escapeHtml(sourceBadgeTitle)}">
                        <span class="detail-hero-source-mark">${escapeHtml(sourceBadgeInitial)}</span>
                    </div>
                    <div class="detail-hero-title-wrap">
                        <h3 class="detail-hero-title">${safeVodName}</h3>
                        ${subtitleText ? `<p class="detail-hero-subtitle">${subtitleText}</p>` : ''}
                    </div>
                </div>

                <div class="detail-meta">
                    ${tagsHtml ? `<div class="detail-tags">${tagsHtml}</div>` : ''}
                    ${hasDescription ? `<p class="detail-desc">${safeDescription}</p>` : ''}
                    <p class="detail-foot">仅供测试 · 视频来自第三方接口</p>
                </div>

                <div class="detail-episodes">
                    <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
                        <div class="flex items-center gap-2">
                            <button onclick="toggleEpisodeOrder('${safeSourceCode}', '${safeId}')"
                                    class="px-3 py-1.5 bg-[#333] hover:bg-[#444] border border-[#444] rounded text-sm transition-colors flex items-center gap-1">
                                <svg class="w-4 h-4 transform ${episodesReversed ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                                </svg>
                                <span>${episodesReversed ? '正序排列' : '倒序排列'}</span>
                            </button>
                            <span class="text-gray-400 text-sm">共 ${data.episodes.length} 集</span>
                        </div>
                        <button onclick="copyLinks()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                            复制链接
                        </button>
                    </div>
                    <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        ${renderEpisodes(vod_name, sourceCode, id)}
                    </div>
                </div>
            `;
        } else {
            modalContent.innerHTML = `
                <div class="detail-center py-10 text-center">
                    <div class="text-red-400 mb-2 text-lg">❌ 未找到播放资源</div>
                    <div class="text-gray-500 text-sm">该视频可能暂时无法播放，请尝试其他视频</div>
                </div>
            `;
        }

        modal.classList.remove('hidden');
    } catch (error) {
        console.error('获取详情错误:', error);
        showToast('获取详情失败，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 更新播放视频函数，修改为使用/watch路径而不是直接打开player.html
function playVideo(url, vod_name, sourceCode, episodeIndex = 0, vodId = '') {
    // 密码保护校验
    if (!window.requirePasswordOrPrompt()) return;

    // 获取当前路径作为返回页面
    let currentPath = window.location.href;

    // 构建播放页面URL，使用watch.html作为中间跳转页
    let watchUrl = `watch.html?id=${vodId || ''}&source=${sourceCode || ''}&url=${encodeURIComponent(url)}&index=${episodeIndex}&title=${encodeURIComponent(vod_name || '')}`;

    // 添加封面URL参数（如果存在）
    if (window.currentVodPic) {
        watchUrl += `&vod_pic=${encodeURIComponent(window.currentVodPic)}`;
    }

    // 添加返回URL参数
    if (currentPath.includes('index.html') || currentPath.endsWith('/')) {
        watchUrl += `&back=${encodeURIComponent(currentPath)}`;
    }

    // 保存当前状态到localStorage
    try {
        localStorage.setItem('currentVideoTitle', vod_name || '未知视频');
        localStorage.setItem('currentEpisodes', JSON.stringify(currentEpisodes));
        localStorage.setItem('currentEpisodeIndex', episodeIndex);
        localStorage.setItem('currentSourceCode', sourceCode || '');
        localStorage.setItem('lastPlayTime', Date.now());
        localStorage.setItem('lastSearchPage', currentPath);
        localStorage.setItem('lastPageUrl', currentPath);  // 确保保存返回页面URL
    } catch (e) {
        console.error('保存播放状态失败:', e);
    }

    // 在当前标签页中打开播放页面
    window.location.href = watchUrl;
}

// 弹出播放器页面
function showVideoPlayer(url) {
    // 在打开播放器前，隐藏详情弹窗
    const detailModal = document.getElementById('modal');
    if (detailModal) {
        detailModal.classList.add('hidden');
    }
    // 临时隐藏搜索结果和豆瓣区域，防止高度超出播放器而出现滚动条
    document.getElementById('resultsArea').classList.add('hidden');
    document.getElementById('doubanArea').classList.add('hidden');
    const recentWatchArea = document.getElementById('recentWatchArea');
    if (recentWatchArea) recentWatchArea.classList.add('hidden');
    // 在框架中打开播放页面
    videoPlayerFrame = document.createElement('iframe');
    videoPlayerFrame.id = 'VideoPlayerFrame';
    videoPlayerFrame.className = 'fixed w-full h-screen z-40';
    videoPlayerFrame.src = url;
    document.body.appendChild(videoPlayerFrame);
    // 将焦点移入iframe
    videoPlayerFrame.focus();
}

// 关闭播放器页面
function closeVideoPlayer(home = false) {
    videoPlayerFrame = document.getElementById('VideoPlayerFrame');
    if (videoPlayerFrame) {
        videoPlayerFrame.remove();
        // 恢复搜索结果显示
        document.getElementById('resultsArea').classList.remove('hidden');
        // 关闭播放器时也隐藏详情弹窗
        const detailModal = document.getElementById('modal');
        if (detailModal) {
            detailModal.classList.add('hidden');
        }
        // 如果启用豆瓣区域则显示豆瓣区域
        if (localStorage.getItem('doubanEnabled') === 'true') {
            document.getElementById('doubanArea').classList.remove('hidden');
        }
        // 同步最近观看区域显示状态
        if (typeof updateRecentWatchVisibility === 'function') {
            updateRecentWatchVisibility();
        }
    }
    if (home) {
        // 刷新主页
        window.location.href = '/'
    }
}

// 播放上一集
function playPreviousEpisode(sourceCode) {
    if (currentEpisodeIndex > 0) {
        const prevIndex = currentEpisodeIndex - 1;
        const prevUrl = currentEpisodes[prevIndex];
        playVideo(prevUrl, currentVideoTitle, sourceCode, prevIndex);
    }
}

// 播放下一集
function playNextEpisode(sourceCode) {
    if (currentEpisodeIndex < currentEpisodes.length - 1) {
        const nextIndex = currentEpisodeIndex + 1;
        const nextUrl = currentEpisodes[nextIndex];
        playVideo(nextUrl, currentVideoTitle, sourceCode, nextIndex);
    }
}

// 处理播放器加载错误
function handlePlayerError() {
    hideLoading();
    showToast('视频播放加载失败，请尝试其他视频源', 'error');
}

// 辅助函数用于渲染剧集按钮（使用当前的排序状态）
function renderEpisodes(vodName, sourceCode, vodId) {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    return episodes.map((episode, index) => {
        // 根据倒序状态计算真实的剧集索引
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
        return `
            <button id="episode-${realIndex}" onclick="playVideo('${episode}','${vodName.replace(/"/g, '&quot;')}', '${sourceCode}', ${realIndex}, '${vodId}')" 
                    class="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded-lg transition-colors text-center episode-btn">
                ${realIndex + 1}
            </button>
        `;
    }).join('');
}

// 复制视频链接到剪贴板
function copyLinks() {
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    const linkList = episodes.join('\r\n');
    navigator.clipboard.writeText(linkList).then(() => {
        showToast('播放链接已复制', 'success');
    }).catch(err => {
        showToast('复制失败，请检查浏览器权限', 'error');
    });
}

// 切换排序状态的函数
function toggleEpisodeOrder(sourceCode, vodId) {
    episodesReversed = !episodesReversed;
    // 重新渲染剧集区域，使用 currentVideoTitle 作为视频标题
    const episodesGrid = document.getElementById('episodesGrid');
    if (episodesGrid) {
        episodesGrid.innerHTML = renderEpisodes(currentVideoTitle, sourceCode, vodId);
    }

    // 更新按钮文本和箭头方向
    const toggleBtn = document.querySelector(`button[onclick="toggleEpisodeOrder('${sourceCode}', '${vodId}')"]`);
    if (toggleBtn) {
        toggleBtn.querySelector('span').textContent = episodesReversed ? '正序排列' : '倒序排列';
        const arrowIcon = toggleBtn.querySelector('svg');
        if (arrowIcon) {
            arrowIcon.style.transform = episodesReversed ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
}

// 从URL导入配置
async function importConfigFromUrl() {
    // 创建模态框元素
    let modal = document.getElementById('importUrlModal');
    if (modal) {
        document.body.removeChild(modal);
    }

    modal = document.createElement('div');
    modal.id = 'importUrlModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';

    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeUrlModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold mb-4">从URL导入配置</h3>
            
            <div class="mb-4">
                <input type="text" id="configUrl" placeholder="输入配置文件URL" 
                       class="w-full px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-2">
                <button id="confirmUrlImport" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">导入</button>
                <button id="cancelUrlImport" class="bg-[#444] hover:bg-[#555] text-white px-4 py-2 rounded">取消</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    // 关闭按钮事件
    document.getElementById('closeUrlModal').addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.removeChild(modal);
    });

    // 取消按钮事件
    document.getElementById('cancelUrlImport').addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.removeChild(modal);
    });

    // 确认导入按钮事件
    document.getElementById('confirmUrlImport').addEventListener('click', async () => {
        const url = document.getElementById('configUrl').value.trim();
        if (!url) {
            showToast('请输入配置文件URL', 'warning');
            return;
        }

        // 验证URL格式
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                showToast('URL必须以http://或https://开头', 'warning');
                return;
            }
        } catch (e) {
            showToast('URL格式不正确', 'warning');
            return;
        }

        showLoading('正在从URL导入配置...');

        try {
            // 获取配置文件 - 直接请求URL
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) throw '获取配置文件失败';

            // 验证响应内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw '响应不是有效的JSON格式';
            }

            const config = await response.json();
            if (config.name !== 'LibreTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '导入配置失败';
            showToast(`从URL导入配置出错 (${message})`, 'error');
        } finally {
            hideLoading();
            document.body.removeChild(modal);
        }
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// 配置文件导入功能
async function importConfig() {
    showImportBox(async (file) => {
        try {
            // 检查文件类型
            if (!(file.type === 'application/json' || file.name.endsWith('.json'))) throw '文件类型不正确';

            // 检查文件大小
            if (file.size > 1024 * 1024 * 10) throw new Error('文件大小超过 10MB');

            // 读取文件内容
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject('文件读取失败');
                reader.readAsText(file);
            });

            // 解析并验证配置
            const config = JSON.parse(content);
            if (config.name !== 'LibreTV-Settings') throw '配置文件格式不正确';

            // 验证哈希
            const dataHash = await sha256(JSON.stringify(config.data));
            if (dataHash !== config.hash) throw '配置文件哈希值不匹配';

            // 导入配置
            for (let item in config.data) {
                localStorage.setItem(item, config.data[item]);
            }

            showToast('配置文件导入成功，3 秒后自动刷新本页面。', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            const message = typeof error === 'string' ? error : '配置文件格式错误';
            showToast(`配置文件读取出错 (${message})`, 'error');
        }
    });
}

// 配置文件导出功能
async function exportConfig() {
    // 存储配置数据
    const config = {};
    const items = {};

    const settingsToExport = [
        'selectedAPIs',
        'customAPIs',
        'yellowFilterEnabled',
        'adFilteringEnabled',
        'doubanEnabled',
        'hasInitializedDefaults'
    ];

    // 导出设置项
    settingsToExport.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
            items[key] = value;
        }
    });

    // 导出历史记录
    const viewingHistory = localStorage.getItem('viewingHistory');
    if (viewingHistory) {
        items['viewingHistory'] = viewingHistory;
    }

    const searchHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (searchHistory) {
        items[SEARCH_HISTORY_KEY] = searchHistory;
    }

    const times = Date.now().toString();
    config['name'] = 'LibreTV-Settings';  // 配置文件名，用于校验
    config['time'] = times;               // 配置文件生成时间
    config['cfgVer'] = '1.0.0';           // 配置文件版本
    config['data'] = items;               // 配置文件数据
    config['hash'] = await sha256(JSON.stringify(config['data']));  // 计算数据的哈希值，用于校验

    // 将配置数据保存为 JSON 文件
    saveStringAsFile(JSON.stringify(config), 'LibreTV-Settings_' + times + '.json');
}

// 将字符串保存为文件
function saveStringAsFile(content, fileName) {
    // 创建Blob对象并指定类型
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    // 生成临时URL
    const url = window.URL.createObjectURL(blob);
    // 创建<a>标签并触发下载
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // 清理临时对象
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// ========== 优化1: 搜索结果统计和筛选功能 ==========

// 当前筛选条件
let currentFilters = {
    source: 'all',
    category: 'all'
};

// 分页配置
const PAGINATION_CONFIG = {
    itemsPerPage: 12,  // PC端每页显示12条
    itemsPerPageMobile: 5,  // 移动端每页显示5条
    maxVisiblePages: 5,  // PC端最多显示5个页码按钮
    maxVisiblePagesMobile: 3  // 移动端最多显示3个页码按钮
};

// 获取当前每页显示数量
function getItemsPerPage() {
    return window.innerWidth <= 640 ? PAGINATION_CONFIG.itemsPerPageMobile : PAGINATION_CONFIG.itemsPerPage;
}

// 获取最大可见页码数量
function getMaxVisiblePages() {
    return window.innerWidth <= 640 ? PAGINATION_CONFIG.maxVisiblePagesMobile : PAGINATION_CONFIG.maxVisiblePages;
}

// 当前分页状态
let currentPage = 1;
let filteredResults = [];  // 筛选后的结果

// 更新搜索统计信息
function updateSearchStatistics(results) {
    const searchResultsCount = document.getElementById('searchResultsCount');
    const searchSourcesCount = document.getElementById('searchSourcesCount');

    if (searchResultsCount) {
        searchResultsCount.textContent = results.length;
    }

    // 统计片源数量
    const sources = new Set();
    results.forEach(item => {
        if (item.source_name) {
            sources.add(item.source_name);
        }
    });

    if (searchSourcesCount) {
        searchSourcesCount.textContent = `来自 ${sources.size} 个片源`;
    }
}

// 生成筛选按钮
function generateSearchFilters(results) {
    // 统计片源
    const sourceCounts = {};
    const categoryCounts = {};

    results.forEach(item => {
        // 统计片源
        const source = item.source_name || '未知片源';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;

        // 统计分类
        const category = item.type_name || '未分类';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // 生成片源筛选按钮
    const sourceFiltersDiv = document.getElementById('sourceFilters');
    if (sourceFiltersDiv) {
        let sourceHTML = `
            <button onclick="filterBySource('all')" class="filter-btn active" data-filter="all">
                全部 <span class="count">${results.length}</span>
            </button>
        `;

        Object.entries(sourceCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([source, count]) => {
                const safeSource = source.replace(/'/g, "\\'");
                sourceHTML += `
                    <button onclick="filterBySource('${safeSource}')" class="filter-btn" data-filter="${safeSource}">
                        ${source} <span class="count">${count}</span>
                    </button>
                `;
            });

        sourceFiltersDiv.innerHTML = sourceHTML;
    }

    // 生成分类筛选按钮
    const categoryFiltersDiv = document.getElementById('categoryFilters');
    if (categoryFiltersDiv) {
        let categoryHTML = `
            <button onclick="filterByCategory('all')" class="filter-btn active" data-filter="all">
                全部 <span class="count">${results.length}</span>
            </button>
        `;

        Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, count]) => {
                const safeCategory = category.replace(/'/g, "\\'");
                categoryHTML += `
                    <button onclick="filterByCategory('${safeCategory}')" class="filter-btn" data-filter="${safeCategory}">
                        ${category} <span class="count">${count}</span>
                    </button>
                `;
            });

        categoryFiltersDiv.innerHTML = categoryHTML;
    }
}

// 切换筛选面板
function toggleSearchFilters() {
    const panel = document.getElementById('searchFiltersPanel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

// 按片源筛选
function filterBySource(source) {
    _applyFilter('source', source, 'sourceFilters');
}

// 按分类筛选
function filterByCategory(category) {
    _applyFilter('category', category, 'categoryFilters');
}

// 内部统一筛选：设置 currentFilters[dimension]、刷新结果、更新对应容器按钮 active 态
function _applyFilter(dimension, value, containerId) {
    currentFilters[dimension] = value;
    applySearchFilters();
    document.querySelectorAll('#' + containerId + ' .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === value) btn.classList.add('active');
    });
}

// 应用筛选
function applySearchFilters() {
    if (!window.searchResults) return;

    let filtered = window.searchResults.filter(item => {
        // 片源筛选
        if (currentFilters.source !== 'all') {
            const source = item.source_name || '未知片源';
            if (source !== currentFilters.source) return false;
        }

        // 分类筛选
        if (currentFilters.category !== 'all') {
            const category = item.type_name || '未分类';
            if (category !== currentFilters.category) return false;
        }

        return true;
    });

    // 保存筛选后的结果
    filteredResults = filtered;

    // 重置到第一页
    currentPage = 1;

    // 渲染当前页结果
    renderSearchResults(filtered);

    // 更新计数
    const searchResultsCount = document.getElementById('searchResultsCount');
    if (searchResultsCount) {
        searchResultsCount.textContent = filtered.length;
    }

    // 渲染分页控件
    renderPagination(filtered.length);
}

// 重置筛选
function resetSearchFilters() {
    currentFilters = {
        source: 'all',
        category: 'all'
    };

    // 重置所有按钮状态
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') {
            btn.classList.add('active');
        }
    });

    applySearchFilters();
}

// 构建单个搜索结果卡片 HTML（增量渲染与最终渲染共用，避免 DOM 重建闪烁）
function buildSearchCardHTML(item) {
    const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
    const safeName = (item.vod_name || '').toString()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const sourceInfo = item.source_name ?
        `<span class="bg-[#222] text-xs px-1.5 py-0.5 rounded-full">${item.source_name}</span>` : '';
    const sourceCode = item.source_code || '';

    const apiUrlAttr = item.api_url ?
        `data-api-url="${item.api_url.replace(/"/g, '&quot;')}"` : '';

    // 获取版本信息（如"高清版"）
    const vodVersion = item.vod_version ? item.vod_version.toString().replace(/</g, '&lt;') : '';

    const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

    return `
        <div class="card-hover bg-[#111] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full shadow-sm hover:shadow-md"
             onclick="showDetails('${safeId}','${safeName}','${sourceCode}','${item.vod_pic || ''}')" ${apiUrlAttr}>
            <div class="flex h-full">
                ${hasCover ? `
                <div class="relative flex-shrink-0 search-card-img-container">
                    <img src="${item.vod_pic}" alt="${safeName}"
                         class="h-full w-full object-cover transition-transform hover:scale-110"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=无封面'; this.classList.add('object-contain');"
                         loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent"></div>
                </div>` : ''}

                <div class="p-2 flex flex-col flex-grow">
                    <div class="flex-grow">
                        <h3 class="font-semibold mb-2 break-words line-clamp-2 ${hasCover ? '' : 'text-center'}" title="${safeName}">${safeName}</h3>

                        <div class="flex flex-wrap ${hasCover ? '' : 'justify-center'} gap-1 mb-2">
                            ${(item.type_name || '').toString().replace(/</g, '&lt;') ?
            `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
                                  ${(item.type_name || '').toString().replace(/</g, '&lt;')}
                              </span>` : ''}
                            ${(item.vod_year || '') ?
            `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-purple-500 text-purple-300">
                                  ${item.vod_year}
                              </span>` : ''}
                            ${vodVersion ?
            `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-green-500 text-green-300">
                                  ${vodVersion}
                              </span>` : ''}
                        </div>
                        <p class="text-gray-400 line-clamp-2 overflow-hidden ${hasCover ? '' : 'text-center'} mb-2">
                            ${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '&lt;')}
                        </p>
                    </div>

                    <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
                        <div class="flex items-center gap-2">
                            ${sourceInfo ? `${sourceInfo}` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 渲染搜索结果
function renderSearchResults(results) {
    const resultsDiv = document.getElementById('results');

    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="col-span-full text-center py-16">
                <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="mt-2 text-lg font-medium text-gray-400">没有符合条件的结果</h3>
                <p class="mt-1 text-sm text-gray-500">请调整筛选条件或重新搜索</p>
            </div>
        `;
        // 隐藏分页控件
        const paginationDiv = document.getElementById('pagination');
        if (paginationDiv) paginationDiv.classList.add('hidden');
        return;
    }

    // 计算分页
    const itemsPerPage = getItemsPerPage();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageResults = results.slice(startIndex, endIndex);

    let safeResults = pageResults.map(buildSearchCardHTML).join('');

    // 末页不足一页时补不可见占位卡片，保持网格行高一致，分页栏不跳动
    // 占位卡片复用与真实卡片相同的内部结构（图片容器固定 150px + 文字区），保证行高一致
    if (pageResults.length < itemsPerPage) {
        const placeholder = `
            <div class="card-hover bg-[#111] rounded-lg overflow-hidden" style="visibility:hidden" aria-hidden="true">
                <div class="flex h-full">
                    <div class="relative flex-shrink-0 search-card-img-container"></div>
                    <div class="p-2 flex flex-col flex-grow"></div>
                </div>
            </div>`;
        safeResults += Array(itemsPerPage - pageResults.length).fill(placeholder).join('');
    }

    resultsDiv.innerHTML = safeResults;

    // 显示分页控件
    const paginationDiv = document.getElementById('pagination');
    if (paginationDiv) paginationDiv.classList.remove('hidden');
}

// 渲染分页控件
function renderPagination(totalItems) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;

    const itemsPerPage = getItemsPerPage();
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        paginationDiv.classList.add('hidden');
        return;
    }

    paginationDiv.classList.remove('hidden');

    // 计算显示的页码范围
    const maxVisiblePages = getMaxVisiblePages();
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    let paginationHTML = '<div class="flex items-center justify-center gap-2 flex-wrap">';

    // 上一页按钮
    paginationHTML += `
        <button onclick="goToPage(${currentPage - 1})"
                class="px-3 py-2 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-indigo-500 rounded-lg transition-all duration-300 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'shadow-sm hover:shadow-md'}"
                ${currentPage === 1 ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
        </button>
    `;

    // 第一页
    if (startPage > 1) {
        paginationHTML += `
            <button onclick="goToPage(1)" class="px-3 py-2 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-indigo-500 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md">1</button>
        `;
        if (startPage > 2) {
            paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
        }
    }

    // 页码按钮
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="goToPage(${i})"
                    class="px-3 py-2 rounded-lg transition-all duration-300 ${i === currentPage ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md hover:shadow-lg' : 'bg-[#222] hover:bg-[#333] border border-[#333] hover:border-indigo-500 shadow-sm hover:shadow-md'}">
                ${i}
            </button>
        `;
    }

    // 最后一页
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
        }
        paginationHTML += `
            <button onclick="goToPage(${totalPages})" class="px-3 py-2 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-indigo-500 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md">${totalPages}</button>
        `;
    }

    // 下一页按钮
    paginationHTML += `
        <button onclick="goToPage(${currentPage + 1})"
                class="px-3 py-2 bg-[#222] hover:bg-[#333] border border-[#333] hover:border-indigo-500 rounded-lg transition-all duration-300 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'shadow-sm hover:shadow-md'}"
                ${currentPage === totalPages ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
        </button>
    `;

    // 快速跳转
    paginationHTML += `
        <div class="flex items-center gap-2 ml-4">
            <span class="text-sm text-gray-400">跳转到</span>
            <input type="number" id="pageJumpInput" min="1" max="${totalPages}"
                   class="w-16 px-2 py-1 bg-[#222] border border-[#333] focus:border-indigo-500 rounded-lg text-center text-sm transition-all duration-300 focus:outline-none focus:shadow-md"
                   onkeypress="if(event.key==='Enter') jumpToPage()">
            <button onclick="jumpToPage()" class="px-3 py-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-lg text-sm transition-all duration-300 shadow-md hover:shadow-lg">
                跳转
            </button>
        </div>
    `;

    paginationHTML += '</div>';

    // 显示当前页信息
    paginationHTML += `
        <div class="text-center text-sm text-gray-400 mt-3">
            第 <span class="text-white font-semibold">${currentPage}</span> / <span class="text-white font-semibold">${totalPages}</span> 页，共 <span class="text-white font-semibold">${totalItems}</span> 条结果
        </div>
    `;

    paginationDiv.innerHTML = paginationHTML;
}

// 跳转到指定页
function goToPage(page) {
    const itemsPerPage = getItemsPerPage();
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);

    if (page < 1 || page > totalPages || page === currentPage) return;

    currentPage = page;
    renderSearchResults(filteredResults);
    renderPagination(filteredResults.length);

    // 滚动到搜索结果顶部
    const resultsArea = document.getElementById('resultsArea');
    if (resultsArea) {
        resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 快速跳转到指定页
function jumpToPage() {
    const input = document.getElementById('pageJumpInput');
    if (!input) return;

    const page = parseInt(input.value);
    const itemsPerPage = getItemsPerPage();
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);

    if (isNaN(page) || page < 1 || page > totalPages) {
        showToast(`请输入 1-${totalPages} 之间的页码`, 'warning');
        return;
    }

    goToPage(page);
    input.value = '';
}

// 豆瓣模块懒加载函数 - 优化首屏加载速度
function lazyLoadDoubanModule() {
    const doubanArea = document.getElementById('doubanArea');
    if (!doubanArea) return;

    let doubanLoaded = false;

    // 初始化豆瓣模块
    function initDouban() {
        if (doubanLoaded) return;
        doubanLoaded = true;

        // 调用豆瓣模块的初始化函数
        if (typeof updateDoubanVisibility === 'function') {
            updateDoubanVisibility();
        }
    }

    // 使用Intersection Observer监听豆瓣区域
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    initDouban();
                    observer.disconnect();
                }
            });
        }, {
            rootMargin: '200px' // 提前200px开始加载
        });

        observer.observe(doubanArea);
    }

    // 备选方案：延迟2秒后自动加载
    setTimeout(() => {
        initDouban();
    }, 2000);
}

// 移除Node.js的require语句，因为这是在浏览器环境中运行的
