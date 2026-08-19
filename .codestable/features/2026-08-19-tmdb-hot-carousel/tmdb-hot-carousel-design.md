---
doc_type: feature-design
feature: tmdb-hot-carousel
requirement: tmdb-hot-carousel
summary: 首页热播轮播数据源从豆瓣完全替换为 TMDB，恢复年份筛选（豆瓣 year 参数无效曾导致其被移除），并支持类型/地区筛选组合
tags: [home, tmdb, carousel, datasource, filter, year]
status: approved
execution_lane: standard
execution_lane_reason: 涉及外部 API 集成（TMDB）+ 完全替换现有数据层（豆瓣下线）+ API key 配置（安全面）→ 不满足 quickEligible（新增跨系统数据源契约、安全配置项、删除现有功能）
---

# TMDB 热播轮播（完全替换豆瓣）

## 0. 概述

首页"豆瓣热播"轮播的数据源从豆瓣 `j/search_subjects`（仅 type/tag 筛选）**完全替换**为 TMDB `discover` 接口（支持年份/类型/地区/排序组合筛选）。恢复年份筛选 UI——该功能 2026-08-18 曾实现（`douban-hot-year-filter` ff-note/review 落盘），因豆瓣 `year` 参数无效被提交 `7770c32` 移除，方案可复用。卡片显示原片名（用户决策），点击沿用"填充搜索框 → 采集站搜索"链路。

## 1. 决策与约束

### 用户决策（已拍板）

- **D1 API key**：已注册，放前端 `config.js`（`TMDB_CONFIG`，占位符提交，本地填真实 key）。免费 key 暴露风险接受；建议后续在 TMDB 面板限制域名。
- **D2 数据源形态**：完全替换——豆瓣热播代码下线，轮播直接消费 TMDB。
- **D3 显示语言**：原片名为主（`original_title`/`original_name`，缺失回退 `title`/`name`）。
- **D4 年份筛选**：恢复年份条（复用 douban-hot-year-filter 的状态/UI/缓存键设计），TMDB 侧走 discover 的 `primary_release_year`（电影）/`first_air_date_year`（电视）。

### 约束

- 不新增后端代理逻辑：TMDB 走现有 `/proxy/` + ProxyAuth；TMDB 非豆瓣域名，不触发 `getDoubanReferer` 注入，无需改动 `server.mjs` 及各平台代理。
- 不引入构建/框架/依赖（AGENTS.md 禁区）。
- 不往 `app.js`/`player.js`/`recent-watch.js` 末尾追加功能：TMDB 数据层拆独立模块 `js/tmdb.js`。
- 真实 key 不进 git：`config.js` 用 `YOUR_TMDB_API_KEY` 占位，本地由用户填。

### 明确不做（可 grep 反向核对）

- 不做 TMDB v3 session/登录态（纯 API key 只读）。
- 不做连续翻页加载（沿用"换一批"单页切换）。
- 不做 TMDB 播放直链（无片源，点击仍走采集站搜索）。
- 不迁移 localStorage：豆瓣标签用户数据沿用，仅改映射语义。
- 不做"冷门佳片/治愈/日综"等无映射标签的语义兜底——统一退化为热门。

### 复杂度档位

走默认档位：纯前端数据层替换，无并发/高并发/对外 SDK。

## 2. 现状 → 变化

### 2.1 名词层

**现状**（代码位置）：
- `js/config.js`：`API_CONFIG` 仅采集站 search/detail 两段，无 TMDB 配置。
- `js/douban.js`：`fetchDoubanData`（豆瓣代理请求 + allorigins 降级）、`fillAndSearchWithDouban`（点击卡片搜索）、标签系统（`movieTags`/`tvTags`/`loadUserTags`/`saveUserTags`/`renderDoubanTags`/`showTagManageModal`）。
- `js/recent-watch.js`：`fetchDoubanSubjects` 构造豆瓣 URL（type/tag/page_start）；多槽缓存键 `type|tag|pageStart`；`sortByRateDesc` 前端按评分重排。
- 豆瓣默认标签列表：movie 17 个 / tv 10 个，含大量 TMDB 无法直接映射的语义。

