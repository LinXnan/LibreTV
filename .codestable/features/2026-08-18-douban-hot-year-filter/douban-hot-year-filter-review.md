---
doc_type: feature-review
feature: 2026-08-18-douban-hot-year-filter
status: passed
reviewer: subagent
reviewed: 2026-08-18
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 未安装（where ocr 未找到）"
---

# douban-hot-year-filter 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-year-filter/douban-hot-year-filter-ff-note.md`（Quick lane，ff-note 即 spec，含 REV-001/002 修复记录）
- Checklist: none（Quick lane 无 checklist）
- Implementation evidence: 对话实现 + node 语法/逻辑推演
- Diff basis: `git status --short` → 本轮可归因：`js/douban.js`（M，年份状态/渲染）、`js/recent-watch.js`（M，year 参数/缓存键/切换判定/applyVisibility 三态/batchPending 复位）、`index.html`（M，#recentWatchFilter 重构 + 年份行）+ `.codestable/features/2026-08-18-douban-hot-year-filter/`（?? 新目录）
- Review mode: full-rereview（round 2，REV-001/002 修复 + nit 采纳后完整独立复审）
- Baseline dirty files: `css/index.css`、`js/utils.js` 及 recent-watch.js 的 sortByRateDesc/preloadCovers/三点 loading/cover-pending/batchPending/分页 均属其他 feature baseline

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到，见 attention.md 命令陷阱）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 REV-001 blocking + REV-002 important；round 2 确认修复闭环，无新 blocking/important；采纳 1 nit：空态切换时 loading 不可见）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮 findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-year-filter/douban-hot-year-filter-ff-note.md`
- 修改：`js/douban.js`（doubanCurrentYear/getDoubanYearOptions/renderDoubanYears/DOMContentLoaded）、`js/recent-watch.js`（fetchDoubanSubjects reqYear、getSubjects 缓存键 year、render key 加 year、applyVisibility 三态、isSwitch 复位 batchPending、showTrackLoading 恢复 track）、`index.html`（#recentWatchFilter 重构 + 年份行）
- 删除：none
- 风险热点：空态锁死（I1）、切换与换一批竞态（I2）、缓存键四元组、URL 参数、移动端滚动、DOM 重构副作用

## 3. Adversarial Pass

- 假设的生产 bug：选冷门年份数据为空 → 筛选控件被一起隐藏 → 用户锁死无法切回
- 主动攻击过的反例：空年份（2011 热门）/切年份+换一批竞态/切年份缓存命中/快速连切年份乱序/URL 参数共存/类型切换年份保持/移动端滚动/幂等渲染/空态切标签 loading 不可见
- 结果：REV-001（空态锁死，blocking）、REV-002（切年份绕过 batchPending，important）round 1 发现并修复；round 2 确认闭环 + 采纳 1 nit；无新问题

## 4. Findings

### blocking

- [x] REV-001 `index.html` + `js/recent-watch.js` 年份行原位于 `#recentWatchArea` 内：选某年份数据为空 → `items.length===0` → `applyVisibility` 隐藏整区 → 年份条/标签/类型按钮全消失，用户被锁死（冷门年份空态概率大增）
  - Evidence: applyVisibility（recent-watch.js:134-145）`itemCount===0` 时 `area.classList.add('hidden')`；#douban-years 在 #recentWatchArea 内（index.html 原 349-351）
  - Impact: 用户无法切回"全部"，只能刷新，可用性缺陷（feature 显著放大空态概率）
  - Fix: DOM 重构——标题/类型/标签/年份抽为 `#recentWatchFilter` 独立容器；applyVisibility 三态（搜索隐藏整区/空态保留筛选隐藏轨道/有数据全显示）；showTrackLoading 恢复 track 显示（空态切换时 loading 可见）
  - 验证: round 2 逐分支推演闭环（搜索态 app.js:905 双保险；空态→恢复路径 applyVisibility 与 track.innerHTML 同步无 flash；轨道 350px 布局无残留）

### important

