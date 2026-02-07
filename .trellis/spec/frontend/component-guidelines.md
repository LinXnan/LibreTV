# Component Guidelines

> How "components" are built in this project.

---

## Overview

**This project does NOT use a component framework** (no React, Vue, Angular, etc.).

Instead, it uses:
- **Utility Classes** - For complex, stateful logic (e.g., `StorageManager`, `LazyImageLoader`)
- **Pure Functions** - For UI operations and event handling (e.g., `toggleSettings()`, `showToast()`)
- **Global Variables** - For application state (e.g., `selectedAPIs`, `currentEpisodeIndex`)

Think of "components" as **reusable modules** rather than framework components.

---

## Component Patterns

### Pattern 1: Utility Classes (Stateful Logic)

**When to use**: Complex logic with internal state, lifecycle, or multiple related methods.

**Structure**:
```javascript
class UtilityName {
    constructor(config) {
        // Initialize state
        this.property = config.property;
        this.cache = new Map();
    }

    method1() {
        // Implementation
    }

    method2() {
        // Implementation
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.utilityName = new UtilityName(config);
}
```

**Example**: `StorageManager` class

**Location**: `js/utils.js:54-166`

```javascript
// localStorage management with debouncing and quota management
class StorageManager {
    constructor(debounceTime = 1000) {
        this.debounceTime = debounceTime;
        this.timers = new Map();
        this.cache = new Map();
        this.MAX_SIZE = 5 * 1024 * 1024;
        this.MIN_RECORDS = 10;
    }

    setItem(key, value) {
        this.cache.set(key, value);
        // Debounced write
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        const timer = setTimeout(() => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                this.timers.delete(key);
            } catch (e) {
                console.error('localStorage write error:', e);
            }
        }, this.debounceTime);
        this.timers.set(key, timer);
    }

    getItem(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        try {
            const value = localStorage.getItem(key);
            const parsed = value ? JSON.parse(value) : null;
            this.cache.set(key, parsed);
            return parsed;
        } catch (e) {
            console.error('localStorage read error:', e);
            return null;
        }
    }

    // ... more methods
}

// Global instance
window.storageManager = new StorageManager(1000);
```

**Why this pattern**:
- Encapsulates complex state (cache, timers)
- Provides clean API for other modules
- Singleton pattern via global instance

---

### Pattern 2: Pure Functions (UI Operations)

**When to use**: Stateless operations, event handlers, DOM manipulation.

**Structure**:
```javascript
function actionName(params) {
    // Get DOM elements
    const element = document.getElementById('elementId');

    // Perform operation
    element.classList.toggle('active');

    // Optional: trigger side effects
    saveToLocalStorage(params);
}
```

**Example**: `toggleSettings()` function

**Location**: `js/ui.js:2-38`

```javascript
// UI-related functions
function toggleSettings(e) {
    // Password protection check
    try {
        if (window.ensurePasswordProtection) {
            window.ensurePasswordProtection();
        }
    } catch (error) {
        console.warn('Password protection check failed:', error.message);
        return;
    }

    // Prevent event bubbling
    e && e.stopPropagation();
    const panel = document.getElementById('settingsPanel');
    if (!panel) return;

    const triggerElement = e?.currentTarget || document.activeElement;

    // Mobile: use enhanced open/close
    if (window.innerWidth <= 640) {
        if (panel.classList.contains('show')) {
            window.closePanel && window.closePanel(panel);
        } else {
            window.openPanel && window.openPanel(panel, triggerElement);
        }
    } else {
        // Desktop: simple toggle
        panel.classList.toggle('show');
    }
}
```

**Why this pattern**:
- Simple, easy to understand
- No framework overhead
- Direct DOM manipulation

---

### Pattern 3: Async API Functions

**When to use**: Data fetching, API calls, asynchronous operations.

**Structure**:
```javascript
async function fetchDataName(params) {
    try {
        // Setup
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Fetch
        const response = await fetch(url, {
            headers: headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Process
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();
        return processData(data);

    } catch (error) {
        console.error('Fetch error:', error);
        return fallbackValue;
    }
}
```

**Example**: `searchByAPIAndKeyWord()` function

**Location**: `js/search.js:1-135`

```javascript
async function searchByAPIAndKeyWord(apiId, query) {
    try {
        let apiUrl, apiName, apiBaseUrl;

        // Handle custom API
        if (apiId.startsWith('custom_')) {
            const customIndex = apiId.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) return { results: [], latency: -1 };

            apiBaseUrl = customApi.url;
            apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
            apiName = customApi.name;
        } else {
            // Built-in API
            if (!API_SITES[apiId]) return { results: [], latency: -1 };
            apiBaseUrl = API_SITES[apiId].api;
            apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
            apiName = API_SITES[apiId].name;
        }

        // Measure latency
        const startTime = performance.now();

        // Timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(proxiedUrl, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latency = Math.round(performance.now() - startTime);

        // Process response
        const data = await response.json();
        const results = data.list || [];

        return { results, latency };
    } catch (error) {
        console.warn(`API ${apiId} search failed:`, error);
        return { results: [], latency: -1 };
    }
}
```

**Why this pattern**:
- Timeout protection prevents hanging requests
- Graceful error handling with fallback values
- Performance measurement built-in

---

## "Props" Conventions

Since there's no component framework, data is passed via:

### 1. Function Parameters

```javascript
function renderVideoCard(videoInfo) {
    const { title, pic, type_name, vod_id } = videoInfo;
    // Use the data
}
```

