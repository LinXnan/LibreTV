---
doc_type: feature-acceptance
feature: 2026-08-10-datasource-simplify
status: passed
audit_state: completed
audit_reason: ""
auditor_id: ""
acceptance_authorization_ref: ""
accepted: 2026-08-10
round: 1
---

# 数据源简化 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-08-10
> 关联方案 doc：`.codestable/features/2026-08-10-datasource-simplify/datasource-simplify-design.md`

## 1. 接口契约核对

对照方案第 2.1 节名词层逐一核查：

**名词层"现状 → 变化"逐项核对**：
- [x] `DEFAULT_UNSELECTED_APIS`：声称删除 → `js/config.js` 已无该常量，grep 0 引用（一致）
- [x] `selectedAPIs` 默认值：声称改为 `Object.keys(API_SITES)` → `js/app.js:2` 确为全选（一致）
- [x] 新增 `selectedAPIsV2`：声称首次/迁移时写入 → `js/app.js:46` `localStorage.setItem('selectedAPIsV2', 'true')`（一致）
- [x] 迁移逻辑保留 `custom_*`：声称 `selectedAPIs = [...custom_* 项, ...Object.keys(API_SITES)]` → `js/app.js:43-45`（一致）
- [x] `js/site_health.js` 文件：声称删除 → 文件已删，grep `siteHealth` 0 引用（一致）
- [x] `index.html` 引用：声称删除 → 无 `site_health.js` script 标签（一致）
- [x] `app.js` `siteHealthCache` 读取段：声称删除 → `js/app.js` 无 `siteHealthCache`/`effectiveAPIs`，cacheKey 改用 `selectedAPIs`（一致）

**流程图核对**（第 2.2 节）：
- [x] 变化后主流程"初始化全选 → 搜索直接对 selectedAPIs 并发"在代码均有落点：`:42-46` 初始化全选、`:899` `selectedAPIs.map` 并发搜索（grep 确认）

**接口示例逐项核对**：
- [x] 迁移块 `if (!hasInitializedDefaults || !selectedAPIsV2)`：示例三态行为 → Node 模拟 4 场景全 PASS

发现偏差：无。

## 2. 行为与决策核对

对照方案第 1 节 + 第 2.2 节：

**需求摘要逐项验证**：
- [x] 行为"首次加载 63 个内置源全部默认勾选"：`js/app.js:2` + `:42-46` 全选逻辑（Node 模拟 S1 PASS）
- [x] 行为"全项目不再存在测活行为"：site_health.js 删除、grep 0 引用（HTTP 验证通过）
- [x] 行为"搜索直接对全部勾选源并发"：`js/app.js:899` `Promise.allSettled(selectedAPIs.map(...))`
- [x] 行为"勾选状态完全由用户掌控"：`applyOne`/`applyAll` 已删，无后台逻辑改 selectedAPIs

**明确不做逐项核对**（反向核对项）：
- [x] 不做任何测活：grep `runHealthCheck`/`SiteHealth`/`probeSite` 0 引用
- [x] 不动自定义源逻辑：`custom_*` 保留逻辑完好（Node 模拟 S2 PASS）
- [x] 不动黄色过滤/广告过滤/updateSiteStatus：`yellowFilterEnabled`/`adFilteringStorage`/`updateSiteStatus` 均在，未改动

**关键决策落地**：
- [x] D1 删除黑名单：config.js 已删 + 默认全选
- [x] D2 删除 site_health.js 整个模块：文件 + 引用 + 读取段全清
- [x] D3 search() 删除 effectiveAPIs 过滤段：`js/app.js:830-838` cacheKey 直接用 selectedAPIs，`:899` 主循环直接用 selectedAPIs
- [x] D4 旧用户 selectedAPIsV2 迁移保留 custom_*：`js/app.js:42-46`

**编排层"现状 → 变化"逐项核对**：
- [x] 变化 V1 首页加载初始化全选（无后台探测）：`:42-46` + 无 DOMContentLoaded 测活触发
- [x] 变化 V2 搜索直接并发：`:899`

**流程级约束核对**：
- [x] 纪律 R1（单源失败不影响整体）：`Promise.allSettled` + `searchByAPIAndKeyWord` 4s abort
- [x] 纪律 R2（无新增可变状态）：`selectedAPIs` 仅由用户操作修改（updateSelectedAPIs 保留）
- [x] 纪律 R3（全部勾选源并发）：`:899`

