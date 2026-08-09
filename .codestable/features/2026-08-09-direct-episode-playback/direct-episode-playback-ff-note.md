---
doc_type: feature-ff-note
feature: direct-episode-playback
date: 2026-08-09
requirement:
tags: [playback, ux, navigation]
---

## 做了什么
点击选集时直接进入 `player.html`，不再经过 `watch.html` 中转（去掉 2.8 秒"正在加载播放器..."等待页）。`watch.html` / `js/watch.js` / `css/watch.css` 仍保留作为老链接/书签/分享的兼容重定向，不影响新流程。

## 改了哪些
- `js/app.js:1262-1300` — `playVideo()` 重写：
  - 跳转目标 `watch.html?...` 改为 `player.html?...`，参数集（`id`/`source`/`url`/`index`/`title`/`vod_pic`）保持一致
  - 原 `&back=` 改为 `&returnUrl=`（player.js 真正读取的字段），仍仅在 `currentPath` 是首页/根路径时透传
  - 7 个 localStorage 写入与原逻辑完全一致（`currentVideoTitle` / `currentEpisodes` / `currentEpisodeIndex` / `currentSourceCode` / `lastPlayTime` / `lastSearchPage` / `lastPageUrl`），保留 player.js:goBack 的 `lastPageUrl` 兜底路径
- 未动 `watch.html` / `js/watch.js` / `css/watch.css`（老链接兼容）
- 未动 `js/ui.js:916`、`:930` 关于 `/watch.html` 路径的判断（历史记录回放兼容，仍然必要）

## 怎么验证的
- `node --check js/app.js` 通过、`read_lints` 无报错
- 改动严格收口于 `playVideo()` 函数体；外部调用点（`prev/next` 翻集按钮、modal 中第 N 集按钮）入参不变，仍走 `playVideo()`
- 与 player.js 入参对齐：`player.js:initializePageContent` 已支持 `url`/`title`/`source`/`index`/`position`/`vod_pic`/`id` 等参数；本改动未引入新参数，`returnUrl` 由 player.js:goBack 第一步消费

待本地 `npm run dev` 后浏览器手动验证：首页 → 搜索 → 点开详情 → 点第 N 集 → 直接进入播放器、不出现中间加载页；返回按钮仍能回到首页/搜索页。

## 顺手发现（可选，不阻塞）
- `js/watch.js:69-73` 设置的 `cameFromSearch` / `searchPageUrl` 两个 localStorage 项整库无人读取，建议后续清理（出 watch.html 退场时同步移除）
- `js/ui.js:916` 与 `:930` 对 `watch.html` 的兼容判断如果未来决定彻底下线 watch.html（删除文件），需要同步清理
- 没有任何调用点再生成 `watch.html` 链接后，`index-page.js:23-25` 的 `/watch` 路径短路也无意义，可一同清理
