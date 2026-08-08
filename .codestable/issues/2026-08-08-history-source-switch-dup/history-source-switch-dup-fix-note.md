---
doc_type: issue-fix-note
issue: 2026-08-08-history-source-switch-dup
status: confirmed
severity: P3
tags: [player, history, localStorage]
---

# 切换视频源导致观看历史重复记录 Fix Note

## 根因

`js/player.js` 的 `saveToHistory()` 用 `title_sourceName_showIdentifier` 作为去重唯一键，其中 `showIdentifier = getShowIdentifier(sourceName, id)` 在 `sourceName && id` 时返回 `sourceName_id`（已含 sourceName）。切换视频源后 `sourceName` 变化导致唯一键变化，`historyMap.has()` 为 false，走"新增记录"分支，产生重复记录。

## 改动

仅修改 `js/player.js` 的 `saveToHistory()` 内部：

1. 去重键改为**规范化片名** `currentVideoTitle.trim()`（约 1472 行）。经 code review 核实 `vod_id` 是源相关的（`switchToResource` 传入目标源自己的 vod_id 并替换 URL id），跨源必变，不能做去重键；片名是唯一跨源近似稳定的身份。
2. Map 查找键同步为 `(item.title || '').trim()`（约 1498 行）；空 title 不进 Map，避免空键误合并（REV-302）；同 title 多条时保留 timestamp 最新的一条，自愈去重以最新记录为准（REV-303）。
3. `uniqueKey` 为空（无标题）时不走合并，直接新增（REV-302）。
4. 更新分支同步全部字段：title/episodeIndex/timestamp/sourceName/sourceCode/vod_id/showIdentifier/directVideoUrl/url/playbackPosition/duration/playbackRate/vod_pic/episodes（约 1511-1528 行）。其中补 `existingItem.title`（REV-004 nit）与 `existingItem.showIdentifier`（保障播放速度恢复/更新按 `title+sourceName+showIdentifier` 匹配的链路），episodes 非空即替换为新源集数（REV-003）。
5. 自愈去重：命中时移除同片名的其他残留记录，切源/切集不再叠加重复条目，同时收敛历史存量重复（REV-006 suggestion）。

修订来自 code review 四轮（`history-source-switch-dup-review.md`）：
- REV-001：原 `${title}_${id}` 键在跨源片名不一致时不命中 → v1 尝试 `id:${id}` 键，round 2 核实 vod_id 源相关作废 → v2 用规范化片名键。
- REV-002/003：无 id 误合并、episodes 残留旧源 → 均已处理。

## 验证

- 逻辑级验证（node 脚本模拟键匹配，15 场景全部 PASS）：切源更新不新增、切源后记录指向新源、trim 标题匹配、title 完全不同新增、切集更新、不同视频新增、自愈去重只留一条、其余视频保留、无 title 旧记录不崩溃、空 title 新增不合并、空 title 记录保留、同 title 重复保留最新一条等。
- 待浏览器验证：本地 `npm run dev` 后进播放页切换视频源，确认历史面板不新增重复记录。
- 影响面：历史面板点击跳转用 `item.url`（切源更新后为新源 url，行为正确）；播放速度恢复因补同步 `showIdentifier`/`title` 行为更正确。

## 遗留风险

- **同名不同剧合并（title 键固有语义）**：两部片名完全相同的不同视频（如同名 TV 版/剧场版）会被视为同一记录合并更新。这是"切源/切集更新原记录"产品诉求的必然代价（title 无法区分版本），列为验收标记项；如需区分须引入源无关的稳定影片标识（当前不可得）。
- **跨源片名不一致**：不同源返回的 `vod_name` 格式不同（年份/清晰度/季信息差异）时，title 键仍不命中、仍会新增重复。属数据限制，需真机多源实测确认触发频率（review R-1）。
- 历史旧记录缺 title 或 title 为空：已防御（空 title 不进 Map、不走合并），但旧记录与当前标题不一致时首次切源可能并存一条，靠后续更新收敛。
- 既有问题未处理（非本次范围）：进度明显倒回时保留旧值（js/player.js:1520）；`sourceName` 与 `sourceCode` 都取 `source` 参数（js/player.js:1442-1443）。
- 无自动化测试，修复依赖浏览器手动验证与 localStorage 字段核对。
