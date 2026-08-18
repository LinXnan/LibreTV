---
doc_type: feature-design-review
feature: 2026-08-18-douban-hot-merge
status: passed
review_state: passed
review_reason: ""
reviewer_id: ""
reviewed: 2026-08-18
round: 2
---

# douban-hot-merge feature design 审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-merge/douban-hot-merge-design.md`
- Checklist: `.codestable/features/2026-08-18-douban-hot-merge/douban-hot-merge-checklist.yaml`
- Intent / brainstorm: none
- Roadmap: none
- Related docs: `.codestable/attention.md`（已读）、compound 检索（无相关 convention）
- Code facts checked: `js/douban.js`（743 行全文）、`js/recent-watch.js`、`js/app.js`（douban 引用点 60/738-740/844-845/912-913/957-960/1460/1486-1488/1714/2226-2264）、`js/password.js`（224-231）、`index.html`（249-260/342-394）、`css/styles.css:1316`、`css/performance-optimize.css:75`、`css/mobile-optimize.css:135/150`

### Independent Review

- Status: completed
- Detection: independent-agent（独立 Task agent）
- Provider / agent: code-explorer（round 1 + round 2）
- Raw output: 两轮独立审查摘要已回传主 agent
- Merge policy: 两轮 findings 已逐条本地事实核验后合并；round 2 为 round 1 修复后的完整复审
- Gate effect: completed，可定稿

## 2. Design Summary

- Goal: 把豆瓣热门网格区（doubanArea）合并进豆瓣热播轮播（recentWatchArea），标签系统搬进轮播区，删除网格区与 doubanToggle 开关
- Key contracts: douban.js 重构为标签+数据+搜索共享模块；recent-watch.js 统一全局状态源；`window.updateRecentWatchVisibility` 跨模块刷新契约；resetToHome 搬迁 app.js；password.js 解锁显示逻辑清理
- Steps: 5 个（静态结构 → 共享模块重构 → 状态接入 → app.js/password.js/CSS 清理 → 联调）
- Checks: 14 条（验收场景 7 + 名词契约 2 + 范围守护 5）
- Baseline / validation: read_lints（js/douban.js、js/recent-watch.js、js/app.js）+ `npm run dev` 浏览器验证 + grep 反向核对

## 3. Findings

### blocking

none

### important

- [x] FDR-001 `js/password.js:224-231` design 未覆盖 password.js 对 doubanArea/doubanEnabled/initDouban 的解锁显示依赖（round 1 发现）
  - Evidence: password.js `hidePasswordModal` 内 `doubanArea`/`doubanEnabled`/`initDouban` 引用（code facts）
  - Impact: douban.js 删除 initDouban 后 password.js:228 `typeof initDouban === 'function'` 静默失效，遗留死代码与契约混乱
  - Fix: design「明确不做」+ 名词层 + 编排层 + 挂载点 + 推进策略 + 反向核对项 + checklist 全部纳入 password.js 清理（已修复）
- [x] FDR-002 design 决策 4 的 resetToHome 搬迁会双重调用 `updateRecentWatchVisibility`（round 2 发现）
  - Evidence: app.js:743-745 `resetSearchArea` 已调 `updateRecentWatchVisibility`；design 原写 resetToHome = `resetSearchArea()` + `updateRecentWatchVisibility()`
  - Impact: 双重触发 render（幂等但多余一次 fetch 初始化）
  - Fix: resetToHome 改为只调 `resetSearchArea()`（内部已含轮播刷新）；design 决策 4 + 名词层同步（已修复）
- [x] FDR-003 checklist 反向核对漏 douban.js 删除项 `updateDoubanVisibility`/`renderDoubanMovieTvSwitch`（round 2 发现）
  - Evidence: design 2.1 声明删除此二函数，但反向核对项/checklist step2 未覆盖
  - Impact: acceptance 无法反向核对这两处删除
  - Fix: 反向核对项 + checklist step2 退出信号 + checks 同步补充（已修复）

### nit

- [x] FDR-004 checklist step1/step2 用分号连接多个子操作（如"删除 doubanArea；新增标签条容器"），非严格原子
  - 判定：同属静态结构/共享模块重构两个自然切片，独立退出信号可整体验证，接受现状不拆
