# UI Patterns

> Common UI patterns and design conventions used in this project.

---

## History Record Display Pattern

### Overview

History records use gradient color placeholders with content type icons instead of cover images for better performance and visual consistency.

### Implementation

**Location**: `js/ui.js` - `loadViewingHistory()` function

**Key Functions**:

```javascript
// Generate gradient color from string
function generateGradientFromString(str) {
    if (!str) str = '未知';
    const charCode = str.charCodeAt(0);
    const hue1 = (charCode * 137.5) % 360; // Golden angle distribution
    const hue2 = (hue1 + 60) % 360; // Adjacent hue
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 35%))`;
}

// Get content type icon
function getContentTypeIcon(title) {
    if (!title) return '📺';
    const lowerTitle = title.toLowerCase();

    // Anime keywords
    if (lowerTitle.includes('动漫') || lowerTitle.includes('番') ||
        lowerTitle.includes('anime') || lowerTitle.includes('漫画')) {
        return '🎭';
    }

    // Movie keywords
    if (lowerTitle.includes('电影') || lowerTitle.includes('movie') ||
        lowerTitle.includes('影') || lowerTitle.includes('剧场版')) {
        return '🎬';
    }

    // Default: TV series
    return '📺';
}
```

### Desktop Layout

**Structure**:
- Horizontal flex layout
- Left: Gradient color placeholder (80x120px) with floating icon
- Right: Content information

**Styles** (`css/styles.css`):

```css
.history-item {
    display: flex;
    flex-direction: row;
    gap: 16px;
    padding: 12px;
    border-radius: 8px;
}

.history-icon-placeholder {
    flex-shrink: 0;
    width: 80px;
    height: 120px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.history-icon {
    font-size: 48px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    animation: iconFloat 3s ease-in-out infinite;
}
```

### Mobile Layout

**Structure**:
- 3-column grid layout
- Gradient color background
- Large semi-transparent icon (64px, 12% opacity)
- Bottom gradient mask for text readability

**Styles** (`css/mobile-optimize.css`):

```css
#historyList .history-item .history-item-content {
    padding: 12px;
    /* background set by JS */
}

/* Bottom gradient mask for text readability */
#historyList .history-item .history-item-content::before {
    content: '';
    position: absolute;
    bottom: 0;
    height: 60%;
    background: linear-gradient(
        to bottom,
        transparent 0%,
        rgba(0, 0, 0, 0.3) 20%,
        rgba(0, 0, 0, 0.7) 60%,
        rgba(0, 0, 0, 0.95) 100%
    );
    z-index: 1;
}

.history-icon-mobile {
    position: absolute;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 64px;
    opacity: 0.12;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
}
```

### Design Principles

1. **Performance First**: No image loading, faster page load
2. **Visual Consistency**: Each title generates unique gradient color
3. **Content Recognition**: Icons indicate content type at a glance
4. **Text Readability**: Gradient masks ensure text is always readable
5. **Responsive Design**: Different layouts for desktop and mobile

### Benefits

- ⚡ **Performance**: No network requests for images
- 🎨 **Visual Appeal**: Colorful gradients, unique per title
- 📱 **Mobile Friendly**: Optimized for touch devices
- ♿ **Accessibility**: High contrast text with shadows and masks

### Common Mistakes to Avoid

❌ **Don't** use inline styles for gradient colors in HTML templates
✅ **Do** generate gradients dynamically in JavaScript

❌ **Don't** forget the gradient mask on mobile for text readability
✅ **Do** always include `::before` pseudo-element for bottom gradient

❌ **Don't** use high opacity for background icons
✅ **Do** keep icon opacity low (10-15%) to avoid visual clutter

### Related Files

- `js/ui.js` - Rendering logic
- `css/styles.css` - Desktop styles
- `css/mobile-optimize.css` - Mobile styles

---

**Last Updated**: 2026-02-01
**Pattern Status**: ✅ Active
