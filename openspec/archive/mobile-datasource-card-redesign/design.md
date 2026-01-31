# 移动端数据源设置卡片重构 - 技术设计文档

## 变更 ID
`mobile-datasource-card-redesign`

---

## 架构决策

### AD-1: 视图层重构策略
**决策**：保持现有数据流和存储契约不变，仅重构视图层为移动优先的卡片布局。

**理由**：
- 最小化破坏性变更
- 保持 `selectedAPIs`/`customAPIs` localStorage 结构
- 保持现有函数签名（`updateSelectedAPIs`, `renderCustomAPIsList`, `removeCustomApi`）

**影响**：
- DOM 结构变更仅限于样式和布局
- JavaScript 逻辑变更仅限于手势处理和 UI 状态

### AD-2: 手势事件系统
**决策**：使用 Pointer Events（可用时），回退到 Touch Events（iOS）。

**理由**：
- Pointer Events 统一处理鼠标、触摸、笔输入
- iOS Safari 对 Pointer Events 支持有限，需要回退

**实现**：
```javascript
const supportsPointerEvents = 'PointerEvent' in window;
const eventTypes = supportsPointerEvents
  ? { start: 'pointerdown', move: 'pointermove', end: 'pointerup' }
  : { start: 'touchstart', move: 'touchmove', end: 'touchend' };
```

### AD-3: 事件委托模式
**决策**：在父容器 `#customApisList` 上使用事件委托处理所有卡片交互。

**理由**：
- `renderCustomAPIsList()` 替换 innerHTML，独立监听器会失效
- 减少内存开销
- 提升滚动性能

**实现**：
```javascript
document.getElementById('customApisList').addEventListener('pointerdown', handleSwipeStart);
```

### AD-4: CSS 职责分离
**决策**：
- Tailwind：所有结构布局样式
- `mobile-optimize.css`：仅手势变换、粘性操作栏、安全区域

**理由**：
- 保持 Tailwind 作为主要样式系统
- 自定义 CSS 仅用于 Tailwind 无法处理的场景

---

## 技术规格

### TS-1: 滑动手势参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 激活阈值 | 24px | 水平移动距离 |
| 方向锁定比例 | 2:1 | \|dx\| ≥ 2 * \|dy\| |
| 完成删除距离 | 40% | 卡片宽度百分比 |
| 完成删除速度 | 0.6px/ms | 最小速度阈值 |
| 操作区域宽度（移动端） | 72px | 显示编辑/删除按钮 |
| 操作区域宽度（桌面端） | 88px | 更宽的按钮 |
| 打开/关闭动画 | 180ms | ease-out |
| 回弹动画 | 120ms | ease-in |
| 禁用区域 | 顶部 60px | 避免与面板拖动冲突 |

### TS-2: 卡片样式参数

| 参数 | 值 | Tailwind 类 |
|------|-----|-------------|
| 内边距 | 12px | `p-3` |
| 垂直间距 | 8px | `gap-2` |
| 圆角 | 12px | `rounded-xl` |
| 背景色 | #151515 | `bg-[#151515]` |
| 边框色 | #2a2a2a | `border-[#2a2a2a]` |
| 选中边框色 | #3b82f6 | `border-blue-500` |
| 最小高度 | 44px | `min-h-11` |

### TS-3: 操作栏参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 位置 | sticky bottom-0 | 固定在底部 |
| 最小高度 | 56px | 包含按钮和内边距 |
| 按钮尺寸 | ≥44x44px | 触摸目标 |
| 按钮间距 | 8px | `gap-2` |
| 底部内边距 | 12px + safe-area | `pb-3` + `env()` |
| 列表底部内边距 | 64px | 避免遮挡 |
| z-index | 2 | 高于滑动操作层 |

### TS-4: 撤销提示参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 显示时长 | 5000ms | 精确 5 秒 |
| 位置 | 底部居中 | toast 样式 |
| 动画 | fade in/out | 200ms |
| 存储 | 内存 | 删除项和原索引 |

---

## DOM 结构设计

