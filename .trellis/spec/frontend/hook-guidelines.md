# Hook Guidelines

> How reusable logic is structured in this project.

---

## Overview

**This project does NOT use React Hooks** (no `useState`, `useEffect`, `useContext`, etc.).

This is a **traditional JavaScript project** without a component framework. Instead of hooks, we use:

1. **Utility Classes** - For complex stateful logic (similar to custom hooks)
2. **Pure Functions** - For simple reusable operations
3. **Global Singletons** - For shared instances across the application

---

## Why No Hooks?

This project uses:
- **Pure JavaScript (ES6+)** - No React, Vue, or other frameworks
- **Multi-Page Application (MPA)** - Traditional HTML pages, not SPA
- **Direct DOM manipulation** - No virtual DOM or component lifecycle

**Hooks are a React-specific pattern** and don't apply to this architecture.

---

## Alternative Patterns

### Pattern 1: Utility Classes (Hook-like Reusable Logic)

**When to use**: Complex logic with state, lifecycle, or multiple related operations.

This is the **closest equivalent to custom hooks** in this project.

**Structure**:
```javascript
class FeatureManager {
    constructor(config) {
        this.state = {};
        this.config = config;
        this.init();
    }

    init() {
        // Setup logic (like useEffect on mount)
    }

    cleanup() {
        // Cleanup logic (like useEffect cleanup)
    }

    // Public methods
    doSomething() {
        // Logic
    }
}

// Create global instance
window.featureManager = new FeatureManager(config);
```

---

### Example 1: LazyImageLoader (Similar to useIntersectionObserver)

**Location**: `js/utils.js:342-472`

**Purpose**: Lazy load images when they enter viewport (like a `useIntersectionObserver` hook).

```javascript
// Image lazy loading class
class LazyImageLoader {
    constructor() {
        this.observer = null;
        this.loadingImages = new Map();
        this.isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.handleIntersection(entry.target);
                    }
                });
            }, {
                rootMargin: '50px'
            });
        }
    }

    async handleIntersection(img) {
        const originalSrc = img.dataset.src;
        if (!originalSrc) return;

        if (this.observer) {
            this.observer.unobserve(img);
        }

        // 1. Try to get from cache
        if (window.imageCacheManager) {
            const cached = window.imageCacheManager.get(originalSrc);
            if (cached) {
                img.src = cached;
                return;
            }
        }

        // 2. Load image
        let finalSrc = originalSrc;
        const needsAuth = img.dataset.needsAuth === 'true' || originalSrc.startsWith('/proxy/');

        if (needsAuth && window.ProxyAuth) {
            try {
                finalSrc = await window.ProxyAuth.addAuthToProxyUrl(originalSrc);
            } catch (e) {
                console.error('[LazyImageLoader] Auth failed:', e);
            }
        }

        img.src = finalSrc;
    }

    observe(img) {
        if (this.observer && img.dataset.src) {
            this.observer.observe(img);
        }
    }

    observeAll(selector = 'img[data-src]') {
        const images = document.querySelectorAll(selector);
        images.forEach(img => {
            this.observe(img);
        });
    }
}

// Global instance (like calling a hook at top level)
window.lazyImageLoader = new LazyImageLoader();
```

**Usage**:
```javascript
// In your page initialization
window.lazyImageLoader.observeAll('img[data-src]');

// Or for a single image
const img = document.createElement('img');
img.dataset.src = '/path/to/image.jpg';
window.lazyImageLoader.observe(img);
```

**React Hook Equivalent**:
```javascript
// This would be like:
const { observe, observeAll } = useIntersectionObserver({
    rootMargin: '50px'
});
```

---

### Example 2: StorageManager (Similar to useLocalStorage)

**Location**: `js/utils.js:54-166`

**Purpose**: Manage localStorage with debouncing and caching (like a `useLocalStorage` hook).

```javascript
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

    removeItem(key) {
        this.cache.delete(key);
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        localStorage.removeItem(key);
    }
}

// Global instance
window.storageManager = new StorageManager(1000);
```