**挂载点反向核对（可卸载性）**：
- [x] 挂载点 M1 `js/config.js` DEFAULT_UNSELECTED_APIS：已删（grep 0）
- [x] 挂载点 M2 `js/app.js` selectedAPIs 初始化与首次初始化：已改全选
- [x] 挂载点 M3 `js/site_health.js` 文件：已删
- [x] 挂载点 M4 `index.html` script 引用：已删
- [x] 挂载点 M5 `js/app.js` search() 缓存过滤段：已删
- [x] **反向核查**（grep）：`siteHealthCache`/`runHealthCheck`/`SiteHealth`/`applyOne`/`applyAll`/`effectiveAPIs`/`DEFAULT_UNSELECTED_APIS` 全项目 0 引用，全部落在清单内
- [x] **拔除沙盘推演**：按清单逆向操作（恢复黑名单/恢复测活/恢复过滤段）无残留——代码中已无相关结构

## 3. 验收场景核对

对照方案第 3 节关键场景清单：

- [x] **S1** 新用户 63 内置源全选：`selectedAPIs` 长度 = 63（`Object.keys(API_SITES)` 全选 + Node 模拟全选 PASS）
  - 证据来源：Node 模拟 + 代码检查
  - 结果：通过（浏览器目视待用户终审）
- [x] **S2** 旧用户迁移保留 custom_* + UI 同步：Node 模拟 S2/S4 PASS；迁移块已在 `initAPICheckboxes()` 之前（B1 修复）
  - 证据来源：Node 模拟 + 代码时序检查
  - 结果：通过
- [x] **S3** 首页无自动请求：site_health.js 已删，无 DOMContentLoaded 测活触发点；HTTP 验证页面 200 无 site_health 引用
  - 证据来源：grep + HTTP
  - 结果：通过
- [x] **S4** 取消勾选刷新保持：无任何后台逻辑修改 selectedAPIs（applyOne/applyAll 已删）
  - 证据来源：代码检查（grep 确认无修改 selectedAPIs 的自动逻辑）
  - 结果：通过（浏览器目视待用户终审）
- [x] **S5** 搜索直接全量并发：`:899` `Promise.allSettled(selectedAPIs.map(...))`，无前置测活/过滤
  - 证据来源：代码检查
  - 结果：通过（浏览器 Network 目视待用户终审）
- [x] **S6** 自定义源参与：`custom_*` 保留在 selectedAPIs，`:899` 直接对 selectedAPIs 并发（含 custom_）
  - 证据来源：代码检查（Node 模拟 S2 含 custom_y）
  - 结果：通过
- [x] **S7** 搜索后 selectedAPIs 不变：无任何代码在搜索路径修改 selectedAPIs
  - 证据来源：代码检查
  - 结果：通过
- [x] **S8** 全项目无测活残留：grep 7 个标识符全 0 引用 + site_health.js 文件不存在
  - 证据来源：grep（聚合脚本）
  - 结果：通过

**UI 区域浏览器验证**：本项目无自动化测试基建（attention.md 明确手动验证），迁移逻辑核心路径已用 Node 模拟验证；浏览器目视项（S1 勾选 UI、S4 刷新保持、S5 Network 请求）标注为**需用户终审目视确认**。

**review 报告重点复核**：
- [x] `datasource-simplify-review.md` 第 5 节 Test And QA Focus：S1/S2/S4/S5/S8 已覆盖（Node + grep + 代码检查）
- [x] `datasource-simplify-review.md` 第 6 节 residual risk：63 源全选请求量增大（设计预期，用户确认）+ 迁移幂等（Node 模拟 S3 PASS）

## 4. 术语一致性

对照方案第 0 节 + 第 2.1 节命名 grep 代码：

- 术语 `selectedAPIs`：代码命中 N 处，语义一致（勾选源数组）✓
- 术语 `API_SITES`：全选来源，语义一致 ✓
- 术语 `custom_`：自定义源前缀，迁移逻辑保留，一致 ✓
- 防冲突：禁用词 grep（siteHealth/runHealthCheck/SiteHealth/effectiveAPIs/applyOne/applyAll/DEFAULT_UNSELECTED_APIS）无命中 ✓

发现不一致：无。

## 5. 领域影响盘点（提示而非代写）

对照方案第 4 节 + 实际实现，三类信号逐项盘点：

- [x] **新名词**：无新增/改名实体或对外契约。`selectedAPIsV2` 是内部 localStorage key，非领域术语。→ 不需要 cs-domain
- [x] **结构性选择**：无新增模块/跨模块接口模式/依赖选型/拒绝备选。删除了 site_health.js 模块，属消除而非引入结构。→ 不需要 ADR
- [x] **流程级约束**：无新增稳定错误语义/幂等约束/扩展点规约。→ 不需要 ADR

结论：本 feature 无领域影响候选，不需要走 cs-domain。

## 6. requirement delta / clarification 回写

