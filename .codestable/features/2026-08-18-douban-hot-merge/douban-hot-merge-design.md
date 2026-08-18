---
doc_type: feature-design
feature: 2026-08-18-douban-hot-merge
requirement: ""
execution_lane: standard
status: approved
summary: 把豆瓣热门（网格区 doubanArea）合并进豆瓣热播轮播（recentWatchArea）：标签系统搬进轮播区，删除网格区与 doubanToggle 开关
tags: [home, douban, carousel, tags, merge]
---

# 豆瓣热门并入豆瓣热播轮播 — Design

## 0. 术语约定

| 术语 | 定义 | 防冲突结论 |
|---|---|---|
| 豆瓣热播轮播 | `recentWatchArea`（index.html），coverflow 轮播区 | 已有，不改名 |
| 豆瓣热门网格 | `doubanArea`（index.html），8 列卡片网格，本次删除 | 删除后无残留引用 |
| 标签条 | `#douban-tags` 容器 + 标签按钮（热门/最新/经典/自定义） | 保留 id 不变，容器位置从 doubanArea 迁到 recentWatchArea |
| 标签系统 | 标签数据 + 标签条渲染 + 管理标签 modal + localStorage 持久化 | 全部保留，迁移渲染目标 |
| doubanToggle / doubanEnabled | 设置面板豆瓣开关 + localStorage key | 本次移除 |

## 1. 决策与约束

**需求摘要**：
- 做什么：把「豆瓣热门」网格区（`doubanArea`）的标签系统搬进「豆瓣热播」轮播区（`recentWatchArea`），删除网格区；豆瓣热播轮播成为首页唯一豆瓣展示区，仍以 coverflow 轮播形式展示。
- 为谁：首页用户。合并后首页不再有两个内容重复的豆瓣区块。
- 成功标准：首页只出现一个豆瓣轮播区；轮播区有电影/电视剧切换 + 标签条 + 管理标签入口；切换标签/类型时轮播刷新对应影片；点击轮播卡片仍触发搜索。
- 明确不做：
  - 不保留豆瓣热门网格区（`doubanArea`、`douban-results`、8 列卡片网格渲染全部删除）
  - 不保留「换一批」按钮与分页（`douban-refresh`、`doubanPageStart`/`doubanPageSize` 分页逻辑删除）
  - 不保留 `doubanToggle` / `doubanEnabled`（设置面板开关、localStorage key、导出设置项全部移除）
  - 不保留 `fetchDoubanTags`（死代码，未被调用）
  - 不保留 `password.js` 中 doubanArea/doubanEnabled/initDouban 的密码解锁显示逻辑（密码解锁后轮播区由 recent-watch.js 独立渲染）
  - 不改轮播视觉/交互本身（延续上一 feature 的 coverflow 实现）

**复杂度档位**：走「静态前端 + 无构建」默认档位，无偏离。无 TypeScript/框架/测试框架引入。

**关键决策**：
1. **douban.js 重构为「豆瓣标签 + 数据 + 搜索」共享模块**（保留），删除网格渲染/开关/换一批/死代码。理由：`fetchDoubanData`、`fillAndSearchWithDouban`、标签系统都是 recent-watch.js 需要的共享能力，保留在 douban.js 避免重复实现；网格渲染与 doubanArea 绑定死亡。
2. **状态源统一**：recent-watch.js 删除自有 `doubanHotType`，改读写 douban.js 全局 `doubanMovieTvCurrentSwitch` / `doubanCurrentTag`。理由：标签条渲染（renderDoubanTags）已按这两个全局状态工作，避免双状态源分叉。
3. **标签点击联动**：`renderDoubanTags` 的标签 onclick 由「调 renderRecommend」改为「调 `window.updateRecentWatchVisibility`」（recent-watch.js 暴露的轮播刷新入口）。理由：数据渲染职责从 douban.js（网格）迁移到 recent-watch.js（轮播），跨模块通过既有全局契约联动。
4. **resetToHome 迁到 app.js**：原定义在 douban.js 且被 index.html 两处 onclick 依赖；重构后改为只调 `resetSearchArea()`（其内部已调用 `updateRecentWatchVisibility()`，见 app.js:743-745），作为首页编排逻辑放 app.js（既有 resetSearchArea 旁，属搬迁非新功能）。避免与 resetSearchArea 内既有调用双重触发。
5. **电影/电视剧切换复用 recent-watch.js 既有按钮**（doubanHotMovieBtn/TvBtn），切换时更新全局类型 + 重置标签为「热门」+ 重渲染标签条 + 刷新轮播。

