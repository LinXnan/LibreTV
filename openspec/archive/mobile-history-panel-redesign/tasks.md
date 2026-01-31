# Tasks: mobile-history-panel-redesign

## Overview
移动端历史记录面板重设计：2列卡片网格 + 角落删除按钮 + 撤销功能

## Tasks

- [x] **Task 1: CSS 样式** - 添加移动端历史卡片网格样式
  - 文件: `css/mobile-optimize.css`
  - 内容:
    - 移动端历史网格容器 (2列, <360px回退单列)
    - 历史卡片样式
    - 卡片内容样式 (标题2行截断、元信息、进度条、时间戳、速度徽章)
    - 角落删除按钮样式
    - 撤销 toast 样式及动画

- [x] **Task 2: JS 渲染逻辑** - 修改历史记录渲染 + 撤销系统
  - 文件: `js/ui.js`
  - 内容:
    - 修改 `loadViewingHistory()` 添加移动端卡片模板
    - 添加撤销状态管理 (window.historyUndoState)
    - 实现 `deleteHistoryItemWithUndo()` 延迟删除
    - 实现 `undoHistoryDeletion()` 撤销恢复
    - 实现 `showHistoryUndoToast()` / `hideHistoryUndoToast()`
    - 添加 `playFromHistoryByIndex()` 安全播放函数

- [x] ~~**Task 3: 手势支持**~~ - 已移除左滑删除功能

## Constraints Reference
- HC-1: 仅影响移动端 (≤640px) ✓
- HC-2: 保留所有现有功能 ✓
- HC-5: 数据结构不变 ✓

## Status: COMPLETED ✓

## 变更说明
- 移动端历史面板显示为 2 列卡片网格
- 极窄屏幕 (<360px) 自动回退为单列
- 点击角落 X 按钮删除，显示 3 秒撤销 toast
- 桌面端布局不受影响
