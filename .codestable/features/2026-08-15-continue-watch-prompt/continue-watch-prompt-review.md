---
doc_type: feature-review
feature: 2026-08-15-continue-watch-prompt
status: changes-requested
reviewer: subagent
reviewed: 2026-08-15
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI not installed"
---

# continue-watch-prompt 代码审查报告

## 1. Scope And Inputs

- Design: none（Quick lane，无 design doc）
- Checklist: none
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `.codestable/features/2026-08-15-continue-watch-prompt/continue-watch-prompt-ff-note.md` + 对话实现汇报
- Diff basis: `git status --short` → 修改 `index.html`(+33)、`js/app.js`(+14)；未跟踪 `js/continue-watch.js`、`.codestable/features/2026-08-15-continue-watch-prompt/`
- Review mode: initial
- Baseline dirty files: none

### Independent Review

- Detection: 主 agent 自检——Task agent（code-explorer，只读）可用；ocr CLI 未安装
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（`where.exe ocr` 未找到）
- OCR severity mapping: 未启用
- Merge policy: 环节 A 结果经主 agent 本地事实核验后合并
- Gate effect: none（round 1 为首次审查，记录 findings 供 review-fix）

## 2. Diff Summary

- 新增：`js/continue-watch.js`（弹窗逻辑模块）
- 修改：`index.html`（设置开关 + 弹窗 DOM + script 标签）、`js/app.js`（开关初始化 + change 监听）
- 删除：none
- 未跟踪 / staged：`js/continue-watch.js`、ff-note
- 风险热点：用户可见 UI、跨模块交互（免责声明弹窗 / 密码弹窗 / 历史记录 / 播放器跳转）

## 3. Adversarial Pass

- 假设的生产 bug：首次访问场景下继续观看弹窗永远不弹出（免责声明弹窗 CSS 显示失效传导）
- 主动攻击过的反例：design 一致性、边界值（episodeIndex 0、playbackPosition 阈值）、错误路径（免责声明按钮缺失）、状态转换（waitingForDisclaimer 残留）、并发时序（passwordVerified 重放）、权限隔离（密码未验证叠加）、CSS 优先级（.hidden !important 覆盖内联 display）
- 结果：B1（CSS 覆盖传导阻断）、I1（强制密码场景叠加锁死）升级为 findings；其余进 nit/suggestion/residual-risk

## 4. Findings

### blocking

- [x] REV-001 `js/index-page.js:10` + `index.html:71` 免责声明弹窗用 `style.display='flex'` 显示，但内联 `.hidden{display:none!important}` 优先，弹窗无法显示；`js/continue-watch.js:112-127` 首次访问时把继续观看弹窗挂在 `acceptDisclaimerBtn` 的一次性 click 监听上等待接受声明，导致首次访问场景继续观看弹窗永不弹出。
  - Evidence: `index.html` 内联 `<style>` 定义 `.hidden{display:none!important}`；`#disclaimerModal` class 含 `hidden`；`performance-optimize.css` 对 `#disclaimerModal` 仅设置 `will-change`/`content-visibility`，无 display 覆盖
  - Impact: 新用户 100% 看不到继续观看弹窗，feature 对首次访问失效
  - Expected fix scope: 免责声明弹窗显示改用 classList（与 passwordModal 一致），使排队逻辑可靠
- [x] REV-002 `js/continue-watch.js` 修复后需确认 `waitingForDisclaimer` 状态机在免责声明接受后正确复位（已随 REV-001 一并核验）

### important

- [x] REV-003 `js/continue-watch.js:106` 部署未设密码（`isPasswordRequired()`）时，强制密码弹窗（z-65，`password.js:162` 隐藏取消按钮）与继续观看弹窗（z-61）叠加，界面被锁死；`requirePasswordOrPrompt({silent:true})` 在未设密码时返回 true（放行）不拦截。
  - Evidence: `password.js:53-65`、`password.js:156-159`
  - Impact: 未配置 PASSWORD 的实例上两弹窗叠加无法操作
- [ ] REV-004 `js/continue-watch.js:114` `waitingForDisclaimer` 极端时序残留风险：若接受按钮在监听绑定前被点击，标志永久置位，后续 `passwordVerified`/`showIfNeeded` 被短路不再挂监听。
  - 处置：review-fix 未采纳（once 监听已将复位放最前，`{once:true}` 保证单次执行；极端时序概率极低），移入 residual-risk

### nit

