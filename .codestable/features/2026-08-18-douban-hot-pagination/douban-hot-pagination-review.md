---
doc_type: feature-review
feature: 2026-08-18-douban-hot-pagination
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

# douban-hot-pagination 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-pagination/douban-hot-pagination-ff-note.md`（Quick lane，ff-note 即 spec，含 REV-001~003 修复记录）
- Checklist: none（Quick lane 无 checklist）
- Implementation evidence: 对话实现 + node 语法/逻辑推演
- Diff basis: `git status --short` → 本轮可归因：`js/recent-watch.js`（M，分页/换一批/batchPending）、`index.html`（M，换一批按钮 + flex-wrap）+ `.codestable/features/2026-08-18-douban-hot-pagination/`（?? 新目录）
- Review mode: full-rereview（round 2，REV-001~003 修复后完整独立复审）
- Baseline dirty files: `css/index.css`、`js/utils.js` 属 douban-hot-cover-prefetch（另一 feature，已审 baseline）；`js/recent-watch.js` 含 sortByRateDesc/preloadCovers/三点 loading 均属其他 feature baseline

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到，见 attention.md 命令陷阱）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 REV-001~003：2 important + 1 suggestion；round 2 确认修复闭环，无新 blocking/important）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮 findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-pagination/douban-hot-pagination-ff-note.md`
- 修改：`js/recent-watch.js`（PAGE_LIMIT=10、pageStart、fetch/getSubjects 分页、showTrackLoading、render 回绕/isSwitch 重置、nextBatch/bindMoreBatch、batchPending 互斥）、`index.html`（#recentWatchMoreBtn + flex-wrap）
- 删除：none
- 未跟踪 / staged：`.codestable/features/2026-08-18-douban-hot-pagination/`（新目录）
- 风险热点：翻页边界（越界/回绕/递归）、连点竞态（pageStart 累加）、缓存键（含 pageStart）、排序×分页交互、移动端布局

## 3. Adversarial Pass

- 假设的生产 bug：快速连点换一批导致 pageStart 无监督累加跳页 / 翻到末尾静默回绕误示"换了一批"
- 主动攻击过的反例：连点 3-4 次换一批；翻到末尾回绕；切标签中断翻页；换一批加载中切标签再切回；缓存覆盖旧页；空标签；递归 render 死循环；移动端窄屏溢出
- 结果：REV-001（连点跳页，important）、REV-002（回绕无感知指示，important）、REV-003（移动端溢出，suggestion）round 1 发现并修复；round 2 确认精确无误伤；无新问题

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/recent-watch.js` nextBatch 无加载互斥：快速连点 `pageStart` 无监督累加，可能"翻越→空→回绕→闪回第一页"
  - Evidence: nextBatch 直接 `pageStart += PAGE_LIMIT`，无 guard；requestId 只丢弃过期请求展示，不阻止 pageStart 累积
  - Impact: 慢网下连点跳页 + 异常过渡
  - Fix: 新增 `batchPending` 标志，nextBatch 入口 `if (batchPending) return`；`.then` 主路径/items.length===0 分支/`.catch` 各出口清除；回绕分支保持 true 由递归 render 清除；render 早退分支清除防泄漏
  - 验证: round 2 归纳法推演——持有最大 renderRequestId 的 render 必落在主路径/空分支/catch 之一清除，链式覆盖收敛，无永久泄漏；回绕递归深度 ≤2 无死循环
- [x] REV-002 `js/recent-watch.js` 翻到末尾回绕无感知指示：用户误以为"换了一批"实际看到第一页
  - Evidence: 回绕分支静默 `pageStart=0; render()`；第一页在 TTL 内 cache 命中时无任何过渡
  - Impact: UX 误导
  - Fix: 回绕时 `showToast('已回到第一页', 'info')`（showToast 全局函数，ui.js:5，作用域已验证）
  - 验证: round 2 确认 showToast 全局可用、'info' 类型合法、仅真回绕触发