- [ ] FDR-005 design 依赖 script 加载顺序（douban.js 在 recent-watch.js 之前、其 DOMContentLoaded 先注册先执行）
  - 判定：既有加载顺序（index.html:598/603），非本次引入；不改

### suggestion

- FDR-006 `node --check` 在 pwsh 带空格路径环境可能受限，design 已写"或 read_lints"替代；`npm run dev` 同理需用户在本地执行
- FDR-007 douban.js 全局函数风格（无 IIFE）既有，design 已列入超出范围观察，建议后续 cs-refactor

### learning

- 删除模块时 grep 全局引用是必须步骤：`password.js` 的隐藏依赖（doubanArea/initDouban）不 grep 无法发现
- 既有编排函数（resetSearchArea）已含的目标调用，搬迁新函数时应先读原函数体避免双重调用

### praise

- design 明确把 `fetchDoubanData`/`fillAndSearchWithDouban`/标签系统保留在 douban.js 作为共享模块，避免 recent-watch.js 膨胀
- 明确不做清单覆盖了 doubanArea/doubanToggle/换一批/fetchDoubanTags 死代码，删除范围可 grep 反向核对
- 反向核对项与 checklist 同步，acceptance 可机器核验

## 4. User Review Focus

- 用户需要重点拍板：
  1. 标签系统搬进轮播区后，默认选中「热门」标签（与现状一致）——确认无异议
  2. 删除 doubanToggle 后豆瓣轮播常驻显示（搜索/播放时隐藏）——确认无异议
  3. resetToHome 只调 resetSearchArea（内部已刷新轮播）——实现细节，无需用户拍板
- implement 需要重点遵守：5 个 steps 顺序；反向核对项 grep 全覆盖
- code review / QA / acceptance 需要重点复核：跨模块契约 window.updateRecentWatchVisibility；cache 加 tag 维度；password.js 清理后 hidePasswordModal 行为完整

## 5. Evidence Confidence Ledger

| Check | Verdict | Evidence Class | Basis | Follow-up |
|---|---|---|---|---|
| Acceptance Coverage Matrix | pass | E | S1-S7 均可由浏览器/grep 验证 | 无 |
| DoD Contract | pass | E | CMD-001~003 真实可执行（node --check 受 pwsh 路径限制，design 已给 read_lints 替代） | 无 |
| Steps and checks traceability | pass | E | 5 steps 独立退出信号；14 checks 可追溯 design 来源 | 无 |
| Roadmap contract compliance | n/a | - | 非 roadmap 起头 | 无 |
| Module interface design | pass | C | window.updateRecentWatchVisibility 既有契约复用；无新增 seam/adapter | 无 |
| Validation and artifacts | pass | E | read_lints + npm run dev + grep 反向核对 | 无 |

Summary: E=5, C=1, H=0, H-only core checks=none

## 6. Residual Risk

- 豆瓣 API/图床可用性：既有风险（上一 issue 已修 418），本次标签切换会触发更多豆瓣请求，QA 需重点验证标签路径封面无 418
- `npm run dev` 需用户本地执行（环境限制），acceptance 需用户配合浏览器验证
- 标签「管理标签」modal 的 DOM 构建代码较长（douban.js 保留段），review/QA 需确认重构后 modal 事件绑定正常

## 7. Verdict

- Status: passed
- Next: 交给用户整体 review；用户确认后进入 implementation 阶段

## 8. Focused Closure（无则写 none）

- Closed findings: FDR-001（round 1 important，password.js 覆盖）、FDR-002（round 2 important，resetToHome 双重调用）、FDR-003（round 2 important，反向核对补全）、FDR-004（nit，接受现状）
- Attributed delta: design 明确不做/名词层/编排层/挂载点/推进策略/反向核对项/决策 4 + checklist step2/step4/checks；password.js 文件范围新增
- Verification: 本地核验 password.js:224-231 引用、app.js:743-745 resetSearchArea 已调 updateRecentWatchVisibility；YAML 校验通过
- Classification: 修复为覆盖范围补齐（password.js）与编排函数调用修正（resetToHome），未改变已确认的两个用户决策与既有验收语义主体；round 2 完整复审已覆盖修复后版本