- [x] REV-002 `js/recent-watch.js` 切年份绕过 `batchPending`：年份切换 render 与在途"换一批"的 `pageStart` 语义可能叠加，依赖 requestId 隐性保护脆弱
  - Evidence: 年份 onclick 直接调 updateRecentWatchVisibility（douban.js:205）；render isSwitch 分支原不清 batchPending
  - Fix: `render` isSwitch 分支显式 `batchPending = false`（在途换一批 requestId 已过期被丢弃，无冲突）
  - 验证: round 2 推演 requestId=N（在途换一批）→ isSwitch → batchPending=false, requestId=N+1 → 旧 fetch 返回被丢弃；快速再点换一批 pageStart=10 合理；回绕分支 lastRenderKey 不变保持 batchPending=true 不受影响

### nit

- [x] REV-003 `js/recent-watch.js` 空态下切换标签/年份：track 仍 hidden（display:none），三点 loading 不可见，用户只见筛选区无加载反馈
  - Fix: `showTrackLoading` 内 `track.classList.remove('hidden')`（数据到达后 applyVisibility 正常分支保持显示）
  - 验证: 语法 + 逻辑推演通过

### suggestion

- S-1 空 `year` 不拼 URL 参数（recent-watch.js:37-38）已保持 baseline 请求 URL 不变，向后兼容干净；S-2 移动端滚动条样式与标签行一致可后续统一；S-3 跨年后选中年份按钮位置自然漂移可接受——均不阻塞

### learning

- DOM 结构决定空态可见性：筛选控件（可恢复性操作）必须独立于"空数据隐藏"容器，否则空态即锁死——"可恢复操作永不被内容态隐藏"原则
- 切换判定收敛到单一 `currentKey`（type:tag:year）+ 统一 isSwitch 流程（重置分页 + 复位 batchPending + loading）是扩展新筛选维度的正确骨架：新增维度只需进 key，不改分支
- 缓存键四元组（type/tag/year/pageStart）+ 快照式捕获（reqType/reqTag/start/reqYear）+ requestId 作废构成乱序返回三层防护，设计正确

### praise

- REV-001 修复最小且语义正确：不触碰 app.js 搜索交互，仅重构容器 + applyVisibility 三态，空态保留筛选区彻底消除锁死
- 空 `year` 不拼参数 = "全部"行为与 baseline URL 完全一致，向后兼容零风险
- 年份动态生成（new Date().getFullYear()）跨年自动滚动，不硬编码

## 5. Test And QA Focus

- QA 必须重点复核：
  - 空年份陷阱（P0）：选确定无数据的年份（如 tag=热门&year=2011），确认筛选区保留可见、可切回"全部"（REV-001 回归）
  - 切年份 + 换一批竞态（P0）：换一批在途时切年份再点换一批，page_start 不叠加跳页（REV-002 回归）
  - 年份切换缓存：60s 内切 全部→2024→2023→2024，切回 2024 命中缓存
  - 快速连切年份：最终 UI 只显示最后一次点击年份（requestId 兜底）
  - URL 参数：选年份 `&year=2024`、全部无 year 参数；sort/page_limit/page_start 共存
  - 类型切换年份保持：movie 选 2024 → tv → 回 movie，年份高亮保持
  - 空态切标签/年份 loading 可见（REV-003 回归）
  - 搜索态整区隐藏/恢复；移动端年份条横向滚动
- 建议新增或加强的测试：none（项目无自动化测试）
- 不能靠 review 完全确认的点：豆瓣 `tag=热门&year=YYYY` 实际返回语义（冷门年份是否恒空、year 与 sort=recommend 交互）——建议 node server.mjs 起服务代理实测

## 6. Residual Risk

- 低：豆瓣 API 对 `year` 参数的支持语义未线上验证（代理实测待做）；若某年份恒空，空态下仅显示筛选区（有"全部"可切回），可接受
- 极低：`doubanCurrentYear` 全局可被外部改写为非数字串（当前仅 renderDoubanYears 写 String(y)/''，无实际来源）
- 无自动化测试（attention.md:17），视觉/交互层回归依赖手动验证

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾提交（ff-note + review 均已落盘）

## 8. Focused Closure（无则写 none）

none（round 2 为完整独立复审，非 focused closure）
