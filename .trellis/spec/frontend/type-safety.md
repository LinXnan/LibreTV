# Type Safety

> Type safety patterns in this project.

---

## Overview

**This project uses pure JavaScript (ES6+), NOT TypeScript.**

Type safety approach:
- **No static type checking** - No TypeScript compiler
- **Runtime validation** - Manual type checks in code
- **JSDoc comments** - Optional documentation for complex functions
- **Naming conventions** - Variable names hint at types
- **Defensive programming** - Check types before using values

---

## Language: JavaScript (No TypeScript)

**Why no TypeScript?**
- This is a traditional MPA (Multi-Page Application)
- No build step - files loaded directly in browser
- Simplicity over type safety
- Small team/project size

**Trade-offs**:
- ❌ No compile-time type errors
- ❌ No IDE autocomplete for custom types
- ✅ No build configuration needed
- ✅ Faster development iteration
- ✅ Simpler deployment

---

## Runtime Validation Patterns

### Pattern 1: Type Guards

**Purpose**: Check if a value is of expected type before using it.

```javascript
// String validation
function isValidString(value) {
    return typeof value === 'string' && value.length > 0;
}

// Number validation
function isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}

// Array validation
function isValidArray(value) {
    return Array.isArray(value) && value.length > 0;
}

// Object validation
function isValidObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
```

**Usage**:
```javascript
function processData(data) {
    if (!isValidObject(data)) {
        console.error('Invalid data:', data);
        return null;
    }
    // Safe to use data as object
    return data.property;
}
```

---

### Pattern 2: URL Validation

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

**Why this works**:
- Checks if url is a string
- Uses URL constructor to validate format
- Ensures protocol is http/https
- Returns false on any error

**Usage**:
```javascript
if (isValidImageUrl(imageUrl)) {
    img.src = imageUrl;
} else {
    img.src = '/image/placeholder.png';
}
```

---

### Pattern 3: Data Normalization

**Location**: `js/app.js:4-15`

**Purpose**: Convert data to expected format, handling variations.

```javascript
// Normalize custom API data format
// Supports both api/adult and url/isAdult formats
function normalizeCustomAPI(api) {
    return {
        name: api.name || '',
        url: api.url || api.api || '',
        detail: api.detail || '',
        isAdult: api.isAdult ?? api.adult ?? false
    };
}
```

**Why this works**:
- Provides default values for missing properties
- Handles multiple property name variations
- Uses nullish coalescing (??) for boolean values
- Always returns consistent shape

**Usage**:
```javascript
let customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]')
    .map(normalizeCustomAPI);
// All APIs now have consistent structure
```

---

### Pattern 4: Input Validation

**Purpose**: Validate user input before processing.

```javascript
function validateSearchQuery(query) {
    // Type check
    if (typeof query !== 'string') {
        return { valid: false, error: 'Query must be a string' };
    }

    // Length check
    if (query.length === 0) {
        return { valid: false, error: 'Query cannot be empty' };
    }

    if (query.length > 100) {
        return { valid: false, error: 'Query too long (max 100 chars)' };
    }

    // Content check
    if (/<script|javascript:/i.test(query)) {
        return { valid: false, error: 'Invalid characters' };
    }

    return { valid: true };
}
```

**Usage**:
```javascript
const validation = validateSearchQuery(userInput);
if (!validation.valid) {
    showError(validation.error);
    return;
}
// Safe to use userInput
performSearch(userInput);
```

---

## JSDoc Comment Patterns

### Pattern 1: Function Documentation

**Purpose**: Document function parameters and return types.

```javascript
/**
 * Search for videos by API and keyword
 * @param {string} apiId - The API identifier (e.g., 'tyyszy', 'custom_0')
 * @param {string} query - The search query
 * @returns {Promise<{results: Array, latency: number}>} Search results and latency
 */
async function searchByAPIAndKeyWord(apiId, query) {
    // Implementation
}
```

**Benefits**:
- IDE shows parameter hints
- Documents expected types
- Helps with code review

---

### Pattern 2: Complex Object Documentation

**Location**: `js/mobile-panel-gestures.js:1-81`

```javascript
/**
 * Mobile panel gesture handling module
 * Implements bottom drawer-style panel touch gestures, dragging, focus management
 */

// Gesture state management
const gestureState = {
    isDragging: false,
    startY: 0,
    currentY: 0,
    startTime: 0,
    startX: 0,
    currentPanel: null,
    panelHeight: 0,
    lastMoveY: 0,
    lastMoveTime: 0,
    prevMoveY: 0,
    prevMoveTime: 0
};

/**
 * Initialize gesture support
 */
function initMobilePanelGestures() {
    // Implementation
}
```

---

### Pattern 3: Class Documentation

