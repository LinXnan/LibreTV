---
doc_type: feature-ff-note
feature: douban-hot-year-filter
date: 2026-08-18
requirement:
tags: [home, douban, carousel, year, filter, ui]
execution_lane: quick
---

## 做了什么
首页豆瓣热播轮播新增**年份筛选**：标签行下方增加一条年份筛选条（"全部" + 当前年往前 15 年，横向滚动，风格与标签一致）。切换年份时轮播刷新，展示该年份的影片（豆瓣 API `year` 参数）。

## 改了哪些
- `js/douban.js`：
  - 新增全局状态 `doubanCurrentYear`（空串 = 全部年份）
  - 新增 `getDoubanYearOptions()`：当前年往前 14 年 + "全部"
  - 新增 `renderDoubanYears()`：渲染年份按钮条到 `#douban-years`，点击切换 `doubanCurrentYear` 并触发 `window.updateRecentWatchVisibility?.()` 刷新轮播；高亮当前选中年份
  - DOMContentLoaded 中初始化年份条（recent-watch 的 init/setType 不重渲染年份——年份独立于 movie/tv 类型）
- `js/recent-watch.js`：
  - `fetchDoubanSubjects` 加 `reqYear` 参数：非空才拼 `&year=`（空 = 全部年份不拼参数）
  - `getSubjects` 缓存键加 `year`（type/tag/year/pageStart 四者一致才命中）
  - `render` 切换判定 key 加年份（`type:tag:year` 任一变化 = 切换 → 重置分页 + 三点加载）
  - 缓存初始对象加 `year: ''`
- `index.html`：标签行下方新增年份筛选行（`overflow-x-auto` 滚动容器 + `#douban-years`）

## 怎么验证的
- `read_lints`（js/recent-watch.js、js/douban.js、index.html）0 报错；`node --check` 两 JS 文件通过
- 逻辑推演：选年份 → doubanCurrentYear 变化 → render isSwitch=true → 重置 pageStart + 三点加载 → 拉取含 year 参数的数据；切回"全部" → 恢复全年份；缓存键含 year 防跨年份命中；切换类型年份条保持（"全部"适配两类型）
- 浏览器手动验证待用户执行：年份条显示"全部"+近15年；选某年份轮播刷新为当年影片；切回"全部"恢复；切换电影/电视剧后年份条高亮保持

## Code Review 修复（2026-08-18，REV-001~002）
- REV-001（blocking）：年份行原位于 `#recentWatchArea` 内，选某年份数据为空 → `items.length===0` → `applyVisibility` 隐藏整区 → 年份条/标签/类型按钮全消失，用户被锁死无法切回"全部"（年份让空态概率大增，从可用性缺陷升级为阻断）。
  - 修复：DOM 重构——标题行/类型切换/标签/年份抽出为 `#recentWatchFilter` 独立容器；`applyVisibility` 分三态：搜索时隐藏整区、空态时保留筛选区可见仅隐藏轨道（`track.hidden`）、有数据时全显示。
- REV-002（important）：切年份绕过 `batchPending` 互斥——年份切换 render 与在途"换一批"的 `pageStart` 语义可能叠加（依赖 requestId 隐性保护，脆弱）。
  - 修复：`render` isSwitch 分支显式 `batchPending = false`（切换标签/类型/年份使在途换一批作废，其 requestId 已过期被丢弃，不冲突）。

## 设计要点（防回归）
- 年份筛选与标签/类型/换一批正交：切换判定统一收敛到 `currentKey`（type:tag:year），任一变化走同一"切换"流程（重置分页 + 三点加载 + batchPending 复位），不新增分支
- `year` 参数只在非空时拼入 URL：空 = 全部年份，保持原有"全部"行为与请求 URL 不变
- 年份选项动态生成（`new Date().getFullYear()`），不硬编码，跨年自动滚动
- 缓存键含 year 后跨年份切换必然重新拉取（60s TTL 内同 year 命中），可接受
- 空态（某年份无数据）不再隐藏筛选区：用户始终能切回"全部"/换标签/换类型，杜绝锁死
