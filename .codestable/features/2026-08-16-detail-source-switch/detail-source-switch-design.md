---
doc_type: feature-design
feature: 2026-08-16-detail-source-switch
execution_lane: standard
status: approved
summary: 搜索结果去重合并后，在首页详情弹窗内增加数据源选择（Tab 胶囊），切换数据源后重新拉取该源剧集并支持从选中源播放
tags: [detail, source, dedupe, ui, data-contract]
---

# 设计：详情页数据源选择（多源影片切换查看 / 播放）

## 0. 术语约定

| 术语 | 定义 | 防冲突结论 |
|---|---|---|
| 数据源（source） | 内容提供方（API_SITES 中的源，如"黑木耳""最大资源"），搜索 / 详情 / 播放请求的 `source_code` 指向它 | 与播放器页 `#mobilePanelTabs` 的"视频源"Tab（播放解析源切换，`player.js` `loadResourceSwitchList` / `switchToResource`）是**不同概念**：本 feature 切换的是**详情数据来源**，不触碰播放器资源切换链路。UI 文案用"来源"避免混淆 |
| 合并项（merged item） | 去重合并后保留的影片对象，含 `merged_sources`（来源名数组）、`source_count` | 现有字段名不变 |
| `merged_source_items` | **新增字段**：`[{name, code, vod_id}]`，每个可用数据源及其在该源中的影片 id | 新名词，grep 全仓库无冲突 |
| `vod_id` | 影片在**某个源**中的 id，源相关（compound `2026-08-08-history-dedup-key` 已证实：不同源对同一影片返回独立 id 体系） | 切源时详情请求必须用目标源自己的 `vod_id` |

## 1. 决策与约束

### 1.1 需求摘要

- **做什么**：搜索去重合并后的多源影片，在详情弹窗内显示数据源选择器；点击某个源 → 用该源的 `vod_id` + `source_code` 重新拉取详情 → 剧集列表切换为该源内容 → 播放跳转携带选中源参数。
- **为谁**：搜索多源影片后打开详情的用户（当前只能看 / 播点击进入的那个源）。
- **成功标准**：多源影片详情页可见来源 Tab（默认高亮当前源）；点其他源后剧集变为该源内容；点剧集播放走选中源；单源 / 旧缓存数据详情页行为与现状完全一致。
- **明确不做**：
  - 不改播放器页（`player.html`）的"视频源"资源切换链路（`loadResourceSwitchList` / `switchToResource` / `resource-module`）
  - 不改 `merged_sources` 字符串数组结构（筛选 / 统计 / 卡片徽标的 6 处消费零改动）
  - 不持久化"上次选中的源"（每次打开详情默认当前源，同播放器 Tab 语义）
  - 不改后端 / 代理（Vercel / Netlify / CF / Express 四个平台零改动）
  - 不做详情页内多源剧集并行展示（只做互斥切换）
  - 不新增"一键从其他源播放"的独立按钮（选择器即入口）

### 1.2 复杂度档位

走前端默认档位，无偏离信号：纯静态前端 UI + 前端数据结构扩展，无并发 / 权限 / 迁移。

### 1.3 关键决策