**Usage**:
```javascript
// Set value (debounced)
window.storageManager.setItem('selectedAPIs', ['api1', 'api2']);

// Get value (cached)
const apis = window.storageManager.getItem('selectedAPIs');

// Remove value
window.storageManager.removeItem('selectedAPIs');
```

**React Hook Equivalent**:
```javascript
// This would be like:
const [apis, setApis] = useLocalStorage('selectedAPIs', ['api1', 'api2']);
```

---

### Pattern 2: Pure Functions (Simple Reusable Logic)

**When to use**: Simple, stateless operations that don't need lifecycle or internal state.

**Structure**:
```javascript
function doSomething(input) {
    // Process input
    return output;
}
```

---

### Example 3: URL Validation (Similar to a validation hook)

**Location**: `js/utils.js:19-28`

```javascript
// URL safety validation
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch (e) {
        return false;
    }
}
```

**Usage**:
```javascript
if (isValidImageUrl(imageUrl)) {
    img.src = imageUrl;
}
```

**React Hook Equivalent**:
```javascript
// This would be like:
const isValid = useValidateUrl(imageUrl);
```

---

### Example 4: HTML Escaping (Similar to useSanitize)

**Location**: `js/app.js:20-25`

```javascript
// HTML escape function to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

**Usage**:
```javascript
const safeTitle = escapeHtml(userInput);
element.innerHTML = `<h1>${safeTitle}</h1>`;
```

**React Hook Equivalent**:
```javascript
// This would be like:
const safeHtml = useSanitize(userInput);
```

---

### Pattern 3: Global Singletons (Shared State)

**When to use**: Shared functionality needed across multiple pages/modules.

**Structure**:
```javascript
// Create instance
const manager = new Manager();

// Expose globally
if (typeof window !== 'undefined') {
    window.manager = manager;
}
```

---

### Example 5: ConcurrentPool (Similar to useQueue)

**Location**: `js/utils.js:168-240`

**Purpose**: Limit concurrent async operations (like a `useQueue` or `useThrottle` hook).

```javascript
class ConcurrentPool {
    constructor(maxConcurrent = 3) {
        this.maxConcurrent = maxConcurrent;
        this.running = 0;
        this.queue = [];
    }

