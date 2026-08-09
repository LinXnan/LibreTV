---
doc_type: refactor-scan
refactor: 2026-08-09-player-stutter
status: user-reviewed
scope: js/player.js（播放管线核心，2864 行）；player.html / js/config.js 作为锚点参考（未全量扫描）
summary: 发现 4 条优化点（性能 3 / 需决策 1）+ 3 条非清单观察项；前置检查第 2 条命中（无测试覆盖），按仓库先例以 HUMAN 验证兜底。用户已全选 ✓（2026-08-09）
---

# player-stutter scan

## 总览

- 扫描范围：`js/player.js`（播放管线：HLS 配置、ArtPlayer 集成、广告过滤 Loader、智能降级、事件绑定、进度保存）
- 触发：用户反馈"播放很卡顿"，要求分析当前实现逻辑与优化点
- 发现 4 条优化点：性能 3 / 需决策 1；按风险：低 1 / 中 2 / 中-高 1
- 建议先做：#4（低风险独立）→ #3（下载路径减负）→ #1（主卡顿根因）
- 建议慎做 / 后做：#2（行为决策项，需先拍板"广告过滤"的目标语义）
- 前置检查 7 条：
  1. 行为改动？✓ 无夹带新需求；但 #2 与部分观察项涉及可观察行为变化，已在条目内标注"需决策"
  2. 测试覆盖？**命中**（项目无自动化测试基建，package.json 无 test 脚本，attention.md 明确手动验证；同 2026-08-09-search-latency 先例：性能类条目以 HUMAN 目视 + 浏览器 Network/Console/Performance 面板验证为准，如实说明见下）
  3. 跨模块？✓ 无（候选集中于 player.js 单文件；代理层仅作背景核对，非改动目标）
  4. 风格口味？✓ 无
  5. 生成/第三方？✓ 无（libs/ 第三方库仅引用不修改）
  6. 范围太大？✓ 扫描焦点 1 文件 2864 行 < 3000、< 15 文件
  7. 零候选？✓ 有 4 条

### 关于命中第 2 条（无测试覆盖）的说明

项目无自动化测试基建。播放类改动（ABR 行为、网络自适应、过滤逻辑）难以用单元测试固化，验证以 **HUMAN 目视 + 浏览器面板** 为主：改前记录现象（弱网/正常网各播一段、观察等级变化与卡顿点），改后对比"播放更顺 / 画质可自动回升 / 广告边界无跳变"。若需更强保障可先补刻画测试（需引入测试 runner，成本高，本 scan 不预设）。

### 既有相关记录对账（防止重复发现）

| 记录 | 状态 | 与本 scan 关系 |
|---|---|---|
| audit 2026-08-02-player-performance finding-01（Loader 同步过滤） | open | 已部分修复（单轮遍历），本次 #3 承接剩余同步开销 |
| 同审计 finding-02（lowLatencyMode true） | 已修复 | 现为 `lowLatencyMode: false`（player.js:528），不再重复 |
| 同审计 finding-03（过滤函数 console.log） | 已修复 | 现 `filterAdsFromM3U8` 无日志（player.js:1121-1181），不再重复 |
| issue 2026-08-01 proxy-binary-corruption / proxy-full-buffer | 已修复 | 播放 m3u8 由 hls.js 直连（player.js 无 PROXY_URL 使用），代理仅服务图片/搜索；代理二进制分支已修复，非本次卡顿面 |

## 条目

### [1] 重构智能降级机制：解除 ABR 锁级、恢复自动、连降加冷却 ✓

- **位置**：`js/player.js:795-839`
- **分类**：性能
- **现状**：两处降级都执行 `hls.currentLevel = currentLevel - 1`：(a) `video:waiting` 连续 ≥3 次卡顿（795-809）；(b) `timeupdate` 每 3s 检查缓冲 <5s 即降级（817-839）。hls.js 一旦手动 set `currentLevel` 即停用 ABR 自动切换；代码从不 `hls.currentLevel = -1` 交还自动。缓冲检查无冷却，缓冲持续 <5s 时每 3s 连降（到 0 为止）。`playing` 事件把 `bufferStallCount` 减 1（813），使 waiting 降级几乎永不达标（净增量 0），实际只有缓冲检查在生效。
- **问题**：降级是单向且永久的——一次网络抖动或 seek（seek 后缓冲瞬时为 0）后画质被锁低，ABR 不再自动升回；每次切级 = 中断下载 + flush buffer + 重拉分片，网络抖动时 3s 一次连切反而加剧卡顿；自动模式下 `hls.currentLevel` 可能返回 -1，写入 `-2` 是非法等级（hls.js 1.6.2 `currentLevel` setter 直设 `manualLevel`，负值无保护）。
- **建议**：降级改为不锁死 `currentLevel`（如 `hls.nextLevel = hls.currentLevel - 1`，保留 ABR 骨架）；降级后设 10-20s 冷却并周期检查，缓冲恢复后 `hls.currentLevel = -1` 交还自动；起播/seek/切集后的缓冲瞬时为 0 不应触发降级（加"距起播/seek ≥ N 秒"保护）；把 waiting 计数与缓冲检查合并为单一状态机，消除互相抵消的死逻辑。
- **建议映射的方法**：M-L4-06（Async & Cancellation）
- **风险**：中（改动播放自适应控制，需真人目视确认弱网/正常网不同表现）
- **验证**：HUMAN（弱网与正常网各播一段，Network/Console 观察等级变化：降级后能自动回升、不连续切级、seek 不触发误降级）
- **范围**：约 50 行 / 1 文件

