# 搜索增量渲染必须用追加式，整体重建 innerHTML 会导致空白闪烁

## 背景

2026-08-09 做搜索性能优化（refactor `2026-08-09-search-latency`）：批次串行改全量并发、加增量渲染（先到先展示）。初版增量渲染每次有源返回都调用 `renderSearchResults()`，它整体重建 `resultsDiv.innerHTML`。用户实测反馈："结果数一直在新增（计数在涨），但影片卡片一直空白，直到结果不再新增才显示"。

## 结论

1. **增量渲染必须追加式，不能整体重建 innerHTML**：`resultsDiv.innerHTML = ...` 每次会把已渲染的卡片 DOM 全部销毁重建，其中 `loading="lazy"` 的 `<img>` 在加载完成前被销毁，重新插入后又要重新发起加载，导致图片永远处于加载中、视觉上整块空白。改成 `resultsDiv.insertAdjacentHTML('beforeend', newItems.map(buildSearchCardHTML).join(''))` 只把新增结果追加到尾部，已渲染卡片与图片节点保持不动，图片能正常加载完。
2. **首源返回立即渲染，后续源再节流**：初版对所有增量都走 100ms `setTimeout` 节流，导致第一个源返回后还要等 100ms 才出首屏，体感仍是"空白"。改为 `firstRenderDone` 标志——首个源返回同步立即渲染，后续源才 100ms 节流合并，兼顾"先到先展示"与减少 DOM 操作。
3. **卡片 HTML 抽成独立函数 `buildSearchCardHTML(item)`**：增量渲染与最终渲染共用同一构建函数，保证卡片结构一致；追加式增量渲染需要按"已渲染数量 `renderedCount`"切片新增项，避免重复追加。
4. **最终渲染（排序后）仍整体重建是必要的**：增量渲染展示的是"到达顺序"（未排序），最终渲染按延迟排序后整体重建以呈现正确顺序。在 `await` 结束后要 `clearTimeout(incrementalTimer)` 并重置 `firstRenderDone = false`，避免下一次搜索被旧状态影响。
5. **末尾补占位卡片保持网格高度**：末页不足一页时补 `visibility:hidden` 的占位卡片（结构与真实卡片一致：固定 150px 图片容器 + 文字区），避免分页栏因网格变矮而跳动。占位卡片与真实卡片同结构才能撑起同样的行高，空 div 行高会塌陷。
6. **搜索并发从"批次串行（每批 3 个）"改"全量并发"**：批次串行总耗时 = 各批最慢之和（最坏 4×8s=32s），全量并发降为全局最慢源耗时；浏览器对同源 `/proxy/` 连接池（约 6）会自然限制实际并发，无需应用层限流。

## 证据

- `js/app.js:866-890` — `renderIncremental` / `scheduleIncrementalRender`：首源立即渲染 + 后续 100ms 节流 + `insertAdjacentHTML('beforeend', ...)` 追加式渲染 + `renderedCount` 切片
- `js/app.js:1784` — `buildSearchCardHTML(item)`：抽出的卡片构建函数，增量与最终渲染共用
- `js/app.js:1879-1891` — `renderSearchResults`：末页不足 `itemsPerPage` 时补 `visibility:hidden` 占位卡片（复用真实卡片内部结构）
- `js/app.js:89-91` — `searchWithConcurrencyLimit`：批次循环删除，改 `Promise.allSettled` 全量并发
- 用户实测：`2026-08-09` 增量渲染整体重建版 → "计数涨但卡片空白"；改追加式后恢复正常
