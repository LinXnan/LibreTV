// 每日一言功能模块

const DAILY_QUOTE_CONFIG = {
    enabledKey: 'dailyQuoteEnabled',
    apiUrl: 'https://v1.hitokoto.cn/?c=k&c=i&c=d&encode=json',
    timeout: 3000,
    refreshCooldown: 3000,
    typingSpeedNormal: 80,
    typingSpeedFast: 40,
    longTextThreshold: 50,
    fallbackQuotes: [
        { text: '走得慢没关系，别停下脚步。', from: '自勉' },
        { text: '坚持不是因为看到了希望，而是坚持了才有希望。', from: '自勉' },
        { text: '别让今天的懒惰成为明天的遗憾。', from: '自勉' }
    ]
};

let currentAbortController = null;
let currentRequestId = 0;
let typingAnimationController = null;
let lastRefreshTime = 0;
let refreshCooldownTimer = null;

function getDailyQuoteElements() {
    const section = document.getElementById('dailyQuoteSection');
    const text = document.getElementById('dailyQuoteText');
    const fromText = document.getElementById('dailyQuoteFromText');

    if (!section || !text || !fromText) {
        return null;
    }

    return { section, text, fromText };
}

function getFallbackQuote() {
    return DAILY_QUOTE_CONFIG.fallbackQuotes[
        Math.floor(Math.random() * DAILY_QUOTE_CONFIG.fallbackQuotes.length)
    ];
}

function isQuoteEnabled() {
    try {
        return localStorage.getItem(DAILY_QUOTE_CONFIG.enabledKey) === 'true';
    } catch (e) {
        return false;
    }
}

function stopTypingAnimation() {
    if (typingAnimationController) {
        typingAnimationController.abort();
        typingAnimationController = null;
    }
}

function clearClickRefreshState() {
    const elements = getDailyQuoteElements();
    if (!elements) return;

    const { section } = elements;

    if (refreshCooldownTimer) {
        clearTimeout(refreshCooldownTimer);
        refreshCooldownTimer = null;
    }

    section.classList.remove('daily-quote-cooldown', 'daily-quote-refreshing', 'daily-quote-pulse');
    section.removeAttribute('aria-disabled');
    section.removeAttribute('aria-busy');
    lastRefreshTime = 0;
}

function triggerPulse(section) {
    if (!section) return;
    section.classList.remove('daily-quote-pulse');
    void section.offsetWidth;
    section.classList.add('daily-quote-pulse');
    section.addEventListener('animationend', () => {
        section.classList.remove('daily-quote-pulse');
    }, { once: true });
}

function applyCooldownState(section) {
    if (!section) return;
    section.classList.add('daily-quote-cooldown');
    section.setAttribute('aria-disabled', 'true');

    if (refreshCooldownTimer) {
        clearTimeout(refreshCooldownTimer);
    }

    refreshCooldownTimer = setTimeout(() => {
        section.classList.remove('daily-quote-cooldown');
        section.removeAttribute('aria-disabled');
        refreshCooldownTimer = null;
    }, DAILY_QUOTE_CONFIG.refreshCooldown);
}

function handleClickRefresh(event) {
    const elements = getDailyQuoteElements();
    if (!elements) return;

    const { section, text } = elements;

    if (!isQuoteEnabled()) {
        return;
    }

    if (event && event.type === 'keydown') {
        if (event.repeat) {
            return;
        }

        const key = event.key;
        if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') {
            return;
        }
        event.preventDefault();
    }

    const selection = window.getSelection ? window.getSelection().toString() : '';
    if (selection) {
        return;
    }

    const now = Date.now();
    if (now - lastRefreshTime < DAILY_QUOTE_CONFIG.refreshCooldown) {
        if (!section.classList.contains('daily-quote-cooldown')) {
            applyCooldownState(section);
        }
        return;
    }

    if (currentAbortController !== null) {
        return;
    }

    stopTypingAnimation();
    text.textContent = '';
    text.classList.remove('typing-cursor');

    triggerPulse(section);
    lastRefreshTime = now;
    applyCooldownState(section);

    section.classList.add('daily-quote-refreshing');
    section.setAttribute('aria-busy', 'true');

    fetchDailyQuote({ showRefreshing: true });
}

function typeWriter(element, text, speed, shouldContinue, signal) {
    return new Promise((resolve) => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let resolved = false;
        let onAbort;

        const finish = () => {
            if (resolved) return;
            resolved = true;
            element.classList.remove('typing-cursor');
            if (signal && onAbort) {
                signal.removeEventListener('abort', onAbort);
            }
            resolve();
        };

        if (signal) {
            if (signal.aborted) {
                finish();
                return;
            }
            onAbort = () => finish();
            signal.addEventListener('abort', onAbort, { once: true });
        }

        if (prefersReducedMotion) {
            if (shouldContinue()) {
                element.textContent = text;
            }
            finish();
            return;
        }

        element.textContent = '';
        element.classList.add('typing-cursor');

        const chars = Array.from(text);
        let index = 0;

        const type = () => {
            if (!shouldContinue() || (signal && signal.aborted)) {
                finish();
                return;
            }

            if (index < chars.length) {
                element.textContent += chars[index];
                index++;
                setTimeout(type, speed);
            } else {
                finish();
            }
        };

        type();
    });
}

