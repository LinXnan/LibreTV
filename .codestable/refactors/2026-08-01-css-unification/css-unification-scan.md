---
doc_type: refactor-scan
refactor: 2026-08-01-css-unification
status: user-reviewed
scope: 6 个 CSS 文件（styles.css / index.css / player.css / mobile-optimize.css / mobile-panels-modern.css / mobile-settings-modern.css），共 ~3500 行
summary: 发现 10 条优化点：结构 7 / 可读性 2 / 性能 1。按风险：低 7 / 中 3 / 高 0
---

# css-unification scan

## 总览

- 扫描范围：`css/styles.css`（1713行）、`css/index.css`（384行）、`css/player.css`（644行）、`css/mobile-optimize.css`（1975行）、`css/mobile-panels-modern.css`（372行）、`css/mobile-settings-modern.css`（228行）
- 发现 10 条优化点：结构 7 / 可读性 2 / 性能 1
- 按风险：低 7 / 中 3 / 高 0
- 建议先做：#1 #2 #3 #5（低风险、纯 CSS 搬移、AI 可自证）
- 建议慎做 / 后做：#9 #10（涉及动画和 toast 行为，需人工目视）
- 前置检查 7 条全过：✓

核心问题：3 个独立移动端 CSS 文件（~1400 行）与主样式文件存在大量重复和割裂——同一组件的桌面端样式在 `styles.css`/`player.css`，移动端样式散落在 `mobile-*.css`，导致改一处要改两处。

目标：将 `mobile-optimize.css`、`mobile-panels-modern.css`、`mobile-settings-modern.css` 的内容按组件归并到 `styles.css` 和 `player.css`，三个文件最终删除。

## 条目

### #1 全局滚动条隐藏规则重复 5 处，删除冗余 ✓

- **位置**：`css/styles.css:174-195`（全局）、`css/styles.css:148-163`（`.settings-panel`）、`css/styles.css:419-439`（`#apiCheckboxes`）、`css/styles.css:442-462`（`#customApisList`）、`css/styles.css:684-698`（`.history-panel`）、`css/mobile-optimize.css:10-27`（移动端全局）、`css/mobile-optimize.css:416-448`（移动端重复）
- **分类**：结构
- **现状**：`styles.css` 第 174-195 行已做全局滚动条隐藏（`::-webkit-scrollbar { display: none }` + `* { scrollbar-width: none }`），但后面 5 个选择器（`.settings-panel`、`#apiCheckboxes`、`#customApisList`、`.history-panel`）各自又抄了一遍完整的 4-伪元素隐藏规则。`mobile-optimize.css` 重复了两次——一次全局级别（第 10 行）、一次列举 11 个选择器逐一隐藏（第 416-448 行）。
- **问题**：同一规则 "隐藏滚动条" 在同一个文件里写了 6 遍，跨文件又写了 2 遍，合计约 120 行。全局选择器 `* { scrollbar-width: none }` 已经覆盖所有元素，所有按组件/页面重复的隐藏规则均为冗余代码。
- **建议**：删除 `styles.css` 中 `.settings-panel`、`#apiCheckboxes`、`#customApisList`、`.history-panel` 的专属滚动条伪元素块（保留 `scrollbar-width: none` 即可）。删除 `mobile-optimize.css` 第 10-27 行和第 416-448 行的滚动条隐藏块。全局 `::-webkit-scrollbar { display: none }` 加 `* { scrollbar-width: none }` 一条规则覆盖一切。
- **建议映射的方法**：M-L2-02（Inline Function — CSS 等价：全局规则已覆盖，内联的组件级重复规则应删除）
- **风险**：低（浏览器兼容性已验证：全局隐藏规则已在项目运行良久；删除组件级专属规则不会导致滚动条重新出现）
- **验证**：AI 自证（grep 确认删除后无残留 `::-webkit-scrollbar` 冗余声明；`npm run dev` 启动后检查移动端面板滚动条不出现）
- **范围**：约 120 行 / 2 文件

