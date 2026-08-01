---
doc_type: refactor-design
refactor: 2026-08-01-css-unification
status: approved
scope: 6 个 CSS 文件合并 + 3 个移动端 CSS 文件删除
summary: 将 mobile-optimize.css / mobile-panels-modern.css / mobile-settings-modern.css 按组件归并到 styles.css 和 player.css，消除重复规则，最终删除 3 个空文件
---

# css-unification refactor design

## 1. 本次范围

- 从 scan 勾选了全部 10 条（#1~#10）
- **不做**：JS 层 `isMobile` DOM 分支消除（留给后续 `ui-js-unification` refactor）；HTML 结构改动；Tailwind 类名替换
- 预估总工作量：10 步，约 4 轮验证（6 步 AI 自证 + 4 步 HUMAN）
- 总风险档位：**低**（纯 CSS 搬移/合并，不改变最终计算值）

## 2. 前置依赖

- 无测试覆盖需求（项目无自动化测试；CSS 变更通过目视验证）
- 无调用方搜索需求（CSS 选择器影响范围由浏览器计算，非编译期检查）
- 准备工作：`git stash` 保持干净工作区；每步完成后各设备目视确认

## 3. 执行顺序

### 步骤 1：删除全局滚动条冗余声明
- 引用方法：M-L2-02（Inline Function）
- 具体操作：
  1. 在 `css/styles.css` 中删除第 148-163 行（`.settings-panel` 滚动条）
  2. 删除第 419-439 行（`#apiCheckboxes` 滚动条）
  3. 删除第 442-462 行（`#customApisList` 滚动条）
  4. 删除第 684-698 行（`.history-panel` 滚动条）
  5. 保留 `.settings-panel` 和 `.history-panel` 的 `scrollbar-width: none; -ms-overflow-style: none`（非伪元素）
  6. 在 `css/mobile-optimize.css` 中删除第 10-27 行（移动端全局滚动条）
  7. 删除第 416-448 行（移动端列举 11 个选择器的滚动条隐藏）
- 退出信号：`grep -c "webkit-scrollbar" css/styles.css css/mobile-optimize.css` 显示仅剩全局规则（`styles.css:174-177`）
- 验证责任：AI 自证
- 回滚：`git checkout css/styles.css css/mobile-optimize.css`

### 步骤 2：迁移安全区域样式到主文件
- 引用方法：M-L2-04（Move Function）
- 具体操作：
  1. 在 `css/styles.css` 的现有 `@media (max-width: 640px)` 区域末尾追加安全区域适配（body padding + 固定定位 safe-area-inset）
  2. 从 `css/mobile-optimize.css` 删除第 818-843 行
- 退出信号：`grep "safe-area" css/styles.css` 有结果，`grep "safe-area" css/mobile-optimize.css` 无结果
- 验证责任：AI 自证
- 回滚：`git checkout css/styles.css css/mobile-optimize.css`

### 步骤 3：合并分页控件移动端样式
- 引用方法：M-L2-02（Inline Function）
- 具体操作：
  1. 对比 `styles.css:1179-1200` 和 `mobile-optimize.css:719-800` 的分页移动端样式
  2. 将 `mobile-optimize.css` 独有的属性（`:active` 触摸反馈、375px 极窄屏布局）补充到 `styles.css` 的分页 `@media` 块
  3. 删除 `mobile-optimize.css` 第 719-800 行
- 退出信号：`grep "pagination" css/mobile-optimize.css` 无结果
- 验证责任：AI 自证
- 回滚：`git checkout css/styles.css css/mobile-optimize.css`

### 步骤 4：消除按钮触摸尺寸冗余
- 引用方法：M-L2-02（Inline Function）
- 具体操作：
  1. 检查 `mobile-optimize.css:100-195` 中每个按钮选择器
  2. 仅设置 `min-height/min-width: 44px`（无其他独有属性）的条目 → 删除（通用规则已覆盖）
  3. 有额外独有属性的条目（如 `.close-btn` 的 `background/border/radius/transition`）→ 保留但删掉其中的 `min-height/min-width` 行
  4. 保留的独有属性合并到 `styles.css` 相应的选择器下方
