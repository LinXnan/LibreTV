---
doc_type: feature-review
feature: 2026-08-18-douban-hot-title
status: passed
reviewer: subagent
reviewed: 2026-08-18
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 未安装（where ocr 未找到）"
---

# douban-hot-title 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-title/douban-hot-title-ff-note.md`（Quick lane，ff-note 即 spec）
- Checklist: none（Quick lane 无 checklist）
- Implementation evidence: 对话实现（css/index.css 片名常显改动）
- Diff basis: `git status --short` → `M css/index.css` 为本轮归因；其余 11 个文件为已审 baseline（douban-hot-merge + douban-cover-418 + douban-hot-carousel 归因）
- Review mode: initial
- Baseline dirty files: 11 个（api/proxy、functions/proxy、netlify/functions、server.mjs、其余 css、index.html、js/app.js、js/douban.js、js/password.js、js/recent-watch.js）

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed（已返回对抗式审查结果）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 环节 A findings 已逐条本地事实核验后合并
- Gate effect: 环节 A completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-title/douban-hot-title-ff-note.md`
- 修改：`css/index.css`（`.recent-watch-info` 从 `display:none` 改为 absolute 贴底 + 渐变衬底；`.recent-watch-title` 从 `display:none` 改为白字单行省略）
- 删除：none
- 未跟踪 / staged：`.codestable/features/2026-08-18-douban-hot-title/`（新目录）
- 风险热点：z-index 层叠、卡片 transform stacking context、渐变可读性、aria、移动端断点

## 3. Adversarial Pass

- 假设的生产 bug：标题被 cover-img 或其它卡片遮挡（z-index 竞争）；中央放大后标题错位/字号失控；渐变遮挡封面主体
- 主动攻击过的反例：卡片 transform 创建 stacking context 对 z-index:2 的约束、`card.style.zIndex=count-dist` 与 nav z-index:40 竞争、scale 1.2 对标题字号影响、渐变方向、移动端省略
- 结果：均未构成缺陷——z-index 被约束在卡片内（transform stacking context），标题随卡放大符合"中央凸显"设计；`count>40` z-index 竞争为长期隐患（residual-risk）

## 4. Findings

### blocking

none

### important

none

### nit

- [ ] REV-001 渐变仅在约 35px 高 info 盒子内完成 0.85→transparent 过渡，视觉过渡较急促。文字区始终处于 0.35–0.85 暗度下，白字可读性充足，非可读性缺陷，仅为视觉细腻度。可选：放宽为 `rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 70%, transparent 100%` 或加大 info 高度
- [ ] REV-002 移动端 640px 断点未覆盖标题字号（仍 12px）。140px 卡下渐变约占卡高 17%，覆盖比例略高但可接受。如需更小字号可加 `@media (max-width:640px){.recent-watch-title{font-size:11px}}`

### suggestion

- REV-003 卡片 z-index 上限与导航按钮 z-index:40 的潜在竞争：`card.style.zIndex=count-dist`（recent-watch.js:137），当 count>40 时中央卡盖住导航按钮。当前豆瓣接口单次最多 20 条不触发，属长期隐患非本轮引入。可将 nav z-index 提到上限之上或 JS 封顶

### learning

- `linear-gradient(to top, ...)` 第一个色标（0.85）在底部、顶部 transparent——上浅下深方向正确，实现与 ff-note 注释吻合
- 卡片非 none transform 创建独立 stacking context，`.recent-watch-info` 的 z-index:2 被约束在卡片内，不会与其它卡片层叠冲突

### praise

- `.recent-watch-info` 设 `pointer-events:none`，避免标题/渐变层拦截卡片点击与键盘事件，与卡片委托事件正确配合
- aria 处理干净：卡片 `role="button"` 扁平化，读屏只朗读 `aria-label`（含片名+分），`.recent-watch-info aria-hidden="true"` 防重复朗读
- 入场动画只做 opacity 淡入不触碰 transform，与 JS 槽位定位解耦；`prefers-reduced-motion` 已兜底

## 5. Test And QA Focus

- QA 必须重点复核：
  - z-index/层叠：中央卡标题浮于两侧之上；导航按钮仍可点击（不被标题拦截）
  - 中央放大：切换使某卡居中，标题字号随 scale 1.2 放大、渐变衬底无错位；两侧卡 brightness 衰减下白字可读
  - 渐变方向与可读性：白色/深色封面各测一张，白字清晰且封面主体未被过度压暗
  - 单行省略：超长片名在桌面 180px 与移动端 140px 卡均显示省略号不换行
  - aria：读屏朗读"片名 X 分"且不重复朗读底部片名（aria-hidden 生效）
  - 移动端断点：640px 以下标题字号、渐变覆盖、track 高度无截断
  - 点击与键盘：点击标题区域仍触发搜索（pointer-events:none）；方向键切换、Enter/空格搜索正常
- 建议新增测试：无自动化测试（attention.md:17），手动视觉回归为主
- 不能靠 review 完全确认：视觉观感（渐变急促度、字号一致性）需浏览器肉眼确认

## 6. Residual Risk

- 无自动化测试，CSS 视觉层回归依赖手动验证
- `count>40` 时卡片 z-index 盖住导航按钮（REV-003），当前受接口 20 条上限约束不触发
- 渐变过渡急促（REV-001）若未来调整 info 高度/字号需同步复核渐变分段

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾提交（review passed，无 blocking/important）

## 8. Focused Closure（无则写 none）

none
