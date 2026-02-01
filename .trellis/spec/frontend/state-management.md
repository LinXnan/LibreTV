# State Management

> How state is managed in this project.

---

## Overview

**This project does NOT use a state management library** (no Redux, Zustand, MobX, etc.).

State management approach:
- **LocalStorage** - For persistent state (user preferences, history)
- **Global Variables** - For runtime application state
- **DOM State** - For UI state (classes, attributes)
- **No reactive system** - Manual UI updates when state changes

---

## State Categories

### 1. Persistent State (LocalStorage)

**When to use**: Data that should survive page reloads.

**Examples**:
- User preferences (selected APIs, settings)
- Viewing history
- Search history
- Password verification status

**Pattern**:
```javascript
// Write
localStorage.setItem('key', JSON.stringify(value));

// Read
const value = JSON.parse(localStorage.getItem('key') || 'defaultValue');
```

**Best Practice**: Use `StorageManager` for optimized access.

---

### 2. Runtime State (Global Variables)

**When to use**: Temporary state needed across functions/modules.

**Examples**:
- Current video being played
- Current episode index
- Search results
- API selection state

**Pattern**:
```javascript
// In app.js or relevant module
let currentEpisodeIndex = 0;
let currentVideoTitle = '';
let episodesReversed = false;
```

---

### 3. UI State (DOM)

**When to use**: Visual state tied to specific elements.

**Examples**:
- Modal open/closed state
- Panel visibility
- Button active state
- Loading indicators

**Pattern**:
```javascript
// CSS classes
element.classList.add('show');
element.classList.remove('show');
element.classList.toggle('active');

// Data attributes
element.dataset.loading = 'true';
element.setAttribute('aria-expanded', 'true');
```

---

## Persistent State Patterns

### Pattern 1: Using StorageManager (Recommended)

**Location**: `js/utils.js:54-166`

**Why**: Provides debouncing, caching, and quota management.

```javascript
// Write (debounced)
window.storageManager.setItem('selectedAPIs', ['api1', 'api2']);

// Read (cached)
const apis = window.storageManager.getItem('selectedAPIs');

// Remove
window.storageManager.removeItem('selectedAPIs');
```

**Benefits**:
- Automatic debouncing (reduces write frequency)
- In-memory cache (faster reads)
- Quota management (prevents storage overflow)
- Error handling built-in

---

### Pattern 2: Direct localStorage (Simple Cases)

**When to use**: One-time reads/writes, no performance concerns.

```javascript
// Write
localStorage.setItem('passwordVerified', 'true');

// Read
const isVerified = localStorage.getItem('passwordVerified') === 'true';

// Remove
localStorage.removeItem('passwordVerified');
```

---

### Example 1: User Preferences

**Location**: `js/app.js:1-34`

```javascript
// Load selected APIs from localStorage
let selectedAPIs = JSON.parse(
    localStorage.getItem('selectedAPIs') || '["tyyszy","dyttzy", "bfzy", "ruyi"]'
);

// Load custom APIs
let customAPIs = JSON.parse(
    localStorage.getItem('customAPIs') || '[]'
).map(normalizeCustomAPI);

// Save when changed
function updateSelectedAPIs(newAPIs) {
    selectedAPIs = newAPIs;
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
}
```

---

### Example 2: Viewing History

**Location**: `js/ui.js:1033-1117`

```javascript
// Add to viewing history
function addToViewingHistory(videoInfo) {
    try {
        const history = getViewingHistory();

        // Find existing record
        const existingIndex = history.findIndex(item =>
            item.title === videoInfo.title &&
            item.sourceName === videoInfo.sourceName &&
            item.showIdentifier === videoInfo.showIdentifier
        );

        if (existingIndex !== -1) {
            // Update existing record
            const existingItem = history[existingIndex];
            existingItem.episodeIndex = videoInfo.episodeIndex;
            existingItem.timestamp = Date.now();
            existingItem.playbackPosition = videoInfo.playbackPosition > 10
                ? videoInfo.playbackPosition
                : (existingItem.playbackPosition || 0);

            history.splice(existingIndex, 1);
            history.unshift(existingItem);
        } else {
            // Create new record
            const newItem = {
                ...videoInfo,
                timestamp: Date.now()
            };
            history.unshift(newItem);
        }

        // Limit to 50 items
        if (history.length > 50) {
            history.splice(50);
        }

        // Save to localStorage
        localStorage.setItem('viewingHistory', JSON.stringify(history));
    } catch (e) {
        console.error('Failed to save viewing history:', e);
    }
}

// Get viewing history
function getViewingHistory() {
    try {
        return JSON.parse(localStorage.getItem('viewingHistory') || '[]');
    } catch (e) {
        console.error('Failed to load viewing history:', e);
        return [];
    }
}
```