- [ ] REV-005 `js/continue-watch.js:139` `episodeIndex || 0` falsy 折叠（0 时语义正确，防未来 1-based 迁移静默偏差可改用 Number.isFinite）
- [ ] REV-006 `js/continue-watch.js:92` 内联 `onerror` 与严格 CSP 的兼容性（项目 CSP `script-src 'unsafe-inline'`，当前可用）
- [ ] REV-007 `js/continue-watch.js:17` `buildCoverUrl` 已用 `String()` 兜底非字符串，无需改

### suggestion

- [ ] REV-008 设置开关关闭不联动关闭已打开的继续观看弹窗（change 只写 localStorage）
- [ ] REV-009 点击「继续观看」后未清理 `latestItem`/`waitingForDisclaimer`，`passwordVerified` 重放可能二次弹出
- [ ] REV-010 免责声明按钮 DOM 缺失时的 fallback 直接 `openModal()` 可能叠加在不可见免责声明之上

### learning

- 项目内显隐双范式：`classList.add/remove('hidden','flex')`（可靠）vs `style.display`（被内联 `.hidden{!important}` 覆盖）；凡元素带 `.hidden` 类一律用 classList 切换
- `requirePasswordOrPrompt({silent:true})` 对「未设密码」放行、对「已设密码未验证」拦截，与 `isPasswordRequired()`（强制拦截）是两条语义，需分别处理

### praise

- `continue-watch.js` 用 classList 规避 `.hidden !important` 陷阱并注释说明
- `escapeHtml` + `encodeURIComponent` 封面/标题转义，XSS 防护到位
- `passwordVerified` 事件补弹机制正确处理「未验证不叠加、验证后补弹」时序
- `getLatestHistoryItem` 对损坏 JSON/非数组/缺字段多重兜底
- Z-index 分层清晰（disclaimer 60 < continue-watch 61 < password 65）

## 5. Test And QA Focus

- QA 必须重点复核：首次访问（无密码）接受声明后弹继续观看（REV-001 直接验证）；已设密码首次访问四层时序；未配置 PASSWORD 部署不叠加锁死（REV-003）；有/无历史、历史首条缺 url/title；设置开关默认开启/关闭后刷新；弹窗交互（继续观看续播、暂不/关闭/遮罩/Esc）；密码 TTL 过期后验证补弹
- Evidence pack residual risks / gate warnings: none
- 建议新增或加强的测试：免责声明弹窗真实可见性断言；`showIfNeeded` 状态机单测（waitingForDisclaimer 置位/复位、passwordVerified 重放）；开关默认值与 `'false'` 字符串比较；`formatPosition` 边界分支
- 不能靠 review 完全确认的点：免责声明弹窗在实际部署（含 Tailwind 加载后）的显示行为；播放器 `index` 参数与历史 `episodeIndex` 的 0/1-based 一致性；`passwordVerified` 事件是否有其他监听者改变弹窗状态

## 6. Residual Risk

- 免责声明弹窗显示依赖 CSS 层叠规则，静态分析风险高，需浏览器实测（已随 REV-001 修复）
- `playFromHistory` 的 `index=${episodeIndex}` 与历史记录 `episodeIndex` 的基于语义跨模块一致性未在本 feature 内验证
- 无自动化测试，时序/状态类逻辑回归风险集中在 REV-001/003/004 这类跨模块交互
- REV-004 waitingForDisclaimer 极端时序残留已评估为低概率，交 QA 复核

## 7. Verdict

- Status: changes-requested
- Next: 来源实现技能 review-fix（修复 REV-001/REV-003，低成本采纳 REV-009），完成后回 cs-code-review 完整独立复审

## 8. Focused Closure（无则写 none）

- none（round 1 首次审查，无 closure）

---

# Round 2（完整独立复审，review-fix 后）

## 2.1 Findings（round 2 reviewer 返回）

### blocking

- none（B1/I1/S2 修复已验证）

### important

- [x] REV-011 `js/continue-watch.js:63-68` `closeModal()` 只隐藏弹窗不清 `latestItem`，`passwordVerified` 重放（`password.js:258-273`）会重设 latestItem 并再次弹出刚被用户关闭的弹窗。
  - 处置：已修——`closeModal()` 统一 `latestItem = null` + `userDismissed = true`；`showIfNeeded` 开头跳过已主动关闭的会话（刷新后重置）
