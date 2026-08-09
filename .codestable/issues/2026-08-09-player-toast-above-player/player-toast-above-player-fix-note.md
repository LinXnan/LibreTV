---
doc_type: issue-fix-note
issue: 2026-08-09-player-toast-above-player
status: confirmed
severity: P3
tags: [player, toast, ui, css]
---

# 播放页提示框未在播放器上方居中 Fix Note

## 根因

播放页两类轻量提示框定位偏离"播放器上方居中"基准：

1. **快捷键提示** `css/player.css` `.shortcut-hint`（约 280-296 行）：`top: 50%; transform: translate(-50%, -50%)` 将提示框垂直居中于视口 → 显示在**屏幕正中间**，遮挡视频画面中心。
2. **通用 Toast** `#toast`：`js/ui.js:38,79` 与 `index.html:501` 使用 `fixed top-4`（视口顶部 16px），播放页固定 header 高约 88px，Toast 悬浮于 header 之上显示在页面最顶端。

既有 `.position-restore-hint`（`css/player.css:200-221`）已实现"播放器上方居中"基准 `top: calc(88px + 16px)`（header 约 88px + main padding 16px），并带移动端 `env(safe-area-inset-top)` 适配，本次修复即统一到该基准。

## 改动

第一波（`css/player.css`，统一 top 基准）：

1. `.shortcut-hint`：`top: 50%` → `top: calc(88px + 16px)`；`transform: translate(-50%, -50%)` → `translateX(-50%)`。
2. 新增播放页 `#toast` 定位覆盖：`body #toast`。
3. 移动端 `@media(max-width:640px)` 追加 safe-area 叠加。
4. （code review B-1 修复）`#toast` 选择器带 `body` 前缀提升特异性，覆盖后加载的 `mobile-optimize.css` 同名 `!important` 规则。

第二波（owner 反馈"恢复位置提示未播放器居中"，根因：三个提示框用 `position: fixed; left: 50%` 相对**视口**居中，桌面分栏（≥1024px，右栏 360px 侧边栏）时播放器中心偏离视口中心约 180px，提示不在播放器上方居中。改为相对**播放器容器** `#playerContainer` 定位）：

1. `css/player.css`：`#playerContainer { position: relative }` 作为定位锚点；`.shortcut-hint`、`.position-restore-hint`、`body #toast` 三处均改为 `position: absolute; top: 0; left: 50%`（`top:0` 相对播放器容器顶部即原 `calc(88px+16px)` 视口位置，垂直避让 header 不变，水平对齐播放器中心）；删除桌面端无用的移动端 safe-area 叠加块。
5. （code review round 3 修复）移动端 `@media(max-width:640px)` 为三个提示补垂直避让：移动端播放器容器顶部（`calc(44px+safe)` margin-top + 16px padding ≈ 60px+safe）低于移动端 header（约 78px），`top:0` 会被固定 header 遮挡，需相对容器下移。
6. （owner 反馈"通知同时出现会重叠"）四类通知垂直错开布局（相对播放器容器水平居中）：`#adFilterStats` 广告胶囊 top-2≈8px（播放器内顶部）；`.position-restore-hint` 56px；`body #toast` 120px；`.shortcut-hint` 184px。移动端在避让 header 基础上同步错开：adFilter 32px / 72px / 136px / 200px。各层间距 64px，单层高度 ≤64px。
7. （code review round 5 修复）移动端 `#adFilterStats` 下移至 32px 避让固定 header（容器顶部 60px+safe 低于 header 78px）；播放页 `body #toast` 增加 `max-width: min(80vw, 400px)` + 单行截断，防超长消息换行侵入下一层快捷键提示。
2. `player.html`：`#shortcutHint` 从 `</main>` 后移入 `#playerContainer` 内（与 `.relative` 平级），使其绝对定位相对播放器容器。
3. `js/ui.js`：`showToast` 创建 Toast 时挂载到 `document.querySelector('.player-container') || document.body`——播放页挂到播放器容器内（相对其居中），首页无该容器维持挂 body、`fixed top-4` 不变。

`.error-container`（播放器内部错误状态遮罩）与 `#loading`（播放流程不触发）不属本次"轻量提示框"范围。

未改动 `js/ui.js`、`index.html`（保护首页 Toast 的 `top-4`）；`.error-container`（播放器内部错误状态遮罩）与 `#loading`（播放流程不触发）不属本次"轻量提示框"范围。

## 验证

- CSS/JS 语法：IDE lint 无错误。
- 逻辑级推演：
  1. `.shortcut-hint`、`.position-restore-hint`、`#toast` 三者在播放页均挂载/定位于 `#playerContainer`（`position: relative`）内，`absolute; top:0; left:50%; translateX(-50%)` → 水平对齐播放器中心（桌面分栏/单栏/移动端均成立），垂直在播放器顶部（= 原 `calc(88px+16px)` 视口位置，避让固定 header）。
  2. 首页 `index.html` 无 `.player-container`：`ui.js` 挂载回退 `body`，且不加载 `player.css`，首页 Toast 保持 `fixed top-4` 不变。
  3. 移动端：播放器容器顶部（`calc(44px+safe)` margin-top + 16px padding）低于移动端 header（约 78px），提示 `top:0` 会被遮挡，故移动端补垂直避让（桌面端 104px 容器顶部高于 header，保持 `top:0`）。
  4. 错开布局：四类通知间距 48px（56/104/152，移动端 72/120/168），各提示高度 ≤42px，同时出现不重叠；均相对播放器容器水平居中。
- 独立 code review：round 1 发现 B-1（blocking，移动端 `#toast` 被后加载的 `mobile-optimize.css` 同特异性覆盖），已用 `body #toast` 修复；round 2 复审确认；round 3 完整复审发现移动端 header 遮挡回归（blocking），已补移动端垂直避让；round 4 复审确认；round 5 将对错开布局做完整独立复审。
- 符合既有沉淀：`.codestable/compound/2026-08-08-top-fixed-hint-header-bypass.md` 明确"顶部 fixed 提示须纵向避让 header（`top: calc(88px + 16px)`）+ 移动端 safe-area 叠加"，本次实现与该结论一致。
- 待浏览器验证：本地 `npm run dev`，播放页按方向键/空格 → 快捷键提示出现在播放器上方居中；切换无效资源源 → 红色 Toast 出现在播放器上方居中；首页搜索失败 → Toast 仍显示视口顶部。

## 遗留风险

- `#toast` 覆盖依赖"播放页独享 `player.css`"这一加载约定；若未来首页也引入 `player.css`，需复查该覆盖。
- `.shortcut-hint` 无 transform 过渡（transition 仅 opacity），位置切换是瞬时的，与改动前行为一致，无回归。
- 无自动化测试，修复依赖浏览器手动验证。
