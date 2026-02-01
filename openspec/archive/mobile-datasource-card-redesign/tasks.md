# 移动端数据源设置卡片重构 - 实施任务

## 变更 ID
`mobile-datasource-card-redesign`

---

## 任务概览

| 阶段 | 任务数 | 状态 |
|------|--------|------|
| 阶段 1: CSS 样式 | 3 | 待开始 |
| 阶段 2: HTML 结构 | 2 | 待开始 |
| 阶段 3: JavaScript 模块 | 4 | 待开始 |
| 阶段 4: 集成与测试 | 3 | 待开始 |

---

## 阶段 1: CSS 样式

### Task 1.1: 添加卡片基础样式
**文件**: `css/mobile-optimize.css`
**操作**: 追加

**代码**:
```css
/* === 数据源卡片样式 === */
@media (max-width: 640px) {
  /* 卡片容器 */
  .api-card-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 4rem;
  }

  /* 单个卡片 */
  .api-card {
    min-height: 2.75rem;
    padding: 0.75rem;
    background: #151515;
    border: 1px solid #2a2a2a;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .api-card:has(input:checked) {
    border-color: #3b82f6;
  }

  .api-card:active {
    background: #1a1a1a;
  }

  /* 隐藏复选框但保持可访问 */
  .api-card input[type="checkbox"] {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* 成人标签 */
  .api-card .adult-badge {
    font-size: 0.75rem;
    color: #f472b6;
    margin-left: 0.5rem;
  }
}
```

**验收**: 卡片在 ≤640px 视口下显示正确样式

---

### Task 1.2: 添加滑动操作样式
**文件**: `css/mobile-optimize.css`
**操作**: 追加

**代码**:
```css
/* === 滑动操作样式 === */
@media (max-width: 640px) {
  .swipe-container {
    position: relative;
    overflow: hidden;
    touch-action: pan-y;
  }

  .swipe-content {
    touch-action: pan-x;
    will-change: transform;
    transition: transform 180ms ease-out;
  }

  .swipe-content.swiping {
    transition: none;
  }

  .swipe-content.snap-back {
    transition: transform 120ms ease-in;
  }

  .swipe-actions {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    width: 72px;
    display: flex;
    pointer-events: none;
  }

  .swipe-container.open .swipe-actions {
    pointer-events: auto;
  }

  .swipe-actions button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    color: white;
    font-size: 1.25rem;
    min-width: 36px;
    min-height: 44px;
  }

  .swipe-actions .edit-btn {
    background: #2563eb;
  }

  .swipe-actions .delete-btn {
    background: #dc2626;
  }
}
```

**验收**: 滑动操作区域在打开状态下可见且可点击

---

### Task 1.3: 添加底部操作栏和撤销提示样式
**文件**: `css/mobile-optimize.css`
**操作**: 追加

**代码**:
```css
/* === 底部操作栏样式 === */
@media (max-width: 640px) {
  .api-batch-actions {
    position: sticky;
    bottom: 0;
    min-height: 3.5rem;
    padding: 0.75rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
    background: #111;
    border-top: 1px solid #2a2a2a;
    display: flex;
    gap: 0.5rem;
    z-index: 2;
  }

  .api-batch-actions button {
    flex: 1;
    min-height: 2.75rem;
    border-radius: 0.5rem;
    background: #252525;
    border: none;
    color: #e5e5e5;
    font-size: 0.875rem;
  }

  .api-batch-actions button:active {
    background: #333;
  }

  .api-batch-actions.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

/* === 撤销提示样式 === */
.undo-toast {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 100;
  opacity: 0;
  transition: opacity 200ms ease;
}

.undo-toast.visible {
  opacity: 1;
}

.undo-toast button {
  background: #3b82f6;
  border: none;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .swipe-content,
  .undo-toast {
    transition: none !important;
  }
}
```

**验收**: 操作栏固定在底部，撤销提示居中显示

---

## 阶段 2: HTML 结构

### Task 2.1: 重构内置 API 列表结构
**文件**: `index.html`
**位置**: 数据源设置区域（约第 165-190 行）
**操作**: 修改

**变更说明**:
1. 将 `#apiCheckboxes` 容器添加 `api-card-container` 类
2. 保留所有现有 ID 和类名
3. 添加响应式类 `sm:grid sm:grid-cols-2`

**目标结构**:
```html
<div id="apiCheckboxes" class="api-card-container sm:grid sm:grid-cols-2 sm:gap-2 sm:pb-0">
  <!-- 内置 API 由 JavaScript 渲染 -->
</div>
```

**验收**: 移动端显示为卡片列表，桌面端保持网格布局

---

### Task 2.2: 添加底部操作栏 HTML
**文件**: `index.html`
**位置**: 数据源设置区域末尾（`#customApisList` 之后）
**操作**: 新增

**代码**:
```html
<!-- 移动端底部操作栏 -->
<div id="apiBatchActions" class="api-batch-actions sm:hidden">
  <button type="button" onclick="selectAllAPIs(true)">全选</button>
  <button type="button" onclick="selectAllAPIs(false)">全不选</button>
  <button type="button" onclick="selectNormalAPIs()">选择普通</button>
</div>

<!-- 撤销提示容器 -->
<div id="undoToast" class="undo-toast">
  <span id="undoToastMessage">已删除</span>
  <button type="button" onclick="UndoToast.undo()">撤销</button>
</div>
```

**验收**: 操作栏仅在移动端显示，撤销提示初始隐藏

---

## 阶段 3: JavaScript 模块

