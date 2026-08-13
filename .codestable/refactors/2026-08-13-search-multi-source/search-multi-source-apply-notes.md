---
doc_type: refactor-apply-notes
refactor: 2026-08-13-search-multi-source
status: applying
---

# search-multi-source apply notes

## 步骤 1: 每源拉页上限 3→2（config.js maxPages）
- 完成时间: 2026-08-13
- 改动文件: js/config.js
- 验证结果: maxPages === 2；lint 0 错误（AI 自证）
- 偏离: 无
- HUMAN 验证: 待确认（结果数量略少、耗时下降、Network 每源最多 2 请求）

## 步骤 2: 取消在途旧请求 + 代际隔离
- 完成时间: 2026-08-13
- 改动文件: js/search.js（searchByAPIAndKeyWord 加可选 externalSignal 第三参；两处 fetch signal 合并 AbortSignal.any）、js/app.js（searchGeneration/searchAbortController 模块级；search() 内 myGen + abort 旧请求；主循环回调与 renderIncremental 代际校验；finally 代际保护）
- 验证结果: player.js:2136 调用点不传第三参兼容（grep 确认）；lint 0 错误（AI 自证）
- 偏离: 在 renderIncremental 开头额外加 myGen 校验，覆盖 100ms 节流 timer 异步触发路径（design 未显式列，属代际隔离自然延伸）
- HUMAN 验证: 待确认（连续搜索 Network 面板旧请求 abort；锁不被旧 finally 提前解锁）

## 步骤 3: 搜索首屏时间窗竞速
- 完成时间: 2026-08-13
- 改动文件: js/app.js（search() 内抽取 finalizeSearchResults；RACE_WINDOW_MS 2s Promise.race；早退不写缓存/不渲染空态；窗口后新结果 300ms 节流重收尾；partialLoadingHint 提示条；URL 更新移出 finalize 仅最终一次；raceTimer 清理）
- 验证结果: 结构复核（finalize 幂等、代际校验、竞速决出清理 timer）；lint 0 错误（AI 自证）
- 偏离: URL 更新从 finalize 内移到最终收尾前单独执行（避免早退+最终重复 pushState 堆历史）；resultsArray 变量删除（原仅定义未使用）
- 偏离（用户反馈）: 移除"正在加载剩余片源…"提示（partialLoadingHint 全部 UI 与调用点），竞速收尾逻辑保留，仅去掉提示条；grep partialHintEl|partialLoadingHint|showPartialLoadingHint|hidePartialLoadingHint 0 引用
- 偏离（用户反馈 2）: 分页显示时机收敛——finalizeSearchResults 增加 showPagination 参数，分页仅最终收尾渲染（早退/节流阶段隐藏，避免"分页先出现、数据又变"）；currentPage 重置从 finalize 移到 search() 起点（仅新搜索重置一次，收尾不再重置，翻页不被 300ms 节流重收尾打断）
- **回退（用户反馈 3）**: 移除 #1 竞速早退收尾与增量渲染全部逻辑——用户明确"等全部加载完再展示"。删除 RACE_WINDOW_MS/earlyFinalized/refinalizeTimer/runSearchSource/Promise.race、renderIncremental/scheduleIncrementalRender/incrementalTimer/firstRenderDone/renderedCount、showPagination 参数；finalizeSearchResults 恢复无参数单次调用；主循环恢复简单 allSettled 回调（保留代际校验 + externalSignal）；currentPage=1 保留在 search() 起点
- 保留生效项: #2 取消在途旧请求（代际隔离）✅ #3 同名去重 ✅ #4 maxPages 2 ✅；#1 仅保留"全部 settle 后一次性渲染"（未引入任何早退）
- 方案 D 落地（用户确认，统一资源切换口径）: 年份沿"卡片 onclick → showDetails → currentVideoYear → playVideo → player.html?year= → player.js"全链路透传；loadResourceSwitchList 有 year 时按 name+year 精确匹配（该源无同年版本则跳过，与 dedupeSearchResults 口径一致），无 year（最近观看/豆瓣/分享入口）降级 name-only 兼容；嵌套 player.html URL 同步 year
- review-fix（REV-001 blocking）: dedupeSearchResults else 分支幂等化——已 dedupe 数据（缓存命中 renderCachedResults 二次调用）保留已有 merged_sources，修复缓存路径徽标/统计被覆盖重置
- review 决策（REV-002 important）: 保留防御性 abort + 代际隔离（选项 a），不改防抖语义（避免行为变化）；#2"取消在途旧请求"实际为防御性死路径（防抖锁遮蔽），移入 residual-risk 记录
- HUMAN 验证: 待确认（搜索后骨架屏保持至全部源完成，结果/统计/筛选/分页一次性出现且稳定；播放页资源切换数与搜索卡片徽标数一致；缓存命中重搜徽标/统计与首次一致）

## 步骤 4: 同名多源结果去重合并
- 完成时间: 2026-08-13
- 改动文件: js/app.js（新增 dedupeSearchResults；finalizeSearchResults 与 renderCachedResults 接入去重；buildSearchCardHTML 来源数徽标；updateSearchStatistics/generateSearchFilters/applySearchFilters 按 merged_sources 展开）
- 验证结果: grep 引用一致（dedupe 定义 + 2 调用点；merged_sources 在统计/筛选/卡片 4 处展开）；lint 0 错误（AI 自证）
- 偏离: 无。播放入口为首个源，player.js 资源切换基于 selectedAPIs（非搜索结果），不受去重影响
- HUMAN 验证: 待确认（同名卡片合并 + N 个源徽标；统计数与卡片一致；按源筛选仍命中；同名不同年不误合并）
