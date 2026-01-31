# 移动端历史记录面板重设计

## Context

用户需求：在移动端重新设计历史记录面板布局，要求不影响功能的情况下，方便移动端操作。

用户选择：
- **布局风格**: 卡片网格（2列）
- **删除方式**: 左滑删除
- **显示信息**: 完整模式（标题 + 集数 + 来源 + 进度 + 时间戳 + 播放速度）

---

## 约束集合

### 硬约束 (Hard Constraints)

| ID | 约束 | 来源 |
|----|------|------|
| HC-1 | 仅影响移动端（≤640px），桌面端保持不变 | 用户需求 |
| HC-2 | 保留所有现有功能：播放、删除、清空历史 | 用户需求 |
| HC-3 | 左滑删除手势不能与面板下拉关闭手势冲突 | 技术约束 |
| HC-4 | 必须兼容现有的 `mobile-panel-gestures.js` 手势系统 | 代码依赖 |
| HC-5 | 历史记录数据结构不变（localStorage: viewingHistory） | 数据兼容 |

### 软约束 (Soft Constraints)

| ID | 约束 | 来源 |
|----|------|------|
| SC-1 | 触摸目标最小 44x44px | Apple HIG |
| SC-2 | 卡片间距适中，避免误触 | UX 最佳实践 |
| SC-3 | 进度条视觉清晰可辨 | 用户需求（完整模式） |
| SC-4 | 动画流畅，60fps | 性能要求 |

---

## 确认的决策

### 交互决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| 滑动模式 | 显示删除按钮 | 滑动后显示红色删除按钮，点击确认删除 |
| 窄屏策略 | 回退单列 | 屏幕宽度 <360px 时自动切换为单列布局 |
| 无障碍回退 | 保留删除按钮 | 卡片右上角保留小删除图标 |
| 撤销功能 | 需要撤销 toast | 删除后显示 3 秒撤销提示 |

### 手势参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 轴锁定阈值 | 10px | `abs(deltaX) > abs(deltaY)` 时锁定水平 |
| 显示删除按钮阈值 | 60px | 滑动超过此值显示删除按钮 |
| 吸附打开阈值 | 90px | 滑动超过此值自动吸附到打开状态 |
| 速度阈值 | 0.35px/ms | 快速滑动时的吸附判断 |
| 最大滑动距离 | 80px | translateX 钳制范围 |
| 左边缘保护区 | 20px | 避免与系统返回手势冲突 |

### 动画参数

| 参数 | 值 |
|------|-----|
| 重置动画 | 180ms, ease-out |
| 吸附动画 | 220ms, cubic-bezier(0.22, 1, 0.36, 1) |

### 视觉参数

| 参数 | 值 |
|------|-----|
| 卡片间距 | 8px |
| 卡片内边距 | 10px 12px |
| 卡片圆角 | 8px |
| 删除按钮尺寸 | 44x44px |
| 进度条高度 | 4px |
| 标题行数限制 | 2行 (-webkit-line-clamp: 2) |
| 元信息字体 | 12px |
| 时间戳字体 | 11px |

### 行为约束

| 约束 | 说明 |
|------|------|
| 单卡片模式 | 同一时间只能有一张卡片处于滑开状态 |
| 条件速度徽章 | 仅当 playbackRate ≠ 1.0 时显示 |
| 原位恢复 | 撤销时恢复到原始索引位置 |
| 延迟删除 | UI 立即隐藏，localStorage 在 3 秒后更新 |
| 持久化撤销 | 撤销 toast 和计时器在面板关闭后继续有效 |
| 互斥按钮 | 卡片滑开时隐藏角落删除按钮 |
| 立即空状态 | 删除最后一项时立即显示"暂无观看记录" |

---

## 设计方案

### 1. 布局结构

