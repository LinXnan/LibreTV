# Directory Structure

> How frontend code is organized in this project.

---

## Overview

**This is a traditional Multi-Page Application (MPA)**, not a modern SPA framework like React or Vue.

The project uses:
- **Pure JavaScript (ES6+)** with ES Modules
- **No build step** - files are loaded directly in the browser
- **Function-based organization** - files are organized by functionality, not by component hierarchy

---

## Directory Layout

```
LibreTV_Trellis/
├── index.html              # Main landing page
├── player.html             # Video player page
├── watch.html              # Watch page
├── about.html              # About page
├── js/                     # JavaScript modules (organized by function)
│   ├── config.js           # Global configuration constants
│   ├── utils.js            # Utility classes (StorageManager, LazyImageLoader, etc.)
│   ├── api.js              # API request handling
│   ├── ui.js               # UI interaction functions
│   ├── app.js              # Application initialization
│   ├── search.js           # Search functionality
│   ├── douban.js           # Douban integration
│   ├── password.js         # Password verification
│   ├── customer_site.js    # Custom site configuration
│   ├── mobile-panel-gestures.js  # Mobile gesture handling
│   ├── proxy-auth.js       # Proxy authentication
│   ├── daily-quote.js      # Daily quote feature
│   └── ...                 # Other feature modules
├── css/                    # Stylesheets (organized by page/feature)
│   ├── styles.css          # Global styles
│   ├── index.css           # Landing page styles
│   ├── player.css          # Player page styles
│   ├── watch.css           # Watch page styles
│   ├── modals.css          # Modal dialog styles
│   ├── mobile-optimize.css # Mobile optimizations
│   └── performance-optimize.css  # Performance optimizations
├── libs/                   # Third-party libraries (CDN fallbacks)
│   ├── tailwindcss.min.js
│   ├── artplayer.min.js
│   ├── hls.min.js
│   └── sha256.min.js
├── image/                  # Image assets
├── server.mjs              # Node.js backend server
└── package.json
```

---

## Module Organization

### JavaScript Modules

**Principle**: One file per major feature or utility category.

| File | Purpose | Example Functions/Classes |
|------|---------|---------------------------|
| `config.js` | Global constants and configuration | `API_SITES`, `PLAYER_CONFIG`, `SITE_CONFIG` |
| `utils.js` | Reusable utility classes | `StorageManager`, `LazyImageLoader`, `ImageCacheManager` |
| `api.js` | API communication | `handleApiRequest()`, `fetchVideoDetails()` |
| `ui.js` | UI manipulation | `toggleSettings()`, `showToast()`, `renderSearchHistory()` |
| `app.js` | Application initialization | `initApp()`, global state variables |
| `search.js` | Search functionality | `searchByAPIAndKeyWord()`, `performSearch()` |

**When to create a new file**:
- Feature has 200+ lines of code
- Feature is self-contained and reusable
- Feature has multiple related functions/classes

**When to add to existing file**:
- Small utility function (< 50 lines)
- Tightly coupled to existing feature
- One-off helper for specific page

### CSS Organization

**Principle**: One file per page, plus shared files for common patterns.

| File | Purpose |
|------|---------|
| `styles.css` | Global styles, resets, utility classes |
| `{page}.css` | Page-specific styles (e.g., `player.css`, `watch.css`) |
| `modals.css` | Shared modal/dialog styles |
| `mobile-optimize.css` | Mobile-specific overrides |
| `performance-optimize.css` | Performance-related styles (lazy loading, animations) |

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| JavaScript | `kebab-case.js` | `mobile-panel-gestures.js` |
| CSS | `kebab-case.css` | `mobile-optimize.css` |
| HTML | `lowercase.html` | `player.html` |
| Config | `snake_case.js` | `customer_site.js` |

### Functions and Classes

| Type | Convention | Example |
|------|------------|---------|
| Functions | `camelCase` | `toggleSettings()`, `showToast()` |
| Classes | `PascalCase` | `StorageManager`, `LazyImageLoader` |
| Constants | `UPPER_SNAKE_CASE` | `API_SITES`, `PROXY_URL` |
| Global variables | `camelCase` | `selectedAPIs`, `currentEpisodeIndex` |

---

## Script Loading Pattern

All JavaScript files are loaded with `defer` attribute in HTML:

```html
<!-- Example from index.html -->
<script src="js/config.js" defer></script>
<script src="js/utils.js" defer></script>
<script src="js/api.js" defer></script>
<script src="js/ui.js" defer></script>
<script src="js/app.js" defer></script>
```

**Why `defer`**:
- Scripts execute in order after DOM is parsed
- Non-blocking - doesn't delay page rendering
- Maintains dependency order (config → utils → api → ui → app)

---

## Examples

### Example 1: Feature Module (search.js)

**Location**: `js/search.js`

**Purpose**: Handles all search-related functionality

**Structure**:
- Async functions for API calls
- Helper functions for result processing
- Event handlers for search UI

**Reference**: See `js/search.js:1-135`

### Example 2: Utility Module (utils.js)

**Location**: `js/utils.js`

**Purpose**: Reusable utility classes and functions

**Structure**:
- Class definitions (StorageManager, LazyImageLoader, etc.)
- Pure utility functions (isValidImageUrl, escapeHtml)
- Global instance creation at end of file

**Reference**: See `js/utils.js:54-472`

### Example 3: Configuration Module (config.js)

**Location**: `js/config.js`

**Purpose**: Centralized configuration constants

**Structure**:
- Constant declarations only
- Grouped by feature (API_SITES, PLAYER_CONFIG, etc.)
- No functions or logic

**Reference**: See `js/config.js:1-118`

---

## Common Mistakes

### ❌ Don't: Create deeply nested directories

```
// Bad
js/
├── features/
│   ├── search/
│   │   ├── api/
│   │   │   └── search-api.js
│   │   └── ui/
│   │       └── search-ui.js
```

**Why**: This project uses a flat structure. Deep nesting makes imports harder and doesn't provide value for a non-bundled project.

### ✅ Do: Keep it flat and organized by feature

```
// Good
js/
├── search.js      # All search functionality
├── api.js         # All API handling
└── ui.js          # All UI functions
```

### ❌ Don't: Mix configuration with logic

```javascript
// Bad - in search.js
const API_TIMEOUT = 8000;
async function searchByAPI() { ... }
```

**Why**: Configuration should be centralized in `config.js` for easy maintenance.

### ✅ Do: Separate config from implementation

```javascript
// Good - in config.js
const API_CONFIG = {
    search: {
        timeout: 8000,
        // ...
    }
};

// Good - in search.js
async function searchByAPI() {
    const timeout = API_CONFIG.search.timeout;
    // ...
}
```

### ❌ Don't: Create files with only one small function

```javascript
// Bad - js/toast.js (10 lines)
function showToast(message) {
    // ...
}
```

**Why**: Too granular. Small UI functions should be grouped in `ui.js`.

### ✅ Do: Group related small functions

```javascript
// Good - in ui.js
function showToast(message) { ... }
function hideToast() { ... }
function toggleSettings() { ... }
```

---

## Migration Notes

If you need to add a new feature:

1. **Small feature (< 100 lines)**: Add to existing relevant file (e.g., `ui.js`, `utils.js`)
2. **Medium feature (100-300 lines)**: Create new file in `js/` directory
3. **Large feature (300+ lines)**: Consider splitting into multiple files or refactoring

Always update the HTML file to include new scripts with `defer` attribute.
