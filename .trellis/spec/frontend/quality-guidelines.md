# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

**This project has NO automated quality tools configured** (no ESLint, Prettier, TypeScript, or test frameworks).

Quality is maintained through:
- **Manual code review**
- **Consistent patterns** documented in these specs
- **Error handling conventions**
- **Security best practices** (XSS prevention, input validation)
- **Performance optimizations** (debouncing, lazy loading, caching)

---

## Forbidden Patterns

### ❌ 1. Direct innerHTML with User Input (XSS Risk)

```javascript
// Bad - XSS vulnerability!
function displayUserName(name) {
    document.getElementById('userName').innerHTML = name;
    // If name = "<img src=x onerror=alert('XSS')>", code executes!
}
```

**Why forbidden**: Allows script injection attacks.

**Instead**: Use `textContent` or escape HTML.

```javascript
// Good - Safe from XSS
function displayUserName(name) {
    document.getElementById('userName').textContent = name;
}

// Or escape HTML if you need formatting
function displayUserName(name) {
    const escaped = escapeHtml(name);
    document.getElementById('userName').innerHTML = escaped;
}
```

**Reference**: See `js/app.js:20-25` for `escapeHtml()` implementation.

---

### ❌ 2. Synchronous localStorage Access in Loops

```javascript
// Bad - Blocks UI thread
for (let i = 0; i < 1000; i++) {
    localStorage.setItem(`item_${i}`, JSON.stringify(data[i]));
}
```

**Why forbidden**: Causes UI freezing and poor performance.

**Instead**: Use `StorageManager` with debouncing or batch operations.

```javascript
// Good - Debounced writes
for (let i = 0; i < 1000; i++) {
    window.storageManager.setItem(`item_${i}`, data[i]);
}
// Writes are automatically debounced
```

---

### ❌ 3. Missing Null Checks for DOM Elements

```javascript
// Bad - Crashes if element doesn't exist
function togglePanel() {
    const panel = document.getElementById('panel');
    panel.classList.toggle('show'); // TypeError if panel is null!
}
```

**Why forbidden**: Causes runtime errors.

**Instead**: Always check for null.

```javascript
// Good - Safe
function togglePanel() {
    const panel = document.getElementById('panel');
    if (!panel) return;
    panel.classList.toggle('show');
}
```

---

### ❌ 4. Unhandled Promise Rejections

```javascript
// Bad - Silent failures
async function fetchData() {
    const response = await fetch(url);
    const data = await response.json();
    return data;
}
```

**Why forbidden**: Errors are swallowed, making debugging impossible.

**Instead**: Always use try-catch with async/await.

```javascript
// Good - Proper error handling
async function fetchData() {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch failed:', error);
        return null; // Or throw, depending on use case
    }
}
```

---

### ❌ 5. Infinite Fetch Requests (No Timeout)

```javascript
// Bad - Can hang forever
async function search(query) {
    const response = await fetch(`/api/search?q=${query}`);
    return response.json();
}
```

**Why forbidden**: Network issues cause indefinite waiting.

**Instead**: Use AbortController with timeout.

```javascript
// Good - Timeout protection
async function search(query) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(`/api/search?q=${query}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.warn('Request timeout');
        }
        throw error;
    }
}
```

**Reference**: See `js/search.js:1-135` for complete pattern.

---

### ❌ 6. Memory Leaks from Event Listeners

```javascript
// Bad - Event listener never removed
function initFeature() {
    document.addEventListener('click', handleClick);
}
```

**Why forbidden**: Causes memory leaks, especially in SPAs or long-running pages.

**Instead**: Store reference and provide cleanup.

```javascript
// Good - Cleanup available
let clickHandler = null;

function initFeature() {
    clickHandler = (e) => handleClick(e);
    document.addEventListener('click', clickHandler);
}

function cleanupFeature() {
    if (clickHandler) {
        document.removeEventListener('click', clickHandler);
        clickHandler = null;
    }
}
```

---

### ❌ 7. Storing Sensitive Data in localStorage

```javascript
// Bad - Security risk!
localStorage.setItem('password', userPassword);
localStorage.setItem('apiKey', secretKey);
localStorage.setItem('creditCard', cardNumber);
```

**Why forbidden**: localStorage is accessible to all scripts and visible in DevTools.

**Instead**: Only store non-sensitive data.

```javascript
// Good - Only store flags/preferences
localStorage.setItem('passwordVerified', 'true'); // Boolean flag
localStorage.setItem('theme', 'dark'); // User preference
localStorage.setItem('selectedAPIs', JSON.stringify(apis)); // Public data
```

---

## Required Patterns

### ✅ 1. Error Handling in Async Functions

**Pattern**: Always wrap async operations in try-catch.

```javascript
async function fetchVideoDetails(videoId) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`/api/video/${videoId}`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Failed to fetch video details:', error);
        return null; // Graceful fallback
    }
}
```

**Reference**: See `js/api.js:34-254` for complete implementation.

---

### ✅ 2. XSS Prevention

**Pattern**: Escape user input before inserting into HTML.

```javascript
// HTML escape function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Usage
const safeTitle = escapeHtml(userInput);
element.innerHTML = `<h1>${safeTitle}</h1>`;
```

**Reference**: See `js/app.js:20-25`.

---

### ✅ 3. URL Validation

**Pattern**: Validate URLs before using them.

```javascript
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch (e) {
        return false;
    }
}