### #2 `.settings-panel` 和 `.history-panel` 面板布局移动端样式分散两处 ✓

- **位置**：`css/styles.css:135-146`（桌面端）、`css/styles.css:663-676`（桌面端）、`css/mobile-optimize.css:883-1112`（移动端底部抽屉）
- **分类**：结构
- **现状**：面板桌面端样式（`.settings-panel` 右侧滑入、`.history-panel` 左侧滑入）在 `styles.css`。移动端将面板改为底部抽屉（`transform: translateY(100%)` → `translateY(0)`）的逻辑全在 `mobile-optimize.css` 的 `@media (max-width: 640px)` 块里，占 ~230 行。
- **问题**：改面板布局要同时翻两个文件。面板的移动端行为（底部抽屉 + 玻璃拟态 + 拖拽指示器）和桌面端行为（侧边滑入）是同一组件的两种状态，逻辑上属于同一模块。
- **建议**：把 `mobile-optimize.css` 第 883-1112 行的面板移动端样式移到 `styles.css`，紧接在桌面端面板样式后面，保持 `@media (max-width: 640px)` 结构。同时把 `mobile-panels-modern.css` 中面板头部/内容区滚动优化部分（第 7-148 行）一并迁入。
- **建议映射的方法**：M-L2-04（Move Function — CSS 等价：把分散的样式规则搬到所属组件的定义区）
- **风险**：低（纯搬移，不改变选择器和属性值，行为等价）
- **验证**：AI 自证（搬移前后 CSS 字节数不变；`npm run dev` 启动，拖拽面板打开关闭动画在移动端和桌面端均正常）
- **范围**：约 370 行 / 3 文件

### #3 设置区域 Bento Grid 样式在 `styles.css` 和 `mobile-settings-modern.css` 间重复 ✓

- **位置**：`css/styles.css:1256-1712`（桌面端赛博朋克区域样式）、`css/mobile-settings-modern.css:7-209`（移动端 Bento Grid 增强）
- **分类**：结构
- **现状**：`.datasource-section`、`.custom-api-section`、`.filter-settings-section`、`.general-functions-section` 四个区域的**桌面端基础样式**（渐变背景、边框、扫光动画、悬停效果）已定义在 `styles.css:1256-1712`，约 450 行。`mobile-settings-modern.css` 又为移动端重写了这些相同类名，覆盖 `padding`、`border-radius`、按钮尺寸、开关大小，且添加了 `:active` 触摸反馈替换 `:hover`，约 200 行。
- **问题**：同一组 4 个 CSS 类的桌面和移动端样式割裂在两个文件中。`mobile-settings-modern.css` 的很多属性实际上是覆盖了 `styles.css` 的值（如 `padding: 20px !important` 覆盖 `styles.css` 的 `1.25rem`），这是 `!important` 战争的典型症状。
- **建议**：把 `mobile-settings-modern.css` 的全部内容按 `@media (max-width: 640px)` 组织，迁移到 `styles.css` 对应桌面端样式之后。移除不必要的 `!important`（将具体度不够的选择器改为与桌面端同等具体度）。
- **建议映射的方法**：M-L2-04（Move Function）
- **风险**：低（纯 CSS 搬移 + 选择器具体度调整）
- **验证**：AI 自证（grep 旧文件确认迁空；`npm run dev` 启动后在移动端视口打开设置面板，目视确认卡片圆角/间距/按钮未变）
- **范围**：约 200 行 / 2 文件

### #4 选集弹框样式散落在 3 个文件中 ✓

