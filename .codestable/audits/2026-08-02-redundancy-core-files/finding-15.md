---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 15
severity: P2
confidence: high
category: duplicate-dom-pattern
file: js/player.js
---

# Finding 15 — 进度条 click / touch 处理器 90% 相同

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 1357-1383 (handleProgressBarClick) 与 1386-1406 (handleProgressBarTouch) |
| 性质 | duplicate-dom-pattern |
| 严重度 | P2 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// player.js:1357-1383 (handleProgressBarClick)
function handleProgressBarClick(e) {
    if (!art || !art.video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const duration = art.video.duration;
    let clickTime = percentage * duration;
    if (duration - clickTime < 1) {
        clickTime = Math.min(clickTime, duration - 1.5);
    }
    userClickedPosition = clickTime;
    e.stopPropagation();
    art.seek(clickTime);
}

// player.js:1386-1406 (handleProgressBarTouch) — guard 多 e.touches[0]，坐标改 touch.clientX，其余 11 行相同
```

## 为什么是冗余

- 仅差 guard（`e.touches[0]`）与坐标来源（`e.clientX` vs `touch.clientX`）。核心 seek 逻辑 11 行逐字一致。
- 抽 `seekToRatio(clientX, rect)` 后两边各自取坐标再调用，处理器只剩取坐标 + 调用：

```js
function seekToRatio(xCoord, rect) {
    if (!art || !art.video) return;
    const percentage = (xCoord - rect.left) / rect.width;
    const duration = art.video.duration;
    let clickTime = percentage * duration;
    if (duration - clickTime < 1) clickTime = Math.min(clickTime, duration - 1.5);
    userClickedPosition = clickTime;
    art.seek(clickTime);
}
```

## 影响

- 净减约 11 行；seek 阈值逻辑（`duration - 1.5` 等）单点维护。
- 注意：保留两处 `e.stopPropagation()`（分别在各自处理器内调用，不进 helper）。

## 验证 checklist

- [ ] 鼠标点击进度条与触摸拖动 seek 行为一致
- [ ] 末尾 1s 边界 `Math.min(..., duration - 1.5)` 钳制在两路径都生效
