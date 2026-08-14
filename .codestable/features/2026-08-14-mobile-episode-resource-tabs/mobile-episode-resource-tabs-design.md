---
doc_type: feature-design
feature: mobile-episode-resource-tabs
date: 2026-08-14
status: draft
execution_lane: standard
requirement: null
tags: [player, mobile, ui, tab, layout]
depends_on: [mobile-episode-resource-panels]
supersedes: null
---

# 设计：移动端选集 / 视频源 改 Tab 页切换（默认直接展示）

## 1. 背景与问题

### 1.1 现状（来自 2026-08-08 mobile-episode-resource-panels）

移动端播放页选集与资源（"光速资源"）当前以**外层按钮 + 就地展开 + 两面板并列**的形式呈现：

- 一个外层按钮 `#mobileEpisodeSelectBtn`（"展开/收起"），点击后同时展开两个面板
- `#episodesGridContainer`（选集）和 `.resource-module`（视频源）以**等高布局**并排显示
- 标题行/工具栏/网格/分页与桌面侧栏共用一套 DOM，CSS 媒体查询区分移动/桌面

带来两个体验问题：

1. **多一层交互**：用户每次都要先点"展开"才能看到选集/资源
2. **屏幕纵向空间紧张**：两面板同时展示时挤在一起，纵向滚动距离长；且用户当前活跃（"第 17/20 集"）时被同时看到的资源列表与工具栏干扰

### 1.2 用户诉求（本轮更新）

1. 将移动端选集与视频源改为 **Tab 页切换**（"选集 | 视频源"）
2. **不要展开/收起按钮**——移动端**默认直接展示** Tab 栏 + 选集内容

### 1.3 设计约束（来自已有约定）

- **AGENTS.md 禁区**：`player.js` 和 `app.js` 不再追加新功能到文件末尾，新功能应拆到独立模块（删除既有死代码不受此限）
- **AGENTS.md 响应式设计原则**：单一 DOM + CSS 媒体查询，JS 不根据屏幕宽度生成不同 HTML 结构
- **项目纪律**：死代码应及时清理（参照 2026-08-08 REV-006 清理弹框链路的先例）
- **加载性能**：当前视频源列表按需 `loadResourceSwitchList()` 异步加载（避免首屏阻塞）——保留该语义

## 2. 目标与非目标

### 2.1 目标

- 移动端（≤640px）下，**默认直接展示** Tab 栏 **[选集 | 视频源]**，默认激活"选集"，资源面板隐藏
- 点 "视频源" Tab → 切到资源列表；点 "选集" → 切回
- **移除**移动端外层展开/收起按钮（`#mobileEpisodeSelectBtn`）及其全部链路（JS/CSS/DOM）
- Tab 切换不重渲染、不重置分页、不重发资源列表请求
- **不重复触发资源加载**：资源列表在页面加载时已由现有 `loadVideo` 链路加载（`player.js:314` 无条件调用 `loadResourceSwitchList()`），Tab 激活绝不再触发加载，避免分页归零
- 桌面端（≥1024 分栏 / 平板 641-1023）行为完全不变（无 Tab 栏，两模块按现状展示）
- 不破坏已有边界：桌面端分栏、断点切换（≤640→≥641 清理）

### 2.2 非目标

- 不引入新依赖（不引入 Tab 库、不引入框架）
- 不改桌面端 DOM 结构与样式
- 不动 `#episodesGridContainer` 与 `.resource-module` 各自的内部实现（保持已有渲染逻辑）
- 不改 `js/mobile-panel-gestures.js`（与选集/视频源面板无关）
- 不为移动端恢复"收起面板"能力（用户明确去掉展开交互）
- 平板断点（641-1023）不做 Tab 布局

## 3. 用户故事与验收