**Key features**:
- Deduplication (one record per video)
- Timestamp tracking
- Size limit (50 items)
- Error handling

---

## Runtime State Patterns

### Pattern 1: Global Variables in app.js

**Location**: `js/app.js:1-34`

```javascript
// Global state variables
let selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '["tyyszy","dyttzy", "bfzy", "ruyi"]');
let customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]').map(normalizeCustomAPI);

// Current playback state
let currentEpisodeIndex = 0;
let currentEpisodes = [];
let currentVideoTitle = '';
let episodesReversed = false;
```

**Usage across files**:
```javascript
// In player.js
function playNextEpisode() {
    currentEpisodeIndex++;
    if (currentEpisodeIndex < currentEpisodes.length) {
        playEpisode(currentEpisodes[currentEpisodeIndex]);
    }
}
```

**Why global variables**:
- Simple and direct
- No framework overhead
- Easy to debug (visible in console)
- Works across multiple pages

---

### Pattern 2: Configuration Constants

**Location**: `js/config.js:1-118`

```javascript
// Global constants (read-only state)
const PROXY_URL = '/proxy/';
const SEARCH_HISTORY_KEY = 'videoSearchHistory';
const MAX_HISTORY_ITEMS = 5;

// Password protection config
const PASSWORD_CONFIG = {
    localStorageKey: 'passwordVerified',
    verificationTTL: 90 * 24 * 60 * 60 * 1000  // 90 days
};

// Site config
const SITE_CONFIG = {
    name: 'LibreTV',
    url: 'https://libretv.is-an.org',
    description: '免费在线视频搜索与观看平台',
    logo: 'image/logo.png',
    version: '1.0.3'
};

// API sites
const API_SITES = {
    tyyszy: {
        name: '太阳资源',
        api: 'https://api.example.com',
        // ...
    },
    // ...
};

// Player config
const PLAYER_CONFIG = {
    autoplay: true,
    allowFullscreen: true,
    width: '100%',
    height: '600',
    timeout: 15000,
    filterAds: true,
    autoPlayNext: true,
    adFilteringEnabled: true,
    adFilteringStorage: 'adFilteringEnabled'
};
```

**Why separate config file**:
- Single source of truth
- Easy to modify settings
- No logic mixed with configuration
- Can be loaded first (via `defer` order)

---

## UI State Patterns

### Pattern 1: CSS Classes for Visibility

```javascript
// Show/hide modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('show');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('show');
}

// Toggle panel
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.toggle('show');
}
```

**CSS**:
```css
.modal {
    display: none;
}

.modal.show {
    display: block;
}
```

---

### Pattern 2: Data Attributes for State

```javascript
// Set loading state
button.dataset.loading = 'true';
button.disabled = true;

// Check loading state
if (button.dataset.loading === 'true') {
    return; // Already loading
}

// Clear loading state
delete button.dataset.loading;
button.disabled = false;
```

**CSS**:
```css
button[data-loading="true"] {
    opacity: 0.5;
    cursor: not-allowed;
}

button[data-loading="true"]::after {
    content: "...";
    animation: loading 1s infinite;
}
```

---

### Pattern 3: ARIA Attributes for Accessibility

```javascript
// Toggle expanded state
function toggleAccordion(button, panel) {
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', !isExpanded);
    panel.classList.toggle('show');
}
```

---

## When to Use Global State

### ✅ Use Global State When:

1. **Multiple pages need the same data**
   - Example: `selectedAPIs` used in index.html, player.html, watch.html

2. **State needs to persist across page navigation**
   - Example: User preferences, viewing history

3. **Multiple functions need to coordinate**
   - Example: `currentEpisodeIndex` used by play, next, previous functions

4. **Configuration shared across modules**
   - Example: `API_SITES`, `PLAYER_CONFIG`

### ❌ Don't Use Global State When:

1. **State is only used in one function**
   - Use local variables instead

2. **State is temporary UI state**
   - Use DOM state (classes, attributes) instead

3. **State is derived from other state**
   - Calculate on-demand instead of storing

---

## State Update Patterns

### Pattern 1: Direct Update + Manual UI Refresh

```javascript
// Update state
currentEpisodeIndex = 5;

// Manually update UI
document.getElementById('episodeNumber').textContent = currentEpisodeIndex + 1;
```

**Why**: No reactive system, so UI updates must be explicit.

---

### Pattern 2: Update Function with Side Effects

```javascript
function setCurrentEpisode(index) {
    // Update state
    currentEpisodeIndex = index;

    // Update UI
    updateEpisodeDisplay();

    // Save to history
    savePlaybackPosition();

    // Update URL
    updateURLParams();
}
```

