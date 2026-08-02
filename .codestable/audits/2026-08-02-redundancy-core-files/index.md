---
doc_type: audit-index
date: 2026-08-02
slug: redundancy-core-files
scope: js/player.js, js/app.js, js/ui.js, js/utils.js
dimensions: [maintainability]
status: cancelled
---

# 冗余审计 — 核心前端文件（player / app / ui / utils）

## 范围

| 项 | 值 |
|---|---|
| 审计对象 | `js/player.js` (2879 行)、`js/app.js` (1982 行)、`js/ui.js` (1319 行)、`js/utils.js` (484 行) |
| 维度 | 可维护性 / 冗余（**本次仅此一维**，未含 bug / security / performance） |
| 扫描方式 | 3 个并行只读 agent 逐文件扫描 + 跨文件 grep 交叉验证 |
| 严重度 | P0 必须修 / P1 应该修 / P2 可以修 |
| 置信度 | high / medium / low |

## 总评

核心四个文件共 6664 行，**冗余密度偏高**。最严重的有两类：

1. **StorageManager 形同虚设**：`utils.js` 造了带防抖 / 缓存 / 配额重试的 `StorageManager`，但 `app.js` (23 处 setItem)、`player.js` (15 处)、`ui.js` (8 处) **全部裸用 `localStorage`**，46+ 处裸调用绕过已存在的封装。这是全审计价值最高的一处系统性冗余。
2. **密码守卫 6 行模板全仓库复制粘贴**：`if (window.isPasswordProtected && window.isPasswordVerified) {...}` 在 `ui.js`×4、`app.js`×3、`api.js`×1 共 **8 处**逐字重复，约 48 行重复代码，且其中 ui.js 一处因函数声明覆盖已成死代码。

死代码两处 P0：ui.js 的 `toggleSettings` 覆盖被 app.js 函数声明擦除；player.js 的 `startProgressSaveInterval` 定义后从未调用。

其余多为函数级复制粘贴（filter×3、form reset×4、episode button 模板×2、modal scaffold×2、HTML escape 链×3），都是清晰的 `cs-refactor` 候选。

## 发现清单（交叉分类矩阵）

| # | 文件 | 标题 | 性质 | 严重度 | 置信度 | 建议动作 |
|---|---|---|---|---|---|---|
| 01 | ui.js | `toggleSettings` 覆盖被 app.js 函数声明擦除（死代码） | dead-code | P0 | high | cs-refactor |
| 02 | 全局 | 密码守卫 6 行模板复制粘贴 8 处（app/ui/api） | duplicate-implementation | P0 | high | cs-refactor |
| 03 | app/player/ui | StorageManager 形同虚设，46+ 处裸用 localStorage | overlaps-utils | P1 | high | cs-refactor |
| 04 | app.js | banned 关键词数组与过滤逻辑逐字重复 2 处 | duplicate-implementation | P1 | high | cs-refactor |
| 05 | app.js | `filterBySource/Category/Latency` 三个近重复函数 | duplicate-implementation | P1 | high | cs-refactor |
| 06 | player.js | `startProgressSaveInterval` 及配套变量死代码 | dead-code | P1 | high | cs-refactor |
| 07 | player.js | `show_identifier` 计算逻辑重复 3 处 | duplicate-implementation | P1 | high | cs-refactor |
| 08 | ui.js | `clearLocalStorage` 与 `showImportBox` 模态脚手架重复 | duplicate-implementation | P1 | high | cs-refactor |
| 09 | app.js | 自定义 API 表单 reset 逻辑重复 4 处 | duplicate-dom-pattern | P1 | high | cs-refactor |
| 10 | app.js | 自定义 API 表单校验逻辑重复 2 处 | duplicate-implementation | P1 | high | cs-refactor |
| 11 | player.js | episode 按钮 HTML 模板重复（inline + modal） | duplicate-dom-pattern | P1 | high | cs-refactor |
| 12 | player.js | custom API `apiParams` 构建块重复 2 处 | duplicate-implementation | P1 | high | cs-refactor |
| 13 | ui.js | localStorage 读 + JSON.parse + fallback 模板重复 | duplicate-implementation | P1 | high | cs-refactor |
| 14 | player.js | `custom_N` 解析模式重复 4 处且解析方式不一致 | duplicate-implementation | P2 | high | cs-refactor |
| 15 | player.js | 进度条 click / touch 处理器 90% 相同 | duplicate-dom-pattern | P2 | high | cs-refactor |
| 16 | player.js | `isMobile` 正则字面量重复 2 处 | duplicate-implementation | P2 | high | cs-refactor |
| 17 | player.js | `updateOrderButton` / `updateOrderButtonInModal` 近重复 | duplicate-dom-pattern | P2 | medium | cs-refactor |
| 18 | app.js | 设置/历史面板点击外部关闭逻辑重复 2 处 | duplicate-dom-pattern | P2 | high | cs-refactor |
| 19 | app.js | `initDouban` 幂等标志与 observer/disconnect 冗余状态 | redundant-state | P2 | medium | cs-refactor |
| 20 | ui.js | `deleteHistoryItem` 与 `deleteHistoryItemWithUndo` 重复查找 | duplicate-implementation | P2 | high | cs-refactor |
| 21 | ui.js | HTML escape replace 链重复 3 处（含 1 处残缺） | duplicate-dom-pattern | P2 | high | cs-refactor |
| 22 | ui.js | 历史面板点击外部关闭监听器与 app.js 重复 | dead-code | P2 | medium | cs-refactor |

**统计**：共 22 条 · P0×2 · P1×11 · P2×9 · 估计可净减 **200–350 行重复 / 死代码**。

## 优先级建议

- **立刻（P0，2 条）**：#01（ui.js toggleSettings 死覆盖）和 #02（密码守卫集中化）建议立即开 `cs-refactor`。#01 是已经失效的逻辑，修复需先确认“设置面板切换时关闭历史面板”这个 UX 意图是否仍需要——若需要则改回在 app.js 内实现，若不需要直接删。
- **下个迭代（P1，11 条）**：#03 StorageManager 接入收益最大但改动面最广（46+ 调用点），建议单独一个 refactor 批次；#04/05/09/10 是 app.js 内部聚合，一次 refactor 可清掉；#06/07/12 是 player.js 内部聚合。
- **有空再做（P2，9 条）**：多为模板 / 工具函数级抽提，风险低收益也低，可作为重构热身。

## 下一步

若要落地修复，请选定某条 finding，`cs-audit` 将在同 run 加载 `cs-refactor` 并传递 finding 路径与证据。建议起手顺序：#01 → #02 → #03 → 其余。
