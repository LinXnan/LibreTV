---
doc_type: feature-ff-note
feature: player-sidebar-collapse
date: 2026-08-08
requirement:
tags: [player, layout, sidebar, responsive]
---

## 做了什么
播放页改为左右分栏：播放器固定在左侧，源信息/自动连播/排序/集数网格等其余内容移入右侧可折叠面板。桌面端（≥1024px）分栏，右侧面板可收起/展开并记忆状态；移动端保持原有纵向布局不变。

## 改了哪些
- player.html:100-217 — main 重构为 `.player-layout`（左栏 `.player-layout-main` + 右栏 `aside.player-sidebar`），新增收起按钮 `#sidebarToggle` 与展开把手 `#sidebarHandle`
- css/player.css:923-1045 — 桌面端分栏/折叠样式：侧栏 360px、收起为 48px 把手、侧栏内集数网格适配 3 列；移动端隐藏头部/把手
- js/player.js:298-299, 1803-1820 — `initPlayerSidebar` 恢复折叠状态；`togglePlayerSidebar` 切换并持久化到 localStorage，折叠/展开后调用 `art.resize()` 让播放器重算尺寸

## Review Fix（REV-001 / REV-002）
- REV-001：`css/styles.css:864-874` 锁定屏蔽规则从 DPlayer 遗留选择器（`.dplayer-*`）迁移为 ArtPlayer（`.art-controls` / `.art-mask` / `.art-progress`），锁功能恢复生效；`player.html:128-140` 收起把手改为容器，内含锁定控制按钮（`#lockIconHandle`）+ 展开面板按钮，收起态锁按钮可达；`js/player.js` `toggleControlsLock` 同步两处锁图标
- REV-002：`js/player.js` `initPlayerSidebar` 增加 `matchMedia('(min-width: 1024px)')` 断点门控，仅桌面端恢复/移除折叠 class，避免跨端污染