    async run(asyncFn) {
        while (this.running >= this.maxConcurrent) {
            await new Promise(resolve => this.queue.push(resolve));
        }

        this.running++;
        try {
            return await asyncFn();
        } finally {
            this.running--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

// Global instance
window.concurrentPool = new ConcurrentPool(3);
```

**Usage**:
```javascript
// Limit to 3 concurrent requests
const results = await Promise.all(
    urls.map(url =>
        window.concurrentPool.run(() => fetch(url))
    )
);
```

**React Hook Equivalent**:
```javascript
// This would be like:
const { enqueue } = useQueue({ maxConcurrent: 3 });
const results = await Promise.all(urls.map(url => enqueue(() => fetch(url))));
```

---

## Data Fetching Patterns

### Pattern: Async Functions with Error Handling

**Location**: `js/search.js:1-135`

```javascript
async function searchByAPIAndKeyWord(apiId, query) {
    try {
        // Setup
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const startTime = performance.now();

        // Fetch
        const response = await fetch(url, {
            headers: API_CONFIG.search.headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latency = Math.round(performance.now() - startTime);

        // Process
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();
        return { results: data.list || [], latency };

    } catch (error) {
        console.warn(`API ${apiId} search failed:`, error);
        return { results: [], latency: -1 };
    }
}
```

**Key features**:
- Timeout protection (AbortController)
- Performance measurement
- Graceful error handling
- Fallback values

**React Hook Equivalent**:
```javascript
// This would be like:
const { data, error, isLoading } = useFetch(url, {
    timeout: 8000,
    fallback: { results: [], latency: -1 }
});
```

---

## Naming Conventions

Since we don't have hooks, we use different naming patterns:

| Type | Convention | Example |
|------|------------|---------|
| Utility Class | `PascalCase` + descriptive suffix | `StorageManager`, `LazyImageLoader` |
| Pure Function | `camelCase` + verb | `isValidImageUrl()`, `escapeHtml()` |
| Async Function | `camelCase` + verb | `searchByAPIAndKeyWord()`, `fetchVideoDetails()` |
| Global Instance | `camelCase` + manager/loader suffix | `storageManager`, `lazyImageLoader` |

**No `use` prefix** - that's React-specific.

---

## When to Create a Utility Class vs Function

### Use a Class when:
- Logic has internal state (cache, timers, observers)
- Multiple related methods work together
- Need initialization/cleanup lifecycle
- Want to encapsulate complexity

**Examples**: `StorageManager`, `LazyImageLoader`, `ConcurrentPool`

### Use a Function when:
- Logic is stateless
- Single responsibility
- Simple input → output transformation
- No lifecycle needed

**Examples**: `isValidImageUrl()`, `escapeHtml()`, `searchByAPIAndKeyWord()`

---

## Common Mistakes

### ❌ Don't: Try to use React Hooks

```javascript
// Bad - This won't work!
import { useState, useEffect } from 'react';

function MyComponent() {
    const [count, setCount] = useState(0);
    // ...
}
```

**Why**: This project doesn't use React. Hooks don't exist here.

### ✅ Do: Use utility classes or global variables

```javascript
// Good - Use a class for stateful logic
class CounterManager {
    constructor() {
        this.count = 0;
    }

    increment() {
        this.count++;
        this.render();
    }

    render() {
        document.getElementById('count').textContent = this.count;
    }
}

window.counterManager = new CounterManager();
```

### ❌ Don't: Create a class for every small function

```javascript
// Bad - Overkill
class UrlValidator {
    validate(url) {
        return /^https?:\/\//.test(url);
    }
}
```

### ✅ Do: Use plain functions for simple logic

```javascript
// Good
function isValidUrl(url) {
    return /^https?:\/\//.test(url);
}
```

### ❌ Don't: Forget to create global instances

```javascript
// Bad - Class defined but not instantiated
class StorageManager {
    // ...
}
// How do other files use this?
```

### ✅ Do: Create and expose global instances

```javascript
// Good
class StorageManager {
    // ...
}

// Create global instance
if (typeof window !== 'undefined') {
    window.storageManager = new StorageManager(1000);
}
```

### ❌ Don't: Forget cleanup in classes with side effects

```javascript
// Bad
class EventManager {
    constructor() {
        document.addEventListener('click', this.handleClick);
        // Never cleaned up!
    }
}
```

### ✅ Do: Provide cleanup methods

```javascript
// Good
class EventManager {
    constructor() {
        this.handleClick = this.handleClick.bind(this);
        this.init();
    }

    init() {
        document.addEventListener('click', this.handleClick);
    }

    cleanup() {
        document.removeEventListener('click', this.handleClick);
    }
}
```

---

## Migration from React

If you're coming from React, here's how patterns translate:

| React Hook | This Project's Equivalent |
|------------|---------------------------|
| `useState` | Global variable or class property |
| `useEffect` | Class `init()` method or event listeners |
| `useContext` | Global variables via `window` object |
| `useRef` | Class property or `document.getElementById()` |
| `useMemo` | Class property with caching |
| `useCallback` | Bound class method |
| `useReducer` | Class with state management methods |
| `useLocalStorage` | `StorageManager` class |
| `useIntersectionObserver` | `LazyImageLoader` class |
| `useFetch` | Async function with error handling |
| `useDebounce` | `StorageManager` (debounced writes) |
| `useThrottle` | `ConcurrentPool` class |

---

## Summary

**Key Principle**: This project doesn't use hooks because it doesn't use React.

Instead:
- **Utility Classes** replace complex custom hooks
- **Pure Functions** replace simple custom hooks
- **Global Singletons** replace context/providers
- **Direct DOM manipulation** replaces component state

When adding new reusable logic:
1. **Simple logic** → Pure function
2. **Complex logic with state** → Utility class
3. **Shared across pages** → Global singleton

**Always ask**: "Is this simple enough for a function, or does it need a class?"