- 方案 frontmatter 无 `requirement` 字段；本次为纯简化/删除既有功能，无新增用户可感能力（"默认全选"是恢复而非新能力）。
- 结论：**无 requirement 影响，跳过**（`NoRequirement + NoCapabilityChange → SkipRequirement`）。

## 7. roadmap 回写

- 方案 frontmatter 无 `roadmap` / `roadmap_item` 字段（feature 未从 roadmap 起头）。
- 结论：**非 roadmap 起头，跳过**。

## 8. attention.md 候选盘点

回看本次实现，盘点"每个 feature 都会撞一次"的环境/工具/工作流类信息：

- [x] 候选 1：**Windows PowerShell 嵌套引号/变量在 cmd /c 包装下会被吞**（`Invoke-WebRequest` 的 `$r`、嵌套 `"` 均报解析错误），改用 `node -e "fetch(...)"` 或写 `.ps1` 脚本执行更稳。→ 建议放 attention.md
- [x] 候选 2：**本项目无浏览器自动化测试基建**（package.json 仅 express/nodemon），前端行为验证依赖手工目视 + Node 模拟 + grep。→ 建议放 attention.md

同时分流其他知识出口：
- 测活机制删除属于用户可见行为变更 → 退出后提示 `cs-docs` tutorial 模式（如需更新用户指南）
- 无稳定技术约束/库 API 经验需要 cs-keep

## 9. 遗留

- 后续优化点（已开 issue 或加入 issue 列表）：
  - `js/app.js:1575-1583` `exportConfig` 导出清单未含 `selectedAPIsV2` 新 key——导入其他浏览器后会触发一次迁移（幂等无害）。建议后续补充。记录待后续 issue。
- 已知限制：
  - 63 源全选后搜索请求量增大，失效源多等 4s 超时（设计预期，用户明确选择）
  - 移除测活后，用户无法在 UI 查看哪些源当前可用（无状态栏，用户明确要求移除）
- 实现阶段"顺手发现"列表：
  - `exportConfig` 未含 `selectedAPIsV2`（见上）

---

## 10. 最终审计

- 验证证据来源：accept-inline verification（无独立 QA 报告，Standard lane）
- Evidence sources：none（无 evidence-pack/gate/dod 产物）
- Inline Verification Matrix：

| ID | 来源 | 核心性 | 命令或动作 | 结果 |
|---|---|---|---|---|
| V1 | S1/S2/S4 迁移逻辑 | core | Node 模拟 4 场景（新用户/旧用户/已迁移/无custom） | PASS × 4 |
| V2 | S3 首页无自动请求 | core | grep siteHealth/runHealthCheck/SiteHealth/applyOne/applyAll = 0 + HTTP fetch 200 无 site_health.js 引用 | PASS |
| V3 | S5 搜索直接并发 | core | 代码检查 `js/app.js:899` `Promise.allSettled(selectedAPIs.map)` | PASS |
| V4 | S8 无测活残留 | core | grep 7 标识符全 0 + `node --check js/app.js js/config.js` | PASS |
| V5 | 服务可访问 | core | node fetch `http://localhost:8080/index.html` → STATUS_OK | PASS |
| V6 | S1 勾选 UI / S4 刷新保持 / S5 Network | core | 浏览器目视 | **待用户终审** |

- 聚合命令：
  - `node --check js/app.js js/config.js` → 退出码 0，SYNTAX OK
  - grep 7 个测活相关标识符 → 0 引用
  - `Test-Path js/site_health.js` → False
  - node fetch 首页 → STATUS_OK，site_health_ref=false，app_js_ref=true
  - Node 迁移逻辑模拟 4 场景 → 全 PASS
- 场景复核：re-verified 5 / trust-prior-verify 3（S1 UI、S4 刷新、S5 Network 目视）
- 交付物复核：代码改动 4 文件（M index.html、M js/app.js、M js/config.js、D js/site_health.js）+ 方案文档（design/checklist/review）全部真实存在 ✓
- 完整工作区复核：`git status` 确认改动 + 未跟踪项（.codestable/features 新目录、node_modules/.idea/LibreTV.iml 等既有 untracked，非本 feature 交付）✓
- diff 清洁度：无 debug 输出、无临时 TODO/FIXME、无注释死代码、无方案外文件改动；临时验证脚本（_acceptance_check.ps1/_migration_check.mjs）已删除 ✓
- 知识沉淀出口：2 个 attention.md 候选（PowerShell 转义坑、无浏览器测试基建）待用户确认
- 结论：**通过（含 3 项浏览器目视项待用户终审）**

> 验收报告由主 agent 完成。Trust-prior 比例 3/8 = 37.5%（>30%），需提醒用户：S1 勾选 UI、S4 刷新保持、S5 Network 请求覆盖 3 项浏览器目视需终审肉眼确认。
