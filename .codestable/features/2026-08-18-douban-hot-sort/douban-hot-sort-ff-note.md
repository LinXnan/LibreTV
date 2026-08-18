---
doc_type: feature-ff-note
feature: douban-hot-sort
date: 2026-08-18
requirement:
tags: [home, douban, carousel, sort, rate]
execution_lane: quick
---

## 做了什么
首页豆瓣热播轮播的影片按**评分从高到低**排序展示：评分高的优先位于中央凸显、优先自动轮流，无评分的影片排最后。豆瓣 API 默认按 `sort=recommend` 返回（非评分序），本次在数据映射后补一层评分降序。

## 改了哪些
- `js/recent-watch.js`：
  - 新增 `sortByRateDesc(a, b)`：按 `item.rate` 降序；无评分（空串 `''`）与无法解析的 NaN 都映射为 `-Infinity` 落底，保证比较器严格全序；`parseFloat` 兼容小数；同分返回 0 保持豆瓣原始顺序（`Array.prototype.sort` 稳定，ES2019+）
  - `render()` 数据管道 `.map(...)` → `.sort(sortByRateDesc)` → `.slice(0, MAX_ITEMS)`：排序在 rate 归一化之后、截断之前（先保证"评分高者优先"完整作用于全量数据，再截展示上限，防超限数据最高分被截掉）

## 怎么验证的
- `read_lints`（js/recent-watch.js）0 报错
- node 自测 9 条边界：`9.7`→`8.9`/`8.9`（同分保持输入序）→`0.5`→`-1`（负数保留不误清）→无评分空串/`0.0`/`0`/`暂无`(NaN) 全部落底且稳定；`0.0` 归一化为空串不误参与排序
- 浏览器手动验证待用户执行：首页轮播第一张为当前热播中评分最高的影片，切换电影/电视剧与标签后仍按评分降序；无评分影片在轮播末尾

## Code Review 修复（2026-08-18，REV-001~002）
- REV-001（important）：`sortByRateDesc` 对无法 `parseFloat` 的 rate（如 `"暂无"`）返回 `NaN`，破坏比较器严格全序，且 `NaN` 与无评分（哨兵 `-1`）比较语义混乱。
  - 修复：`sortValue(rate)` 将 `''` 与 `NaN` 都映射为 `-Infinity`（最低分），`-1` 哨兵改为 `-Infinity` 消除与负数评分碰撞；比较器全序成立。
  - 验证：node 自测 `"暂无"`→`-Infinity` 与无评分同层落底、`-1` 保留并正确排序（低于 `0.5` 高于无评分）。
- REV-002（important）：`.slice(0, MAX_ITEMS)` 在排序之前截断——若未来豆瓣分页返回超 `MAX_ITEMS` 条，最高分影片可能被截掉。
  - 修复：管道改为 `.map(...).sort(...).slice(...)`，先排序后截断（当前 `PAGE_LIMIT=20 < MAX_ITEMS=50` 零行为变化，纯语义加固）。
  - 验证：node 自测 9 条数据截断后顺序正确。

## 设计要点（防回归）
- 排序复用 `render()` 中已有的 rate 归一化结果（`item.rate` 单一真值源），不重复归一化逻辑
- 评分相等保持豆瓣原始顺序（稳定排序），避免同分影片随机抖动破坏轮播连贯性
- 不触碰 `getSubjects()` 缓存层与 `fetchDoubanSubjects` URL，纯本地排序，无网络/代理协议变更