| # | 决策 | 理由 / 被拒方案 |
|---|---|---|
| D1 | 新增 `merged_source_items: [{name, code, vod_id}]`，**保留** `merged_sources` 字符串数组 | 6 处既有消费（筛选 L1665-1691 / L1777-1781、卡片徽标 L1837-1844）全按 name 字符串消费；改造 `merged_sources` 为对象数组会破坏它们 + localStorage 旧缓存。被拒 |
| D2 | 切源时详情请求 `id` 用**目标源自己的 `vod_id`** | compound `2026-08-08-history-dedup-key` 证实 `vod_id` 源相关；播放器 `switchToResource` 也是替换为目标源 `vod_id`（`player.js:2248`）。只记 code 不记 id 会导致切源后详情 404 / 错剧。被拒：仅记录 `{name, code}` |
| D3 | 详情页源选择器 UI：`detail-episodes` 区域顶部一行 **Tab 胶囊**（互斥高亮），当前源默认激活 | 与播放器页 Tab 交互心智一致；实现成本低于下拉。被拒：下拉选择器（可发现性差）、多源剧集并列（复杂度高） |
| D4 | `showDetails` 从 `window.searchResults`（去重后的完整结果集，L819 / search 收尾赋值）匹配当前合并项获取 `merged_source_items`；匹配不到（旧缓存 / 非搜索入口）则单源回退 | 避免把 `merged_source_items` 序列化进卡片 onclick（转义复杂、recent-watch / 历史入口不经过卡片）。筛选只过滤不修改对象，`merged_source_items` 不丢失。被拒：改 `showDetails` 签名传 JSON |
| D5 | 切源请求用**序号令牌防竞态**（递增计数器，仅最新序号响应渲染） | 快速连续点击多个源时，旧响应不得覆盖新响应（对齐 compound `2026-08-14-resource-load-race` 的竞态教训；详情场景是"后发覆盖前发"，用序号令牌解决） |
| D6 | 切源后**保留** `episodesReversed` 倒序状态，重置 `currentEpisodeIndex` | 倒序是用户偏好（现状 `toggleEpisodeOrder` 全局状态），切源不该重置；剧集归属该源，索引归零 |

### 1.4 前置依赖

无。`window.searchResults` 在所有详情入口前已由 `search()` 收尾或 `renderCachedResults()` 赋值（L819）。

## 2. 名词与编排

### 2.1 名词层

#### 现状

- `merged_sources: string[]` — 来源名数组，`dedupeSearchResults` 合并时累积（`js/app.js:788-797`），**只存 name，不存 code / vod_id**
- `source_count: number` — 来源数量（`js/app.js:790/797`）
- `showDetails(id, vod_name, sourceCode, vod_pic, vod_year)`（`js/app.js:1091-1273`）— 单源详情：`/api/detail?id=<该源vod_id>&source=<该源code>` → 渲染 hero + 剧集网格
- `renderEpisodes(vodName, sourceCode, vodId)`（`js/app.js:1365-1377`）— 剧集按钮，onclick 已携带 `sourceCode` / `vodId`（无需改动）
- `playVideo(url, vod_name, sourceCode, episodeIndex, vodId, vodYear)`（`js/app.js:1277-1313`）— 跳 `player.html`，参数已含 source / id（无需改动）
- `toggleEpisodeOrder(sourceCode, vodId)`（`js/app.js:1391-1408`）— 倒序重渲染，已接收 sourceCode / vodId（无需改动）
- `copyLinks()`（`js/app.js:1380-1388`）— 复制 `currentEpisodes`（切源后自动为新源内容，无需改动）

#### 变化

1. **新增字段 `merged_source_items`**（`dedupeSearchResults` 构建）：

```js
// 接口示例
// 搜索"繁花"命中 黑木耳(heimuer, id=123) + 最大资源(zuidazy, id=456) + 自定义源(custom_0, id=789)
{
    vod_name: "繁花", vod_year: "2024",
    source_name: "黑木耳", source_code: "heimuer", vod_id: "123",
    merged_sources: ["黑木耳", "最大资源", "我的自定义源"],
    source_count: 3,
    merged_source_items: [
        { name: "黑木耳",       code: "heimuer",   vod_id: "123" },
        { name: "最大资源",     code: "zuidazy",   vod_id: "456" },
        { name: "我的自定义源", code: "custom_0",  vod_id: "789" }
    ]
}
// 来源：js/app.js dedupeSearchResults（构建逻辑）、search.js searchByAPIAndKeyWord L51-56（source_name/source_code 注入）
```

   - **幂等**：已有 `merged_source_items` 时保留（缓存路径 `renderCachedResults` L817 二次调用不覆盖，同现状 `merged_sources` 的幂等处理 L793-796）
   - **保留项自身入列**：else 分支（首个保留项）也构建 `[{name, code, vod_id}]`，保证切换回第一个源有完整信息
   - **custom 源兼容**：`code` 直接存 `custom_0` 形式，详情请求时按现状 `showDetails` 的 `custom_` 分支（L1105-1118）走 `getCustomApiInfo`，无需额外字段

