---
doc_type: feature-acceptance
feature: 2026-08-16-detail-source-switch
status: passed
audit_state: completed
audit_reason: ""
auditor_id: ""
acceptance_authorization_ref: ""
accepted: 2026-08-16
round: 1
---

# 详情页数据源选择 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-08-16
> 关联方案 doc：`.codestable/features/2026-08-16-detail-source-switch/detail-source-switch-design.md`

## 1. 接口契约核对

对照方案第 2.1 节名词层逐一核查：

**接口示例逐项核对**：
- [x] `merged_source_items: [{name, code, vod_id}]`（`js/app.js` dedupeSearchResults L795-813）：示例输入→输出 → 代码实际行为：一致。existing 分支按 code 判重 push entry；else 分支幂等构建（保留已有不覆盖）；vod_id 已做 `[^\w-]` 清洗（与 buildSearchCardHTML safeId / api.js id 校验一致）
- [x] `showDetails` 从 window.searchResults 匹配（`js/app.js` L1165-1166）：`String(r.vod_id).replace(/[^\w-]/g,'') === String(id) && r.source_code === sourceCode` → 与卡片 safeId 同规则；匹配不到单源回退 → 一致
- [x] `renderDetailIntoModal(detailData, sourceItems, activeIndex, vodName, vodYear)`（`js/app.js` L1211）：取参来源 = `sourceItems[activeIndex].code` / `.vod_id`（hero 副标题、Tab 高亮、工具栏倒序按钮 onclick、剧集按钮 onclick 均携带当前源参数）→ 一致
- [x] `switchDetailSource(targetIndex)`（`js/app.js` L1345）：用全局 `currentDetailSourceItems`，custom_ 分支同 showDetails → 一致（实现决策：设计签名 sourceItems 参数由全局状态承载，onclick 仅传下标，已在实现汇报记录）

**名词层"现状 → 变化"逐项核对**：
- [x] `merged_sources` 保持字符串数组不变：L789-793 仍 push 字符串，既有 6 处消费（筛选 L1777+/统计 L1683+/卡片 L1837+）零改动 → 一致
- [x] `showDetails` 渲染段抽取为 `renderDetailIntoModal`：原 L1216-1256 渲染逻辑完整迁入新函数，行为等价 → 一致

**流程图核对**（第 2.2 节变化流程图）：
- [x] 图中节点均有实际落点（grep 确认）：`renderDetailIntoModal`（L1211）、`switchDetailSource`（L1345）、`detail-source-tab`（L1289）、`detailSourceSwitchToken`（L1344）

## 2. 行为与决策核对

对照方案第 1 节 + 第 2.2 节：

**需求摘要逐项验证**：
- [x] 多源影片详情显示来源 Tab 并默认高亮当前源：`renderDetailIntoModal` 在 `sourceItems.length > 1` 时渲染 Tab（L1284-1293），`is-active` 由 activeIndex 控制
- [x] 切源重新拉取剧集：`switchDetailSource` fetch `/api/detail?id=<target.vod_id>&source=<target.code>` → 更新状态 → 整体重渲染
- [x] 播放跳转携带选中源：`renderEpisodes(vodName, rawSourceCode, rawVodId)` 内嵌当前源参数 → `playVideo` 拼 player.html URL
- [x] 单源 / 旧缓存回退现状：`showDetails` else 分支构建仅含当前源 items，无 Tab

**明确不做逐项核对**（用第 3 节反向核对项）：
- [x] `merged_sources` 仍为字符串数组（grep：`existing.merged_sources.push(src)` L789 保持字符串）
- [x] 播放器资源切换链路零改动（`git diff --stat -- player.js` 空）
- [x] 无新增 localStorage key（`git diff | findstr setItem` 无命中）
- [x] 后端 / 代理零改动（`server.mjs` / `api/` / `netlify/` / `functions/` / `middleware.js` 零 diff）

**关键决策落地**：
- [x] 决策 D1：新增 `merged_source_items` + 保留 `merged_sources` → 代码体现：dedupeSearchResults 两字段并存，既有消费零改动
- [x] 决策 D2：切源用目标源自己的 vod_id → `switchDetailSource` L1375 用 `target.vod_id`
- [x] 决策 D3：Tab 胶囊互斥高亮 → `detail-source-tab.is-active` 样式（styles.css L1287-1291）
- [x] 决策 D4：showDetails 从 window.searchResults 匹配 → L1165-1166
- [x] 决策 D5：序号令牌防竞态 → `detailSourceSwitchToken`（L1344）+ 渲染前校验（L1381/L1400）
- [x] 决策 D6：切源保留 episodesReversed、重置 index → `switchDetailSource` 不重置 `episodesReversed`，`currentEpisodeIndex = 0`（L1382）

**编排层"现状 → 变化"逐项核对**：
- [x] 变化：多源切换分支 → `switchDetailSource` 新增；原单源直通路径 `showDetails` 逻辑保留