function renderDailyQuote(quote, requestId) {
    const elements = getDailyQuoteElements();
    if (!elements) return;

    const { section, text, fromText } = elements;

    if (!quote || !quote.text || !quote.text.trim()) {
        return;
    }

    if (requestId !== currentRequestId) {
        return;
    }

    const fromValue = (quote.from && quote.from.trim()) ? quote.from.trim() : '匿名';
    fromText.textContent = fromValue;

    const textLength = quote.text.length;
    const speed = textLength > DAILY_QUOTE_CONFIG.longTextThreshold
        ? DAILY_QUOTE_CONFIG.typingSpeedFast
        : DAILY_QUOTE_CONFIG.typingSpeedNormal;

    stopTypingAnimation();
    const controller = new AbortController();
    typingAnimationController = controller;

    const shouldContinue = () => (
        requestId === currentRequestId &&
        isQuoteEnabled() &&
        !controller.signal.aborted
    );

    typeWriter(text, quote.text, speed, shouldContinue, controller.signal).then(() => {
        if (shouldContinue()) {
            section.classList.remove('hidden');
            section.setAttribute('aria-hidden', 'false');
        }
        if (typingAnimationController === controller) {
            typingAnimationController = null;
        }
    });
}

async function fetchDailyQuote(options = {}) {
    const { showRefreshing = false } = options;
    const elements = getDailyQuoteElements();
    const section = elements ? elements.section : null;

    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }

    currentRequestId++;
    const requestId = currentRequestId;

    const controller = new AbortController();
    currentAbortController = controller;

    const timeoutId = setTimeout(() => {
        if (controller) {
            controller.abort();
        }
    }, DAILY_QUOTE_CONFIG.timeout);

    try {
        if (!window.ProxyAuth || typeof window.ProxyAuth.addAuthToProxyUrl !== 'function') {
            clearTimeout(timeoutId);
            renderDailyQuote(getFallbackQuote(), requestId);
            return;
        }

        if (typeof PROXY_URL === 'undefined') {
            clearTimeout(timeoutId);
            renderDailyQuote(getFallbackQuote(), requestId);
            return;
        }

        const proxyUrl = await window.ProxyAuth.addAuthToProxyUrl(
            PROXY_URL + encodeURIComponent(DAILY_QUOTE_CONFIG.apiUrl)
        );

        const response = await fetch(proxyUrl, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (requestId !== currentRequestId) {
            return;
        }

        if (data && typeof data.hitokoto === 'string' && data.hitokoto.trim()) {
            renderDailyQuote({
                text: data.hitokoto.trim(),
                from: data.from || ''
            }, requestId);
        } else {
            throw new Error('Invalid data format');
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (requestId === currentRequestId) {
            renderDailyQuote(getFallbackQuote(), requestId);
        }
    } finally {
        if (currentAbortController === controller) {
            currentAbortController = null;
        }
        if (showRefreshing && section) {
            section.classList.remove('daily-quote-refreshing');
            section.removeAttribute('aria-busy');
        }
    }
}

function updateDailyQuoteVisibility() {
    const elements = getDailyQuoteElements();
    if (!elements) return;

    const { section } = elements;

    if (!isQuoteEnabled()) {
        section.classList.add('hidden');
        section.setAttribute('aria-hidden', 'true');
        clearClickRefreshState();
        stopTypingAnimation();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
    } catch (e) {
        return;
    }

    if (localStorage.getItem(DAILY_QUOTE_CONFIG.enabledKey) === null) {
        localStorage.setItem(DAILY_QUOTE_CONFIG.enabledKey, 'true');
    }

    const toggle = document.getElementById('dailyQuoteToggle');
    const isEnabled = isQuoteEnabled();

    if (toggle) {
        toggle.checked = isEnabled;
        toggle.addEventListener('change', function (e) {
            try {
                const newValue = e.target.checked ? 'true' : 'false';
                localStorage.setItem(DAILY_QUOTE_CONFIG.enabledKey, newValue);
            } catch (error) {
                return;
            }

            updateDailyQuoteVisibility();

            if (e.target.checked) {
                fetchDailyQuote();
            } else {
                currentRequestId++;
                if (currentAbortController) {
                    currentAbortController.abort();
                    currentAbortController = null;
                }
                stopTypingAnimation();
                clearClickRefreshState();
            }
        });
    }

    const elements = getDailyQuoteElements();
    if (elements && elements.section) {
        elements.section.addEventListener('click', handleClickRefresh);
        elements.section.addEventListener('keydown', handleClickRefresh);
    }

    updateDailyQuoteVisibility();
    if (isEnabled) {
        fetchDailyQuote();
    }
});

window.updateDailyQuoteVisibility = updateDailyQuoteVisibility;
