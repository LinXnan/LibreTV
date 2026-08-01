---
doc_type: learning
track: knowledge
date: 2026-08-01
slug: responsive-single-dom-pattern
component: 全局响应式架构
tags: [responsive, css, dom, mobile-first, media-query, anti-pattern]
refactor: 2026-08-01-css-unification
---

# 响应式设计："单一 DOM + CSS 媒体查询" 模式

## 背景

LibreTV 项目从桌面端起步，移动端适配以"打补丁"方式追加。历经多次迭代后形成了三层双轨制：

- **JS 层**：`app.js` / `ui.js` / `player.js` 中 12+ 处 `if (window.innerWidth <= 640)` 生成完全不同的 HTML 结构
- **CSS 层**：3 个独立移动端 CSS 文件（`mobile-optimize.css` / `mobile-panels-modern.css` / `mobile-settings-modern.css`），~1400 行，用 `!important` 覆盖主样式
- **HTML 层**：Tailwind 响应式前缀（`sm:` / `md:`）零星使用，与上述两套体系并存冲突

2026-08-01 完成全项目响应式重构（commits `56b399d..c8628c8`），将上述三层统一为一种模式。

## 指导原则

### 原则 1：JS 永远只生成一套 DOM

```javascript
// ❌ 错误 — JS 根据屏幕宽度分岔出不同的 HTML
const isMobile = window.innerWidth <= 640;
if (isMobile) {
    item.className = 'mobile-api-item';
    item.innerHTML = `<div class="mobile-api-content">...</div>`;
} else {
    item.className = 'flex items-center';
    item.innerHTML = `<input class="form-checkbox">...`;
}

// ✅ 正确 — 始终生成同一套 HTML，CSS 处理差异
const item = document.createElement('label');
item.className = 'mobile-api-item';
item.innerHTML = `<div class="mobile-api-content">...</div>`;
```

### 原则 2：每个组件的样式放在一处，用 `@media` 分隔

```css
/* 基础（移动优先） */
.history-item { display: block; padding: 0; }

/* 桌面端增强 */
@media (min-width: 641px) {
    .history-item { display: flex; flex-direction: row; padding: 12px; }
}
```

### 原则 3：`window.innerWidth` 只用于行为，不用于结构

- ✅ 分页条数、手势激活、面板动画方式
- ❌ 选择 CSS 类名、决定 HTML 标签、控制 DOM 结构

### 原则 4：不创建独立的移动端 CSS 文件

新增组件的移动端样式写在组件所在 CSS 文件的 `@media (max-width: 640px)` 块内。独立 `mobile-*.css` 文件是技术债的信号——它意味着移动端样式在"打补丁"而非"原生适配"。

### 原则 5：`!important` 是组织问题的信号

本次重构前项目中有 100+ 条 `!important`，大部分用于跨文件覆盖（`mobile-optimize.css` 覆盖 `styles.css`）。合并后大量 `!important` 自然消除——相同选择器在正确媒体查询内，不竞争。

## 为什么重要

**维护成本**：双轨制下，每次改功能需要改两处（移动端 HTML + 桌面端 HTML），两处 CSS，容易漏改导致一端异常。

**新页面风险**：`about.html` 加载了 `styles.css` 中的 body 滚动接管样式（`overflow: hidden; position: fixed`），而该样式原本只为首頁/播放页设计。全局样式 + 无页面限定 = 新页面被意外影响。统一模式下，这类规则必须加页面限定或组件作用域。

**重构证据**：本次重构净删除 462 行代码（CSS -325 + JS -137），同时功能保持不变。双轨制 = 膨胀的代码量。

## 何时适用

- 所有面向多端的纯静态 / SSR 前端项目
- 尤其适用于 Tailwind CSS（响应式前缀天然支持）和 Vanilla JS（无框架响应式抽象）项目
- **不适用**：需要在移动端和桌面端提供根本不同交互模式（如下拉菜单 vs 底部抽屉），此时 UA 检测可接受——但应限于交互容器层面，叶子组件仍应遵循本模式

## 相关资源

- 重构设计：`.codestable/refactors/2026-08-01-css-unification/css-unification-refactor-design.md`
- 代码审查：`.codestable/refactors/2026-08-01-css-unification/css-unification-review.md`
- 项目规范：`CLAUDE.md` → 代码约定 → 响应式设计
