---
doc_type: refactor-review
refactor: 2026-08-09-player-stutter
status: passed
reviewer: subagent
reviewed: 2026-08-09
round: 1
lane_a_state: completed
lane_a_ref: code-explorer 独立 Task agent
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装（where ocr → EXIT=1），按协议不阻塞本轮"
---

# player-stutter 代码审查报告

## 1. Scope And Inputs

- Design: `.codestable/refactors/2026-08-09-player-stutter/player-stutter-refactor-design.md`（status: approved）
- Checklist: `.codestable/refactors/2026-08-09-player-stutter/player-stutter-checklist.yaml`（4 步 done，c1-c5 passed）
- Evidence pack: `review-packet.diff`（js/player.js 未提交改动）
- Implementation evidence: `player-stutter-apply-notes.md`（4 步 + review-fix）
- Diff basis: git diff（js/player.js 1 文件，+106/-56 含 review-fix，未提交）
- Review mode: initial + review-fix focused closure
- Baseline dirty files: `.idea/`、`LibreTV.iml`、`_analyze_artplayer.mjs`、`_sizecheck.mjs`、`node_modules/`（会话前已存在，非本次改动）

### Independent Review

- Detection: 环节 A 独立 Task agent（code-explorer）可用并已执行；环节 B OCR CLI 不可用（不阻塞）
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 未启用
- Merge policy: 环节 A findings 已逐条本地核验后合并（I1 直接读代码确认；I2 用 ArtPlayer v5.2.4 minified 源码验证 `art.switch` → `e.url` setter → 对 customType 用同一 `$video` 元素调用）
- Gate effect: 环节 A 已完成，`reviewer: subagent` 满足 gate

## 2. Diff Summary

- 修改：`js/player.js`（+106/-56）
  - #4 dblclick 从 `art.on('video:playing')`（每次播放累积）改为 `new Artplayer` 后每实例绑定一次
  - #2 `filterAdsFromM3U8` 保留 DISCONTINUITY 行（纯统计，内容原样返回）
  - #3 `CustomHlsJsLoader.onSuccess` 广告统计改 `setTimeout(0)` 异步，不阻塞下载路径
  - #1 智能降级：`hls.currentLevel = N-1` 锁级 → `hls.autoLevelCapping` 上限；新增恢复/冷却/seek 保护/readyState 保护/waiting 计数修正
  - review-fix：`degradeLevel` 返回 boolean 仅成功时清零；降级监听改为先移除再绑定（`qualityHandlers`）
- 未跟踪 / staged：none
- 风险热点：播放自适应控制（#1）、切集生命周期（art.switch 不重建 video）、异步统计时序（#3）

## 3. Adversarial Pass

- 假设的生产 bug：
  1. 降级被冷却拦截时计数清零 → 冷却期内反复"计数→清零"，延迟降级响应（I1，核验成立）
  2. `art.switch` 切集不重建 video → 降级监听累积 + 旧闭包操作已 destroy 的 hls（I2，核验成立，pre-existing）
  3. `hls.currentLevel` 自动模式早期为 -1 → 降级写 -2 非法等级（原 bug，本次已用 `currentLevel < 1` 保护 + autoLevelCapping 消除）
  4. seek 后缓冲瞬时为 0 误降级（本次用 lastSeekAt 5s 保护消除）
  5. `qualityCapped` 标志 vs `maxAutoLevel` getter 不可区分（本次用自身标志，设计已修正）
  6. `filterAdsFromM3U8` 异步化后 `totalAdsFiltered` 跨切集时序竞态（S3，展示性，低影响）
  7. `restoreAutoLevel` 无稳定阈值 → 10s 附近振荡（S1，受冷却限流，风险低）
- 主动攻击过的反例：无 blocking 级问题

## 4. Findings

### blocking

none

### important

- [x] I1 `js/player.js` 降级被冷却/保护拦截时仍无条件 `bufferStallCount = 0`
  - Evidence: waiting 分支 `degradeLevel(); bufferStallCount = 0;`，而 `degradeLevel` 在冷却未过/`currentLevel<1`/`target<1` 时直接 return
  - Impact: 冷却期内"计数→清零"循环抹掉卡顿信息，冷却过期后需重新攒 3 次卡顿才降级，弱网持续卡顿下降级响应延迟；偏离 design"冷却已过时降级并清零"
  - Expected fix scope: `degradeLevel` 返回 boolean，仅成功时清零
  - 处理: 已修复，waiting 分支改为 `if (degradeLevel()) bufferStallCount = 0;`（player.js:849）