- **位置**：`css/player.css:474-541`（桌面端赛博朋克样式）、`css/player.css:544-643`（集数按钮/Tab 通用样式）、`css/mobile-optimize.css:927-1049`（移动端底部抽屉）、`css/mobile-panels-modern.css:150-365`（移动端面板头部/Tab/按钮细化）
- **分类**：结构
- **现状**：选集弹框（`#episodeModal`）在桌面端是居中模态框（`player.css:474-541`），在移动端变成底部抽屉（`mobile-optimize.css:927`），面板内部的头部、Tab 栏、集数按钮又在 `mobile-panels-modern.css` 做了第三次增强。同一组件跨 3 个文件。
- **问题**：添加新交互（如集数分组 Tab）时，桌面端样式写在 `player.css` 的通用区（`544-643`），移动端的 Tab 样式却写在 `mobile-panels-modern.css`（`231-258`）和 `mobile-optimize.css`（`1136-1184`）。改一个集数按钮的样式要跑 3 个文件。
- **建议**：把 `mobile-optimize.css` 和 `mobile-panels-modern.css` 中所有 `#episodeModal` 相关样式合并到 `player.css`，按 `@media (min-width: 641px)` 桌面端 + `@media (max-width: 640px)` 移动端组织。消除重复的 Tab 样式定义。
- **建议映射的方法**：M-L2-04（Move Function）
- **风险**：中（涉及 ~250 行搬移；移动端弹框的 `transform` 动画链依赖 `show` class 切换，搬移后需目视确认面板打开/关闭流程）
- **验证**：HUMAN（移动端打开播放页 → 点选集 → 确认弹框从底部滑入 + 拖拽指示器存在 + Tab 切换 + 集数按钮触摸可用；桌面端确认弹框居中弹出）
- **范围**：约 250 行 / 3 文件

### #5 分页控件移动端样式在 `styles.css` 和 `mobile-optimize.css` 间重复 ✓

- **位置**：`css/styles.css:1179-1200`（移动端分页）、`css/mobile-optimize.css:719-800`（移动端分页增强）
- **分类**：结构
- **现状**：`styles.css` 已有分页的移动端样式（`@media (max-width: 640px)`），含按钮最小尺寸和跳转区域换行。`mobile-optimize.css` 又写了一遍完整的移动端分页（同样 `@media (max-width: 640px)`），多了触摸反馈动画（`:active { transform: scale(0.95) }`）和极小屏（`@media (max-width: 375px)`）简化布局。
- **问题**：同一断点、同一组件的样式写了两份。`mobile-optimize.css` 版本属性更全，但 `styles.css` 版本定义了网格列数——两个文件各行其是，CSS 优先级取决于加载顺序。
- **建议**：合并到 `styles.css` 已有的 `@media (max-width: 640px)` 块中。`mobile-optimize.css` 的 `:active` 反馈和 375px 极窄屏优化作为补充加进去。删除 `mobile-optimize.css` 的重复块。
- **建议映射的方法**：M-L2-02（Inline Function — CSS 等价：合并重复规则）
- **风险**：低（合并后只保留一套属性，行为等价于浏览器最终计算值）
- **验证**：AI 自证（逐条对比合并前后 CSS 属性差异为 0；`npm run dev` 后确认移动端分页按钮尺寸/间距/跳转区域不变）
- **范围**：约 80 行 / 2 文件

### #6 按钮触摸尺寸在 `styles.css` 和 `mobile-optimize.css` 间冗余 ✓

- **位置**：`css/styles.css:1133-1137`（通用移动端按钮最小尺寸）、`css/mobile-optimize.css:100-195`（详细移动端按钮尺寸）
- **分类**：结构
- **现状**：`styles.css` 有一条通用的 `@media (max-width: 640px) { button, .card { min-height: 44px; min-width: 44px } }`。`mobile-optimize.css` 在同一断点下又为 20+ 个具体选择器详细设置了 `min-height: 44px`（`.fixed.top-4 button`、`.top-corner-button`、`.search-box button`、`#clearSearchInput`、`.close-btn`、`#episodesGrid button`、`#modalContent button`、`.filter-btn`、`.douban-tag`、分页按钮、集数按钮等）。
- **问题**：通用规则已确保所有按钮/卡片 ≥ 44px。具体选择器再次设置相同值属冗余——除非它们受其他更高优先级的规则覆盖导致通用规则不生效。
- **建议**：保留通用规则 `button, .card { min-height: 44px }`。逐个检查 `mobile-optimize.css` 中每个具体按钮规则：如果只是设 `min-height: 44px`（无其他特殊属性），删除该条。如果有额外属性（如 `.close-btn` 还有 `background/border/color`），只删 `min-height/min-width` 行，保留其余。最终约 60% 的条目可删除。
- **建议映射的方法**：M-L2-02（Inline Function）
- **风险**：低（CSS 选择器优先级计算可自动化验证；实际渲染结果不变）
- **验证**：AI 自证（grep 确认删除后所有移动端按钮选择器仍被通用规则覆盖到；`npm run dev` 后移动端测量 5 个典型按钮 ≥ 44px）
- **范围**：约 70 行 / 2 文件

