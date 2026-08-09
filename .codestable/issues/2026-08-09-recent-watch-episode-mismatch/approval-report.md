---
doc_type: approval-report
unit: issues/2026-08-09-recent-watch-episode-mismatch
status: approved
reason: route-choice
approvals:
  issue-fast-path: approved
  issue-fix-completion: approved
created_at: 2026-08-09
---

# Approval Report

## Decision History

- 2026-08-09：owner 批准快速通道修复方案（选项 A：`issue-fast-path` approved）。
- 2026-08-09：code review 通过（reviewer=subagent，verdict passed），REV-001 已修复。
- 2026-08-09：owner 确认修复完成（`issue-fix-completion` approved）。

## Fix Completion Decision

修复已完成并通过 code review，等待 owner 确认修复结果：

- 改动文件：`js/recent-watch.js`（`bindCarouselControls` 内新增 `prepareEpisodeContextForNavigation`，点击/键盘跳转前同步历史条目集数到 `localStorage.currentEpisodes`；失配时输出 `console.warn`）。
- 验证：`node --check` 与 IDE lint 均通过；修复链路已按 40 集 A + 10 集 B 场景逻辑推演正确；待浏览器实测。
- 遗留风险：历史旧条目缺 `episodes` 时仍回退读 `localStorage.currentEpisodes`（存量旧数据），详见 fix-note 遗留风险节。

是否确认本次修复完成？

## Decision Needed

是否批准快速通道（fast-path）修复方案：让首页"最近观看"轮播在跳转播放页前，把该历史条目保存的集数列表同步到 `localStorage.currentEpisodes`。

## Why Now

该问题为既有行为异常，根因已通过读代码确认，修复点集中在 `js/recent-watch.js` 一处，满足快速通道条件，无需完整 analysis。

## Context

### 根因

`js/player.js` 的 `saveToHistory()`（约 1541 行）生成历史记录的 `url` 时不含 `episodes` 参数：

```javascript
url: `player.html?url=...&title=...&source=...&source_code=...&id=...&index=...&position=...`,
```

同时 `player.js` 的 `initializePageContent()`（约 253-261 行）在 URL 无 `episodes` 参数时，从 `localStorage.currentEpisodes` 读取集数列表：

```javascript
if (episodesList) {
    currentEpisodes = JSON.parse(decodeURIComponent(episodesList));
} else {
    currentEpisodes = JSON.parse(localStorage.getItem('currentEpisodes') || '[]');
}
```

`localStorage.currentEpisodes` 只反映**最后一次**播放的剧集列表。

首页"最近观看"轮播（`js/recent-watch.js` `bindCarouselControls`，约 199-210 行）点击卡片直接 `navigateTo(item.url)` 跳转，**没有**像 `ui.js` 的 `playFromHistory`（约 908-912 行）那样把历史条目里的 `episodes` 写入 `localStorage.currentEpisodes`。

因此：先看 40 集的剧 A、再看 10 集的剧 B 后，从最近观看点剧 A，播放页读到的是剧 B 的 10 集 → 集数显示不正确。

### 修复方案

只改 `js/recent-watch.js` 的点击/键盘跳转逻辑（`bindCarouselControls` 内两处调用），新增一个跳转前同步函数：

```javascript
// 跳转前把该历史条目的集数列表同步到 localStorage.currentEpisodes，
// 与 ui.js playFromHistory 行为一致，避免播放页读到上一次播放的集数
function prepareEpisodeContextForNavigation(itemUrl) {
    if (!itemUrl) return;
    try {
        const item = getHistory().find(h => h && h.url === itemUrl);
        if (item && Array.isArray(item.episodes) && item.episodes.length > 0) {
            localStorage.setItem('currentEpisodes', JSON.stringify(item.episodes));
        }
    } catch (e) { /* 集数同步失败不阻断跳转 */ }
}
```

在 click / keydown 处理器中，`navigateTo(...)` 之前调用 `prepareEpisodeContextForNavigation(url)`。

`item.url` 已含正确的 `index`/`position`/`source`/`id` 参数，播放页其余恢复逻辑不受影响。

## Options

- A. 快速通道：按上述方案直接修复（推荐）
- B. 标准路径：先做正式根因分析（analysis）再修复
- C. 不改，接受当前行为（从最近观看进入集数可能错误）

## Recommendation

A。根因明确、修复点 ≤2 且局限于 `recent-watch.js` 单文件，与 `ui.js playFromHistory` 既有模式一致，无跨模块影响，符合快速通道条件。

## Risks And Tradeoffs

- 历史旧条目若无 `episodes` 字段（早期数据），维持现状从 `localStorage.currentEpisodes` 读取，不更糟。
- 仅同步 `currentEpisodes`，不改动 URL 结构与导航行为；`player.js` 其余状态（进度、倍速、切源）仍从 URL/localStorage 原路径恢复。
- 不覆盖 `playVideo`（搜索/详情进入）与 `ui.js playFromHistory` 的正确行为。

## Non-Automatic Actions

不会自动提交 git commit；不会改动其他文件；不会执行其他重构。

## After You Answer

批准后：report 标记为 confirmed + fast-track，进入 fix 阶段改代码并写 fix-note。拒绝则改走标准路径（analyze）。
