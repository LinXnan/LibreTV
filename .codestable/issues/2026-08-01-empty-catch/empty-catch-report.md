---
doc_type: issue-report
issue: empty-catch
slug: empty-catch
status: confirmed
severity: P2
nature: maintainability
source: audit-2026-08-01-core-subsystems-finding-09
issue_path: fast-track
tags: [error-handling, logging, player]
created: 2026-08-01
---

# player.js 多处空 catch 块无声吞异常

## 问题

`js/player.js` 中有 5 处 `catch (e) { }` 无任何日志或恢复操作，异常被完全吞没。

## 涉及位置

| 函数/场景 | 原行为 | 修复 |
|---|---|---|
| 解析视频URL失败 (行166) | 空catch | `console.error` |
| 解析剧集数据失败 (行225) | 有恢复无日志 | `console.error` |
| HLS实例销毁失败 (行565) | 空catch | `console.error` |
| 恢复播放进度失败 (行899) | 空catch | `console.error` |
| 清除播放进度失败 (行1868) | 空catch | `console.error` |

## 修复

每处空catch改为 `console.error('描述:', e)`，生产环境可通过控制台定位失败原因。