被拒方案：把标签系统整体搬进 recent-watch.js 并删除 douban.js——`fetchDoubanData`/`fillAndSearchWithDouban` 仍无处安放，且 recent-watch.js 会膨胀；保留 douban.js 为共享模块更符合现有职责划分。

**前置依赖**：无。当前工作树有上一 feature（豆瓣热播轮播）与上一 issue（418 修复）的未提交改动，属于既定推进内容。

## 2. 名词与编排

### 2.1 名词层

**现状**：
- `douban.js`（743 行，全局函数风格）：标签数据（`defaultMovieTags`/`defaultTvTags`/`movieTags`/`tvTags`，localStorage key `userMovieTags`/`userTvTags`）、状态（`doubanMovieTvCurrentSwitch`、`doubanCurrentTag`、`doubanPageStart`/`doubanPageSize`）、`loadUserTags`/`saveUserTags`、`initDouban`（doubanToggle 开关绑定）、`updateDoubanVisibility`、`renderDoubanMovieTvSwitch`、`renderDoubanTags`（渲染到 `#douban-tags`）、`setupDoubanRefreshBtn`、`fetchDoubanTags`（死代码）、`renderRecommend`（渲染到 `#douban-results`）、`fetchDoubanData`（10s 超时 + ProxyAuth + allorigins fallback）、`renderDoubanCards`、`fillAndSearchWithDouban`、`resetToHome`、`showTagManageModal`/`addTag`/`deleteTag`/`resetTagsToDefault`
- `recent-watch.js`（IIFE，上一 feature 产物）：自有状态 `doubanHotType`、`cache`（{type, items, ts}）、`fetchDoubanSubjects`（硬编码 `type=${doubanHotType}&tag=热门`）、coverflow 渲染/交互、暴露 `window.updateRecentWatchVisibility`/`window.reloadRecentWatch`
- `index.html`：`doubanArea`（363-394 行，含 douban-movie-toggle/douban-tv-toggle/douban-refresh/douban-tags/douban-results）、设置面板 `doubanToggle`（249-260 行）、recentWatchArea（342-361 行）
- `app.js`：`doubanEnabled` 默认值（60）、`resetSearchArea` 内调 `updateDoubanVisibility`（738-740）、三处隐藏 doubanArea（844-845/912-913/957-960）、播放器开关时隐藏/显示 doubanArea（1460/1486-1488）、`settingsToExport` 含 `doubanEnabled`（1714）、`lazyLoadDoubanModule`（101/2226-2264）
- CSS：`#douban-results` 引用在 styles.css:1316、performance-optimize.css:75、mobile-optimize.css:135/150

**变化**：
- `douban.js` 重构：
  - 保留：标签数据四数组、`loadUserTags`/`saveUserTags`、状态 `doubanMovieTvCurrentSwitch`/`doubanCurrentTag`、`renderDoubanTags`（渲染目标不变 `#douban-tags`）、`showTagManageModal`/`addTag`/`deleteTag`/`resetTagsToDefault`、`fetchDoubanData`、`fillAndSearchWithDouban`
  - 删除：`doubanPageStart`/`doubanPageSize`、`initDouban`（开关部分，改为 DOMContentLoaded 只调 `loadUserTags()`）、`updateDoubanVisibility`、`renderDoubanMovieTvSwitch`、`setupDoubanRefreshBtn`、`fetchDoubanTags`、`renderRecommend`、`renderDoubanCards`、`resetToHome`（迁走）
  - 修改：`renderDoubanTags` 的标签 onclick 内 `renderRecommend(...)` 调用改为 `window.updateRecentWatchVisibility?.()`；`addTag`/`deleteTag`/`resetTagsToDefault` 内同理替换
- `recent-watch.js`：
  - 删除自有 `doubanHotType`，改用全局 `doubanMovieTvCurrentSwitch`/`doubanCurrentTag`
  - `fetchDoubanSubjects`：URL 改 `type=${doubanMovieTvCurrentSwitch}&tag=${encodeURIComponent(doubanCurrentTag)}`
  - `cache` 加 tag 维度：`{type, tag, items, ts}`，类型或标签变化即失效
  - 电影/电视剧切换（doubanHotMovieBtn/TvBtn onclick）：更新全局类型 + `doubanCurrentTag='热门'` + 调 `renderDoubanTags()`（douban.js 全局）+ 刷新轮播
  - init 时：确保 `loadUserTags()` 已执行 + 调 `renderDoubanTags()` 渲染标签条
