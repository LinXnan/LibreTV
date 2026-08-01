---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "maintainability-09"
nature: maintainability
severity: P2
confidence: medium
suggested_action: cs-refactor
status: resolved
---

# Finding 09：多处空 catch 块无声吞异常

## 速答

player.js 中有多处 `catch (e) {}` 没有任何日志或恢复操作：嵌套 URL 解析失败（`player.js:166-167`）、HLS 实例销毁失败（`player.js:565`）、进度恢复失败（`player.js:896-897`）、播放速度恢复失败（`player.js:947-948`）。这些位置将真正发生的错误完全吞没，任何生产环境调试都无法获知这些操作失败的原因。

## 关键证据

- `player.js:166-167` — `} catch (e) { }` ——嵌套 player.html URL 展开失败，无日志
- `player.js:565` — `} catch (e) { }` ——`currentHls.destroy()` 失败静默
- `player.js:896-897` — `} catch (e) { }` ——`localStorage.getItem` 或 JSON.parse 进度恢复失败
- `player.js:947-948` — `} catch (e) { console.error('恢复播放速度失败:', e); }` ——有日志（非空 catch，仅此一处）

## 影响

- **范围**：播放器初始化、切换剧集、历史恢复场景
- **影响**：错误原因完全不可见，影响问题定位效率
- **置信度 medium**：部分 catch 处的错误实际上极少发生（如 HLS destroy），但空 catch 本身是坏实践

## 修复方向

- 每个空 catch 改为至少 `console.error('Failed to X:', e)` + 恢复默认行为
- 将日志统一收口到 debug utils
- 建议动作：`cs-refactor`
