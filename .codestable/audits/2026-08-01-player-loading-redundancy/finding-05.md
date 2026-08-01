---
doc_type: audit-finding
date: 2026-08-01
audit: 2026-08-01-player-loading-redundancy
nature: performance
severity: P2
confidence: medium
suggested_action: cs-refactor
---

# Finding-05: 页面存在 3 个独立全屏 loading 遮罩，首屏叠加闪烁

## 证据

`player.html` 中并存 3 个互不协调的全屏 loading 机制：

1. `player.html:49-59` — `#style-loader`：纯 CSS spinner，`window load` 后延迟 100ms 移除，用于防止 Tailwind 未加载时的 FOUC。
   ```html
   <div id="style-loader"></div>
   <script>
   window.addEventListener('load', function() {
       setTimeout(function() {
           var loader = document.getElementById('style-loader');
           if (loader) loader.style.display = 'none';
       }, 100);
   });
   </script>
   ```

2. `player.html:102-110` — `#player-loading`：播放区内的"正在加载视频..."遮罩，带进度条。由 `player.js` 在视频真正开始播放后才隐藏（见 [[finding-01]]、[[finding-02]]）。

3. `player.html:293-299` — `#loading`：另一个全屏"加载中..."遮罩，由 `showLoading()/hideLoading()`（`player.js:2195` 等）控制，用于换源等操作。

此外还有 `js/watch.js`（重定向中转页）自己的状态文本动画——但那是另一页面，不算 player.html 的遮罩。

## 为什么构成问题

- **首屏三层遮罩叠加**：页面打开瞬间，`#style-loader`（全屏黑底 spinner）+ `#player-loading`（视频区"正在加载视频..."）+ 潜在的 `#loading` 同时可见。`#style-loader` 在 100ms 后消失，但 `#player-loading` 要等视频 `playing` 事件（可能数秒），期间用户看到遮罩在变切换而非持续加载反馈。
- **职责重叠**：`#style-loader` 防 FOUC、`#player-loading` 表视频加载、`#loading` 表换源操作——三者都是"全屏加载反馈"，但用 3 套独立机制、3 个不同隐藏时机，状态机割裂。
- **可维护性**：新增加载场景时开发者要在 3 个遮罩里选一个，选错即出现遮罩不消失或叠错层。

## 建议

收敛为"首屏 FOUC 遮罩（`#style-loader`，纯样式，独立）"+"播放加载遮罩（`#player-loading`，兼负换源）"两层，`#loading` 全屏遮罩并入 `#player-loading` 或改为局部 loading。配合 [[finding-03]] 的统一入口管理。
