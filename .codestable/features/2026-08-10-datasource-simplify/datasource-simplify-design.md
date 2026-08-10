---
doc_type: feature-design
feature: 2026-08-10-datasource-simplify
execution_lane: standard
status: approved
summary: 简化数据源选中机制：默认全部勾选（移除失效源黑名单），彻底移除测活功能（site_health.js 整个删除），搜索直接对全部勾选源并发请求
tags: [datasource, settings, site-health, search, app.js]
---

# 数据源简化 Design

## 0. 术语约定

| 术语 | 定义 | 防冲突结论 |
|---|---|---|
| 数据源（API 源） | 内置采集站（`CUSTOMER_SITES` 合并进 `API_SITES`，共 63 个）+ 用户自定义源（`custom_*`） | 全项目已统一用 `API_SITES` / `custom_`，无新词 |
| 勾选状态 | `localStorage['selectedAPIs']` 数组，决定搜索时请求哪些源 | 沿用现有 key，不改名 |
| 测活 | ~~对单个源发起搜索请求判定可用性~~ **本 feature 删除，不再存在** | 删除后全项目无此概念 |

grep 结论：
- `DEFAULT_UNSELECTED_APIS` 仅在 `js/config.js` 定义、`js/app.js` 引用，无第三方依赖。
- `site_health.js` 的全局暴露 `window.SiteHealth`（runHealthCheck/recheck/probeSite）全项目**无外部调用方**（index.html 无"重新测活"UI 入口，app.js 仅直接读 localStorage 缓存，不调用函数）。删除整个模块安全。
- `applyOne`/`applyAll` 仅被 `runHealthCheck` 内部调用（:129、:148、:151），无其他文件引用。

## 1. 决策与约束

### 需求摘要

- **做什么**：把"数据源选中标准"从三套机制（黑名单默认 + 首页自动测活改勾选 + 搜索时缓存过滤）简化为最简形态：**全部默认勾选，用户手动调整；测活功能整体删除；搜索直接对全部勾选源并发请求，能返回结果的源自然参与**。
- **为谁**：所有用户，特别是对"好多源勾不上"感到困惑的使用者。
- **成功标准**：
  1. 首次加载（新用户或旧用户）设置面板中 63 个内置源**全部默认勾选**，自定义源保持用户已有勾选。
  2. **全项目不再存在任何测活行为**：首页无自动测活、搜索前无测活、无 `siteHealthCache` 读写、无 `site_health.js` 文件。
  3. 搜索直接对全部勾选源并发发请求，不再有任何过滤层；自定义源照常参与。
  4. 勾选状态完全由用户掌控，任何后台逻辑都不改它。
- **明确不做**：
  1. 不做任何形式的测活（不含搜索请求本身——搜索请求即真实搜索，不做"测试词探测"）。
  2. 不动自定义源逻辑（`custom_*` 始终参与搜索）。
  3. 不动黄色过滤、广告过滤、`updateSiteStatus`（ui.js 的 `siteStatus` 绿点，与测活无关）。
  4. 不引入新的搜索前过滤/排序逻辑（结果集变化由"全部源参与"自然带来，接受）。

### 复杂度档位

走 Web 前端默认档位，无偏离（单页静态 JS、无构建、删除模块为主、无新增状态机/并发复杂度）。

### 关键决策

| # | 决策 | 理由 | 被拒方案 |
|---|---|---|---|
| D1 | 删除 `DEFAULT_UNSELECTED_APIS` 黑名单及两处过滤逻辑 | 用户要求"直接全部勾选"，黑名单是"默认不全选"的来源 | 保留黑名单仅作灰显标注（实现复杂，无需求支撑） |
| D2 | **整个删除 `js/site_health.js`**（文件 + index.html script 引用 + app.js 中 `siteHealthCache` 读取段） | 用户明确要求"把测活功能去掉，不再有测活的步骤"；模块无外部调用方，删除安全 | 保留模块仅禁用调用（留下死代码，违背"去掉"） |
| D3 | `search()` 删除 `effectiveAPIs` 过滤段（:826-835），直接用 `selectedAPIs` 并发搜索 | 无测活则无缓存可过滤，过滤层是死代码 | 保留过滤但空跑（无意义） |
| D4 | 旧用户通过新增版本标记 `selectedAPIsV2` 迁移：检测到旧 `hasInitializedDefaults` 且无新版本标记时，内置源重置为全选且**保留现有 `custom_*` 项** | 用户明确选择"自动重置为全选"；`hasInitializedDefaults` 已被旧用户持有，需版本化 | 保留旧选择（用户已否决） |

