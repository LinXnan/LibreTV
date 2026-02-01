# Add Timeline Grouping to History Panel

## Goal

Add timeline-based grouping to the history panel to organize viewing history records by time periods (Today, Yesterday, This Week, Earlier), making it easier for users to find and browse their viewing history.

## Requirements

### 1. Time Period Grouping

Group history records into the following time periods:
- **今天** (Today): Records from today (< 24 hours)
- **昨天** (Yesterday): Records from yesterday (24-48 hours ago)
- **本周** (This Week): Records from this week (2-7 days ago)
- **更早** (Earlier): Records older than 7 days

### 2. Timeline Header Design

**Desktop Layout**:
- Timeline headers should be styled as section dividers
- Clear visual separation between different time periods
- Consistent with existing history panel design

**Mobile Layout**:
- Timeline headers should span full width across the 3-column grid
- Compact design to save vertical space
- Maintain visual hierarchy

### 3. Display Logic

- Records within each group should be sorted by timestamp (newest first)
- Empty time periods should not be displayed
- Preserve existing functionality:
  - Delete button with undo mechanism
  - Progress bar display
  - Playback rate badge
  - Click to resume playback

### 4. Responsive Design

- Desktop: Horizontal card layout with timeline headers
- Mobile: 3-column grid with full-width timeline headers
- Smooth transitions and animations

## Acceptance Criteria

- [ ] History records are grouped by time periods (Today, Yesterday, This Week, Earlier)
- [ ] Timeline headers are clearly visible and styled appropriately
- [ ] Desktop and mobile layouts both work correctly
- [ ] All existing functionality is preserved (delete, undo, playback resume)
- [ ] Empty time periods are not displayed
- [ ] Records within each group are sorted by timestamp (newest first)
- [ ] No visual glitches or layout issues
- [ ] Code follows mobile-modal-pattern guidelines

## Technical Notes

### Existing Implementation

- **Main file**: `js/ui.js` - `loadViewingHistory()` function (lines 447-612)
- **Data source**: `localStorage.getItem('viewingHistory')`
- **Time formatting**: `formatTimestamp()` function already exists (lines 368-399)
- **Mobile pattern**: Uses unified panel management from `mobile-panel-gestures.js`

### Data Structure

```javascript
{
    title: string,
    sourceName: string,
    vod_id: string,
    timestamp: number,  // Key field for grouping
    episodeIndex: number,
    playbackPosition: number,
    duration: number,
    // ... other fields
}
```

### Implementation Approach

1. Modify `loadViewingHistory()` to group records by time period
2. Add timeline header rendering logic
3. Update CSS for timeline headers (both desktop and mobile)
4. Ensure mobile 3-column grid layout accommodates full-width headers
5. Test all existing functionality still works

### Related Files

- `js/ui.js` - Main implementation
- `css/styles.css` - Desktop styles
- `css/mobile-optimize.css` - Mobile styles
- `.trellis/spec/frontend/mobile-modal-pattern.md` - Pattern guidelines