### 现有结构（保留 ID）
```html
<div id="apiCheckboxes">
  <!-- 内置 API 复选框 -->
</div>
<div id="customApisList">
  <!-- 自定义 API 列表 -->
</div>
<div id="selectedApiCount">0</div>
<form id="addCustomApiForm">
  <input id="customApiName">
  <input id="customApiUrl">
  <input id="customApiDetail">
  <input id="customApiIsAdult">
</form>
```

### 新增结构（移动端）
```html
<!-- 卡片容器 -->
<div class="api-card-container flex flex-col gap-2 pb-16 sm:pb-0">
  <!-- 内置 API 卡片 -->
  <label class="api-card min-h-11 p-3 bg-[#151515] border border-[#2a2a2a] rounded-xl
                flex items-center cursor-pointer
                [&:has(input:checked)]:border-blue-500">
    <input type="checkbox" class="sr-only sm:not-sr-only" id="api-xxx">
    <span class="flex-1 truncate">API 名称</span>
    <span class="text-pink-400 text-xs" data-adult>18+</span>
  </label>

  <!-- 自定义 API 卡片（可滑动） -->
  <div class="swipe-container relative overflow-hidden">
    <div class="swipe-content transition-transform duration-180">
      <label class="api-card ...">
        <input type="checkbox" class="api-adult" data-custom-index="0">
        <span class="flex-1 truncate">自定义 API</span>
      </label>
    </div>
    <div class="swipe-actions absolute right-0 top-0 h-full w-[72px] flex">
      <button class="edit-btn flex-1 bg-blue-600" aria-label="Edit">✎</button>
      <button class="delete-btn flex-1 bg-red-600" aria-label="Delete">✕</button>
    </div>
  </div>
</div>

<!-- 底部操作栏（移动端） -->
<div class="api-batch-actions sticky bottom-0 sm:relative sm:bottom-auto
            min-h-14 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]
            bg-[#111] border-t border-[#2a2a2a]
            flex gap-2 z-[2]">
  <button class="flex-1 min-h-11 rounded-lg bg-[#252525]">全选</button>
  <button class="flex-1 min-h-11 rounded-lg bg-[#252525]">全不选</button>
  <button class="flex-1 min-h-11 rounded-lg bg-[#252525]">选择普通</button>
</div>
```

---

## JavaScript 模块设计

### 新增模块：`js/swipe-actions.js`

```javascript
/**
 * 滑动操作管理器
 * 职责：处理自定义 API 卡片的滑动删除手势
 */
const SwipeActions = {
  // 配置
  config: {
    activationThreshold: 24,      // px
    directionLockRatio: 2,        // dx/dy
    deleteDistanceRatio: 0.4,     // 卡片宽度百分比
    deleteVelocity: 0.6,          // px/ms
    actionWidth: 72,              // px (移动端)
    animationDuration: 180,       // ms
    snapBackDuration: 120,        // ms
    disabledZoneTop: 60,          // px
  },

  // 状态
  state: {
    activeCard: null,             // 当前打开的卡片
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    isLocked: false,
    direction: null,              // 'horizontal' | 'vertical' | null
  },

  // 方法
  init(container) { /* 初始化事件委托 */ },
  handleStart(e) { /* 处理触摸开始 */ },
  handleMove(e) { /* 处理触摸移动 */ },
  handleEnd(e) { /* 处理触摸结束 */ },
  openCard(card) { /* 打开滑动操作 */ },
  closeCard(card) { /* 关闭滑动操作 */ },
  closeAllCards() { /* 关闭所有打开的卡片 */ },
  destroy() { /* 清理事件监听 */ },
};
```

### 新增模块：`js/undo-toast.js`

```javascript
/**
 * 撤销提示管理器
 * 职责：显示删除撤销提示，处理撤销操作
 */
const UndoToast = {
  // 配置
  config: {
    duration: 5000,               // ms
    animationDuration: 200,       // ms
  },

  // 状态
  state: {
    timer: null,
    deletedItem: null,
    deletedIndex: null,
    wasSelected: false,
  },

  // 方法
  show(item, index, wasSelected) { /* 显示撤销提示 */ },
  hide() { /* 隐藏提示 */ },
  undo() { /* 执行撤销 */ },
  destroy() { /* 清理定时器 */ },
};
```