```javascript
/**
 * Manages localStorage with debouncing and caching
 * @class
 */
class StorageManager {
    /**
     * @param {number} debounceTime - Debounce delay in milliseconds
     */
    constructor(debounceTime = 1000) {
        this.debounceTime = debounceTime;
        this.timers = new Map();
        this.cache = new Map();
    }

    /**
     * Set item in localStorage (debounced)
     * @param {string} key - Storage key
     * @param {*} value - Value to store (will be JSON.stringify'd)
     */
    setItem(key, value) {
        // Implementation
    }

    /**
     * Get item from localStorage (cached)
     * @param {string} key - Storage key
     * @returns {*} Parsed value or null
     */
    getItem(key) {
        // Implementation
    }
}
```

---

## Naming Conventions for Type Hints

### Variable Naming

Use names that hint at the type:

```javascript
// Arrays - plural nouns
const selectedAPIs = [];
const customAPIs = [];
const episodes = [];

// Booleans - is/has/should prefix
const isLoading = false;
const hasError = false;
const shouldAutoplay = true;

// Numbers - count/index/id suffix
const currentEpisodeIndex = 0;
const videoCount = 10;
const userId = 123;

// Strings - descriptive nouns
const videoTitle = '';
const apiUrl = '';
const userName = '';

// Objects - singular nouns
const videoInfo = {};
const playerConfig = {};
const apiSite = {};

// Functions - verb phrases
function fetchVideoDetails() { }
function isValidUrl() { }
function normalizeCustomAPI() { }
```

---

## Defensive Programming Patterns

### Pattern 1: Optional Chaining (?.)

**Purpose**: Safely access nested properties.

```javascript
// Bad - Crashes if videoInfo is null
const title = videoInfo.title;

// Good - Returns undefined if videoInfo is null
const title = videoInfo?.title;

// Chaining
const episodeName = videoInfo?.episodes?.[0]?.name;
```

---

### Pattern 2: Nullish Coalescing (??)

**Purpose**: Provide default values for null/undefined.

```javascript
// Bad - 0 and '' are treated as falsy
const count = value || 10; // 0 becomes 10!

// Good - Only null/undefined use default
const count = value ?? 10; // 0 stays 0

// Example from codebase
isAdult: api.isAdult ?? api.adult ?? false
```

---

### Pattern 3: Default Parameters

**Purpose**: Provide fallback values for function parameters.

```javascript
function createStorageManager(debounceTime = 1000) {
    // debounceTime is 1000 if not provided
}

function fetchData(url, timeout = 8000) {
    // timeout is 8000 if not provided
}
```

---

### Pattern 4: Array/Object Defaults

**Purpose**: Handle missing localStorage data.

```javascript
// Arrays
const apis = JSON.parse(localStorage.getItem('selectedAPIs') || '[]');

// Objects
const settings = JSON.parse(localStorage.getItem('settings') || '{}');

// With default values
const apis = JSON.parse(
    localStorage.getItem('selectedAPIs') || '["tyyszy","dyttzy"]'
);
```

---

## Common Type Patterns

### Pattern 1: API Response Handling

```javascript
async function fetchVideoDetails(videoId) {
    try {
        const response = await fetch(`/api/video/${videoId}`);

        // Validate response
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Validate data structure
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response format');
        }

        // Validate required fields
        if (!data.vod_id || !data.vod_name) {
            throw new Error('Missing required fields');
        }

        return data;

    } catch (error) {
        console.error('Fetch failed:', error);
        return null;
    }
}
```

---

### Pattern 2: Array Processing

```javascript
function processVideos(videos) {
    // Validate input
    if (!Array.isArray(videos)) {
        console.error('Expected array, got:', typeof videos);
        return [];
    }

    // Filter and map with type checks
    return videos
        .filter(video => video && typeof video === 'object')
        .filter(video => video.vod_id && video.vod_name)
        .map(video => ({
            id: String(video.vod_id),
            title: String(video.vod_name || ''),
            pic: String(video.vod_pic || ''),
            type: String(video.type_name || '')
        }));
}
```

---

### Pattern 3: Configuration Objects

**Location**: `js/config.js:1-118`

```javascript
// Type-safe configuration through constants
const PLAYER_CONFIG = {
    autoplay: true,              // boolean
    allowFullscreen: true,       // boolean
    width: '100%',               // string
    height: '600',               // string (CSS value)
    timeout: 15000,              // number (milliseconds)
    filterAds: true,             // boolean
    autoPlayNext: true,          // boolean
    adFilteringEnabled: true,    // boolean
    adFilteringStorage: 'adFilteringEnabled'  // string (key)
};

// Usage with validation
function initPlayer(config = PLAYER_CONFIG) {
    const timeout = typeof config.timeout === 'number'
        ? config.timeout
        : 15000;

    const autoplay = Boolean(config.autoplay);

    // Use validated values
}
```

