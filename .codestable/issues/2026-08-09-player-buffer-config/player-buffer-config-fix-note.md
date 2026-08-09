---
doc_type: issue-fix
issue: 2026-08-09-player-buffer-config
status: confirmed
path: fast-track
fix_date: 2026-08-09
tags: [player, playback, buffering, network-adaptation]
---

# 播放器缓冲配置统一环境处理 修复记录

## 1. 问题描述

弱网/源站慢时播放频繁"打转"（实测 TS 分片 2-10s、个别 82.7s），换源后依旧。播放器缓冲目标依赖 `navigator.connection.effectiveType` 分档，非 Chrome/Edge 浏览器该 API 缺失或不可靠时回退"4g"配置（60s 前向缓冲），慢链路上过度抢跑，放大网络压力与卡顿；起播带宽估算 500kbps 偏低，起播模糊、升档慢。

## 2. 根因

- `js/player.js` `getAdaptiveHlsConfig()`（旧 511-523 行）：`const effectiveType = connection?.effectiveType || '4g'` —— API 缺失/`unknown` 一律回退 4g，命中 60s 前向缓冲配置，慢链路过度抢跑；且不同浏览器行为不一致
- `js/player.js`（旧 550 行）：`abrEwmaDefaultEstimate: 500000` 起播带宽估算偏低

## 3. 修复方案

用户确认修订版：**不再按 4G/3G 等网络类型区分缓冲配置，全部统一环境处理**。

1. 删除 `networkConfigs` 分档映射与 `navigator.connection` 检测（`js/player.js:510-511` 起），改为统一缓冲参数：`backBufferLength: 20`、`maxBufferLength: 40`、`maxMaxBufferLength: 80`
2. `abrEwmaDefaultEstimate: 500000 → 2000000`（起播估算提升到 2Mbps）

## 4. 改动文件清单

- `js/player.js`（1 文件，3 处）
  - 510-513：函数注释与 `getAdaptiveHlsConfig()` 入口（删除分档逻辑）
  - 519-523：统一缓冲参数（`backBufferLength: 20 / maxBufferLength: 40 / maxMaxBufferLength: 80`）
  - 538：`abrEwmaDefaultEstimate: 2000000`

未触碰分析范围外文件；未引入新抽象/新接口（`hlsConfig = getAdaptiveHlsConfig()` 调用点不变）。

## 5. 验证结果

AI 侧（通过）：
- `node --check js/player.js` 语法通过
- grep 确认 `networkConfigs` / `effectiveType` / `navigator.connection` 代码引用已删净（仅注释提及）
- lint 0 错误
- 影响面：`hlsConfig` 调用点（`js/player.js:550`）不变，其余 hls 配置项（重试/seek/ABR 因子等）未动

HUMAN 侧（待用户验证）：
- 弱网/正常网各播一段：起播速度提升（不再从最低档爬）、打转频率下降、缓冲目标约 40s
- 浏览器 Network/Console 确认 `maxBufferLength` 生效

## 6. 遗留事项

- 后续增强（不在本 issue）：实际带宽采样自适应（首片段测速动态降档）；与智能降级（autoLevelCapping）联动的缓冲目标缩放
- 源站 CDN `ERR_CONTENT_LENGTH_MISMATCH` 为源站独立问题，不在本 issue
- HUMAN 浏览器验证确认后即可收尾提交
