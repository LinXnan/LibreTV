---
doc_type: audit-index
date: 2026-08-02
slug: player-performance
scope: 播放管线性能瓶颈（HLS.js + 自定义 Loader + 代理层）
dimensions: [performance]
status: done
total_findings: 3
---

# player-performance 审计报告

## 范围

| 项 | 值 |
|---|---|
| 审计对象 | `js/player.js` 的 HLS.js 配置、CustomHlsJsLoader 广告过滤 Loader、`filterAdsFromM3U8` 广告过滤函数；代理层的 `fetchContentWithType` 实现（`api/proxy/[...path].mjs`、`netlify/functions/proxy.mjs`） |
| 维度 | performance |
| 触发 | 用户反馈播放视频感觉慢/卡，排查提速方式 |

## 总评

共发现 **3 条** performance 问题：P1×1、P2×2。最影响感知的是 **CustomHlsJsLoader 在每次 m3u8 加载时同步串行执行广告过滤**——包括 split→双次遍历→正则匹配→统计→log，这对长播放列表每次都有可感知开销。另外 `lowLatencyMode: true` 对 VOD 流不必要反而增加片段请求频率，以及生产环境大量 `console.log` 无明显价值但消耗 CPU。

HLS.js 的缓冲策略（`getAdaptiveHlsConfig`）、智能画质调整和 Web Worker 已有良好优化。代理层的二进制分支（`arrayBuffer`）对视频片段（.ts）处理正确。

## 发现清单

| # | 文件 | 标题 | 性质 | 严重度 | 置信度 | 建议动作 |
|---|---|---|---|---|---|---|
| 01 | js/player.js:1025-1100+ | CustomHlsJsLoader 每次 m3u8 加载同步执行 O(n) 广告过滤，阻塞下载路径 | performance | P1 | high | cs-refactor |
| 02 | js/player.js:500 | lowLatencyMode: true 对 VOD 不必要，增加片段请求频率 | performance | P2 | high | cs-refactor |
| 03 | js/player.js:1093-1094 等多处 | 广告过滤函数中大量 console.log 在生产环境无效开销 | performance | P2 | high | cs-refactor |

## 按维度分布

| 性质 | P0 | P1 | P2 | 合计 |
|---|---|---|---|---|
| performance | 0 | 1 | 2 | 3 |

## 下一步建议

- **P1**：#01 广告过滤负载优化——关闭广告过滤（设置面板可关）能立刻体验差异；若要保留过滤，可改为异步或减少遍历次数
- **P2**：#02 lowLatencyMode 对 VOD 改为 false，减少不必要的片段请求频率
- **P2**：#03 生产环境删掉或条件化 console.log
