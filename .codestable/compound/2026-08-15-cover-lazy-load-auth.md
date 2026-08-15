# 新增 UI 的图片必须走既有 lazy-load 体系，直接 img src= 请求 /proxy 会被 403

## 背景

为 LibreTV 首页新增"继续观看弹窗"时，封面渲染初版用 `<img src="/proxy/https%3A%2F%2F...">` 直连，结果用户实测封面一直加载失败（只剩渐变占位）。排查发现项目封面体系是：图片元素带 `class="lazy-load" data-src="..."`，由 `js/optimize-apply.js` 的 MutationObserver 自动交给 `LazyImageLoader` 接管，加载时会**自动调用 `window.ProxyAuth.addAuthToProxyUrl()` 给代理 URL 追加 `auth` + `t` 鉴权参数**。直接 `src=` 绕过了这条链路 → 代理返回 403 → 图片不显示。

顺带同一个 feature 还踩到第二个坑：弹窗显隐不能用 `element.style.display='flex'`，因为 `index.html` 内联样式 `.hidden { display: none !important; }` 优先级更高会覆盖内联 display，导致弹窗永远不显示。正确做法是切换 class（`classList.remove('hidden')` + `classList.add('flex')`），与 passwordModal 一致。

## 结论

1. **新增 UI 要展示任何经 `/proxy/` 的图片（封面/缩略图/背景），必须复用既有加载体系**：`<img class="lazy-load" data-src="..." referrerpolicy="no-referrer">`。依赖 `optimize-apply.js` 的 MutationObserver 自动接管并补代理鉴权；不要手写 `img.src = '/proxy/...'` 直连。判断标准：看既有实现（历史面板 `ui.js`、最近观看 `recent-watch.js`、详情页背景 `app.js`）怎么写的，照抄，别另起炉灶。
2. **DOM 上带 `hidden` class 的元素，显示/隐藏一律用 classList 切换**（`.hidden` 是 `display:none!important`，`style.display` 会被覆盖）；元素同时要加 `flex` class 才显示为 flex 布局。弹窗、抽屉等所有既有组件都是这个模式。
3. 新增前端模块前先 grep 现有同类功能的实现路径并复用，本项目图片加载/弹窗显隐/代理 URL 都有成熟约定，绕开它们就是给自己埋 bug。

## 证据

- `js/optimize-apply.js` — MutationObserver 扫描 `img.lazy-load[data-src]` 交给 LazyImageLoader（`js/utils.js`）
- `js/utils.js:261-269` — `handleIntersection` 对 `data-src` 用 `window.ProxyAuth.addAuthToProxyUrl()` 加鉴权后再设置 `img.src`
- `js/proxy-auth.js` — `addAuthToProxyUrl`：给 `/proxy/` URL 追加 `auth`(sha256 密码哈希) + `t`(时间戳)
- `js/ui.js:508-516`（历史面板）、`js/recent-watch.js`（最近观看）、`js/app.js:1205-1209`（详情页背景）— 既有封面全部用 `lazy-load data-src`
- `index.html` 内联 `<style>.hidden{display:none!important}` + `js/password.js` 弹窗显隐用 classList
- 修复记录：`.codestable/features/2026-08-15-continue-watch-prompt/continue-watch-prompt-ff-note.md`
