---
doc_type: architecture
slug: frontend-app
scope: 首页 SPA 编排：搜索聚合、详情弹窗、设置面板、历史记录、筛选分页、豆瓣推荐与工具辅助
summary: index.html 驱动的单页应用；多源并发搜索→详情→跳 player 的主链路，侧滑设置/历史面板、前端筛选分页与 localStorage 状态持久化
status: current
last_reviewed: 2026-08-01
tags: [frontend, search, ui, spa, history, filters, douban]
depends_on: [system-overview]
implements: []
---

## 0. 术语

- **index.html SPA**：LibreTV 首页，不刷新页面，用 JS 消费 `/api/detail` 与 `/proxy` 完成搜索和详情（`index.html`）
- **API 源（selectedAPIs）**：前端选中的 vod 源集合，存 `localStorage.selectedAPIs`，默认四项（`app.js:2`）
- **自定义源（customAPIs）**：用户附加的 vod 端点，存 `localStorage.customAPIs`（`app.js:18`）
- **csrf-buster timestamp**：所有 `/api/detail` 请求带 `_t` 参数防缓存（`app.js:1012-1014`）
- **历史同步**：从 `viewingHistory` 点击播放时 `playFromHistory` 主动拉 `/api/detail` 校验集数（`ui.js:918-1040`）
- **密码门禁**：所有交互入口（搜索、设置、详情）检查 `ensurePasswordProtection()`（`password.js:28-38` / `app.js:758-774`）

## 1. 定位与受众

- **哪一块**：`index.html` 驱动的 SPA 主页（`js/app.js` `js/ui.js` 等）
- **谁读**：design 对接搜索/详情/面板交互 / issue 排「搜索没结果」「历史不对」/ 改筛选逻辑
- **读完能**：知道页面初始化顺序、搜索链路、详情→播放跳转栈及各交互模块的职责边界

## 2. 结构与交互

### 2.1 模块分层

```
index.html DOM
├── app.js          核心编排：搜索、详情、API源管理、播放跳转、筛选/分页、导入/导出
├── ui.js           UI 服务：设置面板、toast 队列、搜索/观看历史、历史播放恢复
├── index-page.js   首屏：免责声明弹窗、/s=keyword 路径搜索触发、实时时钟
├── search.js       单源 API 搜索客户端（经 ProxyAuth → /proxy）
├── api.js          /api/search → /api/detail 前端处理 + 内存缓存(5min / 100条)
├── password.js     密码门禁（sha256 校验，TTL 约 90 天）
├── proxy-auth.js   加签到 /proxy URL
├── config.js       全局常量（PROXY_URL, API_CONFIG, PLAYER_CONFIG 等）
├── customer_site   内置采集源合并到 API_SITES
├── utils.js        工具类：debounce、URL验证、ConcurrentPool、StorageManager
├── douban.js       豆瓣电影/电视剧推荐（标签浏览、收藏、本地 storage 状态）
├── daily-quote.js  每日一言（hitokoto + 打字动画 + 后备名言）
├── version-check   主栈 vs GitHub VERSION 文件比对（超时 1.5s）、更新提示
├── optimize-apply 自动应用并发池/防抖到全局搜索
├── mobile-panel-gestures 移动端底部抽屉（openPanel、closePanel、遮罩管理）
├── swipe-actions   自定义 API 卡片左滑删除手势
├── undo-toast      删除撤销气泡（5 秒可见）
└── pwa-register    service worker 注册
```

### 2.2 启动顺序

```
DOMContentLoaded → app.js: 初始化复选框 + 自定义 API + 选中计数
                   首次访问 → 默认配置写入 localStorage（app.js:48-65）
                   绑定 search/详情/关闭/导入导出/设置按钮事件
                   加载成人源（基于 yellowFilterEnabled）
                   懒加载豆瓣模块

                → index-page.js: 免责声明弹窗（首次后记忆）+
                   /s=…路径搜索触发（延迟 300ms）+ 实时时钟

                → optimize-apply: 用 concurrentPool 重写 window.search

                → mobile-panel-gestures: 初始化遮罩 + back 键周旋
```

### 2.3 搜索链路（`search()`）

```
输入关键字 + 至少一个源选中
密码门（ensurePasswordProtection）
showLoading + 骨架屏（searchSkeleton）
搜索词 → saveSearchHistory
并发搜索 selectedAPIs（批大小 3）→ 聚合 results
排序：按 latency 升序 → 按 vod_name 排序 → 按来源码排序
updateSearchStatistics + generateSearchFilters（来源按钮 + 分类按钮 + 延迟筛选）
隐藏豆瓣区域 → 渲染分页结果
```

**首屏路径搜索**（`/s=keyword`）：在 index-page.js 中设置搜索框值 → 延迟触发 `search()` → 重写浏览器历史为 `/s=keyword` 模式（`index-page.js:29-56`）。

