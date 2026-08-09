---
doc_type: feature-review
feature: 2026-08-09-home-recent-watch-carousel
status: passed
reviewer: subagent
reviewed: 2026-08-09
round: 6
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装"
---

# home-recent-watch-carousel 代码审查报告

## 1. Scope And Inputs

- Design: none（fastforward 通道，仅 ff-note）
- Checklist: none（fastforward 通道）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: 本会话对话 + `home-recent-watch-carousel-ff-note.md`
- Diff basis: `git status --short` + `git diff`（css/index.css、index.html、js/app.js、js/ui.js 修改；js/recent-watch.js 与 ff-note 未跟踪）
- Review mode: initial + 5 轮 review-fix 后完整独立复审
- Baseline dirty files: `.commit_msg_txt.txt`、`.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`（与本轮无关，不纳入归因）

### Independent Review

- Detection: Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1-6 各启动一次独立 reviewer）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 独立 reviewer 结果已逐条本地核验后合并；来源标注 `independent-agent`
- Gate effect: none（环节 B 非必需）

## 2. Diff Summary

- 新增：`js/recent-watch.js`、`.codestable/features/2026-08-09-home-recent-watch-carousel/`
- 修改：`css/index.css`（+149）、`index.html`（+23）、`js/app.js`（+20）、`js/ui.js`（+12，历史变更后刷新轮播）
- 删除：无
- 风险热点：UI 新功能、localStorage 数据渲染（XSS 面）、事件监听、自动轮播时序、历史数据变更联动

## 3. Adversarial Pass

- 假设的生产 bug：历史字段被污染时渲染注入；自动轮播与用户交互互相打断；回首页数据不刷新
- 主动攻击过的反例：XSS 注入（episodeIndex/title/url）、`[null]` 条目、非数组 localStorage、非字符串 title、事件监听重复绑定、程序滚动 vs 用户滚动、data-url 转义与读取、封面代理 URL、`javascript:` scheme、空历史定时器泄漏
- 结果：升级为 findings 的项见第 4 节；其余留 residual risk 与 QA focus

## 4. Findings（全部轮次汇总）

### blocking

- [x] REV-001 `js/recent-watch.js`（已修复，round 1→2）观看记录 `episodeIndex` 未转义直接插入 HTML 的 XSS 面
  - 修复：`Number(rawEp)` + `Number.isFinite` 数值归一化，undefined/null/非数字不输出剧集文本，同时消除字符串拼接陷阱
- [ ] blocking 残留：无

### important

- [x] REV-002（round 1→2）事件监听重复绑定泄漏 → 修复：`bindCarouselControls` 一次性绑定 + 卡片事件委托到 track
- [x] REV-007（round 2→3）回首页轮播不刷新数据 → 修复：对外 `updateRecentWatchVisibility = render`（幂等重建）
- [x] REV-008（round 2→3）跳转无 scheme 白名单 → 修复：`navigateTo` 用 `new URL(url, origin)` 校验 http/https
- [x] I-1（round 3→4）非字符串 title 使渐变/图标函数抛错拖垮渲染 → 修复：`String(item.title || '')` 后再传
- [x] I-2（round 3→4）清空/删除历史不刷新轮播 → 修复：ui.js `clearViewingHistory` / `commitHistoryDeletion` 补调 `updateRecentWatchVisibility`（typeof 守卫）
- [x] J-1（round 4→5）清空历史后 `autoScrollTimer` 空转 → 修复：空分支 `stopAutoScroll()`
- [x] IMP-1（round 5→6）`[null]` 条目 / 非数组数据渲染崩溃 → 修复：`Array.isArray` 校验 + 非对象条目 filter
- [x] IMP-2（round 5→6）空历史分支 `resumeTimer` 泄漏 → 修复：空分支 `clearTimeout(resumeTimer)`
- [x] J-2（round 4，核验不成立）撤销删除后轮播不刷新：`commitHistoryDeletion` 是唯一删除入口（timer 到期才写 localStorage），撤销时数据未变无需刷新
- [x] important-1（round 6，核验为已收敛差异）`addToViewingHistory`（player.js）不调轮播刷新：播放器页无 `recentWatchArea` DOM（render 首行安全返回），回首页/关播放器路径（closeVideoPlayer/resetSearchArea/popstate）均收敛刷新，无用户可见 bug
- [x] important-2（round 6，记录顺手发现，不在本次范围）`ui.js:getViewingHistory` 无 `Array.isArray` 校验：既有代码历史面板侧的脏数据风险，本次不引入；建议后续独立加固
- [ ] important 残留：无

### nit

- [x] REV-003（round 1→3）全局函数调用混用 → 统一 `window.` 前缀调用
- [x] REV-009（round 2→3）`Number(null)=0` 显示"第1集" → 显式排除 undefined/null
- [x] N-1（round 5→6）空 title 渐变 `hsl(NaN)` → `rawTitle || '未知视频'`
- [x] nit-1（round 6）非空分支未清理 `resumeTimer`（无泄漏）→ 与空分支对称补 `clearTimeout`
- [ ] REV-004 `programmaticScroll` 800ms 硬编码覆盖 smooth 时长：极端慢速环境可能误判用户滚动；低风险，延后
- [ ] REV-003b `updateVisibility` 高频路径每帧 `getHistory()` 全量 parse：已用 `historyCount` 消除主要路径，残留低频路径可接受

