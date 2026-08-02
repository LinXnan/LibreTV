---
doc_type: code-review
review_date: 2026-08-02
source: issue
issue: 2026-08-02-history-delete-btn-offset
path: fast-track
status: blocked
round: 1
reviewer: pending
---

# Code Review — 移动端历史删除按钮错位修复

## 审查范围

- **Diff**：`js/ui.js`：9 行增/9 行删，纯 DOM 层级调整
- **来源**: issue-fix fast-track，confirmed report + fix-note + approval-report
- **spec 校验**: fix-note 完整（frontmatter `doc_type=issue-fix`、`path=fast-track`），report 已 confirmed，approval-report 中 `issue-fast-path: approved`、`issue-fix-completion: pending`

## 独立审查编排

- **环节 A (Task agent)**: 已启动（agent `a1f8bca316959171d`，model: sonnet，isolation: independent）—— **pending**
- **环节 B (OCR)**: CLI `ocr` 未安装 → **not-available**，不阻塞

本轮 status 为 `blocked`，待环节 A 返回并核验后才可定稿。

## local 行级审查 (草稿)

本地已对 diff 完成行级扫描：

### 整体
- 改动只涉及 DOM 结构，无逻辑变更，无新类/新函数/新接口
- 删除 `<button>` + `${playbackRateHtml}` 从 `.history-info` 内部移到 `.history-item` 直接子级
- 这是唯一改动，与 fix-note 方案一致

### 逐行
- `js/ui.js:621-628`：删除按钮移到 `.history-info` 之外，class、事件处理、SVG 内容未变
- `js/ui.js:629`：`${playbackRateHtml}` 与删除按钮同步移到外层的同一级
- `js/ui.js:630`：`.history-info` 变成纯信息容器（只有 title、meta、progress、time）

### CSS 回归确认
- `styles.css:765-772`：PC 端 `.history-item .delete-btn` hover opacity——按钮移出 `.history-info` 后选择器仍匹配 → 不受影响
- `styles.css:2254-2271`：移动端 `.history-item .delete-btn { position: absolute; top: 4px; right: 4px }` → 按钮参照 `.history-item`（`position: relative`）正确定位到卡片右上角
- `mobile-optimize.css:427-429`：移动端 `.history-item .delete-btn { opacity: 1 }` → 不变

### 对抗式审查
反例扫描：
1. **倍速徽章栈叠**: `${playbackRateHtml}` 移到同层后，倍速徽章也是 `absolute right-2 bottom-2`——删除按钮 `right-2 top-2` 与它不冲突 → ✅ 无问题
2. **事件冒泡**: 按钮 `onclick="event.stopPropagation()"` 保留不变，功能正确 → ✅
3. **无封面时删除按钮悬停**: 即使无封面图片，`.history-item` 仍有 `position: relative` → 按钮仍正确定位 → ✅
4. **name 格式**: `id` → 不确定。虽报有进度

### 发现 (预分类)

#### block
none

#### important
none

#### nit
none

#### suggestion
none

#### praise
- 修复只改 DOM 层级，不引入新抽象、不扩大范围，符合 `cs-issue` fix 协议的改动最小化约束

#### residual-risk
- 环节 A 尚未返回，本地结论未经独立审查交叉核验

## Test And QA Focus

- 桌面端（>640px）：hover 透明度与 click 冒泡行为是否仍然正常
- 移动端（≤640px）：删除按钮始终在卡片右上角，右下方如有倍速徽章（同一 `right-2`）不重叠
- 边界破损：后端有无数据返回时仍需检测正确的 `useHistory` 提示