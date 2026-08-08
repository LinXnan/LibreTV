---
doc_type: feature-review
feature: 2026-08-08-player-inline-episode-nav
status: passed
reviewer: subagent
reviewed: 2026-08-08
round: 4
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 不可用（命令执行环境无法运行命令），不阻塞本轮"
---

# player-inline-episode-nav 代码审查报告

## 1. Scope And Inputs

- Design: 无（fastforward 通道，spec 为 ff-note）
- Checklist: 无（fastforward 不生成）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `.codestable/features/2026-08-08-player-inline-episode-nav/player-inline-episode-nav-ff-note.md`
- Diff basis: 工作区改动（`js/player.js`、`css/player.css` + spec 文档）
- Review mode: initial（round 1）
- Baseline dirty files: none（.idea/、node_modules/ 等为既有未跟踪，非本轮归因）

### Independent Review

- Detection: 主 agent 自检——独立 Task agent（code-explorer，只读）可用；ocr CLI 不可用（命令执行环境坏掉，无法运行 `which ocr`）
- 环节 A 独立隔离 Task agent: independent-agent + completed（两轮：主体审查 + 精简复审补齐结论清单，均无 blocking）
- 环节 B OCR CLI: unavailable（命令执行环境限制，不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 环节 A 两轮结果已逐条本地事实核验后合并（index 假设对照 ArtPlayer v5.2.4 官方构建源码；类名约定对照项目既有 `.art-*` 类使用）
- Gate effect: 环节 A 已完成并通过，可放行

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-08-player-inline-episode-nav/player-inline-episode-nav-ff-note.md`
- 修改：`js/player.js`（ArtPlayer controls 数组 + `updateButtonStates` 扩展 + 新增 `updatePlayerEpisodeControls`）、`css/player.css`（控件样式）
- 删除：none
- 未跟踪 / staged：上述文件均为工作区改动
- 风险热点：UI（用户可见）、并发/异步（切集时序、控件 mounted 生命周期）

## 3. Adversarial Pass

- 假设的生产 bug：ArtPlayer 自定义控件 index 排序假设不成立导致按钮位置错乱
- 主动攻击过的反例：index 排序假设（5<10<15<20）；webkit 分支 `initPlayer` 重建时控件 mounted 引用失效/残留；点击控件误触播放/暂停；空集数/单集/倒序边界；禁用态与 `updateButtonStates` 联动
- 结果：无 blocking；index 排序假设在当前 v5.2.4 下成立（官方源码 playAndPause=10、volume=20、time=30，本地 min 即 v5.2.4），但属版本软耦合（important）；其余反例经核实不成立或仅理论风险

## 4. Findings

### blocking

none

### important

- [ ] REV-001 `js/player.js:576,596` prev/next 控件的 `index: 5 / 15` 硬编码依赖 ArtPlayer 内置控件默认 index（playAndPause=10、volume=20）
  - Evidence: 当前 v5.2.4 下官方源码确认顺序关系 5<10<15<20 成立，按钮位置正确；但 ArtPlayer 升级或启用其他内置控件（screenshot/playbackRate 等，index 可能落入 5~20 区间）时可能重叠或错序
  - Impact: 版本耦合，升级后布局错乱（冒烟可见），不影响当前功能正确性
  - 处置：建议延后；若未来升级 ArtPlayer 需回归验证控件顺序

- [ ] REV-002 `css/player.css:890-913` 选择器依赖 ArtPlayer 自定义控件类名约定 `art-control-{name}`
  - Evidence: 项目既有 `.art-video-player`（player.css:120）证明 `.art-*` 类名体系存在，约定合理；但该约定随版本敏感
  - Impact: 约定变化时禁用/hover 样式静默失效（仅 UI 降级，click 边界防呆仍保证功能），不阻塞
  - 处置：建议延后；QA 冒烟目测禁用态样式即可覆盖

### nit

- [ ] REV-003 `js/player.js:588-591,608-611` 首集/末集时控件仍渲染，仅靠 `.disabled` + `pointer-events` 置灰；可改为仅有效时渲染省 DOM（可选优化）
- [ ] REV-004 `js/player.js:1254,1257` 用 class `disabled` 而非原生 `disabled` 属性，若未来控件切换为 `<button>` 内嵌需同步处理语义

### suggestion

- [ ] REV-005 `js/player.js:583,603` click 回调可补 `e.stopPropagation()` 显式消除事件冒泡隐患，避免依赖 ArtPlayer 内部吞事件行为（当前误触概率低，QA 确认间距即可）

### learning

- 实现与既有 `playbackRateControl` 挂载模式（`player.js:625`）风格一致；控件点击逻辑与页面级 `updateButtonStates`/`updatePlayerEpisodeControls` 形成双向状态同步

### praise

- 点击边界判断（`player.js:584,604`）与 CSS `pointer-events: none` 双防呆；空集数/单集/倒序等边界处理正确且与页面按钮逻辑一致

### residual-risk

- 全局 `window.prevEpisodeControl`/`nextEpisodeControl` 在播放器整体销毁但页面未卸载时可能残留旧引用；当前所有 `initPlayer` 路径都会经 mounted 覆盖，仅理论风险
- ArtPlayer 控件 index 排序与类名约定无法在本地 min 文件直接验证（超长行无法检索），依据官方 v5.2.4 源码 + 项目既有类名使用判定，QA 需目测确认

## 5. Test And QA Focus

- QA 必须重点复核：
  1. **index 布局**：devtools 检查渲染后 DOM 顺序，确认 prev 在播放键左、next 在播放键与音量之间
  2. **webkit 重建路径**：Safari/WebKit 触发 `isWebkit` 分支（player.js:139,1330-1331）连续快速切集，验证引用不残留、禁用态正确刷新
  3. **误触**：相邻播放键/音量键边界连续点击，确认不会意外触发播放暂停或倍速菜单
  4. **边界**：构造空集数、单集、首集、末集四态，验证 prev/next 禁用态与点击无副作用；再开 `episodesReversed` 倒序验证索引语义
  5. **非 webkit 切集**：确认 `art.switch = url`（player.js:1333）不重建时控件引用持续有效、禁用态随集数刷新
- Evidence pack residual risks / gate warnings：none
- 建议新增或加强的测试：无自动化测试基础设施（项目约定手动验证）
- 不能靠 review 完全确认的点：按钮实际视觉位置与禁用态外观需人工目测

## 6. Residual Risk

- ArtPlayer 版本耦合（REV-001/REV-002）：当前 v5.2.4 功能正确；未来升级或启用更多内置控件需回归控件顺序与样式
- 命令执行环境不可用导致无法本地跑起服务实测，全部验证依赖用户浏览器手动执行（QA focus 覆盖）

## 7. Verdict

- Status: passed
- Next: 按 fastforward 通道去向 → 收尾提交（需用户确认）；验收建议按第 5 节 QA focus 逐项人工目测

## 8. Focused Closure（无则写 none）

none（round 1 首次审查、round 2 完整复审，均非 focused closure）

## 11. Round 4 变更记录（追加）

- 变更内容：把 `#episodeInfo` 从标题右侧改为标题正下方（header 内中间容器由 `flex-row` 改为 `flex-col`，标题在上、集数以 `text-xs` 小字在下，`mt-0.5`）；header 因此增高，`player.css` 主内容区顶部间距 56px→88px，并新增移动端（≤640px）`!important` 覆盖（`calc(88px + env(safe-area-inset-top))`）以覆盖 styles.css 全局 56px
- 变更性质：纯 DOM 结构 / CSS 布局调整（集数元素位置 + 顶部间距数值），无逻辑与行为契约变化；按 Material 处理走完整独立复审（round 4）
- Round 4 独立 Task agent 复审：completed，无 blocking
- 核验反例（均通过）：
  1. CSS 加载顺序 player.html:39-42（styles.css → player.css → mobile → performance），player.css 同特异性 `!important` 后加载胜，移动端 88px 覆盖正确生效
  2. styles.css 全局 56px 影响 index/about 页不受本轮影响（两页 header 非 fixed、未加载 player.css），player.css 仅播放页引用，覆盖只作用于播放页
  3. 桌面端 player.css:11 的 88px 生效，无其他覆盖（mobile/performance 无 `.container.mx-auto` 规则）
  4. 88px 余量约 9px 足够；移动端 calc 方式与 styles.css 自洽
  5. `#episodeInfo` 全局唯一、flex-col 垂直居中正常、标题滚动行为不破坏
