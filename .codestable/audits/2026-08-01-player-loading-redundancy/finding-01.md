---
doc_type: audit-finding
date: 2026-08-01
audit: 2026-08-01-player-loading-redundancy
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
---

# Finding-01: `playing` 事件被注册 3 次，各自隐藏 loading

## 证据

同一 `video` 元素上绑定了 3 个 `playing` 监听器，3 处都在隐藏 `#player-loading`：

1. `js/player.js:590-594` — 显式 `addEventListener('playing')`：设 `playbackStarted=true` + `player-loading.display='none'`。

```javascript
video.addEventListener('playing', function () {
    playbackStarted = true;
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
});
```

2. `js/player.js:642-655` — 又一个 `addEventListener('playing', onPlaying, {once:true})`：把进度条推到 100% 后**延迟 300ms**再隐藏 loading。

```javascript
video.addEventListener('playing', function onPlaying() {
    progressBar.style.width = '100%';
    progressText.textContent = '100%';
    setTimeout(() => {
        const loadingDiv = document.getElementById('player-loading');
        if (loadingDiv) loadingDiv.style.display = 'none';
    }, 300);
}, { once: true });
```

3. `js/player.js:772-775` — 第 3 个 `playing` 监听器：这里做的是画质降级计数重置，本身不动 loading，但与上面两处共用同一事件、叠加触发，证明同一事件被拆散到 3 段独立逻辑，职责割裂。

## 为什么构成问题

- **职责重复**：listener #1 与 #2 做同一件事（隐藏 loading），#1 立即隐藏、#2 延迟 300ms 隐藏。两者都会触发，第 2 个的"延迟 300ms 让用户看到 100%"效果会被 #1 的立即隐藏抵消。
- **竞态**：listener #1 先于 #2 执行时，loading 已经 `display:none`，#2 里的 `setTimeout` 再设一次 `none` 是无意义重复写。
- **维护风险**：改"何时隐藏 loading"需要同时改 3 处，容易漏改。

## 建议

引入统一的 `hidePlayerLoading()` / `showPlayerLoading(state)` 入口，`playing` 事件只绑一个监听器，统一调度进度条推进→延迟→隐藏的时序。见 [[finding-03]]。