| ID | 用户 | 故事 | 验收 |
|---|---|---|---|
| US-1 | 移动用户 | 加载播放页 → 看到播放器 → 下方直接看到 Tab 栏 + 选集 | Tab 栏与选集面板默认可见，资源面板隐藏；无任何"展开"按钮 |
| US-2 | 移动用户 | 点 "视频源" Tab → 看到资源列表（页面加载时已加载完成） | Tab 切换，资源面板可见；**不重复触发加载、不重置分页** |
| US-3 | 移动用户 | 资源分页翻到第 2 页 → 切回"选集" → 切回"视频源" | 仍在第 2 页，分页状态保留 |
| US-4 | 移动用户 | 选集中点第 17 集 → 切到"视频源" → 切源完成 → 切回"选集" | 选集仍显示切集后的当前集高亮与页码 |
| US-5 | 移动用户 | 刷新页面 / 重新进入 | 默认回到"选集" Tab |
| US-6 | 桌面用户 | 任意操作 | 桌面/平板行为与改动前完全一致：无 Tab 栏，侧栏两模块按现状展示，资源面板按当前实现加载 |
| US-7 | 移动用户 | 选集 Tab 下把窗口拉到 ≥641px → 拉回 ≤640 | 断点切换无残留错位（继承 REV-004 语义） |
| US-8 | 移动用户 | 视频源 Tab 当前页码、切源状态 | Tab 内部状态完整保留，切换不影响播放进度 |

## 4. 设计

### 4.1 架构总览

```
                   ┌─ 移动端 (≤640) ────────────────────────────┐
[player.html] ───► │ #mobilePanelTabs (Tab 栏，默认可见)         │
                   │   ├─ [选集]  [视频源]                        │
                   │ .player-sidebar-body                        │
                   │   ├─ #episodesGridContainer (is-tab-active)  │
                   │   └─ .resource-module       (无 is-tab-active)│
                   └────────────────────────────────────────────┘
                   ┌─ 桌面端 (≥1024 分栏 / 平板) ────────────────┐
                   │ .player-sidebar-body                        │
                   │   ├─ #episodesGridContainer                  │
                   │   └─ .resource-module                        │
                   └────────────────────────────────────────────┘
```

关键点：

- **DOM 不分岔**：Tab 容器 `#mobilePanelTabs` 始终存在于 DOM，仅在移动端被 CSS 显示；JS 不生成不同 HTML
- **Tab 显隐靠单一类**：`is-tab-active` 控制两个面板的互斥可见性（两个面板同一时刻只有一个带此类）
- **两面板内部逻辑零改动**：选集渲染、资源加载/分页/切源全部沿用现有函数

### 4.2 新增模块：`js/mobile-panel-tabs.js`

按 AGENTS.md 禁令，"新功能" 必须拆到独立模块。

**模块导出**：

```js
// 全局命名空间挂载，defer 脚本自动初始化
window.MobilePanelTabs = {
  init(),              // 初始化：绑定 Tab 点击 + 设置默认激活态
  activate(tabKey),    // 切换 Tab：'episodes' | 'resources'
  getActiveTab(),      // 当前 Tab：'episodes' | 'resources'
  cleanup(),           // 断点进入桌面端时清理 is-tab-active（复用 REV-004 思路）
};
```

**初始行为**：

- `DOMContentLoaded` 时绑定：
  - `#mobileTabEpisodes` / `#mobileTabResources` 点击 → `activate(key)`
  - `matchMedia('(max-width: 640px)')` change 进入移动端 → 重置默认激活 'episodes'（同时恢复 Tab 按钮激活态，见 I2 修复）
  - `matchMedia('(min-width: 641px)')` change 进入桌面端 → `cleanup()` 仅移除两面板的 `is-tab-active`（**不动 Tab 按钮类**，见 I2 修复）
- **默认状态**：初始化时若处于移动端断点，给 `#episodesGridContainer` 加 `is-tab-active`（默认"选集"）
- **资源加载不重复触发（B1 修复，含 code-review B-1 深化）**：`js/player.js:314` 的 `loadVideo` 在页面加载时**已无条件调用** `loadResourceSwitchList()`（桌面/移动皆如此；密码门禁路径由 `passwordVerified` 事件触发 `initializePageContent` 后同样启动）。该函数是**异步 fire-and-forget**，加载完成前 `resourcePageCtx` 保持 `null`。因此 **`activate('resources')` 绝不主动调用 `loadResourceSwitchList()`**——任何"兜底调用"都会与首次请求并发，导致互相覆盖与分页归零（B-1 修复：模块内已移除全部加载触发逻辑）
- **leave Tab 不销毁**：两面板的 innerHTML 与 JS 状态保持原样，切换仅改类
- **不持久化**：刷新回到默认"选集"（US-5）

