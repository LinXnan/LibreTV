---
doc_type: refactor-apply-notes
refactor: 2026-08-09-search-latency
status: apply-complete
---

# 变更总览

- 9 文件变更：+66 / -464
- 所有 7 步 AI 侧退出信号已满足，lint 0 错误，全部 JS/MJS 语法通过
- 待 HUMAN 验证项（checklist 中 human_checkpoint）：
  1. 搜索多源并发（Network 面板）
  2. 结果数量变少（maxPages 3）、耗时下降
  3. 失效源约 4s 放弃、可用源正常
  4. 失效源不出现于请求
  5. 增量渲染首条 <2s、最终统计/筛选/分页正确

## Review

- 2026-08-09 code review: passed（reviewer: subagent，环节 A 独立 agent 完成，OCR 不可用跳过）
- review 发现 REV-001（searchWithConcurrencyLimit 内联后成死函数）已修复：删除函数，grep 0 引用
- review 发现 getApiPageSize 被误删已恢复（101/171 行仍引用）
- 1 条 nit（incrementalTimer 与 design 命名差异）非阻塞

## 回归修复（用户反馈，2026-08-09）

- 问题：用户搜索"灭人者"时看到"找到 44 个结果 来自 9 个片源"已显示，但媒体卡片网格长期空白一段时间后突然出现
- 根因：步骤 7 增量渲染的 100ms setTimeout 节流让首源返回时也要等 100ms 才渲染，加上浏览器对同源 `/proxy/` 连接限制约 6 个并发，叠加体感成"空白"
- 修复：增量渲染改为"首源立即渲染（firstRenderDone=false），后续源 100ms 节流合并"
- 改动：js/app.js search() 增量渲染块（860-883 替换 + 900 行加 firstRenderDone = false 重置）
- 影响：首个源返回立刻显示第一批结果，体感"瞬间出现"；后续源仍 100ms 内合并渲染防止频繁 DOM 重建
- 验证：node --check 通过；lint 0 错误
- 非阻塞：firstRenderDone 局部变量在 search() 内，每次搜索进入新作用域，无需外部重置；await 后清 timer + 重置 flag 双重保险避免下次搜索首源被节流

# search-latency apply notes

## 步骤 1: 清理搜索链路死代码（optimize-apply 并发函数 / api.js 聚合搜索与 apiCache / AGGREGATED_SEARCH_CONFIG）
- 完成时间: 2026-08-09
- 改动文件: js/optimize-apply.js、js/api.js、js/config.js
- 验证结果: 死代码标识符 js/ 下 0 引用；handleApiRequest / handleCustomApiSpecialDetail / handleSpecialSourceDetail 保留；lint 0 错误
- 偏离: 发现 window.concurrentPool 实际存在于 js/utils.js:477（scan 中"不存在"判断有误），但 applySearchConcurrency 调用点被注释、从未执行，删除不影响行为。CUSTOM_API_CONFIG 现已无使用者但不在本次范围，保留。CLAUDE.md 仍描述 apiCache//api/search（文档残留，未改）

## 步骤 2: searchCache 加 LRU 上限（50 条）
- 完成时间: 2026-08-09
- 改动文件: js/app.js
- 验证结果: searchCache.set 后加 size>50 淘汰最旧；lint 0 错误
- 偏离: 无

## 步骤 3: 搜索批次串行改为全量并发
- 完成时间: 2026-08-09
- 改动文件: js/app.js（searchWithConcurrencyLimit 89-91）
- 验证结果: 函数体改为 Promise.allSettled 全量并发；lint 0 错误
- 偏离: 保留 limit 参数未用（避免改调用方），注释说明浏览器同源代理连接池自然限流

## 步骤 4: 降 maxPages 5→3
- 完成时间: 2026-08-09
- 改动文件: js/config.js
- 验证结果: maxPages=3；lint 0 错误
- 偏离: 无

## 步骤 5: 前端超时 + 4 平台代理超时/重试对齐
- 完成时间: 2026-08-09
- 改动文件: js/search.js（两处 8000→4000）、server.mjs（timeout 4000/maxRetries 1）、api/proxy/[...path].mjs、netlify/functions/proxy.mjs、functions/proxy/[[path]].js（各补 AbortSignal.timeout(10000)）
- 验证结果: grep 确认 3 serverless 均有 10s 兜底；Express 4000/1；search.js 4000；lint 0 错误
- 偏离: 无

## 步骤 6: 搜索前用测活缓存跳过失效源
- 完成时间: 2026-08-09
- 改动文件: js/app.js（search() 内 effectiveAPIs 过滤 + cacheKey 同步）
- 验证结果: 新鲜缓存（1h）内过滤不在 ok 的内置源，custom_ 保留；空则回退全量；lint 0 错误
- 偏离: 无

## 步骤 7: 搜索结果增量渲染
- 完成时间: 2026-08-09
- 改动文件: js/app.js（search() 逐源回调 + scheduleIncrementalRender + 最终覆盖）
- 验证结果: 每源完成触发 100ms 节流增量渲染（过滤 yellow、隐藏分页、隐藏骨架屏）；最终排序/统计/筛选/分页/缓存保留；lint 0 错误；语法通过
- 偏离: 增量渲染额外加了 pagination 隐藏（renderSearchResults 内部会显示分页 div，但增量阶段内容未生成）；增量渲染强制 currentPage=1