```
┌─────────────────────────────────────┐
│  ← 拖拽指示器 →                      │
├─────────────────────────────────────┤
│  观看历史                    [关闭]  │
├─────────────────────────────────────┤
│ ┌───────────┐  ┌───────────┐        │
│ │ 卡片1  [x]│  │ 卡片2  [x]│        │  ← 角落删除按钮
│ │ 标题      │  │ 标题      │        │
│ │ 第X集·来源│  │ 第X集·来源│        │
│ │ ████░░ 45%│  │ ████░░ 60%│        │
│ │ 2小时前   │  │ 昨天      │        │
│ └───────────┘  └───────────┘        │
│ ┌───────────┐  ┌───────────┐        │
│ │ 卡片3     │  │ 卡片4     │        │
│ │ ...       │  │ ...       │        │
│ └───────────┘  └───────────┘        │
├─────────────────────────────────────┤
│      [ 清空历史记录 ]               │
└─────────────────────────────────────┘
```

### 2. 卡片设计

```
┌─────────────────────────────────┐
│ 视频标题（最多2行）        [x][1.5x]│  ← 删除按钮 + 速度徽章(≠1.0时)
│ 第3集 · 量子资源                │  ← 集数 + 来源 (ellipsis)
│ ████████░░░░░░░░░░░░░░░░░ 45%   │  ← 进度条 (4px高)
│ 2小时前                         │  ← 时间戳 (11px)
└─────────────────────────────────┘
```

### 3. 左滑删除交互

```
正常状态:
┌─────────────────────────────────┐
│ 卡片内容                     [x]│
└─────────────────────────────────┘

左滑中 (translateX: -60px):
┌─────────────────────────────────┐────────┐
│ 卡片内容                        │  删除  │
└─────────────────────────────────┘────────┘
                                   ↑ 红色背景 44x44px

吸附打开 (translateX: -80px):
┌─────────────────────────────────┐────────┐
│ 卡片内容                        │  删除  │
└─────────────────────────────────┘────────┘
```

### 4. 撤销 Toast

```
┌─────────────────────────────────────┐
│  已删除 "视频标题..."    [撤销]     │
└─────────────────────────────────────┘
↑ 底部固定，3秒后自动消失
```

---

## PBT 属性 (Property-Based Testing)

### 手势冲突防护

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 轴锁定 | 移动 >10px 后锁定方向，`|dx|>|dy|` 时锁定水平 | 生成 (dx, dy) 对在阈值附近，验证锁定决策 |
| 边缘保护 | `touchStart.clientX < 20` 时不触发滑动 | 随机化 x ∈ [0,19]，断言不打开删除按钮 |
| 单卡片模式 | 任意时刻最多一张卡片 translateX < 0 | 生成多卡片滑动序列，断言只有一张打开 |
| 垂直优先 | `|dy| ≥ |dx|` 且 >10px 时不触发水平滑动 | 生成垂直为主的滑动，断言无水平位移 |

### 视觉一致性

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 自适应网格 | `width < 360` → 1列，`360-640` → 2列 | 随机化视口宽度 359-641，验证列数 |
| 滑动边界 | translateX 钳制在 [-80, 0] | 生成大负值 deltaX，断言不超过 -80px |
| 删除按钮尺寸 | 始终 44x44px | 随机化视口和 DPR，验证尺寸 |
| 速度徽章 | 仅 `playbackRate ≠ 1.0` 时显示 | 测试 1, 1.0, 1.00, 1.5 等值 |
| 角落按钮互斥 | 卡片滑开时角落删除按钮隐藏 | 滑开卡片，断言角落按钮不可见 |

### 数据完整性

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 延迟持久化 | localStorage 仅在 3 秒后更新 | 删除后 <3s 检查存储未变，≥3s 检查已更新 |
| 原位恢复 | 撤销后项目回到原始索引 | 删除随机项，撤销，断言顺序深度相等 |
| 会话持久撤销 | 撤销 toast 在面板关闭后继续 | 删除→关闭面板→推进时间，断言 toast 持续 3s |

