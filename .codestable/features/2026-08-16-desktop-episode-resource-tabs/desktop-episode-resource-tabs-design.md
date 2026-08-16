---
doc_type: feature-design
feature: desktop-episode-resource-tabs
date: 2026-08-16
status: approved
execution_lane: standard
requirement: null
tags: [player, desktop, ui, tab, layout]
depends_on: [mobile-episode-resource-tabs, player-sidebar-collapse]
supersedes: null
---

# 设计：桌面/平板端选集 / 视频源 改 Tab 页切换（保留侧栏收起展开）

## 1. 背景与问题

### 1.1 现状（三断点行为）

播放页选集与视频源面板当前按断点分三种呈现：

| 断点 | Tab 栏 | 面板展示 | 侧栏收起 |
|---|---|---|---|
| ≤640（移动端） | ✅ `#mobilePanelTabs`（默认选集） | 互斥单面板（`is-tab-active`） | 无 |
| 641-1023（平板） | ❌ CSS 隐藏 | 选集/资源纵向堆叠 | 无 |
| ≥1024（桌面） | ❌ CSS 隐藏 | 选集/资源 `flex: 1` 均分侧栏高度 | ✅ `sidebar-collapsed` |

现状来源：
- 移动端 Tab：`js/mobile-panel-tabs.js` + `css/player.css:414-462`（`@media (max-width: 640px)` 块）
- ≥641 隐藏 Tab：`css/player.css:485-489`（`@media (min-width: 641px) { #mobilePanelTabs { display: none !important } }`）
- 桌面分栏/收起：`css/player.css:695-864`（`@media (min-width: 1024px)` 块）+ `js/player.js` `togglePlayerSidebar` / `initPlayerSidebar`（`player.js:1809-1831`）
- 断点清理：`js/mobile-panel-tabs.js` `init()` 内 `matchMedia` 分支（≤640 → `activate('episodes')`；≥641 → `cleanup()` 移除两面板 `is-tab-active`）

### 1.2 用户诉求（本轮确认）

1. 电脑端（**641px 以上全部**：平板 + 桌面）的选集/视频源与移动端一样做成 **Tab 页切换**
2. **保留**桌面端（≥1024）侧栏的**收起/展开**能力
3. 移动端（≤640）维持现状不变

### 1.3 设计约束（来自已有约定与沉淀）

- **AGENTS.md 响应式设计原则**：单一 DOM + CSS 媒体查询，JS 不按屏幕宽度生成不同 HTML 结构
- **compound `mobile-panel-mutex-active-class`**：互斥显隐用单一激活类 `is-tab-active` + 高特异性选择器前缀（`.player-sidebar-body`）覆盖既有 `display:none`；HTML 静态预置默认激活类作无 JS 兜底
- **compound `resource-load-race`**：`activate('resources')` 绝不调用 `loadResourceSwitchList()`（fire-and-forget，任何兜底调用会与在途请求并发覆盖分页）；资源由 `player.js` 加载链路无条件启动
- **compound `pagination-grid-height-consistency`**：断点阈值 JS/CSS 一致（640/641）；三端都用 Tab 后无跨断点类残留问题
- **AGENTS.md 禁区**：不新增移动端 CSS 文件；不改代理/密码注入逻辑
- 已存在契约：`is-tab-active` 类、`#mobilePanelTabs` DOM、`MobilePanelTabs` 命名空间（`init`/`activate`/`getActiveTab`/`cleanup`）

## 2. 目标与非目标

### 2.1 目标

- 641px 以上（平板 + 桌面）显示 Tab 栏 **[选集 | 视频源]**，默认激活"选集"，与移动端一致
- Tab 切换互斥单面板：激活面板占满可用区域（桌面 ≥1024 占满侧栏剩余高度），隐藏面板不参与布局
- 桌面 ≥1024 **保留**侧栏收起/展开（`#sidebarToggle` / `#sidebarHandle` / `sidebar-collapsed` / localStorage 记忆），收起时 Tab 栏随 `.player-sidebar-body` 一起隐藏
- 不重复触发资源加载：Tab 激活只做 `is-tab-active` 类切换，不调用 `loadResourceSwitchList()`（与移动端现有语义一致）
- 移动端 ≤640 行为零变化
- 断点切换（≤640 ↔ ≥641）无残留类错位

