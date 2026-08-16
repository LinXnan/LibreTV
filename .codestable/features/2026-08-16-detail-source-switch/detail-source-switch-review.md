---
doc_type: feature-review
feature: 2026-08-16-detail-source-switch
status: passed
reviewer: subagent
reviewed: 2026-08-16
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装（where ocr 未找到），环节 B 降级，不阻塞"
---

# detail-source-switch 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-16-detail-source-switch/detail-source-switch-design.md`（status: approved）
- Checklist: `.codestable/features/2026-08-16-detail-source-switch/detail-source-switch-checklist.yaml`（steps 全 done）
- Evidence pack: none（Standard lane）
- Gate results: none
- DoD results: none
- Implementation evidence: 实现完成汇报（对话）+ review-fix 修复记录
- Diff basis: `git status` — `js/app.js` + `css/styles.css` 修改，`.codestable/features/2026-08-16-detail-source-switch/` 未跟踪
- Review mode: full-rereview（round 1 独立审查 → review-fix A/B/E → round 2 完整独立复审 → 修复 REV-004 → 本地核验收尾）
- Baseline dirty files: none（工作区仅本 feature 改动）

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 与 round 2 各一轮）
- 环节 B OCR CLI: unavailable（`where ocr` 未找到）
- OCR severity mapping: 未启用（不可用）
- Merge policy: 两轮 Task agent 输出均逐条本地代码事实核验后合并 / 驳回
- Gate effect: none（环节 A completed，环节 B unavailable 不阻塞）

## 2. Diff Summary

- 新增：无新文件（实现改动均在既有文件内）
- 修改：`js/app.js`（dedupeSearchResults / showDetails / renderDetailIntoModal / switchDetailSource + 2 全局变量 + 1 令牌计数器）、`css/styles.css`（来源 Tab 样式 +30 行）
- 删除：none
- 未跟踪：`.codestable/features/2026-08-16-detail-source-switch/`（流程产物）
- 风险热点：并发/时序（切源令牌）、数据（vod_id 清洗一致性）、UI（来源 Tab 渲染）

## 3. Adversarial Pass

