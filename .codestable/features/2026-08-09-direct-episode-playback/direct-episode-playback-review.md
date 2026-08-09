---
doc_type: feature-review
feature: 2026-08-09-direct-episode-playback
status: passed
reviewer: subagent
reviewed: 2026-08-09
round: 1
lane_a_state: completed
lane_a_ref: "code-explorer@round1"
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "Windows 环境无 ocr CLI；按协议 lane B 缺装不阻塞"
---

# direct-episode-playback 代码审查报告

## 1. Scope And Inputs

- Design: 无（fastforward 模式走 ff-note）
- Checklist: 无
- Evidence pack: 无
- Gate results: 无
- DoD results: 无
- Implementation evidence: `.codestable/features/2026-08-09-direct-episode-playback/direct-episode-playback-ff-note.md` + `js/app.js:1262-1300`
- Diff basis: `git status --short` → `M js/app.js` 单文件；`git --no-pager diff js/app.js` 为唯一可归因改动
- Review mode: initial
- Baseline dirty files: `.codestable/features/2026-08-09-direct-episode-playback/`（产物目录）、`.commit_msg_tmp.txt`、`.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`（最后一项 .gitignore 应排除；其余与本改动无关）

### Independent Review

- Detection: 主 agent 自检 Task agent 能力可用（`code-explorer` subagent）；`ocr` CLI 在 Windows 不可用
- 环节 A 独立隔离 Task agent: independent-agent + completed（独立读写上下文，仅返回 finding 文本，未对仓库做修改）
- 环节 B OCR CLI: unavailable（环境缺失）
- OCR severity mapping: 不适用
- Merge policy: 环节 A 返回的 5 条 finding 已逐条与仓库事实核验（见 § 3 / § 4 / § 6）；未启动 lane B；未在 lane 未返回时定稿
- Gate effect: 环节 A 已完成 + 无 blocking → 可定稿 `passed`

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-09-direct-episode-playback/direct-episode-playback-ff-note.md`（本文件）
- 修改：`js/app.js:1262-1300` —— `playVideo()` 函数体（跳转目标 `watch.html` → `player.html`、`&back=` → `&returnUrl=`，注释补全）
- 删除：无
- 未跟踪 / staged：见 baseline dirty files 中除本目录外的项
- 风险热点：UI（点击行为变化，UX 改善）；不涉及跨模块协议变更；不涉及权限/数据/并发

## 3. Adversarial Pass

- 假设的生产 bug：选集跳转可能因参数缺失/编码异常/历史 localStorage 状态污染导致 player.js 拿到残缺 URL 或失效的 returnUrl
- 主动攻击的反例：
  - `vod_name` 含中文 / 引号 → `encodeURIComponent` 是否够用？**核对**：`playVideo` 入参 `vod_name` 已 `encodeURIComponent`，与 player.js 的 `urlParams.get('title')` 解码路径对称 ✓
  - `url`（视频 m3u8）含特殊字符 → 已 `encodeURIComponent`，player.js 通过 nestedUrlParams 二次解析容错 ✓
  - `episodeIndex = 0`（首集默认）默认值透传正确 ✓
  - `currentVodPic` 是图片 URL 含 query string → 已 `encodeURIComponent` ✓
  - 用户从搜索 URL `/s=xxx` 点选集 → 原 watch.html 流程与新直跳流程的 returnUrl 路径对比：均依赖 `lastPageUrl` localStorage 兜底（player.js:goBack 第二步），等价 ✓
  - 玩家内翻集（prev/next）触发 `playVideo` 时 `currentPath = window.location.href = player.html?...` → 见 B-5，**确认是原流程既有行为**（详细见 § 4 / § 6）
  - localStorage 写入失败（如 Safari 隐私模式 / 配额满）→ 见 B-2，**确认是原流程既有行为**
- 结果：5 条候选 finding（B-1 ~ B-5）经事实核验后**全部为原 `playVideo` + `watch.html` 流程的既有行为**，本次改动路径迁移不引入回归。下方 § 4 中保留 finding 以追溯，但不进 blocking。

## 4. Findings

### blocking
- none（环节 A 提出的 B-1 ~ B-5 经主 agent 核验均为既有行为，不属本轮 regression）

### important
- none（本轮未引入新的 important 级问题）

### nit
- [x] REV-N1 `js/app.js:1264` `playVideo()` 注释承诺"完全一致"语气稍强
  - Evidence: ff-note 与代码注释都用了"与原行为完全一致"措辞，但严格说**少了 `cameFromSearch` / `searchPageUrl` 两项 localStorage 写入**（watch.js:69-73 写过，无人读）
  - Impact: 不影响功能（dead write）；仅文档口径与实际略偏
  - 建议: 视情况改为"主流程行为一致 + 一并清掉 watch.js 死写入"

### suggestion
- [x] REV-S1 `js/app.js:1281` returnUrl URL 参数透传条件可改 `window.location.pathname` 而非 `window.location.href.includes('index.html')`
  - 理由: 用 pathname 判定是否首页更稳（去掉 query/hash 干扰），但与本次 fastforward 入参契约"行为与原 watch.html `back` 参数一致"无直接冲突
  - 建议: 留待后续独立 feature 处理（也可视作 nit）

### learning
- [x] REV-L1 `js/app.js:1264-1300` `playVideo` 函数体写入 `lastPageUrl = currentPath` 在 player.html 内翻集时会把 lastPageUrl 污染成 player.html URL，导致 player.js:goBack 第二步因 `lastPageUrl === window.location.href` 跳过。但这是 `playVideo` + 翻集按钮组合的**既有设计弱点**（原流程同样会发生，因为 `back` URL 参数的条件在 player.html 上同样不命中、`lastPageUrl` 同样会被覆盖），本次改动保持等价。如要根治需新增 `playVideo({inPlayer:true})` / 单独的 `playNextFromPlayer()` 入口，避免在 player.html 上覆写 `lastPageUrl`。见 § 6 residual risk。

### praise
- [x] REV-P1 改动严格收口于 `playVideo()` 函数体（`js/app.js:1262-1300`，39 行），参数集与 player.js 入参对齐，移除的是"中转跳一跳"那种纯延迟环节；新流程比原流程少一次页面装载、一次 JS 解析、一次 meta refresh 计时器
- [x] REV-P2 保留 `watch.html` / `js/watch.js` / `css/watch.css` 不删除，保证书签/分享/老链接继续可用，是 nice 的向后兼容选择
- [x] REV-P3 沿用原条件 `currentPath.includes('index.html') || currentPath.endsWith('/')` 做 returnUrl URL 参数条件透传，与 watch.js:46-58 的 returnUrl 推断同语义（首页显式透传、其它依赖 referrer/localStorage）——保持行为对称

## 5. Test And QA Focus

- QA 必须重点复核：
  - 首页搜索 → 点详情 → 点第 N 集 → **直接进入 player.html**（不出现中间加载页、watch.html 任何视觉残留）
  - 玩家 header 上的"返回"按钮能从 player.html 回到首页（不是回到 player.html 本身 / 不是回到 watch.html）
  - 直接手动打开 `watch.html?id=…&source=…&url=…&index=…&title=…&back=…&vod_pic=…`（老链接）仍能正常跳转 player.html（向后兼容）
- Evidence pack residual risks / gate warnings：N/A
- 建议新增或加强的测试：无（项目无自动化测试基础设施，验证以 `npm run dev` + 浏览器手测为准）
- 不能靠 review 完全确认的点：浏览器内手测体验需用户执行；手动验证通过后才能确认 UX 改善符合预期

## 6. Residual Risk

- **玩家内翻集污染 lastPageUrl**：当用户已在 player.html 中点"上一集/下一集"按钮（player.js 触发 `playPreviousEpisode` / `playNextEpisode`），会调用同一个全局 `playVideo()`，新流程把 `lastPageUrl` 覆盖为 player.html URL；player.js:goBack 第二步因 `lastPageUrl === window.location.href` 跳过；goBack 走第三步 `document.referrer` 兜底（来自 player.html 自己所在页面）→ 用户从翻集后的 player.html 点返回，回不到原搜索/首页。**这是原 watch.html + `back=` 流程的等价行为**（原流程 `back` URL 参数在 player.html 入口时同样不命中、`lastPageUrl` 同样被覆盖），本次改动未引入回归。如后续要根治，需独立 feature 设计"在 player.html 内不走 `playVideo` 的 returnUrl 写入分支"，或新增专用的 `playEpisodeFromPlayer()` 入口。
- **localStorage 写入失败**：隐私模式 / 配额满 / 系统禁用 localStorage 时，`requirePasswordOrPrompt()` 通过后所有 7 项写入失败，但 `window.location.href` 仍跳转；player.js 落到 `lastPageUrl`-不存在分支后行为退化为 `history.back()` / `document.referrer` 兜底。**原 watch.html 流程同样行为**（try/catch + 继续跳转未变）。

## 7. Verdict

- Status: **passed**
- Reason: 环节 A 返回的 5 条 finding 经主 agent 全量事实核验均为既有行为，本改动未引入任何 blocking / important regression；改动严格收口于 `playVideo()` 函数体、入参契约不变、与 player.js 入参对齐、`watch.html` 兼容路径保留
- Next: ff-note 已落盘 → 收尾提交。残留两个既有弱点（prev/next 翻集 lastPageUrl 污染、localStorage 失败兜底）记入 `compound/` 沉淀候选（与 ff-note 的"顺手发现"合并），不进本轮修

## 8. Focused Closure

none（本轮为 initial review；后续如需复审再做 focused closure）
