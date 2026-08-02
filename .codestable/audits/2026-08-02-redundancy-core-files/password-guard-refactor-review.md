---
doc_type: refactor-review
slug: 2026-08-02-redundancy-core-files
status: passed
reviewer: subagent
reviewed: 2026-08-02
round: 2
lane_a_state: completed
lane_a_ref: ab89a3c2b573ede47
lane_a_reason: round-2 完整复审已完成（review-fix 修了 api.js 生产行为，按 protocol 走完整独立复审而非 focused closure）
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: ocr CLI 未安装，按 protocol 记 not-available，不阻塞本轮
---

# 密码守卫去冗余 refactor 代码审查报告

## 1. Scope And Inputs

- 来源：ad-hoc（用户直接要求审查本轮 refactor diff，无定稿 spec 产物；audit 依据为 `.codestable/audits/2026-08-02-redundancy-core-files/finding-01.md` + `finding-02.md`）
- 实现证据：本会话内已完成实施，对应 plan 文件 `C:\Users\linxunan\.claude\plans\mutable-beaming-moon.md`
- Diff basis：`git diff`（unstaged）覆盖 `js/password.js`(+15) / `js/ui.js`(-55/+4) / `js/app.js`(-12/+2) / `js/api.js`(-5/+2)，净 -67/+23
- Review mode: initial
- Baseline dirty files：`.codestable/audits/...`（本轮 audit 产物，非代码）+ `.idea/`/`LibreTV.iml`/`browser_check.html`/`node_modules/`/`nul`（无关未跟踪，不在审查范围）

### Independent Review

- Detection：主 agent 自检——Task agent（Agent 工具）可用；`ocr` CLI 不可用（`which ocr` 空）。
- 环节 A 独立隔离 Task agent：`independent-agent`，`completed`（run ref `a3e29dddad7d86e27`，general-purpose subagent，已返回并经本地逐条核验）。
- 环节 B OCR CLI：`unavailable`（not-available，不阻塞）。
- OCR severity mapping：N/A（环节 B 未启用）。
- Merge policy：环节 A 7 条结论逐条本地核验——1 条确认为 blocking、1 条重要、1 条 residual、3 条 nit/suggestion、1 条**驳回**（见 4.findings）；环节 B 无。
- Gate effect：环节 A 已完成可放行最终判定；环节 B 不阻塞。

## 2. Diff Summary

- 新增：无（`requirePasswordOrPrompt` 内联于 `password.js`）
- 修改：`js/password.js`（新增 helper + 导出）、`js/ui.js`（4 守卫替换 + 删 dead override）、`js/app.js`（2 守卫替换，`search` 未动）、`js/api.js`（fetch 守卫替换）
- 删除：`js/ui.js` 原 1111-1124 的 `toggleSettings` dead override 块
- 未跟踪 / staged：无 staged；untracked 见 baseline
- 风险热点：权限/安全（密码守卫语义）、全局函数加载顺序假设、async fetch 边界行为

## 3. Adversarial Pass

- 假设的生产 bug：新 helper 在 api.js fetch 拦截处引入了原守卫没有的副作用（弹密码框）。
- 主动攻击过的反例：design 一致性（helper 语义 vs 原 inline 模板逐字节等价承诺）、错误路径（未设密码 / 未验证 / 已验证三态）、加载顺序时序、副作用（`showPasswordModal` 在 fetch 路径的调用）、死代码删除影响面。
- 结果：升级为 blocking 1 条（api.js 副本变更）、important 1 条（函数存在性兜底缺失）；驳回 reviewer 的“ui.js 守卫加载期被绕过”claim（见 4）；其余留为 residual-risk / nit。

## 4. Findings

### blocking

