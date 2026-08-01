---
doc_type: audit-finding
date: 2026-08-01
audit: 2026-08-01-player-loading-redundancy
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
---

# Finding-02: `FRAG_LOADED`/`LEVEL_LOADED` 早期隐藏 loading，与 `playing` 互相打架

## 证据

`js/player.js:739-747` — 在 HLS 事件里**单独**隐藏 loading，与 `playing` 监听器并行存在：

```javascript
hls.on(Hls.Events.FRAG_LOADED, function () {
    document.getElementById('player-loading').style.display = 'none';
});

hls.on(Hls.Events.LEVEL_LOADED, function () {
    document.getElementById('player-loading').style.display = 'none';
});
```

而 `player.js:631-639` 已经在 `FRAG_LOADED` 里更新进度条，`642-655` 又在 `playing` 里把进度条推到 100% 再延迟 300ms 隐藏。

## 为什么构成问题

- **时序矛盾**：`FRAG_LOADED` 在首个片段下载完成时即触发，此时视频通常尚未开始播放。这两个监听器会在视频还没真正播放时就把 loading 隐藏，导致**进度条停在 95% 以下但遮罩已消失**，用户看到空白播放区。
- **与 finding-01 的 #2 监听器冲突**：#2 要求"播放后进度条到 100%，延迟 300ms 隐藏"，但 `LEVEL_LOADED`/`FRAG_LOADED` 先于 `playing` 触发，提前隐藏了 loading，#2 的"让用户看到 100%"承诺落空。
- **重复隐藏**：与 finding-01 的三处一起计，同一个 `player-loading` 在一次播放启动中被 `display='none'`写了 4~5 次。

## 建议

明确加载状态的唯一退出信号应是 `playing`（视频真正开始播）。HLS 层事件只负责更新进度条数值，不负责隐藏遮罩。见 [[finding-03]]。
