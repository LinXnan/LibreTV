---
doc_type: feature-review
feature: 2026-08-16-desktop-episode-resource-tabs
status: passed
reviewer: subagent
reviewed: 2026-08-16
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装（which ocr / ocr llm test 均报 not recognized），不阻塞本轮，reviewer=subagent"
---

# desktop-episode-resource-tabs 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-16-desktop-episode-resource-tabs/desktop-episode-resource-tabs-design.md`（status=approved）
- Checklist: `.codestable/features/2026-08-16-desktop-episode-resource-tabs/desktop-episode-resource-tabs-checklist.yaml`（s1-s5 done）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: 实现完成汇报（对话内，s1-s5 每步验证结果）
- Diff basis: `git diff`（工作区未提交）——`css/player.css` +89/-；`js/mobile-panel-tabs.js` 45 行改动；`player.html` 2 行注释；`.codestable/` 为 CodeStable 产物非审查对象
- Review mode: initial
- Baseline dirty files: none（工作区仅本轮改动）

### Independent Review

- Detection: 主 agent 自检——Task agent（code-explorer）可用；`ocr` CLI 不可用（`ocr: The term 'ocr' is not recognized`）
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 未启用（环节 B 不可用）
- Merge policy: 环节 A findings 已逐条本地仓库事实核验后合并
- Gate effect: 环节 B 可选，不阻塞；reviewer=subagent 满足 gate

## 2. Diff Summary

- 新增：none（代码层面）；`.codestable/features/2026-08-16-desktop-episode-resource-tabs/`（流程产物，未跟踪）
- 修改：`css/player.css`、`js/mobile-panel-tabs.js`、`player.html`
- 删除：none（代码层面）
- 未跟踪 / staged：`.codestable/features/...`（未跟踪）
- 风险热点：UI 布局（CSS 特异性/层叠）、断点行为、异步加载边界（无新增）

## 3. Adversarial Pass

- 假设的生产 bug：Tab 互斥规则上移通用区后在某断点失效（面板同时显示或同时隐藏）
- 主动攻击过的反例：互斥规则 vs 移动端块 `display:flex !important`(0,1,0) / 桌面块 `display:flex`(1,0,0) / 平板块级默认 display——逐一核验 (1,2,0)/(0,3,0)+`!important` 均胜出；断点切换残留类（三端同行为后恒定）；资源 Tab 激活间接触发加载（`activate()` 纯类切换，无事件派发/回调）；跨断点 `sidebar-collapsed` 残留（既有行为，design 非目标）
- 结果：无升级为 blocking 的项；平板高度差（I-1）与互斥规则结构风险（I-2）留 important/residual 交 QA

## 4. Findings

### blocking

none

### important

- [ ] REV-001 `css/player.css:145-148 / 618-624` 平板（641-1023）切 Tab 侧栏高度突变（体验）
  - Evidence: 平板 `.player-sidebar-body` 无 `display:flex`/固定高度（仅 ≥1024 块 717-723 有）；选集面板 ≈ header + toolbar + `.episode-grid { max-height: 30vh }`，资源面板 ≈ info-bar + `.resource-switch-list { min-height: 205px }`，二者高度不同，切 Tab 时侧栏/整页高度变化、滚动条可能跳动。
  - Impact: 非功能性错误；属 Tab 模式固有特性（移动端同模式已被 2026-08-14 验收）。design §4.3(6) 明确平板保持块级布局、§2.2 不改两面板内部实现，故不要求本期改。QA 实测确认可接受度；如不可接受需另行评估（超出本期范围）。
  - Expected fix scope: 仅当 QA 判定不可接受时，可考虑平板下统一两面板高度基准；本期不实现。

### nit

- [ ] REV-002 `js/mobile-panel-tabs.js:31-46` `activate()` 在面板元素缺失时静默 return（`activeTab` 不更新、Tab 按钮未同步）。当前 `MobilePanelTabs` 无外部调用方，属防御性保护，不触发。可返回 boolean 或补 warn，不强制。

