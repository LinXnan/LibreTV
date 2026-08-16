---
doc_type: feature-ff-note
feature: remove-quality-degrade
date: 2026-08-16
requirement:
tags: [player, hls, abr]
---

## 做了什么
移除播放器全部降画质逻辑：既删自定义"智能降级"（缓冲不足/连续卡顿收窄 ABR 上限），又锁定 hls.js 最高画质档位（禁用原生 ABR 按带宽自动降码率）。播放全程保持源流最高清晰度。

## 改了哪些
- `js/player.js` 删除优化11"智能画质调整"代码块（含 degradeLevel / restoreAutoLevel / 三个缓冲监听 handler 与 qualityHandlers 状态变量）
- `js/player.js` 删除全局引用 `let qualityHandlers = null;`
- `js/player.js` 删除优化11块上方悬空的 FRAG_LOADING 注释（review nit，指向已删除代码）
- `js/player.js` hlsConfig：删除 ABR 配置（abrEwmaDefaultEstimate / abrBandWidthFactor / abrBandWidthUpFactor / abrMaxWithRealBitrate），`startLevel` 保持 -1（起播由 ABR 选带宽支持的最高档）
- `js/player.js` MANIFEST_PARSED 回调：按 bitrate 找出码率最高的 level 并设 `hls.currentLevel = maxLevelIdx`（手动模式锁定，禁用 ABR 自动切换）

## 怎么验证的
`node --check js/player.js` 语法通过，IDE 语言服务 0 诊断；grep 确认 `autoLevelCapping` / `degradeLevel` / `restoreAutoLevel` / `qualityHandlers` / `abrBandWidth*` 无残留引用；独立 Task agent review round 1 通过（无 blocking/important），round 2 完整复审待启动。浏览器弱网/正常网播放需人工目视验证（项目无自动化测试）。

## 顺手发现（可选，不阻塞）
- `js/player.js:734` 注释仍含"智能降级"字样，实为优化9错误恢复重试机制（网络/媒体错误重试），与画质降级无关，保留。