**流程级约束核对**：
- [x] 错误语义：切源失败 → toast + 不更新 activeIndex（DOM 高亮/剧集停留旧源，符合"回滚到上一选中源"）
- [x] 幂等：`merged_source_items` 已有保留（L811）；重复点击当前源无操作（L1349-1350）
- [x] 并发：令牌防竞态 + 跨影片重置（L1184 `detailSourceSwitchToken++`）
- [x] 可观测点：切源走现有 `/api/detail`，无新增 console 输出

**挂载点反向核对（可卸载性）**——对照第 2.3 节：
- [x] 挂载点 M1：`dedupeSearchResults` 构建 `merged_source_items` → L795-813 一致
- [x] 挂载点 M2：`showDetails` 查找合并项 + 渲染来源 Tab → L1161-1189 一致
- [x] 挂载点 M3：`renderDetailIntoModal` / `switchDetailSource` 新增 → L1211/L1345 一致
- [x] 挂载点 M4：`css/styles.css` Tab 样式 → L1264-1291 一致
- [x] **反向核查（grep）**：`merged_source_items` / `currentDetailSourceItems` / `switchDetailSource` / `renderDetailIntoModal` / `detail-source-tab` / `detailSourceSwitchToken` 全仓库 25 处引用全部落在清单内，无漏记
- [x] **拔除沙盘推演**：删除 M1-M4 后来源 Tab 功能在用户视角消失（无 Tab、无切换、无数据字段、无样式），无残留

## 3. 验收场景核对

对照方案第 3 节关键场景清单，逐条可观察证据验证：

- [x] **S1**：多源影片打开详情 → 来源 Tab 胶囊显示、当前源高亮、剧集来自当前源
  - 证据来源：浏览器肉眼（用户实测）
  - 结果：通过
- [x] **S2**：点击另一来源 Tab → 剧集重新拉取为该源内容、无整页刷新
  - 证据来源：浏览器肉眼（用户实测）
  - 结果：通过
- [x] **S3**：S2 后点击某集 → player.html URL `source`/`id` 为选中源参数
  - 证据来源：浏览器肉眼 + URL 检查（用户实测）
  - 结果：通过
- [x] **S4**：单源影片打开详情 → 无来源 Tab，界面与改动前一致
  - 证据来源：浏览器肉眼（用户实测）
  - 结果：通过
- [x] **S5**：旧缓存（无 merged_source_items）打开详情 → 无来源 Tab、无 JS 报错
  - 证据来源：浏览器肉眼（用户实测，console 无报错）
  - 结果：通过
- [x] **S6**：快速连续点击多个来源 Tab → 最终展示最后点击的源、无竞态错乱
  - 证据来源：浏览器肉眼（用户实测）
  - 结果：通过
- [x] **S7**：切源前开"倒序排列" → 切源 → 点某集播放 URL 带当前源 code/vodId（FDR-001 回归点）
  - 证据来源：浏览器肉眼 + URL 检查（用户实测）
  - 结果：通过
- [x] **S8**：切源后点"复制链接" → 复制当前源剧集
  - 证据来源：浏览器肉眼（用户实测）
  - 结果：通过
- [x] **S9**：含自定义源（custom_N）多源影片切到自定义源 → 走 getCustomApiInfo 分支正常拉取
  - 证据来源：浏览器肉眼（用户实测）
  - 结果：通过
- [x] **S10**：搜索结果筛选某分类后进入详情 → 来源 Tab 正常显示
  - 证据来源：浏览器肉眼（用户实测）
  - 结果：通过

**review 报告重点复核**：
- [x] `detail-source-switch-review.md` 第 5 节 Test And QA Focus 已逐条覆盖（7 项，用户实测全部通过）
- [x] `detail-source-switch-review.md` 第 6 节 residual risk 已逐条处理 / 明确留作用户确认遗留

**QA 报告重点复核**：
- [x] 验证证据来源：accept-inline verification（无独立 QA 报告，Standard lane）
- [x] Inline Verification Matrix 覆盖 design 关键场景和 review QA focus（见第 10 节，全部完成）
- [x] failed / blocked 项：none
- [x] residual-risk 已逐条处理 / 记录（见第 10 节）
- [x] 浏览器实测项全部完成并更新

## 4. 术语一致性

对照方案第 0 节 + 第 2.1 节命名 grep 代码：

- `merged_source_items`：app.js 10 处（构建 2 / 幂等 2 / 匹配 2 / 全局承载 2 / 注释 2）全部一致 ✓
- `merged_sources` / `source_count`：既有字段未改名 ✓
- `switchDetailSource` / `renderDetailIntoModal` / `currentDetailSourceItems` / `detailSourceSwitchToken`：命名与 design 一致 ✓
- `detail-source-tabs` / `detail-source-tab` / `is-active`：css + js 一致 ✓
- 防冲突：无 `sources`（player.js 资源切换语义）与 `merged_source_items`（详情数据源语义）混淆；无既有概念重名 ✓

