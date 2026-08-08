---
doc_type: issue-report
issue: 2026-08-08-history-source-switch-dup
status: confirmed
issue_path: fast-track
severity: P3
summary: 播放页切换视频源时，观看历史新增重复记录，应更新原记录而非新增
tags: [player, history, localStorage]
---

# 切换视频源导致观看历史重复记录 Issue Report

## 1. 问题现象

在播放页面切换不同视频源后，历史记录面板会新增一条与该视频相关的记录，与原记录并存，造成重复。

## 2. 复现步骤

1. 打开播放页，播放任意视频（如某剧第 1 集）
2. 打开历史记录面板，确认存在该视频的记录
3. 在播放页切换视频源（如从源 A 切到源 B）
4. 等待 3 秒（saveToHistory 触发），重新打开历史记录面板

观察到：历史记录面板出现两条相同视频的记录（一条旧源、一条新源）。

复现频率：稳定。

## 3. 期望 vs 实际

**期望行为**：切换视频源后，历史记录中该视频的原有记录被更新（源信息、播放进度、集数等），不新增条目。

**实际行为**：切换视频源后新增一条记录，与原记录并存。

## 4. 环境信息

- 涉及模块 / 功能：播放页历史记录（viewingHistory 存储）
- 相关文件 / 函数：js/player.js 的 saveToHistory()（uniqueKey 构造约 1472 行）
- 运行环境：dev（本地 npm run dev）
- 其他上下文：无数据库，localStorage 持久化；无最近相关改动

## 5. 严重程度

**P3** — 非核心功能受损，仅影响历史记录面板整洁度，有重复条目但不影响播放功能。
