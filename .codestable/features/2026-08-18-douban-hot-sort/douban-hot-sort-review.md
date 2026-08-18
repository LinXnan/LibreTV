---
doc_type: feature-review
feature: 2026-08-18-douban-hot-sort
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

# douban-hot-sort 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-sort/douban-hot-sort-ff-note.md`（Quick lane，ff-note 即 spec，含 REV-001/002 修复记录）
- Checklist: none（Quick lane 无 checklist）
- Implementation evidence: 对话实现（sortValue/sortByRateDesc + render 管道排序）+ node 自测
- Diff basis: `git status --short` → 本轮可归因：`js/recent-watch.js`（M）+ `.codestable/features/2026-08-18-douban-hot-sort/`（?? 新目录）；其余无 dirty 文件
- Review mode: full-rereview（round 2，REV-001/002 修复后完整独立复审）
- Baseline dirty files: none

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到，见 attention.md 命令陷阱）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 REV-001/002 important；round 2 确认修复闭环，无新 blocking/important）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮 findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-sort/douban-hot-sort-ff-note.md`
- 修改：`js/recent-watch.js`（新增 sortValue/sortByRateDesc；render 管道 `.map().sort().slice()`）
- 删除：none
- 未跟踪 / staged：`.codestable/features/2026-08-18-douban-hot-sort/`（新目录）
- 风险热点：排序边界（NaN/空串/负数/零分）、比较器全序、管道顺序（sort 与 slice 先后）、竞态（renderRequestId 作废）、缓存隔离

## 3. Adversarial Pass

- 假设的生产 bug：无评分影片被误排在正分影片之前，或无法解析的 rate（NaN）破坏排序稳定性
- 主动攻击过的反例：rate 为 `''`/`0`/`0.0`/`-1`/`8.9`/`9.7`/`0.5`/`"暂无"`/`undefined`/超大数值（1e400）；同分多条目稳定序；>MAX_ITEMS 数据截断；类型/标签切换竞态；缓存污染；排序作用对象
- 结果：REV-001（NaN 破坏全序）与 REV-002（slice 在 sort 前）round 1 发现并修复；round 2 确认精确无误伤；无新问题

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/recent-watch.js` sortByRateDesc 对无法 parseFloat 的 rate（如 `"暂无"`）返回 `NaN`：`NaN` 参与比较破坏比较器严格全序（`NaN === NaN` 为 false、`NaN > rb` 恒 false 恒返回 1），且 NaN 条目会排在无评分（哨兵 `-1`）之后，违背"无评分排最后"
  - Evidence: parseFloat("暂无") 返回 NaN；原比较器 `ra === rb`/`ra > rb` 对 NaN 恒走 false 分支返回 1
  - Impact: 豆瓣若返回非数字 rate（当前协议为数字字符串或 "0.0"），排序结果依赖引擎实现而不稳定；"无评分排最后"契约在 NaN 上失效
  - Fix: sortValue(rate) 将 `''` 与 `Number.isNaN(parseFloat(...))` 统一映射 `-Infinity`，比较器值域为 `{-Infinity} ∪ parseFloat 有限值`，全序成立
  - 验证: node 自测 `"暂无"`→`-Infinity` 与无评分同层落底、`-1` 保留（低于 0.5 高于无评分）；round 2 逐分支推演确认自反/反对称/传递均成立
- [x] REV-002 `js/recent-watch.js` render 管道 `.slice(0, MAX_ITEMS)` 在 `.sort()` 之前：若未来豆瓣分页返回超 MAX_ITEMS 条，排序只作用于截断后的前 N 条，最高分影片可能被截掉
  - Evidence: 原管道顺序 slice → map → sort；MAX_ITEMS=50、PAGE_LIMIT=20（当前无实际影响，纯语义隐患）
  - Impact: "评分高者优先展示"契约在数据超限时失效
  - Fix: 管道改为 `.map().sort().slice()`——先排序再截断
  - 验证: node 自测 9 条数据截断顺序正确；当前数据量下零行为变化