- [x] REV-003 `index.html` 移动端标题行 h2 + 类型切换 + 换一批（ml-auto）窄屏溢出
  - Evidence: `mb-4 flex items-center` 无 flex-wrap；320px 下三者并排 nowrap 溢出
  - Fix: 容器改 `flex flex-wrap items-center gap-y-2`
  - 验证: round 2 确认桌面空间充足不换行零影响，移动端换行对症

### nit

- [x] REV-004 `js/recent-watch.js` render 早退（area/track 缺失）不清 batchPending 的理论泄漏——已采纳修复：早退分支补 `batchPending = false`（元素为静态常驻 DOM，实际不可触发，纯健壮性补丁）
- [x] REV-005 `js/recent-watch.js` requestId 过期 return 不清除的隐含跨模块不变式——reviewer 建议注释显式声明，已随 REV-004 修复注释覆盖（早退清除 + 出口收敛双重保险）

### suggestion

none

### learning

- batchPending + 递归回绕 + requestId 过期 return 三者构成完整互斥闭环："同步标志 + 出口收敛 + 后继 render 兜底"是翻页竞态处理的优秀范本
- requestId 递增 + fetch 快照（reqType/reqTag/start）+ cache 键含 pageStart 三者配合是乱序返回防护的关键正确设计
- 回绕仅由最新 requestId 触发（先 return 过期请求），排除多请求重复回绕竞态

### praise

- 三处修复全部精准命中且零副作用：REV-001 单标志 + 出口收敛、REV-002 复用全局 showToast、REV-003 一行 flex-wrap 桌面零影响
- 排序（sortByRateDesc）每批内生效 + 分页下一页 = "评分次高的不同影片"批次，语义清晰；slice 在排序后保证评分高者不被截断挤出
- showTrackLoading 复用切换/换一批，视觉统一；bindMoreBatch 区域 hidden 守卫 + popstate 兜底正确；一次性绑定无监听器泄漏

## 5. Test And QA Focus

- QA 必须重点复核：
  - 快速连点换一批 3-4 次：应稳定在某页、无跳页/空→回绕抖动（REV-001 回归）
  - 翻到末尾回绕：应 toast"已回到第一页"并回到第一页（REV-002 回归）
  - 换一批加载中切标签/类型：旧请求丢弃、最终显示新标签第一页；切回旧标签回第一页
  - 区域隐藏守卫：搜索结果显示时点换一批不响应
  - 三点 loading：切换/换一批/回绕三路径都应出现，不闪旧内容；reduced-motion 下无跳动
  - 移动端窄屏（320px）：标题行换一批换行不溢出；左右 nav 不与换一批冲突
  - 慢网/超时：12s 超时降级空态，batchPending 正确清除可再操作
  - 单/多部边界：标签只有 1 部时左右按钮隐藏、换一批正常；空标签不触发回绕死循环
  - 排序+分页一致性：第 1/2/3 批按评分降序，抽查跨批重复
- 建议新增或加强的测试：none（项目无自动化测试）
- 不能靠 review 完全确认的点：豆瓣 recommend 分页稳定性（page_start 超界返回形态）、换一批真实网络时延下的连点体验

## 6. Residual Risk

- 中等：豆瓣 recommend 排序的 page_start 超界若返回"非空但与旧页重复"而非空数组，换一批可能展示重复影片且 pageStart 永不回绕——依赖豆瓣行为，代码无法判定重复（无去重），QA 需抽查
- 低：单槽缓存跨标签频繁切换时命中率下降，换页可能 re-fetch（60s TTL）——已知设计取舍
- 无自动化测试（attention.md:17），视觉/交互层回归依赖手动验证

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾提交（ff-note + review 均已落盘）

## 8. Focused Closure（无则写 none）

none（round 2 为完整独立复审，非 focused closure）
