# 移除 Toast 时同步清理无消费者状态变量

## 背景

2026-08-08 移除进入播放页的"正在同步/已同步剧集列表"通知（feature `remove-sync-toasts`）。改动前 `js/ui.js` 的 `playFromHistory` 里有一批状态只服务于这些 toast 的文案计算与提示时机判断。

## 结论

删除 toast 时，顺带扫描同函数内**仅服务该 toast** 的状态变量并一并清理，避免留下半清理状态。本次清理了三个：

- `oldEpisodeCount` / `newEpisodeCount` —— 只为算"新增 N 集"文案
- `syncSuccessful` —— 只赋值从未被读取（独立死变量，由 code review 复审发现）

清理原则：纯删除、无引用即可删；若仍有消费者（如 `lastSyncTime` 被历史列表渲染"已同步 ✓"图标使用）则保留。删除前确认该变量的写回/分支逻辑（localStorage 写回、缓存兜底、失败提示）均不依赖它。

## 证据

- `js/ui.js` `playFromHistory`（811-967 行）：删除 4 条 success/info toast + 3 个无消费者变量；`lastSyncTime` 保留（`js/ui.js:563-565` 历史列表渲染使用）
- `.codestable/features/2026-08-08-remove-sync-toasts/remove-sync-toasts-review.md`：round 1 发现 `syncSuccessful` 死代码（important），round 2 修复后复审通过
