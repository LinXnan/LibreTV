---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "maintainability-07"
nature: maintainability
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 07：app.js 2004 行 56 函数混合 5 种不同关注点

## 速答

`js/app.js` 没有模块边界，把 API 源 Management（复选框、CRUD）、搜索 Orchestration（并发、排序、统计）、详情 Modal 渲染、播放跳转与 localStorage 缓存、筛选分页系统、配置导入/导出——五类互不相关的 Feature 全部塞入一个文件。56 个顶层函数在全局作用域下通过 `window.*` 相互引用，任何新功能（如新筛选维度）都被迫在同一文件中继续叠加。

## 关键证据

- 2004 行（`wc -l js/app.js`）
- 56 个 `function` / `async function` 定义
- 关注点隔离缺失：
  - API 源管理：`initAPICheckboxes`、`renderCustomAPIsList`、`addCustomApi`、`removeCustomApi`、`selectAllAPIs` 等 10+ 函数
  - 搜索：`search`、`searchWithConcurrencyLimit`、`resetSearchArea`
  - 详情：`showDetails`、`renderEpisodes`、`toggleEpisodeOrder`
  - 播放：`playVideo`、`showVideoPlayer`、`closeVideoPlayer`
  - 筛选/分页：`applySearchFilters`、`filterBySource`、`renderSearchResults`、`renderPagination`、`goToPage` 等 10+ 函数
  - 导入/导出：`importConfig`、`exportConfig`、`importConfigFromUrl`

## 影响

- **范围**：首页所有交互
- **影响**：改 API 源选择逻辑会牵连搜索/详情模块、新增筛选维度会与分页耦合——类比 player.js 的同样困境
- **严重度 P1**：稳定性不受威胁，但迭代阻塞性明显（多数 PR 落在这个文件） —— 每个 sprint 的集成成本在累积

## 修复方向

- 拆为 `app-api-sources.js`（源管理）、`app-search.js`（搜索编排）、`app-detail.js`（详情/播放）、`app-filters.js`（筛选分页）、`app-config.js`（导入导出）
- 状态共享通过 EventEmitter 或信号库替代 window 全局键
- 建议动作：`cs-refactor`