- 遗留观察（不阻塞）：
  - suggestion：移动端窄屏 + 最长标题时 header 两行可能被左右按钮压缩，margin 可能略紧，需 QA 验证；标题横向滚动出现滚动条时集数行可能被挤压下移
  - residual-risk：player.css 覆盖依赖"后于 styles.css 加载"的现有顺序，未来调整 CSS 引用顺序需同步复核
- Reviewer 锚点：round 4 沿用独立 Task agent（code-explorer 只读），结论合并后 verdict 仍为 passed

## 10. Round 3 变更记录（追加）

- 变更内容：把 `#episodeInfo`（第 X/Y 集信息）从播放器下方移至页面顶部 header 的视频标题（`#videoTitle`）后面——header 新增居中容器（`flex-1 flex items-center justify-center min-w-0 gap-2`）包裹标题与集数信息，h2 移除 `flex-1`/`text-center`（居中改由容器 `justify-center` 承担）；移除播放器下方原集数信息区块；`js/player.js` 无改动（`updateEpisodeInfo` 按 id 更新，不依赖位置）
- 变更性质：纯 DOM 结构 / 布局移动（元素搬家 + 类名调整），无逻辑与行为契约变化；因改变用户可见 UI 结构，按 Material 处理走完整独立复审（round 3）
- Round 3 独立 Task agent 复审：completed，无 blocking
- 核验反例（均通过）：`#episodeInfo` 全局唯一（player.html:71），`updateEpisodeInfo` 正常更新；header 三列布局结构完整；标题过长时 h2 可横向滚动、集数 `flex-shrink-0` 保持可见；无其他代码依赖原下方集数区块
- 遗留观察（不阻塞）：
  - important：标题过长时 h2 占满容器宽度、集数紧随其后，整体不再严格居中——属可接受回退，与"放在标题后面"意图一致
  - nit：h2 的 `truncate` 与 `.custom-title-scroll` 的 `overflow-x-auto` 语义冗余；header 外层与内层容器 `gap-2` 重复
  - residual-risk：`#videoTitle` 初始为空时集数相对容器居中；`.player-header`（无下划线）移动端 padding 优化可能不作用于 `.player-header-fixed`
