---
doc_type: audit-finding
audit: 2026-08-02-player-performance
finding_id: "performance-02"
nature: performance
severity: P2
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 02：lowLatencyMode: true 对 VOD 流不必要，增加片段请求频率

## 速答

`getAdaptiveHlsConfig` 中硬编码 `lowLatencyMode: true`（`player.js:500`），使 HLS.js 以低延迟模式拉取片段——更频繁的播放列表刷新、更小的缓冲窗口。对 VOD（点播）内容而言，低延迟无实际收益，反而增加 m3u8 请求次数和自定义 Loader 过滤开销。

## 关键证据

- `js/player.js:500` — `lowLatencyMode: true`（`getAdaptiveHlsConfig` 返回值）
- ArtPlayer 初始化设置 `isLive: false`（`player.js:539`），表明项目以 VOD 为主要场景
- `lowLatencyMode` 是 HLS.js 的低延迟 HLS（LL-HLS）特性，专为直播优化；VOD 场景下会增加播放列表轮询频率和片段预加载策略差异

## 影响

VOD 视频不需要低延迟，开启此模式后 HLS.js 会更激进地刷新播放列表，每次刷新触发 CustomHlsJsLoader 的 m3u8 过滤（见 Finding-01），形成叠加效应。对于普通点播观众，此模式无任何体验提升。

## 修复方向

将 `lowLatencyMode` 改为 `false`，或根据 `isLive` 参数动态设置——直播场景保留 `true`，VOD 场景设 `false`。

## 建议动作

`cs-refactor`（单行改动，低风险）
