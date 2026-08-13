---
doc_type: review-report
refactor: 2026-08-13-search-multi-source
status: passed
reviewer: subagent 独立审查 + 主 agent 本地核验（环节 B OCR 环境不可用，记 unavailable）
result: blocking-1(已修) / important-1(用户决策保留) / nit-1(记录) / learning-1(记录) / residual-risk-1(记录)
round2: APPROVED（REV-001 修复复核通过，无回归无同型遗漏）
---

# search-multi-source review

## 结论

- **blocking-1**：REV-001 缓存路径二次去重覆盖 `merged_sources`（违反 checklist c5）
- **important-1**：REV-002 #2 abort 机制被防抖锁遮蔽（设计宣称 vs 实际行为差距）
- **nit-1**：REV-004 卡片 onclick 单引号转义（既有模式，非本次引入）
- **learning-1**：REV-003 dedupe key 拼接冲突（低概率）
- **residual-risk-1**：REV-005 AbortSignal.any 浏览器兼容

## Findings

### REV-001 [blocking] 缓存命中二次去重覆盖 merged_sources

- **位置**：`js/app.js:779`（dedupeSearchResults else 分支）+ `js/app.js:800`（renderCachedResults 再次调用）
- **证据**：`search()` 存缓存时已是 dedupe 后结果（含 `merged_sources=[a,b,c]`）。5 分钟内缓存命中 → `renderCachedResults:800` 对**已 dedupe** 数据再次调用 `dedupeSearchResults`。此时数组每 key 仅一个项，else 分支执行 `item.merged_sources = item.source_name ? [item.source_name] : []` —— 多源信息 `[a,b,c]` 被覆盖为 `[a]`，`source_count` 变 1
- **影响**：缓存命中时卡片"N 个源"徽标丢失、统计源数变少、按源筛选只剩首源 → 缓存/非缓存路径结果不一致，违反 c5
- **修复建议**：幂等化 else 分支——保留已有 merged_sources：
  ```js
  item.merged_sources = (item.merged_sources && item.merged_sources.length)
      ? item.merged_sources
      : (item.source_name ? [item.source_name] : []);
  item.source_count = item.merged_sources.length;
  ```
- **验证**：修复后分别走缓存命中（重复搜同词）与非缓存路径，徽标/统计一致

### REV-002 [important] #2 abort 机制实际被防抖锁遮蔽

- **位置**：`js/app.js:843`（`if (searchInProgress) return;`）与 `:848-849`（abort 旧 controller）
- **证据**：搜索在途时再次搜索被 `:843` 直接 return（防抖），abort 代码只在 searchInProgress=false 后才能执行——此时旧搜索已全部 settle，无在途请求可取消。abort 实际为防御性死路径
- **影响**：不降低正确性（代码自洽：防抖锁 + 代际 token 双保险，旧回调/旧 finally 均被代际隔离）。但 design 宣称"取消在途旧请求"的收益未兑现；连续搜索时第二次搜索被静默丢弃（**原有行为**，非本次引入）
- **决策点**（用户）：a) 保留防御性（无害）；b) 移除 abort 简化；c) 改防抖为"取消重搜"（行为变更：搜索中再搜立即取消旧请求并开新搜索——真正兑现 #2，需用户确认接受此交互变化）
- **验证**：若选 c，连续搜索 Network 面板确认旧请求 abort、新搜索生效

### REV-003 [learning] dedupe key 拼接可构造冲突

- **位置**：`js/app.js:770`（`${vod_name}|${vod_year}`）
- **证据**：`name="A", year="B|C"` 与 `name="A|B", year="C"` 产生相同 key，理论误合并。现实中 vod_year 为数字年份、name 含 `|` 罕见
- **建议**：当前可接受；若未来出现异常数据可改用 JSON.stringify([name, year]) 作 key

### REV-004 [nit] 卡片 onclick 单引号未转义

- **位置**：`js/app.js:1260` 附近（renderEpisodes 中 playVideo onclick 模板）
- **证据**：`vodName.replace(/"/g, '&quot;')` 仅处理双引号，JS 字符串内单引号未转义会破坏 onclick。**既有代码模式**（本次仅追加 `'${currentVideoYear || ''}'` 数字参数，无风险）；含 `'` 的片名在改前即有此问题
- **建议**：留作未来专项（涉及既有行为，不入本次 scope）

### REV-005 [residual-risk] AbortSignal.any 浏览器兼容

- **位置**：`js/search.js:27` 与 `:84`
- **证据**：`AbortSignal.any` 需 Chrome 116+/FF 116+/Safari 17.4+。旧浏览器该 API 不存在 → 调用抛错被 catch 吞掉 → 该源搜索静默返回空
- **缓解**：本项目为现代浏览器纯静态场景（与既有 `replaceState`/`AbortController` 使用一致）；所有平台用户量小。可接受，记残余风险

## 环节 B（OCR CLI）

`unavailable`——本会话命令执行环境失效，无法运行 ocr CLI；以主 agent 本地行级核验替代。

## Test And QA Focus（修复后必测）

1. **REV-001 验证**：搜多源同名词 → 等缓存写入 → 5 分钟内重搜同词（缓存命中）→ 徽标/统计与首次一致
2. **REV-002 决策验证**：若选 c（取消重搜），快速连搜 Network 面板旧请求 abort；若选 a/b 确认无回归
3. **year 口径**：某源年份格式差异（"2023" vs "2023年"）时搜索徽标与播放页资源切换口径一致（两处同键，同时不匹配，可接受）
4. **回归**：搜索 → 详情 → 播放页资源切换数量 = 搜索徽标数；最近观看/豆瓣入口降级 name-only 正常