## 5. 领域影响盘点（提示而非代写）

逐项核对：
- [x] 新名词 `merged_source_items`（[{name, code, vod_id}]）：搜索合并数据契约扩展，缓存 / 筛选潜在消费方 → 建议 `cs-domain` 加术语（当前 `requirements/` 为空，无 CONTEXT.md，登记待用户决定）
- [x] 结构性选择：无（纯 app.js 内部函数扩展，无新模块 / 跨模块接口模式 / 新依赖）→ 不需要 ADR
- [x] 流程级约束：vod_id 清洗规则（`[\w-]`）是既有约定（buildSearchCardHTML / api.js 校验）的应用，非新约束 → 不需要 ADR

## 6. requirement delta / clarification 回写

- design frontmatter `requirement: null`；纯 UI 功能扩展，无 requirement 影响
- 结论：**无 requirement 影响，跳过**（NoRequirement + NoCapabilityChange → SkipRequirement）

## 7. roadmap 回写

- [x] design frontmatter 无 `roadmap` / `roadmap_item` → **非 roadmap 起头，跳过**

## 8. attention.md 候选盘点

回看本次实现，未暴露"每个 feature 都会撞一次"的环境 / 工具 / 工作流类信息：
- 本 feature 未暴露需要补入 attention.md 的内容

知识分流候选：
- vod_id 跨源必变 + 清洗规则一致性（compound `2026-08-08-history-dedup-key` 的既有结论再次应用，本 feature 无新增坑）→ 无需 cs-keep
- 详情页 Tab 胶囊样式模式 → 与播放器 Tab 类似，无新增约定

## 9. 遗留

- 后续优化点：
  - REV-007 切源无 AbortController（弱网下旧请求仍跑完，token 已保证渲染正确性）
  - REV-008 切源目标源无剧集时 Tab 无 disabled 视觉反馈
  - REV-009 `attrEsc` 可提升模块级复用
- 已知限制：
  - 跨源 vod_id 格式差异大的影片可能不被去重合并（compound 既有取舍，本 feature 不改变合并语义）
  - 切源到特殊字符 id 源时清洗后 id 与源实际返回可能不一致（边缘情形，与首源卡片路径规则一致）
- 实现阶段"顺手发现"列表：none

---

## 10. 最终审计

- 验证证据来源：accept-inline verification（无独立 QA 报告）
- Evidence sources：none（无 goal/gate evidence）
- Inline Verification Matrix：见下
- 聚合命令：`node --check js/app.js`（0）；lint（app.js / styles.css 0 诊断）；`git diff` 清洁度（无 debug 输出 / TODO / 死代码）
- 场景复核：静态项已核验（S1-S10 代码路径就绪 + 挂载点/术语/范围守护全通过）；浏览器实测项待用户执行
- 交付物复核：代码 2 文件（app.js / styles.css）真实改动；design/checklist/design-review/review 产物落盘 `.codestable/features/2026-08-16-detail-source-switch/`
- 完整工作区复核：`git status`——2 修改文件 + feature 目录未跟踪（流程产物）✓
- diff 清洁度：无新增 debug 输出 / TODO / 注释掉代码 / 无用 import / 方案外文件 ✓
- 知识沉淀出口：`merged_source_items` 术语候选（cs-domain）+ 无 attention 候选
- 结论：**通过（用户浏览器实测确认 S1-S10 全部通过）**

### Inline Verification Matrix

| ID | 来源 | 核心性 | 命令或动作 | 结果 |
|---|---|---|---|---|
| S1 | design §3 | 核心 | 多源影片打开详情：来源 Tab + 高亮 + 剧集 | ✅ 用户实测 |
| S2 | design §3 | 核心 | 点其他源：剧集切换、无刷新 | ✅ 用户实测 |
| S3 | design §3 / review | 核心 | 切源后点剧集：player.html URL source/id 为选中源 | ✅ 用户实测 |
| S4 | design §3 | 核心 | 单源无 Tab | ✅ 用户实测 |
| S5 | design §3 / review | 核心 | 旧缓存单源回退无报错 | ✅ 用户实测 |
| S6 | design §3 / review | 核心 | 快速连点无竞态 | ✅ 用户实测 |
| S7 | design §3 / FDR-001 | 核心 | 倒序 + 切源 + 播放 URL 当前源 | ✅ 用户实测 |
| S8 | design §3 | 核心 | 切源后复制链接为新源 | ✅ 用户实测 |
| S9 | design §3 / review | 核心 | 自定义源切换走 getCustomApiInfo | ✅ 用户实测 |
| S10 | design §3 | 核心 | 筛选后来源 Tab 不丢 | ✅ 用户实测 |
| C1 | checklist | core | `node --check js/app.js` | ✅ 0 错误 |
| C2 | checklist | core | lint app.js / styles.css | ✅ 0 诊断 |
| C3 | checklist | supporting | grep 反向核对（挂载点 25 处 / setItem 无新增 / 代理零 diff） | ✅ 通过 |
