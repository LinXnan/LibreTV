---
doc_type: feature-ff-note
feature: player-inline-episode-nav
date: 2026-08-08
requirement:
tags: [player, ui, artplayer, navigation]
---

## 做了什么

把播放页的"上一集 / 下一集"导航入口搬进播放器控制栏内，分别位于播放/暂停按钮两侧：上一集在播放键左侧（index 5），下一集在播放键与音量之间（index 15）。按钮复用已有的 `playPreviousEpisode()` / `playNextEpisode()`，首集 / 末集时自动置灰禁用。随后按用户确认移除播放器下方页面级"集数导航"区按钮（避免重复入口），并把"第 X/Y 集"信息上移挂到页面顶部 header 的视频标题正下方（副标题样式，先试标题右侧后按用户要求改到正下方）；导航只走播放器控制栏。

## 改了哪些

- `js/player.js:573-611` — ArtPlayer `controls` 数组新增两个自定义 left 控件：
  - `prevEpisode`：`index: 5`（排在内置 `playAndPause` index 10 之前 → 播放键左侧），点击调用 `playPreviousEpisode()`，`mounted` 保存引用并刷新禁用态
  - `nextEpisode`：`index: 15`（排在 `playAndPause` 之后、`volume` index 20 之前 → 播放键右侧），点击调用 `playNextEpisode()`
  - 控件 `click` 内自带边界判断（首集/末集不响应），防呆
- `js/player.js` — 新增 `updatePlayerEpisodeControls()` 同步播放器内控件的 `disabled` class；删除已无页面按钮可操作的 `updateButtonStates()`，原两处调用点（初始化、切集）改为 `updatePlayerEpisodeControls()`
- `player.html:69-75` — header 中新增垂直居中容器（`flex-1 flex flex-col items-center justify-center min-w-0`），`#videoTitle` 在上、"第 X/Y 集"（`text-xs`、`mt-0.5`）在下，作为标题正下方的副标题样式
- `player.html` — 移除播放器下方原"集数信息"区块（`#episodeInfo` 仅保留 header 内一处，`updateEpisodeInfo()` 无需改动）
- `css/player.css:11-13` — `.container.mx-auto` 顶部间距 56px → 88px（header 含标题+集数两行后增高）
- `css/player.css` 末尾 — 移动端（≤640px）覆盖 `.container.mx-auto` 的 `margin-top: calc(88px + env(safe-area-inset-top)) !important`，覆盖 styles.css 的全局 56px（不改全局以免影响 index/about 页）
- `css/player.css:890-916` — 新增控制栏图标尺寸、hover 高亮（`#00ccff`）与禁用态样式（`opacity: 0.35; pointer-events: none`）

## 怎么验证的

本地 `npm run dev` 后浏览器打开播放页：控制栏出现上一集（播放键左）/ 下一集（播放键右）图标按钮；点击正常切换剧集；首集时上一集置灰不可点，末集时下一集置灰；播放器下方不再有按钮与集数信息，"第 X/Y 集"以小字显示在顶部标题正下方；切集时集数信息同步更新；header 增高后播放器顶部不被遮挡（桌面与移动端）；全屏与移动端控制栏显示正常。快捷键 Alt+←/→ 不受影响。

## 顺手发现（可选，不阻塞）

- `.player-container.controls-locked` 的屏蔽样式用的是 `.dplayer-*` 类名（`css/styles.css:864-871`），但实际播放器是 ArtPlayer（类名 `.art-*`），疑似旧 DPlayer 遗留，锁定时控制栏可能未真正屏蔽——属既有问题，本次不处理。
