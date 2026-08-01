---
doc_type: audit-finding
date: 2026-08-01
audit: 2026-08-01-player-loading-redundancy
nature: maintainability
severity: P2
confidence: high
suggested_action: cs-refactor
---

# Finding-03: `#player-loading` 的显隐散落 8 处，无统一门面

## 证据

对 `#player-loading` 的 `style.display` 操作遍布 `player.js`，无单一入口：

| 行号 | 上下文 | 操作 |
|---|---|---|
| 104 | 密码未验证 | `none` |
| 118 | passwordVerified 事件 | `block` |
| 447 | initPlayer 开头 | `flex` |
| 592 | `playing` 监听器 #1 | `none` |
| 651 | `playing` 监听器 #2（延迟 300ms） | `none` |
| 741 | `FRAG_LOADED` | `none` |
| 746 | `LEVEL_LOADED` | `none` |
| 872 | `art.on('video:loadedmetadata')` | `none` |
| 975 | `art.on('video:error')` | `none` |
| 1072 | 10s 超时提示（读 + 改 innerHTML） | 读判断 |
| 1240 | `showError()` | `none` |
| 1339 | 换集（`playEpisode`？）置回 | `flex` |

另有一处 `js/player.js:973` 用 `querySelectorAll('#player-loading, .player-loading-container')` 批量隐藏。

## 为什么构成问题

- **无单一事实源**：要回答"现在 loading 是不是显示的"必须扫描 12 处写入点，无法据一个函数判断状态。
- **无幂等保护**：重复 `display='none'` 写入虽无害，但伴随的 `innerHTML` 覆盖（[[finding-04]]）有副作用。
- **状态机隐式散落**：loading 实际有"加载中 / 进度推进 / 超时提示 / 错误 / 隐藏"几个状态，但全部以直接 DOM 操作实现，没有显式状态变量，难以推理边界。

## 建议

抽 `playerLoading` 工具对象：`show(stage)` / `setProgress(p)` / `hide()` / `showError(msg)`，内部持单一 loading DOM 引用，所有调用点收口。这也顺带承载 finding-01、finding-02 的统一时序。
