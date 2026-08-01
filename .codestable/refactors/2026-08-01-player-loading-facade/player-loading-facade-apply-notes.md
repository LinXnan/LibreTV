---
doc_type: refactor-apply-notes
refactor: 2026-08-01-player-loading-facade
---

# player-loading-facade apply notes

## 步骤 1: 新增 showPlayerLoading/hidePlayerLoading/isPlayerLoadingVisible 入口
- 完成时间: 2026-08-01
- 改动文件: js/player.js（第 98-122 行新增 3 函数）
- 验证结果: `node -c js/player.js` → SYNTAX OK；npm run dev 启动无报错。stage 语义按 design 解耦：`default`/`slow` 覆盖 innerHTML+flex 显示；裸 `flex`/`block` 仅设 display 不动 innerHTML。
- 偏离: 无

## 步骤 2: 逐处替换 12 处直接 style.display 操作
- 完成时间: 2026-08-01
- 改动文件: js/player.js（11 处替换 + 1 处读判断）
- 验证结果（AI 自证）:
  - `grep "getElementById('player-loading')" js/player.js` → 仅余 3 处，全部在新入口函数体内（103/116/120），符合退出信号 c1
  - 全仓 `grep "player-loading['\"]?.?(style|innerHTML)" *.js` → 0 处残留直接操作
  - `node -c js/player.js` → SYNTAX OK
  - npm run dev → "服务器运行在 http://localhost:8080"，/player.html 返回 200
- 替换明细（触发时机逐处不变）：
  - 行104 密码未验证 → hidePlayerLoading()
  - 行118 passwordVerified → showPlayerLoading('block')
  - 行445 initPlayer → showPlayerLoading('flex')（不覆盖 innerHTML，保留首集进度条）
  - 行592 playing#1 → hidePlayerLoading()
  - 行649 playing#2 延迟300ms → hidePlayerLoading()（延迟逻辑保留）
  - 行741 FRAG_LOADED → hidePlayerLoading()（提前隐藏 bug 保留，留 cs-issue）
  - 行746 LEVEL_LOADED → hidePlayerLoading()（提前隐藏 bug 保留，留 cs-issue）
  - 行872 video:loadedmetadata → hidePlayerLoading()
  - 行973 video:error → hidePlayerLoading()（原始 querySelectorAll 含死代码 .player-loading-container，DOM 无此 class，等价）
  - 行1240 showError → hidePlayerLoading()
- 偏离: 执行中发现 `.player-loading-container` 这个 CSS class 在 player.html 全文无任何元素挂载，原行973 的 `querySelectorAll('#player-loading, .player-loading-container')` 第二选择器是死代码，替换为只隐藏 #player-loading 等价。已记入 design"执行中发现"，CSS 定义保留（超出本 refactor 范围）。
- HUMAN 目视（待确认）: 首屏加载遮罩显示→视频播放后消失；出错时遮罩消失显示错误框；换源时遮罩随错消失
- 验证责任: AI 自证已完成 ✓；HUMAN 目视待用户确认

## 步骤 3: 换集与 10s 超时的 innerHTML 覆盖收口到入口
- 完成时间: 2026-08-01
- 改动文件: js/player.js（2 处）
- 验证结果（AI 自证）:
  - `grep "player-loading.*innerHTML" js/player.js` → 0 处（innerHTML 已全部收口到 showPlayerLoading 函数体内）
  - 文案逐字对照：default stage = 换集原文"正在加载视频..."；slow stage = 超时原文"视频加载时间较长，请耐心等待...如长时间无响应，请尝试其他视频源" ✓
  - 行445 initPlayer 仍走 `'flex'` 裸 display 分支，不覆盖 innerHTML → 首集进度条行为不变（退出信号 c3 满足）
- HUMAN 目视发现（既有 bug，非本次回归）: 用户目视报告"出现两层 loading：顶层'正在加载...'提前消失后露出下层 ArtPlayer 内置转圈"。经 git diff 核实，本次重构对 `FRAG_LOADED`(行758)/`LEVEL_LOADED`(行762)/`video:loadedmetadata`(行889) 三处隐藏 loading 的触发时机未做任何改动（均为"原直接赋值 → 等价函数调用"），两层现象是重构前既有行为。该 bug 对应审计 finding #01/#02（HLS 与 loadedmetadata 在视频未真正 playing 前提前隐藏顶层遮罩，露出下层播放器转圈）。按混合方案约定，不在本次 refactor 内修，留独立 cs-issue 处理。
- 验证责任: AI 自证已完成 ✓；HUMAN 目视已确认（确认结果是既有 bug 非回归，c4 的"行为等价"成立——本次重构未改变该时序）
- 偏离: 无

## 独立 reviewer（环节 A）本地核验后补充的已知偏离

经独立 Task agent reviewer 审查 + 主 agent 逐条仓库事实核验，以下 3 处为边界内的已知等价偏离，不构成 blocking，记此留痕：

1. innerHTML 空白字符差异（js/player.js:107,110）：default/slow stage 的 innerHTML 由原多行模板字面量改为单行字符串，子元素间空白文本节点被消除。因 `#player-loading` 是 flex 列容器，flex 容器忽略子元素间空白文本节点的渲染影响，视觉等价；全仓 grep 确认无消费者以 innerHTML 字符串做比较。记为已知等价偏离，不回退。
2. slow 路径多一次 display 重设（js/player.js:1085-1090）：原 10s 超时仅设 innerHTML 不重设 display；`showPlayerLoading('slow')` 额外执行 `el.style.display='flex'`。展现在已为 flex 的元素上重设 flex 是幂等 no-op，渲染等价。
3. 防御性 null guard（js/player.js:104/116/120 入口统一 `if(!el) return`）：原 6 处调用点（行104/118/592/741/746/872）无 null guard 直接 `.style.display`，元素缺失会 NPE；新入口统一加空守，元素缺失从崩溃变静默。`#player-loading` 为 player.html 固定 DOM 元素，缺失即 HTML 损坏非生产路径；接受为防御性增强，不回退到不安全裸写。