### 2.2 非目标

- 不新增依赖 / 不引入 Tab 库 / 不改动选集分页与资源加载/切源的**数据逻辑**（分页状态、切集跳页、切源路径、`EPISODES_PER_PAGE`/`RESOURCE_PAGE_SIZE` 语义不变）
- 不持久化"上次激活的 Tab"（每次进入默认"选集"，与移动端一致）
- 不改侧栏收起展开逻辑本体（`togglePlayerSidebar` / `initPlayerSidebar` / `sidebar-collapsed` 样式）
- 不做 Tab 切换动画 / ARIA role=tablist 标准化
- 不改动 `#mobilePanelTabs` / `.mobile-tab` 的既有类名与 ID（复用现有 DOM，避免无功能收益的大范围改名）

> **验收阶段补充（2026-08-16 用户浏览器反馈）**：两面板网格需"每页填充满"——选集/资源分页渲染后补 `visibility:hidden` 占位项填满最后一行空缺（参照 compound `pagination-grid-height-consistency` 设置面板先例，用空 `<div>` 占位避免污染查询）；数据源 `RESOURCE_PAGE_SIZE` 3 → 6（3 列 × 2 行填满侧栏高度），并修正桌面端资源卡片封面 `aspect-ratio: auto` 拉伸变形问题——恢复 `aspect-ratio: 3/4`（封面不变形）。此补充仅涉及**渲染层的占位填充与封面比例修正**，不改分页数据逻辑。

## 3. 用户故事与验收

| ID | 用户 | 故事 | 验收 |
|---|---|---|---|
| US-1 | 桌面（≥1024） | 加载播放页 → 看到侧栏收起按钮 + Tab 栏（选集/视频源）+ 选集面板 | Tab 栏显示于 `#sidebarToggle` 之下、`#episodesGridContainer` 之上；默认激活"选集"；资源面板隐藏；收起/展开按钮可用 |
| US-2 | 桌面 | 点"视频源" Tab | 切换到资源面板，资源列表占满侧栏剩余高度；**不重复触发加载、分页不归零**（含切源后"当前播放"标记保留） |
| US-3 | 桌面 | 点"收起" → 点把手展开 | 侧栏收起为 48px 把手、Tab 栏随 body 隐藏；展开后 Tab 状态与两面板激活态不变；刷新后收起状态被 localStorage 记忆（现状语义） |
| US-4 | 平板（641-1023） | 加载播放页 | Tab 栏显示，默认"选集"，资源面板隐藏；无收起按钮（现状无分栏） |
| US-5 | 平板 | 点"视频源" → 点"选集" | 互斥切换正常；选集/资源各自状态（分页、当前集高亮）保留 |
| US-6 | 移动端（≤640） | 任意操作 | 行为与改动前完全一致：Tab 栏默认"选集"、互斥切换、无展开按钮 |
| US-7 | 任意 | 选集 Tab 下把窗口从 ≤640 拉到 ≥641 再拉回 | 无残留类错位（三端同行为后无断点清理需求） |
| US-8 | 任意 | 选集分页翻页 → 切视频源 → 切回选集 | 选集分页页码保留（Tab 切换不重渲染） |
| US-9 | 任意 | 视频源分页翻页 → 切选集 → 切回视频源 | 资源分页页码保留 |

## 4. 设计

### 4.1 架构总览

```
                  ┌─ 所有断点（≤640 / 641-1023 / ≥1024）─────────────┐
[player.html] ──► │ #mobilePanelTabs（Tab 栏，三端均显示）            │
                  │   ├─ [选集]  [视频源]                              │
                  │ .player-sidebar-body                              │
                  │   ├─ #episodesGridContainer（is-tab-active 默认）  │
                  │   └─ .resource-module（不带 is-tab-active）        │
                  └──────────────────────────────────────────────────┘
                  ┌─ ≥1024 追加：sidebar-collapsed 收起态 ────────────┐
                  │ 收起 → body 隐藏（Tab 随隐藏）、把手显示            │
                  └──────────────────────────────────────────────────┘
```

