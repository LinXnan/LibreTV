---
doc_type: refactor-scan
refactor: 2026-08-01-player-loading-facade
status: user-reviewed
scope: js/player.js + player.html 中 #player-loading 元素的所有显隐/文案操作点
summary: 发现 2 条结构收敛点，全部围绕 #player-loading 的散落直接 DOM 操作。本轮严格行为等价，不修审计 finding 中的 bug（提前隐藏/进度条被删/三重监听竞态），那些留 cs-issue。
---

# player-loading-facade scan

## 总览

- 扫描范围：`js/player.js` 中所有对 `#player-loading` 的 `style.display` / `innerHTML` 直接操作（共 12 处写入点），`player.html:102-110` 的 loading DOM 结构
- 发现 2 条结构优化点：结构 2 / 性能 0 / 可读性 0 / 架构 0
- 按风险：低 2 / 中 0 / 高 0
- 建议先做：#01（抽入口、机械收口、AI 可 grep 自证）→ #02（换集/超时的 innerHTML 改走入口文案 API）
- 建议慎做 / 后做：无
- 前置检查 7 条：①不夹带行为改动(本轮保留 bug 现状) ②无测试——以穷举 grep 双向自证替代，写入 design 验证策略 ③不跨模块(仅 player.js) ④非口味项 ⑤非生成产物 ⑥范围 1 文件 ~15 动点 ⑦有候选 → 全过 ✓

## 条目

### #01 抽 playerLoading 显隐入口，收口 12 处直接 style.display 操作 ✓
- **位置**：`js/player.js:104,118,447,592,651,741,746,872,975,1240,1339`（12 处对 `#player-loading` 的 `style.display` 读写）；对照范本 `js/ui.js:117-144` 的 `showLoading/hideLoading`
- **分类**：结构
- **现状**：`#player-loading` 的 `display` 被 11 处直接写 `'none'`/`'flex'`/`'block'`，1 处读判断；无统一入口。同文件内 `#loading` 已有 `showLoading()/hideLoading()` 统一管理（ui.js），`#player-loading` 是漏网的一个。
  ```js
  // 典型散点（player.js:592, 741, 872 三处独立写 none）
  document.getElementById('player-loading').style.display = 'none';
  ```
- **问题**：同一 DOM 元素的显隐状态被 11 处写入点分散管理，无单一事实源；要回答"现在 loading 是否显示"必须扫描 11 处。对照 `#loading` 已收口为 2 函数，`#player-loading` 的散落数 = 11。
- **建议**：新增 `showPlayerLoading()` / `hidePlayerLoading()` / `isPlayerLoadingVisible()` 三个函数（放 player.js 顶部工具区，参照 ui.js 的 showLoading/hideLoading 形态），把 12 处直接操作逐一替换为函数调用；`getElementById('player-loading')` 调用点内部收口到函数体内。**保持每处的触发时机和目标 display 值完全不变**（原来在哪一刻写 none 仍在那一刻写 none）。
- **建议映射的方法**：M-L2-01（Extract Function）+ M-L1-01（Parallel Change：先建入口 → 逐处切换 → grep 清零）
- **风险**：低（纯机械收口，不改触发时机；每处只是把赋值换成等价函数调用）
- **验证**：AI 自证——改完 grep `player-loading.*style.display` 与 `getElementById\('player-loading'\)` 在 player.js 中除新入口函数体外应为 0 处；手动跑 `npm run dev` 打开播放页确认加载/播放/换集/出错时遮罩显隐与改前一致
- **范围**：约 30 行 / 1 文件

### #02 把换集与 10s 超时的 loading.innerHTML 覆盖收口到入口的 setStage API ✓
- **位置**：`js/player.js:1339-1343`（`playEpisode` 换集）、`js/player.js:1073-1077`（10s 超时提示）
- **分类**：结构
- **现状**：两处直接 `document.getElementById('player-loading').innerHTML = \`...\`` 覆盖整个 loading 容器内容：
  ```js
  // player.js:1339 换集
  document.getElementById('player-loading').innerHTML = `
      <div class="loading-spinner"></div>
      <div>正在加载视频...</div>
  `;
  ```
- **问题**：2 处独立 `innerHTML` 覆盖，与 #01 的显隐入口割裂；文本和 DOM 结构硬编码在业务路径里。同一 loading 容器的"内容重置"应在入口内提供 API 而非散落赋值。
- **建议**：在 #01 的入口上扩展 `showPlayerLoading(stage='default')`，`stage` 取值 `'default' | 'slow'`，内部按 stage 渲染对应 innerHTML（**内容与现有两处完全一致**，包括换集覆盖会删掉进度条子节点的现有行为——保留不修，bug 留 cs-issue）。`playEpisode` 改调 `showPlayerLoading('default')`，10s 超时改调 `showPlayerLoading('slow')`。
- **建议映射的方法**：M-L2-01（Extract Function）
- **风险**：低（innerHTML 内容原样搬入函数体，stage 文案与现有逐字一致）
- **验证**：AI 自证——grep `player-loading.*innerHTML` 在 player.js 中除新入口函数体外为 0；HUMAN 目视：换集时 loading 文案与改前一致、10s 后超时文案与改前一致
- **范围**：约 20 行 / 1 文件
