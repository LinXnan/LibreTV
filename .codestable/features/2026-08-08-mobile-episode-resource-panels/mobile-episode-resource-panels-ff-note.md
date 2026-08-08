---
doc_type: feature-ff-note
feature: mobile-episode-resource-panels
date: 2026-08-08
requirement:
tags: [player, mobile, ui, layout, pagination]
---

## 做了什么

移动端播放页的选集/数据源面板重构：选集入口从"底部抽屉弹框"改为"外层一个展开/收起按钮 + 就地展开选集面板和数据源面板"；展开后选集面板与数据源面板等高（跟随资源面板内容高度）、标题行与资源面板对齐（含字体、水平边距、集数徽标取舍）、集数列表分页（复用资源面板分页样式）、自动连播/排序/标题位置重排、移动端顶部间距减半。

## 改了哪些

- `player.html` — 外层按钮独立（文字动态"展开/收起"）；选集面板标题行 = 选集标题 + 分页控件；工具栏（自动连播+排序）移入网格区第一行；删除集数徽标；资源信息条保留结构
- `css/player.css` — 移动端两级结构（面板整体收起/展开）；等高布局；`.player-sidebar .player-container` 覆盖（box-sizing/max-width/margin）修宽度；`#resourceInfoBarContainer` 移动端 `padding:0.75rem 0` 修对齐；标题行/标题字体与资源面板一致；顶部间距 88px→44px
- `js/player.js` — `toggleMobileEpisodes()`（含按钮文字/箭头同步）；`syncMobilePanelHeight` + MutationObserver 等高同步；`renderEpisodes` 分页（`episodePage`/`EPISODES_PER_PAGE`）+ `updateEpisodePagination`/`bindEpisodePagination`；`toggleEpisodeOrder` 排序重置页码；`renderResourceInfoBar` 去集数徽标；`updateEpisodeInfo` 清理

## 怎么验证的

`node --check js/player.js` 与 VS Code lint 均通过。需本地 `npm run dev` 后浏览器移动端视图手动验证：展开/收起、两面板等高且随资源加载/翻页自动跟随、标题行与分页对齐、集数分页翻页/排序回第一页、按钮文字与箭头状态、顶部间隙。

## 顺手发现（可选，不阻塞）

- 移动端弹框（`#episodeModal` + `openEpisodeModal`/`renderEpisodesToModal` 等）已无入口，成死代码暂留，建议后续清理
- 集数分页后桌面端侧栏同样生效（每页 20 集）