2. **`showDetails` 改造**（L1091-1273）：

```js
// 接口示例（内部查找，签名不变）
// 输入：showDetails('123', '繁花', 'heimuer', pic, '2024')
// 查找：window.searchResults.find(r => String(r.vod_id) === '123' && r.source_code === 'heimuer')
// 输出：sourceItems = [{name:'黑木耳',code:'heimuer',vod_id:'123'},{name:'最大资源',code:'zuidazy',vod_id:'456'},...]
// 若 sourceItems.length > 1 → 渲染来源 Tab；否则回退现状（不渲染选择器）
// 来源：js/app.js showDetails + window.searchResults（L819）
```

3. **抽取内部渲染函数 `renderDetailIntoModal(detailData, sourceItems, activeIndex, vodName, vodYear)`**（从 `showDetails` 抽出"数据 → DOM"渲染段 L1216-1256）：

```js
// 接口示例
// 输入：renderDetailIntoModal(detailData, sourceItems, 1, '繁花', '2024')
// 行为：整体重渲染 modalContent —— hero（副标题 = 当前源名）+ 来源 Tab（高亮 activeIndex）+ 工具栏
//       （倒序按钮 onclick 带当前源 code / vodId）+ 剧集网格（playVideo 带当前源 code / vodId）
// 取参来源（显式契约）：
//   - 当前源 code  = sourceItems[activeIndex].code
//   - 当前源 vodId = sourceItems[activeIndex].vod_id
//   - vodName / vodYear = 入参（hero 标题与播放 URL title/year）
//   - detailData = /api/detail 响应（含 videoInfo.source_name/desc/tags 与 episodes）
// 状态来源：currentEpisodes / currentVideoTitle / currentVideoYear / window.currentVodPic / episodesReversed
// 输出：无返回值；副作用为 modalContent DOM 更新
// 来源：js/app.js 从 showDetails 内联渲染段（L1216-1256）抽出的新函数
```

> **activeIndex 语义**：当前激活源在 `sourceItems` 中的下标。初次 `showDetails` 时为"合并项中 `code === 传入 sourceCode` 的项下标"（匹配项即当前源，故其 code/vod_id 与 showDetails 入参一致）；`switchDetailSource` 时 = targetIndex。

> **切源后整体重渲染 modalContent**（而非只重渲染剧集网格）：工具栏倒序按钮与剧集按钮的 onclick 均内嵌 `sourceCode` / `vodId`（`toggleEpisodeOrder` L1239 / `playVideo` L1371），只有整体重渲染才能保证两者始终携带**当前源**参数——避免切源后点"倒序排列"时用旧源参数重渲染剧集导致播放 URL 错乱（review FDR-001）。

4. **新增 `switchDetailSource(sourceItems, targetIndex)`**：

```js
// 接口示例
// 输入：switchDetailSource(sourceItems, 1)  // 当前 items + 目标下标
// 流程：targetIndex 等于当前激活 index → return（无操作）
//     → 令牌自增 → /api/detail?id=<items[1].vod_id>&source=<items[1].code>
//       （custom_ 分支同现状 showDetails L1105-1118：getCustomApiInfo 构建 customApi/customDetail 参数）
//     → 更新 currentEpisodes / currentEpisodeIndex / currentVideoTitle / currentVideoYear / window.currentVodPic
//     → 调用 renderDetailIntoModal(...) 整体重渲染（episodesReversed 保留）
// 输出：无返回值；副作用为 DOM 更新。错误 → showToast('获取详情失败')，高亮与展示回滚到上一选中源
// 来源：js/app.js 新增，紧邻 showDetails
```

