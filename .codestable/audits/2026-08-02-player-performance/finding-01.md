---
doc_type: audit-finding
audit: 2026-08-02-player-performance
finding_id: "performance-01"
nature: performance
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 01：CustomHlsJsLoader 每次 m3u8 加载同步执行 O(n) 广告过滤，阻塞下载路径

## 速答

`CustomHlsJsLoader` 在 HLS.js 每次加载 manifest/level 类型 m3u8 文件后，在 `onSuccess` 回调中**同步执行** `filterAdsFromM3U8`——包括 `split('\n')` 切分全部行、第一遍遍历提取 TS 序号和 DISCONTINUITY 标记、第二遍遍历过滤广告行，伴随正则匹配和大量 `console.log`。这是 HLS.js 下载管线的关键路径，长播放列表开销可感知。

## 关键证据

- `js/player.js:1025-1046` — `CustomHlsJsLoader` 拦截 `manifest` / `level` 类型的 `onSuccess` 回调，每次 m3u8 请求完成后串行调用 `filterAdsFromM3U8`
- `js/player.js:1050-1100+` — `filterAdsFromM3U8` 分两轮遍历所有行：第一遍（1065-1091）逐行 trim + `.endsWith('.ts')` 正则匹配提取序号 + `discontinuityPositions` Set 记录；第二遍（1133+）再次逐行过滤。每次 manifest 刷新都触发此开销
- `js/player.js:1093-1094` — `console.log('[广告统计] 提取到的TS文件序号:', tsFiles.length, '个')` 等日志在生产环境无用户价值但串行执行
- `js/player.js:498` — `loader: adFilteringEnabled ? CustomHlsJsLoader : Hls.DefaultConfig.loader`，广告过滤关闭后可直接跳过 Loader 开销

## 影响

假设一个播放列表包含 200 个 .ts 片段（典型电影长度），每次 m3u8 加载（约 200-500 行文本）需在两遍遍历中处理。虽然单次开销小（毫秒级），但在频繁刷新（live 流或自适应码率切换时多次拉取多级播放列表）的累积效应下可感知卡顿。关闭广告过滤（设置面板开关）可立即消除此路径。

## 修复方向

- 短期：用户可直接在设置面板关闭广告过滤，HLS.js 使用默认 Loader（`Hls.DefaultConfig.loader`），零额外开销
- 中期：若保留过滤，将 `filterAdsFromM3U8` 改为单次遍历（合并统计和过滤逻辑），删除生产 `console.log`

## 建议动作

`cs-refactor`（优化广告过滤实现或提供关闭建议）