- `index.html`：
  - 删除 `doubanArea` 整块（363-394）
  - 删除设置面板 `doubanToggle`（249-260）
  - recentWatchArea 标题行下新增标签条容器：
    ```html
    <div class="overflow-x-auto pb-2">
        <div id="douban-tags" class="flex space-x-2 min-w-max"></div>
    </div>
    ```
- `app.js`：
  - 删除 doubanEnabled 默认值（60）、resetSearchArea 内 updateDoubanVisibility 调用（738-740）、三处 doubanArea 隐藏（844-845/912-913/957-960）、播放器开关 doubanArea 显隐（1460/1486-1488）、settingsToExport 的 doubanEnabled（1714）、lazyLoadDoubanModule 定义与调用（101/2226-2264）
  - 新增 `resetToHome`（原 douban.js:524 搬迁）：只调 `resetSearchArea()`（内部已调 updateRecentWatchVisibility）；放在 resetSearchArea 定义旁
- `password.js`：删除 `hidePasswordModal` 内 doubanArea/doubanEnabled/initDouban 显示逻辑（224-231），密码解锁后轮播区由 recent-watch.js 自渲染
- CSS：删除 `#douban-results` 三处引用（styles.css:1316、performance-optimize.css:75、mobile-optimize.css:135/150）

**接口示例**：
```
// 轮播刷新入口（recent-watch.js 暴露，douban.js 标签操作调用）
window.updateRecentWatchVisibility()  // 触发轮播重新拉取并渲染当前类型+标签数据

// 标签条渲染（douban.js 提供，recent-watch.js 切换类型后调用）
renderDoubanTags()  // 渲染到 #douban-tags（recentWatchArea 内），标签 onclick → window.updateRecentWatchVisibility()

// 标签数据初始化（douban.js 提供，幂等）
loadUserTags()  // 从 localStorage userMovieTags/userTvTags 加载，无则用默认
```
// 来源：douban.js renderDoubanTags/loadUserTags；recent-watch.js window.updateRecentWatchVisibility

### 2.2 编排层

**现状**：两个独立分支——
- doubanArea 分支：`initDouban`（doubanToggle 开关）→ `renderDoubanMovieTvSwitch`/`renderDoubanTags`/`setupDoubanRefreshBtn` → `renderRecommend`（网格）
- recentWatchArea 分支：recent-watch.js `init` → `render`（拉「热门」数据 → coverflow）

**变化**：合并为单分支（recent-watch.js 主导）：
```
DOMContentLoaded
  → douban.js: loadUserTags()            // 标签数据加载
  → recent-watch.js: renderDoubanTags()  // 渲染标签条（含管理按钮）
  → recent-watch.js: render()            // 拉取当前类型+标签数据 → coverflow 渲染 → 自动轮流
事件：
  电影/电视剧切换 → 更新 doubanMovieTvCurrentSwitch + doubanCurrentTag='热门'
                   → renderDoubanTags() → render()
  标签点击 → doubanCurrentTag=tag → window.updateRecentWatchVisibility()
  管理标签（增/删/恢复默认）→ saveUserTags → renderDoubanTags() → window.updateRecentWatchVisibility()
  搜索/播放器开关 → app.js 隐藏 recentWatchArea（既有逻辑，doubanArea 相关删除）
  密码解锁 → password.js hidePasswordModal（删除豆瓣解锁显示分支，轮播区已独立渲染）
  关闭播放器/返回首页 → resetToHome()（app.js）→ resetSearchArea() + updateRecentWatchVisibility()
```
线性流程，无需图。

**流程级约束**：
- 错误语义：豆瓣拉取失败沿用 recent-watch.js 既有空态/隐藏降级，不新增
- 幂等性：`loadUserTags` 幂等（多次调用无害）；`renderDoubanTags` 每次全量重建 DOM，无累积
- 并发/顺序：recent-watch.js 既有 `renderRequestId` 竞态保护延续（类型/标签快速切换时旧请求作废）；douban.js 的 `renderRequestId` 随网格渲染一并删除
- 扩展点：标签数据/渲染/管理仍是 douban.js 全局函数，未来新增豆瓣源可复用
- 可观测点：console.warn 仅 `fetchDoubanData` 不可用时输出（既有）