- 退出信号：`grep -c "min-height.*44px" css/mobile-optimize.css` 减少 ≥ 40%
- 验证责任：AI 自证
- 回滚：`git checkout css/styles.css css/mobile-optimize.css`

### 步骤 5：迁移面板移动端布局到 styles.css
- 引用方法：M-L2-04（Move Function）
- 具体操作：
  1. 在 `css/styles.css` 的 `.history-panel` / `.settings-panel` 桌面端样式下方，新建 `@media (max-width: 640px)` 块
  2. 从 `css/mobile-optimize.css` 剪下第 883-1112 行（面板底部抽屉 + 拖拽指示器 + 选集面板底部抽屉），贴入新块
  3. 从 `css/mobile-panels-modern.css` 剪下面板头部/内容区滚动优化（第 7-148 行的非选集相关部分），贴入 `styles.css`
  4. 面板扫光动画（`.history-panel::before` / `#episodeModal::before`）保留在 mobile-panels-modern.css 暂不迁（与 #4 步骤联动）
- 退出信号：`grep "history-panel" css/mobile-optimize.css` 仅剩历史卡片网格部分（#10 处理）
- 验证责任：AI 自证
- 回滚：`git checkout css/styles.css css/mobile-optimize.css css/mobile-panels-modern.css`

### 步骤 6：迁移设置区域 Bento Grid 到 styles.css
- 引用方法：M-L2-04（Move Function）
- 具体操作：
  1. 在 `css/styles.css` 的 `.datasource-section` / `.settings-section` 等桌面端样式下方，新建 `@media (max-width: 640px)` 块
  2. 将 `css/mobile-settings-modern.css` 全部内容（第 7-227 行）迁移进该块
  3. 移除不必要的 `!important`（让移动端选择器与桌面端同等具体度）
  4. `css/mobile-settings-modern.css` 清空
- 退出信号：`wc -l css/mobile-settings-modern.css` 为 0（或仅剩注释）
- 验证责任：AI 自证
- 回滚：`git checkout css/styles.css css/mobile-settings-modern.css`

### 步骤 7：迁移选集弹框样式到 player.css
- 引用方法：M-L2-04（Move Function）
- 具体操作：
  1. 在 `css/player.css` 的选集弹框桌面端样式（`@media (min-width: 641px)`，第 474-541 行）下方，新建 `@media (max-width: 640px)` 块
  2. 从 `css/mobile-optimize.css` 剪下第 927-1049 行（选集弹框底部抽屉）和第 1136-1184 行（Tab 栏移动端样式），贴入新块
  3. 从 `css/mobile-panels-modern.css` 剪下选集面板相关的头部/Tab/集数按钮/扫光动画（第 150-365 行），贴入 `player.css`
  4. 检查 `player.css` 中集数按钮通用样式（第 544-643 行）是否与移动端样式冲突，如有则用媒体查询拆分
- 退出信号：`grep "episodeModal" css/mobile-optimize.css css/mobile-panels-modern.css` 无结果
- 验证责任：HUMAN（移动端选集弹框打开/关闭 + Tab 切换）
- 回滚：`git checkout css/player.css css/mobile-optimize.css css/mobile-panels-modern.css`

### 步骤 8：统一 Toast 撤销提示样式
- 引用方法：M-L2-06（媒体查询替代类名分支）
- 具体操作：
  1. 在 `css/styles.css` 中新建统一的 `.history-undo-toast` 基础样式（position / z-index / padding / border-radius / 动画）
  2. `@media (max-width: 640px)` 内设 `bottom: 80px; left: 50%; transform: translateX(-50%)`（原移动端 behavior）
  3. `@media (min-width: 641px)` 内设 `bottom: 20px; right: 20px`（原 PC 端 behavior）
  4. 保留 `.history-undo-toast-pc` 作为别名（`@media (min-width: 641px) { .history-undo-toast-pc { @extend .history-undo-toast } }` — 但 CSS 没有 @extend，改用逗号选择器：`.history-undo-toast, .history-undo-toast-pc { ... }`）
  5. 删除 `mobile-optimize.css` 第 1443-1512 行
