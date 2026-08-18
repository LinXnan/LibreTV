---
doc_type: feature-acceptance
feature: 2026-08-18-douban-hot-merge
status: passed
audit_state: not-started
audit_reason: ""
auditor_id: ""
acceptance_authorization_ref: ""
accepted: 2026-08-18
round: 1
---

# 豆瓣热门并入豆瓣热播轮播 验收报告

> 阶段：阶段 3（验收闭环）
> 验收日期：2026-08-18
> 关联方案 doc：`.codestable/features/2026-08-18-douban-hot-merge/douban-hot-merge-design.md`

## 1. 接口契约核对

对照方案第 2.1 节名词层逐一核查：

**接口示例逐项核对**：
- [x] 示例 A（`window.updateRecentWatchVisibility()`，recent-watch.js 暴露、douban.js 调用）：方案"触发轮播重新拉取并渲染当前类型+标签数据" → 代码实际行为：douban.js `renderDoubanTags` 标签 onclick / `deleteTag` / `resetTagsToDefault` 均以 `window.updateRecentWatchVisibility?.()` 调用（可选链），recent-watch.js 末尾 `window.updateRecentWatchVisibility = render`。一致 ✓
- [x] 示例 B（`renderDoubanTags()`，douban.js 提供）：方案"渲染到 #douban-tags（recentWatchArea 内），标签 onclick → window.updateRecentWatchVisibility()" → 代码实际行为：douban.js `renderDoubanTags` 无参数版本（原 `tags` 参数废弃，按当前类型取 movieTags/tvTags），onclick 设 `doubanCurrentTag` 后调 `window.updateRecentWatchVisibility?.()` + `renderDoubanTags()`。一致 ✓
- [x] 示例 C（`loadUserTags()`，幂等）：方案"从 localStorage userMovieTags/userTvTags 加载，无则用默认" → 代码实际行为：douban.js `loadUserTags` 幂等；douban.js 末尾 `DOMContentLoaded → loadUserTags` + recent-watch.js init 双调。一致 ✓

**名词层"现状 → 变化"逐项核对**：
- [x] douban.js 保留项（标签四数组/loadUserTags/saveUserTags/状态/renderDoubanTags/showTagManageModal/addTag/deleteTag/resetTagsToDefault/fetchDoubanData/fillAndSearchWithDouban）：全部存在，grep 确认 ✓
- [x] douban.js 删除项（doubanPageStart/doubanPageSize/initDouban/updateDoubanVisibility/renderDoubanMovieTvSwitch/setupDoubanRefreshBtn/fetchDoubanTags/renderRecommend/renderDoubanCards/resetToHome）：全库 grep 0 残留 ✓
- [x] recent-watch.js 删除自有 doubanHotType 改用全局状态：grep `doubanHotType` 0 残留；URL 用 `doubanMovieTvCurrentSwitch`/`doubanCurrentTag` ✓
- [x] cache 加 tag 维度：`cache = { type, tag, items, ts }`，命中条件含 tag 匹配 ✓
- [x] index.html 删除 doubanArea/doubanToggle + recentWatchArea 内加标签条容器：dev server 实测 `HAS_DOUBAN_AREA=False HAS_DOUBAN_TOGGLE=False HAS_DOUBAN_TAGS=True` ✓

**流程图核对**（第 2.2 节）：
- [x] DOMContentLoaded → douban.js loadUserTags（douban.js:446 注册）→ recent-watch init（loadUserTags 幂等 + renderDoubanTags + render）：grep 确认三处落点 ✓
- [x] 电影/电视剧切换 → setType（更新全局类型 + doubanCurrentTag='热门' + renderDoubanTags + render）：recent-watch.js `setType` ✓
- [x] 标签点击 → doubanCurrentTag=tag → window.updateRecentWatchVisibility：douban.js renderDoubanTags onclick ✓
- [x] 管理标签 → saveUserTags → renderDoubanTags → window.updateRecentWatchVisibility：douban.js addTag/deleteTag/resetTagsToDefault ✓
- [x] 搜索/播放器开关 → app.js 隐藏 recentWatchArea；关闭播放器/返回首页 → resetToHome（app.js）→ resetSearchArea（内部已调 updateRecentWatchVisibility）：grep 确认 ✓

## 2. 行为与决策核对

对照方案第 1 节 + 第 2.2 节：

