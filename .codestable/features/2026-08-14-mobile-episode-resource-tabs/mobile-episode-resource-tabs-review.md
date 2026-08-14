---
doc_type: feature-review
feature: 2026-08-14-mobile-episode-resource-tabs
status: passed
reviewer: subagent
reviewed: 2026-08-14
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_reason: "ocr CLI 未安装（where.exe ocr 无结果）"
---

# mobile-episode-resource-tabs 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-14-mobile-episode-resource-tabs/mobile-episode-resource-tabs-design.md`
- Checklist: `.codestable/features/2026-08-14-mobile-episode-resource-tabs/mobile-episode-resource-tabs-checklist.yaml`（5 steps 全 done）
- Implementation evidence: 实现完成汇报（本会话）+ 修改文件
- Diff basis: `player.html`、`css/player.css`、`js/mobile-panel-tabs.js`（新增）、`js/player.js`（死代码删除）；未跟踪 `.codestable/` 产物
- Review mode: initial（round 1）→ material 复审（round 2）
- Baseline dirty files: `LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`（与本次无关，不计入归因）

### Independent Review

- Detection: 主 agent 自检 — 独立 Task agent 可用（code-explorer）；ocr CLI 不可用（`where.exe ocr` 无结果）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 & round 2）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- Merge policy: 环节 A findings 已由主 agent 逐条本地核验后合并（B-1 已修复；I-1/I-2 随 B-1 一并消除；nit 已修）

## 2. Diff Summary

- 新增：`js/mobile-panel-tabs.js`（101 行，模块负责 Tab 类切换）、`.codestable/features/2026-08-14-mobile-episode-resource-tabs/`
- 修改：`player.html`（删移动端展开按钮块 + 新增 #mobilePanelTabs Tab 容器 + #episodesGridContainer 预置 is-tab-active + 引入脚本）、`css/player.css`（移动端 Tab 样式/互斥规则 + 桌面端隐藏 + 清理旧展开类规则）、`js/player.js`（删除 toggleMobileEpisodes/matchMedia 清理块/等高同步死代码 ~70 行）
- 删除：无独立文件
- 风险热点：移动端 UI / 断点 / 异步加载时序（资源加载竞态）/ CSS 特异性

## 3. Adversarial Pass

- 假设的生产 bug：资源列表异步加载（fire-and-forget）与 Tab 激活的并发竞态、分页归零、断点残留
- 主动攻击过的反例：慢网快速切 Tab、密码门禁后快速操作、资源加载失败重试、切源与 Tab 重叠、episodes 为空、断点往返、快速翻页后切 Tab
- 结果：B-1 升级为 blocking 并修复；I-1/I-2 随 B-1 消除；其余为 nit/suggestion/residual-risk

## 4. Findings

### blocking

- [x] B-1 `js/mobile-panel-tabs.js`（round 1）旧版 `ensureResourcesLoaded` 在 `resourcePageCtx === null` 时兜底调用 `loadResourceSwitchList()`，与 `player.js:314` 已无条件启动的异步加载并发，导致互相覆盖与分页归零
  - 修复：模块移除 `ensureResourcesLoaded` 及全部加载触发逻辑——Tab 激活**绝不主动调用** `loadResourceSwitchList`，仅做 `is-tab-active` 类切换（资源加载由 player.js 加载链路无条件启动，加载中显示"正在加载资源..."占位）
  - 验证：全局检索 `loadResourceSwitchList` 仅 3 处引用（player.js 定义/调用/切源兜底），模块零引用；lint 通过

### important

- [x] I-1（round 1）资源加载失败时"每次切 Tab 无限重试"——随 B-1 修复消除（模块不再触发加载）
- [x] I-2（round 1）密码门禁后 `init` 先于资源加载激活 Tab 放大 B-1 窗口——随 B-1 修复消除（无加载触发逻辑）

### nit

- [x] design §5.2 M2 措辞残留"首次按需加载"——已改为"页面加载链路就绪/正在加载占位，不重复触发"，与 §4.2/4.5 语义一致

### suggestion

- [ ] `js/player.js:2413` 切源兜底调用 `loadResourceSwitchList` 建议后续加 in-flight 去重（当前无触发路径，非本期阻塞；已在 residual-risk 记录）

### learning

- "fire-and-forget 异步加载 + 分页全局上下文"组合下，任何"兜底再调用"都会与在途请求竞争同一组全局状态；正确做法是移除全部触发、依赖既有加载链路
- `is-tab-active` 单一类同时控制面板互斥显隐与 Tab 按钮高亮，配合 `.player-sidebar-body` 前缀特异性（(1,2,0)）覆盖既有 `display:none`，简洁且与 design 一致

### praise

- B-1 修复彻底且精准：模块回归纯 UI 类切换职责，design/实现/检索三向一致，无死代码残留
- 密码门禁事件链核对无误（非门禁/已验证/未验证三条路径均保证加载启动）
- `#episodesGridContainer` 静态预置 `is-tab-active`（无 JS 兜底选集仍可见）落实 N1 缓解
- `js/player.js` 死代码删除彻底：全仓库检索旧展开链路 0 匹配

### residual-risk

- `loadResourceSwitchList` 缺 in-flight 去重：当前无触发并发路径（切源需卡片、卡片需加载完成），但未来若新增主动刷新资源入口需复用统一入口并去重，否则 B-1 可能以新形态回归——建议后续 refactor 中为该函数增加 in-flight 标记
- 移动端 Tab 面板与 `mobile-panel-gestures.js` 侧栏手势叠加时的触摸交互需真机回归确认

## 5. Test And QA Focus

- 弱网/Slow 3G：加载后立即点"视频源"Tab，确认只出现 1 组 `/search` 请求、分页不归零、显示"正在加载资源..."占位后正常渲染
- 密码门禁：设 `PASSWORD` → 验证 → `passwordVerified` 后资源自动加载；Tab 切换不重复触发（Network 面板 `/search` 仅 1 组）
- 断点往返（M8）：≤640 → ≥641 → ≤640，无残留类；资源 Tab 下同样路径回移动端恢复默认选集
- 加载失败路径：断网显示"资源加载失败"，Tab 切换无 JS 报错、无重复请求
- 分页保留（M4）：资源第 2 页 → 切选集 → 切回，仍在第 2 页
- 切集后 Tab 往返（M5）：当前集高亮与页码一致
- 桌面端回归（M9/M10）：≥1024 无 Tab 栏、分栏正常；平板 641-1023 行为不变；资源面板桌面默认加载
- episodes 为空：选集空态显示、Tab 切换正常
- `node --check js/mobile-panel-tabs.js` / `node --check js/player.js`

## 6. Verdict

- Status: passed
- Next: 按 cs-feat Standard lane 进入 acceptance（accept-inline，Inline Verification Matrix）

## 7. Focused Closure

none（round 2 为 material 完整独立复审，非 focused closure）
