---
doc_type: issue-report
issue: 2026-08-09-player-buffer-config
status: confirmed
issue_path: fast-track
severity: P1
summary: 播放器缓冲目标配置依赖 unreliable 的 effectiveType 且参数激进，慢网/源站慢时加剧"打转"卡顿
tags: [player, playback, buffering, network-adaptation]
---

# 播放器缓冲配置加剧慢网卡顿 Issue Report

## 1. 问题现象

在弱网或源站 CDN 响应慢时（实测 TS 分片加载 2-10s、个别 82.7s），播放器频繁进入"打转"（中央缓冲转圈）状态：
- 即使换源后，只要链路慢，打转现象依旧持续
- 浏览器控制台伴随 `ERR_CONTENT_LENGTH_MISMATCH`（源站 CDN 声明 Content-Length 与实际字节不符）与大量"视频缓冲中…卡顿计数"日志
- 现象与所选剧集/源无关，只与链路速度相关

## 2. 复现步骤

1. 进入任意剧集播放页，任选一个资源源
2. 使用弱网（DevTools Network 面板模拟 Slow 4G / 3G）或选择源站较慢的剧
3. 观察播放：缓冲转圈频繁出现，播放不流畅
4. 观察 Console：持续输出"视频缓冲中…卡顿计数"及分片加载失败/超时日志

复现频率：稳定（弱网条件下必然出现）

## 3. 期望 vs 实际

**期望行为**：播放器缓冲目标应统一、环境无关且不过度抢跑（不抢超过链路能力的前向缓冲），慢网下保持尽量流畅、画质自适应下降。

**实际行为**：缓冲目标依据 `navigator.connection.effectiveType` 分档（非 Chrome/Edge 浏览器该 API 缺失或不准时回退到"4g"配置，即 60s 前向缓冲），各环境行为不一致，慢链路上过度抢跑，进一步放大网络压力与卡顿；起播带宽估算值也偏低，弱网/大屏下起播模糊、升档慢。

> 用户决策（2026-08-09）：不再按 4G/3G 等网络类型区分缓冲配置，全部统一环境处理。

## 4. 环境信息

- 涉及模块 / 功能：播放器（ArtPlayer + hls.js 集成）
- 相关文件 / 函数：`js/player.js` 的 `getAdaptiveHlsConfig()`（约 510-560 行）
- 运行环境：prod 与 dev 均可复现
- 其他上下文：2026-08-09 完成播放卡顿重构（player-stutter，commit e3cfcdc）后验证时发现；本次问题与该重构无因果关系（TS 分片加载与配置均未改动），但 `maxBufferLength` 配置放大抢跑的问题此前已存在

## 5. 严重程度

**P1** — 核心功能（播放流畅性）在弱网/源站慢的常见场景下受损，影响面广（移动网络用户、海外源用户），有绕过方法（换源）但体验差。

## 备注

- 源站 CDN 的 `ERR_CONTENT_LENGTH_MISMATCH` 是独立问题（源站故障），不在本 issue 范围
- 复现截图：Network 面板显示多数 TS 分片 2-10s、个别 82.7s
