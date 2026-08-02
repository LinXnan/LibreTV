# 移动端历史记录删除按钮错位

## 问题描述

移动端（≤640px）历史记录面板中，每条影片记录右上角的删除按钮（✕）不在卡片右上角，而是错位到了卡片下方靠近信息文字的位置。

## 预期行为

删除按钮始终显示在历史卡片右上角。

## 实际行为

移动端卡片布局中，删除按钮位置偏下，不贴合卡片右上角。

## 影响范围

- 移动端（`@media (max-width: 640px)`）历史面板 UI
- 不影响桌面端
- CSS 无需修改，问题在 HTML 结构

## 根因总结

HTML 结构中删除 `<button>` 在 `.history-info` 内部（`js/ui.js:622`）：

```html
<div class="history-item ...">
    <div class="history-info">
        <button class="... delete-btn">...</button>  <!-- 此处 -->
        ...
    </div>
</div>
```

桌面端 `.history-info` 是普通 flex 子项，`position: static`，按钮 `absolute right-2 top-2` 相对于 `.history-item` 定位 → 正常。

移动端 `styles.css:2170` 把 `.history-info` 设为 `position: absolute; bottom: 0; left: 0; right: 0`，导致内部的删除按钮变成相对于 `.history-info` 的底部区域定位，而非卡片右上角。

## 修复方向

将删除 `<button>` 移到 `.history-info` 外面，直接作为 `.history-item` 的子元素，使其 `absolute` 定位参照物变为整个卡片容器。

## 路径评估

- ✅ 根因明确（HTML 层级 + 移动端 absolute 冲突）
- ✅ 修复范围极小（1 处 DOM 层级调整）
- ✅ 无跨模块影响
- ➡️ **快速通道**