### Task 3.1: 创建滑动操作模块
**文件**: `js/swipe-actions.js`
**操作**: 新建

**代码**: 见 `design.md` 中的 `SwipeActions` 模块设计

**核心功能**:
1. `init(container)` - 初始化事件委托
2. `handleStart/Move/End(e)` - 手势处理
3. `openCard/closeCard/closeAllCards()` - 状态管理
4. 配置参数按 `design.md` 中 TS-1 规格

**验收**: 滑动手势正确识别，方向锁定生效

---

### Task 3.2: 创建撤销提示模块
**文件**: `js/undo-toast.js`
**操作**: 新建

**代码**: 见 `design.md` 中的 `UndoToast` 模块设计

**核心功能**:
1. `show(item, index, wasSelected)` - 显示提示
2. `hide()` - 隐藏提示
3. `undo()` - 执行撤销，恢复原索引和选择状态
4. 5 秒自动隐藏

**验收**: 删除后显示撤销提示，5 秒内可撤销

---

### Task 3.3: 修改 app.js - 卡片渲染逻辑
**文件**: `js/app.js`
**位置**: `initAPICheckboxes()` 函数（约第 82-150 行）
**操作**: 修改

**变更说明**:
1. 检测视口宽度，≤640px 使用卡片模板
2. 保留复选框 input（使用 sr-only 隐藏）
3. 添加 `.api-card` 类和 `role="group"`
4. 成人 API 添加 `.adult-badge` 标签

**卡片模板**:
```javascript
const isMobile = window.innerWidth <= 640;
const cardClass = isMobile ? 'api-card' : 'existing-class';
// 渲染逻辑...
```

**验收**: 移动端渲染卡片，桌面端保持原有样式

---

### Task 3.4: 修改 app.js - 自定义 API 渲染和删除逻辑
**文件**: `js/app.js`
**位置**: `renderCustomAPIsList()` 和 `removeCustomApi()` 函数
**操作**: 修改

**变更说明**:

**renderCustomAPIsList()**:
1. 移动端包装滑动容器 `.swipe-container`
2. 添加 `.swipe-content` 和 `.swipe-actions`
3. 保留 `data-custom-index` 属性
4. 渲染后调用 `SwipeActions.init()`

**removeCustomApi()**:
1. 删除前保存项目和选择状态
2. 调用 `UndoToast.show()` 而非直接删除
3. 重新编号 `selectedAPIs` 中的自定义索引

**验收**: 自定义 API 支持滑动删除和撤销

---

## 阶段 4: 集成与测试

### Task 4.1: 集成手势冲突处理
**文件**: `js/swipe-actions.js`
**操作**: 修改

**变更说明**:
1. 检测 touchstart 位置，顶部 60px 禁用滑动
2. 水平锁定后调用 `e.stopPropagation()`
3. 监听面板拖动状态，拖动时取消滑动

**代码片段**:
```javascript
handleStart(e) {
  const panelRect = document.getElementById('settingsPanel').getBoundingClientRect();
  const relativeY = e.clientY - panelRect.top;
  if (relativeY <= 60) return; // 禁用区域
  // ...
}
```

**验收**: 滑动不触发面板关闭，面板拖动不触发滑动

---

### Task 4.2: 集成成人内容过滤器联动
**文件**: `js/app.js`
**位置**: 卡片点击处理逻辑
**操作**: 修改

**变更说明**:
1. 卡片切换后调用 `checkAdultAPIsSelected()`
2. 保持 `.api-adult` 类名在复选框上
3. 确保查询选择器 `.api-adult:checked` 正常工作

**验收**: 选中成人 API 时黄色过滤器自动禁用

---

### Task 4.3: 添加脚本引用
**文件**: `index.html`
**位置**: `</body>` 前
**操作**: 新增

**代码**:
```html
<script src="js/swipe-actions.js"></script>
<script src="js/undo-toast.js"></script>
```

**验收**: 模块正确加载，无控制台错误

---

## 验收检查清单

### 功能验收
- [ ] 移动端（≤640px）显示卡片布局
- [ ] 桌面端（>640px）保持原有网格布局
- [ ] 触摸目标 ≥44x44px
- [ ] 左滑显示删除/编辑按钮
- [ ] 右滑关闭操作区域
- [ ] 删除后显示 5 秒撤销提示
- [ ] 撤销恢复原索引和选择状态
- [ ] 底部操作栏固定显示
- [ ] 批量操作正常工作
- [ ] 成人 API 选中时过滤器禁用

### 兼容性验收
- [ ] iOS Safari 测试通过
- [ ] Android Chrome 测试通过
- [ ] 桌面端功能回归测试通过
- [ ] 键盘导航正常
- [ ] 屏幕阅读器可访问

### 性能验收
- [ ] 设置面板打开 <400ms
- [ ] 滑动响应 <16ms
- [ ] 无内存泄漏

---

## 依赖关系

```
Task 1.1 ─┬─> Task 2.1 ─┬─> Task 3.3 ─┬─> Task 4.2
Task 1.2 ─┤            │             │
Task 1.3 ─┘            │             │
                       └─> Task 3.1 ─┼─> Task 4.1
                       └─> Task 3.2 ─┘
                       └─> Task 2.2 ─────> Task 4.3
```

---

## 回滚计划

如果出现严重问题，执行以下步骤：
1. 删除 `js/swipe-actions.js` 和 `js/undo-toast.js`
2. 从 `css/mobile-optimize.css` 移除新增样式
3. 恢复 `index.html` 中的原始 HTML 结构
4. 恢复 `js/app.js` 中的原始渲染逻辑