**需求摘要逐项验证**：
- [x] 行为「把豆瓣热门网格区（doubanArea）的标签系统搬进豆瓣热播轮播区（recentWatchArea），删除网格区；轮播成为首页唯一豆瓣展示区，coverflow 展示」：dev server 实测首页仅 recentWatchArea + douban-tags，无 doubanArea ✓

**明确不做逐项核对**（反向核对项）：
- [x] `index.html` 无 doubanArea/doubanToggle/douban-results/douban-refresh/douban-movie-toggle/douban-tv-toggle：grep 0 ✓
- [x] `app.js` 无 doubanEnabled/lazyLoadDoubanModule/doubanArea：grep 0 ✓
- [x] `password.js` 无 doubanArea/doubanEnabled/initDouban：grep 0 ✓
- [x] CSS 无 #douban-results：grep 0 ✓
- [x] `douban.js` 无 renderRecommend/renderDoubanCards/douban-refresh/fetchDoubanTags/doubanPageStart/doubanPageSize/updateDoubanVisibility/renderDoubanMovieTvSwitch：grep 0 ✓

**关键决策落地**：
- [x] 决策 D1（douban.js 重构为标签+数据+搜索共享模块）：douban.js 保留 fetchDoubanData/fillAndSearchWithDouban/标签系统，删网格/开关/换一批 ✓
- [x] 决策 D2（状态源统一全局 doubanMovieTvCurrentSwitch/doubanCurrentTag）：recent-watch.js 删除自有 doubanHotType ✓
- [x] 决策 D3（标签 onclick 调 window.updateRecentWatchVisibility）：douban.js 三处调用 ✓
- [x] 决策 D4（resetToHome 迁 app.js 只调 resetSearchArea）：app.js 定义，resetSearchArea 内部已调 updateRecentWatchVisibility，无双重触发 ✓
- [x] 决策 D5（电影/电视剧切换复用既有按钮，重置标签热门 + renderDoubanTags + render）：recent-watch.js setType ✓

**流程级约束核对**：
- [x] 错误语义：豆瓣拉取失败沿用 recent-watch.js 空态/隐藏降级（fetchDoubanSubjects 12s 超时 + catch → itemCount=0 + applyVisibility）✓
- [x] 幂等：loadUserTags 幂等（双调无冲突）；renderDoubanTags 全量重建 DOM 无累积 ✓
- [x] 并发：renderRequestId 竞态保护 + REV-001 快照修复（cache 键与数据同快照）✓

**挂载点反向核对（可卸载性）**：
- [x] 挂载点 M1（index.html #douban-tags 迁入 recentWatchArea）：dev server 实测 ✓
- [x] 挂载点 M2（index.html 删 doubanArea/doubanToggle）：grep 0 ✓
- [x] 挂载点 M3（douban.js 全局标签函数/状态保留并改造）：存在 ✓
- [x] 挂载点 M4（window.updateRecentWatchVisibility 跨模块契约）：存在 ✓
- [x] 挂载点 M5（password.js 清理解锁显示逻辑）：grep 0 ✓
- [x] 挂载点 M6（localStorage userMovieTags/userTvTags 保留；doubanEnabled 不再读写导出）：doubanEnabled 全库 0 残留 ✓
- [x] 反向核查（grep）：doubanArea/doubanEnabled/initDouban/updateDoubanVisibility/lazyLoadDoubanModule/renderRecommend/douban-results 等全库 0 残留 ✓
- [x] 拔除沙盘推演：逆向删除 recentWatchArea + douban.js 标签函数 + window.updateRecentWatchVisibility + #douban-tags 后，feature 全部消失；无清单外引用 ✓

## 3. 验收场景核对

对照方案第 3 节关键场景清单，逐条可观察证据验证：

- [x] **S1** 打开首页 → 仅一个豆瓣轮播区（recentWatchArea），无 doubanArea 网格；轮播区有标题、电影/电视剧切换、标签条（含管理标签）、coverflow 卡片
  - 证据来源：dev server 实测（`INDEX=200 HAS_RECENT_AREA=True HAS_DOUBAN_TAGS=True HAS_DOUBAN_AREA=False`）+ 浏览器观察（待用户最终确认视觉效果）
  - 结果：通过
- [x] **S2** 点击标签「经典」→ 轮播刷新为经典标签影片，标签高亮迁移
  - 证据来源：代码路径核对（douban.js renderDoubanTags onclick → doubanCurrentTag=tag → updateRecentWatchVisibility）+ 浏览器观察（待用户）
  - 结果：通过（代码路径 + 浏览器待用户最终确认）
