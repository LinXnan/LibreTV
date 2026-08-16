---
doc_type: issue-fix
issue: 2026-08-16-resource-lastpage-flatten
status: confirmed
path: fast-track
fix_date: 2026-08-16
tags: [播放页, 视频源面板, 布局, CSS]
---

# 视频源面板最后一页卡片被纵向拉高 修复记录

## 1. 问题描述

播放页右侧栏"视频源"面板，视频源总数超过一页（每页 6 个）时，翻到最后一页若该页不足 6 个（如 3 个），卡片被纵向拉高占满整个模块高度，下方留大段空白。

## 2. 根因

- `js/player.js` `renderResourcePage()`：占位补项按 `pageItems.length % 3` 只补满最后一行；最后一页不足 6 个时网格只形成 1 行。
- `css/player.css:778` `.resource-switch-list` 显式 `grid-auto-rows: 1fr`，唯一 1 行被 `1fr` 拉满整个模块高度 → 卡片拉高、下方留白。

## 3. 修复方案

占位补项从"补满一行（`% 3`）"改为"补满本页 `RESOURCE_PAGE_SIZE`（`% 6`）"——最后一页也形成完整 2 行（真实卡片 + 透明占位），行高与满页一致。无 CSS 改动，`grid-auto-rows: 1fr` 在 2 行时正确均分。

## 4. 改动文件清单

- `js/player.js` `renderResourcePage()` 占位补项循环（约 2150-2155 行）：`% 3` → `% RESOURCE_PAGE_SIZE`

## 5. 验证结果

- 用户浏览器实测：最后一页 3 张卡片行高与满页一致，不再拉高、下方无大段空白。
- 回归：满页（6 个）正常、翻页正常、切源正常。

## 6. 遗留事项

无