### 2. Global Variables

```javascript
// In app.js
let selectedAPIs = ['tyyszy', 'dyttzy'];
let currentEpisodeIndex = 0;

// In other files
function playNextEpisode() {
    currentEpisodeIndex++;
    // Use global state
}
```

### 3. LocalStorage (Persistent State)

```javascript
// Write
localStorage.setItem('selectedAPIs', JSON.stringify(apis));

// Read
const apis = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
```

### 4. Data Attributes (DOM-based)

```html
<img data-src="/image.jpg" data-needs-auth="true">
```

```javascript
const needsAuth = img.dataset.needsAuth === 'true';
const src = img.dataset.src;
```

---

## Styling Patterns

### Tailwind CSS (via CDN)

**Primary approach**: Use Tailwind utility classes in HTML.

```html
<div class="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
    <span class="text-lg font-semibold">Title</span>
    <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Click
    </button>
</div>
```

### Custom CSS (for complex patterns)

**When Tailwind isn't enough**: Create custom classes in CSS files.

```css
/* In modals.css */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
}

.modal-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
    transition: transform 0.3s ease;
}

.modal-panel.show {
    transform: translateY(0);
}
```

### Responsive Design

**Mobile-first approach**: Base styles for mobile, override for desktop.

```css
/* Mobile (default) */
.settings-panel {
    position: fixed;
    bottom: 0;
    width: 100%;
}

/* Desktop (640px+) */
@media (min-width: 640px) {
    .settings-panel {
        position: absolute;
        top: 100%;
        right: 0;
        width: 300px;
    }
}
```

---

## Accessibility

### Keyboard Navigation

**Always support keyboard events** alongside mouse events.

```javascript
// Support both click and Enter key
element.addEventListener('click', handleAction);
element.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAction(e);
    }
});
```

### Focus Management

**Trap focus in modals** to prevent keyboard navigation outside.

**Example**: `js/mobile-panel-gestures.js:1-81`

```javascript
function trapFocus(panel) {
    const focusableElements = panel.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    panel.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });
}
```

### ARIA Attributes

**Use ARIA attributes** for screen readers.

```html
<button
    aria-label="Close settings panel"
    aria-expanded="false"
    onclick="toggleSettings(event)">
    ×
</button>
```

---

## Common Mistakes

### ❌ Don't: Create classes for simple one-off functions

```javascript
// Bad
class ToastManager {
    show(message) {
        // 5 lines of code
    }
}
window.toastManager = new ToastManager();
```

**Why**: Overkill for simple operations. Use a plain function instead.

### ✅ Do: Use plain functions for simple operations

```javascript
// Good
function showToast(message) {
    // 5 lines of code
}
```

### ❌ Don't: Forget to check if DOM elements exist

```javascript
// Bad
function togglePanel() {
    const panel = document.getElementById('panel');
    panel.classList.toggle('show'); // Error if panel is null!
}
```

### ✅ Do: Always check for null

```javascript
// Good
function togglePanel() {
    const panel = document.getElementById('panel');
    if (!panel) return;
    panel.classList.toggle('show');
}
```

### ❌ Don't: Pollute global scope unnecessarily

```javascript
// Bad - in utils.js
function helperFunction1() { ... }
function helperFunction2() { ... }
function helperFunction3() { ... }
// All become global
```

### ✅ Do: Only expose what's needed

```javascript
// Good - in utils.js
class UtilityManager {
    #privateHelper() { ... }  // Private

    publicMethod() {          // Public
        this.#privateHelper();
    }
}

window.utilityManager = new UtilityManager();
```

### ❌ Don't: Forget to clean up event listeners

```javascript
// Bad
function initFeature() {
    document.addEventListener('click', handler);
    // Never removed!
}
```

### ✅ Do: Clean up when appropriate

```javascript
// Good
let clickHandler = null;

function initFeature() {
    clickHandler = (e) => { ... };
    document.addEventListener('click', clickHandler);
}

function cleanupFeature() {
    if (clickHandler) {
        document.removeEventListener('click', clickHandler);
        clickHandler = null;
    }
}
```

### ❌ Don't: Make entire block-level elements clickable

```javascript
// Bad - Entire line is clickable (including whitespace)
<div class="cursor-pointer" onclick="handleClick()">
    <p>Click me</p>
</div>
```

**Why**: Block-level elements (`<div>`, `<p>`) default to `width: 100%`, making the entire line clickable including empty space. This creates poor UX.

### ✅ Do: Make only the content clickable

```javascript
// Good - Only text is clickable
<div class="text-center">
    <p class="cursor-pointer inline-block" onclick="handleClick()">
        Click me
    </p>
</div>
```

**Key points**:
- Use `inline-block` to make element width fit content
- Add `cursor-pointer` only to clickable elements
- Keep parent container for layout (centering, spacing)

**Example**: `index.html:305-313` (daily quote click area)

---

## Summary

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Utility Class** | Complex stateful logic | `StorageManager`, `LazyImageLoader` |
| **Pure Function** | UI operations, event handlers | `toggleSettings()`, `showToast()` |
| **Async Function** | API calls, data fetching | `searchByAPIAndKeyWord()` |
| **Global Variable** | Application state | `selectedAPIs`, `currentEpisodeIndex` |
| **LocalStorage** | Persistent state | User preferences, history |

**Key Principle**: Keep it simple. Use the simplest pattern that solves the problem.
