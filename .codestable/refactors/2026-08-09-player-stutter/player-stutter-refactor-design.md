---
doc_type: refactor-design
refactor: 2026-08-09-player-stutter
status: approved
scope: js/player.js（播放管线：智能降级 795-839、广告过滤 Loader 1097-1181、dblclick 绑定 1077-1085）
summary: 4 条全做：dblclick 绑定一次(#4)、广告过滤保留 DISCONTINUITY 恢复时间线语义(#2)、Loader 统计异步化(#3)、智能降级改 maxAutoLevel 上限+恢复+冷却(#1)
---

# player-stutter refactor design

## 1. 本次范围

- scan 全部 4 条勾选 ✓：#1（智能降级）/#2（广告过滤语义）/#3（Loader 异步化）/#4（dblclick 绑定一次）
- **#2 决策假设**：scan 中 #2 给出三条路线，用户勾选但未指定方向。本 design 默认走 **方案 ii（保留 DISCONTINUITY 行，恢复时间线语义）**——这是唯一行为保持的路线（广告仍播放，与现状一致），也符合 refactor 行为等价底线；若实际想"真删广告片段"（方案 i），属行为变化需走 cs-feat，请在本 design review 时指出。
- 明确不做：ABR 起播估算调参、maxBufferHole 调整、Webkit 进度保存 bug（均为 scan 观察项；最后一个建议独立走 cs-issue）
- 总工作量：约 120 行改动 / 1 文件；总风险档位：中（#1 自适应控制为主要风险点）

## 2. 前置依赖

- **hls.js 版本**：1.6.2（`libs/hls.min.js`）。已核实 minified：可写的 ABR 上限 API 为 `hls.autoLevelCapping`（get/set 直通 `_autoLevelCapping`，默认 -1 无上限，设置后触发 `checkMaxAutoUpdated`）；`hls.maxAutoLevel` 是派生只读 getter（`autoLevelCapping === -1` 时返回最高档）。ABR 决策 `getNextABRAutoLevel` 用 `maxAutoLevel` 作自动选择上限——#1 用 `hls.autoLevelCapping` 作临时降级上限可行，且不触碰 `currentLevel` 不会禁用 ABR
- **#2 语义确认**：代理层 serverless 三件套 `FILTER_DISCONTINUITY=false`（proxy-gateway 文档），注释"交给播放器"——本 design 让前端不再删标记，与代理侧口径一致；广告统计展示（`totalAdsFiltered` / UI 胶囊）保留
- **#4 绑定点确认**：`art.video` 在 `new Artplayer({...})` 返回后即存在（ArtPlayer 构造时同步建 video 元素）；绑定移出 `playing` 回调安全
- **测试覆盖**：项目无自动化测试，验证以 HUMAN 目视 + 浏览器 Console/Network/Performance 面板为主；AI 自证用 grep 逻辑检查（同 search-latency 先例）

## 3. 执行顺序

顺序依据：低风险独立项先行 → 广告过滤语义（#2，Loader 区基础）→ Loader 异步化（#3，依赖 #2 后的函数形态）→ 智能降级（#1，主卡顿根因，最后做并充分验证）。#1/#4 与 #2/#3 代码区互不重叠，可独立回滚。

### 步骤 1：dblclick 监听改为每实例绑定一次（#4）

- **引用方法**：M-L4-06（Async & Cancellation——事件监听清理）
- **具体操作**：
  1. 删除 `player.js:1077-1085` 的 `art.on('video:playing', () => { art.video.addEventListener('dblclick', ...) })` 整块（该回调每次播放都往同一 video 元素追加 dblclick）
  2. 在 `player.js:842`（`art = new Artplayer({...})` 闭合之后）插入一次性绑定：
     ```js
     // 双击全屏：每播放器实例绑定一次，避免在 playing 回调里累积监听
     if (art.video) {
         art.video.addEventListener('dblclick', () => {
             art.fullscreen = !art.fullscreen;
             art.play();
         });
     }
     ```
- **退出信号**：grep `addEventListener('dblclick'` 全文件仅 1 处（新绑定点）；`art.on('video:playing'` 不再包含 dblclick
- **验证责任**：AI 自证（grep）+ HUMAN（暂停/播放多次后双击全屏仍单次生效）
- **回滚**：git revert 本步 commit

### 步骤 2：广告过滤保留 DISCONTINUITY 行，恢复时间线语义（#2，方案 ii）

- **引用方法**：M-L2-05（Decompose Conditional——把"删标记"分支与"统计"分支解耦）
- **具体操作**：
  1. `filterAdsFromM3U8`（`player.js:1121-1181`）：删除"过滤 #EXT-X-DISCONTINUITY 行"逻辑（1135-1138 的 `continue` 跳过分支）——该行与其他行一样进入 `filteredLines`，内容原样返回；保留 TS 序号/DISCONTINUITY 位置统计与广告区间计数（1143-1178）不动
  2. 函数语义同步：顶部注释改为"检测并统计广告区间（不修改播放列表，避免破坏 HLS 时间线）"；返回内容与入参一致（保留 `if (!m3u8Content) return ''` 空输入保护）
  3. `CustomHlsJsLoader.onSuccess`（1107-1111）：不再回写 `response.data`（内容原样放行）
- **退出信号**：`#EXT-X-DISCONTINUITY` 行出现在过滤后输出中；`filterAdsFromM3U8` 对任意输入返回内容 = 原内容（空输入除外）；`totalAdsFiltered` 计数逻辑未变
- **验证责任**：AI 自证（逻辑检查）+ HUMAN（开/关广告过滤对比同一影片广告边界：不再跳变/卡顿；统计胶囊仍显示过滤数）
- **回滚**：git revert 本步 commit
- **风险**：中（若某源流依赖"无标记"才能播，保留标记可能暴露其时间线问题——但按 HLS 规范保留标记才是正确行为，且与代理侧口径一致）

### 步骤 3：Loader 广告统计移出下载关键路径（#3）

- **引用方法**：M-L4-06（Async & Cancellation——异步化下载路径副作用）
- **具体操作**：`CustomHlsJsLoader.load`（`player.js:1101-1116`）的 `onSuccess` 改为先放行、后异步统计：
  ```js
  callbacks.onSuccess = function (response, stats, context) {
      if (response.data && typeof response.data === 'string') {
          // 广告统计与播放无关，异步执行不阻塞下载路径（#2 后 filter 不修改内容，无竞态）
          setTimeout(() => {
              filterAdsFromM3U8(response.data, true);
          }, 0);
      }
      return onSuccess(response, stats, context);
  };
  ```
- **退出信号**：`onSuccess` 同步路径不含 `filterAdsFromM3U8` 调用（仅出现在 `setTimeout` 内）；manifest/level 内容原样进入 hls.js
- **验证责任**：AI 自证（grep/逻辑）+ HUMAN（Performance 面板确认 manifest 加载时主线程无长任务；统计胶囊延迟显示可接受）
- **回滚**：git revert 本步 commit
- **风险**：低（统计是展示性功能，异步延迟显示无行为影响）

### 步骤 4：智能降级机制重构：maxAutoLevel 上限 + 恢复 + 冷却（#1）

- **引用方法**：M-L4-06（Async & Cancellation——把"永久锁级"改为"可恢复的自适应干预"）
- **具体操作**：重写 `player.js:788-839` 降级逻辑块，替换为单一状态机：
  1. **降级改用上限而非锁级**：两处 `hls.currentLevel = currentLevel - 1` 改为 `hls.autoLevelCapping = Math.max(1, currentLevel - 1)`（hls.js 1.6.2 可写上限 API 为 `autoLevelCapping`；`maxAutoLevel` 是派生 getter）——hls.js ABR 在上限内继续自动选择，不进入 manual 模式；`currentLevel` 读取后 `if (hls.currentLevel < 1)` 直接跳过（自动模式早期返回 -1 时不误降）
  2. **恢复机制**：用实例内标志 `qualityCapped` 记录"本实例是否降过级"；缓冲健康检查中若 `bufferLength >= 10`（健康阈值）且 `qualityCapped`，`hls.autoLevelCapping = -1` 交还完整 ABR 并清标志；恢复后重置 stall 计数
  3. **冷却**：新增 `lastDegradeAt`；降级后 15s 内（`COOLDOWN_MS = 15000`）不再降级，替代原"每 3s 检查即可连降"
  4. **误触发保护**：监听 `seeking` 记录 `lastSeekAt`；`timeupdate` 健康检查与 `waiting` 降级都要求 `now - lastSeekAt > 5000`（起播/seek/切集后缓冲瞬时为 0，5s 内不降级）；`video.readyState < 3` 时跳过
  5. **waiting 计数修正**：去掉 `playing` 事件里 `bufferStallCount - 1` 的自抵消（该逻辑使 waiting 降级永不达标）；改为 waiting 计数只增不减，`stallCount >= STALL_THRESHOLD(3) && 冷却已过` 时降级一次并清零；缓冲健康（≥10s）时归零 stallCount
- **退出信号**：`player.js` 无 `hls.currentLevel = ... - 1` 锁级写法（降级全部走 `hls.autoLevelCapping`）；存在恢复（`autoLevelCapping = -1` + `qualityCapped` 标志）/冷却（15s）/seek 保护（5s）/readyState 保护逻辑
- **验证责任**：HUMAN（弱网与正常网各播一段，Console 观察等级变化：降级后能自动回升、不连续切级、seek 不误降级）+ AI 自证（逻辑检查）
- **回滚**：git revert 本步 commit
- **风险**：中（自适应控制改动；hls.js 内部行为依赖已核实版本 1.6.2 的 maxAutoLevel 语义）

## 4. 风险与看点

- **高风险**：#1（自适应控制，需弱网/正常网充分目视验证；若 autoLevelCapping 语义与预期不符，回退为"仅加冷却+恢复、保留锁级"的保守版）
- **中风险**：#2（保留 DISCONTINUITY 后个别源流可能暴露时间线问题；统计计数需确认仍正确）
- **低风险**：#3、#4
- **容易出错**：
  - #2 删除"删标记"分支时勿误删统计逻辑（1143-1178）；`nextIsAfterDiscontinuity` 标记逻辑保留
  - #3 异步化后若 filterAdsFromM3U8 未来恢复"修改内容"职责会产生竞态——在函数注释里写明"当前为纯统计，异步调用安全"
  - #1 的 `Math.max(1, currentLevel - 1)` 确保上限 ≥1（不把自己锁在最低级）；恢复条件用自身标志 `qualityCapped` 判断"是否降过级"（`maxAutoLevel` getter 在 `autoLevelCapping === -1` 时返回最高档，无法区分"未降级"与"上限=最高档"）
- **验证总览**：#4 #3 #2 AI 自证为主、HUMAN 快速目视；#1 以 HUMAN 目视为主（弱网/正常网对比）