### suggestion

- [ ] REV-005（沿用至各轮）点击跳转与 `playFromHistory` 链路不一致（缺剧集预同步/`lastPageUrl`）：经核验 `item.url` 为自足 player.html 链接（含 source/source_code/index/position），可播放续播；记录为已确认差异，不改
- [ ] REV-006（round 1 顺手修复）touchstart 仅停不恢复 → 已改走 `pauseFor`（暂停+定时恢复）
- [ ] S-1（round 5）跨标签页 `storage` 事件同步轮播：非本次需求，延后
- [ ] S-2（round 5）undo 删除语义与轮播刷新：核验无需刷新（见 J-2）

### learning

- 懒加载链路正确：`lazy-load` + `data-src` 与 `optimize-apply.js` MutationObserver 及 `utils.js` `observeAll()` 对齐；封面失败 `handleLoadError` 自动 `display:none` 露出底层占位符
- `data-url` 经 `escapeHtml` 入属性、`getAttribute` 解码还原、`new URL` 校验 scheme 后跳转，链路完整
- 封面占位符与 img 依赖 DOM 顺序（img 在后覆盖），与 ui.js 历史卡片一致
- `stepWidth` 读取 `getComputedStyle(track).columnGap` 与 CSS `gap: 0.75rem`（12px）一致

### praise

- 多轮对抗后最终 XSS/健壮性防护到位：title/episodeIndex/url/vod_pic 全链路转义与归一化、scheme 白名单、异常数据结构降级
- 事件一次性绑定 + 事件委托 + 定时器（autoScrollTimer/resumeTimer）生命周期管理完整，无泄漏无累积
- 自动轮播尊重 `prefers-reduced-motion`、`document.hidden`、区域 hidden、程序滚动与用户滚动区分
- 卡片 `role="button" tabindex="0"` + Enter/Space + `aria-label` 可访问性到位
- 回首页数据刷新（updateRecentWatchVisibility=render）与历史变更联动（ui.js 两处）链路闭合

## 5. Test And QA Focus

- 注入反例：手写 `localStorage.viewingHistory` 塞入字符串 `episodeIndex`（`"><img src=x onerror=alert(1)>`）、`[null]` 条目、非数组数据、对象 title，刷新首页确认无脚本执行、渲染不崩溃、剧集文本安全降级
- 数据刷新：看完新片回首页轮播更新；清空历史后轮播消失；删除单条历史后轮播同步
- 监听泄漏：多次 `window.reloadRecentWatch()` 后点一次 Next 只滚动一步
- 显示隐藏：搜索→隐藏、resetToHome→恢复、最近观看进播放器再关闭→恢复
- 自动轮播时序：自动滚动中手动拖拽/点按→暂停并在 6s 后恢复；`prefers-reduced-motion` 下不自动滚动
- 触摸：移动端滑动后轮播恢复；轻点卡片（无滑动）轮播 6s 后恢复
- 跳转：点最近观看卡片播放并续播；`javascript:` 类 url 不跳转
- 封面：`vod_pic` 为空/异常协议时显示渐变色占位符，不裂图

## 6. Residual Risk

- `js/app.js:1275` `closeVideoPlayer` 无条件 `resultsArea.classList.remove('hidden')` 是既有行为：从首页直接打开播放器再关闭时，空 resultsArea 与最近观看可能同屏（recentWatch 显示依赖 resultsArea hidden）；本次不修，QA 复核该场景
- `buildCoverUrl` 在 `file://` 协议下把 `//host/img` 归一为 `file://` 走 proxy；与 ui.js 既有逻辑一致，生产 https 无碍
- localStorage 数据被同源脚本完全控制时无解（前端应用固有边界）；本轮已将非期望数据结构安全降级
- `ui.js:getViewingHistory` 无 Array.isArray 校验为既有顺手发现，建议后续独立加固

## 7. Verdict

- Status: passed（6 轮独立复审，无 blocking；全部 important 已修复或经核验为已收敛差异/范围外顺手发现；remaining nit/suggestion 延后）
- Next: 用户本地浏览器验收（按第 5 节 QA Focus），验收后可选 scoped-commit

## 8. Focused Closure（round 6 后增量）

- Closing: nit-1（`js/recent-watch.js` render 非空分支补 `clearTimeout(resumeTimer); resumeTimer = null;`）
- 类别: ClosureOnly（nit 级资源清理，与空历史分支对称；不改变用户可见行为、公开契约、安全、数据、并发或架构；`resumeTimer` 到期后 `startAutoScroll` 幂等，清理仅提前释放一个无泄漏的定时器）
- 验证: `node --check js/recent-watch.js` 通过；read_lints 无报错
- 结论: 不改变 round 6 复审结论，维持 passed