关键点：
- **DOM 零改动**：`#mobilePanelTabs` 已在 DOM（`player.html:155-158`），HTML 静态预置的 `is-tab-active`（`#mobileTabEpisodes` 与 `#episodesGridContainer`）对三端默认"选集"同样成立
- **互斥规则通用化**：`is-tab-active` 互斥显隐从 `@media (max-width: 640px)` 块上移到通用区，三断点统一生效
- **Tab 栏样式通用化**：`#mobilePanelTabs` / `.mobile-tab` 样式从移动端块上移到通用区
- **删除 ≥641 隐藏块**：`css/player.css:485-489`
- **桌面 flex 占满自动成立**：激活面板带 `flex: 1`（桌面 ≥1024 已有规则），未激活面板被互斥规则 `display: none`，激活面板自动占满侧栏剩余高度

### 4.2 JS 改动（js/mobile-panel-tabs.js）

**现状**：`init()` 绑定 Tab 点击后按断点分支（≤640 → `activate('episodes')`；≥641 → `cleanup()`），并注册两条 `matchMedia` change 监听做断点清理。

**变化**（模块简化，删除断点分支与监听）：

```js
function init() {
    if (initialized) return;
    initialized = true;
    // 三断点统一默认"选集"（HTML 已静态预置 is-tab-active，此处核对同步）
    activate('episodes');
    // 点击绑定（保留现有）
    // 删除：matchMedia 断点分支与 change 监听
}
```

- `activate(tabKey)` **不变**：`classList.toggle('is-tab-active')` 互斥切换两面板 + 两 Tab 按钮；不调用 `loadResourceSwitchList()`
- `getActiveTab()` **不变**
- `cleanup()` **删除**（三端同行为后无断点清理场景；全局检索确认无外部调用方）
- `activeTab` 初始值逻辑不变（默认 `'episodes'`）

> 注意：三端统一后 `cleanup` 的唯一调用场景消失。若未来引入"无 Tab 展示模式"，按需重新引入，不在本期。

### 4.3 CSS 改动（css/player.css）

**（1）Tab 栏样式上移通用**：`@media (max-width: 640px)` 块内的 `#mobilePanelTabs` / `.mobile-tab` / `.mobile-tab.is-tab-active` / `.mobile-tab + .mobile-tab`（现 414-444 行）移动到通用区（`.player-sidebar-header` 区域附近），去掉移动端限定。

**（2）互斥规则上移通用**：`.player-sidebar-body #episodesGridContainer:not(.is-tab-active), .player-sidebar-body .resource-module:not(.is-tab-active) { display: none !important; }`（现 459-462 行）从移动端块移动到通用区。保留 `.player-sidebar-body` 前缀维持高特异性（id 分支 `#episodesGridContainer` 为 (1,2,0)、class 分支 `.resource-module` 为 (0,3,0)，两规则均带 `!important`），足以覆盖两面板基础/移动端 `display` 规则。

**（3）删除 ≥641 隐藏块**：`@media (min-width: 641px) { #mobilePanelTabs { display: none !important; } }`（现 485-489 行）整块删除。

**（4）`.resource-module` 顶部间距归零**：基础样式（现 569-575 行）`margin-top: 0.5rem` 改为 `margin-top: 0`。三端 Tab 场景下资源模块永远跟在 Tab 栏后，间距由 Tab 栏 `margin-bottom: 0.5rem` 提供；`margin-top` 残留会导致桌面 `flex: 1` 占满时顶部多出 0.5rem 偏移，移动端块内 `margin-top: 0 !important` 覆盖可一并简化（保留无害，不强制）。

**（5）桌面 ≥1024 块不动**：`#episodesGridContainer { flex: 1 }`（738-743）与 `.resource-module { flex: 1 }`（764-769）保留——互斥规则隐藏未激活面板后，激活面板自动占满剩余高度。`sidebar-collapsed` 收起态样式（836-863）不动。

