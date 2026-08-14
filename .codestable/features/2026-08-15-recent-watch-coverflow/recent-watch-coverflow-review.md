---
doc_type: feature-review
feature: 2026-08-15-recent-watch-coverflow
status: passed
reviewer: subagent + main-agent 核验
reviewed: 2026-08-15
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_reason: "OCR CLI 未安装"
---

# recent-watch-coverflow 代码审查报告

## 1. Scope And Inputs

- Design: none（fastforward 通道，仅 ff-note）
- Checklist: none（fastforward 通道）
- Implementation evidence: 本会话对话 + `recent-watch-coverflow-ff-note.md`
- Diff basis: `css/index.css`（重写 `.recent-watch-*` 块）、`js/recent-watch.js`（模板 + 焦点计算 + 入场延迟 + resize）
- Review mode: 独立 Task agent 首轮审查，输出截断后由 main-agent 按已取 finding 逐条核验 + 追加对抗性复核
- Baseline dirty files: 与既有会话一致（node_modules 等，与本轮无关）

## 2. Diff Summary

- 修改：`css/index.css`（Coverflow 焦点态、信息层、播放徽章、边缘遮罩、入场动画、区域氛围、reduced-motion）
- 修改：`js/recent-watch.js`（卡片模板加 play/info 层、`applyEntranceDelays`、`updateActiveCard`/`scheduleActiveUpdate`、scroll/resize 同步焦点）
- 删除：无
- 风险热点：CSS 动画/层叠、焦点计算与 3 段克隆交互、XSS 面（title 注入新 DOM）、性能（合成层）、可访问性

## 3. Adversarial Pass

- 假设的生产 bug：入场动画与焦点 scale 冲突导致跳变；3 段克隆的 auto margin 破坏定位；克隆卡片被加 active；reduced-motion 下残留动画；XSS 注入到新增 info 层
- 主动攻击过的反例：动画 fill backwards + delay 期间 opacity 0 是否被 active 状态打断、`scale` 独立属性 vs `transform` 动画并存、`:not([aria-hidden])` 选择器是否漏选、resize 时 area hidden 的 clientWidth=0、hover 边缘卡片被遮罩覆盖
- 结果：升级为 findings 的项见第 4 节；其余留 residual risk 与 QA focus

## 4. Findings

### blocking

- [ ] 无

### important

- [ ] 无（核验后无 important 残留）

### nit

- [x] N-1（已修复）`prefers-reduced-motion` 块中 `.recent-watch-track::before/::after { transition: none }` 冗余（伪元素无 transition 声明）→ 已删除，块内仅保留 `.recent-watch-card`
- [ ] N-2 `.recent-watch-card` 常驻 `will-change: scale, transform`：所有卡片持续占用合成层。卡片数量有限（10 张 + 克隆），且既有代码已有 `will-change: transform`，本次仅补充 `scale`，量级可接受，延后
- [ ] N-3 `updateActiveCard` 在区域 hidden（display:none）时 `clientWidth` 为 0，center 可能选中首张卡：不可见状态无用户影响，下次 render/resize 会纠正，延后

### suggestion

- [ ] S-1 入场动画结束后卡片保留 `animation` 声明（仅播一次，fill backwards）：无泄漏（非 infinite），重 render 时 DOM 重建自然重播，不改
- [ ] S-2 active/hover 的 box-shadow + filter 过渡在低端移动设备可能掉帧：过渡时长 0.45s 且仅在滚动/交互时触发，移动端已降卡宽，可接受

### 核验记录（reviewer 提出、main-agent 核验）

- reviewer 提出"3 段克隆时 `.recent-watch-card:first-child { margin-left: auto }` 会把 S1 推到右侧、破坏 `scrollLeft = scrollWidth/3` 定位"：**核验为不成立**——flex 容器内容溢出（3 段总宽远超视口）时剩余空间为负，auto margin 计算归零，不参与布局偏移；该规则为既有代码（原始 ff-note 已注明"内容溢出时自动归零可正常滚动"），非本次引入
- reviewer 提出"克隆段（aria-hidden）卡片被加 active 类"：**核验为正常**——克隆区视觉上等同真实内容（3 段式设计即"视口恒小于一段宽"），滚动到 S1/S3 对应位置时高亮克隆卡与真实卡视觉一致；aria-hidden 仅屏蔽读屏器，不影响视觉高亮
- 入场动画 `to` 帧 `transform: perspective(900px) translateY(0)` 与普通态 `transform: perspective(900px)` 视觉等效；动画结束回落不触发 transition（animation 优先级高于 transition），无跳变
- `.recent-watch-play` 用 `transform: scale()` 弹性弹出，与卡片 `scale` 独立属性互不干扰（不同元素）

## 5. Test And QA Focus

- 焦点切换：滚动时焦点卡片平滑放大/两侧缩小压暗；自动轮播中焦点跟随；3 段循环跳转瞬间焦点无错位
- 信息层/徽章：焦点/hover 时标题浮现、播放徽章弹性弹出；移动端（无 hover）焦点卡片常显标题
- 入场动画：首页加载/回首页时卡片依次淡入上浮；`prefers-reduced-motion` 下无动画；隐藏→显示后动画正常播放
- 边缘遮罩：左右边缘渐暗，不影响中央焦点卡片；hover 边缘卡片被渐暗覆盖符合设计意图；`pointer-events: none` 不挡点击
- XSS：手写 `localStorage.viewingHistory` 塞 `title` 为 `"><img src=x onerror=alert(1)>`，刷新确认信息层标题安全转义、无脚本执行
- 回归：不满一行居中展示、搜索时隐藏、清空历史隐藏、点击跳播放页、自动轮播暂停/恢复、键盘 Enter/Space 操作
- 移动端：640px 下卡片 140px、遮罩 32px、标题字号缩小，触摸滑动正常

## 6. Residual Risk

- `scale` 独立属性需 Chromium 104+ / Firefox 72+ / Safari 14.1+：2022 年后浏览器均支持，个人影视站目标环境无碍；极旧浏览器会退化为无缩放（仅失 Coverflow 效果，不影响功能）
- 低端设备上 scale/filter/box-shadow 的合成与过渡开销：卡片数量有限，已确认可接受
- 覆盖既有 3 段无缝循环测量逻辑未变（`scrollWidth > clientWidth`），本次仅叠加视觉与焦点，结构风险低

## 7. Verdict

- Status: passed（独立 reviewer 无 blocking/important；main-agent 完成逐条核验与补查，修复 1 处 nit）
- Next: 用户本地浏览器验收（按第 5 节 QA Focus）
