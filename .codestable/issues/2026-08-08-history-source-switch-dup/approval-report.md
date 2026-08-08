---
doc_type: approval-report
unit: issues/2026-08-08-history-source-switch-dup
status: approved
reason: route-choice
approvals:
  issue-fast-path: approved
created_at: 2026-08-08
---

# Approval Report

## Decision History

- 2026-08-08：owner 批准快速通道修复方案（选项 A：`issue-fast-path` approved）。

## Decision Needed

是否批准快速通道（fast-path）修复方案：修改 `saveToHistory()` 的去重键，使切换视频源时更新原记录而非新增。

## Why Now

该问题为既有行为异常，根因已通过读代码确认，修复点集中在一个函数内，满足快速通道条件，无需完整 analysis。

## Context

### 根因

`js/player.js` 的 `saveToHistory()`（约 1472 行）用如下唯一键做去重查找：

```javascript
const uniqueKey = `${currentVideoTitle}_${sourceName}_${show_identifier_for_video_info}`;
```

其中 `show_identifier_for_video_info = getShowIdentifier(sourceName, id_from_params)`，而 `getShowIdentifier` 在 `sourceName && id_from_params` 时返回 `${sourceName}_${id_from_params}`，本身已包含 sourceName。

因此切换视频源（sourceName 变化）时唯一键变化，`historyMap.has(uniqueKey)` 为 false，走"新增记录"分支（约 1530-1533 行），产生重复记录。

### 修复方案

只改 `saveToHistory()` 内部两处（js/player.js:1472 与 1498）：

1. 去重键去掉 sourceName，改用稳定的 `title + vod_id`：`${currentVideoTitle}_${id_from_params || ''}`，Map 查找键同步改为 `${item.title}_${item.vod_id || ''}`。
2. 更新分支补充同步 `existingItem.showIdentifier = videoInfo.showIdentifier`，避免切源后记录内 showIdentifier 与 sourceName 不一致，导致播放速度恢复等按 `title + sourceName + showIdentifier` 匹配的逻辑失效。

切源时 id（vod_id）不变（`switchToResource` 中 `url.searchParams.set('id', vodId)`），故能命中原记录并更新。

## Options

- A. 快速通道：按上述方案直接修复（推荐）
- B. 标准路径：先做正式根因分析（analysis）再修复
- C. 不改，接受当前重复记录行为

## Recommendation

A。根因明确、修复点 ≤2 且局限于单函数，无跨模块影响，符合快速通道条件。

## Risks And Tradeoffs

- 无 id 且标题相同的不同视频（边缘情况）可能被合并为一条记录；现有逻辑在无 id 时本就依赖标题/URL，风险可接受。
- 历史旧记录若无 `vod_id` 字段，新记录可能与之并存一条（仅旧数据，不影响后续行为）。

## Non-Automatic Actions

不会自动提交 git commit；不会改动其他文件；不会执行其他重构。

## After You Answer

批准后：report 标记为 confirmed + fast-track，进入 fix 阶段改代码并写 fix-note。拒绝则改走标准路径（analyze）。