### 4.3 DOM 改动（player.html）

1. **删除** `#mobileEpisodeSelectContainer` 整块（含 `#mobileEpisodeSelectBtn` / `#mobileEpisodeToggleText` / `episode-chevron` 图标）
2. **新增** Tab 容器，置于 `.player-sidebar-body` 内、`#episodesGridContainer` 之前：

```html
<!-- 移动端 Tab 栏（仅移动端显示，桌面端隐藏） -->
<div id="mobilePanelTabs">
  <button id="mobileTabEpisodes" type="button"
          class="mobile-tab is-tab-active" data-tab="episodes">选集</button>
  <button id="mobileTabResources" type="button"
          class="mobile-tab" data-tab="resources">视频源</button>
</div>
```

- 基线与桌面端一致：`#mobilePanelTabs` 默认 `display: none`（CSS 控制），移动端媒体查询覆盖为 flex
- 不加 ARIA `role="tablist"`，避免与未来 a11y 标准化冲突（见"不在本期范围"）

**同时**：给 `#episodesGridContainer` 静态预置 `is-tab-active` 类（与 Tab 按钮的 `is-tab-active` 预置同理，N1 缓解）——即使 JS 初始化失败或延迟，移动端选集面板默认可见，避免"两面板均隐藏导致侧栏空白"。JS 初始化会核对并维持该默认态。

### 4.4 CSS 改动（css/player.css）

**（1）移动端 `@media (max-width: 640px)` 块内：**

- **删除**：`#mobileEpisodeSelectContainer` / `#mobileEpisodeSelectBtn` 相关全部规则（含箭头 `episode-chevron` 旋转）
- **删除**：`#episodesGridContainer.mobile-episodes-open` / `#episodesGridContainer.mobile-episodes-open ~ .resource-module` / `#episodesGridContainer.mobile-episodes-open` 间距 等展开类规则
- **改写** 面板默认显隐：
  - `#episodesGridContainer`：`display: none !important` → 默认 `display: flex !important; flex-direction: column !important;`
  - `.resource-module`：`display: none !important` → 默认 `display: flex !important; flex-direction: column !important; margin-top: 0 !important;`
- **改写** 展开态布局规则（去掉 `.mobile-panel-open` 前缀，无条件生效；选择器保留完整作用域前缀，避免裸类特异性下降——I1 修复）：
  - `.player-sidebar-body #episodesGridContainer .player-sidebar-header,
     .player-sidebar-body #episodesGridContainer .episode-toolbar { flex-shrink: 0 !important; }`
  - `.player-sidebar-body #episodesGridContainer .episode-grid { flex: 1 1 0 !important; min-height: 0 !important; max-height: none !important; overflow-y: auto !important; }`
- **新增** Tab 栏样式与互斥规则：

```css
/* 移动端 Tab 容器 */
#mobilePanelTabs {
  display: flex !important;
  flex-shrink: 0;
  border: 1px solid #333;
  border-radius: 0.5rem;
  background: #151515;
  overflow: hidden;
  margin-bottom: 0.5rem;   /* 与下方面板间距 */
}

.mobile-tab {
  flex: 1 1 0;
  padding: 0.625rem 0.5rem;
  background: transparent;
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.mobile-tab.is-tab-active {
  background: rgba(0, 159, 191, 0.15);
  color: #009fbf;
  font-weight: 600;
}

.mobile-tab + .mobile-tab {
  border-left: 1px solid #333;
}

/* Tab 互斥显隐：同一时刻仅一个面板带 is-tab-active */
.player-sidebar-body #episodesGridContainer:not(.is-tab-active),
.player-sidebar-body .resource-module:not(.is-tab-active) {
  display: none !important;
}
```

