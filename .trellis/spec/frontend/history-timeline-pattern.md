# History Timeline Pattern

> Pattern for implementing timeline-based grouping in history/list views.

---

## Overview

This pattern provides a consistent way to group historical records by time periods, making it easier for users to browse and find content based on when they interacted with it.

---

## Use Cases

- Viewing history (videos, articles, etc.)
- Activity logs
- Notification lists
- Any chronological data that benefits from time-based grouping

---

## Time Period Grouping

### Standard Time Periods

| Period | Time Range | Example |
|--------|-----------|---------|
| **今天** (Today) | Today 00:00 to now | 2026-02-01 00:00 - now |
| **昨天** (Yesterday) | Yesterday 00:00 to today 00:00 | 2026-01-31 00:00 - 2026-02-01 00:00 |
| **本周** (This Week) | 7 days ago to yesterday 00:00 | 2026-01-25 00:00 - 2026-01-31 00:00 |
| **更早** (Earlier) | Before 7 days ago | Before 2026-01-25 00:00 |

### Time Calculation

```javascript
const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
const yesterdayStart = todayStart - 86400000;  // 24 hours in milliseconds
const thisWeekStart = todayStart - 604800000;   // 7 days in milliseconds
```

**Key Points**:
- Use local time (not UTC)
- Day boundary is at 00:00 (midnight)
- Automatically handles timezone differences

---

## Implementation Pattern

### 1. Grouping Function

```javascript
function groupHistoryByTimeline(history) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const thisWeekStart = todayStart - 604800000;

    const groups = [
        { label: '今天', items: [], minTime: todayStart },
        { label: '昨天', items: [], minTime: yesterdayStart, maxTime: todayStart },
        { label: '本周', items: [], minTime: thisWeekStart, maxTime: yesterdayStart },
        { label: '更早', items: [], maxTime: thisWeekStart }
    ];

    history.forEach(item => {
        const timestamp = item.timestamp;

        if (timestamp >= todayStart) {
            groups[0].items.push(item);
        } else if (timestamp >= yesterdayStart) {
            groups[1].items.push(item);
        } else if (timestamp >= thisWeekStart) {
            groups[2].items.push(item);
        } else {
            groups[3].items.push(item);
        }
    });

    return groups;
}
```

### 2. Rendering Pattern

```javascript
function renderGroupedHistory(history) {
    const groupedHistory = groupHistoryByTimeline(history);
    let htmlContent = '';

    for (const group of groupedHistory) {
        // Skip empty groups
        if (group.items.length === 0) continue;

        // Add timeline header
        htmlContent += `<div class="timeline-header">${group.label}</div>`;

        // Render items in this group
        htmlContent += group.items.map((item) => {
            // Get correct index in original array
            const index = history.findIndex(h =>
                h.url === item.url && h.timestamp === item.timestamp
            );

            return renderHistoryItem(item, index);
        }).join('');
    }

    return htmlContent;
}
```

### 3. Index Handling

**Critical**: When rendering grouped items, you must use the original array index for operations like delete and play.

**Wrong**:
```javascript
group.items.map((item, index) => {
    // ❌ index is the group index, not the original array index
    onclick="deleteItem(${index})"
})
```

**Correct**:
```javascript
group.items.map((item) => {
    // ✅ Find the correct index in the original array
    const index = history.findIndex(h =>
        h.url === item.url && h.timestamp === item.timestamp
    );
    onclick="deleteItem(${index})"
})
```

---

## Styling

### Desktop Layout

```css
.timeline-header {
    font-size: 14px;
    font-weight: 600;
    color: #888;
    padding: 16px 8px 8px 8px;
    margin-top: 8px;
    border-bottom: 1px solid #333;
    letter-spacing: 0.5px;
}

.timeline-header:first-child {
    margin-top: 0;
    padding-top: 8px;
}
```

### Mobile Layout

For grid-based layouts (e.g., 3-column grid):

```css
@media (max-width: 640px) {
    #historyList .timeline-header {
        grid-column: 1 / -1;  /* Span all columns */
        font-size: 13px;
        font-weight: 600;
        color: #888;
        padding: 12px 4px 8px 4px;
        margin: 0;
        border-bottom: 1px solid #333;
        letter-spacing: 0.5px;
        background: transparent;
    }

    #historyList .timeline-header:first-child {
        padding-top: 4px;
    }
}
```

**Key Point**: Use `grid-column: 1 / -1` to make the header span all columns in a grid layout.

---

## Best Practices

### 1. Empty Group Handling

Always hide empty time periods:

```javascript
for (const group of groupedHistory) {
    if (group.items.length === 0) continue;  // Skip empty groups
    // ... render group
}
```

### 2. Sorting Within Groups

Items within each group should be sorted by timestamp (newest first):

```javascript
// History should already be sorted before grouping
history.sort((a, b) => b.timestamp - a.timestamp);
const groupedHistory = groupHistoryByTimeline(history);
```

### 3. Responsive Design

- Desktop: Timeline headers as independent block elements
- Mobile: Timeline headers span full width (all grid columns)
- Maintain consistent spacing and visual hierarchy

### 4. Accessibility

```html
<div class="timeline-header" role="heading" aria-level="3">
    今天
</div>
```

---

## Common Mistakes

### 1. Wrong Index Usage

**Problem**: Using group-local index instead of original array index.

**Solution**: Always use `findIndex()` to get the correct index from the original array.

### 2. Not Handling Empty Groups

**Problem**: Showing timeline headers for empty time periods.

**Solution**: Check `group.items.length === 0` and skip rendering.

### 3. Incorrect Time Calculation

**Problem**: Using UTC time instead of local time, causing incorrect grouping.

**Solution**: Use `new Date(year, month, date).getTime()` for local time boundaries.

### 4. Mobile Layout Issues

**Problem**: Timeline headers not spanning full width in grid layouts.

**Solution**: Use `grid-column: 1 / -1` in CSS.

---

## Example Implementation

See `js/ui.js` in the LibreTV project:
- `groupHistoryByTimeline()` function (lines 368-397)
- `loadViewingHistory()` function (lines 478-657)

---

## Testing Checklist

- [ ] Timeline headers display correctly
- [ ] Records are grouped into correct time periods
- [ ] Empty time periods are hidden
- [ ] Desktop layout works (headers as block elements)
- [ ] Mobile layout works (headers span full width)
- [ ] Delete functionality uses correct index
- [ ] Play/click functionality uses correct index
- [ ] Responsive switching works smoothly

---

## Related Patterns

- [Mobile Modal Pattern](./mobile-modal-pattern.md) - For modal/panel containers
- [Responsive Grid Pattern](./responsive-grid-pattern.md) - For grid-based layouts (to be documented)

---

**Last Updated**: 2026-02-01
**Related Commit**: 1c97e95 - feat(history): 添加时间线分组功能