### [2] 广告过滤只删 DISCONTINUITY 标记：未删广告且引入空洞风险（行为决策项） ✓（默认走方案 ii：保留标记恢复时间线语义）

- **位置**：`js/player.js:1134-1138`（删行）、`1162-1172`（统计）
- **分类**：性能
- **现状**：`filterAdsFromM3U8` 把所有 `#EXT-X-DISCONTINUITY` 行删掉，TS 片段一行不删；统计"广告区间"仅计数展示，不涉及删片。
- **问题**：(a) "广告过滤"实际没有过滤掉广告内容——广告仍播放，只移了时间线标记，与 UI 文案"个广告已过滤"语义不符；(b) 删标记但保留片段，破坏了 HLS 时间线连续性：源流在广告边界存在真实 PTS 不连续时，播放器不知道边界 → buffer hole；`maxBufferHole: 1.0`（537）下空洞 >1s 触发 nudge seek → 广告边界跳变/卡顿（这是"播放卡顿"的可疑根因之一）。
- **建议**：**需用户决策**：(i) 目标"不播广告"→ 连广告区间 TS 行一起删（真过滤，属行为变化，可走 cs-feat）；(ii) 目标"播放器不感知广告"→ 保留 DISCONTINUITY 行恢复时间线语义，统计逻辑单独解析（行为不变，本 refactor 可做）；(iii) 关闭广告过滤（默认开启，设置可关）。当前"只删标记"两头不占。
- **建议映射的方法**：无直接对应（本质是需求权衡，决策后再路由 cs-feat / cs-issue 或回本 refactor）
- **风险**：中-高（涉及过滤行为变化，且不同源流 PTS 结构不同，表现不定）
- **验证**：HUMAN（开/关过滤对比同一影片广告边界是否跳变/卡顿；决策后按所选方案验证）
- **范围**：约 40 行 / 1 文件

### [3] CustomHlsJsLoader 在 manifest/level 下载回调同步做全量过滤 ✓

- **位置**：`js/player.js:1097-1118`（`CustomHlsJsLoader.load` 的 `onSuccess` 内同步 `filterAdsFromM3U8`）
- **分类**：性能
- **现状**：每次 manifest / level 加载成功，`onSuccess` 里同步执行 `filterAdsFromM3U8`（split 全部行 + 逐行 trim + 正则 + Set 统计）。主 manifest 和每个 level playlist 加载都触发一次。
- **问题**：这是 hls.js 下载关键路径上的主线程同步 O(n) 文本处理；多码率流每次切级 / 刷新 playlist 都重复执行，长列表（数百行）叠加在多线程渲染主线程上（audit finding-01 遗留：已优化为单轮遍历，但仍同步在回调里）。
- **建议**：把过滤移出同步回调——在 loader 内用 `queueMicrotask` / `setTimeout(0)` 或 Worker 异步处理后再调 `onSuccess`；或将"广告计数统计"与"行过滤"解耦，统计不阻塞返回。
- **建议映射的方法**：M-L4-06（Async & Cancellation）
- **风险**：低-中（下载路径改动，需真机看起播与切级是否受影响）
- **验证**：HUMAN（Performance 面板对比改前后主线程长任务；Network 确认 manifest/level 加载时序不变）
- **范围**：约 30 行 / 1 文件

### [4] video:playing 事件内累积注册 dblclick 监听 ✓

- **位置**：`js/player.js:1077-1085`
- **分类**：性能
- **现状**：`art.on('video:playing', () => { art.video.addEventListener('dblclick', () => { art.fullscreen = !art.fullscreen; art.play(); }); })`。每次播放/恢复（pause→play、卡顿恢复、切集）都向同一 video 元素追加一个 dblclick 监听，从不移除。
- **问题**：一个会话内多次播放后 video 元素挂 N 个 dblclick handler；一次双击触发 N 次全屏切换（奇偶相抵时全屏疑似失效并闪烁）；内存与事件处理器泄漏（M-L4-06 明确的"事件监听无清理"性能债）。
- **建议**：dblclick 监听移到 `initPlayer` 创建实例时绑定一次（不在 playing 回调内），或改用事件委托 + 幂等绑定标记。
- **建议映射的方法**：M-L4-06（Async & Cancellation）
- **风险**：低
- **验证**：AI 自证（grep 确认无其他绑定点）+ HUMAN（暂停/播放多次后双击全屏仍单次生效）
- **范围**：约 8 行 / 1 文件

## 观察项（非清单，供参考，不进 design）

- **ABR 起播估算偏低**：`abrEwmaDefaultEstimate: 500000`（500kbps）+ `abrBandWidthUpFactor: 0.6`（player.js:549-552），起播从低码率缓慢爬升，弱网/大屏感知"起播糊、升档慢"。属参数调优（方法库无对应），可单独调参验证（如默认估算提至 2-4Mbps）。
- **maxBufferHole: 1.0 放大空洞跳变**（player.js:537）：与 #2 联动——若广告过滤造成空洞，1.0 的容忍让播放器"跳过"而非"等待"，观感像跳帧。若 #2 走方案 (ii) 保留 DISCONTINUITY，此参数可回默认 0.5。
- **疑似 bug（建议独立走 cs-issue，不在本 refactor 处理）**：Webkit 切集走 `initPlayer` 重建播放器（player.js:1367-1368），`waitForVideo` 轮询（344-379）只对首个 art 实例绑定节流进度保存；新实例无 10s 节流自动保存（仅剩 unload / visibility 兜底）→ 第二集起播放中进度自动保存失效风险。
