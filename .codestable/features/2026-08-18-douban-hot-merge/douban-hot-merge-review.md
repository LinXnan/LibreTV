---
doc_type: feature-review
feature: 2026-08-18-douban-hot-merge
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

# douban-hot-merge 代码审查报告（round 2）

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-merge/douban-hot-merge-design.md`（approved）
- Checklist: `.codestable/features/2026-08-18-douban-hot-merge/douban-hot-merge-checklist.yaml`（steps 全 done）
- Implementation evidence: 对话实现（5 steps 逐步证据）+ 汇报
- Diff basis: `git status --short` → 12 files modified；baseline（4 代理文件 getDoubanReferer + 轮播本身改动）已单独审过，不属本轮归因
- Review mode: re-review（round 2，REV-001/002/003 修复后完整复审）
- Baseline dirty files: 4 代理文件（上一 issue 归因）+ recent-watch.js/index.html 旧改动（上一 feature 归因）

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 REV-001/002/003；round 2 确认修复闭环，无新 blocking/important）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮 findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-merge/`（design + checklist + design-review）
- 修改：`index.html`（删 doubanArea/doubanToggle + 标签条容器迁入轮播区）、`js/douban.js`（重构为标签+数据+搜索共享模块 + 自初始化）、`js/recent-watch.js`（全局状态接入 + cache 快照）、`js/app.js`（清理 douban 引用 + resetToHome 搬迁）、`js/password.js`（清理解锁显示逻辑）、3 个 CSS（删 #douban-results + #doubanArea）
- 删除：doubanArea 网格区、doubanToggle 开关、换一批按钮、分页逻辑、fetchDoubanTags 死代码、lazyLoadDoubanModule
- 未跟踪 / staged：`.codestable/features/2026-08-18-douban-hot-merge/`（新目录）
- 风险热点：跨模块契约（window.updateRecentWatchVisibility）、异步竞态（cache 键污染）、删引用残留、XSS（标签渲染/管理 modal）

## 3. Adversarial Pass

- 假设的生产 bug：快速切换类型/标签时旧请求乱序返回污染 cache 键 → 电视剧标签下混入电影内容（round 1 确认属实并修复）
- 主动攻击过的反例：cache 键污染竞态、删引用残留、resetToHome 双重调用、password 解锁显示、script 顺序、XSS 注入面、乱序返回
- 结果：REV-001（cache 竞态）、REV-002（CSS 残留）、REV-003（自初始化缺失）round 1 发现并修复；round 2 确认全部闭环

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/recent-watch.js` cache 键污染竞态：`getSubjects`/`fetchDoubanSubjects` 用实时全局值构造 URL 与写 cache，快速切换类型/标签时旧请求乱序返回会污染 cache 键（电视剧标签下显示电影内容）
  - Evidence: getSubjects 的 `.then` 写 `cache = { type: doubanMovieTvCurrentSwitch, ... }`（实时值），无 requestId 保护
  - Impact: 类型/标签标注与轮播内容不符的生产数据错乱
  - Fix: 两函数改收发起时刻快照 reqType/reqTag，URL 构造与 cache 写入共用同一快照（recent-watch.js:32-56）
  - 验证: node 乱序自测（movie 慢 200ms / tv 快 50ms）——修复后 cache 键忠实记录请求时状态，当前 tv 状态不被 movie 污染
- [x] REV-002 CSS `#doubanArea` 残留：performance-optimize.css:283、mobile-optimize.css:181 未清理（design 只列了 #douban-results）
  - Impact: 死 CSS（DOM 已删 doubanArea），若未来复用 id 会样式串扰；违反范围守护
  - Fix: 删除两处选择器；全库 grep `doubanArea|douban-results` 归零
- [x] REV-003 `js/douban.js` 失去自初始化：loadUserTags 完全依赖 recent-watch.js init（design 决策 1 要求 douban.js DOMContentLoaded 只调 loadUserTags）
  - Impact: douban.js 被单独引用时标签系统永不初始化（隐式跨模块契约）
  - Fix: douban.js 末尾补 `document.addEventListener('DOMContentLoaded', loadUserTags)`（幂等）；script 顺序 douban.js→recent-watch.js（defer 按文档序）保证先加载后自初始化，双调 loadUserTags 无冲突

### nit

