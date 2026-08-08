---
doc_type: feature-review
feature: 2026-08-08-mobile-episode-resource-panels
status: passed
reviewer: subagent
reviewed: 2026-08-08
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装（where.exe ocr 无结果）"
---

# mobile-episode-resource-panels 代码审查报告

## 1. Scope And Inputs

- Design: none（cs-feat fastforward，无 design doc）
- Checklist: none
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: 对话多轮迭代 + `mobile-episode-resource-panels-ff-note.md`
- Diff basis: `git status --short` — M css/player.css / M js/player.js / M player.html；未跟踪 `.codestable/` 产物
- Review mode: initial
- Baseline dirty files: `.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`（与本次无关，不计入归因）

### Independent Review

- Detection: 主 agent 自检 — 独立 Task agent 可用（code-explorer）；ocr CLI 不可用（`where.exe ocr` 无结果）
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 环节 A findings 已由主 agent 逐条本地核验后合并（I-1/I-2/I-3 均核对代码属实）
- Gate effect: 环节 A 已返回，可定稿

## 2. Diff Summary

- 新增：`.codestable/compound/2026-08-08-mobile-player-panels.md`、`.codestable/features/2026-08-08-mobile-episode-resource-panels/`
- 修改：`player.html`（+66/-…）、`css/player.css`（+104/-…）、`js/player.js`（+118/-…）
- 删除：无
- 未跟踪 / staged：上述 .codestable 产物 + baseline 无关文件
- 风险热点：UI 布局 / 移动端断点 / JS 状态一致性（分页、等高同步）

## 3. Adversarial Pass

- 假设的生产 bug：分页状态（episodePage）与切集/排序/切源的状态一致性，以及等高同步在资源内容动态变化时的收敛
- 主动攻击过的反例：分页边界与跨页高亮、排序×分页交互、断点切换残留、等高 margin 偏差、MutationObserver 竞态、资源信息条与分页双写
- 结果：I-1/I-2/I-3 升级为 important；N-1/N-2 为 nit；R-1~R-4 进 residual risk / QA focus

## 4. Findings

### blocking

none

### important

- [ ] REV-001 `js/player.js:1301-1316, 1245-1255` 切集/自动连播跨页时当前集高亮不可见
  - Evidence: `playEpisode` 更新 `currentEpisodeIndex` 后仅调用 `renderEpisodes()`，而 `renderEpisodes` 只做页码 clamp，不跳转到包含当前集数的页。集数 >20 时，第 1 页播放中自动连播推进到第 21 集（第 2 页），网格仍显示第 1 页，`isActive` 高亮落在未渲染页
  - Impact: 分页后连续播放无法追踪当前集位置，破坏"就地展开选集"主体验
  - Expected fix scope: 在 `playEpisode`（或 `renderEpisodes`）内把 `episodePage` 推进到包含 `currentEpisodeIndex` 的页（注意 `episodesReversed` 时的真实索引换算）；保持"手动翻页后点击本页集数不跳回"的既有行为
- [ ] REV-002 `js/player.js:2785-2791` 等高同步未计入资源模块 `margin-top`
  - Evidence: `ep.style.height = res.offsetHeight + 'px'`，`offsetHeight` 不含 margin；`.resource-module`（`css/player.css:1006-1012`）带 `margin-top: 0.5rem`，实际占位多 8px，选集面板比资源模块视觉矮
  - Impact: "两面板等高"验收点存在约 8px 偏差
  - Expected fix scope: 展开态下资源模块 `margin-top` 归零并改用统一间距，或度量时补偿 margin
- [ ] REV-003 `player.html:180-196, css/player.css:895-900` 工具栏（自动连播/排序）位于滚动容器内
  - Evidence: `.episode-toolbar` 在 `.episode-grid` 内部，展开态 `.episode-grid` 为 `flex:1; overflow-y:auto`；集数滚动时工具栏一起滚出可视区
  - Impact: 集数多时用户滚到后段后无法便捷操作排序/自动连播
  - Expected fix scope: 工具栏移出滚动容器，作为面板内 `flex-shrink:0` 固定项，仅集数网格区滚动

### nit

- [ ] REV-004 `js/player.js:2776, css/player.css:877-889` 断点切换（≤640→≥641）后内联 height 与 `mobile-episodes-open`/`mobile-panel-open` 类残留，建议在进入桌面断点时清理（matchMedia change 监听）
- [ ] REV-005 `js/player.js:1249-1253` 空集数分支提前 return 不重置 `episodePage`，建议置 0（配合 `switchToResource` 空集数守卫实际几乎不可达）

### suggestion

- [ ] REV-006 弹框链路（`#episodeModal` / `openEpisodeModal` / `renderEpisodesToModal` / `toggleEpisodeOrderInModal` 及对应 CSS）已无入口成死代码，建议独立改动中清理
- [ ] REV-007 `syncMobilePanelHeight` 的 MutationObserver 触发面偏宽（资源面板子树全量监听），可考虑 ResizeObserver 更精准
- [ ] REV-008 选集分页复用 `.resource-scroll-btn`/`.resource-page-info` 类名与"资源"语义不符，建议抽中性命名或加前缀

### learning

