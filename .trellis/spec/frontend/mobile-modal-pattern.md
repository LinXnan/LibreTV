# Mobile Modal Pattern

> Pattern for implementing mobile bottom drawer modals with unified backdrop overlay.

---

## Overview

This project uses a unified approach for mobile modals (bottom drawer style) with a shared backdrop overlay.

---

## Core Components

### 1. Unified Overlay Element

**HTML** (in both `index.html` and `player.html`):
```html
<div id="panelOverlay" class="panel-overlay" aria-hidden="true"></div>
```

**Purpose**: Single shared overlay element for all mobile modals.

### 2. Unified Panel Management Functions

**Location**: `js/mobile-panel-gestures.js`

**Functions**:
- `openPanel(panel, triggerElement)` - Opens a panel with overlay
- `closePanel(panel)` - Closes a panel and overlay
- `handleOverlayClick(e)` - Handles overlay click to close panels

---

## Implementation Pattern

### For Toggle Functions

**Correct Pattern** (mobile-aware):
```javascript
function toggleMyPanel(e) {
    const panel = document.getElementById('myPanel');
    if (!panel) return;

    const triggerElement = e?.currentTarget || document.activeElement;

    // Mobile: use unified panel management
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

**Wrong Pattern** (direct CSS manipulation):
```javascript
// ❌ DON'T DO THIS on mobile
function toggleMyPanel(e) {
    const panel = document.getElementById('myPanel');
    const overlay = document.getElementById('panelOverlay');

    panel.classList.toggle('show');
    overlay.classList.toggle('show');  // Missing features!
}
```

### For Open/Close Functions

**Correct Pattern**:
```javascript
function openMyModal() {
    const modal = document.getElementById('myModal');
    if (!modal) return;

    // Show modal element first
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Mobile: use unified panel management
    if (window.innerWidth <= 640) {
        setTimeout(() => {
            if (window.openPanel) {
                window.openPanel(modal);
            } else {
                // Fallback for compatibility
                modal.classList.add('show');
                const overlay = document.getElementById('panelOverlay');
                if (overlay) overlay.classList.add('show');
            }
        }, 10);
    }
}

function closeMyModal() {
    const modal = document.getElementById('myModal');
    if (!modal) return;

    // Mobile: use unified panel management
    if (window.innerWidth <= 640) {
        if (window.closePanel) {
            window.closePanel(modal);
        } else {
            // Fallback
            modal.classList.remove('show');
            const overlay = document.getElementById('panelOverlay');
            if (overlay) overlay.classList.remove('show');
        }
        // Wait for animation before hiding
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 400);
    } else {
        // Desktop: immediate hide
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
```

---

## Benefits of Unified Approach

Using `openPanel`/`closePanel` provides:

1. **Automatic mutual exclusion** - Opening one panel closes others
2. **Accessibility** - Proper `aria-hidden` attributes
3. **Focus management** - Returns focus to trigger element on close
4. **Body scroll control** - Prevents background scrolling
5. **Browser history support** - Back button closes panels
6. **Screen reader announcements** - "Panel opened/closed" notifications

---

## CSS Requirements

**Mobile styles** (`css/mobile-optimize.css`):
```css
@media (max-width: 640px) {
    /* Unified overlay */
    .panel-overlay {
        position: fixed !important;
        inset: 0 !important;
        background: rgba(0, 0, 0, 1) !important;
        z-index: 39 !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transition: opacity 0.3s ease, visibility 0.3s ease !important;
    }

    .panel-overlay.show {
        opacity: 0.5 !important;  /* 50% opacity */
        visibility: visible !important;
        pointer-events: auto !important;
    }

    /* Bottom drawer panels */
    .history-panel,
    .settings-panel,
    #episodeModal.episode-panel {
        left: 0 !important;
        right: 0 !important;
        top: auto !important;
        bottom: 0 !important;
        width: 100% !important;
        max-height: 50vh !important;
        border-radius: 16px 16px 0 0 !important;
        transform: translateY(100%) !important;
        transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    }

    .history-panel.show,
    .settings-panel.show,
    #episodeModal.episode-panel.show {
        transform: translateY(0) !important;
    }
}
```

---

## Common Mistakes

### 1. Function Duplication

**Problem**: Defining the same function in multiple files causes the later one to override.

**Example**:
- `toggleSettings` defined in `js/ui.js` (correct implementation)
- `toggleSettings` defined in `js/app.js` (old implementation)
- Result: `app.js` loads after `ui.js`, overriding the correct version

**Solution**: Remove duplicate definitions or ensure all use the same pattern.

### 2. Direct CSS Manipulation

**Problem**: Directly manipulating CSS classes bypasses unified features.

**Wrong**:
```javascript
modal.classList.add('show');
overlay.classList.add('show');
```

**Right**:
```javascript
if (window.openPanel) {
    window.openPanel(modal);
}
```

### 3. Missing Mobile Check

**Problem**: Applying mobile pattern to desktop breaks layout.

**Solution**: Always check `window.innerWidth <= 640` before using mobile pattern.

---

## Current Implementation

### Panels Using Unified Pattern

| Panel | File | Open Function | Close Function |
|-------|------|---------------|----------------|
| History Panel | `js/ui.js` | `toggleHistory()` | `toggleHistory()` |
| Settings Panel | `js/ui.js`, `js/app.js` | `toggleSettings()` | `toggleSettings()` |
| Episode Modal | `js/player.js` | `openEpisodeModal()` | `closeEpisodeModal()` |

---

## Testing Checklist

When implementing a new mobile modal:

- [ ] Uses `window.openPanel()` on mobile
- [ ] Uses `window.closePanel()` on mobile
- [ ] Has fallback for when functions don't exist
- [ ] Checks `window.innerWidth <= 640` for mobile
- [ ] Desktop behavior preserved
- [ ] Overlay shows with 50% opacity
- [ ] Panel slides up from bottom
- [ ] Clicking overlay closes panel
- [ ] Back button closes panel
- [ ] Opening one panel closes others
- [ ] Focus returns to trigger element on close

---

## Related Files

- `js/mobile-panel-gestures.js` - Unified panel management
- `css/mobile-optimize.css` - Mobile styles
- `index.html` - History and Settings panels
- `player.html` - Episode modal

---

**Last Updated**: 2026-01-30
**Related Commit**: Unified mobile modal backdrop implementation