### 前置依赖

无（无跨模块接口变更；4 平台代理逻辑不动）。

## 2. 名词与编排

### 2.1 名词层

#### 现状

| 名词 | 现状 |
|---|---|
| `selectedAPIs` 默认值 | `js/app.js:2`：`Object.keys(API_SITES).filter(key => !DEFAULT_UNSELECTED_APIS.includes(key))`；`js/app.js:52` 首次初始化同样过滤黑名单 |
| `DEFAULT_UNSELECTED_APIS` | `js/config.js:110-129`，52 个 key 的默认不勾选黑名单 |
| 测活模块 | `js/site_health.js` 全文件：`probeSite`（:37-62）、`applyOne`/`applyAll`（:67-92）、`runHealthCheck`（:121-162）、DOMContentLoaded 自动测活（:176-187）、`window.SiteHealth` 暴露（:170-174） |
| 测活引用 | `index.html:556` `<script src="js/site_health.js">`；`js/app.js:829` `localStorage.getItem('siteHealthCache')` |
| 搜索过滤 | `js/app.js:826-835`：搜索时若有新鲜缓存，`effectiveAPIs = selectedAPIs.filter(内置源在 ok 列表或自定义源)` |

#### 变化

| 名词 | 变化 | 动机 |
|---|---|---|
| `DEFAULT_UNSELECTED_APIS` | **删除**（`js/config.js:110-129` 整块） | D1 |
| `selectedAPIs` 默认值 | `js/app.js:2` 与 `:52` 改为 `Object.keys(API_SITES)`（全部内置源） | D1 |
| 新增版本标记 `selectedAPIsV2` | 首次初始化或检测到旧数据时写入 `'true'` | D4，用于区分"旧用户已初始化但未迁移" |
| 迁移逻辑 | **保留现有 `custom_*` 项**，仅把内置源部分重置为全选：`selectedAPIs = [...现有 custom_* 项, ...Object.keys(API_SITES)]`；迁移代码放在 `DOMContentLoaded` 初始化块内、`hasInitializedDefaults` 分支附近，与首次初始化合并为"内置源全选 + 自定义源保留"的同一逻辑 | D4 + review 发现：避免误删用户已勾选的自定义源 |
| `js/site_health.js` 文件 | **整个删除** | D2 |
| `index.html` 引用 | 删除 `:556` 的 `<script src="js/site_health.js" defer>` | D2 |
| `app.js` `siteHealthCache` 读取段 | **删除**（`:826-835` 整段，含 `effectiveAPIs` 计算与 `cacheKey` 基于 `effectiveAPIs` 的用法）；`effectiveAPIs` 的全部引用点一并改用 `selectedAPIs`：`cacheKey`（`:839`）与搜索主循环 `Promise.allSettled(effectiveAPIs.map(...))`（`:906`） | D2 + D3 |

### 2.2 编排层

#### 现状主流程

```
首页加载 ──► DOMContentLoaded 自动 runHealthCheck（并发 8 测活）
              ├─ applyOne(alive=true)  → selectedAPIs.push(key) + 勾选
              ├─ applyOne(alive=false) → selectedAPIs.splice(key) + 取消
              └─ 缓存命中 → applyAll 整体覆盖 selectedAPIs

搜索 ──► 若缓存新鲜 → effectiveAPIs = 过滤(selectedAPIs, ok)
        ──► 否则 → 全部 selectedAPIs 并发搜索
```

#### 变化后主流程