- [x] REV-012 `js/index-page.js` 免责声明弹窗（z-60）在未设密码部署仍叠加在强制密码弹窗（z-65，无关闭按钮）下锁死；continue-watch 的 `isPasswordRequired` 拦截只保护自身。
  - 处置：已修——免责声明显示增加 `isPasswordRequired()` 前置，与 continue-watch 同口径

### nit

- [x] REV-013 `js/continue-watch.js:79-80` `episodeIndex + 1` 对字符串类型历史数据拼接错误。
  - 处置：已修——`Number()` 归一化 + `Number.isFinite` 校验
- [ ] REV-014 `js/continue-watch.js:91-93` 内联 `onerror` 依赖 `script-src 'unsafe-inline'`（当前 CSP 允许，收紧后失效）——不修，记录

### suggestion

- [ ] REV-015 弹窗无 `role="dialog"`/焦点管理（与 disclaimerModal 一致，不如 passwordModal）——不修，超出最小范围
- [ ] REV-016 「接受免责声明后弹窗」与「点继续观看」未统一状态入口——不修，当前状态机正确

### learning

- `requirePasswordOrPrompt({silent:true})` 放行「未设密码」、拦截「已设密码未验证」，与 `isPasswordRequired()` 是两条语义，需分别处理
- 脚本依赖顺序正确（continue-watch.js 在 index-page.js 前，password.js/ui.js 更早），全局函数可用性无时序问题
- `hasSeenDisclaimer` 写入时序：接受声明时 index-page 监听先执行（写状态+隐藏），continue-watch once 后执行（openModal），同步 tick 内完成

### praise

- 前置检查顺序（`/watch` → isEnabled → isPasswordRequired → requirePasswordOrPrompt(silent) → latestItem → disclaimer）分层清晰，正确区分「未配密码锁死」与「密码未验证排队」
- `waitingForDisclaimer` + `{once:true}` 防重入到位；封面代理/转义与 recent-watch.js 完全一致

### residual-risk

- 「点继续观看后页面跳转延迟」窗口内 `passwordVerified` 重放仍可能复现（概率低，round 2 reviewer 标注）——userDismissed 置位后已封堵
- 无自动化测试，三层排队时序回归风险交 QA

## 2.2 Round 2 Verdict

- Status: changes-requested（REV-011/REV-012/REV-013 已修复，待 round 3 复审）
- Next: 回 cs-code-review 完整独立复审（round 3）

---

# Round 3（完整独立复审，终审）

## 3.1 Findings（round 3 reviewer 返回）

### blocking

- none

### important

- [ ] REV-017 密码已设未验证时 disclaimer（z-60）在密码弹窗（z-65）下层提前显示——既有限制，非本 feature 引入，无锁死；接受为 residual-risk
- [ ] REV-018 `userDismissed` 为会话级，同会话新增观看历史后不再提示（刷新重置）——文档化既定设计，接受为 residual-risk

### nit

- [x] REV-019 resume 透传未归一化 episodeIndex，与 openModal 显示口径不一致——已修（`Number()` 归一化复用），实际功能本就正确
- [ ] REV-020 弹窗显示中关闭开关不联动收起；本会话重新开启被 userDismissed 压制——低频 UX，记录
- [ ] REV-021 index-page.js 免责声明 DOM 无空判（DOM 恒存在，实际不触发）——记录

### suggestion

- [ ] REV-022 openModal 重复调用重渲染（幂等，视觉无感）——记录

### learning

- 多监听器编排 + once 生命周期 + 注册序依赖的协同正确案例（acceptDisclaimerBtn 双监听，目标 DOM 分离 z-61/z-60 无冲突）
- closeModal 在 resume 路径「先取 item 再清理」是防 passwordVerified 重放二次弹窗的关键模式

### praise

- userDismissed/latestItem/waitingForDisclaimer 三态职责清晰，passwordVerified 重放、接受声明时序、刷新重置三类竞态均显式覆盖
- `getLatestHistoryItem` 对畸形 JSON/非数组/null/缺字段全兜底

### residual-risk

- REV-017（disclaimer 密码下层提前显示）、REV-018（会话级 userDismissed）为已接受的既定限制，交 QA 复核
- 无自动化测试，三层排队时序依赖人工冒烟

## 3.2 Round 3 Verdict

- Status: passed（无 blocking；important 已修复或接受为 residual-risk；REV-019 已修）
- Reviewer: subagent（环节 A 完成，OCR 未安装）
- Next: 收尾提交（scoped-commit 由 review gate 发起权）→ `CS_FEATURE_QUICK_COMPLETE`