### 2.3 挂载点清单

1. `index.html`：`#douban-tags` 容器迁入 recentWatchArea — 修改
2. `index.html`：删除 `doubanArea` 块 + 设置面板 `doubanToggle` — 删除
3. `douban.js`：全局标签函数（`loadUserTags`/`renderDoubanTags`/`showTagManageModal`/`addTag`/`deleteTag`/`resetTagsToDefault`）+ 全局状态（`doubanMovieTvCurrentSwitch`/`doubanCurrentTag`）— 保留并改造渲染目标
4. `window.updateRecentWatchVisibility`：跨模块轮播刷新契约（recent-watch.js 暴露，douban.js 调用）— 修改
5. `password.js`：删除 `hidePasswordModal` 内 doubanArea/doubanEnabled/initDouban 解锁显示逻辑 — 删除
6. localStorage：`userMovieTags`/`userTvTags` 保留；`doubanEnabled` key 不再写入/读取/导出 — 删除

### 2.4 推进策略

1. 静态结构：index.html 删 doubanArea/doubanToggle + recentWatchArea 加标签条容器
   退出信号：页面无 doubanArea/doubanToggle DOM，recentWatchArea 内出现 `#douban-tags` 容器
2. 共享模块重构：douban.js 删网格/开关/换一批/死代码，保留标签+数据+搜索；renderDoubanTags 的 onclick 改调轮播刷新；resetToHome 移除
   退出信号：douban.js 无 `douban-results`/`douban-refresh`/`doubanEnabled`/`renderRecommend` 引用，lint 0 报错
3. 状态接入与联动：recent-watch.js 改用全局类型/标签、cache 加 tag、电影/电视剧切换联动标签、init 渲染标签条
   退出信号：recent-watch.js 无 `doubanHotType`，lint 0 报错
4. app.js 清理 + resetToHome 搬迁 + password.js 清理 + CSS 清理
   退出信号：app.js 无 doubanArea/doubanEnabled/lazyLoadDoubanModule 引用；password.js 无 doubanArea/doubanEnabled/initDouban 引用；CSS 无 `#douban-results`
5. 联调收尾：浏览器验证全部验收场景

### 2.5 结构健康度与微重构

**评估**：
- 文件级 — `douban.js`：743 行，职责混杂（标签/网格/开关/换一批/数据/搜索）。本次重构删除约 300 行网格与开关代码，剩余约 400 行单一主题（豆瓣标签+数据+搜索），不再超 500 行。
- 文件级 — `recent-watch.js`：~340 行（上一 feature 产物），新增标签联动约 +30 行，职责仍为单一 coverflow 模块。
- 文件级 — `app.js`：本 feature 对它是净删除（清理 douban 引用）+ 搬入 ~4 行 resetToHome，无膨胀。
- 目录级 — `js/`：21 个平铺文件，本次不新增文件，无摊平恶化。
- 评估前 compound 检索：`grep -rE "目录|命名|归属" .codestable/compound/` 已执行，无相关 convention 命中。

**结论**：不做微重构（douban.js 删除大量死代码即瘦身，无需拆文件；不新增文件，目录无摊平问题）。

**超出范围的观察**：
- `douban.js` 仍偏「工具库」风格（全局函数无模块封装）——既有结构，非本 feature 引入，建议后续可走 `cs-refactor` 评估 IIFE 化，不阻塞本次。
- 封面代理 URL 构造在 `douban.js:482`（`PROXY_URL + encodeURIComponent`）与 recent-watch.js（`'→%27`）不一致（上一 issue review REV-005 已记录）——本次顺带不处理。

## 3. 验收契约

