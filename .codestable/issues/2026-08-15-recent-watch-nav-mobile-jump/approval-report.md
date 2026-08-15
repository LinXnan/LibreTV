# Approval Report — 2026-08-15-recent-watch-nav-mobile-jump

## issue-fast-path

**Status**: approved

**Rationale**: owner 已确认左右按钮点击均会下移，并批准修复方案。根因明确（`mobile-optimize.css:270-275` 的 `button:active { transform: scale(0.98) }` 与 `mobile-optimize.css:283-285` 的 `button:hover { transform: none }` 特异性覆盖 `.recent-watch-nav` 的 `translateY(-50%)` 垂直定位），修复 1 处（`css/index.css` 移动端媒体查询块内覆盖回垂直居中），无跨模块影响。

### 根因（file:line）

移动端全局触摸反馈样式覆盖了 `.recent-watch-nav` 的垂直定位：

1. `css/mobile-optimize.css:270-275`（`@media (max-width: 640px)`）：
   `button:active { transform: scale(0.98) }`（特异性 0,1,1）在点击按下时覆盖
   `.recent-watch-nav { transform: translateY(-50%) }`（特异性 0,1,0，`css/index.css:119-122`），
   导致 `translateY(-50%)` 垂直居中偏移丢失，按钮向下跳约半个按钮高度（移动端 32px 高 → 约 16px）。
2. `css/mobile-optimize.css:283-285`（`@media (hover: none)`）：
   `button:hover { transform: none }` 同样覆盖垂直定位；触摸设备点击后 `:hover` 状态持续期间，
   按钮保持下移位置，需点击别处才恢复。

### 修复方案（1 处）

在 `css/index.css` 移动端媒体查询块（`@media (max-width: 640px)`，组件所在文件）内，
为 `.recent-watch-nav` 显式声明 `:hover` / `:active` 的 transform，保留 `translateY(-50%)` 定位，
仅叠加轻微缩放反馈：

```css
.recent-watch-nav:hover,
.recent-watch-nav:active {
    transform: translateY(-50%);
}
.recent-watch-nav:active {
    transform: translateY(-50%) scale(0.95);
}
```

特异性 `.recent-watch-nav:active`（0,2,0）> `button:active`（0,1,1），可覆盖全局反馈；
不影响桌面端（>640px）与轮播切换逻辑。

## issue-fix-completion

**Status**: approved

**Rationale**: owner 已确认移动端按钮不再跳动、修复验证通过，指示提交。