**变化**：
- **新增 `js/tmdb.js`**：
  - `TMDB_CONFIG = { apiKey, baseUrl: 'https://api.themoviedb.org/3', imageBase: 'https://image.tmdb.org/t/p/w500' }`
  - `fetchTmdbData(url)`：复用 `fetchDoubanData` 模式（AbortController 10s 超时 + ProxyAuth 加签 + allorigins 降级），URL 追加 `api_key` 查询参数。
  - `TAG_TO_QUERY`：标签 → discover 查询参数映射表（见下）。
  - `fetchTmdbSubjects(type, tag, year, page)`：构造 `discover/movie|tv` URL → 返回与豆瓣 subjects **同构的原始数组** `[{ title, rate, cover }]`（`title = original_title || title`、`rate = String(vote_average)`、`cover = imageBase + poster_path`），由 render 现有 `.map` 段统一归一化（rate 0/0.0 → 空串）并 `buildCoverUrl`。**不返回 coverUrl 成品**（契约：render `.map` 段保留）。
- **`js/recent-watch.js`**：
  - `fetchDoubanSubjects` 替换实现为调 `fetchTmdbSubjects`；`pageStart` 语义从豆瓣 0 基 `page_start` 改为 TMDB 1 基 `page`（初始 1）。
    - URL 构造：`page=${pageStart}&page_size=${PAGE_LIMIT}`（显式 `page_size=10` 保持原"每批 10 条"体验，MAX_ITEMS=50/FIRST_BATCH=5 语义不变）。
    - `nextBatch`：`pageStart += 1`；回绕判断改 `pageStart > 1`（原 `> 0`）。
  - 缓存键 `type|tag|year|page`（复用 ff-note 四元组设计）。
  - render `.map` 段保留（rate 归一化 + `buildCoverUrl`），仅删除 `.sort(sortByRateDesc)` 调用并移除 `sortByRateDesc` 函数——TMDB discover 的 `sort_by` 已含排序语义，前端重排会破坏 popular/top_rated 端点语义。
- **`js/douban.js`**：移除 `fetchDoubanData`（不再被引用）；保留标签系统与 `fillAndSearchWithDouban`（点击搜索链路不动，函数名保留以缩小改动面）。
- **`js/config.js`**：追加 `TMDB_CONFIG`（占位 key）。
- **`index.html`**：`#recentWatchFilter` 内标签行下方恢复年份条 `#douban-years`（复用 ff-note DOM 方案：`overflow-x-auto` 滚动容器）；script 列表注册 `js/tmdb.js`（置于 `recent-watch.js` 之前——脚本顺序即依赖顺序，漏注册则 `fetchTmdbSubjects` 未定义热播全空）。

**标签映射表**（defaultMovieTags/defaultTvTags 保持不变，映射下沉 tmdb.js；无映射标签退化为热门）：

| 电影标签 | discover/movie 参数 |
|---|---|
| 热门 | `sort_by=popularity.desc` |
| 最新 | `sort_by=primary_release_date.desc` |
| 经典 | `sort_by=vote_average.desc&vote_count.gte=200` |
| 豆瓣高分 | `sort_by=vote_average.desc&vote_count.gte=50` |
| 动作/喜剧/科幻/悬疑/恐怖/爱情 | `with_genres=28/35/878/53/27/10749` |
| 华语 | `with_original_language=zh` |
| 欧美 | `with_origin_country=US,GB,FR,DE,ES,IT` |
| 韩国 | `with_origin_country=KR` |
| 日本 | `with_origin_country=JP` |
| 冷门佳片/治愈/日综 | 无映射 → 退化为热门 |

| 电视标签 | discover/tv 参数 |
|---|---|
| 热门 | `sort_by=popularity.desc` |
| 美剧/英剧/韩剧/日剧/国产剧/港剧 | `with_origin_country=US/GB/KR/JP/CN/HK` |
| 日本动画 | `with_genres=16&with_original_language=ja` |
| 综艺/纪录片 | `with_genres=10764/99` |