### 幂等性与往返

| 属性 | 不变量 | 伪造策略 |
|------|--------|----------|
| 幂等打开/关闭 | 连续打开/关闭同一卡片状态不变 | 执行 open→open 或 close→close，断言无额外变化 |
| 幂等删除 | 撤销窗口内重复删除同一项只删除一次 | 3s 内尝试删除两次，断言只删除一次 |
| 往返删除→撤销 | 删除后撤销恢复完全相同状态 | 快照→删除→撤销→断言深度相等 |

---

## 零决策实施计划

### 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `css/mobile-optimize.css` | 修改 | 添加移动端历史卡片网格样式 |
| `js/ui.js` | 修改 | 修改 `loadViewingHistory()` 渲染逻辑 + 撤销 toast |
| `js/mobile-panel-gestures.js` | 修改 | 添加左滑删除手势支持 |

### Task 1: CSS 样式

**文件**: `css/mobile-optimize.css`

**变更**:

1. 添加移动端历史网格容器样式
```css
@media (max-width: 640px) {
  #historyList {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 8px;
  }
}

@media (max-width: 359px) {
  #historyList {
    grid-template-columns: 1fr;
  }
}
```

2. 添加移动端历史卡片样式
```css
@media (max-width: 640px) {
  .history-item {
    position: relative;
    padding: 10px 12px;
    border-radius: 8px;
    overflow: hidden;
  }

  .history-item-content {
    transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .history-item-delete-action {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ef4444;
  }

  .history-item-delete-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .history-item-corner-delete {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    opacity: 1;
    transition: opacity 180ms ease-out;
  }

  .history-item.swiped-open .history-item-corner-delete {
    opacity: 0;
    pointer-events: none;
  }
}
```

3. 添加卡片内容样式
```css
@media (max-width: 640px) {
  .history-item .title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 14px;
    line-height: 1.3;
  }

  .history-item .meta {
    font-size: 12px;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .history-item .timestamp {
    font-size: 11px;
  }

  .history-item .progress-bar {
    height: 4px;
    border-radius: 2px;
    margin: 6px 0;
  }

  .history-item .speed-badge {
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 4px;
  }
}
```

4. 添加撤销 toast 样式
```css
.undo-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10000;
  animation: toast-in 180ms ease-out;
}

.undo-toast.hiding {
  animation: toast-out 180ms ease-out forwards;
}

.undo-toast-btn {
  color: #60a5fa;
  font-weight: 500;
  cursor: pointer;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to { opacity: 0; transform: translateX(-50%) translateY(20px); }
}
```

### Task 2: JS 渲染逻辑

**文件**: `js/ui.js`

**变更**:

1. 修改 `loadViewingHistory()` 函数，添加移动端卡片模板
   - 检测 `window.innerWidth <= 640`
   - 使用新的卡片 HTML 结构
   - 包含 `.history-item-content` 包装器用于滑动
   - 包含 `.history-item-delete-action` 删除按钮区域
   - 包含 `.history-item-corner-delete` 角落删除按钮
   - 速度徽章仅在 `playbackRate !== 1` 时渲染

2. 添加撤销系统
```javascript
// 全局状态 (window 作用域，面板关闭后持续)
window.historyUndoState = {
  deletedItem: null,
  originalIndex: -1,
  timerId: null
};

function deleteHistoryItemWithUndo(itemId, itemIndex) {
  // 1. 保存到撤销缓冲区
  const history = getViewingHistory();
  const item = history.find(h => h.id === itemId);
  window.historyUndoState = {
    deletedItem: item,
    originalIndex: itemIndex,
    timerId: setTimeout(() => {
      // 3秒后真正删除
      commitHistoryDeletion(itemId);
      hideUndoToast();
    }, 3000)
  };

  // 2. UI 立即移除
  removeHistoryItemFromDOM(itemId);

  // 3. 显示撤销 toast
  showUndoToast(item.title);
}

function undoHistoryDeletion() {
  const state = window.historyUndoState;
  if (!state.deletedItem) return;

  // 取消定时器
  clearTimeout(state.timerId);

  // 恢复到原位置
  restoreHistoryItem(state.deletedItem, state.originalIndex);

  // 清理状态
  window.historyUndoState = { deletedItem: null, originalIndex: -1, timerId: null };

  hideUndoToast();
}
```