- [x] I2 `js/player.js` 降级块 waiting/timeupdate/seeking 监听随 `art.switch` 切集累积
  - Evidence: ArtPlayer v5.2.4 minified 确认 `art.switch` setter = `switchUrl` → `e.url = url` → url setter 对 customType 调 `s.call(e, $video, url, e)`，同一 `$video` 不重建；每次切集降级块重复 addEventListener，旧闭包捕获已 destroy 的旧 hls
  - Impact: 多集播放后累积多套降级闭包，缓冲事件触发多套计数/降级；旧监听操作已销毁 hls 行为未定义；与 #4 修复的同类问题不一致（pre-existing，非本次回归，但本次重写未一并处理）
  - Expected fix scope: 模块级 `qualityHandlers` 持有监听引用，重新绑定前 removeEventListener
  - 处理: 已修复（player.js:85、831-834、881-888），先移除上一源监听再绑定新源

### nit

- [ ] N1 降级/恢复/缓冲的 `console.log` 遗留（player.js:822、833、813）——既有代码风格同样有日志，本次保留（弱网反复缓冲时受 15s 冷却限流）；建议未来统一纳入 debug 开关
- [ ] N2 `filterAdsFromM3U8` 的 `strictMode` 死参（player.js:1122 附近）——apply-notes 已承认既有死参，未处理

### suggestion

- [ ] S1 `restoreAutoLevel` 无稳定阈值，缓冲在 10s 附近波动可能造成上限反复切换（受 15s 冷却限流，风险低；如后续观察到振荡再加"健康持续 N 周期"）
- [ ] S2 dblclick `if (art.video)` 容错——若未来 ArtPlayer 延迟创建 video 会静默失效；可保留 `ready` 兜底
- [ ] S3 异步统计 `totalAdsFiltered` 跨切集竞态（展示性）；可在 setTimeout 内校验 `adFilteringEnabled` 或丢弃过期统计

### learning

- hls.js `currentLevel` 自动模式早期可为 -1，`degradeLevel` 的 `currentLevel < 1` 保护正确防起播误降，但"被保护跳过"与"实际降级"未在日志区分（HUMAN 弱网验证时注意）
- `art.switch`（不重建 video、监听累积）与 `initPlayer`（destroy 重建、无累积）是两条不同切集路径，生命周期影响截然不同
- hls.js 1.6.2 可写 ABR 上限 API 是 `autoLevelCapping`（`maxAutoLevel` 是派生 getter），降级设计应以此为锚

### praise

- `autoLevelCapping` 取代 `currentLevel` 锁级，正确理解 hls.js ABR 语义，不再禁用自动切换且可恢复——本次重构核心价值
- `qualityCapped` 自身标志规避 `maxAutoLevel` getter 不可区分问题，修复轨迹可追溯
- DISCONTINUITY 保留方案与代理层 `FILTER_DISCONTINUITY=false` 口径一致，边界划分正确

## 5. Test And QA Focus

- QA 必须重点复核：
  1. 弱网/正常网各播一段：降级后（Console 出现"智能降级: ABR 上限 → N"）能自动回升（"交还 ABR 自动选择"），不连续切级，seek 不误降级（c4）
  2. 连续切集 3 集以上：Console 无重复/堆积的降级日志（同一次缓冲只出现一次"卡顿计数"序列），降级监听不累积（c5/I2）
  3. 广告边界：开/关广告过滤对比同一影片，广告边界不再跳变/卡顿（c2）
  4. 统计胶囊：广告过滤开启时计数仍显示（c2/c3）
  5. Performance 面板：manifest 加载时主线程无长任务（c3）
  6. 暂停/播放多次后双击全屏仍单次生效（c1）
- Evidence pack residual risks / gate warnings: none
- 建议新增或加强的测试：none（项目无自动化测试基建）
- 不能靠 review 完全确认的点：真实弱网下 ABR 恢复行为、不同源流广告边界 PTS 结构、长会话多次切集的监听累积表现

## 6. Residual Risk

- S1 缓冲 10s 附近振荡（低，冷却限流兜底）
- S3 异步统计跨切集计数误差（展示性，低）
- hls.js 内部 autoLevelCapping 触发重评估的节流行为未经真机验证（HUMAN 弱网验证确认）
- 保留 DISCONTINUITY 后个别源流若时间线本身有洞，表现取决于源（HUMAN 验证确认）

## 7. Verdict

- Status: passed（环节 A 独立审查 + 2 项 important 已修复并本地核验，无 blocking）
- Next: 按「进入来源」表 → refactor 收尾提交（commit 前先完成 HUMAN 验证项）
