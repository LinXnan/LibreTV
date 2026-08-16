---
doc_type: feature-review
feature: 2026-08-16-remove-quality-degrade
status: passed
reviewer: subagent
reviewed: 2026-08-16
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装"
---

# remove-quality-degrade 代码审查报告

## 1. Scope And Inputs

- Design: none（fastforward 通道，无 design doc）
- Checklist: none（fastforward 通道）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `js/player.js` 工作区 diff（两阶段：删智能降级 + 锁定最高画质）+ `remove-quality-degrade-ff-note.md`
- Diff basis: `git diff js/player.js`（未提交工作区改动，12 insertions / 110 deletions）
- Review mode: full-rereview（round 2，因新增锁定最高画质属行为变更）
- Baseline dirty files: `.codestable/features/2026-08-15-intro-outro-skip/`（会话开始前已存在，无关本次改动）

### Independent Review

- Detection: 独立 Task agent 可用（code-explorer 只读 agent）；`ocr llm test` 失败（CLI 未安装）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 2 独立 reviewer）
- 环节 B OCR CLI: unavailable（`ocr: The term 'ocr' is not recognized`）
- OCR severity mapping: 未启用（CLI 不可用）
- Merge policy: 环节 A findings 已逐条本地核验后合并
- Gate effect: 环节 A completed，可定稿 verdict；OCR 为可选环节不阻塞

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-16-remove-quality-degrade/`（ff-note + 本报告）
- 修改：`js/player.js`（删除智能降级 ~100 行；hlsConfig 删除 ABR 配置；MANIFEST_PARSED 新增锁定最高画质逻辑）
- 删除：优化11"智能画质调整"代码块、`qualityHandlers` 全局引用、悬空 FRAG_LOADING 注释、ABR 配置 4 项
- 未跟踪 / staged：无
- 风险热点：播放行为变更（禁用 ABR 自动降码率）、无权限/数据/并发/API 风险

## 3. Adversarial Pass

- 假设的生产 bug：锁定逻辑锁错档位（levels 排序假设）、起播窗口 ABR 降码率、切集/切源后跨流串档、残留引用导致 ReferenceError
- 主动攻击过的反例（round 2 reviewer）：`currentLevel` 锁定语义（hls.js 非 -1 即手动模式，禁用 ABR——确认正确）；levels 排序假设（`startLevel: 0` 不保证 index 0 是最高档——**确认有隐患**）；bitrate 缺失/undefined 兜底（`|| 0` 足够，hls.js 保证 number）；切集/切源生命周期（customType.m3u8 每次 destroy 重建、新实例 fresh manualLevel=-1，无串档）；单 level/live 流（守卫安全）；ABR 配置删除（锁死后失效，删除后 hls.js 用默认值无副作用）
- 结果：1 个 important（startLevel 语义）已修复；其余为 nit/suggestion/residual-risk

## 4. Findings

### blocking

none

### important

- [x] REV-101 `js/player.js:542` `startLevel: 0` 不保证"从最高档起播"，注释语义有误
  - Evidence: hls.js 中 `startLevel` 是明确 level index，levels 数组排序不保证（源站 manifest 顺序，常见降序但非标准）；`startLevel: 0` 实为 index 0 档位，若源按码率升序排列则首帧以最低档起播，产生首屏低清闪烁
  - Impact: 与"从最高档起播"意图不符，且起播窗口内 ABR 短暂启用（严格性缺陷）
  - 处理：按 round 2 reviewer 建议修复为 `startLevel: -1`（ABR 起播选带宽支持的最高档，MANIFEST_PARSED 后立即锁定），注释同步修正；`node --check` 通过

### nit

- [ ] REV-102 `js/player.js:713` `(hls.levels[i].bitrate || 0)` 兜底对 string/NaN 不彻底
  - Evidence: hls.js 从 BANDWIDTH 解析的 bitrate 保证为 number，`|| 0` 对 undefined/0/NaN 均正确兜底；仅当出现 string（hls.js 不会产生）时字典序比较会错
  - Impact: 当前场景安全，无需改动

### suggestion

- [ ] REV-103 弱网锁定最高画质的体验缓解：可在 `video:waiting` / ERROR `bufferStalledError` 时放宽 `maxBufferLength` 或提示切源，而非恢复 ABR 降码率（会违背需求）

### learning

- hls.js `hls.currentLevel = N`（N≥0）setter 设置 `manualLevel = N` 并清除 `autoLevelCapping`，ABR 不再自动切换；设 -1 恢复自动。`player.js:717` 用法正确达成"手动模式禁用 ABR"目标
- 删除 ABR 配置后 hls.js 用默认值（abrEwmaDefaultEstimate 默认 5e5、abrBandWidthFactor 0.95 等），但锁手动模式后这些参数不再生效，无副作用

### praise

- 锁定逻辑按 bitrate 遍历找最大值，独立于 levels 排序，覆盖源站排序不确定场景
- 切集/切源生命周期正确：customType.m3u8 每次 destroy 旧 currentHls 并新建，锁定逻辑每次重新执行，无跨流串档风险
- ABR 配置删除干净彻底，grep 验证全项目 0 残留；重试配置（fragLoadingMaxRetry 等）保留合理，与画质降级无关

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 多码率源（3+ 档位）：控制台确认 `hls.currentLevel` 在 MANIFEST_PARSED 后锁定为 bitrate 最高档 index，且人为限速下不再变化
  2. 首帧档位观察：验证 levels 升序排列的源首帧无低清闪烁（修复 startLevel 后 ABR 起播应直接选最高可支持档）
  3. 切集/切源：新 Hls 实例重新锁定、旧实例 destroy、无跨流沿用旧 index
  4. 弱网行为：限速后播放转圈/卡顿但 `currentLevel` 保持最高档（符合需求预期，不自动降码率）
  5. 单 level 流 / live 流：单档不锁定且正常播放；live 流锁定最高档无异常
- 建议新增或加强的测试：none（项目无测试框架）
- 不能靠 review 完全确认的点：hls.js 库实际版本（design 记录 1.6.2，minified 文件无法静态核验）、真实网络环境播放体验、各浏览器分支行为

## 6. Residual Risk

- `startLevel: -1` 起播档位由 ABR 依据带宽估计选择，极端弱网下起播可能选低档，MANIFEST_PARSED 后立即切至最高档（此行为属预期，QA 弱网场景确认）
- `libs/hls.min.js` 实际版本未能静态核验（超大单行压缩文件，rg 检索不稳定）
- 无自动化测试覆盖，播放体验需人工目视验证（项目既有约束）

## 7. Verdict

- Status: passed
- Next: 按 fastforward 进入收尾提交（scoped-commit，等待用户确认是否代为 commit）

## 8. Focused Closure

- Closed findings: REV-101（startLevel 语义）
- Attributed delta: `js/player.js:542` `startLevel: 0` → `startLevel: -1` + 注释修正（单行）
- Targeted verification: `node --check js/player.js` 通过；IDE 语言服务 0 诊断；grep `startLevel` 仅 1 处
- Classification: 修复严格按 round 2 独立 reviewer 给出的建议边界执行（"改用 `startLevel: -1`"），将行为回退至 hls.js 默认值（round 1 已审基线），并消除"起播档位不确定 + 首帧低清闪烁"隐患；最终行为契约不变（MANIFEST_PARSED 锁定最高画质，禁用 ABR 自动降码率），未改变公开契约/安全/数据/并发/架构