**Why**: Encapsulates all side effects in one place.

---

### Pattern 3: Event-Driven Updates

```javascript
// Dispatch custom event when state changes
function updateSelectedAPIs(newAPIs) {
    selectedAPIs = newAPIs;
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    // Notify listeners
    window.dispatchEvent(new CustomEvent('apisChanged', {
        detail: { apis: selectedAPIs }
    }));
}

// Listen for changes
window.addEventListener('apisChanged', (e) => {
    console.log('APIs changed:', e.detail.apis);
    refreshSearchResults();
});
```

**Why**: Decouples state updates from UI updates.

---

## Common Mistakes

### ❌ Don't: Forget to parse/stringify localStorage

```javascript
// Bad
localStorage.setItem('apis', ['api1', 'api2']); // Stores "[object Object]"
const apis = localStorage.getItem('apis'); // Returns string, not array
```

### ✅ Do: Always JSON.stringify/parse

```javascript
// Good
localStorage.setItem('apis', JSON.stringify(['api1', 'api2']));
const apis = JSON.parse(localStorage.getItem('apis') || '[]');
```

---

### ❌ Don't: Forget default values

```javascript
// Bad
const apis = JSON.parse(localStorage.getItem('apis')); // null if not set
apis.forEach(...); // Error: Cannot read property 'forEach' of null
```

### ✅ Do: Provide fallback defaults

```javascript
// Good
const apis = JSON.parse(localStorage.getItem('apis') || '[]');
apis.forEach(...); // Works even if not set
```

---

### ❌ Don't: Store sensitive data in localStorage

```javascript
// Bad
localStorage.setItem('password', userPassword); // Visible in DevTools!
localStorage.setItem('apiKey', secretKey); // Accessible to all scripts!
```

### ✅ Do: Only store non-sensitive data

```javascript
// Good
localStorage.setItem('passwordVerified', 'true'); // Boolean flag only
localStorage.setItem('theme', 'dark'); // User preference
```

---

### ❌ Don't: Update state without updating UI

```javascript
// Bad
function selectAPI(apiId) {
    selectedAPIs.push(apiId); // State updated
    // UI not updated - user sees stale data!
}
```

### ✅ Do: Update UI after state changes

```javascript
// Good
function selectAPI(apiId) {
    selectedAPIs.push(apiId);
    renderAPIList(); // Update UI
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs)); // Persist
}
```

---

### ❌ Don't: Mutate state directly without saving

```javascript
// Bad
selectedAPIs.push('newAPI'); // State changed in memory
// Page reload - change is lost!
```

### ✅ Do: Save to localStorage after mutations

```javascript
// Good
selectedAPIs.push('newAPI');
localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
```

---

### ❌ Don't: Exceed localStorage quota

```javascript
// Bad
function addToHistory(item) {
    history.push(item); // Grows forever
    localStorage.setItem('history', JSON.stringify(history)); // Eventually fails
}
```

### ✅ Do: Limit stored data size

```javascript
// Good
function addToHistory(item) {
    history.unshift(item);
    if (history.length > 50) {
        history.splice(50); // Keep only 50 items
    }
    localStorage.setItem('history', JSON.stringify(history));
}
```

---

## State Debugging

### Check State in Console

```javascript
// View global state
console.log('Selected APIs:', selectedAPIs);
console.log('Current episode:', currentEpisodeIndex);
console.log('Episodes:', currentEpisodes);

// View localStorage
console.log('Storage:', localStorage);
console.log('Viewing history:', JSON.parse(localStorage.getItem('viewingHistory') || '[]'));

// View all global variables
console.log('Window:', window);
```

### Clear State for Testing

```javascript
// Clear specific item
localStorage.removeItem('viewingHistory');

// Clear all localStorage
localStorage.clear();

// Reset global variables
selectedAPIs = [];
currentEpisodeIndex = 0;
```

---

## Summary

| State Type | Storage | Persistence | Use Case |
|------------|---------|-------------|----------|
| **Persistent** | LocalStorage | Survives reload | User preferences, history |
| **Runtime** | Global variables | Lost on reload | Current playback state |
| **UI** | DOM (classes/attributes) | Lost on reload | Modal visibility, loading state |
| **Configuration** | Constants | Hardcoded | API endpoints, settings |

**Key Principles**:
1. **LocalStorage for persistence** - User data that should survive reloads
2. **Global variables for runtime** - Temporary state during session
3. **DOM for UI state** - Visual state tied to elements
4. **No reactive system** - Manual UI updates required
5. **Always provide defaults** - Handle missing localStorage gracefully
6. **Limit storage size** - Prevent quota errors

**State Flow**:
```
User Action → Update Global Variable → Update UI → Save to LocalStorage (if persistent)
```