```
首页加载 ──► 初始化勾选状态（默认全选，无任何后台探测）

搜索 ──► 直接对 selectedAPIs（全部勾选源）并发请求 ──► 增量渲染
```

拓扑：搜索路径回归最简"并行 DAG"，无前置串行门、无分支过滤。简单线性，无需 mermaid。

#### 流程级约束

- **错误语义**：单个源请求失败/超时（`searchByAPIAndKeyWord` 已 4s abort、失败返回 `{results:[]}`）不影响其他源与整体搜索；与现状一致。
- **幂等性**：无新增可变状态；`selectedAPIs` 仅由用户操作修改。
- **并发/顺序**：全部勾选源并发搜索，浏览器同源代理连接池自然限流；与现状全量并发一致。
- **扩展点**：无（删除了测活扩展面）。
- **可观测点**：Network 面板可直接观察搜索请求覆盖哪些源；无额外埋点。

### 2.3 挂载点清单

判据：删掉这一项，feature 在用户/系统视角是否消失？

| 挂载位置 | 动作 |
|---|---|
| `js/config.js` `DEFAULT_UNSELECTED_APIS` 常量 | 删除 |
| `js/app.js` `selectedAPIs` 初始化表达式（:2）与首次初始化块（:52） | 修改：全选 + 版本标记 |
| `js/site_health.js` 文件 | 删除 |
| `index.html` `js/site_health.js` script 引用（:556） | 删除 |
| `js/app.js` `search()` 缓存过滤段（:826-835）与 `effectiveAPIs` 引用点（:839 cacheKey、:906 搜索主循环） | 删除 + 改用 `selectedAPIs` |

### 2.4 推进策略

```
1. 静态配置：删 DEFAULT_UNSELECTED_APIS + 改 app.js 默认全选 + 版本标记迁移
   退出信号：grep DEFAULT_UNSELECTED_APIS 全项目 0 引用；代码检查默认值/迁移逻辑
2. 删除测活模块：删 js/site_health.js 文件 + index.html 引用 + app.js siteHealthCache 读取段
   退出信号：grep siteHealth|runHealthCheck|SiteHealth 全项目 0 引用；文件已删
3. 编排简化：search() 移除 effectiveAPIs 过滤，直接用 selectedAPIs；cacheKey 同步改
   退出信号：代码路径存在；grep effectiveAPIs 全项目 0 引用
4. 手工验证：npm run dev 走通"首次全选 / 搜索直接并发 / 勾选不被自动改"三条场景
   退出信号：HUMAN 目视 + Network 面板确认
```

### 2.5 结构健康度与微重构

##### 评估

- 文件级 — `js/app.js`（2134 行，偏胖）：本次在 :2、:52、:826-835 三处独立改动，彼此逻辑独立；行数超 500 属既有情况，本次只做 3 处小改（其中 :826-835 为删除，净减行数），不新增肥胖点。
- 文件级 — `js/site_health.js`（188 行）：**整个删除**，职责消除。
- 文件级 — `js/config.js`（130 行）：删除 20 行黑名单，纯减负。
- 目录级 — `js/`（21 个文件，命名无前缀分组，既有摊平格局）：本次**净减少 1 个文件**，不加剧摊平。

##### 结论：不做

无"只搬不改行为"的微重构必要；app.js 偏胖属既有债，本次以删除为主不触发拆文件。

##### 超出范围的观察

- `js/app.js`（2134 行）整体偏胖、职责混（搜索/详情/设置/筛选/导入导出同一文件）→ 建议后续走 `cs-refactor` 按模块拆分，本 feature 不动。

## 3. 验收契约

### 关键场景清单

