# 移动端播放页选集/数据源面板改造：展开收起、等高、对齐与分页

> **⚠️ 已废弃（2026-08-14）**：本文档记录的"外层展开/收起按钮 + 就地展开 + 等高布局"方案已被
> `2026-08-14-mobile-episode-resource-tabs`（移动端选集/视频源改 Tab 页切换，默认直接展示）取代。
> 展开/收起按钮、`toggleMobileEpisodes`、等高同步（`syncMobilePanelHeight` / `startMobilePanelHeightSync` 等）
> 均已随该 feature 删除。**新布局模式见 `.codestable/compound/2026-08-14-mobile-panel-mutex-active-class.md`**
> （单一激活类 + 高特异性覆盖 + 无固定高度时 flex 坍塌坑 + matchMedia 断点清理）。
> 本文档保留作为历史沉淀与排查思路参考（对齐/分页模式仍适用），但其中交互结构描述不再代表当前实现。

## 背景

LibreTV 播放页移动端（≤640px）的选集入口从"独立小按钮 + 底部抽屉弹框"逐步改造为"外层展开/收起按钮 + 就地展开选集面板和数据源面板"。过程中连续踩了容器宽度、内边距累加、等高布局、分页复用等 CSS/布局坑，且每次"没对齐"的根因都不同，值得沉淀排查路径。

## 结论

1. **`.player-container` 的居中/宽度约束在移动端侧栏内必须覆盖**：`.player-container { width:100%; max-width:1000px; margin:0 auto }` 是历史遗留类，桌面端侧栏内已有 `.player-sidebar .player-container { max-width:none; margin:0 }` 覆盖，但**移动端遗漏**。侧栏内 `#episodesGridContainer` / `#resourceInfoBarContainer` / `#resourceSwitchList` 都带 `.player-container` 类，未覆盖时带 padding/border 的容器总宽异常或受 `margin:0 auto` 影响。移动端补齐同一覆盖并加 `box-sizing:border-box`：`.player-sidebar .player-container { box-sizing:border-box; max-width:none; margin:0 }`。

2. **"两行没对齐"的根因常是嵌套容器的水平 padding 累加**：资源信息条 `#resourceInfoBarContainer` 移动端原为 `padding:0.75rem`（四边），内容左缘 = 外层 `.resource-module` 的 0.5rem + 自身 0.75rem = 1.25rem；而选集标题行 `.player-sidebar-header` 自身左右 padding 为 0（外层容器 0.5rem），左缘仅 0.5rem，两行差 0.75rem 导致"选集"与资源名、分页右缘全部错位。改为 `padding:0.75rem 0`（水平归零）后对齐。排查此类问题先逐层算清每个容器的水平 padding。

3. **等高面板用 JS 测量 + MutationObserver，不要固定高度**：用户明确不要 `60dvh` 固定高度均分，要求"选集面板 = 资源面板加载出内容后的实际高度"。实现：展开时 `syncMobilePanelHeight()` 读 `.resource-module.offsetHeight` 写入选集面板 `style.height`；用 `MutationObserver` 监听资源面板子树（加载中→完成、分页翻页）自动重同步；选集面板内部 flex column，网格 `flex:1; min-height:0; overflow-y:auto`，内容超高时内部滚动。

4. **集数分页直接复用资源面板分页模式**：标题行右侧放 `[‹] 页码 [›]`（复用 `.resource-scroll-btn` / `.resource-page-info` / `.resource-info-bar-actions` 样式），JS 维护 `episodePage`（0 基）+ clamp 到合法页 + 切片渲染当前页 + 更新页码/翻页按钮禁用态 + 绑定 onclick；排序切换（`toggleEpisodeOrder`）时重置页码回第一页；切集/切源后 `renderEpisodes()` 自动刷新。

5. **交互取舍**：移动端弹框（底部抽屉）被"就地展开"取代后成死代码（无入口），暂留未删；外层按钮从"弹框触发"演进为"一个按钮控制整体展开/收起"，面板内部不再有二级展开（展开即完整显示标题行+工具栏+网格），按钮文字动态"展开/收起"与桌面端"收起"语义统一；按钮可见性靠 `hidden` class 默认隐藏 + 移动端 `display:flex!important` 覆盖。

## 证据

- `player.html:147-202` — 外层展开/收起按钮 + 选集面板（标题行 + 工具栏 + 分页控件 + 网格）结构（**⚠️ 按钮与 `#mobileEpisodeSelectContainer` 已随 2026-08-14 feature 删除**；面板结构仍保留）
- `css/player.css:771+` — 移动端播放页规则：展开/收起、等高布局、对齐修复（`.player-sidebar .player-container`、`#resourceInfoBarContainer` padding 归零）（**⚠️ 展开/收起与等高规则已删除**；`.player-sidebar .player-container` 覆盖与 padding 归零仍保留）
- `js/player.js` — `toggleMobileEpisodes` / `syncMobilePanelHeight` / `startMobilePanelHeightSync`（MutationObserver）/ `renderEpisodes` / `updateEpisodePagination` / `bindEpisodePagination` / `renderResourceInfoBar`（**⚠️ 前三个已随 2026-08-14 feature 删除**；`renderEpisodes` / 分页函数 / `renderResourceInfoBar` 仍有效）
- 与本仓库既有沉淀 `2026-08-08-player-layout-collapsible-sidebar.md`（桌面端侧栏分栏/折叠）互补，两者合起来是播放页响应式布局的完整图景
