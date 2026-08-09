---
doc_type: issue-review
issue: 2026-08-09-player-toast-above-player
status: passed
reviewer: subagent
reviewed: 2026-08-09
round: 6
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: ocr CLI not available
---

# 播放页提示框未在播放器上方居中 代码审查报告

## 1. Scope And Inputs

- Design: `issues/2026-08-09-player-toast-above-player/player-toast-above-player-report.md`（`status: confirmed`、`issue_path: fast-track`）
- Checklist: none（issue fast-track 无 checklist）
- Approval: `approval-report.md#issue-fast-path` approved（已批准修复方案；第二波范围扩大已由 owner 反馈驱动，见 fix-note）
- Implementation evidence: fix-note（含两波改动 + code review B-1 / 移动端避让修复说明）
- Diff basis: `git status` / `git diff` — 改动文件 `css/player.css`、`player.html`、`js/ui.js`
- Review mode: full-rereview（round 1 初始 → review-fix → round 2 复审 → 第二波 Material 变更 round 3 复审 → 移动端避让 review-fix → round 4 复审 → 第三波"通知重叠" Material 变更 round 5 复审 → 两个 important review-fix → round 6 复审）

### Independent Review

- Detection: 主 agent 自检 — 独立 Task agent 可用；`ocr` CLI 不可用（未安装）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1/2/3/4/5/6 各一次）
- 环节 B OCR CLI: unavailable（`ocr` 未安装，属可选环节不阻塞）
- OCR severity mapping: 不适用（环节 B 未运行）
- Merge policy: 四轮 Task agent 结果均已逐条本地仓库事实核验后合并
- Gate effect: 环节 A 完成，gate 放行（reviewer=subagent）

## 2. Diff Summary

- 新增：none
- 修改：`css/player.css`、`player.html`、`js/ui.js`
- 删除：none
- 未跟踪 / staged：`.codestable/issues/2026-08-09-player-toast-above-player/`（issue 产物，非代码）；其余（`.commit_msg_tmp.txt`、`.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`）为既有 baseline，与本 issue 无关
- 风险热点：UI（CSS 定位 / 层叠 / 加载顺序 / 移动端 header 高度）

## 3. Adversarial Pass

- 假设的生产 bug：提示框"播放器上方居中"修复在移动端被固定 header 遮挡，或在桌面分栏时仍不对齐播放器中心。
- 主动攻击过的反例：header 遮挡回归（z-index 2147483647 / 9000 与纵向避让）、Tailwind `top-4` 工具类 vs `body #toast` 层叠、同页后加载样式文件对 `#toast` 的抢占（B-1）、JS 内联 `style.transform` 与 `top` 耦合、`.position-restore-hint`/`#toast`/`#shortcutHint` 挂载锚点是否为 `#playerContainer`、containing block（`#playerContainer` transform/overflow）、全屏场景、z-index、桌面分栏水平居中（视口中心 vs 播放器中心）、移动端 header 高度（78px）与容器顶部（60px+safe）落差。
- 结果：B-1（round 1 blocking，移动端 `#toast` 被后加载样式覆盖）与移动端 header 遮挡（round 3 blocking）均已修复并经后续 round 核验关闭；其余为 nit/suggestion/residual-risk。

## 4. Findings

### blocking

- [x] REV-001 `css/player.css` 移动端 `#toast` 覆盖被后加载文件覆盖而失效（round 1 发现，round 2 修复确认）
  - Evidence: `player.html` 加载顺序 `styles.css → player.css → mobile-optimize.css → performance-optimize.css`；`css/mobile-optimize.css:319-325` 对 `#toast` 定义 `top: max(1rem, env(safe-area-inset-top)) !important`，与原规则同 id + `!important`，后加载者胜出。
  - Impact: 移动端 Toast 修复失效。
  - 修复: 选择器提升为 `body #toast`（特异性 1 id + 1 element 高于 `#toast` 1 id，与加载顺序无关）。

- [x] REV-005 移动端提示被固定 header 遮挡（round 3 发现，round 4 修复确认）
  - Evidence: 移动端 `.container.mx-auto` margin-top `calc(44px + env(safe-area-inset-top))`（`css/player.css` 约 626-630 行）+ main `py-4` 16px padding → 播放器容器顶部约视口 60px+safe；移动端 `.player-header-fixed` 两行内容 + `p-4` 高约 78px（z-index 9000、背景不透明 `#111`）。第二波改 `position: absolute; top: 0` 相对容器后，提示视口位置 60px+safe 落在 header 内被遮挡（第一波 `fixed top:104px` 时可见）。
  - Impact: 移动端三个提示框被 header 遮挡不可见（回归）。
  - 修复: `@media(max-width:640px)` 内三个提示 `top: 24px !important`（相对容器下移，视口 ≈84px+safe > header 78px）。round 4 复审确认修复方向正确、无新 blocking。

### important

- [x] REV-002 修复依赖"播放页独享 player.css"与"同页后加载文件不冲突"两个隐含假设（observation，round 1）
  - 经 REV-001 修复后播放页桌面与移动端均生效；剩余风险（加载顺序变化）记入 residual-risk。
- [x] REV-008 移动端 toast 与 shortcut 间距零裕量，toast 换行会重叠（round 5 发现，round 6 修复确认）
  - Evidence: round 5 时移动端 toast（120px，高约 48px）与 shortcut（168px）零裕量；toast 两行（高约 70px）会侵入。
  - 修复: 间距扩至 64px（桌面 56/120/184，移动端 72/136/200）+ 播放页 `body #toast` 单行截断（`max-width: min(80vw,400px)` + `white-space: nowrap` + ellipsis）。
