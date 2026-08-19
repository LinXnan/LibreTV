---
doc_type: feature-review
feature: 2026-08-19-tmdb-hot-carousel
status: passed
reviewer: subagent
reviewed: 2026-08-19
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 未安装（where ocr 未找到）"
---

# tmdb-hot-carousel 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-19-tmdb-hot-carousel/tmdb-hot-carousel-design.md`（approved）
- Checklist: `.codestable/features/2026-08-19-tmdb-hot-carousel/tmdb-hot-carousel-checklist.yaml`（steps 1-4 done；step5 浏览器验证归 acceptance 阶段，需用户填真实 key）
- Implementation evidence: 对话实现 + read_lints（js/tmdb.js、js/recent-watch.js、js/douban.js、js/config.js 均 0 报错）+ grep 反向核对
- Diff basis: `git status --short` → `M index.html`、`M js/config.js`、`M js/douban.js`、`M js/recent-watch.js`、`?? js/tmdb.js` + `.codestable/` 产物
- Review mode: full-rereview（round 2，round 1 blocking 修复 + important 修复后完整独立复审）
- Baseline dirty files: 无本轮外 dirty（git status 全部可归因）

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；OCR CLI 不可用（`where ocr` 未找到，见 attention.md 命令陷阱）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 blocking：page 1 基迁移三处遗漏；round 2 确认闭环 + 新发现 important：page||1 防御掩盖）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮 findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`js/tmdb.js`（TMDB 数据层：TMDB_CONFIG 引用 + fetchTmdbData + TMDB_TAG_TO_QUERY + fetchTmdbSubjects）、`.codestable/features/2026-08-19-tmdb-hot-carousel/*`、`.codestable/requirements/tmdb-hot-carousel.md`
- 修改：`js/recent-watch.js`（fetchDoubanSubjects 改调 fetchTmdbSubjects、缓存键四元组 type|tag|year|page、page 1 基、移除 sortByRateDesc/PAGE_LIMIT、currentKey 含 year、回绕改 1 基）、`js/douban.js`（新增 doubanCurrentYear/renderDoubanYears/getDoubanYearOptions、移除 fetchDoubanData）、`js/config.js`（TMDB_CONFIG 占位 key）、`index.html`（年份条 #douban-years + script 注册 js/tmdb.js）
- 删除：douban.js 的 fetchDoubanData（函数级）、recent-watch.js 的 sortByRateDesc/PAGE_LIMIT（函数/常量级）
- 风险热点：page 语义迁移、缓存键一致性、标签/年份/换一批竞态、代理与降级时序、封面链路

## 3. Adversarial Pass

- 假设的生产 bug：切标签后第一次"换一批"与第一页内容重复（0 基残留被 `page||1` 掩盖）
- 主动攻击过的反例：isSwitch 重置 page、prefetchTag 缓存键、回绕路径、nextBatch 步进、page=0 传参、年份空值、poster_path 缺失、TMDB 空 results、allorigins 降级悬挂、竞态乱序、vote_count.gte 映射、URL 编码
- 结果：round 1 发现 blocking（REV-001 三处 0 基残留）并修复；round 2 确认闭环 + 发现 important（REV-002 page||1 防御掩盖）并修复；无新问题

## 4. Findings

### blocking

- [x] REV-001 `js/recent-watch.js` + `js/tmdb.js` page 1 基迁移三处遗漏（isSwitch/prefetchTag/回绕仍用 0）
  - Evidence: round 1 时 recent-watch.js L462 `pageStart = 0`（isSwitch）、L87/L96 prefetchTag 缓存键与请求用 0、L478 回绕 `pageStart = 0`；tmdb.js `page || 1` 将 0 规约为请求 page 1
  - Impact: 切标签/年份后缓存键 page 段为 0，请求页为 1；"换一批" pageStart=1 又请求 page 1 → 第一次换一批与第一页内容重复；缓存键与实际请求页不一致
  - Fix: isSwitch 设 `pageStart = 1`；prefetchTag 缓存键与请求改 1；回绕 `pageStart = 1`（条件 `pageStart > 1` 不变）
  - 验证: round 2 grep `pageStart` 全路径 1 基统一（L26 初始 1 / L462 isSwitch 1 / L477-478 回绕 1 / L713 +1）；read_lints 0 报错

