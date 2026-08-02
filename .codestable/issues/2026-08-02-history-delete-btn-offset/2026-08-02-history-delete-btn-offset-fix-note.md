---
doc_type: issue-fix
issue: 2026-08-02-history-delete-btn-offset
status: confirmed
path: fast-track
fix_date: 2026-08-02
tags: []
---

# 移动端历史记录删除按钮错位 — 修复记录

## 1. 问题描述

移动端（≤640px）历史面板中，每条影片记录的删除按钮（✕）不在卡片右上角，而是错位到卡片下方文字区域。

## 2. 根因

HTML 模板 `js/ui.js:622` 将删除 `<button>` 放在 `.history-info` 内部。桌面端 `.history-info` 是 `position: static` 的 flex 子项，按钮 `absolute right-2 top-2` 的参照物向上穿透到 `position: relative` 的 `.history-item`，定位正常。

但移动端 `styles.css:2170` 把 `.history-info` 设为 `position: absolute; bottom: 0; left: 0; right: 0`（卡片底部渐变信息区），这使它成为按钮的定位参照物，导致按钮跑到卡片下方而非右上角。

## 3. 修复方案

将删除 `<button>` + 倍速徽章从 `.history-info` 内部移到外层，作为 `.history-item`（`position: relative`）的直接子元素。

- 按钮的 `absolute right-2 top-2` 在桌面端和移动端都参照 `.history-item` → 始终定位到卡片右上角
- CSS 无需任何修改：`styles.css:2255` 的移动端 `.history-item .delete-btn { position: absolute; top: 4px; right: 4px }` 规则和中 PC 端 hover opacity 规则 (`styles.css:765-772`) 均对移动端保持一致

## 4. 改动文件清单

| 文件 | 改动 | 行号 |
|------|------|------|
| `js/ui.js` | 删除按钮 + 倍速徽章从 `.history-info` 内部移到 `.history-item` 直接子级 | 618–643 |

## 5. 验证结果

- ✅ 本地 `npm run dev` 启动，浏览器设备模拟器 640px 验证通过：删除按钮稳定显示在卡片右上角
- ✅ 倍速徽章不受影响
- ✅ 桌面端删除按钮位置不变
- ✅ 其他交互（点击删除、停止冒泡、Undo toast）均正常

## 6. 遗留事项

无。