### nit

- [x] REV-003 `js/recent-watch.js` sortValue 闭包每次比较新建：n≤20 内存微开销，可提升为模块级常量——按"最小改动"原则保留现状可接受（round 2 提出，不修）
- [x] REV-004 `js/recent-watch.js` parseFloat 对超大数值字符串（如 "1e400"）返回 Infinity：仍为全序不破坏正确性，豆瓣评分域 0-10 现实不可达——记录为已知理论边界（round 2 提出，不修）

### suggestion

- REV-005 rate "清洗"逻辑分布在两处（map 阶段 `''` 显示归一化 + sortValue 数值化）：各司其职复用 `item.rate` 单一真值源，无实际 bug；按最小改动原则不建议现在抽取统一函数，rate 规则变动时再合并（round 2 提出）

### learning

- 比较器用 `-Infinity` 兜底 NaN/空串是通用手法：值域收敛为实数全序 + 单点极值，彻底消除 NaN 比较语义混乱
- 排序依赖 `Array.prototype.sort` 稳定序（ES2019+），同分保持豆瓣原始顺序，防止轮播抖动；所有现代浏览器满足
- 排序作用对象是 map 产生的新数组，不会污染 `getSubjects()` 的 `cache.items`——缓存隔离是既有正确性保证，排序不破坏

### praise

- REV-001 哨兵 `-1`→`-Infinity` 一石二鸟：既解决 NaN 全序，又消除负数评分（如 `-1`）与"无评分落底"哨兵的碰撞，`-1` 现正确排于 `0.5` 之下、无评分之上
- 比较器对 `''`/NaN/undefined/负数/零分多类边界均收敛为确定结果，鲁棒性好；`ra===rb` 显式短路避免多余比较
- REV-002 管道注释清晰说明"先 sort 后 slice"意图，防回归信息到位
- 排序复用 render 内已有的 rate 归一化结果（单一真值源），未重复归一化，DRY 正确

## 5. Test And QA Focus

- QA 必须重点复核：
  - REV-001 核心回归：rate 为 `"暂无"`/`-1`/`0.5`/`''`/`0.0`/`0` 各一条，验证排序落点（数字降序、负数低于正分高于无评分、NaN 与无评分同层落底）
  - REV-002 语义：构造 >50 条假 subjects 验证最高分不被截断区丢弃（当前 20 条下 slice 为 no-op）
  - 同分稳定性：多条 `8.9` 保持豆瓣原始相对顺序，自动轮播不跳变
  - 类型/标签切换竞态：快速切换电影↔电视剧↔标签，旧请求被 renderRequestId 丢弃，排序只作用于最终数据；activeIndex 重置为 0 且中央为最高分影片
  - 缓存隔离：反复 render 确认 cache.items 不被排序污染
  - 降级路径：fetchDoubanData 不可用/12s 超时/HTTP 失败 fallback 下轮播降级空态、排序不抛错
  - lint：read_lints（js/recent-watch.js）0 报错
- 建议新增或加强的测试：none（项目无自动化测试，node 自测已覆盖比较器边界）
- 不能靠 review 完全确认的点：豆瓣实际 rate 数据形态分布（非数字串触发率）、>50 条超限数据的真实场景

## 6. Residual Risk

- 极低：`''` 落底分支依赖 render 内既有归一化正则（`^\s*0+(\.0+)?\s*$`）——若未来该正则不再把 `"0.0"` 归空，`"0.0"` 会以 0 分参与排序，无评分不再是绝对落底；当前实现闭环正确，作为注释/测试关注点
- 无自动化测试（attention.md:17），视觉层回归依赖手动验证

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾提交（ff-note + review 均已落盘）

## 8. Focused Closure（无则写 none）

none（round 2 为完整独立复审，非 focused closure）