## 追加调整（2026-08-08，用户 4 项新需求）
1. **选集模块整合**：`player.html` 侧栏重构——集数网格、自动连播开关、排序按钮集中为"选集"模块（`.player-sidebar-header` + `#episodesGridContainer`）；收起把手简化为整块可点击（点击右侧任意位置展开），移除把手内锁定/展开按钮
2. **切换资源改为侧栏常驻模块**：`js/player.js` `showSwitchResourceModal`（弹框版）重构为 `loadResourceSwitchList`——异步搜索全部源 + 测速 + 排序，渲染为侧栏内横向滑动卡片列表（`#resourceSwitchList`），不阻塞播放器初始化；删除弹框 `#modal` 与 `switchToResource` 中 modal 引用；`renderResourceInfoBar` 去掉"切换资源"按钮，仅显示资源名 + 视频数
3. **删除复制链接与锁定控制**：移除按钮行 `copyLinks` / `lockToggle`、`js/player.js` 的 `copyLinks` / `toggleControlsLock` / `controlsLocked`、`css/styles.css` 的 `controls-locked` 规则
4. **控件集中**：自动连播 + 排序按钮从原按钮行移入选集模块头部；移动端（≤640px）头部仅保留选集按钮（弹框选集），桌面端显示自动连播/排序/收起
5. **收起按钮位置修正（用户澄清）**：`#sidebarToggle` 从选集模块头部移出，改为侧栏顶部独立的全宽"收起"横条按钮（仅桌面端 ≥1024px 显示），下方才是选集模块（自动连播/排序 + 集数网格）与切换资源模块
6. **集数网格加边框**：`css/player.css` 为 `#episodesGridContainer` 添加 `1px solid #333` 边框 + 圆角 + `#151515` 背景 + padding，与侧栏模块视觉统一（纯样式，无行为变更）
7. **选集标题行与集数网格合并**：`.player-sidebar-header`（选集标题 + 自动连播 + 排序）移入 `#episodesGridContainer` 内作为标题行，二者共用一个边框容器；`.player-sidebar-header` 去掉独立背景/边框改为底部 `border-bottom` 分隔线；移动端隐藏规则从整个容器改为仅隐藏 `.episode-grid`（保留标题行/选集按钮）
8. **自动连播/排序靠右**：`#autoplayContainer` 加 `ml-auto`，标题行布局为"选集"靠左、自动连播 + 排序靠右
9. **侧栏高度对齐左栏**：左栏播放器高度为 16:9 自适应（随宽度变化）。修复过程：① 写死 `calc(60vh+1rem)` 与自适应高度偏差 → 改为 JS 同步；② 发现 `.player-layout-main` 被 flex stretch 撑大导致 `offsetHeight` 循环放大 → `.player-layout-main` 加 `align-self: flex-start` 使左栏高度 = 播放器真实高度；③ `initSidebarHeightSync` 用 `ResizeObserver` 监听左栏高度，侧栏高度 = 左栏高度 + 16px（`#playerContainer` 的 mb-4），折叠/窗口缩放/播放器就绪后自动重新同步；`.player-sidebar-body` `height: 100%` + `overflow-y: auto` 且隐藏滚动条（`scrollbar-width: none` + `::-webkit-scrollbar { display:none }`），内容超高时滚轮/触摸内部滚动，页面无上下滚动；切换资源卡片海报比例由 2/3 调整为 3/4，样片高度更紧凑
10. **资源列表分页翻页（替代横滑）**：用户反馈横向滚动"下一页"不可点（仅 3 个源时不溢出、箭头禁用，且 24 个视频指当前源剧集数而非源数）——改为分页式：资源信息条右侧显示"上一页 / 页码（如 1/3）/ 下一页"控件，每页 `RESOURCE_PAGE_SIZE = 3` 个视频源卡片；`loadResourceSwitchList` 缓存排序结果与上下文，`renderResourcePage` 按页渲染，`bindResourcePagination` 绑定翻页（翻页不重新请求，仅切换渲染）；仅 1 页时翻页按钮禁用、页码显示 1/1；删除原横滑/拖拽逻辑（`setupResourceScroll`）
11. **资源列表语义澄清**：源信息条 "N 个视频" 改为 "N 集"（当前源剧集数，避免与"其他视频源"卡片数混淆）——"24 集" 是当前源的剧集数，"其他视频源"卡片数是搜索匹配到的源站数量，两者维度不同；"其他视频源"标题已按用户要求移除
12. **切换资源模块与选集模块视觉统一**：`.resource-module` 加与 `#episodesGridContainer` 相同的边框（`1px solid #333` + 圆角 + `#151515` 背景 + padding）；`.resource-info-bar`（标题行）改为与 `.player-sidebar-header` 一致的样式（无独立背景、底部 `border-bottom` 分隔线），形成"选集模块 / 切换资源模块"两个带边框的集中模块
13. **侧栏三模块整体高度对齐左栏 + 资源列表占位稳定**：① 侧栏高度由 `initSidebarHeightSync` 实时同步为左栏高度（`sidebarHeightSync` 提取为可复用函数），并在 `renderResourcePage` 资源渲染完成后兜底调用，确保"收起 / 选集 / 其他视频源"三模块整体高度始终与左栏一致——桌面端 `#playerContainer { margin-bottom: 0 }` 去掉播放器底部 16px 间距，左栏高度即播放器高度，侧栏 = `main.offsetHeight` 严格对齐（无任何偏移）；② `.resource-switch-list` 加 `min-height: 205px`（与一行资源卡片等高），加载中/空态/错误提示用 `.loading-text` 在占位高度内居中——资源加载前后高度不跳动
14. **侧栏内部无滚动布局**：用户反馈右侧内部出现滚动——桌面端 `.player-sidebar-body` 改为 flex column + `overflow: hidden`；选集模块 `#episodesGridContainer` 改为 flex column（`flex-shrink: 1`，集数过多时网格内部滚动）；其他视频源模块 `.resource-module` 用 `flex: 1` 占选集之外剩余高度；`.resource-switch-list` 从横滑 flex 改为 grid 3 列（`grid-auto-rows: 1fr`），卡片 `.resource-switch-card` 改 flex column 且海报 `.resource-switch-card-poster` `flex: 1` + `aspect-ratio: auto`——视频样片在模块内自适应撑满高度；移动端保留 3 列 + 海报 3/4 比例不变
15. **选集与资源模块均分剩余高度**：用户要求选集与其他视频源模块平均分配剩余高度——两个模块均改为 `flex: 1`（basis 0，grow 均分），顶部收起按钮 `flex-shrink: 0` 固定在侧栏顶部不参与均分；选集网格 `.episode-grid` 与资源列表均隐藏内部滚动条（`scrollbar-width: none` + `::-webkit-scrollbar{display:none}`），侧栏整体无滚动
16. **切换资源改为同页切换（不刷新页面）**：用户要求点击其他视频源只重新加载播放器内容——`switchToResource` 不再 `window.location.href` 跳转，改为：切换前 `saveCurrentProgress` 保存进度 → fetch 新源详情 → 更新本地状态（`currentVideoTitle`/`currentEpisodes`/`currentEpisodeIndex`/`currentVideoUrl`）与 localStorage → `history.replaceState` 更新 URL → 重新 `initPlayer` 加载播放器 → 刷新集数信息/上一集下一集控制/集数网格/源信息/资源列表（重置分页）；页面不刷新、播放器无缝重载；且去掉 `showLoading` 全屏遮罩，切换时仅由 ArtPlayer 播放器自身展示加载状态
17. **切源全屏加载诊断**：排查发现 `switchToResource` 已无 `showLoading`/页面跳转；用户从首页/历史记录进入播放页必经 `watch.html` 中间页（自带"准备视频数据中/即将开始播放"加载过渡页约 2.8s 后跳转 `player.html`），该加载页属进入流程而非切源触发；另给 `player.html` 首屏 `#style-loader` 遮罩增加多路兜底隐藏（`load`/`DOMContentLoaded`/3s 无条件隐藏），避免遮罩因 `load` 事件延迟而长时间停留
18. **关闭播放器内置"加载中..."提示**：截图确认是播放器**内部**中央的 ArtPlayer 内置 loading（圆角矩形"加载中..."+ 转圈），不是全屏遮罩——`new Artplayer` 配置加 `loading: false`，切源/首屏加载时不再显示中央"加载中..."提示框，仅靠视频自动播放呈现
19. **切源不重新加载其他视频源面板**：用户要求切源时"其他视频源"面板不重新加载——`switchToResource` 不再调用 `loadResourceSwitchList()`（搜索+测速全量重载），改为仅更新 `resourcePageCtx` 的 `currentSourceCode`/`currentVideoId` 后调用 `renderResourcePage()` 重渲染当前页（只移动"当前播放"标记）；仅当资源列表尚未加载完成（`resourcePageCtx` 为 null）时才走一次完整加载
20. **切源恢复播放进度**：用户要求切源后集数相同且播放进度一致——`switchToResource` 开头记录 `resumePosition`（当前播放位置），切源 `replaceState` 时写入 URL `position` 参数，`initPlayer` 的 `loadedmetadata` 逻辑会读取该参数自动 seek 到相同进度（集数 `targetIndex` 已保留当前集数）；恢复条件沿用现有逻辑（position > 10 秒且小于时长才恢复，避免误恢复开头）

## 怎么验证的
命令行执行器在当前环境故障（cmd 包装 pwsh 路径未加引号），无法运行 `npm run dev`；已通过 VS Code 语言服务 lint（player.html / player.css / player.js 均无诊断）与人工 DOM/CSS/JS 静态复核。需本地 `npm run dev` 后浏览器手动验证：桌面宽屏播放器居左、右侧面板收起/展开/状态记忆、折叠后播放器画面正确、移动端布局不变。

## 顺手发现（可选，不阻塞）
- DPlayer 时代遗留的 `controls-locked` 规则（`.dplayer-*` 选择器）对 ArtPlayer 不生效——已在本次 REV-001 review-fix 中迁移为 ArtPlayer 选择器并清理。
