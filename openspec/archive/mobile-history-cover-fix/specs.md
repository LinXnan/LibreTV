# Specs: Mobile History Cover Fix

## Requirements

### R1: 移动端封面图片鉴权

**场景**: 用户打开移动端历史记录面板

**约束**:
- 必须通过 `ProxyAuth.addAuthToProxyUrl()` 获取带鉴权的 URL
- 使用 `<img data-src>` + `LazyImageLoader` 机制
- 保持封面作为背景的视觉效果

**验收标准**:
- [x] 封面图片正常加载，无 401 错误
- [x] 图片加载失败时显示渐变色占位

### R2: 移动端历史卡片固定尺寸

**场景**: 历史记录面板显示多条记录

**约束**:
- 卡片高度固定为 `140px`
- 保持 2 列网格布局
- 文字内容超出时截断

**验收标准**:
- [x] 所有卡片高度一致 (140px)
- [x] 多条记录时布局整齐

---

## Resolved Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Card Height | `140px` | 与 proposal 一致，紧凑布局 |
| Z-index Stack | img:0, overlay:1, text:2, controls:3 | 4层分离，确保交互层可点击 |
| Overlay Method | `::before` pseudo-element | 无额外 DOM，更简洁 |
| LazyLoader Selector | `.history-item-content img.lazy-load` | 精确匹配移动端历史卡片 |
| Error Fallback | Gradient on parent | 复用现有 `generateColorFromTitle` |
| Alt Attribute | Video title | 用于 fallback gradient 生成 |
| Browser Support | Modern only | IntersectionObserver required |

---

## PBT Properties

### Authentication Correctness

| Invariant | Falsification Strategy |
|-----------|------------------------|
| 所有 `/proxy/` URL 必须经过 `ProxyAuth.addAuthToProxyUrl()` 签名 | 拦截请求，删除/篡改 `auth`/`t` 参数，任何 401 或未签名请求即为失败 |
| 重复调用 `loadViewingHistory()` + `observeAll` 不会退化为未签名请求 | 重新渲染 N 次，清除观察器后重新观察，任何未签名请求或 401 即为失败 |
| 无效/空封面 URL 不触发代理请求，直接显示占位符 | 输入无效 scheme、空字符串、ProxyAuth 抛异常，任何 `/proxy/` 请求或 401 即为失败 |

### Layout Stability

| Invariant | Falsification Strategy |
|-----------|------------------------|
| `.history-item-content` 计算高度恒为 `140px`，不受标题长度、元数据、进度条、图片加载状态影响 | 生成极端内容长度和加载状态，任何高度 ≠ 140px 即为失败 |
| Z-index 固定且有序：`img:0 < overlay:1 < text:2 < controls:3`，无超出 0-3 范围的值 | 注入随机 z-index 覆盖或内联样式，计算值超出范围或顺序错误即为失败 |
| `.history-item-content::before` 存在、完全覆盖卡片、z-index 为 1、不影响布局高度 | 移除伪元素或改变定位/尺寸，遮罩缺失、未覆盖或高度变化即为失败 |

### Visual Consistency

| Property | Definition | Boundary Conditions | Counterexample |
|----------|------------|---------------------|----------------|
| Z-index Layering | 严格堆叠顺序管理重叠元素可见性 | img:0, overlay:1, text:2, controls:3 | overlay z-index:5 遮挡标题文字 |
| Visual Scrim | `::before` 暗色渐变遮罩确保文字可读性 | 附加到 `.history-item-content`，透明度 ≤ 0.7 | 单独 div 捕获点击事件 |
| Fixed Dimension | 统一卡片高度确保滚动稳定性 | 严格 `height: 140px`，超出内容裁剪 | 多行标题扩展到 180px |

### Error Handling

| Property | Definition | Boundary Conditions | Counterexample |
|----------|------------|---------------------|----------------|
| Auth/Load Degradation | 鉴权失败或超时(3s)的恢复逻辑 | 清除 loadingImages Map，回退到 `generateColorFromTitle` 渐变 | 显示破损图片图标或空白框 |