**关键场景清单**：
| # | 输入/触发 | 期望可观察结果 | 证据类型 |
|---|---|---|---|
| S1 | 打开首页 | 仅一个豆瓣轮播区（recentWatchArea），无 doubanArea 网格；轮播区有标题、电影/电视剧切换、标签条（含「管理标签」）、coverflow 卡片 | 浏览器截图 |
| S2 | 点击标签「经典」 | 轮播刷新为经典标签影片，标签高亮迁移；卡片仍走代理可加载（无 418） | 浏览器截图 |
| S3 | 点击「电视剧」再点标签 | 标签条切换为 tvTags，类型高亮迁移，标签重置「热门」，轮播显示电视剧 | 浏览器截图 |
| S4 | 管理标签：添加/删除/恢复默认 | modal 正常；操作后标签条与轮播联动刷新；localStorage userMovieTags/userTvTags 正确持久化；删除「热门」被拒 | 浏览器截图 + localStorage 检查 |
| S5 | 点击轮播卡片 | 触发 `fillAndSearchWithDouban` 搜索，搜索框填充标题，结果区显示 | 浏览器观察 |
| S6 | 设置面板 | 无「豆瓣热门推荐」开关；导出设置 JSON 无 doubanEnabled | 浏览器观察 + JSON 检查 |
| S7 | 搜索/播放器开关 | recentWatchArea 隐藏；关闭播放器/返回首页显示 | 浏览器观察 |

**明确不做的反向核对项**：
- `index.html` 不包含 `doubanArea`/`doubanToggle`/`douban-results`/`douban-refresh`/`douban-movie-toggle`/`douban-tv-toggle`
- `app.js` 不包含 `doubanEnabled`/`lazyLoadDoubanModule`/`doubanArea`
- `password.js` 不包含 `doubanArea`/`doubanEnabled`/`initDouban`
- CSS 不包含 `#douban-results`
- `douban.js` 不包含 `renderRecommend`/`renderDoubanCards`/`douban-refresh`/`fetchDoubanTags`/`doubanPageStart`/`doubanPageSize`/`updateDoubanVisibility`/`renderDoubanMovieTvSwitch`

**Acceptance Coverage Matrix**：

| Scenario | Covered By Step | Evidence Type | Command / Action | Core? |
|---|---|---|---|---|
| S1 首页唯一豆瓣轮播区 | S1 | 浏览器截图 | 打开首页肉眼验证 | yes |
| S2 标签切换刷新轮播 | S3 | 浏览器截图 | 点击「经典」标签 | yes |
| S3 电视剧+标签联动 | S3 | 浏览器截图 | 点「电视剧」后点标签 | yes |
| S4 管理标签持久化 | S3/S4 | 浏览器截图 + localStorage 检查 | 增删标签后查 userMovieTags | yes |
| S5 点击卡片搜索 | S3 | 浏览器观察 | 点击轮播卡片 | yes |
| S6 无豆瓣开关/导出无 key | S4 | 浏览器观察 + JSON 检查 | 打开设置面板 + 导出设置 | yes |
| S7 搜索/播放显隐 | S4 | 浏览器观察 | 搜索 + 播放器开关 | yes |

**DoD Contract**：

| ID | 要求 | 证据 | 阻塞级别 |
|---|---|---|---|
| DOD-DESIGN-001 | design 自身完整且关键契约可执行 | design review | blocking |
| DOD-IMPL-001 | checklist steps 全部完成且实现证据落盘 | checklist / evidence | blocking |
| DOD-REVIEW-001 | code review passed 且无 unresolved blocking | review report | blocking |
| DOD-QA-001 | QA 覆盖核心场景和必跑命令 | QA report | blocking |
| DOD-ACCEPT-001 | acceptance 完成回写和最终审计 | acceptance report | blocking |

Validation Commands:

| ID | 命令 | 目的 | 核心性 | 失败处理 |
|---|---|---|---|---|
| CMD-001 | `node --check` 或 read_lints（js/douban.js、js/recent-watch.js、js/app.js） | 语法校验 | core | fix-or-block |
| CMD-002 | `npm run dev` + 浏览器手动验证 | 联调验收 | core | fix-or-block |
| CMD-003 | grep 反向核对（无 doubanArea/doubanEnabled/douban-results 残留） | 删除范围确认 | supporting | fix-or-block |

Required Artifacts: review / QA / acceptance / browser screenshots / grep 输出。

## 4. 与项目级架构文档的关系

本 feature 改动局限在首页豆瓣展示模块内部（douban.js + recent-watch.js + index.html + app.js 清理），合并两个豆瓣区块为一个轮播区。不引入系统级可见的新实体/接口（跨模块契约 `window.updateRecentWatchVisibility` 为既有）。无系统级可见变化，不需要更新 CONTEXT 术语表或写 ADR。
