---
doc_type: feature-review
feature: 2026-08-15-recent-watch-coverflow
status: passed
reviewer: subagent
reviewed: 2026-08-15
round: 3
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_reason: "OCR CLI 未安装"
---

# recent-watch-coverflow 代码审查报告（round 3：左右切换按钮）

## 1. Scope And Inputs

- Design: none（fastforward 通道，仅 ff-note）
- Checklist: none（fastforward 通道）
- Evidence pack / Gate results / DoD results: none
- Implementation evidence: 本会话对话 + `recent-watch-coverflow-ff-note.md`（迭代 16）
- Diff basis: `git status --short` → M `index.html`、M `css/index.css`、M `js/recent-watch.js`、M ff-note；未跟踪 `LibreTV.iml` / `_analyze_artplayer.mjs` / `_sizecheck.mjs`（基线无关）
- Review mode: full-rereview（round 2 之后 diff 实质变化：拖拽方案整体回滚，替换为左右按钮方案，属 Material change，增加 round 并重置 lane）
- Prior review: round 1 / round 2 `passed`（Coverflow 焦点流 + 手动拖拽——拖拽已被用户否决回滚）
- Baseline dirty files: 未跟踪 3 文件（归因见上，与本轮无关）

### Independent Review

- Detection: 主 agent 自检——独立 Task agent（code-explorer）可用；`ocr` CLI 不可用（未安装）
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装，不阻塞本轮，gate 靠环节 A）
- OCR severity mapping: 未启用（不可用）
- Merge policy: 环节 A 结果 + 主 agent 逐条本地事实核验后合并
- Gate effect: none（环节 A 已返回）

## 2. Diff Summary

- 新增：`index.html` `#recentWatchTrack` 外包 `<div class="relative">` 容器 + `#recentWatchPrevBtn` / `#recentWatchNextBtn` 两个按钮（SVG chevron、`aria-label`、初始 `hidden` class）；`css/index.css` `.recent-watch-nav` 样式（含移动端 32px）；`js/recent-watch.js` `updateNavButtons`、按钮点击绑定
- 修改：`js/recent-watch.js`（`updateCoverflow` 去 extraOffset、`advance` 保留 dir、`render` 调 `updateNavButtons`、click 去 suppressClick）、`css/index.css`（去 `touch-action`/`cursor`/`recent-watch-dragging`）、ff-note
- 删除（回滚）：拖拽常量/状态/`cardTranslateX` extraOffset/`applyDragOffset`/Pointer Events 四件套/`suppressClick`/`endDrag` reflow
- 未跟踪 / staged：`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`（基线无关）
- 风险热点：UI 交互（按钮点击 vs 卡片点击）、可见性切换、z-index 层叠、移动端触摸

## 3. Adversarial Pass

- 假设的生产 bug：按钮点击冒泡到卡片委托造成误跳转；按钮永远显示不出来（hidden 属性/class 处理不当）
- 主动攻击过的反例：
  - 按钮在 wrapper 内、track **外**，click 不冒泡到 track 委托，无误触卡片跳转（reviewer + 本地核验 ✓）
  - `hidden`：按钮初始仅 `hidden` class（无 HTML `hidden` 属性），`classList.toggle('hidden', !show)` 可正确移除/加回；`.hidden { display:none !important }` 于 index.html 内联样式定义，与 Tailwind 一致（本地读文件核验，reviewer 误报"hidden attribute"不成立）
  - z-index：按钮 40 vs 卡片内联 zIndex = count - dist（中央卡最高 count，≤50）。可见卡（dist≤3）槽位位于 ±204/±408/±612px，按钮在边缘 8–48px，几何不重叠，无遮挡（本地计算核验 ✓）
  - 交互时序：点击按钮时鼠标先移出 track 触发 mouseleave→`startAutoScroll`，随后 click→`pauseFor`（stop + 6s 后恢复）。最终行为正确：点击后自动轮播暂停 6s（reviewer + 本地核验 ✓）
  - 负数取模：`advance(dir=-1)` 用 `((activeIndex + dir) % count + count) % count`，JS 负数取模结果归一化正确（✓）
  - 拖拽回滚彻底性：grep `js/` 目录 pointer/drag 相关引用 0 残留（reviewer 核验 ✓）
  - history=0：`render` 中 `updateNavButtons` 在空分支前调用，按钮正确隐藏（✓）
- 结果：无 blocking / important；2 项 nit；其余留 QA focus

## 4. Findings

### blocking

- [ ] none

### important

- [ ] none

### nit

- [ ] REV-301 `index.html` 移动端按钮 32px：触摸目标略小于 44px 建议值，但按钮非唯一操作入口（卡片本身可点），且左右侧仍有留白，可接受（延后）
- [ ] REV-302 `js/recent-watch.js` 按钮点击与 `mouseleave→startAutoScroll` 存在短暂窗口（click 前轮播已被 mouseleave 重启又立即被 pauseFor 停止）：无用户可见影响（同帧内完成），仅代码时序稍绕，可接受

### suggestion

- [ ] REV-303 可考虑在按钮上 `event.stopPropagation()` 以防未来 track 委托范围扩大时的耦合（当前无必要）

### learning

- HTML `hidden` **属性**（presence-based）与 `hidden` **class** 是两种机制：`classList` 只操作 class，初始状态若用属性隐藏，JS 需 `removeAttribute('hidden')`。本项目用 class + `.hidden { display:none!important }`，`classList.toggle` 语义一致，无此坑
- 绝对定位的居中容器内，卡片与侧边按钮是否遮挡需用"槽位几何"核算而非仅看 z-index

### praise

- 按钮置于 track 外部独立于卡片 DOM，天然避免 `track.innerHTML` 重建清空按钮与点击冒泡问题
- 回滚拖拽干净彻底（常量/状态/函数/CSS 无残留），方案切换无历史包袱

## 5. Test And QA Focus

- 按钮点击：上一部/下一部正确切换、环形循环（最后一部点"下一部"回第一部、第一部点"上一部"回最后一部）、平滑动画
- 点击按钮不触发卡片跳转；卡片轻点仍正常跳播放页
- 按钮可见性：1 条历史/0 条历史时按钮隐藏；>1 条时显示；搜索时整区隐藏
- 自动轮播：点击按钮后暂停，约 6 秒后恢复自动连播；鼠标移入/移出行为不回归
- 移动端：按钮 32px 可点击、贴边不遮挡卡片、触摸正常
- 键盘：←/→ 切换、Enter/Space 打开卡片
- `prefers-reduced-motion`：切换瞬时完成，按钮功能可用
- 回归：自动轮流连播、入场动画、卡片跳转、集数上下文同步

## 6. Residual Risk

- 无 blocking/important 残留；移动端按钮 32px 触摸目标偏小为已知取舍（可延后）
- 自动轮播与按钮交互的时序窗口（REV-302）无用户可见影响，QA 顺带确认

## 7. Verdict

- Status: passed（环节 A 独立 reviewer 返回，无 blocking / important；2 项 nit 延后）
- Next: 用户本地浏览器验收（按第 5 节 QA Focus）；ff 通道收尾提交

## 8. Focused Closure（无则写 none）

- none（round 3 为完整独立复审）