**（6）移动端块保留**：`#episodesGridContainer` / `.resource-module` 的 `display: flex !important; flex-direction: column !important`、`#episodesList` 3 列、`.episode-grid { max-height: 40vh }`、`.player-sidebar .player-container` 覆盖均保留（移动端专有布局约束）。

> 平板（641-1023）无固定高度容器，两模块保持块级布局（现有基础样式）：选集面板 `.episode-grid` 用基础 `max-height: 30vh` 内部滚动；资源面板 `.resource-switch-list` 用基础 grid 3 列。互斥规则上移后平板自动获得 Tab 互斥能力。

### 4.4 HTML 改动（player.html）

- **无 DOM 改动**：`#mobilePanelTabs` / 两 Tab 按钮 / 静态预置 `is-tab-active` 均已存在
- 仅更新注释文案：`player.html:154` 的"移动端 Tab 栏（选集/视频源，仅移动端显示；桌面端由 CSS 隐藏）"改为"Tab 栏（选集/视频源，三断点显示；≥1024 收起时随侧栏隐藏）"（可选，不影响功能）

### 4.5 行为序列

| 场景 | 关键步骤 |
|---|---|
| 页面加载（任意断点） | mobile-panel-tabs.js `init`：绑定点击 + `activate('episodes')` 核对同步（HTML 已预置）；Tab 栏 CSS 显示 |
| 点"视频源" Tab（三端） | `activate('resources')`：移除选集 `is-tab-active`，给 `.resource-module` 加 `is-tab-active`，同步 Tab 按钮；**不触发** `loadResourceSwitchList()`（资源由 player.js 链路异步启动） |
| 点"选集" Tab | 反向同步 |
| 桌面点"收起"（≥1024） | `togglePlayerSidebar` 加 `sidebar-collapsed`；body `display: none`，Tab 栏随隐藏；把手显示 |
| 桌面点把手展开 | 移除 `sidebar-collapsed`；body 恢复，Tab 激活态保持（未做任何清理） |
| 窗口跨 640px | 无断点监听、无清理逻辑；`is-tab-active` 恒定，三端同行为，天然无残留 |
| 切集 / 切源 / 分页翻页 | 由现有 `renderEpisodes()` / `renderResourcePage()` / `switchToResource()` 驱动，Tab 无需感知 |

### 4.6 状态持久化

- 不新增 localStorage key
- 侧栏收起状态沿用现有 `playerSidebarCollapsed`（`js/player.js` 现状，不改动）
- Tab 激活不持久化（刷新回默认"选集"）

## 5. 测试与验证

### 5.1 自动化（最小）

- `node --check js/mobile-panel-tabs.js`
- `node --check js/player.js`（确认无 `MobilePanelTabs.cleanup` 等残留引用）
- VS Code 语言服务 lint（player.html / player.css / player.js 无诊断）
- grep 全仓库无 `MobilePanelTabs.cleanup` 调用残留

### 5.2 手动（必跑，三断点浏览器验证）

| # | 步骤 | 期望 |
|---|---|---|
| M1 | 桌面 ≥1024 加载页面 | 侧栏顶部为收起按钮，下方 Tab 栏（选集/视频源），选集面板激活、资源隐藏；无 `#mobilePanelTabs` 被 CSS 隐藏 |
| M2 | M1 后点"视频源" | 切到资源面板，卡片列表占满侧栏剩余高度；不重复触发加载（网络面板无二次搜索请求） |
| M3 | M2 后点"收起"再点把手展开 | 收起为 48px 把手（Tab 随 body 隐藏）；展开后仍在"视频源" Tab，资源面板状态保留 |
| M4 | M2 资源分页翻到第 2 页 → 切选集 → 切回视频源 | 仍在第 2 页 |
| M5 | M1 选第 N 集 → 切视频源 → 切回选集 | 当前集高亮与页码一致 |
| M6 | 刷新页面 | 回到默认"选集" Tab；侧栏收起状态按 localStorage 记忆 |
| M7 | 平板 641-1023 加载 | Tab 栏显示、默认选集、资源隐藏、无收起按钮 |
| M8 | 平板切 Tab | 互斥切换正常，选集/资源状态保留 |
| M9 | 移动端 ≤640 加载 | 与改动前一致：Tab 默认选集、互斥切换、无展开按钮 |
| M10 | 窗口 ≤640 → ≥641 → ≤640 | 无残留类错位；Tab 激活态不丢失 |
| M11 | 多集数（60 集）+ 多资源场景切换 | 切换流畅、无闪烁、无重复加载 |