// Usage
if (isValidImageUrl(imageUrl)) {
    img.src = imageUrl;
} else {
    img.src = '/image/placeholder.png';
}
```

**Reference**: See `js/utils.js:19-28`.

---

### ✅ 4. Debouncing for Performance

**Pattern**: Debounce frequent operations (localStorage writes, API calls, etc.).

```javascript
class StorageManager {
    constructor(debounceTime = 1000) {
        this.debounceTime = debounceTime;
        this.timers = new Map();
    }

    setItem(key, value) {
        // Clear existing timer
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Set new timer
        const timer = setTimeout(() => {
            localStorage.setItem(key, JSON.stringify(value));
            this.timers.delete(key);
        }, this.debounceTime);

        this.timers.set(key, timer);
    }
}
```

**Reference**: See `js/utils.js:54-166`.

---

### ✅ 5. Lazy Loading for Performance

**Pattern**: Lazy load images and heavy resources.

```javascript
// HTML
<img data-src="/path/to/image.jpg" alt="Description">

// JavaScript
class LazyImageLoader {
    constructor() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    this.observer.unobserve(img);
                }
            });
        }, { rootMargin: '50px' });
    }

    observe(img) {
        if (img.dataset.src) {
            this.observer.observe(img);
        }
    }
}
```

**Reference**: See `js/utils.js:342-472`.

---

### ✅ 6. Null Checks for DOM Operations

**Pattern**: Always check if elements exist before manipulating them.

```javascript
function updateUI(elementId, content) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Element ${elementId} not found`);
        return;
    }
    element.textContent = content;
}
```

---

### ✅ 7. Default Values for localStorage

**Pattern**: Always provide fallback values when reading localStorage.

```javascript
// Good
const apis = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');
const settings = JSON.parse(localStorage.getItem('settings') || '{}');
const count = parseInt(localStorage.getItem('count') || '0', 10);
```

---

## Performance Guidelines

### 1. Minimize DOM Manipulation

**Bad**:
```javascript
// Triggers reflow 100 times
for (let i = 0; i < 100; i++) {
    const div = document.createElement('div');
    div.textContent = `Item ${i}`;
    container.appendChild(div); // Reflow!
}
```

**Good**:
```javascript
// Single reflow
const fragment = document.createDocumentFragment();
for (let i = 0; i < 100; i++) {
    const div = document.createElement('div');
    div.textContent = `Item ${i}`;
    fragment.appendChild(div);
}
container.appendChild(fragment); // One reflow
```

---

### 2. Use Event Delegation

**Bad**:
```javascript
// Attaches 100 event listeners
items.forEach(item => {
    item.addEventListener('click', handleClick);
});
```

**Good**:
```javascript
// Single event listener
container.addEventListener('click', (e) => {
    if (e.target.matches('.item')) {
        handleClick(e);
    }
});
```

---

### 3. Throttle Scroll/Resize Handlers

**Bad**:
```javascript
// Fires hundreds of times per second
window.addEventListener('scroll', handleScroll);
```

**Good**:
```javascript
// Throttled to ~60fps
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            handleScroll();
            ticking = false;
        });
        ticking = true;
    }
});
```

---

### 4. Limit localStorage Size

**Pattern**: Keep stored data under 5MB and limit array lengths.

```javascript
function addToHistory(item) {
    const history = getHistory();
    history.unshift(item);

    // Limit to 50 items
    if (history.length > 50) {
        history.splice(50);
    }

    localStorage.setItem('history', JSON.stringify(history));
}
```

**Reference**: See `js/ui.js:1033-1117`.

---

## Security Guidelines

### 1. Content Security Policy (CSP)

