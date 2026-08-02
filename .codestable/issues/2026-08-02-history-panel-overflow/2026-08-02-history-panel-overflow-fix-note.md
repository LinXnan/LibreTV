---
doc_type: issue-fix-note
issue: 2026-08-02-history-panel-overflow
status: completed
root_cause:
  - #historyList (移动端面板滚动容器) 只设置了 overflow-y: auto，缺少 overflow-x: hidden，导致横向滑动时可回弹出现大片空白。
  - 未加 overscroll-behavior-x: contain，导致 iOS/Safari 橡皮筋链可横向溢出。
code_changes:
  - 在 css/styles.css 移动端 @media 块，对 #historyList、#settingsPanel .space-y-5、#episodeModalContent 补充 overflow-x: hidden 和 overscroll-behavior-x: contain。
  - 保持 DOM 结构不变，纯 CSS 侧修复，不影响桌面端。
verification:
  - 手机浏览器验证：横向滑动历史面板不再出现空白区，只能垂直滚动。
  - 已用 Chrome DevTools 移动端模拟、iOS Safari 真机测试效果。
residual_risk:
  - 没有直接影响主功能，纯 UI 体验提升。
  - 若后续调整容器结构要注意横向溢出属性保持一致。
---

# 2026-08-02 移动端历史面板横向溢出 Fix Note

## 修复总结

- 增加 overflow-x: hidden，裁剪横向溢出。
- 增加 overscroll-behavior-x: contain，阻止橡皮筋回弹。
- 保证只影响移动端面板滚动容器，不影响桌面端。

## 验证

- 手机 Chrome/iOS Safari 横向滑动历史面板无空白，体验恢复正常。
- 桌面端横向自适应不受影响。

## 遗留风险

- 若后续需变更面板布局，务必复查 overflow-x 配置并验证移动端体验。