5. **详情源 Tab 渲染**：`renderDetailIntoModal` 内部输出 Tab 胶囊 HTML（逐源显示源名），`onclick="switchDetailSource(...)"`，当前源加高亮类。单源（`sourceItems.length <= 1`）时不渲染 Tab。

### 2.2 编排层

#### 现状（主流程）

```
搜索卡片点击
  → showDetails(id, name, sourceCode, pic, year)     // app.js:1091
    → /api/detail?id=<该源vod_id>&source=<该源code>   // L1127
    → 渲染 hero（副标题=该源名）+ 剧集网格             // L1216-1256
    → 剧集按钮 playVideo(url, name, sourceCode, idx, id, year) → player.html  // L1371 / L1285
```

拓扑：**线性 pipeline**（单源直通），无分支。

#### 变化

```
搜索卡片点击
  → showDetails(...)
    → 从 window.searchResults 查找合并项 → sourceItems        // 新增
    → 拉当前源详情（现状逻辑不变）
    → renderDetailIntoModal(...) 整体渲染 hero + 【来源 Tab】+ 工具栏 + 剧集网格  // 新增：多源时含 Tab
    → 点其他源 Tab → switchDetailSource(sourceItems, i)       // 新增：令牌防竞态
        → /api/detail?id=<items[i].vod_id>&source=<items[i].code>
        → 更新全局详情状态 → renderDetailIntoModal(...) 整体重渲染（工具栏/剧集按钮均带新源参数）
    → 剧集按钮 playVideo(...) 自动携带选中源的 code / vod_id  // 现状链路复用
```

拓扑：线性 pipeline 增加一个**分支（多源切换）**，原单源直通路径不变。

#### 流程级约束

- **错误语义**：切源请求失败 → `showToast('获取详情失败，请稍后重试')`，Tab 高亮回滚到上一选中源，不破坏当前剧集展示
- **幂等性**：`dedupeSearchResults` 对 `merged_source_items` 幂等（已有保留）；重复点击同一源 Tab → 视为无操作（targetIndex 等于当前激活 index 时直接 return）
- **并发 / 顺序**：切源请求用序号令牌，仅最新序号响应允许渲染（D5）
- **扩展点**：源 Tab 渲染 / 切源函数独立成函数，未来若加"记住上次源"或"源失效提示"可在此扩展
- **可观测点**：切源请求走现有 `/api/detail`（代理日志可见）；不新增 console 输出（清洁度规则）

### 2.3 挂载点清单

| # | 挂载位置 | 动作 |
|---|---|---|
| M1 | `js/app.js` `dedupeSearchResults`（L780-803）| 修改：构建 `merged_source_items` 字段 |
| M2 | `js/app.js` `showDetails`（L1091-1273）| 修改：查找合并项 + 渲染来源 Tab |
| M3 | `js/app.js` 新增 `renderDetailIntoModal` / `switchDetailSource` | 新增：详情整体渲染（含来源 Tab）与切源编排 |
| M4 | `css/styles.css` `#modal .detail-*` 区（L1098+）| 新增：来源 Tab 样式（互斥高亮） |

> 删除 M1-M4，详情页源选择在用户视角完全消失（无 Tab、无切换、无数据字段），无残留。

### 2.4 推进策略