### important

- [x] REV-002 `js/tmdb.js` `page || 1` 防御会静默掩盖调用方 page 语义错误（round 1 bug 的根源防御残留）
  - Evidence: tmdb.js L96 `page: String(page || 1)`——0 被规约，若未来回归传 0 不再暴露
  - Impact: 结构性风险：防御层掩盖契约违规，回归静默化
  - Fix: 显式校验 `const pageNum = Number(page) > 0 ? Number(page) : 1;`
  - 验证: read_lints 0 报错

### nit

- [x] REV-003 `js/recent-watch.js` L473 注释残留"豆瓣返回空数组"措辞——已同步为通用描述（随 REV-001 修复一并更新）
- [ ] REV-004 `js/tmdb.js` allorigins 降级会把含 api_key 的 URL 明文中转给第三方——design 已接受并记录 residual，不阻塞

### suggestion

- [ ] S-1 全标签预取（prefetchAllTagsData）会带当前年份预取所有标签，切年份后缓存失效浪费请求——CACHE_MAX=20 LRU 兜底，非问题；可后续优化为年份切换时跳过预取
- [ ] S-2 标签"经典/豆瓣高分"用 `vote_count.gte` 兜底排序，效果依赖线上数据量——留 acceptance 实测

### learning

- 数据源 page 语义迁移（0 基→1 基）必须全路径排查：初始值、isSwitch 重置、翻页步进、回绕回滚、缓存键、请求参数六处同步，缺一处即产生"缓存键与请求页不一致"类隐蔽 bug
- `x || 1` 类防御默认值会掩盖调用方语义错误，契约边界应显式校验而非静默规约

### praise

- fetchTmdbSubjects 返回与豆瓣同构原始数组、render `.map` 段保留——契约落地与 design 一致，改动面最小
- 缓存键四元组（type|tag|year|page）+ 快照捕获 + requestId 作废三层防护在 page 迁移后保持完整
- 年份 UI 复用 ff-note 设计（currentKey 收敛 + 空态保留筛选区）零偏差

## 5. Test And QA Focus

- QA 必须重点复核：
  - 切标签/切年份后"换一批"不与第一页重复（REV-001 回归，P0）
  - 回绕：翻到最后一页空数组 → 回到第一页 toast + 内容正确（P0）
  - 年份筛选真实生效：网络面板确认 `primary_release_year`/`first_air_date_year` 参数
  - 快速连切标签/年份 + 换一批竞态：requestId 作废、batchPending 复位
  - 空年份/空标签不拼无效参数；某年份无数据空态筛选区保留
  - 缓存命中：60s 内切 全部→2024→2023→2024 命中
  - 封面：poster_path 缺失显示占位符；image.tmdb.org 经 /proxy/ 正常加载
  - key 缺失/错误：热播空态不阻塞搜索/播放
- 建议新增或加强的测试：none（项目无自动化测试）
- 不能靠 review 完全确认的点：TMDB discover 参数组合（with_origin_country/with_genres/vote_count.gte/year）实际返回语义与"经典/豆瓣高分"排序质量——需真实 key 联调实测

## 6. Residual Risk

- TMDB API key 未填（config.js 占位符 YOUR_TMDB_API_KEY），N1-N7 浏览器验收阻塞于用户填 key
- allorigins 降级中转泄漏 api_key（免费 key 低危，design 已记录接受）
- 原片名（英文）搜索采集站命中率依赖线上实测
- 无自动化测试，视觉/交互/竞态回归依赖浏览器手动验证

## 7. Verdict

- Status: passed
- Next: Standard lane → `cs-feat` acceptance（Inline Verification Matrix，用户填 key 后浏览器验证 N1-N7）

## 8. Focused Closure（无则写 none）

none（round 2 为完整独立复审）