> 映射语义：华语按**语言**（`with_original_language`）筛选，其余地区标签按**制作国**（`with_origin_country`）筛选；genre id 为 TMDB 标准 id（28 动作/35 喜剧/878 科幻/53 悬疑/27 恐怖/10749 爱情/16 动画/99 纪录片/10764 综艺）。

年份：空 = 全部不拼参数；非空 → 电影 `primary_release_year`，电视 `first_air_date_year`。
评分：`vote_average` 字符串化（10 分制）。封面：`imageBase + poster_path`。标题：电影 `original_title || title`，电视 `original_name || name`。

### 2.2 编排层

**现状**（recent-watch.js render 主流程）：

```
render → getSubjects(type/tag/pageStart) → fetchDoubanSubjects 构造豆瓣 URL
      → fetchDoubanData 代理 → items → sortByRateDesc 重排 → 渲染轮播
```

**变化后**：

```
render → getSubjects(type/tag/year/page) → fetchTmdbSubjects 构造 discover URL
      → fetchTmdbData 代理 → items（按 sort_by 已排）→ 渲染轮播
```

切换判定 `currentKey = type:tag:year`（沿用 ff-note：任一变化 → 重置 page + 三点加载 + batchPending 复位）。年份切换复用同一 isSwitch 流程，**不新增分支**。
复杂度低（线性替换数据层），免画主流程图。

### 2.3 挂载点（删了它 feature 是否消失）

1. `js/tmdb.js`（新增）：TMDB 数据层——删掉则热播无数据源。
2. `js/recent-watch.js` 数据拉取实现（替换）：删掉则轮播不消费 TMDB。
3. `index.html` 年份条 DOM + `js/douban.js` 年份状态/渲染：删掉则年份筛选消失。
4. `js/config.js` `TMDB_CONFIG`：删掉则 key 缺失热播不可用。

### 2.4 推进策略（paradigm 切片）

1. **数据层**：新建 `js/tmdb.js`（配置 + 代理请求 + 标签映射 + `fetchTmdbSubjects`）——先于 UI，可独立浏览器验证请求。
2. **接入**：`recent-watch.js` 替换数据拉取 + 缓存键/page 语义 + 移除 sort。
3. **年份 UI**：`douban.js` 年份状态/渲染 + `index.html` 年份条 DOM（复用 ff-note 设计）。
4. **收尾**：移除 `fetchDoubanData`、注释/文档同步、read_lints + node --check。

### 2.5 结构健康度与微重构

- **文件级**：`recent-watch.js`（~776 行）本轮只改数据拉取/缓存键/移除 sort，不追加渲染逻辑 → **不做拆文件**。
- **目录级**：`js/` 已 21 文件，`tmdb.js` 属既定"新功能拆独立模块"约定 → 直接新增，不重组目录。
- **结论：不做微重构**。改动面限定在数据层，渲染骨架不动。

## 3. 验收契约

### 正常场景

- **N1** 首页加载：轮播展示 TMDB 数据（封面/原片名/评分），网络面板无 `movie.douban.com` 请求。
- **N2** 电影/电视剧切换：分别请求 `discover/movie` 与 `discover/tv`。
- **N3** 标签切换：热门 → popularity 序；类型标签 → genre 过滤；无映射标签退化为热门不报错。
- **N4** 年份筛选：选 2024 → 请求带 `primary_release_year=2024`（电影）/`first_air_date_year=2024`（电视），轮播刷新为当年影片；切回"全部"恢复。
- **N5** 换一批：`page+1`，缓存键含 year 防跨筛选命中。
- **N6** 点击卡片：搜索框填入原片名并触发采集站搜索（自动勾选豆瓣资源 API）。
- **N7** 空态：某年份无数据 → 筛选区（标签/年份/类型切换）保留可见，轨道隐藏，可切回"全部"。

