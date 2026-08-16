# 三断点统一 Tab 互斥 + getComputedStyle().gridTemplateColumns 的 display:none 解析陷阱

## 背景

LibreTV 播放页将"选集/视频源"面板从"仅移动端 Tab、桌面/平板并列堆叠"统一为**全部断点（≤640 / 641-1023 / ≥1024）Tab 互斥切换**，桌面 ≥1024 保留侧栏收起/展开。改造前移动端已有 `is-tab-active` Tab 机制（2026-08-14），桌面/平板是两面板 `flex:1` 均分或纵向堆叠。统一过程中踩了两个坑：① 互斥规则/样式放断点块内导致三端行为分裂，需上移通用区；② 选集网格"每页填充满"用 `getComputedStyle().gridTemplateColumns.split(' ')` 计列数，在 `display:none` 场景下算错列数导致多补占位产生空行。

## 结论

1. **三断点同行为的 UI 结构，互斥规则与相关样式必须放通用区而非断点块内**：`is-tab-active` 互斥规则（`.player-sidebar-body #episodesGridContainer:not(.is-tab-active)` 等）从 `@media (max-width:640px)` 块上移到通用区后，三端自动获得 Tab 互斥能力；配合"HTML 静态预置默认激活类"兜底，JS 只做 `classList.toggle`。断点相关的清理逻辑（matchMedia 监听、cleanup 函数）随之删除——三端同行为后激活态恒定，天然无跨断点残留，代码反而更简。
2. **分页网格"每页填充满"：用"每页数量对齐列数"为主（如 21 集 = 3 列×7 行）+ 透明占位补末行空缺**。占位用自定义 CSS 类（`visibility:hidden` + `min-height` 匹配行高 + `aria-hidden`），**不要用 Tailwind CDN 的 `invisible`**——项目内该类依赖 CDN 运行时生成、未验证生效，且透明占位格子在视觉上仍是"空的"；数量对齐列数才能做到真正铺满。
3. **`getComputedStyle().gridTemplateColumns` 在元素未布局（父容器 `display:none`）时返回含内部空格的抽象 track list（如 `"minmax(0px, 1fr) minmax(0px, 1fr) minmax(0px, 1fr)"`），`split(' ')` 计列数会翻倍**（3 列算成 6）。已布局时才是 px 轨道（空格数 = 列数）。两种形态不可用同一 split 逻辑。**可靠做法：列数按断点映射硬编码**（`innerWidth` 断点 → 列数，与 CSS 媒体查询一致），不要在运行期解析 computedStyle；若必须读，需能识别 `minmax()`/`repeat()` 内部空格（正则数顶层分隔符）。
4. **断点阈值 JS/CSS 必须一致**：占位列数映射（≤640→3、641-767→4、768-1023→6、≥1024→3）需与 `#episodesList` 实际 grid 列数逐一核对（Tailwind `grid-cols-2 sm:4 md:6 lg:8` 与 player.css 覆盖的关系），否则占位数错配。参考 `pagination-grid-height-consistency` 的断点阈值一致性纪律。

## 证据

- 实现：`js/mobile-panel-tabs.js`（三端统一 `init()`，无 matchMedia/cleanup）、`css/player.css`（互斥规则 + `.episode-placeholder`/`.resource-placeholder` 通用区、桌面 `.resource-switch-card-poster { aspect-ratio:3/4 }`）、`js/player.js`（`EPISODES_PER_PAGE=21`、`RESOURCE_PAGE_SIZE=6`、`episodePlaceholderCount()` 断点映射列数）
- `.codestable/features/2026-08-16-desktop-episode-resource-tabs/desktop-episode-resource-tabs-review.md` — Round 2 I-1：`split(' ')` 在 display:none 下列数算错（桌面 3 列→6）导致多补 3 占位产生空行，修复为断点映射
- `.codestable/features/2026-08-16-desktop-episode-resource-tabs/desktop-episode-resource-tabs-acceptance.md` — 用户两轮反馈（选集空缺、封面拉伸）→ 修复后终审通过
- 相关先例：`.codestable/compound/2026-08-09-pagination-grid-height-consistency.md`（设置面板分页占位 + 断点阈值一致）、`.codestable/compound/2026-08-14-mobile-panel-mutex-active-class.md`（互斥单一激活类 + 高特异性覆盖）
