---
doc_type: refactor-design
refactor: 2026-08-01-player-loading-facade
status: approved
scope: js/player.js 中 #player-loading 的 12 处直接 DOM 操作收口到 showPlayerLoading/hidePlayerLoading 入口
summary: 抽统一显隐入口（含 stage 文案 API），逐处替换直接赋值，行为严格等价（保留现有提前隐藏/进度条被覆盖等 bug 现状，留 cs-issue）
---

# player-loading-facade refactor design

## 1. 本次范围

从 scan 勾选：#01（显隐入口收口）+ #02（innerHTML 覆盖收口到 setStage）。

不做的：
- 不修审计 finding #01（三重 playing 监听竞态）、#02（HLS 提前隐藏）、#04（换集 innerHTML 删进度条）——留 cs-issue 在新入口上修。本轮保留这三处的现有触发行为。
- 不动 `#style-loader`（FOUC 防护，独立合理）、不动 `ui.js` 的 `showLoading/hideLoading`（已是良好范本）。
- 不删 `.player-loading-container` 的 CSS 定义（虽然 DOM 中无人使用，见"执行中发现"，但那是另一回事）。

预估工作量：~50 行 / 1 文件（player.js）；风险档位低。

## 2. 前置依赖

- 无测试覆盖。验证手段用**穷举 grep 双向自证**（见每步退出信号）+ 本地 `npm run dev` 手动目视。refactor 协议第 2 条豁免理由：本轮是纯 DOM 收口，每处改动都是"直接赋值 → 等价函数调用"，触发时机不变，grep 清零可双向证明机械等价。

## 3. 执行顺序

### 步骤 1：新增 playerLoading 入口（#01 的基建）

- 引用方法：M-L2-01（Extract Function）
- 具体操作：在 `player.js` 全局变量区之后（约第 96 行 `Artplayer.FULLSCREEN_WEB_IN_BODY = true;` 之后）新增：

  ```js
  // playerLoading 显隐统一入口（参照 ui.js 的 showLoading/hideLoading 形态）
  function showPlayerLoading(stage = 'flex') {
      // 保留 block(行118)与 flex(其余)两种历史行为；其余 display 值原样透传
      const el = document.getElementById('player-loading');
      if (el) el.style.display = stage === 'flex' ? 'flex' : stage;
  }
  function hidePlayerLoading() {
      const el = document.getElementById('player-loading');
      if (el) el.style.display = 'none';
  }
  function isPlayerLoadingVisible() {
      const el = document.getElementById('player-loading');
      return !!el && el.style.display !== 'none';
  }
  ```

  说明：`stage` 参数此处先承载两种历史 display 值（`'block'` 行118、`'flex'` 其余）。#02 的 stage 文案变体在步骤 3 扩展。

- 退出信号：新增代码无语法错误；`npm run dev` 启动无报错（暂未替换任何调用点，纯增量）。
- 验证责任：AI 自证（dev server 启动成功 + 无控制台错误）
- 回滚：删新增的 3 函数。

### 步骤 2：逐处替换 style.display 直接操作（#01 主体）

- 引用方法：M-L1-01（Parallel Change：调用点逐个切到新入口）
- 具体操作：按下表把每个直接赋值替换为函数调用。**触发时机与目标 display 值逐字不变**：

  | 行 | 当前 | 替换为 |
  |---|---|---|
  | 104 | `getElementById('player-loading').style.display = 'none'` | `hidePlayerLoading()` |
  | 118 | `getElementById('player-loading').style.display = 'block'` | `showPlayerLoading('block')` |
  | 445-448 | `const loadingDiv=...; if(loadingDiv) loadingDiv.style.display='flex'` | `showPlayerLoading('flex')` |
  | 592 | `...style.display = 'none'` | `hidePlayerLoading()` |
  | 649-652 | `const loadingDiv=...; if(loadingDiv) loadingDiv.style.display='none'` | `hidePlayerLoading()` |
  | 741 | `...style.display = 'none'` | `hidePlayerLoading()` |
  | 746 | `...style.display = 'none'` | `hidePlayerLoading()` |
  | 872 | `...style.display = 'none'` | `hidePlayerLoading()` |
  | 973-976 | `querySelectorAll('#player-loading, .player-loading-container')` 批量 `display='none'` | `hidePlayerLoading()`（`.player-loading-container` 在 DOM 不存在，见"执行中发现"，等价） |
  | 1240 | `const loadingEl=...; if(loadingEl) loadingEl.style.display='none'` | `hidePlayerLoading()` |

  替换后清理各处多余的 `const loadingDiv/loadingEl = document.getElementById('player-loading')` 局部变量（若该变量替换后不再被引用）。

- 退出信号：AI 自证——
  `grep -n "player-loading.*style.display\|getElementById('player-loading')\|getElementById(\"player-loading\")" js/player.js`
  除步骤1新入口函数体外应为 **0 处**直接操作（`isPlayerLoadingVisible` 内部的 `getElementById` 除外）。
