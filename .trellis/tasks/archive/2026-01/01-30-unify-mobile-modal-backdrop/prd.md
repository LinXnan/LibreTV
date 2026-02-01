# Feature: 统一移动端弹框背景遮罩效果

## Background

根据代码分析，项目中已经有统一的遮罩元素 `#panelOverlay`，但三个移动端弹框（历史、设置、选集）的背景遮罩效果可能存在不一致的地方。

## Requirements

针对移动端，统一以下三个弹框的背景遮罩效果：

1. **历史面板** (History Panel) - `index.html` 中的 `#historyPanel`
2. **设置面板** (Settings Panel) - `index.html` 中的 `#settingsPanel`
3. **选集弹框** (Episode Modal) - `player.html` 中的 `#episodeModal`

## Current Implementation

### Shared Overlay Element

- **Element**: `<div id="panelOverlay" class="panel-overlay">`
- **Location**: Both `index.html` (line 85) and `player.html` (line 242)

### CSS Styling

- **File**: `css/mobile-optimize.css` (lines 857-875)
- **Current behavior**:
  - Base: `background: rgba(0, 0, 0, 1)` with `opacity: 0`
  - When shown: `opacity: 0.5` (50% opacity)
  - Transition: `0.3s ease`

### Gesture Handling

- **File**: `js/mobile-panel-gestures.js`
- **Function**: `openPanel()` manages overlay visibility

## Acceptance Criteria

- [ ] All three modals use consistent backdrop styling
- [ ] Backdrop opacity, color, and transition timing are identical
- [ ] Backdrop behavior (show/hide) is consistent across all modals
- [ ] No visual differences between the three modal backdrops on mobile
- [ ] Existing functionality (gestures, animations) remains intact
- [ ] Code follows project's frontend guidelines

## Technical Scope

### Files to Review/Modify

1. `css/mobile-optimize.css` - Backdrop styling
2. `js/mobile-panel-gestures.js` - Overlay management logic
3. `index.html` - History and Settings panels
4. `player.html` - Episode modal

### Key Areas

- CSS classes and selectors for `.panel-overlay`
- JavaScript logic for showing/hiding overlay
- Transition timing and easing functions
- Z-index layering

## Notes

- Recent commit: `cbd5476 refactor(mobile-ui): 统一移动端弹框背景遮罩实现`
- This suggests work has already been done in this area
- Need to verify if implementation is complete and consistent