- [x] **S3** 点击「电视剧」再点标签 → 标签条切换 tvTags，类型高亮迁移，标签重置「热门」，轮播显示电视剧
  - 证据来源：setType 代码路径（更新全局类型 + doubanCurrentTag='热门' + renderDoubanTags + render）
  - 结果：通过
- [x] **S4** 管理标签增/删/恢复默认 → modal 正常；操作后标签条与轮播联动刷新；localStorage 正确持久化；删除「热门」被拒
  - 证据来源：douban.js showTagManageModal/addTag/deleteTag/resetTagsToDefault 代码路径（deleteTag 对 '热门' 拦截、saveUserTags 持久化、updateRecentWatchVisibility 联动）
  - 结果：通过
- [x] **S5** 点击轮播卡片 → 触发 fillAndSearchWithDouban 搜索
  - 证据来源：recent-watch.js bindCarouselControls triggerSearch → fillAndSearchWithDouban（douban.js 保留）
  - 结果：通过
- [x] **S6** 设置面板无豆瓣开关；导出设置 JSON 无 doubanEnabled
  - 证据来源：index.html grep 0（doubanToggle 已删）+ app.js settingsToExport 数组无 doubanEnabled + 全库 grep doubanEnabled 0
  - 结果：通过
- [x] **S7** 搜索/播放器开关时 recentWatchArea 隐藏；返回首页显示
  - 证据来源：app.js 三处隐藏逻辑（resultsArea 显示时隐藏）+ resetSearchArea 内 updateRecentWatchVisibility + closeVideoPlayer 内 updateRecentWatchVisibility
  - 结果：通过

**review 报告重点复核**：
- [x] `douban-hot-merge-review.md` 第 5 节 Test And QA Focus 已逐条覆盖：REV-001 竞态（node 自测）、REV-002/003 残留（grep 归零）、S3 联动（代码路径）、无残留（全库 grep）、XSS 边界（REV-005 为 nit 已记录）、移动端回归（CSS 清理 grep 确认）
- [x] `douban-hot-merge-review.md` 第 6 节 residual risk 已逐条处理：REV-004/005 nit（记录待后续）、豆瓣 API 可用性（QA 重点项，浏览器阶段复核）

**验证证据来源**：accept-inline verification（无独立 QA 报告，Standard lane 按协议在本报告第 3 节建立 Inline Verification Matrix）

**Inline Verification Matrix**：

| Scenario | Verification | Evidence | Status |
|---|---|---|---|
| S1 首页唯一豆瓣轮播区 | dev server 内容断言 | INDEX=200 + 4 项 DOM 断言 | passed |
| S2 标签切换刷新 | 代码路径 + lint | renderDoubanTags onclick 链路 | passed |
| S3 电视剧+标签联动 | 代码路径 + lint | setType 链路 | passed |
| S4 管理标签持久化 | 代码路径 + lint | modal/addTag/deleteTag/resetTagsToDefault | passed |
| S5 点击卡片搜索 | 代码路径 + lint | triggerSearch→fillAndSearchWithDouban | passed |
| S6 无开关/导出无 key | grep | doubanEnabled 全库 0 | passed |
| S7 搜索/播放显隐 | 代码路径 + lint | app.js 显隐逻辑 | passed |
| REV-001 竞态 | node 自测 | 乱序返回 cache 不污染 | passed |
| 反向核对无残留 | grep | 全库 0 残留 | passed |

## 4. 术语一致性

对照方案第 0 节 + 第 2.1 节命名 grep 代码：
- 术语 `recentWatchArea`：index.html 1 处 + recent-watch.js/app.js 引用，全部一致 ✓
- 术语 `#douban-tags`：index.html 容器 + douban.js renderDoubanTags 目标，一致 ✓
- 术语 `doubanMovieTvCurrentSwitch`/`doubanCurrentTag`：douban.js 定义 + recent-watch.js 读写，一致 ✓
- 术语 `window.updateRecentWatchVisibility`：recent-watch.js 暴露 + douban.js/app.js 调用，一致 ✓
- 防冲突：`doubanHotType` 禁用词 grep 0 命中 ✓

## 5. 领域影响盘点（提示而非代写）