```
1. 数据契约：dedupeSearchResults 构建 merged_source_items（含幂等 + 保留项入列 + custom 兼容）
   退出信号：node --check 通过；console 打印多源搜索对象可见 merged_source_items 结构正确
2. 详情渲染：showDetails 查找合并项 + 抽取 renderDetailIntoModal（含来源 Tab 渲染）
   退出信号：多源影片详情页可见来源 Tab 且默认高亮当前源；单源无 Tab
3. 交互逻辑：switchDetailSource 切源（令牌防竞态 + 更新全局状态 + renderDetailIntoModal 整体重渲染 + 错误回滚）
   退出信号：点其他源后剧集 / 工具栏 / 剧集按钮全部携带新源参数、高亮切换、倒序状态保留
4. 联调 / 样式收尾：Tab 样式（互斥高亮）+ 播放链路验证 + 旧缓存 / 自定义源场景
   退出信号：S1-S10 全部肉眼通过（见第 3 节）
```

### 2.5 结构健康度与微重构

##### 评估

- 文件级 — `js/app.js`：约 1900 行，已偏胖（职责含搜索编排 / 详情 / 筛选 / 设置 / 导入导出）。本 feature 在它内部改 2 处（`dedupeSearchResults`、`showDetails`）+ 新增 2 个紧邻函数，改动密度中等。详情相关状态（`currentEpisodes` / `currentVideoTitle` / `episodesReversed` / `window.currentVodPic`）与 `renderEpisodes` / `playVideo` / `toggleEpisodeOrder` / `copyLinks` 全部内聚在此，切源函数与它们交互密切。
- 目录级 — 无新增文件，不评估。

##### 结论：不做

理由：切源是详情闭环（showDetails → 剧集 → 播放）的内聚扩展；拆分独立模块需要把这 6+ 个全局状态 / 函数之间的交互重构为参数传递，超出"只搬不改行为"范围，且 AGENTS.md"新功能拆独立模块"约束在**详情模块内部**的改动不适用（新函数紧邻既有详情逻辑，非文件末尾堆砌）。

##### 超出范围的观察

- `js/app.js` 详情 + 搜索 + 设置多职责混杂（约 1900 行），未来建议整体走 `cs-refactor` 拆分（如 `detail.js` / `search.js` / `settings.js`）——本 feature 不动。

## 3. 验收契约

### 3.1 关键场景清单

| ID | 触发 | 期望可观察结果 |
|---|---|---|
| S1 | 多源影片（`merged_source_items.length > 1`）打开详情 | 剧集网格上方出现来源 Tab 胶囊，逐源显示源名，当前源高亮；剧集来自当前源 |
| S2 | 点击另一来源 Tab | Tab 高亮切换；剧集重新拉取（来源为该源内容，集数 / 剧集名匹配该源）；无整页刷新 |
| S3 | S2 后点击某集 | 跳转 `player.html`，URL `source` 与 `id` 为**选中源**的 code 与 vod_id |
| S4 | 单源影片打开详情 | 无来源 Tab，界面与改动前完全一致 |
| S5 | 旧 localStorage 缓存（无 `merged_source_items`）打开详情 | 无来源 Tab，单源回退，无 JS 报错 |
| S6 | 快速连续点击多个来源 Tab | 最终展示最后点击的源的剧集，无"后发覆盖前发"错乱 |
| S7 | 切源前开启"倒序排列" → 切源 → 点某集播放 | 剧集仍为倒序；点剧集播放 URL 仍带**当前源** code / vodId（工具栏 onclick 未陈旧，FDR-001 回归点） |
| S8 | 切源后点"复制链接" | 复制的剧集链接为当前源内容 |
| S9 | 含自定义源（`custom_N`）的多源影片打开详情并切到自定义源 | 详情正常拉取（走 `getCustomApiInfo` 分支），剧集为该自定义源内容 |
| S10 | 搜索结果筛选某分类后进入详情 | 来源 Tab 正常显示（筛选不丢 `merged_source_items`） |

### 3.2 明确不做的反向核对项

