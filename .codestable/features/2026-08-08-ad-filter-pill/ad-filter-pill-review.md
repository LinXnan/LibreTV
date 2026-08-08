---
doc_type: feature-review
feature: 2026-08-08-ad-filter-pill
status: passed
reviewer: subagent
reviewed: 2026-08-08
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装/不可用（命令执行环境限制），不阻塞本轮"
---

# ad-filter-pill 代码审查报告

## 1. Scope And Inputs

- Design: 无（fastforward 通道，spec 为 ff-note）
- Checklist: 无（fastforward 不生成）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `.codestable/features/2026-08-08-ad-filter-pill/ad-filter-pill-ff-note.md`（含 review-fix 后修正）
- Diff basis: 工作区改动（`player.html`、`js/player.js`、`css/player.css` + spec 文档）
- Review mode: full-rereview（首轮发现 blocking 后 fix，round 2 复审）
- Baseline dirty files: none

### Independent Review

- Detection: 宿主提供 code-explorer Task agent（independent 隔离只读）；ocr CLI 自检失败（命令环境路径空格 bug，无法运行）
- 环节 A 独立隔离 Task agent: independent-agent + completed（两轮：首轮独立审查、fix 后复审）
- 环节 B OCR CLI: unavailable（未安装/无法运行，不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 各轮 reviewer 结果已逐条本地事实核验后合并
- Gate effect: 环节 A 已完成并通过，可放行

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-08-ad-filter-pill/ad-filter-pill-brainstorm.md`、`ad-filter-pill-ff-note.md`、`ad-filter-pill-review.md`
- 修改：`player.html`（胶囊结构）、`js/player.js`（显隐逻辑 + 计时器 + 开关判断）、`css/player.css`（胶囊样式）
- 删除：none
- 未跟踪 / staged：上述文件均为工作区改动
- 风险热点：UI（用户可见）、并发/异步（setTimeout 计时器）

## 3. Adversarial Pass

- 假设的生产 bug：计时器被反复重置导致胶囊永不消失
- 主动攻击过的反例：HLS m3u8 反复加载触发 `filterAdsFromM3U8` → `updateAdFilterDisplay` 是否会重置计时；`playEpisode` 无条件展示胶囊是否绕过开关判断；显示/隐藏状态转换与 Tailwind `flex` class 冲突；切集时序竞态
- 结果：首轮发现 1 blocking（切集绕过开关判断）已修复并复审确认；1 important（ff-note 描述不符）已修正文档；其余反例经核实不成立

## 4. Findings

### blocking

- [x] REV-001 `js/player.js:1242`（fix 后 1244） `playEpisode` 无条件调用 `showAdFilterStats()`
  - Evidence: 首轮独立审查发现 `playEpisode` 中 `showAdFilterStats()` 无 `adFilteringEnabled` 判断；用户关闭广告过滤后切集胶囊仍弹出 5 秒
  - Impact: 违反"开关关闭时胶囊隐藏"需求
  - Expected fix scope: 切集展示胶囊前判断 `adFilteringEnabled`（已修复）
  - Fix status: 已修复，round 2 复审确认判断存在、初始化时序无竞态、无其他遗漏路径

### important

- [x] REV-002 `ad-filter-pill-ff-note.md` 描述"播放中过滤到广告时重新短暂展示"与实际行为不符
  - Evidence: `updateAdFilterDisplay` 已不调用 `showAdFilterStats`（这是修复"永不消失"的正确设计），播放中过滤广告只更新计数、胶囊已隐藏则不重新弹出
  - Impact: 文档误导，追溯时产生困惑
  - Fix status: 已修正 ff-note 描述

### nit

none

### suggestion

- [ ] REV-003 `js/player.js:1242-1244` 可将 `playEpisode` 的开关判断收敛到 `updateAdFilterStatsVisibility` 统一处理（单一入口），当前两处维护点若未来扩展需同步修改
  - 不阻塞：当前逻辑正确，属维护性优化建议

### learning

- 广告过滤开关仅在 `index.html`，`player.html` 单页生命周期内 `adFilteringEnabled` 初始化后不变，不存在跨页竞态；未来若播放页内加开关或跨标签同步需补 storage 监听

### praise

- 修复精确：判断变量与内存变量一致、注释准确、未破坏 `updateAdFilterStatsVisibility` 的集中隐藏职责

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 播放页加载 → 胶囊在播放器上方居中显示，5 秒后消失
  2. 切集 → 胶囊再次出现 5 秒后消失
  3. 设置中关闭广告过滤 → 打开播放页不显示胶囊；切集也不显示
  4. 设置中开启广告过滤 → 正常显示
- Evidence pack residual risks / gate warnings：none
- 建议新增或加强的测试：无自动化测试基础设施（项目约定手动验证）
- 不能靠 review 完全确认的点：胶囊视觉效果（位置/大小/遮挡）需人工目测

## 6. Residual Risk

- `residual-risk`：关闭开关后切集，若上次 `setTimeout` 仍在运行理论上可能残留到原窗口结束——但当前架构下开关仅在 index.html、播放页无法触发，不可复现，记录备查
- 缓存：`server.mjs` 静态资源 `maxAge: 1d`，改 JS 后需硬刷新验证（用户选择保持现状）

## 7. Verdict

- Status: passed
- Next: 按 fastforward 通道去向 → 收尾提交（scoped-commit，需用户确认）

## 8. Focused Closure（无则写 none）

- round 1 → round 2 为完整复审（fix 涉及生产代码行为变更，不满足 focused closure 窄条件），非 focused closure
- Closed findings: REV-001、REV-002
- Attributed delta: `js/player.js` playEpisode 开关判断 + ff-note 描述修正
- Targeted verification: round 2 独立 Task agent 逐条核实修复生效、初始化时序、无遗漏路径、无竞态
- Classification: 修复为生产行为修正（blocking），故走完整复审而非 closure
