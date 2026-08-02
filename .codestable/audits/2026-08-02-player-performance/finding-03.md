---
doc_type: audit-finding
audit: 2026-08-02-player-performance
finding_id: "performance-03"
nature: performance
severity: P2
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 03：广告过滤函数中大量 console.log 在生产环境无效开销

## 速答

`filterAdsFromM3U8` 函数在每次调用时输出多条 `console.log`（`player.js:1093-1094`、`1122`、`1127` 等），包括提取 TS 序号统计、DISCONTINUITY 标记位置、广告区间检测日志等。生产环境中这些日志无用户价值，但串行执行增加 CPU 开销。

## 关键证据

- `js/player.js:1093` — `console.log('[广告统计] 提取到的TS文件序号:', tsFiles.length, '个')`
- `js/player.js:1094` — `console.log('[广告统计] DISCONTINUITY标记位置:', Array.from(discontinuityPositions))`
- `js/player.js:1113` — `console.log('[广告统计] 检测到广告区间 #${discontinuityCount}...')`
- `js/player.js:1118` — `console.log('[广告统计] 广告区间结束...')`
- `js/player.js:1122` — `console.log('[广告统计] 本次检测到的广告片段数:', discontinuityCount)`
- `js/player.js:1127` — `console.log('[广告统计] 累计广告片段数:', totalAdsFiltered)`
- `js/player.js:497` — `debug: false`（HLS.js 本身的 debug 已关闭，但自定义 Loader 中的 console.log 不受此控制）

## 影响

每次 m3u8 加载（直播/时长码率切换时频繁触发）均执行 6+ 条字符串拼接和对象序列化（`Array.from(discontinuityPositions)`）。生产环境下无调试需求，纯浪费。

## 修复方向

删除这些 `console.log`，或包装为 `if (PLAYER_CONFIG.debug) console.log(...)` 条件输出。

## 建议动作

`cs-refactor`（简单删除）