### #7 安全区域（刘海屏）样式仅存在于 `mobile-optimize.css`，应归入 `styles.css` ✓

- **位置**：`css/mobile-optimize.css:818-843`
- **分类**：可读性
- **现状**：`safe-area-inset-*` 适配仅写在 `mobile-optimize.css` 里（`padding-top` / `padding-bottom` / `safe-area-inset-bottom` / `safe-area-inset-top`），`styles.css` 完全没有。
- **问题**：安全区域适配是全局布局需求（影响 body、固定定位按钮、容器 margin-top），不是"移动端优化"的附加物。应作为基础布局的一部分放在主样式文件中。
- **建议**：把 `mobile-optimize.css:818-843` 整个块移到 `styles.css` 的全局 `@media (max-width: 640px)` 区域。
- **建议映射的方法**：M-L2-04（Move Function）
- **风险**：低（纯搬移不变属性值）
- **验证**：AI 自证（grep 确认原位置已删除；HUMAN 可选：iPhone Safari 打开确认底部 safe area 仍有间距）
- **范围**：约 30 行 / 2 文件

### #8 Toast 撤销提示样式分为两套独立类名 ✓

- **位置**：`css/styles.css:1203-1251`（PC 端 `.history-undo-toast-pc`，右下角弹出）、`css/mobile-optimize.css:1443-1512`（移动端 `.history-undo-toast`，底部居中弹出）
- **分类**：结构
- **现状**：PC 端 toast 用 `.history-undo-toast-pc`，固定在右下角，从右侧滑入。移动端 toast 用 `.history-undo-toast`，固定在底部、居中，从下方滑入。两套完全独立的 CSS 类和动画。JS 端（`ui.js:854`）用 `if (isMobile)` 来选不同的类名和 DOM 结构。
- **问题**：Toast 的核心逻辑相同（显示 → 可撤销 → 自动消失），只因位置和动画方向不同就拆成两套类名。实际上可以通过 CSS 媒体查询在同一个类名下切换位置和动画。
- **建议**：统一为单一类名 `.history-undo-toast`。基础样式放 `styles.css`（`position: fixed; z-index: 10000` 等通用属性）。`@media (max-width: 640px)` 内设 `bottom: 80px; left: 50%; transform: translateX(-50%)`；`@media (min-width: 641px)` 内设 `bottom: 20px; right: 20px`。动画用同一个 `@keyframes` 但不同 `transform-origin`。JS 在 B 阶段统一改动。
- **建议映射的方法**：M-L2-06（Replace Conditional with Polymorphism — CSS 等价：用媒体查询替代 JS 条件分支选择类名）
- **风险**：中（CSS 改动需和 JS 改动联动；JS 暂不改，当前阶段仅做 CSS 合并，保持旧类名 .history-undo-toast-pc 作为 .history-undo-toast 的别名向后兼容）
- **验证**：HUMAN（PC 端删历史记录 → toast 从右下角滑入；移动端删历史记录 → toast 从底部弹出；撤销按钮均可点击）
- **范围**：约 70 行 / 2 文件

### #9 移动端 body 强制 `overflow: hidden; position: fixed` 与 Tailwind 容器布局冲突 ✓