- [x] REV-009 移动端 adFilterStats 被固定 header 遮挡（round 5 发现，round 6 修复确认）
  - Evidence: 移动端容器顶部约 60px+safe，adFilter top-2=8px → 视口约 68px+safe，低于 header 约 78px。
  - 修复: 移动端 `#adFilterStats { top: 32px }`（视口约 92px+safe，避让 header 且不与 position-restore-hint 重叠，裕量 4px）。

### nit

- [x] REV-003 移动端 `#toast` 规则在修复前为冗余死代码；`mobile-optimize.css:322-323` 双写 `top` 为历史遗留（round 1）
  - 随 REV-001 修复消除；`mobile-optimize.css` 双写属范围外历史遗留，不动。
- [ ] REV-006 `top:24px` 相对推导的 78px header 仅余 6px 裕量，移动端 header 增高（字号放大等）可能突破（round 4）
  - 当前可接受，QA 验证移动端 header 真实高度后定论。

### suggestion

- [ ] REV-004 `top: calc(88px + 16px)` 系魔法数字，三处硬编码，建议后续提取 CSS 变量统一（round 1）
- [ ] REV-007 移动端 `top:24px` 依赖"60px 容器顶部"推导，可复用既有基准（如容器 margin-top 对齐 header 高度）更稳；属优化不阻塞（round 4）

### learning

- 播放页固定 header z-index 达 int 上限，顶部 fixed 提示无法靠 z-index 压过 header，必须纵向避让（与本仓库沉淀 `compound/2026-08-08-top-fixed-hint-header-bypass.md` 一致）。
- 相对播放器容器绝对定位后，容器顶部已含 safe-area 时，提示避让自动顺带解决刘海遮挡，无需再叠加 safe 偏移。
- 容器顶部 = margin-top + padding-top 的推导是移动端定位类问题的关键变量，需先核实真实布局再定偏移。

### praise

- 三个提示框统一相对 `#playerContainer` 定位，桌面分栏/单栏/移动端均水平对齐播放器中心，符合"播放器上方居中"目标。
- 首页 `index.html` 无 `.player-container`、不加载 `player.css`，`ui.js` 挂载回退 body，首页 Toast 保持 `fixed top-4` 不变，未污染全局组件。
- `body #toast` 特异性覆盖处理干净，与移动端避让解耦清晰。

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 移动端 header 真实高度（最核心，决定避让偏移是否充分）：<640px 实测 `.player-header-fixed` 像素高度（safe=0 与带刘海两种）。
  2. 四类通知同时出现（桌面分栏与移动端分别验证）：adFilter + 恢复位置 + Toast + 快捷键同时显示 → 垂直错开不重叠、水平均居播放器中心。
  3. 移动端（safe=0 与刘海）触发快捷键提示 / Toast / 恢复位置提示 → 完整显示在 header 之下、水平居播放器中心。
  4. 桌面分栏（≥1024px）：提示水平对齐播放器中心而非视口中心（右栏 360px 偏移约 180px 场景）。
  5. 长 Toast 消息：超 `min(80vw,400px)` 时单行截断不换行、不侵入快捷键提示层。
  6. 首页回归：搜索失败 Toast 仍 `fixed top-4`。
  7. 全屏：原生全屏下提示显示在全屏播放器顶部对应错开位置，无遮挡。
  8. `.position-restore-hint` 隐藏动画上滑中间态是否短暂叠在 header 上（预期轻微）。
- 建议新增或加强的测试：none（项目无自动化测试）
- 不能靠 review 完全确认的点：移动端 header 实际高度、浏览器实际渲染层叠结果

## 6. Residual Risk

- 移动端四层错开的避让偏移依赖"header ≈78px / 容器顶部 ≈60px+safe"推导：移动端 adFilter 与 position-restore 间距仅 4px、toast 与 shortcut 间距 16px，header 增高或提示高度变化可能压缩裕量。QA 场景 1/2 实测后决定是否需微调。
- 移动端 `.container.mx-auto` margin-top（44px+safe）与 header 高度的落差是既有布局状态：若 header 真为 78px，播放器主内容顶部也可能被 header 覆盖约 18px，属既有问题，建议另行确认（本轮不扩范围）。
- 播放页 `body #toast` 单行截断（`white-space: nowrap` + ellipsis）：超长错误消息可能被截断省略号，常规消息（≤400px）不受影响；若未来需要完整展示长消息需权衡与快捷键提示的错开。
- `#toast` 覆盖依赖 `body #toast` 特异性与"首页不加载 player.css"约定；未来调整加载顺序或新增样式文件需复查。
- `#toast` 定位 = CSS `top` + JS 内联 `style.transform` 协同；未来改 JS transform 语义需同步核对 `top` 基准。
- 无自动化测试，依赖浏览器手动验证。

## 7. Verdict

- Status: passed
- Next: 收尾提交（修复代码 + fix-note + report + approval-report），等待 owner 确认修复完成（`issue-fix-completion`）

## 8. Focused Closure（无则写 none）

none（本报告为完整独立复审 round 6；blocking REV-001 / REV-005 与 important REV-008 / REV-009 均在后续 round 核验关闭，见第 4 节。）