3. 添加 toast 显示/隐藏函数
```javascript
function showUndoToast(title) {
  // 移除已有 toast
  hideUndoToast();

  const truncatedTitle = title.length > 20 ? title.slice(0, 20) + '...' : title;
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.id = 'history-undo-toast';
  toast.innerHTML = `
    <span>已删除 "${truncatedTitle}"</span>
    <span class="undo-toast-btn" onclick="undoHistoryDeletion()">撤销</span>
  `;
  document.body.appendChild(toast);
}

function hideUndoToast() {
  const toast = document.getElementById('history-undo-toast');
  if (toast) {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 180);
  }
}
```

### Task 3: 手势支持

**文件**: `js/mobile-panel-gestures.js`

**变更**:

1. 添加历史卡片滑动手势配置
```javascript
const SWIPE_CONFIG = {
  axisLockThreshold: 10,      // 轴锁定阈值
  revealThreshold: 60,        // 显示删除按钮阈值
  snapOpenThreshold: 90,      // 吸附打开阈值
  velocityThreshold: 0.35,    // 速度阈值 px/ms
  maxTranslateX: 80,          // 最大滑动距离
  edgeProtection: 20,         // 左边缘保护区
  resetDuration: 180,         // 重置动画时长
  snapDuration: 220           // 吸附动画时长
};
```

2. 添加滑动状态管理
```javascript
let swipeState = {
  activeCard: null,           // 当前打开的卡片
  startX: 0,
  startY: 0,
  currentX: 0,
  isLocked: false,
  isHorizontal: false,
  startTime: 0
};
```

3. 添加事件委托到 `#historyList`
```javascript
function initHistorySwipeGestures() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  historyList.addEventListener('touchstart', onSwipeTouchStart, { passive: true });
  historyList.addEventListener('touchmove', onSwipeTouchMove, { passive: false });
  historyList.addEventListener('touchend', onSwipeTouchEnd, { passive: true });
}
```

4. 实现 touchstart 处理
```javascript
function onSwipeTouchStart(e) {
  const touch = e.touches[0];

  // 边缘保护
  if (touch.clientX < SWIPE_CONFIG.edgeProtection) return;

  // 找到历史卡片
  const card = e.target.closest('.history-item');
  if (!card) return;

  // 关闭其他已打开的卡片
  if (swipeState.activeCard && swipeState.activeCard !== card) {
    closeSwipedCard(swipeState.activeCard);
  }

  swipeState = {
    activeCard: card,
    startX: touch.clientX,
    startY: touch.clientY,
    currentX: 0,
    isLocked: false,
    isHorizontal: false,
    startTime: Date.now()
  };
}
```

