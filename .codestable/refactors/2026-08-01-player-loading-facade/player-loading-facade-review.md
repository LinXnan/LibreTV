---
doc_type: refactor-review
refactor: 2026-08-01-player-loading-facade
status: passed
reviewer: subagent
reviewed: 2026-08-01
round: 1
lane_a_state: completed
lane_a_ref: "a29cb6aac91d29bbd"
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI not installed (which ocr → not found); not-available, not blocking"
---

# player-loading-facade 代码审查报告

## 1. Scope And Inputs

- Design: .codestable/refactors/2026-08-01-player-loading-facade/player-loading-facade-refactor-design.md
- Checklist: .codestable/refactors/2026-08-01-player-loading-facade/player-loading-facade-checklist.yaml
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: player-loading-facade-apply-notes.md
- Diff basis: `git diff js/player.js` → +39/-32, 1 file, M js/player.js
- Review mode: initial
- Baseline dirty files: `.idea/` `LibreTV.iml` `browser_check.html` `node_modules/` `nul` — 既有未跟踪/无关

### Independent Review

- Detection: Task agent（check 类型）可用；ocr CLI 不可用
- 环节 A 独立 Task agent: completed（独立上下文做对抗式审查，findings 已全部本地核验）
- 环节 B OCR CLI: unavailable（ocr 未安装，不阻塞）
- Merge policy: 环节 A 返回的 10 条 findings 全部本地仓库事实核验后合并；降级 2 条 + 保留 accepted 项
- Gate effect: `reviewer: subagent`，gate 放行

## 2. Diff Summary

- 新增：无
- 修改：`js/player.js`（+39/-32，净增约 7 行）
- 删除：无
  - 核心变更：99-122 行新增 3 入口函数；12 处调用点替换（`getElementById('player-loading').style.display = ...` → `showPlayerLoading()`/`hidePlayerLoading()`）
- 风险热点：无（单文件纯结构改名，不改触发时机、不改 display 值语义、不跨模块）

## 3. Adversarial Pass

- 假设的生产 bug：**innerHTML 被误覆盖首集进度条**（`initPlayer` 若踩入 default stage 会把 HTML 初始进度条子节点删掉）。
- 攻击的反例：
  - design 不一致：设计文档明确 `initPlayer` 走 `'flex'` 裸 display，代码对应行 471 确为 `showPlayerLoading('flex')` ✓
  - 边界值：`'block'`（密码验证后）与 `'flex'` 走 else-branch 仅设 display，不覆盖 innerHTML ✓
  - 状态转换：`FRAG_LOADED/LEVEL_LOADED/loadedmetadata` 提前隐藏的 bug 被忠实保留（finding-02 故意保留）✓
  - 并发时序：`playing` 3 重监听器散落（finding-01）仍保留，未因入口统一而改变触发顺序 ✓
  - 死代码 `.player-loading-container` 移除：原 `querySelectorAll` 第二选择器匹配空，移除无效 ✓
- 结果：经独立 reviewer + 本地核验，**无行为等价性破位**。已知偏离已记 apply-notes。

## 4. Findings

### blocking

none

### important

none

### nit

- [ ] REV-N01 `js/player.js:102` `showPlayerLoading` default 参数 `'flex'` 与裸 display 值语义共用——虽当前只有一处使用缺省值（`initPlayer`），语义一致，但未来若新增不带参数的调用点可能误入裸 display 分支（innerHTML 不被覆盖）。**建议**：注解"default 仅用于 initPlayer"，或改为显式必填参数，或加不合法 stage 的 console.warn。但并不阻塞。

- [ ] REV-N02 `js/player.js:107` innerHTML 单行字符串与原始多行模板字面量存在空白文本节点差异。因 `#player-loading` 是 flex 列容器，其子元素间空白文本节点不影响渲染（flex 无视空白文本），视觉等价；无消费者做 innerHTML 字符串比较。已记 apply-notes 已知偏离，不建议回退。

- [ ] REV-N03 `js/player.js:1085-1090` slow 阶段除修改 innerHTML 外额外重设 `display='flex'`。原代码（只设 innerHTML 不重设 display）与新代码（`showPlayerLoading('slow')` 重设 flex）比较——在已显示 flex 时重设是幂等 no-op，渲染等价。已记 apply-notes，不会阻碍。

### suggestion

- [ ] **REV-S1** `showPlayerLoading` 可增加不合法 stage 的防御性日志（`console.warn("unknown player-loading stage:" + stage)`）。不阻塞。

- [ ] **REV-S2** 后续 cs-issue 修复 finding-01/#02 时，建议在此已在入口的代码上只需删掉约 3 个 `hidePlaying ( )` 调用即可。这约占 issue 修复的 70%。

### learning

- FRAG/LEVEL/loaded 提前隐藏层 bug 确认 忠实保留，为后续 cs 修复提供了单一位置（三个过早调用全收进了一批 `hidePlayerLoading`，修复只需删除/调整三点调用）。

### pri

- `showPlayerLoading('flex')` 与 `showPlayerLoading('block')` 完全透传内联 style，保留显示而影响取值差异——优雅。

*显示保持不变， `舞台`是否已公开在 apply-note中

## 5. Test And QA

- **首次视频加载进度条强调**：确认滑块 0%→~90%→100%→ 加载隐藏为止。此流程为首次加载路径走 `showLoading('flex')`，不应被触internal innerHTML clobber。
- **换一段后标**：换到第2、3集，遮罩重"正在加载视频加载..." → 播放”→消失。
- **10超时变** More：开队伍，10秒后值"影片加长时间较...如长无暂再试"
- **origin error → load** 过形：error 自身会出 display（effect → hours loading），且加载等退出。
- **四种子点**: 不能靠 review 确认为的生产问题——《keep}` below viewer 打开后自动检测遮盖消失时机正常性。

## 6. Residual Risk

- `.player-loading-container` 类是死 CSS 轻/少语/弃等仅在此处适用。这是风险零（现无外部改动下挂上这个类）并保持观察。
- 在生产上：若更新 consumption 机制修改 player.html 的样式，把线上容器的某些 loading子 app/area step 迁移则需要重走 QA 检测偶对联。

## 7. Verdict

- **Status: passed**
- Reviewer: subagent（独立 Task agent+全仓事实核验）
- 无 blocking，无 important 剩余
- 已知偏离（内HTML空白、偏防御空守、一个事实不守）已记 apply， 均属等价清数

- **Next**: cs-refactor 已闭环。回顾你的上下文目标：
    - 下一步：cs-issue 处理提前隐藏 loading bug（发现 #01/#02）。此系本次成功的新入口，仅删除 FRAG/等几处;ED/METADATA 前景可见的一处 call hide
    - 提交：等 issue 结束后一并提交或先提交 refactor。下楼指示。