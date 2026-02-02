# Mobile Panel Pattern

> 移动端面板管理模式

---

## 概述

移动端使用底部抽屉式面板（Bottom Sheet）模式，通过遮罩层和返回键控制面板的打开/关闭。

**适用场景**:
- 历史记录面板
- 设置面板
- 选集面板

---

## 核心模块

**文件**: `js/mobile-panel-gestures.js`

**功能**:
- 面板打开/关闭管理
- 遮罩层点击关闭
- 返回键支持
- 焦点管理
- 无障碍功能

---

## 使用方式

### 打开面板

```javascript
const panel = document.getElementById('historyPanel');
const triggerButton = document.getElementById('historyBtn');
window.openPanel(panel, triggerButton);
```

### 关闭面板

```javascript
const panel = document.getElementById('historyPanel');
window.closePanel(panel);
```

---

## 关闭方式

用户可以通过以下方式关闭面板：

1. **点击遮罩层** - 点击面板外的半透明遮罩
2. **返回键** - 使用浏览器返回键或设备返回键

**注意**: 下滑关闭手势已在 2026-02-02 移除（用户反馈容易误触）

---

## 实现细节

### 面板状态管理

```javascript
// 打开面板
panel.classList.add('show');
overlay.classList.add('show');
panel.setAttribute('aria-hidden', 'false');
document.body.style.overflow = 'hidden';

// 关闭面板
panel.classList.remove('show');
overlay.classList.remove('show');
panel.setAttribute('aria-hidden', 'true');
document.body.style.overflow = '';
```

### 焦点管理

- 打开面板时，焦点移动到关闭按钮
- 关闭面板时，焦点返回到触发按钮
- 使用 `WeakMap` 存储触发元素引用

### 无障碍支持

- ARIA 属性管理（`aria-hidden`）
- 屏幕阅读器通知（通过 live region）
- 焦点陷阱（防止焦点逃逸到面板外）

---

## 历史变更

### 2026-02-02: 移除下滑关闭手势

**原因**: 用户反馈下滑手势容易误触，影响使用体验

**移除内容**:
- 触摸事件监听器（touchstart/move/end）
- 手势识别逻辑
- 拖拽状态管理
- `.dragging` CSS 样式

**保留功能**:
- 遮罩层点击关闭
- 返回键支持
- 焦点管理
- 无障碍功能

**提交**: a926018

---

## 最佳实践

1. **始终提供触发元素**: 调用 `openPanel()` 时传入触发按钮，确保焦点可以正确返回
2. **使用统一的遮罩层**: 所有面板共享 `#panelOverlay` 元素
3. **处理特殊面板**: 选集面板（`#episodeModal`）需要额外的 `hidden`/`flex` class 切换
4. **测试无障碍**: 确保键盘导航和屏幕阅读器正常工作

---

## 相关文件

- `js/mobile-panel-gestures.js` - 核心逻辑
- `css/mobile-optimize.css` - 移动端样式
- `js/ui.js` - 历史记录和设置面板业务逻辑
- `js/player.js` - 选集面板业务逻辑