- Reviewer 锚点：round 3 沿用独立 Task agent（code-explorer 只读），结论合并后 verdict 仍为 passed

## 9. Round 2 变更记录（追加）

- 变更内容：按用户确认移除播放器下方页面级"集数导航"区按钮（`#prevButton`/`#nextButton`），该区仅保留 `#episodeInfo` 居中；`js/player.js` 删除已无页面按钮可操作的 `updateButtonStates()`，原两处调用点改为 `updatePlayerEpisodeControls()`
- 变更性质：删除类（无新增生产逻辑，不改变播放器控制栏控件机制与行为契约）；因改变用户可见 UI 结构，按 Material 处理走完整独立复审（round 2）
- Round 2 独立 Task agent 复审：completed，无 blocking
- 核验反例（均通过）：
  1. 残留引用 — 全库搜索 `prevButton`/`nextButton`/`updateButtonStates` 无匹配
  2. `updatePlayerEpisodeControls` 调用点齐全（初始化 293 / 切集 1307 / 控件 mounted 591,610），无时序竞态（initPlayer 同步创建控件，先于 293 行）
  3. 控件 click 仍正确触发 `playPreviousEpisode`/`playNextEpisode`；快捷键与自动连播不依赖被删按钮
  4. `#episodeInfo` 仍被 `updateEpisodeInfo` 正常更新，居中布局未破坏
  5. 倒序等逻辑与页面按钮解耦，无依赖
- Reviewer 锚点：round 2 沿用独立 Task agent（code-explorer 只读），与 round 1 同一能力来源，结论合并后 verdict 仍为 passed
