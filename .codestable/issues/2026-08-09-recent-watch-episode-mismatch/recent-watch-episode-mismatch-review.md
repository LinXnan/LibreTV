---
doc_type: issue-review
issue: 2026-08-09-recent-watch-episode-mismatch
status: passed
reviewer: subagent
reviewed: 2026-08-09
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装"
---

# 最近观看进入播放页集数显示不正确 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/issues/2026-08-09-recent-watch-episode-mismatch/recent-watch-episode-mismatch-report.md`（confirmed, fast-track）
- Approval: 同目录 `approval-report.md#issue-fast-path`（approved）
- Fix note: `.codestable/issues/2026-08-09-recent-watch-episode-mismatch/recent-watch-episode-mismatch-fix-note.md`
- Implementation evidence: 本会话对话 + `git diff -- js/recent-watch.js`
- Diff basis: 工作区 unstaged diff（仅 `js/recent-watch.js`）
- Review mode: initial
- Baseline dirty files: none（`.codestable/` 为本次 issue 新增产物，非本轮代码归因）

### Independent Review

- Detection: 主 agent 可启动独立 Task agent（code-explorer）；`ocr` CLI 不可用（`ocr: 无法识别`，未安装）。
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装，按协议不阻塞可选环节）
- OCR severity mapping: 未启用
- Merge policy: 环节 A 结果已逐条本地仓库事实核验后合并；未核验项不进 blocking/important。
- Gate effect: 环节 A completed，满足 `subagent` gate 要求。

## 2. Diff Summary

- 新增：`js/recent-watch.js` 内 `prepareEpisodeContextForNavigation()` 函数 + 两个调用点
- 修改：`js/recent-watch.js`（约 195-228 行）
- 删除：无
- 未跟踪 / staged：无（`.codestable/` issue 产物为新增未跟踪，非代码归因）
- 风险热点：localStorage 状态同步（跨入口一致性）、事件委托处理

## 3. Adversarial Pass

- 假设的生产 bug：url 精确匹配失败或 index/episodes 不同代时，集数同步静默失效，原始 bug 复发且不可观测。
- 主动攻击过的反例：url 失配（跨标签页就地更新）、index 越界钳制、history 解析失败、缺 episodes 旧数据、S2/S3 克隆区、键盘事件。
- 结果：REV-001（失配静默）升级为 important 并已修复；REV-002/REV-003 经本地核验降级；其余进 residual-risk / QA focus。

## 4. Findings

### blocking

none。

### important

- [x] REV-001 `js/recent-watch.js`（约 203 行）url 精确匹配失败时静默降级，原始 bug 无信号复发
  - Evidence: `getHistory().find(h => h && h.url === itemUrl)` 失配时既不写入也不提示；`saveToHistory` 按 title 去重会就地更新 `existingItem.url`（js/player.js:1582），跨标签页场景下 DOM 卡片 `data-url` 可能滞后于历史当前 url。
  - Impact: 边缘场景下"集数显示不正确"静默复发，无法排查。
  - **已修复**：匹配失败时新增 `console.warn`（失配可观测），不改变"失败不阻断跳转"语义。

### nit

- [ ] REV-002 `js/recent-watch.js`（约 200-207 行）每次点击全量 `JSON.parse` 历史并 `find` 遍历；数据量 ≤50 条，无性能影响，可复用渲染时的 history。

### suggestion

- [ ] REV-003 `js/recent-watch.js` 写入 `currentEpisodes` 时不同步 `localStorage.currentEpisodeIndex`；核验 `player.js initializePageContent` 从 URL 读 `index`（约 233 行）、不读该 key，属防御性增强，非现网问题。
- [ ] REV-004 与 `ui.js playFromHistory`（约 838-888 行）对齐"在线刷新剧集 + 回写历史"逻辑，消除历史缓存集数过旧；超出本次快速通道范围，作后续增强。
- [ ] REV-005 将 `viewingHistory` 读写收敛到单一工具函数，避免多处解析口径不一致（recent-watch.js、ui.js、player.js 各写一份）。

### learning

- 修复模式与既有 `playFromHistory`（ui.js:908-912）一致——"历史条目携带 episodes → 跳转前同步到 currentEpisodes → 播放页 URL 无 episodes 时回退读取"，是项目内已确立的可复用范式。
- `escapeHtml` + `getAttribute` 往返语义保证 `data-url` 与历史 `url` 字符串一致（HTML 实体还原），精确匹配依赖这一点。
- 本项目无构建、无自动化测试、localStorage 即持久层，"状态同步"类修复高度依赖手工验证清单。

### praise

- 对历史条目缺 `episodes`、localStorage 解析失败、非法 url、`setItem` 异常均有兜底且不阻断跳转。
- 改动严格收敛在单文件单函数，未触碰 URL 结构、导航方式与 `player.js` 恢复逻辑，符合快速通道最小改动约束。

## 5. Test And QA Focus

- 主链路：40 集剧 A → 10 集剧 B → 回首页点 A，断言"第 X/40 集"、40 个集数按钮；再点 B，断言恢复"第 X/10 集"（验证 currentEpisodes 被重新覆盖）。
- 边界：手工删除条目 `episodes` 字段后点击（不崩溃、不阻断）；向 `viewingHistory` 写非法 JSON 后点击（`getHistory()` 返回 []，导航正常）；键盘 Enter/空格跳转与点击一致。
- 回归：从历史列表进入（`ui.js playFromHistory` 在线刷新逻辑）与搜索播放（`app.js playVideo` 写 currentEpisodes）不受本次改动影响。
- 不能靠 review 完全确认：URL 含特殊字符时的 HTML 往返一致性；`episodesReversed` 全局标志跨剧污染的用户可见影响。

## 6. Residual Risk

- 历史旧条目缺 `episodes` 时仍回退读 `localStorage.currentEpisodes`，存量旧数据下原始问题仍存在（fix-note 已承认）；QA 明确"仅新写入条目有效"。
- REV-002 降级项：index 与 episodes 不同代时播放页按既有防御逻辑钳制到最后一集（`player.js:264-270`），触发需三重边缘条件，结果属合理兜底，非本次引入。
- 最近观看入口不经 `requirePasswordOrPrompt()` 校验（对比 `app.js:1265 playVideo`），若密码保护为项目硬性要求需确认产品口径（疑为既有设计，非本次范围）。

## 7. Verdict

- Status: passed
- Next: 按进入来源表（issue fast-track），进入收尾提交；无自动化测试，依赖本地 `npm run dev` 浏览器手动验证。