### suggestion

- [ ] REV-003 配套 REV-001：平板下给 `.resource-switch-list` 补 min-height 对齐选集高度，或统一视觉高度基准。仅建议，非必须。

### learning

- 跨断点 `sidebar-collapsed` 残留为既有行为：`js/player.js:1822-1831 initPlayerSidebar` 仅在页面加载时执行一次；桌面收起后缩到平板再放大回桌面，收起态会继续生效。design §2.2 明确不改侧栏收起逻辑本体，非本期引入。
- 断点切换残留类已天然消除：三端统一显示 Tab + 互斥后 `is-tab-active` 恒定，仅由 `activate()` 切换，无断点清理需求（design §4.5）。

### praise

- `activate()` 纯 `classList.toggle` 零加载调用，严格满足 compound `resource-load-race` 约束；`loadResourceSwitchList` 仅由 `player.js:313` 无条件启动，Tab 无任何直接/间接触发路径。
- HTML 静态预置 `is-tab-active`（`player.html:156,160`）与 `init()` 的 `activate('episodes')` 完全一致，无 FOUC。
- 互斥规则上移后特异性正确（id 分支 (1,2,0) / class 分支 (0,3,0)），三端 display 冲突逐一验证均被覆盖。
- `#mobilePanelTabs` 通用 `display:flex` + `.player-sidebar-toggle` 通用 `display:none`（≥1024 覆盖为 flex）组合，使平板"有 Tab 无收起"、桌面"有 Tab 有收起"、移动端"有 Tab"三态正确。

## 5. Test And QA Focus

- QA 必须重点复核：平板 641-1023 切 Tab 高度突变与滚动跳动（REV-001）；资源 Tab 激活不重复加载、来回切 Tab 分页/当前播放标记不归零；桌面收起/展开后 Tab 状态保持 + 刷新回默认选集；切源后"当前播放"标记；跨断点（≤640↔≥641）无残留类；移动端零回归；集数分页/倒序/切集跳页/自动连播在资源 Tab 激活（选集隐藏）时正常。
- Evidence pack residual risks / gate warnings：none
- 建议新增或加强的测试：无测试基建（项目无自动化测试）；设计 §5.2 M1-M11 手动验证为主
- 不能靠 review 完全确认的点：平板真实视口下高度差量化（需浏览器实测）；多资源/多页场景平板网格高度（`grid-auto-rows: 1fr` 仅 ≥1024 生效）；`initSidebarHeightSync` 在平板切 Tab 后无高度残留

## 6. Residual Risk

- REV-001 平板高度差可接受度（QA 实测后判定；不可接受则超出本期范围另行评估）
- 互斥规则依赖 `!important` + 高特异性层叠（(1,2,0)/(0,3,0)）：当前正确，未来给两面板加同 `!important` 且特异性 ≥ 的 display 规则会翻转互斥；需在后续改动 review 时注意
- `sidebar-collapsed` 跨断点残留为既有行为（design 非目标），接受

## 7. Verdict

- Status: passed
- Next: Standard feature → `cs-feat` acceptance（accept-inline，含 Inline Verification Matrix，按 M1-M11 + 回归清单核验）

## 8. Focused Closure（无则写 none）

none（initial review，无前轮）

---

## Round 2 复审（2026-08-16 验收反馈新增 diff）

### 复审范围

用户浏览器验证反馈两个问题后修复的新增 diff：
- `js/player.js`：`EPISODES_PER_PAGE` 20→21（3 列×7 行整页填满）、`renderEpisodes()` 补透明占位 + 新增 `episodePlaceholderCount()`、`RESOURCE_PAGE_SIZE` 3→6、`renderResourcePage()` 补占位
- `css/player.css`：通用区新增 `.episode-placeholder`/`.resource-placeholder`（`visibility:hidden` + `min-height:2.5rem`）；桌面块 `.resource-switch-card-poster` 恢复 `aspect-ratio: 3/4`（移除 `flex:1`/`aspect-ratio:auto`）

