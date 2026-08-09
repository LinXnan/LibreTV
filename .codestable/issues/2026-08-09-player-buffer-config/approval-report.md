---
doc_type: issue-approval-report
issue: 2026-08-09-player-buffer-config
---

# Approval Decisions

## issue-fast-path

- **状态**: approved（2026-08-09 用户确认修订版：统一环境处理）
- **ref**: approval-report.md#issue-fast-path
- **根因（file:line，已读代码）**:
  - `js/player.js:511-523` — `getAdaptiveHlsConfig()` 依赖 `navigator.connection.effectiveType` 做网络分档：API 缺失（非 Chrome/Edge）或值不可靠时回退 `'4g'`，命中 `js/player.js:520` 的 60s 前向缓冲配置，慢链路上过度抢跑；且不同浏览器行为不一致
  - `js/player.js:550` — `abrEwmaDefaultEstimate: 500000`（500kbps）起播带宽估算偏低，弱网/大屏起播从低档爬升慢
- **小范围修复方案**（全部在 `getAdaptiveHlsConfig()` 单函数内，约 1 处逻辑删除 + 若干配置值）:
  1. **统一环境处理**：删除 `networkConfigs` 按 `effectiveType` 分档映射与 `navigator.connection` 检测（`js/player.js:511-523`），改为单一统一缓冲配置（中档保守值：`maxBufferLength: 40`、`backBufferLength: 20`、`maxMaxBufferLength: 80`），所有环境一致
  2. 起播估算提升：`abrEwmaDefaultEstimate 500000 → 2000000`（2Mbps），起播不再从最低档爬
- **明确排除（超出本次范围，后续增强）**：
  - 实际带宽采样自适应（首片段测速动态降档）
  - 与智能降级（autoLevelCapping）联动的缓冲目标缩放
- **风险**: 低（配置调整 + 删分档逻辑，无跨模块；参数值需 HUMAN 弱网验证；行为变化：不再按 effectiveType 区分缓冲目标，全环境一致）
- **验证方式**: HUMAN（弱网/正常网各播一段，观察缓冲目标、起播速度、打转频率；Network 确认 maxBufferLength 生效）