- [ ] **REV-001** `js/api.js:628`（新）相对原 `js/api.js:627-632`（已删）—— **行为变更：新守卫弹密码框，原守卫静默 return**
  - Evidence：`git diff js/api.js` 显示原守卫为
    ```js
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            return;   // 静默 return，不调用 showPasswordModal
        }
    }
    ```
    新守卫 `if (!window.requirePasswordOrPrompt()) return;` 中 `requirePasswordOrPrompt()` 在未验证时**先 `showPasswordModal()` 再 return false**。原 `/api/` fetch 拦截在未验证时**只 return undefined 不弹框**。
  - Impact：未验证用户的 `/api/` fetch（如 `testSiteAvailability` 调 `/api/search?wd=test`，见 `js/api.js:658`；或详情请求 `js/app.js:988`、`js/player.js:1894/2126`、`js/ui.js:845`）现在会弹出密码框；原行为是静默丢弃（返回 undefined，下游 `response.json()` 会抛——已是旧 bug，但**表现不同**：无 modal vs 有 modal）。多个并发 fetch 还可能连弹多个框。这违反 plan 明确承诺的“保留未验证返回 undefined 这一既有行为”。
  - Expected fix scope：api.js 的 fetch 守卫需保留“未验证静默 return、不弹框”语义。建议给 helper 增加静默选项（如 `requirePasswordOrPrompt({ silent: true })` 或新增 `isPasswordVerifiedOrBlocked()` 只返回 boolean 不弹框），由 api.js 调用静默变体，其余 6 处保持弹框变体不变。仅为这一处寻找最小等价。

### important

- [ ] **REV-002** `js/password.js:46` 新 helper 丢弃了原 inline 守卫的“函数存在性兜底”
  - Evidence：原 6 处模板外层 `if (window.isPasswordProtected && window.isPasswordVerified)` 在调用前先确认函数存在。新 helper 直接调用 `isPasswordProtected()` / `isPasswordVerified()`，若 password.js 未加载会 `isPasswordProtected is not a function` 抛错（未被 try/catch 包裹→事件处理器报错）。
  - Impact：当前无 live 触发（所有守卫在事件期执行，事件必发生在 DOMContentLoaded 后，password.js 必已加载；且 ui.js 的 `addToViewingHistory` 全仓无调用方）。但这是相对原代码的“脆弱性回退”——原代码在 password.js 未就绪时会 no-op 放行（等价于已验证），新代码会抛。属潜在回归。
  - Expected fix scope：考虑在 helper 内或调用方对 `typeof isPasswordProtected === 'function'` 做兜底（若不存在则返回 true 放行，匹配原 fallback 语义）。为 residual-risk 占位，是否修由实现者判断。

### nit

- [ ] **REV-003** `js/app.js`/`js/password.js` 两套密码守卫风格并存
  - Evidence：`search` 保留 `ensurePasswordProtection`+try/catch（throw 语义），其余 6 处用 `requirePasswordOrPrompt`（布尔语义）。两种“未设密码”行为不同（search 拦下，其余放行）。
  - Impact：维护心智负担。本属 plan 内的有意决策（避免改 search 引入行为变更），记录为 learning 而非必改。

### suggestion

- [ ] **REV-004** 加载顺序假设脆弱（见 Residual Risk）：无模块系统下“password.js 先于守卫调用”是隐式契约。可在 helper 顶部加 `typeof window.isPasswordProtected !== 'function'` 兜底，兼顾 REV-002。

### learning

- `defer` 脚本的函数定义在加载期完成，但函数体在事件期执行——DOMContentLoaded 后所有 defer 脚本已跑完。故“ui.js 早于 password.js 加载”不等于“ui.js 的事件期守卫早于 password.js 执行”。reviewer 的 Claim 1 混淆了二者。

### praise

- 锁死 `search` 边界（不换 helper）这一决定正确——避免了一次“未设密码时搜索从被拦截变为放行”的行为变更。
- 死代码删除面收敛、归因清晰（grep 证明 ui.js 的 `toggleSettings` dead override 与 `addToViewingHistory` 无 live 调用方）。

## 5. Test And QA Focus

