---
doc_type: feature-design-review
feature: tmdb-hot-carousel
status: passed
review_state: passed
review_reason: ""
reviewer_id: subagent
reviewed: 2026-08-19
round: 1
---

# tmdb-hot-carousel feature design 审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-19-tmdb-hot-carousel/tmdb-hot-carousel-design.md`
- Checklist: `.codestable/features/2026-08-19-tmdb-hot-carousel/tmdb-hot-carousel-checklist.yaml`
- Intent / brainstorm: none
- Roadmap: none（普通单 feature）
- Related docs: `.codestable/requirements/tmdb-hot-carousel.md`、`.codestable/features/2026-08-18-douban-hot-year-filter/`（ff-note + review，复用基线）
- Code facts checked: `js/recent-watch.js`、`js/douban.js`、`js/config.js`、`index.html`、`server.mjs`、`js/search.js`、`js/api.js`、`js/customer_site.js`

### Independent Review

- Status: completed
- Detection: independent-agent（code-explorer Task agent）
- Provider / agent: subagent
- Raw output: 独立 agent 返回完整 findings（IMP-1/2/3 + NIT + S + learning + praise + residual-risk）
- Merge policy: 已逐条本地事实核验后合并（IMP-1 核实 render `.map` 段 L502-513 读 `s.cover`；IMP-2 核实 L494 回绕 / L731 步进；IMP-3 核实 index.html L565-572 script 列表无 tmdb.js）
- Gate effect: 独立 reviewer completed，findings 已闭环，可定稿

## 2. Design Summary

- Goal: 首页热播轮播数据源从豆瓣完全替换为 TMDB discover，恢复年份筛选（豆瓣 year 参数无效教训），支持类型/地区筛选组合
- Key contracts: `fetchTmdbSubjects` 返回与豆瓣 subjects 同构原始数组（render `.map` 保留）；缓存键四元组 `type|tag|year|page`；`currentKey` 统一切换判定；page 1 基语义
- Steps: 4 个实现步 + 1 个浏览器验证步；风险热点为数据层契约、page 语义、脚本注册、年份 UI
- Checks: 14 条，来源覆盖验收场景/边界/错误/范围守护/清洁度
- Baseline / validation: read_lints + node --check + grep 反向核对 + 浏览器手动（需真实 key）

## 3. Findings

### blocking

none

### important

- [x] FDR-001 `design#2.1` `fetchTmdbSubjects` 返回结构契约模糊（接近 blocking）：design 原写"返回 `[{title, rate, coverUrl}]`"，但 render 现有 `.map` 段（recent-watch.js:502-513）读 `s.title/s.rate/s.cover` 并 `buildCoverUrl(s.cover)`——若实现按字面，`s.cover` 为 undefined 导致封面全丢、rate 归一化二次处理
  - Evidence: recent-watch.js L502-513 `.map` 段；design 2.1 原 fetchTmdbSubjects 定义
  - Impact: 实现歧义 → N1/E2 大面积失败
  - Fix: design 修订——fetchTmdbSubjects 返回与豆瓣同构原始数组 `[{title, rate, cover}]`，render `.map` 段保留（归一化 + buildCoverUrl），仅删 `.sort`
  - 验证: design 2.1 已更新契约并标注"render `.map` 段保留"
- [x] FDR-002 `design#2.1` page 1 基语义只改一句，回绕/步进/page_size 未适配
  - Evidence: recent-watch.js L494 `pageStart > 0` 回绕、L731 `pageStart += PAGE_LIMIT`；TMDB 默认 page_size=20 不等于豆瓣 10
  - Impact: 回绕判定错位、每批条数漂移导致 MAX_ITEMS/FIRST_BATCH 语义变化
  - Fix: design 修订——pageStart 初始 1、nextBatch `+=1`、回绕 `pageStart>1`、URL 显式 `page_size=${PAGE_LIMIT}`
  - 验证: design 2.1 与 checklist step2 exit_signal 已同步
- [x] FDR-003 `checklist.step1` 遗漏 index.html script 列表注册 `js/tmdb.js`
  - Evidence: attention.md"script 标签顺序即依赖顺序"；index.html L565-572 无 tmdb.js；recent-watch.js 在 L572
  - Impact: 漏注册则 `fetchTmdbSubjects` 未定义，热播全空，且本地语法检查不暴露
  - Fix: checklist step1 exit_signal 增加"index.html script 列表含 js/tmdb.js 且位于 recent-watch.js 之前"；design 交付物同步
  - 验证: yaml 校验通过

