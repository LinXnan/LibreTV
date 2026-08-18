---
doc_type: feature-ff-note
feature: douban-hot-pagination
date: 2026-08-18
requirement:
tags: [home, douban, carousel, pagination, ui]
execution_lane: quick
---

## 做了什么
首页豆瓣热播轮播每个标签**最多展示 10 个影片**（`PAGE_LIMIT` 20→10），并新增**"换一批"按钮**：点击翻到下一页（豆瓣 `page_start` 分页），加载过渡后展示当前标签的下一批不同影片；翻到末尾自动回绕到第一页。

## 改了哪些
- `js/recent-watch.js`：
  - `PAGE_LIMIT` 20 → 10（每标签每批最多 10 部）
  - 新增 `pageStart` 状态（豆瓣 `page_start` 偏移）；`fetchDoubanSubjects` 加 `start` 参数，URL 用 `page_start=${start}`
  - `getSubjects()` 缓存键含 `pageStart`（type/tag/pageStart 三者一致才命中），避免换一批后命中旧页
  - 新增 `showTrackLoading()`：抽出三点加载过渡（清空 track + 隐藏 nav + 停轮播），isSwitch 与换一批共用
  - `render()`：isSwitch 时重置 `pageStart = 0`（切标签回第一页）；`.then` 开头处理**翻页到头回绕**（`pageStart > 0` 且返回空 → `pageStart=0` 重新 render，第一页也空时走 items.length===0 分支无死循环）
  - 新增 `nextBatch()`（`pageStart += PAGE_LIMIT` + showTrackLoading + render）+ `bindMoreBatch()`（绑定按钮，区域隐藏时不响应）；`init()` 调用
- `index.html`：标题行右侧（`ml-auto`）新增"换一批"按钮（刷新图标 + 文字，hover 粉红高亮，风格与电影/电视剧切换一致）

## 怎么验证的
- `read_lints`（js/recent-watch.js、index.html）0 报错；`node --check` 通过
- 逻辑推演：切标签 → pageStart 重置 0 + 三点加载 → 第一页 10 部；点换一批 → pageStart=10 + 三点加载 → 下一页 10 部（不同影片）；翻到末尾空返回 → 回绕第一页；缓存键含 pageStart 防旧页命中；isSwitch 判定 type/tag 未变，换一批不重复 loading
- 浏览器手动验证待用户执行：每标签显示 10 部；点"换一批"出现三点加载后换下一批不同影片；切标签回第一页；反复换到末尾回绕

## Code Review 修复（2026-08-18，REV-001~003）
- REV-001（important）：换一批按钮无加载互斥，快速连点导致 `pageStart` 无监督累加跳页（可能"翻越→空→回绕→闪回第一页"）。
  - 修复：新增 `batchPending` 标志，`nextBatch` 入口 `if (batchPending) return`；`.then` 主路径/items.length===0 分支/`.catch` 各出口清除（回绕分支保持 true，由回绕后 render 清除）。
- REV-002（important）：翻到末尾回绕无感知指示，用户误以为"换了一批"实际看到第一页。
  - 修复：回绕时 `showToast('已回到第一页', 'info')`。
- REV-003（suggestion）：移动端标题行 h2 + 类型切换 + 换一批（ml-auto）窄屏可能溢出。
  - 修复：标题行容器加 `flex-wrap items-center gap-y-2`（空间不足时换一批换行）。

## 设计要点（防回归）
- 排序（sortByRateDesc）在每批内生效：换一批 = 豆瓣 recommend 下一页 10 部按评分降序，自然得到"评分次高的不同影片"批次
- `showTrackLoading` 复用：切换与换一批视觉一致（三点加载 → 卡片渐进淡入）
- 翻页回绕基于 `pageStart > 0` 判空，与"标签本身无数据"（pageStart=0 空）区分，无递归死循环
- `batchPending` 互斥保证：fetch 期间连点忽略、回绕期间阻止再次翻页，最新 render 完成时清除
- 缓存键含 pageStart 后单槽缓存只存最近一页；切回旧页会重新拉取（60s TTL 内命中），可接受