### 2.4 详情弹窗流程

```
search 卡片点击 → showDetails(id, vod_name, sourceCode, vod_pic)
  → 确定 API 源（内置 vs 自定义）
  → fetch /api/detail（通过 ProxyAuth 添加鉴权参数）
  → 获取集数（episodes）+ 视频描述信息（类型、年份、地区、导演、演员、备注）
  → 填充详情网格 + 描述 + 正/逆排集数列表
  → 呈现"播放"按钮：playVideo(url, title, sourceCode, episodeIndex, vodId)
```

### 2.5 播放跳转（首页→播放器）

`playVideo()` 参数直接构建到 `watch.html`：
```
watch.html?id={vodId}&source={sourceCode}&url={encodedUrl}&index={idx}&title={title}
     + 可能 vod_pic + back={当前首页 URL}
```

同时写入 localStorage 缓存态：`currentEpisodes、currentEpisodeIndex、currentSourceCode、lastPageUrl` → 然后跳转。

### 2.6 观看历史面板

- 数据库：`localStorage.viewingHistory`（`ui.js:433-441`）
- 渲染：按天分组（今天/昨天/本周/日期→`ui.js:369-397`）
- 每项："删除" → `undoDeletion`（5 秒内可恢复，`ui.js:757-851`）
- 播放恢复：`playFromHistory()` 先尝试同步最新集（通过 `/api/detail`），再用本地数据 → 构建 `watch.html` URL（`ui.js:918-1040`）

### 2.7 搜索结果筛选 + 分页

- 作用在全局结果 `window.searchResults`
- 同时筛选：来源（source_name）、分类（type_name）、延迟（<1s / 1-3s / >3s）（`app.js:1486-1713`）
- 分页：PC 侧 20 项/页、移动端 5 项/页（`app.js:1493-1498`）
- 页码范围可见 pc:5、移动端:3（`maxVisiblePages`）

### 2.8 配置导入/导出

```
导出：localStorage → JSON，算 sha256 散列 → 保存到文件（*.libretv-conf.json）
导入：从 JSON 文件/URL 抓取 → 验证 'LibreTV-Settings' → 散列匹配 → 批量写 localStorage → 3 秒后刷新
```

### 2.9 CSS 结构

| 文件 | 职责 |
|---|---|
| `css/styles.css` | 全局重置、按钮、渐变文字（index + player 共用） |
| `css/index.css` | 首页搜索区域/hover/结果网格 |
| `css/modals.css` | 通用模态框（详情/密码/剧集/声明） |
| `css/player.css` | 播放器头栏/控制 |
| `css/mobile-optimize.css` | 移动端滚动条隐藏、工具栏、搜索高度调整 |
| `css/mobile-panels-modern.css` | 历史/设置面板移动端底抽屉 Bento 风格 |
| `css/mobile-settings-modern.css` | 移动端设置页样式美化 |
| `css/performance-optimize.css` | 性能/动画/重绘优化 |

### 2.10 移动端面板（通用）

| 功能 | 文件 | 说明 |
|---|---|---|
| 底部方式 open/close | `mobile-panel-gestures.js` | 从底部铺开，返回键关闭 |
| 遮挡遮罩 | `#panelOverlay` shared | 独立于面板，触击关闭 |
| 自定义API滑动删除 | `swipe-actions.js` | 左滑触发操作，有阈值 |
| 撤销气泡 | `undo-toast.js` | 5 秒可见，"撤销"回滚；与历史面板同构 |

## 3. 数据与状态

| 状态 | 存储 | 所有模块 | 说明 |
|---|---|---|---|
| `selectedAPIs` | `localStorage` | `app.js` 写 / `initAPICheckboxes` 读 | 覆盖选中的内置 vod 源 ID 列表 |
| `customAPIs` | `localStorage` | `app.js`（添加/删除/规范化） | 用户自定义 vod 端点数组 |
| 搜索缓存 | 内存 Map (`apiCache`) 5min/100条 | `api.js` 前端 fetch 缓存 |
| 搜索历史 | `localStorage searchHistory`（数组，最多 50 条） | `ui.js` 读写 / 分组渲染时间线 | 历史值去重 → sort → 最新 first |
| 观看历史 | `localStorage.viewingHistory`（数组） | `ui.js` | 带 title/source/episodes/playbackRate/vod_pic 等 |
| 筛选组合 | 内存 `currentFilters` + 全局 `window.searchResults` | `app.js` 存当前源/分类/延迟滤波状态 | 每次重搜索重计算按钮 |
| 豆瓣标签 | `localStorage` 跟 `default` 初始化 | `douban.js` 使用接口更新 | API 失败 → fallback 名言 |
| 每日一言块 | 内存 `currentAbortController` + localStorage `dailyQuoteEnabled` | `daily-quote.js` | 3 秒超时 → 打字动画 → 重试 |
| 配置导入 | 一次性的写入全 localStorage | `app.js` | 验证 "LibreTV-Settings" + 指纹 → 3 秒后 refresh |