**（2）桌面端 `@media (min-width: 641px)`：**

- **删除** `#mobileEpisodeSelectContainer { display: none !important; }`
- **新增** `#mobilePanelTabs { display: none !important; }`

> 注意：`.mobile-tab` / `#mobilePanelTabs` 均放在 `@media (max-width: 640px)` 块内；`@media (min-width: 641px)` 只需隐藏容器。

### 4.5 行为序列

| 场景 | 关键步骤 |
|---|---|
| 页面加载（移动端） | mobile-panel-tabs.js 初始化：`#episodesGridContainer` 加 `is-tab-active`（默认"选集"）、`#mobileTabEpisodes` 加 `is-tab-active`；Tab 栏 CSS 显示 |
| 点 "视频源" Tab | `activate('resources')`：移除选集 `is-tab-active`，给 `.resource-module` 加 `is-tab-active`，同步 Tab 按钮激活态；**不触发** `loadResourceSwitchList()`（资源由 player.js 加载链路异步启动，加载中显示"正在加载资源..."，绝不重复触发——B1 修复） |
| 点 "选集" Tab | 反向同步 |
| 资源加载中/完成/翻页/切源 | 由现有 `renderResourcePage()` / `switchToResource()` 路径驱动，Tab 无需感知 |
| 切集（playEpisode） | 由现有 `renderEpisodes()` 路径驱动，Tab 无需感知 |
| 断点 ≥641 | `cleanup()` **仅移除两面板的 `is-tab-active`**（不动 Tab 按钮类，I2 修复）；Tab 栏 CSS 隐藏；面板按桌面现状展示 |
| 断点回到 ≤640 | 重置默认激活 'episodes'：`activate('episodes')` 同时恢复面板与 Tab 按钮激活态（I2 修复） |

### 4.6 状态持久化（轻量）

- 不引入新的 localStorage key
- 不持久化"上次激活的 Tab"——每次进入默认"选集"（US-5）
- 资源列表已加载的结果由 `js/player.js` 全局 `resourceResults` / `resourcePageCtx` 保留，无需新增

## 5. 测试与验证

### 5.1 自动化（最小）

- `node --check js/mobile-panel-tabs.js` 语法检查
- `node --check js/player.js`（清理后确认无语法错误、无残留引用）

### 5.2 手动（必跑）

| # | 步骤 | 期望 |
|---|---|---|
| M1 | 移动端 ≤640 → 加载页面 | 直接看到 Tab 栏 + 选集面板；无"展开"按钮；资源面板不可见 |
| M2 | M1 后点"视频源" Tab | 切到资源面板；资源列表由页面加载链路已就绪（或显示"正在加载资源..."占位），**不重复触发加载** |
| M3 | M2 后点"选集" Tab | 回到选集，分页状态保留 |
| M4 | M2 翻到资源第 2 页 → 切到选集 → 切回视频源 | 仍在第 2 页 |
| M5 | M1 选第 N 集（切集）→ 切到视频源 → 切回选集 | 当前集高亮与页码一致 |
| M6 | 视频源切源成功 → 切回选集 | 选集仍为切源后状态 |
| M7 | 刷新页面 | 回到默认"选集" Tab |
| M8 | 选集 Tab → 窗口拉到 ≥641 → 拉回 ≤640 | 无残留类（断点清理生效） |
| M9 | 桌面端 ≥1024 任意操作 | 无 Tab 栏、行为与改动前一致 |
| M10 | 平板 641-1023 任意操作 | 行为不变 |
| M11 | 多集数（如 60 集）+ 多资源场景 | 切换流畅、无闪烁 |
| M12 | 资源 Tab 反复切换（含切到选集再切回） | 不重复触发加载、分页不被重置（B1 验证点） |

### 5.3 回归（确保不破已有）

