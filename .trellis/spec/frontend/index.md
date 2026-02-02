# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development in this **traditional Multi-Page Application (MPA)** project.

**Key Characteristics**:
- Pure JavaScript (ES6+), no framework (React/Vue/Angular)
- No build step - files loaded directly in browser
- Traditional HTML pages with direct DOM manipulation
- LocalStorage + global variables for state management

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | ✅ Completed |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | ✅ Completed |
| [Hook Guidelines](./hook-guidelines.md) | Reusable logic patterns (no React hooks) | ✅ Completed |
| [State Management](./state-management.md) | LocalStorage, global state, UI state | ✅ Completed |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | ✅ Completed |
| [Type Safety](./type-safety.md) | Runtime validation, JSDoc patterns | ✅ Completed |
| [Mobile Panel Pattern](./mobile-panel-pattern.md) | Mobile bottom sheet panel management | ✅ Completed |

---

## Quick Start

**Before writing any frontend code**, read these guidelines in order:

1. **[Directory Structure](./directory-structure.md)** - Understand how files are organized
2. **[Component Guidelines](./component-guidelines.md)** - Learn the utility class and function patterns
3. **[State Management](./state-management.md)** - Understand how state is managed
4. **[Quality Guidelines](./quality-guidelines.md)** - Know the forbidden patterns and required practices

For specific topics:
- **Reusable logic** → [Hook Guidelines](./hook-guidelines.md)
- **Type validation** → [Type Safety](./type-safety.md)

---

## Project Architecture Summary

### Technology Stack

- **Language**: Pure JavaScript (ES6+)
- **Modules**: ES Modules (`import`/`export`)
- **Styling**: Tailwind CSS (CDN) + Custom CSS
- **State**: LocalStorage + Global Variables
- **DOM**: Direct manipulation (no virtual DOM)

### Code Organization

```
js/
├── config.js           # Global constants
├── utils.js            # Utility classes (StorageManager, LazyImageLoader)
├── api.js              # API communication
├── ui.js               # UI functions
├── app.js              # Application initialization
└── [feature].js        # Feature-specific modules
```

### Key Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Utility Class** | Complex stateful logic | `StorageManager`, `LazyImageLoader` |
| **Pure Function** | UI operations | `toggleSettings()`, `showToast()` |
| **Global Variable** | Application state | `selectedAPIs`, `currentEpisodeIndex` |
| **LocalStorage** | Persistent state | User preferences, history |

---

## Common Mistakes to Avoid

1. ❌ **Don't use innerHTML with user input** → XSS vulnerability
2. ❌ **Don't forget null checks for DOM elements** → Runtime errors
3. ❌ **Don't skip try-catch in async functions** → Silent failures
4. ❌ **Don't forget timeout for fetch requests** → Hanging requests
5. ❌ **Don't store sensitive data in localStorage** → Security risk

See [Quality Guidelines](./quality-guidelines.md) for complete list.

---

## Development Workflow

1. **Read relevant guidelines** before starting
2. **Follow existing patterns** in the codebase
3. **Validate all inputs** (user input, API responses, localStorage)
4. **Handle all errors** with try-catch and fallbacks
5. **Test manually** on desktop and mobile

---

## Key Principles

1. **Security First** - Always escape user input, validate URLs
2. **Error Handling** - Every async operation needs try-catch and timeout
3. **Performance** - Debounce, lazy load, minimize DOM manipulation
4. **Null Safety** - Always check if DOM elements exist
5. **Consistency** - Follow existing patterns in the codebase

---

**Language**: All documentation is written in **English**.