### 复审结论

**blocking：none**

**I-1（important，已修复）**：`episodePlaceholderCount` 用 `getComputedStyle().gridTemplateColumns.split(' ')` 计列数——`display:none`（资源 Tab 激活时切集/自动连播）下返回含 `minmax(0px,1fr)` 内部空格的抽象 track list，split 后列数翻倍（桌面 3 列算成 6），多补占位产生空行；且断点兜底（`cols<=1` 守卫）永不触发。
- 修复：`episodePlaceholderCount` 改为按断点映射定列数（≤640→3、641-767→4、768-1023→6、≥1024→3，与 CSS 实际列数一致，round 1 已验证），不再解析 computedStyle。
- 验证：`node --check js/player.js` 通过；lint 0 诊断。

**I-2（important，residual-risk 交 QA/终审）**：桌面 `.resource-switch-card-poster` 恢复 `aspect-ratio:3/4` 后，`.resource-switch-list { grid-auto-rows:1fr }` 行高与卡片自然高（poster 3/4 + info）可能存在行内留白或溢出。静态无法量化，需浏览器实测侧栏不同高度下 6 张卡片（及末页不足 6 张）无垂直溢出/明显底部空档。

**nit**：
- N-1 资源占位列数硬编码 3（当前全断点资源网格恒 3 列，正确；未来响应式列数需同步）
- N-2 RESOURCE_PAGE_SIZE 3→6 使移动端每页资源翻倍（design §2.2 接受，QA 顺带回归）
- N-3 EPISODES_PER_PAGE=21 对平板 4/6 列非整页（每页末行有占位），注释可更明确

**suggestion**：
- S-1（已采纳为 I-1 修复）断点映射为主、computedStyle 为辅
- S-2 平板 4/6 列下"每页填满"是行内不空缺（半实半占位），若需整页满需按断点分页大小——产品语义，非 bug

**learning**：`getComputedStyle().gridTemplateColumns` 在未布局（display:none）与已布局返回不同形态（px 轨道 vs 含内部空格的抽象 track list），split 计数不可互换——CSS 计算值解析陷阱。

**praise**：EPISODES_PER_PAGE 常量全量贯穿（renderEpisodes/updateEpisodePagination/bindEpisodePagination/playEpisode 跳页无残留 20）；占位数学正确（`%3` + 补位）；`visibility:hidden`+`aria-hidden` 规避 Tailwind CDN 运行时依赖，符合 compound 先例。

**residual-risk**：
- R-1（承接 I-1）：已修复，QA 复测"资源 Tab 下自动连播切集"确认无空行
- R-2（承接 I-2）：桌面资源卡片 3/4 封面 + 1fr 行高的留白/溢出，待浏览器实测
- R-3：移动端每页资源量翻倍，QA 回归确认翻页/滚动
- R-4：互斥规则 `!important` 层叠脆弱性（沿用 round 1）

### Test And QA Focus（round 2 追加）

1. 资源 Tab 激活时切集/自动连播（桌面+平板）：选集 display:none 下重渲染无空行（I-1 验证点）
2. 桌面资源面板多高度：6 张卡片行内留白/溢出观察（I-2）
3. 选集每页填满（三断点）：桌面 3 列 21 集满 7 行；平板 4/6 列末行占位；末页占位填满
4. 移动端 ≤640 回归：资源 6 张/页翻页滚动；选集 3 列满 7 行
5. 分页一致性：EPISODES_PER_PAGE=21 翻页/跳页/倒序高亮
6. 资源每页 6 张：翻页/切源/当前播放标记；无二次请求
7. 断点切换：≤640↔≥641↔≥1024 网格列数与占位正确重算，无残留类

### Round 2 verdict

- Status: passed（I-1 blocking 风险已修复并验证；I-2 为 residual-risk 交浏览器终审）
- Next: 继续 `cs-feat` acceptance（用户终审 + 最终审计）