- [ ] REV-004 `setType` 高亮类名硬编码（recent-watch.js:358-371）与 index.html:333-334 初始 class 两处分离，未来改 UI 易分岔。维持原判，非本轮必须
- [ ] REV-005 modal XSS 历史数据面（douban.js showTagManageModal 用 innerHTML 插 `${tag}`，与 renderDoubanTags 的 textContent 不一致）；addTag 入库已转义、loadUserTags 读 localStorage 原样。需 localStorage 被历史脏数据污染才触发，低概率。建议 modal 渲染走 escapeHtml 或 loadUserTags 归一化，属加固

### learning

- cache 写入无 requestId 保护但快照保证一致性：乱序旧请求可能覆盖有效缓存（轻微命中率损耗），因命中条件严格匹配当前 type/tag 无功能错误——"正确性优先"的合理取舍
- resetToHome 搬迁等价性确认：app.js resetToHome 只调 resetSearchArea（内部已调 updateRecentWatchVisibility），等价替代原 updateDoubanVisibility，无双重触发
- 删引用干净度：全库 grep `doubanHotType|douban-results|doubanArea|doubanEnabled|updateDoubanVisibility|initDouban|renderRecommend|lazyLoadDoubanModule|douban-refresh|douban-movie-toggle|douban-tv-toggle|doubanToggle|fetchDoubanTags|doubanPageStart|doubanPageSize` 全部归零
- 状态源统一（douban.js 全局 doubanMovieTvCurrentSwitch/doubanCurrentTag 单一来源）与 renderDoubanTags textContent 渲染标签条，符合 design 决策 2 且 XSS 安全

### praise

- REV-001 快照修复质量高：URL 与 cache 同快照（recent-watch.js:33/55），与 renderRequestId 形成"cache 一致性 + DOM 上屏"双层防护，职责互补无重叠，竞态窗口未扩大
- 反向核对全面归零：design 范围守护列出的所有已删符号全库 grep 0 残留，清理彻底无死代码漏网
- 四平台 lint 0 报错；首页 200（dev server 实测）

## 5. Test And QA Focus

- QA 必须重点复核：
  - 竞态时序（REV-001 核心）：快速 电影↔电视剧 切换 + 点标签，Network throttling 慢网重复验证，轮播内容与标签一致、无错位；cache 命中（同标签二次点击不重新拉取）
  - 类型切换标签联动（S3）：电视剧下点「美剧」切回电影，标签条换 movieTags、高亮回「热门」、轮播刷新，三者一致
  - 删除当前标签：选中「经典」删除 → 重置「热门」+ 刷新轮播（douban.js:407-410）
  - 管理标签持久化（S4）：增/删/恢复默认后 localStorage userMovieTags/userTvTags 正确；删除「热门」被拒；modal 二次打开渲染正确
  - resetToHome：搜索后点首页，轮播恢复且类型/标签保持；播放器关闭返回首页同理
  - 无残留：设置面板无豆瓣开关；导出 JSON 无 doubanEnabled；页面无空 doubanArea 块
  - XSS 边界：管理 modal 输入 `<img src=x onerror=alert(1)>` 等，确认标签条与 modal 均不执行脚本（REV-005）
  - 移动端回归：CSS 清理后 ≤640px 轮播区与标签条横向滚动正常
- 建议新增测试：cache 乱序返回用例（断言最终 cache 键与 items 匹配，针对 REV-001）；setType+renderDoubanTags 联动用例；addTag 转义 + modal innerHTML XSS 反例
- 不能靠 review 完全确认：豆瓣 API 真实响应时延分布（REV-001 触发概率）、老用户 localStorage 历史未转义标签（REV-005）、CSS 清理后视觉回归

## 6. Residual Risk

- 低：cache 可能被乱序旧请求覆盖导致轻微命中率下降（learning，可接受）
- 低：modal 对历史脏标签数据的 XSS 面（REV-005，需 localStorage 被污染才触发，建议 QA 用构造数据验证）
- 豆瓣 API/图床可用性：既有风险（上一 issue 已修 418），本次标签切换触发更多豆瓣请求，QA 需验证标签路径封面无 418

## 7. Verdict

- Status: passed
- Next: Standard feature review passed → `cs-feat` acceptance（accept-inline，Inline Verification Matrix）

## 8. Focused Closure（无则写 none）

none