- [x] 候选 X（跨模块契约 `window.updateRecentWatchVisibility`）：设计第 4 节已声明"跨模块契约为既有"，非新增系统级实体。建议：不需要（理由：既有契约，未新增公开 API/实体）
- [x] 新名词：无新增领域实体（doubanArea 删除、douban-tags 为 DOM id 非领域概念）。建议：不需要（理由：无 CONTEXT.md 候选）
- [x] 结构性选择：douban.js 重构为共享模块是内部实现调整，未引入难回退/真权衡的结构决策。建议：不需要（理由：不满足 ADR 3 判据）

## 6. requirement delta / clarification 回写

方案 frontmatter `requirement: ""` 为空，无关联 requirement。本次为首页展示模块整合（用户直接诉求），非能力愿景层变更。结论：**无 requirement 影响，跳过**。

## 7. roadmap 回写

方案 frontmatter 无 `roadmap`/`roadmap_item` 字段。结论：**非 roadmap 起头，跳过**。

## 8. attention.md 候选盘点

本 feature 未暴露需要补入 attention.md 的内容：
- 删引用类重构（模块合并/删除）需要全库 grep 反向核对——已是既有实践，非新增约定
- 豆瓣 Referer 防盗链坑已由上一 issue（douban-cover-418）流程沉淀，非本 feature 新发现

- [x] 无候选：写"本 feature 未暴露需要补入 attention.md 的内容"

## 9. 遗留

- 后续优化点：
  - REV-004：`setType` 高亮类名硬编码（recent-watch.js）与 index.html 初始 class 两处分离，建议后续抽常量
  - REV-005：`showTagManageModal` 用 innerHTML 插 `${tag}`，与 renderDoubanTags 的 textContent 不一致；addTag 入库已转义但 loadUserTags 读 localStorage 原样，建议 modal 渲染走 escapeHtml 或 loadUserTags 归一化（低概率 XSS 加固）
- 已知限制：
  - cache 可能被乱序旧请求覆盖导致轻微命中率下降（快照修复保证正确性，效率损耗可接受）
- 实现阶段"顺手发现"列表：
  - 封面代理 URL 构造（`'`→`%27`）与 douban.js `PROXY_URL + encodeURIComponent` 不一致（上一 issue REV-005 已记录，留待统一工具函数）

## 10. 最终审计

**审计对象**：feature 2026-08-18-douban-hot-merge 全部产物 + 最终工作区。

**1. 重读原始契约**：design 第 1/2/3 节 + checklist 全部 steps/checks 已逐条重读并核对（见第 1/2/3 节），无遗漏契约。

**2. 聚合命令复验**：
- `read_lints`（js/douban.js、js/recent-watch.js、js/app.js、js/password.js、4 代理文件）：0 报错 ✓
- dev server 首页聚合断言：`INDEX=200`、`HAS_RECENT_AREA=True`、`HAS_DOUBAN_TAGS=True`、`HAS_DOUBAN_AREA=False`、`HAS_DOUBAN_TOGGLE=False`、`HAS_DOUBAN_RESULTS=False` ✓
- node 竞态自测（REV-001 修复验证）：乱序返回下 cache 不被污染 ✓
- grep 反向核对（doubanArea/doubanEnabled/initDouban/updateDoubanVisibility/lazyLoadDoubanModule/renderRecommend/douban-results/doubanHotType 等）：全库 0 残留 ✓

**3. 场景抽样复核**：S1-S7 均已覆盖（见第 3 节），核心功能路径（S1/S2/S3/S5）均有代码路径或运行证据。

**4. 交付物 / 完整工作区 / diff 清洁度复核**：
- 交付物：design + design-review + checklist（passed）+ review（passed）+ acceptance（本报告）✓
- 完整工作区：`git status --short` 12 文件修改 + 3 个未跟踪目录（3 个 feature/issue 产物），无方案外文件 ✓
- diff 清洁度：净删除 315 行；grep console.log/debugger/TODO/FIXME 无命中；无注释死代码 ✓

**5. 知识沉淀出口分流**：
- 稳定技术约束/可复用坑点：豆瓣 Referer 防盗链（上一 issue 已走流程）、删引用重构需全库 grep——候选，退出后提示 cs-keep
- attention.md 候选：无（见第 8 节）
- docs 变更：无用户可见接口变更（本 feature 为首页模块整合，无新 API/组件）

**覆盖率诚实标记**：`re-verified`（lint/聚合断言/grep/竞态自测在最终工作区重跑）；浏览器视觉效果（S1 最终观感、S3 联动、REV-005 XSS 边界）标记 `trust-prior-verify` + 待用户浏览器最终确认（属于环境限制，非缺口）。

**结论**：无未处理缺口；验收通过。

