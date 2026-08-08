# 播放页分栏布局：flex 侧栏等高 + 同页切换模式

## 背景

LibreTV 播放页从单列改左右分栏：播放器左置、右侧可折叠面板（选集模块 + 切换资源模块）。过程中踩了三个典型坑：① 播放器高度为 16:9 自适应（随宽度变），侧栏写死高度或 `calc(60vh+...)` 都与左栏对不齐；② 侧栏内容（集数网格 / 资源卡片）超高时页面或侧栏内部出现滚动；③ 切换其他视频源时整页刷新 + 全屏 loading，体验差。

## 结论

1. **flex 分栏左右等高**：`.player-layout { display:flex; align-items:stretch }`，左栏 `.player-layout-main { align-self:flex-start; flex:1 }`，再用 `ResizeObserver` 监听左栏高度变化，把侧栏 `style.height` 实时同步为左栏 `offsetHeight`。两个关键坑：`offsetHeight` **不含 margin**（原 `mb-4` 会让左栏底部多 16px 空白，需转成 padding 或显式计入）；flex item 默认会被 `stretch` 撑大，若左栏 `offsetHeight` 被右侧超高内容撑大，JS 同步会**循环放大**，必须 `align-self:flex-start` 锁死左栏高度由内容决定。
2. **侧栏内部不滚动**：body 用 `flex column` + `overflow:hidden`，模块之间用 `flex:1` 均分剩余高度；模块内滚动条隐藏（`scrollbar-width:none` + `-ms-overflow-style:none` + `::-webkit-scrollbar{display:none}`），超高仍可滚轮滚动但视觉无滚动条。资源列表加载前给容器 `min-height` 占位，避免加载后高度跳动。
3. **同页切换（切集/切源）**：不 `window.location.href` 跳转，改为 `history.replaceState` 更新 URL + 更新内存状态变量 + `initPlayer()` 重建播放器 + 重渲染局部 UI；切换前先 `saveCurrentProgress()`（必须在改 `currentVideoUrl` 前）；恢复播放进度通过 URL `position` 参数，由播放器 `loadedmetadata` 逻辑自动 seek（>10s 且小于时长才恢复）。需要"翻页"类列表时用分页渲染 + 缓存结果，切源只更新"当前"标记，不重新搜索。
4. **ArtPlayer 细节**：`loading: false` 可关闭内置的中央"加载中..."提示框；播放器容器宽度变化（如侧栏折叠/展开）后需调用 `art.resize()` 让播放器重算尺寸，可用 `setTimeout` 等 CSS 过渡结束。

## 证据

- 实现：`player.html` / `css/player.css` / `js/player.js`（2026-08-08 提交）
- 流程产物：`.codestable/features/2026-08-08-player-sidebar-collapse/player-sidebar-collapse-ff-note.md`、`player-sidebar-collapse-review.md`
