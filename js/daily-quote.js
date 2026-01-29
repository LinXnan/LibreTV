// 每日一言功能模块

const DAILY_QUOTE_CONFIG = {
    enabledKey: 'dailyQuoteEnabled',
    apiUrl: 'https://v1.hitokoto.cn/?c=k&c=i&c=d&encode=json',
    timeout: 3000,
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

function getDailyQuoteElements() {
    const section = document.getElementById('dailyQuoteSection');
    const text = document.getElementById('dailyQuoteText');
    const from = document.getElementById('dailyQuoteFrom');

    if (!section || !text || !from) {
        return null;
    }

    return { section, text, from };
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

function typeWriter(element, text, speed, shouldContinue) {
    return new Promise((resolve) => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            if (shouldContinue()) {
                element.textContent = text;
            }
            resolve();
            return;
        }

        element.textContent = '';
        element.classList.add('typing-cursor');

        const chars = Array.from(text);
        let index = 0;

        const type = () => {
            if (!shouldContinue()) {
                element.classList.remove('typing-cursor');
                resolve();
                return;
            }

            if (index < chars.length) {
                element.textContent += chars[index];
                index++;
                setTimeout(type, speed);
            } else {
                element.classList.remove('typing-cursor');
                resolve();
            }
        };

        type();
    });
}

function renderDailyQuote(quote, requestId) {
    const elements = getDailyQuoteElements();
    if (!elements) return;

    const { section, text, from } = elements;

    if (!quote || !quote.text || !quote.text.trim()) {
        return;
    }

    if (requestId !== currentRequestId) {
        return;
    }

    const fromText = (quote.from && quote.from.trim()) ? quote.from.trim() : '匿名';
    from.textContent = fromText;

    const textLength = quote.text.length;
    const speed = textLength > DAILY_QUOTE_CONFIG.longTextThreshold
        ? DAILY_QUOTE_CONFIG.typingSpeedFast
        : DAILY_QUOTE_CONFIG.typingSpeedNormal;

    const shouldContinue = () => requestId === currentRequestId && isQuoteEnabled();

    typeWriter(text, quote.text, speed, shouldContinue).then(() => {
        if (shouldContinue()) {
            section.classList.remove('hidden');
            section.setAttribute('aria-hidden', 'false');
        }
    });
}

async function fetchDailyQuote() {
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

    if (!window.ProxyAuth || typeof window.ProxyAuth.addAuthToProxyUrl !== 'function') {
        clearTimeout(timeoutId);
        renderDailyQuote(getFallbackQuote(), requestId);
        if (currentAbortController === controller) {
            currentAbortController = null;
        }
        return;
    }

    if (typeof PROXY_URL === 'undefined') {
        clearTimeout(timeoutId);
        renderDailyQuote(getFallbackQuote(), requestId);
        if (currentAbortController === controller) {
            currentAbortController = null;
        }
        return;
    }

    try {
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
    }
}

function updateDailyQuoteVisibility() {
    const elements = getDailyQuoteElements();
    if (!elements) return;

    const { section } = elements;

    if (!isQuoteEnabled()) {
        section.classList.add('hidden');
        section.setAttribute('aria-hidden', 'true');
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
            }
        });
    }

    updateDailyQuoteVisibility();
    if (isEnabled) {
        fetchDailyQuote();
    }
});

window.updateDailyQuoteVisibility = updateDailyQuoteVisibility;