- 分页 clamp（渲染前 `Math.min/Math.max` 收敛页码）与倒序 `realIndex` 换算实现正确，可复用
- `.player-sidebar .player-container` 覆盖经核验不会误伤 `#playerContainer`（在 `.player-layout-main` 下），断点/选择器隔离得当

### praise

- 等高同步生命周期严谨（start 先 stop、收起清理 observer 与内联高度，无泄漏）
- 展开态单一状态类 `mobile-episodes-open` 统一驱动面板显隐/按钮文字/箭头/等高，JS 与 CSS 状态一致
- 分页静态按钮绑定一次（`bindEpisodePagination`），避免资源面板每次重渲染重绑定的模式

## 5. Test And QA Focus

- 移动端展开/收起闭环：两面板同时出现/消失、按钮文字「展开/收起」、箭头旋转
- 等高跟随：展开时资源仍加载中/翻页后，选集面板高度是否自动更新
- 分页边界：单页（1/1、按钮禁用）、两页翻页、空集数占位
- 排序×分页：第 2 页点排序回第 1 页、倒序高亮正确
- 切集/切源后页码收敛、当前集高亮、资源"当前播放"标记
- 自动连播跨页推进时当前集高亮可见性（REV-001 未修时的已知取舍）
- 断点旋转：≤640 展开后拉伸至 641/800/1024 无残留错位（REV-004）
- 桌面端回归：≥1024 分栏高度对齐、侧栏收起/展开；641-1023 平板选集面板正常显示

## 6. Residual Risk

- REV-001 采纳"不自动跳页"取舍时，连续播放跨页高亮不可见，需 QA 确认可接受
- REV-002 margin 等高偏差在真机不同字体/机型下的实际观感
- 资源信息条与分页双写（`renderResourceInfoBar` 重建按钮 + `renderResourcePage` 更新状态）存在加载竞态窗口，依赖调用顺序，QA 需确认页码不闪回 `-`
- Tailwind CDN 加载完成前 `#mobileEpisodeSelectBtn { display:flex !important }` 的样式闪烁（预期 `!important` 胜出）

## 7. Verdict

- Status: changes-requested
- Next: 无 blocking，3 项 important（REV-001/002/003）建议修复；是否修复及修复范围由用户决定，接受延后的项移入 residual risk 后放行提交

## 8. Focused Closure（无则写 none）

none

---

## 9. Round 2 复审与 review-fix（2026-08-08）

### Review-fix 记录（round 1 → 2）

- REV-001 已修：`playEpisode` 按显示索引计算并设置 `episodePage`（含 `episodesReversed` 换算），renderEpisodes 渲染对应页，跨页切集高亮可见
- REV-002 已修：移动端展开态资源模块 `margin-top:0`，间距由 `#episodesGridContainer.mobile-episodes-open { margin-bottom:0.5rem }` 提供
- REV-003 已修：`.episode-toolbar` 移出 `.episode-grid`（滚动容器），展开态 `flex-shrink:0`
- REV-004 已修：`matchMedia('(min-width:641px)')` change 时清理展开类/内联高度/按钮文字
- REV-005 已修：`renderEpisodes` 空集数分支 `episodePage = 0`
- REV-006 已修：删除 `#episodeModal` DOM、player.js 全部弹框函数与 DOMContentLoaded 监听、player.css / styles.css / mobile-optimize.css 弹框专属 CSS、mobile-panel-gestures.js 中 episodeModal 分支；全局检索无残留引用
- REV-007 已修：等高同步改用 ResizeObserver（无 ResizeObserver 时退化单次同步）
- REV-008 已修：分页类名中性化 `.resource-scroll-btn/.resource-page-info/.resource-info-bar-actions` → `.panel-scroll-btn/.panel-page-info/.panel-pagination`（player.html / css/player.css / js/player.js 同步）
- 追加 nit 修复：matchMedia 清理复位按钮文字「展开」；桌面端 `.episode-toolbar` 补 `flex-shrink:0`；`episodeButtonHTML` 注释去除 `playEpisodeFromModal` 残留

### Round 2 独立复审结论（independent-agent）

- Verdict: approved（无 blocking，无 important）
- Nit（已全部修复，见上）：mobile-panel-gestures.js 残留 6 处 `#episodeModal` 空值守卫（清理完成）；matchMedia 未复位按钮文字（已修）；桌面端 toolbar 缺 flex-shrink（已修）；注释残留（已修）
- Suggestion：无 ResizeObserver 时单次同步的优雅降级已合理，不处理
- 残留风险：
  - REV-001 自动跳页在"手动翻页后点本页集数"路径中不产生跳转（该集即在当前页），行为保持；需真机确认
  - 弹框清理涉及 styles.css 组合选择器（history/settings 面板共用规则），仅移除 `#episodeModal` 项，需回归确认历史/设置面板样式不受影响

### Test And QA Focus（round 2 追加）

- 历史/设置移动端面板（index.html 路径）回归：弹框清理后 close-btn/头部固定/内容滚动样式仍正常
- 移动端展开→跨页切集：自动连播/上一集/下一集均能看到当前集高亮
- 断点旋转：≤640 展开 → 拉宽至 641+/1024，无残留（按钮文字回「展开」、无内联高度）
- 分页控件新类名渲染：选集/资源分页按钮样式与禁用态正常
- 排序×跨页：倒序第 2 页点排序回第 1 页、切集后页跳转与高亮一致
