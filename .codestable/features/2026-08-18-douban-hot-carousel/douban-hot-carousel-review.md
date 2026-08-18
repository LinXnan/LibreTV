---
doc_type: feature-review
feature: 2026-08-18-douban-hot-carousel
status: passed
reviewer: subagent
reviewed: 2026-08-18
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 未安装（where ocr 未找到）"
---

# douban-hot-carousel 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-carousel/douban-hot-carousel-ff-note.md`（Quick lane，ff-note 即 spec）
- Checklist: none（Quick lane 无 checklist）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: 对话实现（recent-watch.js 重写 + index.html 标题/按钮）
- Diff basis: `git status` → `M index.html`、`M js/recent-watch.js`、`?? .codestable/features/2026-08-18-douban-hot-carousel/`；`git diff --stat` 2 files changed, 142 insertions(+), 121 deletions(-)
- Review mode: initial
- Baseline dirty files: none

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed（已返回对抗式审查结果）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 环节 A findings 已逐条本地事实核验后合并；OCR 未启用
- Gate effect: 环节 A completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-carousel/douban-hot-carousel-ff-note.md`
- 修改：`js/recent-watch.js`（数据源 localStorage→豆瓣 API + 电影/电视剧切换 + 缓存/超时）、`index.html`（标题「最近观看」→「豆瓣热播」+ 切换按钮）
- 删除：none
- 未跟踪 / staged：`.codestable/features/.../`（新目录）
- 风险热点：异步竞态（类型切换 fetch）、网络依赖（豆瓣 API + fallback）、UI 显隐联动（app.js 契约）

## 3. Adversarial Pass

- 假设的生产 bug：豆瓣 fallback 无独立超时，首次首页必经路径可能悬挂 Promise → 热播区永久空白
- 主动攻击过的反例：类型切换竞态 / 悬挂 Promise / 封面 URL 特殊字符 / XSS（data-title、aria-label）/ 定时器隐藏时空转 / 重复 fetch 网络放大 / itemCount 与显隐关系 / fillAndSearchWithDouban 点击后状态
- 结果：升级为 findings 的项：REV-001/002/003/004；其余为 nit/learning 或既有差异

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/recent-watch.js` 每次回家/关播放器/popstate 都触发全新豆瓣 fetch（网络放大，且 `fetchDoubanData` 主路径 10s 超时 + allorigins fallback，重复拉取易触发豆瓣限流）
  - Evidence: `window.updateRecentWatchVisibility = render`，render 每次 `fetchDoubanSubjects()`；app.js:743/1490、popstate 均调用
  - Impact: 一次"播放→关闭→回家"可能 2~3 次完整 fetch，拖慢导航
  - Fix: 新增 `CACHE_TTL`（60s）+ `getSubjects()` 缓存（同类型未过期直接复用），回家/关播放器只复用缓存
- [x] REV-002 `js/recent-watch.js` 豆瓣拉取 fallback 链无独立超时，可能悬挂 Promise 使热播区永久不出现
  - Evidence: `fetchDoubanData` allorigins fallback（douban.js:432）无 signal；fetchDoubanSubjects 直接透传其 Promise
  - Impact: 主代理超时后 allorigins 挂起，`.then`/`.catch` 都不执行，区域保持隐藏且后续 render 重复触发同链
  - Fix: `fetchDoubanSubjects` 包 `Promise.race`（12s 总超时），超时 reject → 空态降级
- [x] REV-003 `js/recent-watch.js` 区域隐藏（搜索/开播放器）时自动轮播定时器空转
  - Evidence: app.js:914/1461 直接加 hidden；startAutoScroll 的 interval 仅判 hidden 跳过不 stop
  - Impact: 每 3s 空转一次，纯资源浪费
  - Fix: `applyVisibility` 隐藏分支同步 `stopAutoScroll()`

### nit

- [x] REV-004 `js/recent-watch.js` 0-item 分支未重置 `activeIndex`
  - Fix: 已补 `activeIndex = 0`

### suggestion

- REV-005 封面代理 URL 构造（`'`→`%27`）与 douban.js:482（`PROXY_URL + encodeURIComponent`）不一致，导致同封面在推荐区与轮播产生两个 `/proxy/` 缓存键
  - 判定：既有差异（recent-watch.js 的历史 buildCoverUrl 逻辑本就带 `'`→`%27`），非本次引入，且仅浪费一次缓存下载，不阻塞。留待后续统一工具函数

### learning

- `data-title` 存 `escapeHtml` 后的标题，`getAttribute` 取回的是浏览器反解码的原始标题，再传给 `fillAndSearchWithDouban` 正好是真实标题——HTML 实体往返安全，非双重转义 bug
- XSS 面已覆盖：safeTitle/safeRate/safeCoverUrl 均过 escapeHtml，gradientBg/contentIcon 不内插用户可控字符串
- 脚本加载顺序满足依赖：douban.js/utils.js/proxy-auth.js/ui.js 均在 recent-watch.js 之前；optimize-apply.js 的 MutationObserver 自动接管动态 `img.lazy-load[data-src]` 并补 auth（因此 buildCoverUrl 只需同步构造 `/proxy/` 前缀，不能手动 addAuthToProxyUrl，否则重复鉴权）

### praise

- `renderRequestId` 竞态防护正确：类型切换/重复 render 时递增，旧请求 `.then` 首行丢弃
- 定时器生命周期严谨：`startAutoScroll` 内部先 `stopAutoScroll`；0-item/catch 分支都清理；render 末尾清 `resumeTimer`
- 保留 `window.updateRecentWatchVisibility`/`reloadRecentWatch` 契约，app.js 零改动联动显隐

## 5. Test And QA Focus

- QA 必须重点复核：
  - 类型切换竞态：快速 movie→tv→movie 连点，最终列表为最后一次类型、无旧数据残留
  - 悬挂/失败降级：断网或拦截 douban/allorigins，热播区 ~12s 内降级为空态（区域隐藏）而非永久空白；恢复网络回家能重新拉取
  - 搜索/播放联动显隐：首页点卡片→搜索→热播区隐藏且自动轮流停止；回退/回家→按当前类型重新出现且轮播正常；播放页打开/关闭→显隐正确
  - 自动轮流：区域隐藏、document.hidden、鼠标悬停、键盘方向键→暂停/恢复符合预期，无重复 timer
  - 封面加载：含单引号/中文/特殊字符标题的封面正常显示；失败时占位符正常；移动端断点正确
  - 无障碍/XSS：键盘 Enter/空格触发搜索；带 `"`/`<`/`>` 的标题不产生注入、点击后搜索框值为真实标题
- 建议新增或加强的测试：`buildCoverUrl` 纯函数单测（单引号、`#`、中文、`&`、`//` 协议、非 http 输入）；`render()` 竞态（模拟两次不同 requestId resolve）；`getSubjects` 缓存与 12s 超时路径
- 不能靠 review 完全确认的点：真机 CDN（CF/Vercel 中间件）下封面 auth 加载；豆瓣接口/限流实际可用性；REV-005 缓存键差异的实际损耗

## 6. Residual Risk

- 豆瓣 `j/search_subjects` 接口可用性/限流：既有风险，本次改版把豆瓣 API 放到首页首屏必经路径，放大了影响面；已用 12s 总超时 + 空态降级兜底，QA 需实测断网/限流表现
- 封面鉴权在 CDN 部署下的加载：本地 LazyImageLoader 会补 auth，真机中间件行为需环境实测（ff-note 已标注待验证）

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾提交（review passed，无 blocking；REV-001~004 已修复，REV-005 为既有差异留待后续）

## 8. Focused Closure（无则写 none）

none
