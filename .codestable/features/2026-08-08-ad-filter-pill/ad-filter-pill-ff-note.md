---
doc_type: feature-ff-note
feature: ad-filter-pill
date: 2026-08-08
requirement:
tags: [player, ui, ad-filter]
---

## 做了什么

播放页广告过滤统计从常驻整行横条改为轻量胶囊：页面初始化/切集时显示于播放器上方中间，5 秒后自动消失；播放中过滤到广告只更新计数（胶囊已隐藏则不重新弹出，避免计时被反复重置）。过滤开关关闭时胶囊隐藏。

## 改了哪些
- `player.html:102-109` — 广告统计由独立容器改为 `#playerContainer` 内绝对定位胶囊（上方居中、半透明、pointer-events-none）
- `js/player.js:93` — 新增 `adFilterHideTimer` 自动隐藏计时器
- `js/player.js:1116-1128` — `updateAdFilterDisplay` 只更新数字与动画，不再重置胶囊计时（修复"永不消失"根因）
- `js/player.js:1131-1141` — 新增 `showAdFilterStats`：显示胶囊并 5 秒后自动隐藏
- `js/player.js:1144-1157` — `updateAdFilterStatsVisibility` 改为复用 `showAdFilterStats`，开关关闭时清除计时并隐藏
- `js/player.js:1242` — `playEpisode` 切集时仅在 `adFilteringEnabled` 时重新展示胶囊（review-fix 补开关判断）
- `css/player.css:390-417` — 移除 hover translateY（干扰绝对定位），保留阴影反馈与计数跳动动画

## 怎么验证的

本地 `npm run dev` 后浏览器硬刷新打开播放页：胶囊在播放器上方居中出现，5 秒后自动消失；切集时重新出现 5 秒后消失；设置中关闭广告过滤后胶囊不显示。用户确认效果 OK。

## 顺手发现（可选，不阻塞）
- `server.mjs:21` `cacheMaxAge: '1d'` 静态资源缓存 1 天，改 JS 后需硬刷新才生效（用户选择保持现状）
