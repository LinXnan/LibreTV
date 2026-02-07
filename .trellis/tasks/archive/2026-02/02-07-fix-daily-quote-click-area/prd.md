# 优化每日一言点击区域 - 仅文字可点击

## Goal
优化每日一言的点击交互体验，使得只有文字本身可以点击刷新，而不是整行区域都可以点击。

## Current Problem
- 整个 `dailyQuoteSection` div 都有 `cursor-pointer` 样式
- JavaScript 将点击事件绑定在整个 section 容器上
- 结果：点击文字周围的空白区域也会触发刷新，用户体验不佳

## Requirements
1. **HTML 修改** (index.html):
   - 从 `dailyQuoteSection` div 移除 `cursor-pointer` 类
   - 给 `dailyQuoteText` 和 `dailyQuoteFrom` 元素添加 `cursor-pointer` 类
   - 保持 section 的 `role="button"` 和 `tabindex="0"` 用于键盘访问

2. **JavaScript 修改** (js/daily-quote.js):
   - 将点击事件监听器从 section 移到具体的文字元素上
   - 保持键盘事件监听器在 section 上（用于无障碍访问）
   - 确保所有现有功能正常工作（冷却时间、动画、状态管理等）

## Acceptance Criteria
- [ ] 点击每日一言的文字可以刷新内容
- [ ] 点击文字周围的空白区域不会触发刷新
- [ ] 键盘访问（Enter/Space）仍然正常工作
- [ ] 鼠标悬停在文字上显示 pointer 光标
- [ ] 鼠标悬停在空白区域显示默认光标
- [ ] 所有现有功能保持不变（冷却时间、动画、错误处理等）
- [ ] 代码遵循项目的前端开发规范

## Technical Notes
- 需要修改的文件：
  - `index.html` (lines 305-313)
  - `js/daily-quote.js` (lines 392-396)
- 保持代码简洁，不要过度工程化
- 确保 null 检查和错误处理
- 遵循现有的代码风格和模式

## Files to Modify
- `index.html` - 调整 CSS 类和结构
- `js/daily-quote.js` - 调整事件监听器绑定