**Recommendation**: Add CSP headers to prevent XSS.

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline' cdn.tailwindcss.com;">
```

---

### 2. Input Validation

**Pattern**: Validate all user input.

```javascript
function validateSearchQuery(query) {
    if (!query || typeof query !== 'string') {
        return false;
    }
    if (query.length > 100) {
        return false; // Too long
    }
    if (/<script|javascript:/i.test(query)) {
        return false; // Suspicious content
    }
    return true;
}
```

---

### 3. Safe URL Construction

**Bad**:
```javascript
// Vulnerable to injection
const url = `/api/search?q=${userInput}`;
```

**Good**:
```javascript
// Properly encoded
const url = `/api/search?q=${encodeURIComponent(userInput)}`;
```

---

## Code Review Checklist

Before committing code, verify:

### Functionality
- [ ] Feature works as expected
- [ ] No console errors
- [ ] Tested on mobile and desktop
- [ ] Works in Chrome, Firefox, Safari

### Error Handling
- [ ] All async functions have try-catch
- [ ] All fetch calls have timeout protection
- [ ] All DOM queries check for null
- [ ] All localStorage reads have default values

### Security
- [ ] No XSS vulnerabilities (innerHTML with user input)
- [ ] No sensitive data in localStorage
- [ ] All URLs are validated
- [ ] All user input is escaped/validated

### Performance
- [ ] No synchronous localStorage in loops
- [ ] Images are lazy loaded
- [ ] Event listeners are cleaned up
- [ ] No unnecessary DOM manipulation

### Code Quality
- [ ] Follows existing patterns in codebase
- [ ] Functions are < 50 lines
- [ ] Variable names are descriptive
- [ ] Comments explain "why", not "what"

---

## Common Mistakes

### ❌ Mistake 1: Forgetting to Clear Timeouts

```javascript
// Bad
const timeoutId = setTimeout(() => controller.abort(), 8000);
await fetch(url, { signal: controller.signal });
// Timeout still fires even if fetch succeeds!
```

**Fix**:
```javascript
// Good
const timeoutId = setTimeout(() => controller.abort(), 8000);
try {
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId); // Clear on success
} catch (error) {
    clearTimeout(timeoutId); // Clear on error
    throw error;
}
```

---

### ❌ Mistake 2: Not Handling JSON Parse Errors

```javascript
// Bad
const data = JSON.parse(localStorage.getItem('data'));
// Crashes if data is corrupted!
```

**Fix**:
```javascript
// Good
try {
    const data = JSON.parse(localStorage.getItem('data') || '{}');
} catch (e) {
    console.error('Failed to parse data:', e);
    const data = {}; // Fallback
}
```

---

### ❌ Mistake 3: Mutating Arrays Without Saving

```javascript
// Bad
selectedAPIs.push('newAPI'); // Changed in memory
// Page reload - change is lost!
```

**Fix**:
```javascript
// Good
selectedAPIs.push('newAPI');
localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
```

---

### ❌ Mistake 4: Using == Instead of ===

```javascript
// Bad
if (value == '0') { ... } // true for 0, '0', false, '', null
```

**Fix**:
```javascript
// Good
if (value === '0') { ... } // Only true for '0'
```

---

### ❌ Mistake 5: Not Binding Event Handlers in Classes

```javascript
// Bad
class Manager {
    constructor() {
        document.addEventListener('click', this.handleClick);
        // 'this' is undefined in handleClick!
    }
    handleClick() {
        console.log(this); // undefined!
    }
}
```

**Fix**:
```javascript
// Good
class Manager {
    constructor() {
        this.handleClick = this.handleClick.bind(this);
        document.addEventListener('click', this.handleClick);
    }
    handleClick() {
        console.log(this); // Manager instance
    }
}
```

---

## Testing Guidelines

**Manual Testing Checklist**:

1. **Functionality**
   - Test happy path
   - Test edge cases (empty input, very long input)
   - Test error cases (network failure, invalid data)

2. **Browser Compatibility**
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Mobile browsers

3. **Responsive Design**
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

4. **Performance**
   - Check Network tab for unnecessary requests
   - Check Performance tab for long tasks
   - Check localStorage size

5. **Accessibility**
   - Keyboard navigation works
   - Screen reader friendly (ARIA attributes)
   - Focus indicators visible

---

## Summary

**Key Principles**:

1. **Security First** - Always escape user input, validate URLs, never store sensitive data
2. **Error Handling** - Every async operation needs try-catch and timeout
3. **Performance** - Debounce, lazy load, minimize DOM manipulation
4. **Null Safety** - Always check if DOM elements exist
5. **Consistency** - Follow existing patterns in the codebase

**Quality Mantra**: "If it can fail, handle it. If it's user input, escape it. If it's slow, optimize it."

**When in doubt**: Look at existing code in `js/utils.js`, `js/api.js`, or `js/ui.js` for examples.