### 修改模块：`js/app.js`

**新增函数**：
- `initMobileAPICards()` - 初始化移动端卡片布局
- `handleCardToggle(e)` - 处理卡片点击切换
- `handleSwipeDelete(index)` - 处理滑动删除

**修改函数**：
- `initAPICheckboxes()` - 添加移动端卡片渲染分支
- `renderCustomAPIsList()` - 添加滑动容器包装
- `removeCustomApi(index)` - 集成撤销提示

---

## CSS 新增样式

### `css/mobile-optimize.css` 新增

```css
/* 滑动操作容器 */
@media (max-width: 640px) {
  .swipe-container {
    touch-action: pan-y;
  }

  .swipe-content {
    touch-action: pan-x;
    will-change: transform;
  }

  .swipe-content.swiping {
    transition: none;
  }

  .swipe-actions {
    pointer-events: none;
  }

  .swipe-container.open .swipe-actions {
    pointer-events: auto;
  }
}

/* 底部操作栏安全区域 */
.api-batch-actions {
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
}

/* 撤销提示 */
.undo-toast {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .swipe-content,
  .undo-toast {
    transition: none !important;
  }
}
```

---

## 集成点

### IP-1: mobile-panel-gestures.js
**冲突**：面板拖动关闭 vs 卡片水平滑动

**解决方案**：
1. 滑动手势在顶部 60px 区域禁用
2. 水平移动超过阈值后调用 `stopPropagation()`
3. 面板拖动时立即取消滑动状态

**代码位置**：`js/mobile-panel-gestures.js` 第 45-120 行

### IP-2: 成人内容过滤器
**联动**：选中成人 API 时禁用黄色过滤器

**解决方案**：
1. 保留 `.api-adult` 类名
2. 保持 `checkAdultAPIsSelected()` 查询选择器不变
3. 卡片切换后触发状态检查

**代码位置**：`js/app.js` 第 380-420 行

### IP-3: localStorage 数据结构
**约束**：保持现有结构不变

**数据结构**：
```javascript
// selectedAPIs: string[]
["heimuer", "ffzy", "custom_0", "custom_1"]

// customAPIs: object[]
[
  { name: "自定义1", api: "https://...", detail: "", adult: false },
  { name: "自定义2", api: "https://...", detail: "", adult: true }
]
```

---

## 风险缓解

### RM-1: DOM 选择器破坏
**风险**：改变 ID 或移除复选框导致 JS 失效

**缓解**：
- 保留所有现有 ID
- 复选框使用 `sr-only` 隐藏但保留在 DOM
- 添加单元测试验证选择器

### RM-2: 索引失效
**风险**：删除后 `data-custom-index` 指向错误项

**缓解**：
- 使用事件委托，交互时读取索引
- 删除后立即重新渲染
- 添加 PBT 测试验证索引一致性

### RM-3: 手势冲突
**风险**：滑动与面板拖动冲突

**缓解**：
- 方向锁定机制
- 禁用区域检测
- 添加集成测试验证手势隔离

---

## 测试策略

### 单元测试
- `SwipeActions.handleMove()` - 方向锁定逻辑
- `UndoToast.undo()` - 状态恢复逻辑
- 索引重新编号逻辑

### 集成测试
- 滑动删除 + 撤销完整流程
- 批量操作 + 成人过滤器联动
- 桌面端功能回归

### PBT 测试
- 参见 `specs.md` 中的 29 个 PBT 不变量

### 手动测试
- 真机测试（iOS Safari, Android Chrome）
- 触摸模拟（Chrome DevTools）
- 可访问性测试（VoiceOver, TalkBack）

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `index.html` | 修改 | 重构数据源设置区域 HTML |
| `js/app.js` | 修改 | 添加移动端卡片逻辑 |
| `js/swipe-actions.js` | 新增 | 滑动手势处理模块 |
| `js/undo-toast.js` | 新增 | 撤销提示模块 |
| `css/mobile-optimize.css` | 修改 | 添加滑动和操作栏样式 |
