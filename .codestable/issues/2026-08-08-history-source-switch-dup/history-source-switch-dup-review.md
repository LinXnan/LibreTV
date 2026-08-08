---
doc_type: issue-review
issue: 2026-08-08-history-source-switch-dup
status: passed
reviewer: subagent
reviewed: 2026-08-08
round: 4
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: ocr CLI 未安装
---

# history-source-switch-dup 代码审查报告

## 1. Scope And Inputs

- Issue report: `.codestable/issues/2026-08-08-history-source-switch-dup/history-source-switch-dup-report.md`（confirmed / fast-track）
- Fix note: `.codestable/issues/2026-08-08-history-source-switch-dup/history-source-switch-dup-fix-note.md`
- Approval: `.codestable/issues/2026-08-08-history-source-switch-dup/approval-report.md#issue-fast-path`（approved）
- Implementation evidence: 对话内实现汇报（fix 阶段）
- Diff basis: `git diff js/player.js`（3 处改动，均在 `saveToHistory()`）
- Review mode: initial
- Baseline dirty files: `.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`（既有 untracked，非本轮归因）

### Independent Review

- Detection: 主 agent 自检——Task agent 可用（code-explorer）；ocr CLI 不可用
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（`Get-Command ocr` 无结果，未安装）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 环节 A 结果已逐条本地事实核验后合并
- Gate effect: 环节 A 已返回，可定稿；`reviewer: subagent` 满足 gate 默认要求

## 2. Diff Summary

- 新增：无（.codestable 产物不计入代码 diff）
- 修改：`js/player.js`（`saveToHistory()`：uniqueKey 构造、Map 查找键、更新分支补 showIdentifier 同步）
- 删除：无
- 未跟踪 / staged：`js/player.js` 已跟踪修改；`.codestable/issues/2026-08-08-history-source-switch-dup/` 未跟踪
- 风险热点：localStorage 持久化（历史数据兼容）、去重键语义、跨函数匹配口径

## 3. Adversarial Pass

- 假设的生产 bug：去重键在切源 / 切集 / 无 id / 同名不同视频边界下产生错误合并或漏合并。
- 主动攻击过的反例：跨源片名不一致、无 id 同名不同视频、两源集数相同但内容不同、历史旧记录字段缺失、切源后播放速度恢复与从历史播放路径。
- 结果：3 项升级为 important（REV-001/002/003），2 项 suggestion（S-1/S-2），1 项 residual-risk（R-1）。

## 4. Findings

### blocking

none

### important

- [ ] REV-001 `js/player.js:1472` 切源后标题变化导致去重键仍不命中，重复记录依旧产生
  - Evidence: `switchToResource`（js/player.js:2223）执行 `currentVideoTitle = data.vod_name || currentVideoTitle`；不同源对同一 vod_id 返回的片名格式常不一致。新键 `${title}_${id}` 依赖 title 稳定，title 变化则键变化，走新增分支。
  - Impact: 修复核心承诺"切源不再新增重复记录"在跨源片名不一致场景失效。
- [ ] REV-002 `js/player.js:1472/1498` 无 id 场景由"可区分"退化为"必合并"，引入错误合并回归
  - Evidence: 无 id 时键退化为 `${title}_`；旧键含 sourceName+showIdentifier（无 id 时 showIdentifier 为当前剧集/URL）具备区分能力。同名不同视频（无 id）将被错误合并，`existingItem.url` 被覆盖导致其中一条记录丢失。
  - Impact: 本次改动新引入的回归，比修复目标更严重（记录丢失）。
- [ ] REV-003 `js/player.js:1520-1526` 切源后 episodes 集数列表可能因长度相同而不更新，记录"指向新源"但集数列表仍旧源
  - Evidence: episodes 仅在 `length !==` 时替换；两源集数相同但顺序/内容不同（常见）时保留旧源列表，而 url/sourceName 已指向新源，`playFromHistory`（ui.js:827-828）会以陈旧集数兜底。
  - Impact: 与"切源更新原记录指向新源"目标半冲突，记录处于半新半旧状态。

### nit

- [ ] REV-004 `js/player.js:1514` update 分支进度明显倒回时保留旧值（既有行为，非本次引入；QA 需知悉）
- [ ] REV-005 `js/player.js:1442-1443` sourceName 与 sourceCode 都取 `source` 参数（既有问题，非本次引入）

### suggestion

- [ ] REV-006 存量重复数据不做清理：Map.set 同键多条时仅最后一条被更新前移，其余旧重复残留，可在命中时顺带过滤同键其余记录
- [ ] REV-007 去重逻辑三处口径不一致：`saveToHistory`（title+vod_id）与 `addToViewingHistory`（ui.js:989-993，title+sourceName+showIdentifier）、`playFromHistory`（item.url）语义分叉，建议收敛或至少在 fix-note 说明取舍

### learning