### 5.3 回归（确保不破已有）

| 区域 | 验证点 |
|---|---|
| 侧栏收起展开 | `sidebar-collapsed` 切换、状态记忆、`art.resize()` 重算（现状语义） |
| 集数分页翻页 | 分页、倒序、切集跳页、当前集高亮 |
| 自动连播 | 跨集自然结束时下一集高亮可见 |
| 切源 | `switchToResource` 内部路径不变（0 修改） |
| 移动端 | 与 2026-08-14 mobile-episode-resource-tabs 验收一致（M1-M12 等效场景） |
| 资源加载 | 无重复请求、分页不归零（compound `resource-load-race` 约束保持） |

## 6. 文件改动清单

| 文件 | 改动 |
|---|---|
| `js/mobile-panel-tabs.js` | 简化：`init()` 删除 matchMedia 断点分支与 change 监听，统一 `activate('episodes')`；删除 `cleanup()` 函数与导出 |
| `css/player.css` | ① Tab 栏样式（`#mobilePanelTabs` / `.mobile-tab*`）从移动端块上移通用；② `is-tab-active` 互斥规则上移通用；③ 删除 `@media (min-width: 641px)` 的 Tab 隐藏块；④ `.resource-module` 基础 `margin-top` 0.5rem → 0 |
| `player.html` | 仅更新注释文案（可选） |

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 互斥规则上移通用后与既有 `display` 规则冲突（特异性不足导致隐藏失效） | 保留 `.player-sidebar-body` 前缀高特异性 (1,2,0)；上移后三端实测（M1/M4/M7） |
| 平板块级布局下 Tab 切换后高度异常 | `.episode-grid` 基础 `max-height: 30vh` 已约束；资源列表 `min-height: 205px` 占位稳定 |
| 桌面资源模块 `margin-top` 归零遗漏导致 flex 占满偏移 0.5rem | checklist 显式列 `margin-top: 0`；M2 验证"卡片占满剩余高度" |
| 删除 `cleanup` 后存在残留引用 | 已全局检索：`MobilePanelTabs` 仅 `js/mobile-panel-tabs.js` 定义与使用；checklist 含 grep 验证步骤 |
| 平板/桌面激活资源 Tab 重复触发资源加载 | `activate` 保持零加载调用（compound `resource-load-race` 约束，code-review 重点复查） |
| 断点切换残留类（旧问题） | 三端同行为后 `is-tab-active` 恒定，无断点清理需求，天然消除 |

## 8. 不在本期范围

- Tab 切换 ARIA role=tablist / tab / tabpanel 标准化（沿用 2026-08-14 决策，a11y issue 单独立项）
- 持久化"上次激活的 Tab"
- Tab 切换动画 / 指示器动画
- 修改侧栏收起展开逻辑本体或收起样式
- 重命名 `#mobilePanelTabs` / `.mobile-tab`（最小 diff 决策，无功能收益）

## 9. 工作流（Standard lane，本 run 完成）

1. **Design（本产物）** → 用户对 design 修订确认后继续
2. **Implementation** → 本 run 内完成
3. **Code Review** → 独立 subagent review
4. **Accept-inline** → 含 Inline Verification Matrix，按 M1-M11 + 回归清单核验

完成 marker：`CS_FEATURE_STANDARD_COMPLETE`，slugs `desktop-episode-resource-tabs-*.md` 共 4 份产物落盘在 `.codestable/features/2026-08-16-desktop-episode-resource-tabs/`。