### 边界

- **B1** 空年份/空标签：URL 不拼无效参数。
- **B2** 快速连切标签/年份：requestId 作废旧请求，UI 只显最后一次。
- **B3** 换一批在途切年份：batchPending 复位，page 不叠加。
- **B4** key 缺失/错误：热播区空态 + console 报错，不阻塞搜索/播放。

### 错误

- **E1** TMDB 请求失败：allorigins 降级；仍失败 → 空态 + 筛选区保留。
- **E2** `poster_path` 缺失：显示占位符（gradient + 图标，现状逻辑复用）。

### Acceptance Coverage Matrix

| 场景 | 证据类型 |
|---|---|
| N1-N7 | 浏览器手动 + 网络面板请求 URL 核对 |
| B1-B4 | 浏览器手动 + 代码 review（N5 缓存命中补缓存键拼接的代码 review 证据） |
| E1-E2 | 改错 key / 断网模拟 + 浏览器手动 |

### DoD Contract

- [ ] `js/tmdb.js` 新增，read_lints 0 报错、node --check 通过
- [ ] `recent-watch.js` 不再出现 `movie.douban.com`；缓存键含 year
- [ ] `douban.js` 移除 `fetchDoubanData`，grep 反向核对无残留引用
- [ ] `index.html` 年份条存在且可交互
- [ ] `config.js` 含 `TMDB_CONFIG`（占位 key，非真实 key）
- [ ] 浏览器实测 N1-N7 全过（用户执行，需真实 key）

## 4. 执行风险与证据计划

### Top 3 风险

1. **标签映射语义失真**（冷门佳片/治愈/日综退化为热门）→ 缓解：映射表独立在 `tmdb.js` 可单独调整；默认标签列表不承诺全部精确。
2. **原片名搜索命中率**（用户已选原片名）→ 缓解：维持现状搜索链路；若命中差，后续加"中文名次要搜索"（超出本轮范围）。
3. **API key 前端暴露** → 缓解：用户已接受；TMDB 免费 key 可在面板限制域名。附加暴露面（residual）：allorigins 降级路径会把含 `api_key` 的 URL 明文中转给 allorigins.win 第三方——既有兜底机制，接受低危暴露。

### 非显然依赖

- 用户需在 `config.js` 填真实 TMDB API key（阻塞 N1-N7 联调验证）。
- TMDB discover 参数组合（year/genre/origin_country）正确性依赖线上实测。

### 关键假设

- 假设：TMDB discover 的 `primary_release_year`/`first_air_date_year` 参数对列表端点有效（豆瓣 year 无效的教训不适用于 TMDB——TMDB 官方文档明确支持）。
- 假设：采集站对英文原片名搜索有基础命中（现有搜索链路不区分语言）。

### 证据类型

浏览器手动（主）+ read_lints/node --check（语法）+ grep（残留反向核对）。

### 必跑验证命令

- `read_lints`（js/tmdb.js、js/recent-watch.js、js/douban.js、index.html）
- `node --check js/tmdb.js`（本会话 pwsh 路径有空格问题，语法验证以 read_lints 为主）
- `grep -r "movie.douban.com" js/` → 0 命中（改后）
- 浏览器：`npm run dev` → localhost:8080 手动验证 N1-N7

### 交付物清单

- 新增：`js/tmdb.js`、`requirements/tmdb-hot-carousel.md`、`.codestable/features/2026-08-19-tmdb-hot-carousel/*`
- 修改：`js/recent-watch.js`、`js/douban.js`、`js/config.js`、`index.html`（含 script 列表注册 `js/tmdb.js`）
- 删除：`douban.js` 内 `fetchDoubanData`（函数级删除）

### 清洁度规则

- 禁止新增 console.log 调试输出（保留现有 error/warn 语义）。
- 禁止 TODO/FIXME；禁止注释掉代码。
- `TMDB_CONFIG` 占位 key 必须可识别（`YOUR_TMDB_API_KEY`），不得提交真实 key。