| # | 输入 / 触发 | 期望可观察结果 | 证据类型 |
|---|---|---|---|
| S1 | 清除 localStorage 后打开首页（新用户） | 设置面板 63 个内置源全部勾选；`selectedAPIs` 长度 = 63 | 浏览器目视 + DevTools 检查 |
| S2 | 已有旧 `hasInitializedDefaults`、旧 `selectedAPIs`（含已勾选 `custom_*`）的用户打开首页 | 内置源重置为全选；**原有 `custom_*` 勾选保留**；写入 `selectedAPIsV2`；再次刷新不重复重置 | DevTools 检查 + 目视 |
| S3 | 首页加载后观察 Network | **无任何** `ac=videolist&wd=` 请求自动发出 | Network 面板 |
| S4 | 手动取消某源勾选后刷新页面 | 取消的源保持未勾选（后台无逻辑改回） | 目视 + DevTools |
| S5 | 执行搜索 | 对**全部勾选源**直接并发发请求，无前置测活/过滤请求；部分源失败/超时不影响其他源结果 | Network 面板 + 目视 |
| S6 | 自定义源 + 内置源同时勾选搜索 | 自定义源与内置源请求同时发出，结果混合展示 | Network 面板 |
| S7 | 搜索后查看勾选状态 | `selectedAPIs` 与搜索前完全一致 | DevTools |
| S8 | 全项目代码检查 | `site_health.js` 文件不存在；无 `siteHealthCache`/`runHealthCheck`/`SiteHealth`/`effectiveAPIs`/`DEFAULT_UNSELECTED_APIS` 标识符 | grep |

### 明确不做的反向核对项

- 全项目 grep `DEFAULT_UNSELECTED_APIS`、`siteHealthCache`、`runHealthCheck`、`SiteHealth`、`applyOne`、`applyAll`、`effectiveAPIs` → 0 引用。
- `js/site_health.js` 文件不存在。
- `index.html` 无 `site_health.js` script 标签。

### Acceptance Coverage Matrix

| Scenario | Covered By Step | Evidence Type | Command / Action | Core? |
|---|---|---|---|---|
| S1 新用户全选 | Step 1, 4 | browser + DevTools | `npm run dev` → 清 localStorage → 打开设置 | yes |
| S2 旧用户迁移保留 custom_* | Step 1, 4 | browser + DevTools | 预置旧 localStorage（含 custom_*）再刷新 | yes |
| S3 首页无任何请求 | Step 2, 4 | Network | 打开首页看 Network | yes |
| S4 勾选不被自动改 | Step 2, 4 | browser + DevTools | 取消勾选 → 刷新 | yes |
| S5 搜索直接全量并发 | Step 3, 4 | Network | 搜索 → 观察请求源覆盖 | yes |
| S6 自定义源参与 | Step 3, 4 | Network | 添加自定义源 → 搜索 | no |
| S7 勾选搜索后不变 | Step 3, 4 | DevTools | 搜索后查 selectedAPIs | yes |
| S8 代码无测活残留 | Step 1-3 | grep + diff review | `grep -r "siteHealth\|effectiveAPIs\|DEFAULT_UNSELECTED" js/ index.html` | yes |

### DoD Contract

| ID | 要求 | 证据 | 阻塞级别 |
|---|---|---|---|
| DOD-DESIGN-001 | design 完整且契约可执行 | design review | blocking |
| DOD-IMPL-001 | checklist steps 全部完成 | checklist / evidence | blocking |
| DOD-REVIEW-001 | code review passed | review report | blocking |
| DOD-ACCEPT-001 | acceptance 回写与审计 | acceptance report | blocking |

Validation Commands:

| ID | 命令 | 目的 | 核心性 | 失败处理 |
|---|---|---|---|---|
| CMD-001 | `npm run dev` | 本地起服务手工验证 | core | fix-or-block |
| CMD-002 | `grep -r "siteHealth\|runHealthCheck\|SiteHealth\|effectiveAPIs\|DEFAULT_UNSELECTED_APIS\|applyOne\|applyAll" js/ index.html` | 测活残留检查 | core | fix-or-block |

Required Artifacts: review / acceptance / evidence（Network 观察记录 + grep 输出）。

## 4. 与项目级架构文档的关系

本 feature 改动局限在 `js/app.js`、`js/config.js`、`index.html` 前端内部并删除 `js/site_health.js`，不改变对外契约、代理协议、`selectedAPIs` key 语义，无系统级可见变化。架构文档 `.codestable/architecture/` 无需更新。
