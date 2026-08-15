---
doc_type: feature-ff-note
feature: continue-watch-prompt
date: 2026-08-15
requirement:
tags: [首页, 弹窗, 观看历史, 设置]
---

## 做了什么

访问首页时弹出最近一次播放的影片（读取 `localStorage.viewingHistory` 第一条），询问是否继续观看；点「继续观看」跳转播放页并从上次进度续播，「暂不」关闭。设置面板新增「继续观看弹窗」开关控制是否弹窗（默认开启）。

## 改了哪些

- `js/continue-watch.js`（新建） — 弹窗逻辑：取最近历史、渲染标题/集数/播放进度/封面、免责声明排队、密码未验证时不叠加（验证后 `passwordVerified` 补弹）、Esc/遮罩/按钮关闭、`playFromHistory` 续播跳转
- `index.html` — 设置面板「功能开关」区新增 `#continueWatchPromptToggle` 开关；新增 `#continueWatchModal` 弹窗 DOM（z-[61]，介于免责声明 z-[60] 与密码 z-[65] 之间）；`js/continue-watch.js` script 标签加在 `index-page.js` 之前
- `js/app.js` — DOMContentLoaded 初始化开关状态（`localStorage.continueWatchPromptEnabled !== 'false'`，默认开启）；`setupEventListeners` 加 change 监听写 localStorage

### review-fix（独立审查后）

- `js/index-page.js` — 免责声明弹窗显示改用 classList 方式：原 `style.display='flex'` 被内联 `.hidden{display:none!important}` 覆盖导致弹窗不显示，进而阻断继续观看弹窗排队逻辑（blocking B1）
- `js/continue-watch.js` — `showIfNeeded` 增加 `isPasswordRequired()` 检查：部署未设密码时强制密码弹窗（z-65 无关闭按钮）与继续观看弹窗（z-61）叠加会锁死界面（important I1）；点击「继续观看」后清理 `latestItem`，防 `passwordVerified` 重放二次弹出（S2）
- `js/continue-watch.js` — 二次复审后：`closeModal()` 统一清 `latestItem` + 置 `userDismissed`，`showIfNeeded` 开头跳过已主动关闭的会话（important CW-1，防「暂不」后 `passwordVerified` 重放复现）；`episodeIndex` 用 `Number()` 归一化防字符串拼接（nit CW-3）
- `js/index-page.js` — 免责声明显示增加 `isPasswordRequired()` 前置：未设密码部署不叠加在强制密码弹窗下（important CW-2）
- `js/continue-watch.js` — 终审后 resume 侧 episodeIndex 也做 `Number()` 归一化，与 openModal 显示口径一致（REV-019）

### QA 反馈修复（用户实测「封面没展示出来」）

- `js/continue-watch.js` — 封面渲染重构：改为「底层渐变占位 + 内容类型图标 + img 覆盖」结构（复用 `.recent-watch-placeholder`/`.recent-watch-icon`/`.recent-watch-cover-img` 既有样式），无封面或加载失败时露出占位而非空白框；`onerror` 从内联改为 `img.onerror` 事件绑定（兼容严格 CSP）
- `index.html` — `#continueWatchCover` 增加 `relative` class，使绝对定位的占位/img 层正确铺满容器

## 怎么验证的

- `node --check js/continue-watch.js` / `js/index-page.js` / `js/app.js` 语法通过；read_lints 全部文件 0 诊断
- 本地起服务冒烟：首页 200，`continueWatchModal` / `continueWatchPromptToggle` / `continue-watch.js` 均存在；`#continueWatchCover` 含 `relative` class
- 时序核对：defer 脚本顺序保证 `requirePasswordOrPrompt`（password.js）与 `playFromHistory`（ui.js）先于本模块加载；免责声明监听先注册先执行，接受后弹继续观看；密码未验证时 silent 检查跳过
- 独立 Task agent 审查三轮：round 1 修复 B1/I1/S2，round 2 修复 CW-1/CW-2/CW-3，round 3 终审 passed（无 blocking），每轮后语法与冒烟复验通过
- QA 反馈修复后：语法 + lint + 冒烟复验通过

## 顺手发现（可选，不阻塞）

- 无（原「disclaimer 显示风险」已随 B1 修复一并解决）
