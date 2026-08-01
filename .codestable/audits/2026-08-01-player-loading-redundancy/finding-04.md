---
doc_type: audit-finding
date: 2026-08-01
audit: 2026-08-01-player-loading-redundancy
nature: bug
severity: P1
confidence: high
suggested_action: cs-issue
---

# Finding-04: 换集时重写 `#player-loading.innerHTML`，进度条容器被一并删除

## 证据

`js/player.js:1339-1343`（换集路径）和 `js/player.js:1073-1077`（10s 超时路径）都直接覆盖 `#player-loading` 的 `innerHTML`：

```javascript
// player.js:1339 换集
document.getElementById('player-loading').style.display = 'flex';
document.getElementById('player-loading').innerHTML = `
    <div class="loading-spinner"></div>
    <div>正在加载视频...</div>
`;
```

而 `player.html:102-110` 的原始 loading DOM 结构包含进度条子元素：

```html
<div class="loading-container" id="player-loading" style="display: flex;">
    <div class="loading-spinner"></div>
    <div>正在加载视频...</div>
    <div class="loading-progress-container">
        <div class="loading-progress-bar" id="loading-progress-bar"></div>
    </div>
    <div class="loading-progress-text" id="loading-progress-text">0%</div>
</div>
```

## 为什么构成问题

- **DOM 节点被永久抹除**：`innerHTML = ...` 把 `#loading-progress-bar` 和 `#loading-progress-text` 两个子元素连同进度条容器一起删掉。此后 `player.js:437-442`（`initPlayer` 里重置进度条）和 `610-611`（`getElementById('loading-progress-bar')`）会拿到 `null`——虽然代码里多处有 `if (progressBar && progressText)` 保护不报错，但**换集后的第二集起，进度条永久失效**（永远 0%），用户体验退化。
- **首集可能不受影响但后续集数全部受影响**：首次加载走 `initPlayer`，不经过 1339 这段；换集走 1339 这段，触发 DOM 重组。
- **10s 超时路径同样覆盖 innerHTML**：`1073` 把内容换成"视频加载时间较长"文案，也顺带删掉进度条子节点。

## 建议

换集时若要更新文案，只改文本节点（如给文案 `<div>` 加 id 后改 `textContent`），不要整体 `innerHTML` 覆盖；或换集后由 [[finding-03]] 的统一入口重建完整 loading DOM。
