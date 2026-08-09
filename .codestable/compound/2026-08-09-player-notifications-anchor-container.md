# 播放页提示框应锚定播放器容器而非视口，多通知垂直错开防重叠

## 背景

2026-08-09 修复播放页提示框位置（issue `2026-08-09-player-toast-above-player`）。初版把快捷键提示、Toast 等统一成 `position: fixed; top: calc(88px+16px); left: 50%`（相对**视口**水平居中），owner 反馈"恢复播放位置提示没在播放器上方居中"。根因：桌面端分栏布局（≥1024px，右栏 360px 侧边栏）下播放器容器在左栏内居中，播放器中心偏离视口中心约 180px，`left: 50%`（视口居中）自然不对齐播放器。随后 owner 又反馈"所有通知同时出现时会重叠"——四类通知（广告胶囊/恢复位置/Toast/快捷键）都定位在播放器顶部同一区域。

## 结论

1. **提示框水平居中必须锚定播放器容器，而不是视口**：给 `#playerContainer { position: relative }`，提示框 `position: absolute; top: X; left: 50%; transform: translateX(-50%)` 相对播放器容器，桌面分栏/单栏/移动端都严格对齐播放器中心。`fixed + left:50%`（视口居中）只在单栏全宽时恰好等于播放器中心，分栏即偏。
2. **提示框要挂到定位锚点容器内**：Toast、恢复位置提示等动态元素通过 `document.querySelector('.player-container') || document.body` 挂载（播放页挂播放器容器内，首页无该容器挂 body 保持原行为）；快捷键提示等静态元素直接放容器内。注意 `.player-container` 在播放页有多个（选集/资源面板也带该类），`querySelector` 依赖 DOM 顺序取第一个（即 `#playerContainer`），属隐式契约，移动 DOM 顺序需复查。
3. **多通知同时出现要垂直错开**：四类通知按固定层位错开（桌面 8/56/120/184px，间距 64px；移动端 32/72/136/200px），间距须大于单层最大高度（含 padding 后约 ≤64px）；给 Toast 加 `max-width` + 单行截断防超长消息换行侵入下一层。
4. **锚定容器后，垂直避让与移动端 safe-area 自动简化**：容器顶部（`.container.mx-auto` margin-top + main padding）已在固定 header 之下时，`top:0` 即避让 header，无需再叠加 safe-area（刘海由容器 margin-top 的 `env(safe-area-inset-top)` 吸收）。但**移动端 header 高度需实测**：本项目移动端 `.container.mx-auto` margin-top 仅 `calc(44px + safe)`，低于 header（约 78px），提示 `top:0` 会被遮挡，须额外下移避让——移动端布局的 header 高度与 margin-top 落差要先核实再定偏移。
5. **顶部提示的 z-index 压不过固定 header**（复述既有沉淀 `2026-08-08-top-fixed-hint-header-bypass`）：header 用 `2147483647 !important`，只能纵向避让，不能靠 z-index。

## 证据

- `css/player.css` — `#playerContainer { position: relative }`（锚点）；`.position-restore-hint` / `.shortcut-hint` / `body #toast` 三处 `position: absolute; top: 桌面 56/184/120px`（移动端 72/200/136px）；`#adFilterStats` 桌面 top-2 / 移动端 32px；`body #toast` 的 `max-width: min(80vw,400px)` + 单行截断
- `player.html:109,129-135` — `#shortcutHint` 置于 `#playerContainer` 内（`.relative` div 之后）；`#adFilterStats`（`player.html:114`）仍在 `.relative` div 内（相对它 top-2）
- `js/ui.js:44-46` — Toast 挂载 `document.querySelector('.player-container') || document.body`
- `js/player.js:1629` — 恢复位置提示挂载 `document.querySelector('.player-container')`
- `.codestable/issues/2026-08-09-player-toast-above-player/` — report / fix-note / review（round 6 passed，blocking REV-001/REV-005 与 important REV-008/REV-009 关闭）
- 关联沉淀：`2026-08-08-top-fixed-hint-header-bypass.md`（顶部提示避让 header 的 z-index 结论，本次第 5 条复述）