- `merged_sources` 仍为字符串数组（grep 确认 `dedupeSearchResults` 中 `existing.merged_sources.push(src)` 保持 push 字符串）
- 播放器资源切换链路零改动（`player.js` 无 diff；`loadResourceSwitchList` / `switchToResource` 无调用方变化）
- 无 localStorage 新增 key（grep 确认无新增 `setItem`）
- 无后端 / 代理文件改动（`server.mjs` / `api/proxy/` / `netlify/functions/` / `functions/proxy/` 零 diff）

### 3.3 Acceptance Coverage Matrix

| Scenario | Covered By Step | Evidence Type | Command / Action | Core? |
|---|---|---|---|---|
| S1 多源显示来源 Tab | 推进策略 2 | browser | `npm run dev` → 搜索多源影片 → 打开详情 | yes |
| S2 切换来源重拉剧集 | 推进策略 3 | browser | 详情页点其他来源 Tab | yes |
| S3 播放走选中源 | 推进策略 4 | browser / diff review | 切源后点剧集，检查 player.html URL 参数 | yes |
| S4 单源无 Tab | 推进策略 2 | browser | 打开单源影片详情 | yes |
| S5 旧缓存回退 | 推进策略 4 | browser | 用改动前缓存数据打开详情（或 console 构造无字段对象） | no |
| S6 快速切源防竞态 | 推进策略 3 | browser | 连续快速点击多个 Tab | no |
| S7 倒序状态保留 | 推进策略 4 | browser | 倒序后切源 | no |
| S8 复制链接为新源 | 推进策略 4 | browser | 切源后复制链接 | no |
| S9 自定义源 | 推进策略 4 | browser | 含自定义源影片切源 | no |
| S10 筛选后详情 | 推进策略 4 | browser | 筛选后进入详情 | no |

### 3.4 DoD Contract

| ID | 要求 | 证据 | 阻塞级别 |
|---|---|---|---|
| DOD-DESIGN-001 | design 自身完整且关键契约可执行 | design review | blocking |
| DOD-IMPL-001 | checklist steps 全部完成且实现证据落盘 | checklist / evidence | blocking |
| DOD-REVIEW-001 | code review passed 且无 unresolved blocking | review report | blocking |
| DOD-ACCEPT-001 | acceptance 完成回写和最终审计（Standard lane accept-inline） | acceptance report | blocking |

Validation Commands:

| ID | 命令 | 目的 | 核心性 | 失败处理 |
|---|---|---|---|---|
| CMD-001 | `node --check js/app.js` | 语法校验 | core | fix-or-block |
| CMD-002 | `npm run dev` + 浏览器手动（S1-S10） | 端到端行为验证 | core | fix-or-block |
| CMD-003 | grep 反向核对（`merged_sources.push` 字符串、无新增 `setItem`、代理文件零 diff） | 范围守护 | supporting | document-baseline |

Required Artifacts: design / checklist / design-review / review / acceptance + 浏览器验证记录。

## 4. 与项目级架构文档的关系

- **名词**：`merged_source_items` 是搜索合并数据契约的扩展，属系统级可见（缓存、筛选潜在消费方）。建议 acceptance 后回写 `requirements/CONTEXT.md` 术语表（若后续引入）。当前 `requirements/` 目录为空，无 CONTEXT.md 可回写。
- **动词骨架 / 流程级约束**：详情页多源切换是单页面 UI 编排，无跨模块结构性选择；vod_id 源相关已由 compound `2026-08-08-history-dedup-key` 沉淀，本 feature 只是应用该既有结论 → 无需 ADR。
- 结论：本 feature 无需要新写的 ADR；`merged_source_items` 字段可考虑后续进术语表（超范围，不阻塞）。

## 5. 工作流（Standard lane，本 run 完成）

1. **Design（本产物）** → design-review passed → 用户整体 review 确认
2. **Implementation** → 本 run 内完成
3. **Code Review** → 独立 subagent review
4. **Accept-inline** → 含 Inline Verification Matrix，按 S1-S10 核验

完成 marker：`CS_FEATURE_STANDARD_COMPLETE`。
