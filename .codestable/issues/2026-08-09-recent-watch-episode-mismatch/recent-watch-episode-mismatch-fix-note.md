---
doc_type: issue-fix-note
issue: 2026-08-09-recent-watch-episode-mismatch
status: confirmed
severity: P2
tags: [player, history, recent-watch, localStorage]
---

# 最近观看进入播放页集数显示不正确 Fix Note

## 根因

`js/player.js` 的 `saveToHistory()` 生成历史记录的 `url` 时不携带 `episodes` 参数（约 1541 行），仅把集数列表存进历史条目的 `episodes` 字段。`player.js` 的 `initializePageContent()`（约 253-261 行）在 URL 无 `episodes` 参数时回退读取 `localStorage.currentEpisodes`，而该值只反映**最后一次**播放的剧集列表。

首页"最近观看"轮播（`js/recent-watch.js` `bindCarouselControls`）点击卡片直接 `navigateTo(item.url)` 跳转，跳转前**未**像 `ui.js` 的 `playFromHistory`（约 908-912 行）那样把历史条目的 `episodes` 同步到 `localStorage.currentEpisodes`。

因此先看 40 集剧 A、再看 10 集剧 B 后，从最近观看点进剧 A，播放页读到剧 B 的集数 → 集数总数、选集、连播全部错误。

## 改动

仅修改 `js/recent-watch.js` 的 `bindCarouselControls`：

1. 新增 `prepareEpisodeContextForNavigation(itemUrl)`：从 `viewingHistory` 按 `url` 精确匹配该历史条目，若其 `episodes` 为非空数组，则写入 `localStorage.currentEpisodes`（与 `ui.js playFromHistory` 行为一致）。
2. click 与 keydown 两个处理器中，`navigateTo(url)` 之前先调用 `prepareEpisodeContextForNavigation(url)`；同步失败仅吞错不阻断跳转。
3. （code review REV-001 修复）url 与当前历史失配（如跨标签页对同名剧就地更新 url）时输出 `console.warn` 日志，避免边缘场景下集数同步静默失效、原始问题无法排查；失败仍不阻断跳转。

未改动 URL 结构、导航方式（仍直接打开 `player.html`）及 `player.js` 的集数恢复逻辑；`index`/`position`/`source`/`id` 等参数本就携带在历史 URL 中，不受影响。

## 验证

- 语法检查：`node --check js/recent-watch.js` 通过；IDE lint 无新增错误。
- 逻辑级推演：
  1. `saveToHistory` 更新分支会同步历史条目 `episodes`（js/player.js:1589-1591），点击时 `getHistory()` 重新解析 localStorage，取到的是最新集数。
  2. 匹配键 `h.url === itemUrl` 与渲染 `data-url` 完全一致（均来自 `item.url`），S2/S3 克隆区同 URL 不受影响。
  3. 历史条目无 `episodes`（早期数据）时维持原行为（读 localStorage），不更糟。
  4. url 失配（跨标签页就地更新）时输出 `console.warn`，问题可观测。
- code review：独立 Task agent 对抗式审查无 blocking；REV-001（失配静默）已修复，REV-002/003 经核验降级为 suggestion/residual-risk（见 review 报告）。
- 待浏览器验证：本地 `npm run dev`，先看 40 集剧 A、再看 10 集剧 B，回首页从最近观看点剧 A，确认播放页显示"第 X/40 集"且集数按钮为 40 个。

## 遗留风险

- 历史旧条目缺 `episodes` 字段时仍回退读取 `localStorage.currentEpisodes`，可能依旧错误（仅影响历史存量旧数据，新保存的记录均带 `episodes`）。
- `ui.js playFromHistory` 另有"尝试拉取最新剧集并回写历史"的同步逻辑，`recent-watch.js` 未复制该逻辑（保持最小改动），因此从最近观看进入时使用历史中缓存的集数，而非在线刷新。
- 无自动化测试，修复依赖浏览器手动验证。
