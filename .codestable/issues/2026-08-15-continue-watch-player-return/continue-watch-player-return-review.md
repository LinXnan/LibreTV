---
doc_type: issue-review
issue: 2026-08-15-continue-watch-player-return
status: passed
reviewer: subagent
reviewed: 2026-08-15
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI not installed"
---

# continue-watch-player-return 代码审查报告

## 1. Scope And Inputs

- Design: none（issue fast-track，无 design doc）
- Checklist: none
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `.codestable/issues/2026-08-15-continue-watch-player-return/continue-watch-player-return-fix-note.md` + 对话实现汇报
- Diff basis: `git status --short` → 修改 `js/continue-watch.js`(+9)、`player.html`(+5)；未跟踪 `.codestable/issues/2026-08-15-continue-watch-player-return/`（report/approval/fix-note）
- Review mode: full-rereview（round 1 发现 F1 important 已修复，round 2 完整复审）
- Baseline dirty files: none

### Independent Review

- Detection: 主 agent 自检——Task agent（code-explorer，只读）可用；ocr CLI 未安装
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 与 round 2 各一次）
- 环节 B OCR CLI: unavailable（`where.exe ocr` 未找到）
- OCR severity mapping: 未启用
- Merge policy: 环节 A 结果经主 agent 本地事实核验后合并
- Gate effect: none（reviewer: subagent 满足 gate 要求）

## 2. Diff Summary

- 新增：none（代码层面）
- 修改：`player.html`（#homeButton 设置 sessionStorage 标记，+5）、`js/continue-watch.js`（showIfNeeded 消费标记，round1 +5 / round2 +4 try/catch 兜底）
- 删除：none
- 未跟踪：`.codestable/issues/2026-08-15-continue-watch-player-return/`（report/approval/fix-note/review）
- 风险热点：用户可见 UI、跨页面状态（sessionStorage）、时序（整页导航 vs DOMContentLoaded）

## 3. Adversarial Pass

- 假设的生产 bug：从播放页点 logo 回首页的标记在隐私模式/时序异常下失效或误伤正常弹窗
- 主动攻击过的反例：sessionStorage 不可用（隐私模式/旧浏览器）抛错中断 showIfNeeded；标记残留导致"误吞一次"直接访问弹窗；iframe 跨源隔离；removeItem 抛错残留；密码验证重放时序；免责声明 once 监听误触；多标签隔离
- 结果：F1（getItem/removeItem 无兜底，storage 受限时 showIfNeeded 整体中断）升级为 important 并在 round 2 修复；密码部署重放（R1）与 goBack 一致性缺口（S1）记录为 residual-risk / 顺手发现

## 4. Findings

### blocking

- none

### important

- [x] REV-001 `js/continue-watch.js:130-131`（round 1）`getItem`/`removeItem` 无 try/catch，与 `player.html:266-268` 的 setItem 兜底不对称；sessionStorage 受限环境（隐私模式/旧浏览器属性访问抛 SecurityError）下 `showIfNeeded` 最前端抛错，后续 isEnabled/userDismissed/密码/免责声明排队全部失效，直接访问首页也不弹。
  - Evidence: `player.html` setItem 有 try/catch 注释"storage 不可用时忽略"；continue-watch.js 裸调用
  - Impact: 隐私模式下比修复前更糟（整体中断）
  - 处置：round 2 已修复——try 块精准包住两条 storage 操作，catch 按"无标记"fall-through 正常弹窗逻辑；与 setItem 兜底对称
- [ ] REV-002（round 2 residual，范围外）密码保护部署下 `passwordVerified` 重放：DOMContentLoaded 首调消费标记 return → 密码弹窗 → 用户验证通过 → `passwordVerified` 事件（continue-watch.js:204）重放 showIfNeeded → 标记已删、userDismissed 为 false → 仍弹继续观看。
  - Evidence: `password.js:265` dispatch passwordVerified；continue-watch.js:204 监听重放
  - Impact: 仅密码部署（PASSWORD 已配置）部分失效，默认部署不受影响；reviewer 标注"非必须、低优先级"
  - 处置：**接受为 residual-risk**——超出本次 issue 范围（用户问题限定"从播放页点 logo 回首页"），不扩范围改代码，交 QA 复核

### nit

- [ ] REV-003 `js/continue-watch.js:132-137` 极端 edge：getItem 返回 '1' 后 removeItem 抛错 → 本次不跳过且标记残留到下次加载漏弹一次。极低概率（能 getItem 通常能 removeItem），可忽略。
- [ ] REV-004 `player.html:283` 内层缩进错位（纯风格，lint 0 诊断，无功能影响）

### suggestion

- [ ] REV-005 范围外一致性缺口：`player.js:48-50` `goBack`（上一页）无 referrer 时 `window.location.href='/'` 回首页，未设标记 → 从播放页点「上一页」回首页仍弹。原始 issue 明确限定 #homeButton/logo，属范围外。已记顺手发现。

### learning

- storage 读写兜底应对称：写入防错、读取裸奔是典型不对称陷阱（F1 教训）
- 标记消费放 showIfNeeded 最前端（先于 isEnabled/userDismissed/密码/免责声明排队）是正确的"来源优先"语义设计

### praise

- F1 修复范围精准：try/catch 只包两条目标操作，catch 不 rethrow、fall-through 正常逻辑，与 setItem 兜底完全对称
- 时序无竞态：setItem 与整页导航/iframe 父窗跳转在同一同步调用链，DOMContentLoaded 一定晚于标记写入
- 标记用后即删语义清晰：直接访问/刷新首页不受影响
- 改动严格限定批准方案（player.html + continue-watch.js 两处），无范围外改动

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 主路径：首页→播放页→点 logo→回首页不弹；再次刷新首页恢复弹窗
  2. 直接访问回归：无标记直开首页照常弹（含免责声明首次访问排队）
  3. iframe 路径：首页以 iframe 开播放页→点 logo→父窗回首页不弹
  4. 密码部署（REV-002）：设 PASSWORD 后 logo 返回→输密码通过→观察继续观看是否复现
  5. 无痕/隐私模式（REV-001 修复验证）：不因 storage 异常中断 showIfNeeded
  6. 多标签隔离：A 标签播放页返回本标签生效，B 标签不受影响
  7. 范围缺口（REV-005）：播放页点「上一页」回首页观察是否弹（记录一致性差异）
- Evidence pack residual risks / gate warnings: none
- 建议新增或加强的测试：无自动化测试，建议在 fix-note 保留手动回归清单（1/2/3）
- 不能靠 review 完全确认的点：iframe 运行时同源关系与 sessionStorage 共享（代码静态推断成立）；密码部署重放概率（REV-002）

## 6. Residual Risk

- REV-002 密码部署下 passwordVerified 重放仍弹（重要级残余，交 QA 复核；默认部署不受影响）
- 标记残留漏弹一次（低概率，无实际危害）
- iframe 若未来引入跨域/ sandbox 将导致标记失效（当前同源成立，仅记录边界）

## 7. Verdict

- Status: passed（无 blocking；REV-001 important 已修复；REV-002 已接受为 residual-risk 交 QA）
- Next: 按进入来源表 → issue-fix 收尾提交（scoped-commit 由 review gate 发起权）

## 8. Focused Closure（无则写 none）

- none（round 2 为完整独立复审，非 closure）