---

## Forbidden Patterns

### ❌ 1. Assuming Types Without Checking

```javascript
// Bad - Crashes if data is not an array
function processData(data) {
    return data.map(item => item.name);
}
```

**Fix**:
```javascript
// Good - Validates type first
function processData(data) {
    if (!Array.isArray(data)) {
        console.error('Expected array, got:', typeof data);
        return [];
    }
    return data
        .filter(item => item && item.name)
        .map(item => item.name);
}
```

---

### ❌ 2. Using == for Comparisons

```javascript
// Bad - Type coercion causes bugs
if (value == '0') { }  // true for: 0, '0', false, '', null
if (value == null) { } // true for: null, undefined
```

**Fix**:
```javascript
// Good - Strict equality
if (value === '0') { }  // Only true for '0'
if (value === null) { } // Only true for null
if (value == null) { }  // OK: intentionally checks null OR undefined
```

---

### ❌ 3. Not Handling JSON.parse Errors

```javascript
// Bad - Crashes on invalid JSON
const data = JSON.parse(localStorage.getItem('data'));
```

**Fix**:
```javascript
// Good - Handles parse errors
try {
    const data = JSON.parse(localStorage.getItem('data') || '{}');
} catch (e) {
    console.error('Failed to parse data:', e);
    const data = {};
}
```

---

### ❌ 4. Trusting External Data

```javascript
// Bad - Assumes API returns expected format
async function fetchData() {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data.results.map(r => r.name); // Crashes if structure is wrong!
}
```

**Fix**:
```javascript
// Good - Validates structure
async function fetchData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Validate structure
        if (!data || !Array.isArray(data.results)) {
            throw new Error('Invalid response format');
        }

        return data.results
            .filter(r => r && r.name)
            .map(r => r.name);

    } catch (error) {
        console.error('Fetch failed:', error);
        return [];
    }
}
```

---

## Type Debugging

### Console Type Checking

```javascript
// Check type
console.log('Type:', typeof value);

// Check if array
console.log('Is array:', Array.isArray(value));

// Check if null/undefined
console.log('Is null:', value === null);
console.log('Is undefined:', value === undefined);
console.log('Is nullish:', value == null);

// Check object structure
console.log('Keys:', Object.keys(value));
console.log('Value:', JSON.stringify(value, null, 2));
```

---

## Migration to TypeScript (Future)

If this project ever migrates to TypeScript, here's how patterns would translate:

| JavaScript Pattern | TypeScript Equivalent |
|-------------------|----------------------|
| JSDoc comments | Type annotations |
| Runtime validation | Compile-time checking |
| `typeof` checks | Type guards |
| Normalization functions | Type assertions |
| Default parameters | Optional parameters with defaults |
| Nullish coalescing | Non-null assertion or optional chaining |

**Example**:
```javascript
// JavaScript
function processVideo(video) {
    if (!video || typeof video !== 'object') return null;
    return {
        id: String(video.vod_id || ''),
        title: String(video.vod_name || '')
    };
}

// TypeScript
interface Video {
    vod_id: string;
    vod_name: string;
}

function processVideo(video: Video | null): { id: string; title: string } | null {
    if (!video) return null;
    return {
        id: video.vod_id,
        title: video.vod_name
    };
}
```

---

## Summary

**Key Principles**:

1. **Validate at boundaries** - Check types when data enters your code (API responses, user input, localStorage)
2. **Use defensive programming** - Optional chaining, nullish coalescing, default parameters
3. **Provide fallbacks** - Always have default values for missing data
4. **Document with JSDoc** - Help future developers understand expected types
5. **Name meaningfully** - Variable names should hint at their type

**Type Safety Mantra**: "Trust nothing, validate everything, provide fallbacks."

**When in doubt**: Look at existing validation patterns in `js/utils.js:19-28` (isValidImageUrl) or `js/app.js:4-15` (normalizeCustomAPI).

---

## Quick Reference

| Need | Pattern |
|------|---------|
| Check if string | `typeof value === 'string'` |
| Check if number | `typeof value === 'number' && !isNaN(value)` |
| Check if array | `Array.isArray(value)` |
| Check if object | `value !== null && typeof value === 'object' && !Array.isArray(value)` |
| Safe property access | `obj?.prop?.nested` |
| Default value | `value ?? defaultValue` |
| Array default | `JSON.parse(data \|\| '[]')` |
| Object default | `JSON.parse(data \|\| '{}')` |
| Validate URL | Use `isValidImageUrl()` from utils.js |
| Normalize data | Create normalization function like `normalizeCustomAPI()` |