- 退出信号：PC 端和移动端 toast 均使用同一组 CSS 规则
- 验证责任：HUMAN（PC 端和移动端各自删除历史记录，确认 toast 位置和动画正确）
- 回滚：`git checkout css/styles.css css/mobile-optimize.css`

### 步骤 9：迁移历史记录卡片移动端样式到 styles.css
- 引用方法：M-L1-01（Parallel Change — CSS 等价迁移，JS 结构不动）
- 具体操作：
  1. 在 `css/styles.css` 的 `.history-item` PC 端样式（第 722-861 行）下方，新建 `@media (max-width: 640px)` 块
  2. 从 `css/mobile-optimize.css` 剪下第 1191-1430 行（历史卡片 3 列网格/封面遮罩/删除按钮/进度条/速度徽章），贴入新块
  3. 改 `styles.css` 的 `.history-item` 基础样式为移动优先：
     - 基础：`display: block; padding: 0; height: auto`（移动端）
     - `@media (min-width: 641px)`：`display: flex; padding: 12px; height: auto`（桌面端）
  4. 消除 `!important` 对抗：确保移动端和桌面端的媒体查询不相互覆盖
- 退出信号：`grep "history-item" css/mobile-optimize.css` 无结果
- 验证责任：HUMAN（PC 端和移动端历史面板卡片均无样式错乱）
- 回滚：`git checkout css/styles.css css/mobile-optimize.css`

### 步骤 10：评估 body 滚动 hack
- 引用方法：M-L2-05（Decompose Conditional）
- 具体操作：
  1. 分析 `mobile-optimize.css:28-66` 的 `html, body { overflow: hidden; position: fixed }` 对哪些页面是必须的
  2. 如果在首页和播放页必须保留，则：
     - 改为 `body.index-page, body.player-page { overflow: hidden; position: fixed }`（加页面限定）
     - 移到 `styles.css` 的全局 `@media (max-width: 640px)` 区域
  3. 如果在 `about.html` 也生效会导致问题，则限定 `.index-page` / `.player-page`
  4. 从 `mobile-optimize.css` 删除
- 退出信号：`about.html` 页面在移动端可正常滚动，首页和播放页滚动行为不变
- 验证责任：HUMAN（iPhone 或 Chrome DevTools 移动模式 → 首页滚动搜索结果、播放页滚动集数、about 页正常滚动，三者均无异常）
- 回滚：`git checkout css/styles.css css/mobile-optimize.css`

### 步骤 11（收尾）：删除 3 个空文件，更新 HTML 引用
- 引用方法：无（清理步骤）
- 具体操作：
  1. 确认 `css/mobile-optimize.css`、`css/mobile-panels-modern.css`、`css/mobile-settings-modern.css` 剩余内容为 0 或可丢弃
  2. 在 `index.html`、`player.html`、`watch.html` 中移除这 3 个文件的 `<link>` 引用
  3. 删除 3 个 CSS 文件
- 退出信号：`ls css/mobile-*.css` 无结果；`grep -r "mobile-optimize\|mobile-panels-modern\|mobile-settings-modern" *.html` 无结果
- 验证责任：AI 自证
- 回滚：`git checkout .`

## 4. 风险与看点

- **高风险步骤**：无。所有改动均为 CSS 搬移/合并，浏览器最终计算结果不变
- **#4 #8 #9 #10 需 HUMAN 目视**：这 4 步涉及核心 UI（选集弹框/toast/历史卡片/页面滚动），AI 无法替人看渲染结果
- **CSS 加载顺序**：项目通过 `<link>` 标签加载 CSS，顺序为 `styles.css → index.css → player.css → mobile-*.css`。合并后 `mobile-*.css` 删除，原通过低优先级加载的移动端样式提升到与桌面端同级。由于合并时按 `@media` 查询隔离，不影响最终计算值——但需要确保所有移动端样式都放在 `@media (max-width: 640px)` 内
- **容易出错**：#9 和 #10 涉及 `.history-item` 的双向覆盖，必须仔细处理 `display: flex` → `display: block` 的移动优先重构
- **跨文件 grep**：每步完成后用 `grep` 确认旧文件中目标选择器已清空，防止残留