- 假设的生产 bug：切源后按钮 onclick 携带旧源参数（FDR-001 回归点）或快速切源竞态串台
- 主动攻击过的反例：design 不一致（vod_id 匹配规则）、边界值（特殊字符 vod_id、空 episodes、源无 name）、错误路径（切源失败回滚）、状态转换（跨影片切源）、并发时序（in-flight 串台）、持久化回滚（旧缓存兼容）、XSS 面（onclick 插值未转义）
- 结果：升级为 findings REV-001~004；其余（无 AbortController、无 Tab 级视觉反馈、attrEsc 复用）留 nit / suggestion

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/app.js dedupeSearchResults L798-800 / L811-814 + showDetails 匹配` vod_id 清洗规则不一致：`buildSearchCardHTML` 的 `safeId` 对 `item.vod_id` 做 `[^\w-]` 清洗后传入卡片 onclick，而 `showDetails` 匹配 `String(r.vod_id) === String(id)` 用原始值 → 特殊字符 vod_id 的源匹配失败 → 多源退化单源（无来源 Tab）。
  - Evidence: `buildSearchCardHTML` safeId 清洗（L1966）；`showDetails` 匹配（L1165）；`api.js` detail id 校验 `/^[\w-]+$/`（L18）
  - Impact: S1/S2/S9 在含特殊字符 vod_id 的源上失效，且静默退化无报错
  - Expected fix scope: 已修复——`dedupeSearchResults` 构建 `merged_source_items` 时对 `vod_id` 清洗（两处）；`showDetails` 匹配对 `r.vod_id` 同规则清洗比较（REV-004 补充）；切源请求 id 清洗后通过 api.js 校验
- [x] REV-002 `js/app.js switchDetailSource L1345 + showDetails L1182` 切源令牌不随打开新影片重置：上一影片在途切源响应（token 仍最新）会渲染到新影片（数据源与源参数错乱）。
  - Evidence: `detailSourceSwitchToken` 仅在 `switchDetailSource` 自增；`showDetails` 原不重置
  - Impact: 依赖"切源未完成即切影片"时序，触发即串台且不报错
  - Expected fix scope: 已修复——`showDetails` 设置新影片状态后 `detailSourceSwitchToken++` 作废在途响应（round 2 核验位置在状态写入后、渲染前，TDZ 安全）
- [x] REV-004 `js/app.js showDetails 匹配`（round 2）REV-001 修复不完整：`dedupeSearchResults` 只清洗 `merged_source_items` entry 的 vod_id，顶层 `item.vod_id` 未清洗，`showDetails` 匹配 `r.vod_id`（原始）与 `id`（卡片清洗后）仍不一致。
  - Evidence: 清洗点仅 entry/ownEntry（L800/L812）与卡片 safeId；`r.vod_id` 顶层保持原始值
  - Impact: 特殊字符 id 源仍退化单源（REV-001 原始症状未根治）
  - Expected fix scope: 已修复——`showDetails` 匹配对 `r.vod_id` 应用 `.replace(/[^\w-]/g, '')` 再比较（最小改动，与卡片 safeId 同规则）

### nit

- [x] REV-003 `js/app.js showDetails L1169-1173` `activeIndex < 0` 时原实现静默取 items[0]，数据源与源参数不一致（异常缓存）。
  - 已修复：`activeIndex < 0` 时整体单源回退，与"无 merged_source_items"分支一致
- [ ] REV-005 `js/app.js dedupeSearchResults` `merged_source_items`（按 code 判重）与 `merged_sources`（按 name 判重）长度在"源无 name"时不一致 → 详情 Tab 数 ≠ 卡片"X 个源"徽标数。低概率，不修。
- [ ] REV-006 `js/app.js renderEpisodes` onclick 对单引号不设防（既有弱点）；切源引入未清洗数据扩大暴露面。已随 REV-001/004 的 vod_id 清洗闭合（进入 renderEpisodes 的 vod_id 为 `[\w-]` 无引号；sourceCode 为 API key / custom_N 无引号；episode 为 URL 无引号），不修既有函数。

### suggestion

- [ ] REV-007 `switchDetailSource` 无 AbortController：token 防竞态正确，但旧请求仍跑完网络。可复用 `search()` 的 AbortSignal 模式，本期不做。
- [ ] REV-008 切源目标源无剧集时除 toast 外可将目标 Tab 标 disabled，避免重复无效点击，本期不做。
- [ ] REV-009 `attrEsc` 在 `renderDetailIntoModal` 内局部定义，可提升模块级复用，本期不做。

### learning

- vod_id 清洗规则（`[\w-]`）在三条路径必须一致：卡片 onclick safeId、详情请求 id（api.js 校验）、merged_source_items 构建与 showDetails 匹配——任一处不一致即静默退化。
- 竞态令牌生命周期需覆盖"状态重置方"：不仅切源操作自增，任何重置详情状态的动作（打开新影片）也要递增，否则跨上下文串台。

### praise

- 序号令牌防竞态正确覆盖"后发覆盖前发"主场景，`hideLoading` 也被 token 守卫，避免 loading 卡死。
- 幂等处理完整：`merged_source_items` 与 `merged_sources` 均保留已有值，覆盖缓存二次调用。
- `renderDetailIntoModal` 整体重渲染正确闭合 FDR-001（切源后工具栏/剧集按钮 onclick 携带当前源参数）。
- 单源回退一致性（REV-003 修复后）与 custom_ 分支复用 showDetails 逻辑，行为统一。

## 5. Test And QA Focus

- QA 必须重点复核：
  1. **REV-001/004 回归验证**：构造特殊字符 vod_id 的多源影片（console 临时改 `window.searchResults` 某合并项顶层 vod_id 为 `"123.abc"`）→ 打开详情确认来源 Tab 出现、切源正常
  2. S6 快速连点：多源影片快速连点多个 Tab → 最终展示最后点击源的剧集、无串台、无 loading 卡死
  3. S7 倒序保留 + FDR-001：切源前开"倒序排列" → 切源 → 点剧集，`player.html` URL source/id 为当前源
  4. S3 播放走选中源：核对 URL 参数 code/vod_id 与选中源一致
  5. S9 自定义源：`custom_N` 多源切到自定义源走 `getCustomApiInfo` 分支
  6. S4/S5 回退：单源影片、旧缓存（无 `merged_source_items`）详情无 Tab、无 JS 报错
  7. S8 复制链接：切源后复制当前源剧集；S10 筛选后来源 Tab 不丢
- Evidence pack residual risks: none
- 建议新增或加强的测试：项目无自动化测试基建；建议 acceptance 手工用例覆盖上述 7 项
- 不能靠 review 完全确认的点：各源 `/api/detail` 返回 `episodes` 元素类型（字符串 vs 对象）、`videoInfo.source_name` 与 Tab name 一致性、特殊字符 id 源的真实存在性

## 6. Residual Risk

- 切源到特殊字符 id 的源时，清洗后 id 与源实际返回可能不一致 → 该源错剧/404（边缘情形，与首源卡片路径清洗规则一致，可接受；REV-008 建议未来给源失效提示）。
- 跨源 `episodes` 返回结构差异（对象数组）会致 `renderEpisodes` 输出 `[object Object]`——既有风险，非本 feature 引入，acceptance 需实测多源各试。
- 无 AbortController（REV-007）：弱网下快速切源仍有无效请求，token 已保证渲染正确性。

## 7. Verdict

- Status: passed
- Next: Standard feature → accept-inline（`cs-feat` acceptance 阶段，含 Inline Verification Matrix 按 S1-S10 + 本报告 QA Focus 核验）

## 8. Focused Closure（无则写 none）

none（本报告为 round 1 + round 2 完整独立复审合并，REV-004 修复后主 agent 本地核验收尾，未启动新 reviewer）
