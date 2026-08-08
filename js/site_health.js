/**
 * 数据源测活模块
 * 访问首页即后台异步测活：每测通一个源立即自动勾选，不通的立即取消，不用等全部测完。
 * 未登录（代理鉴权缺失）时源判为"无法判定"，不改变其勾选状态，避免误伤。
 * 结果缓存到 localStorage（TTL 可配），设置面板可手动"重新测活"。
 */

const SITE_HEALTH_CONFIG = {
    cacheKey: 'siteHealthCache',   // 测活结果缓存 key
    ttl: 60 * 60 * 1000,           // 缓存有效期：1 小时（新鲜缓存直接复用，避免每次访问全量测活）
    concurrency: 8,                // 测活并发数
    timeout: 4000,                 // 单源测活超时（毫秒）
    testQuery: '热血'               // 测活搜索词（可命中绝大多数源）
};

// ---- 缓存 ----

function readHealthCache() {
    try {
        const cached = JSON.parse(localStorage.getItem(SITE_HEALTH_CONFIG.cacheKey) || 'null');
        return cached && Array.isArray(cached.ok) ? cached : null;
    } catch {
        return null;
    }
}

function writeHealthCache(ok) {
    localStorage.setItem(SITE_HEALTH_CONFIG.cacheKey, JSON.stringify({
        timestamp: Date.now(),
        ok: ok
    }));
}

// ---- 单源测活 ----
// 返回三态：true=可用 / false=不可用 / null=无法判定（代理鉴权缺失，未登录）

async function probeSite(apiUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SITE_HEALTH_CONFIG.timeout);
    try {
        const separator = apiUrl.includes('?') ? '&' : '?';
        const testUrl = apiUrl + separator + 'ac=videolist&wd=' + encodeURIComponent(SITE_HEALTH_CONFIG.testQuery);
        const rawProxied = PROXY_URL + encodeURIComponent(testUrl);
        const proxiedUrl = window.ProxyAuth?.addAuthToProxyUrl
            ? await window.ProxyAuth.addAuthToProxyUrl(rawProxied)
            : rawProxied;
        // 无鉴权 hash 时 addAuthToProxyUrl 原样返回，说明未登录，无法判定
        if (proxiedUrl === rawProxied) return null;
        const response = await fetch(proxiedUrl, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });
        if (response.status === 401) return null; // 鉴权失败视为无法判定
        if (!response.ok) return false;
        const data = await response.json();
        return !!(data && data.code === 1 && Array.isArray(data.list));
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// ---- 应用结果 ----

// 边测边勾：单个源结果立即生效（只更新对应复选框 + 计数，不重建整个列表）
function applyOne(key, alive) {
    const idx = selectedAPIs.indexOf(key);
    if (alive && idx === -1) {
        selectedAPIs.push(key);
    } else if (!alive && idx !== -1) {
        selectedAPIs.splice(idx, 1);
    } else {
        return; // 勾选状态无变化
    }
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    const checkbox = document.getElementById('api_' + key);
    if (checkbox) checkbox.checked = alive;
    if (window.updateSelectedApiCount) window.updateSelectedApiCount();
}

// 缓存场景：一次性全量应用（秒回）
function applyAll(okKeys) {
    const okSet = new Set(okKeys);
    // 保留用户自定义源（custom_*）的勾选，其余按测活结果决定
    const customSelected = (selectedAPIs || []).filter(key => key.startsWith('custom_'));
    selectedAPIs = [...customSelected, ...Object.keys(API_SITES).filter(key => okSet.has(key))];
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    if (window.initAPICheckboxes) window.initAPICheckboxes();
    if (window.updateSelectedApiCount) window.updateSelectedApiCount();
    updateHealthUI();
}

// ---- UI ----

function updateHealthUI({ checking = false } = {}) {
    const el = document.getElementById('siteHealthStatus');
    if (!el) return;
    if (checking) {
        el.textContent = '数据源测活中… 通过的将自动勾选';
        return;
    }
    const cached = readHealthCache();
    const total = Object.keys(API_SITES).length;
    if (!cached) {
        el.textContent = '尚未测活';
        return;
    }
    const updated = new Date(cached.timestamp).toLocaleString('zh-CN', { hour12: false });
    el.textContent = `可用 ${cached.ok.length}/${total} 个数据源 · 更新于 ${updated}`;
}

// ---- 主入口 ----

let running = false;

/**
 * 对全部数据源后台异步测活并边测边勾。force=true 忽略缓存强制全量测活。
 * @param {{force?:boolean}} [options]
 */
async function runHealthCheck({ force = false } = {}) {
    if (running) return;
    running = true;
    try {
        // 缓存分支：新鲜缓存直接复用结果（访问秒回）
        if (!force) {
            const cached = readHealthCache();
            if (cached && Date.now() - cached.timestamp < SITE_HEALTH_CONFIG.ttl) {
                applyAll(cached.ok);
                return { fromCache: true, ok: cached.ok };
            }
        }

        updateHealthUI({ checking: true });
        const keys = Object.keys(API_SITES);
        const ok = [];
        let judged = false; // 是否至少判定了一个源（避免未登录全 null 时写空缓存）
        for (let i = 0; i < keys.length; i += SITE_HEALTH_CONFIG.concurrency) {
            const batch = keys.slice(i, i + SITE_HEALTH_CONFIG.concurrency);
            const results = await Promise.all(batch.map(async key => ({
                key,
                alive: await probeSite(API_SITES[key].api)
            })));
            results.forEach(r => {
                if (r.alive === true) {
                    judged = true;
                    ok.push(r.key);
                    applyOne(r.key, true);
                } else if (r.alive === false) {
                    judged = true;
                    applyOne(r.key, false);
                }
                // null（无法判定）不改变勾选状态
            });
        }
        if (judged) writeHealthCache(ok);
        updateHealthUI();
        return { fromCache: false, ok };
    } finally {
        running = false;
    }
}

/** 设置面板"重新测活"按钮入口（强制全量） */
function recheck() {
    return runHealthCheck({ force: true });
}

// 暴露到全局
window.SiteHealth = {
    runHealthCheck,
    recheck,
    probeSite
};

// 访问首页即后台异步测活；登录成功（passwordVerified）后强制重测一次（此时鉴权可用，能正常判定）
document.addEventListener('DOMContentLoaded', function () {
    function start(force) {
        window.SiteHealth.runHealthCheck({ force }).catch(error => {
            console.warn('数据源测活失败:', error);
        });
    }
    start(false);
    document.addEventListener('passwordVerified', function () {
        start(true);
    });
});