- **QA 必须重点复核**：
  1. 首页未验证态点 settings/history/clearSearchHistory/search/detail/play：行为应与改前一致（settings 仍直接开，因 app.js:536 无守卫系既有缺口）。
  2. **api.js `/api/` fetch 在未验证态下的表现**：修复 REV-001 后必须仍是“静默返回、不弹框”。
  3. player.html 加载与切集不受影响。
  4. 多并发 fetch 不连弹密码框。
- 建议新增/加强测试：项目无自动化测试；手工覆盖即可。
- 不能靠 review 完全确认的点：未设密码场景的各入口实际跑通行为（QA 手验）。

## 6. Residual Risk

- **加载顺序隐式契约**：repository 无模块系统，守卫依赖 password.js 已加载。证据显示当前安全（事件期调用、password.js 经 defer 最早-ish 加载且在 DOMContentLoaded 前完成），但无显式契约保护。应由 QA 复核两页无控制台 “requirePasswordOrPrompt is not a function” 或 “isPasswordProtected is not a function” 报错。
- **既有缺口（不在本次范围）**：`app.js:536 toggleSettings` 无密码守卫；`clearViewingHistory()`（ui.js ~1070）无密码守卫；`api.js` fetch 未验证返回 undefined 本身是旧 bug（REV-001 修复只恢复“不弹框”，undefined 返回行为遗留）。三者均建议另开 cs-issue。

## 7. Verdict

- Status: **passed**（round 2，邻近 reviewer `ab89a3c2b573ede47` 已逐条核验 REV-001/REV-002 修复；stage A gate 通过；stage B OCR 不可用不阻塞）
- Next: 本 refactor 来源为 audit 驱动的 ad-hoc refactor，无下游 spec 阶段。通过后可进入提交收尾——建议本地 `npm run dev` 跑一遍报告「5. Test And QA Focus」的手工场景确认，再 commit。audit 的 finding-01 / finding-02 可在 index.md 标记为已处置。

## 8. Focused Closure

- Closed findings: REV-001（api.js 行为变更→已恢复静默守卫）、REV-002（函数存在性兜底已加；复核后兼及调用点加载假设属 residual-risk）
- Attributed delta（review-fix 增量，round 2 复审对象）：
  - `js/password.js` `requirePasswordOrPrompt` 增加 `options.silent` 与 `typeof ... !== 'function'` 兜底
  - `js/api.js` fetch 守卫改用 `{ silent: true }`
  - 其余 6 处弹框调用点未动
- Targeted verification:
  - `node --check js/password.js` + `node --check js/api.js` 均 OK
  - 四场景逐一对照 api.js 原守卫与新 silent 变体，等价（见 reviewer round-2 表）
  - `git diff` 确认 6 处弹框变体仍无参数调用，未改
- Classification: round-2 为**完整独立复审**（非 focused closure 的窄条件——review-fix 修了生产行为，按 protocol 必须新 reviewer 复核），故 round 自 1 增至 2，复用 round-1 reviewer 的非修复部分判断基础 + round-2 reviewer 对修复 diff 的独立核验。两项 finding 均以 reviewer 逐场景核验 + 主 agent 本地补验为依据闭合。

## 9. Round-2 Reviewer 补充（已本地核验的取舍）

- REVIEWER 建议 helper 内改用 `window.isPasswordProtected` 检查——**未采纳**：helper 能被调用即证明 password.js 已加载，闭包变量 `isPasswordProtected` 必已定义，该 typeof 检查实为文档性兜底；改成 `window.` 检查同样救不了”password.js 整体未加载导致 `window.requirePasswordOrPrompt` 未定义、调用点抛 TypeError”这一真正的加载缺失场景。该场景触发概率≈0（所有守卫在事件期、password.js 经 defer 先于事件加载），统一并入 residual-risk。
- nit：`{ silently: true }` 拼写错误会被静默吞为默认弹框——可接受，不修。