- localStorage 读-改-写均在同步调用栈内（JS 单线程），无并发竞争；多标签页 last-write-wins 属既有架构限制。
- 去重键稳定性取决于"身份"字段是否跨上下文不变；身份键应优先用不可变业务 id，title 仅作展示。

### praise

- 根因定位准确：`showIdentifier` 本身已含 sourceName（`getShowIdentifier` 107-109），旧键冗余且切源必变。
- 补 `existingItem.showIdentifier` 同步保障了播放速度恢复/更新（936-944、1011-1015）匹配链不失效，体现对周边依赖的考虑。
- 变更收敛在单函数，符合 fast-path 约束。

## 5. Test And QA Focus

- 必须重点复核：跨源片名不一致切源；无 id 同名不同视频是否误合并；两源集数相同但顺序不同切源后集数列表；切源后播放速度恢复；切集只更新不新增；从历史点击跳转新源正确性。
- 建议验证点：每次操作后检查 `localStorage['viewingHistory']` 条目数、sourceName、showIdentifier、vod_id、episodes、url 字段。
- 建议新增或加强的测试：无自动化测试；建议至少补键匹配逻辑的单元级脚本验证（切源/无 id/同名不同视频）。
- 不能靠 review 完全确认的点：真实数据源 `vod_name` 稳定度、无 id 入口在真实 UI 流中的出现概率、历史旧数据字段完整度分布。

## 6. Residual Risk

- R-1 跨源片名不一致导致修复失效（REV-001 修复后仍需真机多源实测确认触发频率）。
- R-2 历史旧记录无 `vod_id` 时首次切源可能并存一条旧数据（已承认，靠后续更新收敛）。
- R-3 `playFromHistory`（ui.js:821）用 url 精确匹配，切源更新会改写 `item.url`，QA 需确认切源后从历史点击正确命中。

## 7. Verdict

- Status: changes-requested
- Next: 回 `cs-issue` fix 阶段执行 review-fix，修复 REV-001/002/003；REV-004/005 记录为既有问题不修；完成后回到 code review 复审。

## 8. Focused Closure（无则写 none）

none

---

# 复审轮次结论（round 2-4）

## Round 2（完整复审，因 review-fix 改变去重键语义）

独立 Task agent 复审发现：

- **IMP-1（关键）**：`vod_id` 是源相关的——`switchToResource` 传入目标源自己的 `vod_id`（js/player.js:2126）并替换 URL `id`（2248），跨源必变。v1 的 `id:${id}` 键无法跨源去重，方案作废。已本地核验属实（读 `resourceCardHTML`/`switchToResource`/`searchByAPIAndKeyWord` 确认各源独立 id 体系）。
- IMP-2（无 id 场景合并回归）：经核验，`saveToHistory` 的 guard 保证 `currentEpisodes` 非空，`getShowIdentifier` 不会回退到 URL 分支，该场景在写入路径不成立，已排除。
- NIT：update 分支不同步 title（旧标题+新 url 半旧状态）→ 已在 v2 修复。
- Suggestion：速度恢复 3 秒时序窗口、死代码 `addToViewingHistory` 口径分叉 → 记录为 QA 关注项。

v1 方案作废，修订为 v2（规范化片名键 + 字段全同步 + 自愈去重）。

## Round 3（完整复审，v2 为实质行为变化）

独立 Task agent 复审发现 3 个 important：

- **REV-301 同名不同剧合并**：title 键把所有同 title 视为同一视频。经判定这是"切源/切集更新原记录"产品诉求的固有语义（title 无法区分版本），且"vod_id 相同才合并"的替代建议与切源去重目标冲突（切源时 vod_id 必变），故不接受为代码修改，列为产品边界 + 验收标记项。
- **REV-302 空 title 空键合并**：已修——空 title 不进 Map、uniqueKey 为空时不合并直接新增。
- **REV-303 自愈保留最后一条非最新**：已修——Map 构建保留 timestamp 最新一条。

## Round 4（最终门禁复审）

独立 Task agent 最终复审结论：

- **blocking：无**。核心目标（同 title 跨源/切集更新原记录、不新增重复）逻辑正确达成；自愈去重"保留 timestamp 最新 + 清理同 title 残留"设计正确；更新分支字段同步完整，不破坏播放速度恢复/更新、flushProgressQueue 等匹配链；无 lint 错误。
- important（均为固有边界/验证项，非代码缺陷）：同名不同剧合并（产品语义，验收标记）；跨源片名不一致仍可能新增（数据限制，真机验证）。
- 建议验收单明确标记"同名不同剧"与"跨源片名不一致"两个场景的验证结果。

## 最终 Verdict

- Status: passed
- reviewer: subagent（环节 A 四轮独立审查完成；环节 B OCR 不可用）
- Next: 修复验证已完成，`{slug}-fix-note.md` 已落盘；待用户浏览器验证后收尾（是否 commit 由用户决定）。