- 验证责任：AI 自证（grep 清零）+ HUMAN 目视（dev server 打开播放页：首屏加载遮罩显示、视频播放后遮罩消失、出错时遮罩消失显示错误、换源时遮罩随错消失）
- 回滚：逐处 `git revert` 该步，或恢复直接赋值。

### 步骤 3：把 innerHTML 覆盖收口到 showPlayerLoading 的 stage 文案（#02）

- 引用方法：M-L2-01（Extract Function）
- 具体操作：扩展步骤1的 `showPlayerLoading`，让 `stage` 同时承载 display 值与文案变体：

  ```js
  function showPlayerLoading(stage = 'default') {
      const el = document.getElementById('player-loading');
      if (!el) return;
      // default / slow → flex + 对应文案（保留现有 innerHTML 覆盖行为，含删进度条子节点，留 cs-issue 修）
      if (stage === 'default') {
          el.style.display = 'flex';
          el.innerHTML = '<div class="loading-spinner"></div><div>正在加载视频...</div>';
      } else if (stage === 'slow') {
          el.style.display = 'flex';
          el.innerHTML = '<div class="loading-spinner"></div><div>视频加载时间较长，请耐心等待...</div><div style="font-size: 12px; color: #aaa; margin-top: 10px;">如长时间无响应，请尝试其他视频源</div>';
      } else {
          // block 等纯 display 透传（行118 密码验证后 block 显示，不覆盖 innerHTML）
          el.style.display = stage;
      }
  }
  ```

  替换两处：
  - 行 1339-1343 `playEpisode`：原 `el.style.display='flex'; el.innerHTML=\`...\`` → `showPlayerLoading('default')`
  - 行 1072-1078 10s 超时：原 `if (loadingEl && loadingEl.style.display !== 'none') { loadingEl.innerHTML=\`...\` }` → `if (isPlayerLoadingVisible()) showPlayerLoading('slow')`
  - 步骤2里行447 `initPlayer` 的 `showPlayerLoading('flex')` 改为 `showPlayerLoading('default')` ⚠️ 行447原本**不覆盖 innerHTML**，只设 display flex；但 `default` 会覆盖 innerHTML 内容为"正在加载视频..."——而 `player.html:102` 初始 innerHTML 已是"正在加载视频..."带进度条。

  **关键行为等价核查**：行447 原行为=只设 display flex、不碰 innerHTML（保留 HTML 里带进度条的初始结构）。若改用 `default` 会覆盖掉进度条子节点 → **改变首集加载行为**（首集进度条失效）。违反行为等价！
  → 决定：行447 保持纯 display 设置，用专门的 `'flex'` stage（不进 innerHTML 分支）。即 `initPlayer` 仍调 `showPlayerLoading('flex')`，走 `else el.style.display = 'flex'`——但这与 `default` 的 `flex` 重名冲突。

  **修正方案**：`showPlayerLoading(stage)` 的 display 值与文案变体解耦：
  - `stage ∈ {'default','slow'}` → 带 innerHTML 覆盖（用于**已渲染过**的换集/超时场景，恢复文案）
  - `stage` 是裸 display 值 `'flex'`/`'block'` → 纯设 display、**不碰 innerHTML**（用于 initPlayer 首次显示与密码验证后显示）

  按此语义，行447 `showPlayerLoading('flex')`、行118 `showPlayerLoading('block')` 走纯 display 分支不覆盖 innerHTML；行1339 换集、行1072 超时走 `default`/`slow` 覆盖 innerHTML。逐字对照现有行为，等价成立。

- 退出信号：AI 自证——`grep -n "player-loading.*innerHTML" js/player.js` 除 `showPlayerLoading` 函数体外为 **0 处**。
- 验证责任：AI 自证（grep 清零）+ HUMAN 目视（换集时遮罩重显且文案"正在加载视频..."；停留 10s 后文案变"视频加载时间较长..."；首集加载进度条仍正常推进——因 447 不覆盖 innerHTML）
- 回滚：恢复两处直接 innerHTML 赋值。

## 4. 风险与看点

- **最高风险点**：行447 `initPlayer` 的等价性。若误用 `default` stage 覆盖 innerHTML，首集进度条会失效（顺带"修"了 finding-04 的部分，违反 refactor 底线）。已在步骤3明确解耦 display 与文案 stage。
- **历史 display 值差异**：行118 用 `block`，其余用 `flex`。入口已透传裸 display 值保留差异。
- **死代码 `.player-loading-container`**：行973 `querySelectorAll` 的第二个选择器在 DOM 不存在，等价替换为只隐藏 `#player-loading`。记录为"执行中发现"，不删 CSS 定义（超出范围）。
- **无测试**：依赖 grep 双向自证 + 手动目视，覆盖播放页主要路径（首屏/播放/出错/换源/换集/超时）。

## 执行中发现的偏离

- 步骤2替换行973时发现 `querySelectorAll('#player-loading, .player-loading-container')` 中的 `.player-loading-container` 选择器匹配的是 CSS class，但 `player.html` 全文 grep 确认无任何元素挂这个 class——选择器是死代码。替换为 `hidePlayerLoading()`（只操作 `#player-loading`）等价。已记。