### nit

- [x] FDR-004 `design#2.1` allorigins 降级会把含 `api_key` 的 URL 明文中转给 allorigins.win 第三方
  - Evidence: douban.js fetchDoubanData L209 allorigins 降级路径复用
  - Fix: design 风险 3 补附加暴露面说明（接受低危暴露），已修订

### suggestion

- [ ] FDR-005 `design#2.2` 编排图补 items 结构与 FDR-001 绑定——契约已在 2.1 名词层锁定，编排图保持线性（未采纳）
- [ ] FDR-006 `design#2.1` 映射表下补"华语按语言、其余按制作国"注释——已采纳修订
- [ ] FDR-007 `checklist.checks` B1-B3 合并一条可拆三条——保持合并（证伪粒度可接受）

### learning

- 复用 douban-hot-year-filter 的 `currentKey(type:tag:year)` 统一收敛 + isSwitch 统一流程是扩展筛选维度的正确骨架，本 design 正确继承
- ff-note 的 REV-001（空态锁死 → `#recentWatchFilter` 独立容器 + applyVisibility 三态）已固化进 index.html baseline，N7 验收与之一致
- 缓存键四元组 + 快照捕获 + requestId 作废三层防乱序防护设计正确

### praise

- 方案边界收敛精准：不做 session/翻页加载/播放直链/无映射标签语义兜底，全部可 grep 反向核对
- 标签映射表逐标签核对无误（movie 17 + tv 10 全覆盖；genre id 均为 TMDB 标准 id）
- 现状描述与真实代码完全一致（fetchDoubanSubjects/缓存键/sortByRateDesc/fetchDoubanData/fillAndSearchWithDouban）
- 决策记录明确（D1-D4），key 前端暴露风险显式接受并带缓解

## 4. User Review Focus

- 用户需要重点拍板：TMDB API key 填入 config.js（真实 key，不进 git）；原片名为主（英文搜索命中风险已接受）
- implement 需要重点遵守：fetchTmdbSubjects 返回原始数组契约（render `.map` 保留）；page 1 基 + page_size=10；脚本注册顺序；年份条复用 ff-note 设计
- code review / QA / acceptance 需要重点复核：N5 缓存命中（代码 review 证据）、B2/B3 竞态、空态 N7、grep 反向核对（movie.douban.com / fetchDoubanData / sortByRateDesc 零残留）

## 5. Evidence Confidence Ledger

| Check | Verdict | Evidence Class | Basis | Follow-up |
|---|---|---|---|---|
| Acceptance Coverage Matrix | pass | E | N1-N7/B1-B4/E1-E2 均落表且带证据类型 | none |
| DoD Contract | pass | E | 6 条 DoD 覆盖语法/残留/UI/key/实测 | none |
| Steps and checks traceability | pass | E | 5 steps exit_signal 均 yes/no 可核；14 checks 可追溯 design 场景 | none |
| Roadmap contract compliance | n/a | - | 非 roadmap 起头 | none |
| Module interface design | pass | C | fetchTmdbSubjects 契约已写死（原始数组 + render map 保留），index.html 脚本注册补齐 | 联调核对 |
| Validation and artifacts | pass | E | read_lints/node --check/grep/浏览器手动齐全；交付物含脚本注册 | none |

Summary: E=5, C=1, H=0, H-only core checks=none

## 6. Residual Risk

- TMDB discover 参数组合（primary_release_year/first_air_date_year/with_genres/with_origin_country/vote_count.gte）线上正确性依赖联调实测（N3/N4 用网络面板逐参数核对）
- 原片名（英文）搜索采集站命中率——已列 Top 3 风险 2，缓解边界（中文名次要搜索）超出本轮
- allorigins 中转泄漏 api_key——低危（免费 key），已记录
- 无自动化测试，N1-N7 验收阻塞于用户填真实 key

## 7. Verdict

- Status: passed
- Next: 交给用户整体 review（HumanCheckpoint ConfirmDesign）——design + checklist + 本报告；用户确认后进入 implementation

## 8. Focused Closure（无则写 none）

none（round 1 为完整独立复审）
