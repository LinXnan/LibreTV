---
doc_type: fix-note
issue: empty-catch
slug: empty-catch
status: fixed
severity: P2
nature: maintainability
fix_date: 2026-08-01
---

# player.js 空 catch 块补日志

## 根因

5 处 `catch (e) { }` 无任何错误输出，生产环境调试完全不可见。

## 改动

**`js/player.js`**（5 处）：

| 行 | 场景 | 改动 |
|---|---|---|
| 167 | 解析视频URL失败 | `console.error('解析视频URL失败:', e)` |
| 226 | 解析剧集数据失败 | `console.error('解析剧集数据失败:', e)` + 保留恢复逻辑 |
| 566 | HLS实例销毁失败 | `console.error('销毁HLS实例失败:', e)` |
| 900 | 恢复播放进度失败 | `console.error('恢复播放进度失败:', e)` |
| 1869 | 清除播放进度失败 | `console.error('清除播放进度失败:', e)` |

## 验证

- `grep 'catch (e) { }' js/player.js` 返回 0 匹配
- 所有 catch 块均有日志或恢复操作
- 无行为变更，仅增加错误可观测性

## 遗留风险

无。