5. 实现 touchmove 处理
```javascript
function onSwipeTouchMove(e) {
  if (!swipeState.activeCard) return;

  const touch = e.touches[0];
  const dx = touch.clientX - swipeState.startX;
  const dy = touch.clientY - swipeState.startY;

  // 轴锁定判断
  if (!swipeState.isLocked) {
    if (Math.abs(dx) > SWIPE_CONFIG.axisLockThreshold ||
        Math.abs(dy) > SWIPE_CONFIG.axisLockThreshold) {
      swipeState.isLocked = true;
      swipeState.isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
  }

  // 非水平滑动，不处理
  if (!swipeState.isHorizontal) return;

  // 阻止垂直滚动
  e.preventDefault();

  // 计算位移 (只允许左滑，钳制范围)
  let translateX = Math.min(0, Math.max(-SWIPE_CONFIG.maxTranslateX, dx));

  // 弹性阻尼 (超过最大值时)
  if (dx < -SWIPE_CONFIG.maxTranslateX) {
    const overflow = -dx - SWIPE_CONFIG.maxTranslateX;
    translateX = -SWIPE_CONFIG.maxTranslateX - overflow * 0.2;
  }

  swipeState.currentX = translateX;

  // 应用变换
  const content = swipeState.activeCard.querySelector('.history-item-content');
  if (content) {
    content.style.transition = 'none';
    content.style.transform = `translateX(${translateX}px)`;
  }

  // 隐藏角落删除按钮
  if (translateX < -10) {
    swipeState.activeCard.classList.add('swiped-open');
  }
}
```

6. 实现 touchend 处理
```javascript
function onSwipeTouchEnd(e) {
  if (!swipeState.activeCard || !swipeState.isHorizontal) {
    swipeState = { activeCard: null, startX: 0, startY: 0, currentX: 0, isLocked: false, isHorizontal: false, startTime: 0 };
    return;
  }

  const content = swipeState.activeCard.querySelector('.history-item-content');
  if (!content) return;

  // 计算速度
  const duration = Date.now() - swipeState.startTime;
  const velocity = Math.abs(swipeState.currentX) / duration;

  // 判断是否吸附打开
  const shouldOpen = Math.abs(swipeState.currentX) > SWIPE_CONFIG.snapOpenThreshold ||
                     (velocity > SWIPE_CONFIG.velocityThreshold && swipeState.currentX < -SWIPE_CONFIG.revealThreshold);

  if (shouldOpen) {
    // 吸附到打开状态
    content.style.transition = `transform ${SWIPE_CONFIG.snapDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    content.style.transform = `translateX(-${SWIPE_CONFIG.maxTranslateX}px)`;
    swipeState.activeCard.classList.add('swiped-open');
  } else {
    // 重置到关闭状态
    closeSwipedCard(swipeState.activeCard);
  }
}

function closeSwipedCard(card) {
  const content = card.querySelector('.history-item-content');
  if (content) {
    content.style.transition = `transform ${SWIPE_CONFIG.resetDuration}ms ease-out`;
    content.style.transform = 'translateX(0)';
  }
  card.classList.remove('swiped-open');
  if (swipeState.activeCard === card) {
    swipeState.activeCard = null;
  }
}
```

7. 在面板打开时初始化
```javascript
// 在 showHistoryPanel() 或相应位置调用
initHistorySwipeGestures();
```

---

## 成功判据

| ID | 判据 | 验证方式 |
|----|------|----------|
| S-1 | 移动端 (360-640px) 历史面板显示为2列卡片网格 | 视觉检查 |
| S-2 | 移动端 (<360px) 历史面板显示为单列 | 视觉检查 |
| S-3 | 左滑卡片 >60px 显示删除按钮 | 手动测试 |
| S-4 | 左滑 >90px 或快速滑动自动吸附打开 | 手动测试 |
| S-5 | 同时只有一张卡片处于滑开状态 | 手动测试 |
| S-6 | 点击卡片正常跳转播放 | 手动测试 |
| S-7 | 点击删除按钮后显示撤销 toast | 手动测试 |
| S-8 | 3秒内点击撤销可恢复到原位置 | 手动测试 |
| S-9 | 桌面端布局不受影响 | 视觉检查 |
| S-10 | 面板下拉关闭手势正常 | 手动测试 |
| S-11 | 左边缘 20px 内滑动不触发删除 | 手动测试 |
| S-12 | 速度徽章仅在 ≠1.0 时显示 | 视觉检查 |
| S-13 | 卡片滑开时角落删除按钮隐藏 | 视觉检查 |
| S-14 | 关闭面板后撤销 toast 仍有效 | 手动测试 |
