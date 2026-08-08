---
doc_type: feature-review
feature: unify-toast-position
status: passed
reviewer: subagent
reviewed: 2026-08-08
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: ocr CLI 未安装（where ocr 无输出）
---

# unify-toast-position 代码审查报告

## 1. Scope And Inputs

- Design: none（fastforward，无 design doc）
- Checklist: none（fastforward 无 checklist）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: `.codestable/features/2026-08-08-unify-toast-position/unify-toast-position-ff-note.md` + 对话（用户确认范围：仅统一历史撤销条 + 恢复位置提示，其余不动）
- Diff basis: `git status --short`（M css/player.css、M css/styles.css、M js/ui.js、?? .codestable/features/2026-08-08-unify-toast-position/）+ `git diff`
- Review mode: initial → full-rereview（round 1 发现 blocking，修复后 round 2 完整独立复审）
- Baseline dirty files: none（.idea/、LibreTV.iml、_analyze_artplayer.mjs、_sizecheck.mjs、node_modules/ 为会话开始前已存在的未跟踪项，与本次无关）

### Independent Review

- Detection: 主 agent 自检——独立 Task agent 可用；ocr CLI 未安装
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 与 round 2 均为独立 subagent）
- 环节 B OCR CLI: unavailable（`where ocr` 无输出；protocol: OcrNotAvailable 不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 两轮环节 A 结果均已逐条本地仓库事实核验后合并
- Gate effect: 环节 A 为 gate 必需，已完成，可定稿 passed

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-08-unify-toast-position/`（ff-note + review）
- 修改：
  - `css/styles.css` — `.history-undo-toast` 定位统一顶部居中 + keyframes 收敛为 `toast-slide-in-down/out-up`；删除 `.position-restore-hint` 旧定义块
  - `css/player.css` — `.position-restore-hint` 改顶部居中（`top: calc(88px+16px)`，避开固定 header）+ 移动端 safe-area + opacity 显隐收敛
  - `js/ui.js` — `hideHistoryUndoToast` 移除时序 180→220ms
- 删除：`css/styles.css` 旧 `.position-restore-hint` 定义（原 842-861 区）
- 未跟踪 / staged：ff-note、review
- 风险热点：UI（fixed 定位 / z-index / 动画 / 移动端 safe-area）

## 3. Adversarial Pass

- 假设的生产 bug（round 1）：`.position-restore-hint` 移到顶部后被 player 页固定 header 遮挡 → 反例被确认（REV-001 blocking）。
- 主动攻击过的反例：位置属性冲突 / 动画 transform 冲突 / safe-area 覆盖 / z-index 叠加 / 隐藏残留 / 遗漏其他底部通知 / header 高度假设 / 旧定义删除后显隐完整性 / 其他页面受影响。
- 结果：REV-001/002/003/004 均已修复并核验闭合；round 2 攻击未发现新的 blocking/important。

## 4. Findings

### blocking

- [x] REV-001 `css/player.css:202`（round 1）`.position-restore-hint` 顶部 16px 被 player 页固定 header（z-index 9000 !important、不透明 #111、高约 78px）遮挡，提示不可见，净回归。
  - 修复：`top: calc(88px + 16px)` 纵向避让 header（88px 假设经核验：header 实际约 78px < 88px，余量充足），不靠 z-index（header 为 int 上限 2147483647，无法覆盖）。round 2 复审确认闭合。

### important

- [x] REV-002 `css/player.css:202`（round 1）`.position-restore-hint` 缺移动端 safe-area。
  - 修复：新增 `@media(max-width:640px)` `top: max(calc(88px+16px), calc(88px + env(safe-area-inset-top) + 16px))`，叠加 header 高度。round 2 复审确认闭合。

### nit

- [x] REV-003 `js/ui.js:797`（round 1）撤销条移除时序 180ms 与动画 180ms 等长，可能截断滑出动画。
  - 修复：setTimeout 改 220ms 留 40ms 余量。round 2 复审确认闭合。
- [ ] REV-005 `css/player.css:212`（round 2）`position-restore-hint` 隐藏时 opacity 瞬时消失（transition 仅作用于 transform），滑出无过渡。与修复前行为一致，不属回归，不阻塞。

### suggestion

- [x] REV-004 `css/styles.css:843-861`（round 1）`.position-restore-hint` 跨文件重复定义，opacity 显隐依赖被覆盖的旧定义，未来清理会裸显示。
  - 修复：opacity 显隐收敛进 player.css 唯一定义，删除 styles.css 旧块，全仓库无残留引用。round 2 复审确认闭合。
- [ ] REV-006 `css/player.css:219`（round 2）safe-area 单条 `max()` 无 fallback（与 mobile-optimize.css 中 #toast 的双写风格不同），但与现代浏览器兼容、且与项目内 .history-undo-toast 写法一致，不阻塞。

### learning

- 项目 fixed header 的 z-index 达 `2147483647 !important`，顶部 fixed 提示只能靠纵向避让、不能靠 z-index 覆盖。
- 动画 transform 与定位 transform 需保持一致（`.history-undo-toast` 基础 `translateX(-50%)` 与 keyframes 各帧一致，避免横向跳动）。

### praise

- REV-001 修复精准：`88px + 16px` 避开 header 且余量充分（header 实际约 78px）。
- safe-area 处理正确叠加 header 高度，比 `.history-undo-toast` 更贴合 player 页场景。
- opacity 显隐收敛到 player.css 唯一定义，跨文件重复定义问题彻底解除。

## 5. Test And QA Focus

- QA 必须重点复核（浏览器手动验证）：
  1. 播放页「从历史继续播放」→ `.position-restore-hint` 显示在 header 下方顶部居中、完整可见、3 秒滑出（REV-001 判定）
  2. 带刘海移动端触发撤销条与位置提示，均避开安全区/header（REV-002 判定）
  3. 连续快速删除多条历史 → 撤销条滑出动画完整无截断（REV-003 判定）
  4. index 页删除历史 → 撤销条顶部居中显示，不被左上/右上 z-10 按钮遮挡（z-index 10000 高于按钮，安全）
  5. DevTools 确认 `.position-restore-hint` 相对视口定位（residual-risk R1）
- Evidence pack residual risks / gate warnings：none
- 建议新增或加强的测试：none（纯 CSS/静态项目，无自动化测试基础设施）
- 不能靠 review 完全确认的点：浏览器实际渲染效果（fixed 定位 / 刘海屏 / 动画）需手动验证。

## 6. Residual Risk

- `.position-restore-hint` 由 JS append 进 `.player-container`，若其任一祖先被 `performance-optimize.css` 的 GPU 规则（`transform: translateZ(0)`）创建包含块，`position:fixed` 会退化相对该祖先定位；当前 `.player-container` 自身无 transform，祖先链需浏览器实测确认。
- index 页 `.history-undo-toast`（z-index 10000）与 `#toast`（z-index 9999 / 内联 2147483647）同时出现时会纵向重叠；当前无并发触发路径，若未来出现需统一队列或错位。

## 7. Verdict

- Status: passed
- Next: fastforward 收尾——cs-keep 沉淀提示 + 询问是否代为 scoped-commit

## 8. Focused Closure（无则写 none）

none（round 1→round 2 为完整独立复审，非 focused closure）