| 区域 | 验证点 |
|---|---|
| 桌面端分栏 | `≥1024` 打开页面，侧栏两模块正常并排，资源面板默认加载（与改动前一致） |
| 集数分页翻页 | 分页、倒序、切集跳页、当前集高亮（REV-001 等已修边界）继续有效 |
| 自动连播 | 跨集自然结束时下一集高亮可见 |
| 切源 | `switchToResource` 内部路径不变（0 修改） |
| 断点切换 | ≤640↔≥641 无残留（继承 REV-004） |

## 6. 文件改动清单

| 文件 | 改动 |
|---|---|
| `player.html` | 删除 `#mobileEpisodeSelectContainer` 整块；在 `.player-sidebar-body` 内、`#episodesGridContainer` 之前新增 `#mobilePanelTabs`（含两个 Tab 按钮） |
| `css/player.css` | 移动端块：删除按钮/展开类规则，改写面板默认显隐为 flex，去掉 `.mobile-panel-open` 前缀的无条件布局规则，新增 Tab 栏样式 + `is-tab-active` 互斥规则；桌面端块：删除按钮隐藏规则、新增 Tab 栏隐藏 |
| `js/mobile-panel-tabs.js` | **新建**，独立模块，挂 `window.MobilePanelTabs` 命名空间 |
| `js/player.js` | **仅删除死代码**：`toggleMobileEpisodes`、`syncMobilePanelHeight`、`startMobilePanelHeightSync`、`stopMobilePanelHeightSync`、`mobilePanelHeightObserver`、`matchMedia('(min-width: 641px)')` 清理块。不新增任何功能代码 |
| `js/mobile-panel-gestures.js` | **不改动** |

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 删除 `toggleMobileEpisodes` 后存在其它引用 | 已全局检索：仅 `player.html` onclick 与 `player.js` 内部引用，删除安全 |
| Tab 互斥规则与既有 `display: none` 冲突 | 互斥选择器用 `.player-sidebar-body` 前缀提升特异性（(1,2,0) 覆盖 (1,0,0)），覆盖既有 `display: none` |
| 激活资源 Tab 重复触发 `loadResourceSwitchList` 导致分页归零 | `activate('resources')` 绝不主动调用加载；模块内无任何加载触发逻辑，杜绝与 player.js 首次请求并发（B1 修复） |
| 断点切换时 `is-tab-active` 残留 | 新增 `matchMedia('(min-width: 641px)')` change 监听 → `cleanup()` 仅清理两面板类（不动 Tab 按钮）；返回 ≤640 用 `activate('episodes')` 统一恢复（I2 修复） |
| 移动端默认展开导致页面首屏高度剧增 | 选集面板 `.episode-grid` 内部滚动（`max-height` 受控），不会撑爆页面 |
| 清理等高同步后资源加载高度跳动 | 单 Tab 显示下两面板不同时出现，无等高需求；资源面板自身高度由 `.resource-switch-list` 占位高度稳定 |
| 无 JS 兜底时两面板均隐藏（N1，可选缓解） | HTML 静态给 `#episodesGridContainer` 预置 `is-tab-active`，使无 JS 或 init 延迟时选集默认可见 |

## 8. 不在本期范围

- Tab 切换的 ARIA role=tablist / tab / tabpanel 标准化（可作为 a11y issue 单独处理）
- 持久化"上次激活的 Tab"到 localStorage
- Tab 切换的滑动动画 / 指示器动画
- 平板断点（641-1023）的另一种 Tab 布局（如需要）
- 移动端"收起面板"能力恢复

## 9. 工作流（Standard lane，本 run 完成）

1. **Design（本产物）** → 用户对 design 修订确认后继续
2. **Implementation** → 本 run 内完成
3. **Code Review** → 独立 subagent review
4. **Accept-inline** → 含 Inline Verification Matrix，按 M1-M12 + 回归清单核验

完成 marker：`CS_FEATURE_STANDARD_COMPLETE`，slugs `mobile-episode-resource-tabs-*.md` 共 4 份产物落盘在 `.codestable/features/2026-08-14-mobile-episode-resource-tabs/`。