- **位置**：`css/mobile-optimize.css:28-66`
- **分类**：性能
- **现状**：`mobile-optimize.css` 在 `@media (max-width: 640px)` 中对 `html, body` 做了全局 `overflow: hidden !important; position: fixed !important; width: 100%; height: 100%`，同时让 `.container` 变成 `position: fixed; top/left/right/bottom: 0; overflow-y: auto` 作为替代滚动容器。
- **问题**：这种做法绕过了浏览器原生滚动，用 JS/CSS 模拟滚动容器；引入 `-webkit-overflow-scrolling: touch` 有已知的 iOS Safari 橡皮筋效应问题；`position: fixed` 的 body 与 iOS Safari 地址栏收缩/展开行为耦合；新增 `about.html` 页面（普通静态页）不需要这种滚动接管。这是针对首页和播放页的 hack，却写成了全局规则。
- **建议**：把 `html, body { overflow: hidden; position: fixed }` 加范围限定——改为 `body.index-page, body.player-page` 或移除 `position: fixed` 保留 `overflow: hidden`。分析原始意图（防止 iOS 橡皮筋导致面板拖拽冲突？）后决定保留/修改/移除。
- **建议映射的方法**：M-L2-05（Decompose Conditional — 加范围限定替代全局选择器）
- **风险**：中（修改全局 body 行为可能影响 iOS Safari 弹性滚动和面板手势交互；需在 iPhone 真机或模拟器验证）
- **验证**：HUMAN（iPhone Safari 打开首页 → 滚动搜索结果 → 确认无异常橡皮筋；打开设置面板 → 拖拽面板 → 确认面板拖拽与页面滚动不冲突；Android Chrome 同样流程）
- **范围**：约 40 行 / 1 文件

### #10 移动端历史记录卡片布局与桌面端使用完全不同的 DOM 结构和 CSS 类 ✓

- **位置**：`css/styles.css:722-861`（PC 端横向布局 `.history-item`）、`css/mobile-optimize.css:1191-1430`（移动端 3 列卡片网格 `#historyList .history-item`）
- **分类**：结构
- **现状**：PC 端历史卡片是横向排列（封面前、信息后，80×120 封面图片，`display: flex; flex-direction: row`）。移动端是完全不同的 3 列网格布局（`grid-template-columns: repeat(3, 1fr)`，卡片用 `padding-bottom: 140%` 做 2:3 比例，封面作 CSS 背景图，底部渐变遮罩 + 文字叠加）。两类布局共享同一个 `.history-item` 类名但在移动端通过 `!important` 完全覆盖了 PC 端的 `display: flex` 为 `display: block`、`padding: 0` 为 `padding-bottom: 140%`。JS 在 `ui.js:494-604` 还生成了不同的 HTML 结构（`history-icon-mobile` 图标等）。
- **问题**：`.history-item` 在 `styles.css` 设 `display: flex`，`mobile-optimize.css` 用 `display: block !important` 暴力覆盖。两个文件互相打架，任何 CSS 改动都是 `!important` 军备竞赛。JS 端（`ui.js`）还为移动端单独生成了 `history-icon-mobile` 和 `history-item-content` 包装结构。
- **建议**：在 CSS 层面，把 `.history-item` 的基础样式改为移动优先（`display: block` → `@media (min-width: 641px) { display: flex }`），消除 `!important` 对抗。移动端卡片网格和渐变遮罩移到 `styles.css` 的 `@media (max-width: 640px)` 块。JS 端的 DOM 分支消除留给 B 阶段（`ui.js` 去分岔）。
- **建议映射的方法**：M-L1-01（Parallel Change — 先在 CSS 层做无破坏的等价迁移，JS 结构不动；下一阶段再改 JS）
- **风险**：中（涉及两个历史面板的核心渲染路径；改动后需目视 PC 端/移动端历史面板卡片均无错位）
- **验证**：HUMAN（PC 端打开历史面板 → 确认横向布局、封面图片、悬浮删除按钮正常；移动端打开历史面板 → 确认 3 列网格、封面背景图、底部文字渐变遮罩、速度徽章正常；Chrome DevTools 切换设备模式反复横跳确认无闪烁）
- **范围**：约 240 行 / 2 文件
