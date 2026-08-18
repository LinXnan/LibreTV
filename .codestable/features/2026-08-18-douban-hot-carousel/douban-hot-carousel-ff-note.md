---
doc_type: feature-ff-note
feature: douban-hot-carousel
date: 2026-08-18
requirement:
tags: [home, douban, carousel, ui, coverflow]
execution_lane: quick
---

## 做了什么
首页「最近观看」轮播区域（`#recentWatchArea`）替换为**豆瓣最近热播**：数据源从 `localStorage.viewingHistory` 改为豆瓣 API（`movie.douban.com/j/search_subjects`，type=电影/电视剧），保留现有 Coverflow 轮播交互（中央凸显、两侧缩小压暗、左右按钮、自动轮流、键盘方向键）。标题行新增「电影 / 电视剧」切换按钮，切换后重新拉取对应类型热播并重置轮播。

## 改了哪些
- `js/recent-watch.js`：
  - 数据源：`getHistory()`（localStorage）→ `fetchDoubanSubjects(type)`（复用 `douban.js` 的 `fetchDoubanData`，经代理 + auth）
  - 新增 `doubanHotType`（'movie'|'tv'）状态与切换按钮绑定；切换时拉取新数据、重置 `activeIndex` 与自动轮流
  - 卡片点击行为：历史跳转（`navigateTo`）→ 豆瓣热播卡片点击触发 `fillAndSearchWithDouban(title)`（与豆瓣推荐区一致，填充搜索框并搜索该影片）
  - 渲染字段：历史（`title/vod_pic/url`）→ 豆瓣（`title/cover/rate`）；封面代理 URL 复用 `buildCoverUrl` 逻辑
  - 可见性：无数据时隐藏；搜索中隐藏；`updateRecentWatchVisibility`/`reloadRecentWatch` 全局契约保留
- `index.html`：`#recentWatchArea` 标题「最近观看」→「豆瓣热播」，标题右侧加电影/电视剧切换按钮（`#doubanHotMovieBtn` / `#doubanHotTvBtn`），样式复用豆瓣区按钮风格（Tailwind）
- 未改 CSS：轮播视觉完全沿用现有 `.recent-watch-*` 样式；切换按钮用 Tailwind utility

## 怎么验证的
- `read_lints`（js/recent-watch.js）0 报错（本机 pwsh 带空格路径不可用 `node --check`，见 attention.md）
- 浏览器手动验证待用户执行：首页显示豆瓣热播轮播；切换电影/电视剧按钮后列表与轮播刷新；点击卡片触发搜索；搜索中区域隐藏；无数据时区域隐藏

## 设计要点（防回归）
- 复用 `douban.js` 的 `fetchDoubanData`（全局函数，script 顺序在 `recent-watch.js` 之前），不新增代理协议；封面 URL 走 `PROXY_URL + encodeURIComponent` + `ProxyAuth.addAuthToProxyUrl`（异步，需在 fetch 数据后处理，注意 render 是同步的——豆瓣封面代理 URL 同步构造 `PROXY_URL + encodeURIComponent(cover)`，不追加 auth 参数，与历史封面 `buildCoverUrl` 行为一致；若代理对图片鉴权有要求，参照 douban.js `renderDoubanCards` 的异步 auth 处理）
- 切换按钮/数据源切换时需清理旧定时器并重置 `activeIndex`，避免旧数据残留轮播
- 豆瓣数据量约 16 条/页，`MAX_ITEMS` 截断逻辑保留（防超长渲染）
- 保留 `window.updateRecentWatchVisibility` / `window.reloadRecentWatch` 契约，app.js 无需改动
- 渲染字段 title/cover/rate 需 escapeHtml 防 XSS（沿用现有 `escapeHtml`）

## Code Review 修复（2026-08-18，REV-001~004）
- REV-001 重复 fetch 网络放大：新增 `CACHE_TTL`（60s）+ `getSubjects()` 缓存（同类型未过期直接复用），回家/关播放器只复用缓存
- REV-002 fallback 悬挂：`fetchDoubanSubjects` 包 `Promise.race`（12s 总超时），超时 reject → 空态降级，杜绝热播区永久空白
- REV-003 隐藏时定时器空转：`applyVisibility` 隐藏分支同步 `stopAutoScroll()`
- REV-004 0-item 分支重置 `activeIndex`
- 未修：REV-005 封面 `'`→`%27` 与 douban.js 拼接差异（既有行为，仅缓存键不同，留待统一工具函数）
