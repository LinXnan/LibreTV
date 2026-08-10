---
doc_type: issue-review
issue: 2026-08-10-recent-watch-dup-display
status: passed
reviewer: subagent
reviewed: 2026-08-10
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: ocr CLI not installed (ocr-not-found)
---

# recent-watch-dup-display 代码审查报告

## 1. Scope And Inputs

- Spec：`recent-watch-dup-display-report.md`（confirmed, fast-track）+ `recent-watch-dup-display-fix-note.md` + `approval-report.md#issue-fast-path`（approved）
- Evidence：无 evidence pack（非 goal 模式）
- Implementation evidence：对话内修复汇报 + fix-note 第 4 节
- Diff basis：`git diff -- js/recent-watch.js`（工作区 unstaged，1 文件）
- Review mode：initial
- Baseline dirty files：`.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`、`.codestable/issues/2026-08-10-recent-watch-dup-display/`（均与本轮无关；issue 目录为 CodeStable 产物）

### Independent Review

- Detection：主 agent 可调用 Task agent（code-explorer）；`ocr` CLI 自检 `ocr-not-found`
- 环节 A 独立隔离 Task agent：`independent-agent` + completed
- 环节 B OCR CLI：unavailable（未安装）
- OCR severity mapping：未启用
- Merge policy：环节 A 返回结果已逐条本地仓库事实核验后合并（recent-watch.js / css/index.css / utils.js LazyImageLoader / optimize-apply.js MutationObserver / player.js saveToHistory）
- Gate effect：环节 A 已完成，放行 verdict

## 2. Diff Summary

- 修改：`js/recent-watch.js`（仅 `render()`，+12/-9 行）
- 新增/删除/未跟踪（代码）：none
- 风险热点：UI（轮播渲染逻辑）、时序（innerHTML 双写 + autoScroll 定时器）；无跨模块 / 权限 / 数据 / API

## 3. Adversarial Pass

- 假设的生产 bug：内容不足视口时误判为可循环（或反之），导致重复展示仍在 / 无缝循环丢失
- 主动攻击过的反例：视口边界（`clientWidth + 1` 容差）、1 条 / 10 条历史、`display:none` 下测量（首屏 `recentWatchArea` 默认 hidden）、render 重复调用（popstate / 搜索切换 / 历史变更）、autoScroll 定时器泄漏、innerHTML 双写对懒加载观察的影响、`scroll-behavior: smooth` 下 `scrollLeft` 赋值
- 结果：无升级为 blocking / important 的项；双 innerHTML 懒加载观察与单段 mouseleave 轮播为 nit；`scrollLeft` 赋值触发 scroll 事件导致首次自动轮播延迟为 pre-existing（见 findings / learning）

## 4. Findings

### blocking

none

### important

none

### nit

- [ ] REV-001 `js/recent-watch.js:124,132` needsLoop=true 时 `render()` 对 `track.innerHTML` 双写（单段测量 + 3 段克隆），MutationObserver（`js/optimize-apply.js:29-44`）对新增 `img[data-src]` 重复调用 `lazyImageLoader.observe`。已核验 `LazyImageLoader.observe`（`js/utils.js:452-458`）走原生 `IntersectionObserver.observe`（重复 observe 幂等）且加载完成后 `unobserve`（utils.js:376），无功能影响，仅冗余观察。
- [ ] REV-002 `js/recent-watch.js:238` 单段模式下 `mouseleave` 仍会 `startAutoScroll` 启动 3s interval；`scrollWidth ≤ clientWidth` 时 `scrollTo` 目标均在可视区、`scrollLeft` 无法移动，无视觉影响，开销极轻（每 3s 一次调用），不阻塞。

### suggestion

none

### learning

- 初始 `track.scrollLeft = track.scrollWidth / 3`（`js/recent-watch.js:134`）在 `.recent-watch-track` 的 `scroll-behavior: smooth`（css/index.css:281）下触发平滑滚动动画，并因 scroll 事件被 `pauseFor` 消费（`programmaticScroll` 未置位）使首次自动轮播延迟约 6s——该行为在修复前即存在（原代码同样先赋 `scrollLeft` 再 `refreshCarousel`），非本次引入。

### praise

- `applyVisibility()` 提前到测量前调用，正确规避 `display:none` 下 `scrollWidth/clientWidth` 为 0 导致的误判。
- 单段/克隆分支判定 `scrollWidth > clientWidth + 1` 简洁，复用既有 CSS auto-margin 居中，未引入新抽象或新 CSS 类。

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 清空历史只留 1~2 条 → 首页最近观看每部影片只出现一次（单段展示，问题不复现）。
  2. 积累 10 条历史 → 3 段无缝循环与自动轮播行为与修复前一致。
  3. 搜索结果打开时切换回首页（`recentWatchArea` hidden→visible 路径）→ 测量基于可见宽度，克隆/单段判定正确。
- 建议新增或加强的测试：none（项目无自动化测试，见 attention.md）
- 不能靠 review 完全确认的点：浏览器渲染效果、resize 边界（见 Residual Risk）

## 6. Residual Risk

- 窗口 resize 不触发 `render`（既有行为）：宽屏下 10 条历史（约 1880px）不足超宽视口时保持单段；需要重新渲染的路径（搜索切换 / 前进后退 / 历史变更）均已调用 `render`。已列入 fix-note 遗留事项。
- 浏览器验证依赖用户执行（无自动化测试）。

## 7. Verdict

- Status: passed
- Next: 按 cs-issue fix 阶段收尾——确认 fix-note 完整（已确认），询问用户是否需要浏览器验证后进入提交收尾。

## 8. Focused Closure（无则写 none）

none