## 4. 关键决策

无已落档决策。观察项（不是拍板）：

- 搜索结果不缓存，每次重新 fetch——负载均给代理端，重复搜索效率差
- 模块间通过 `window.search`（app）+ `window.ProxyAuth` / `window.playFromHistory` 无模块绑定

`TODO: 缓存策略调整 / 状态共享改用事件总线 — cs-decide`

## 5. 代码锚点

| 文件 | 说明 |
|---|---|
| `index.html:111-126` | 历史按钮 + 设置按钮 + 密码占位 |
| `index.html:130-199` | 历史/设置 DOM 面板骨架 |
| `js/app.js:37-86` | 初始化启动序列 |
| `js/app.js:90-101` | `searchWithConcurrencyLimit` 并发 |
| `js/app.js:757-922` | main `search()`——密码门、搜索词校验、并发执行、结果 sorting、分别渲染 |
| `js/app.js:973-1105` | `showDetails`——API 参数路由、`/api/detail` 请求、填充弹窗 |
| `js/app.js:1108-1148` | `playVideo`——watch 链接构建 + currentEpisodes 写 localStorage |
| `js/app.js:1486-1713` | 搜索筛选 + 分页状态 |
| `js/ui.js:2-38` | `toggleSettings` 密码保护版本，桌面 vs 移动端分支 |
| `js/ui.js:41-113` | Toast 系统（`showToast` + 队列 `showNextToast`） |
| `js/ui.js:162-306` | 搜索历史管理（get/save/render/delete single/clear） |
| `js/ui.js:433-475` | 获取/载入观看历史，图标/梯度/分组绘制 |
| `js/ui.js:918-1040` | `playFromHistory`——集数同步校验 + 主页恢复 |
| `js/ui.js:1182-1241` | 清空观看记录面板 |
| `js/index-page.js` | 首屏声明、URL 搜索触发、实时时钟 |
| `js/utils.js:6-80` | 防抖、URL 验证、并发池、StorageManager |
| `js/douban.js:51-129` | 豆瓣初始化、标签行、推荐翻页 |
| `js/optimize-apply.js:26` | 并行池重写 → `window.search` |
| `js/mobile-panel-gestures.js:28-62` | 遮蔽层绑定与返回键 |
| `js/swipe-actions.js:29-55` | 左滑 → 删除开始 |
| `js/undo-toast.js:19-52` | 删除撤销气泡 |
| `js/daily-quote.js:1-50` | 获取/fallback 一句话 + 动画 |
| `js/version-check.js:30-100` | 双 URL 检查版本 + UI 提示 |
| `css/index.css` | 搜索栏/背景/按钮样式 |
| `css/modals.css` | 详情/密码/全集/导入导出样式 |
| `css/mobile-optimize.css` | 移动端滚动条/布局/卡片 |
| `css/mobile-panels-modern.css` | 侧边面板高亮美化 |

## 6. 已知约束 / 边界情况

- **密码门**：搜索、设置、详情全部检查 `ensurePasswordProtection()`——不通过就拒绝全部交互
- **默认源**：首次初始化选定 4 个源
- **搜索收敛**：最多 5 页（`API_CONFIG.search.maxPages`）
- **搜索历史限制**：上限 50 条，去重 + 最早淘汰
- **历史同步**：从 `viewingHistory` 异步获取 `/api/detail` 超时 10 秒 → 失败回退到缓存剧集
- **面板冲突**：同时只有一个面板(设置或历史)打开，打开一个关闭另一个
- **配置导入**：必须 JSON 格式 `{ name: "LibreTV-Settings" }`，`name` 验证通过 → 校验 SHA-256 指纹 → 写入所有存储
- **移动端面板**：底部方式 + back 键关闭 + 点击遮罩关闭；同一 overlay 共享
- **自定义 API 格式化**：`normalizeCustomAPI` 兼容两种格式（`adult` vs `isAdult` 差别归一）（`app.js:5-15`）
- **成人内容标记**：有 `api.adult` 属性 + tag "18+" → 检查 `yellowFilterEnabled` → 可见/隐藏列表
- **内存缓存**：`api.js` 内 apiCache 仅搜索 API 响应，非页面条件的数据持久化
- **localStorage 配额管理**：`StorageManager` 内置 5MB 上限，超出后保留 10 条（`utils.js:56-61`）

## 7. 相关文档

- 入口：[system-overview](system-overview.md)（第 2.2 节列出所有层关系）
- 搜索 API 缓存策略 / 代理师邮箱：[proxy-gateway](proxy-gateway.md)
