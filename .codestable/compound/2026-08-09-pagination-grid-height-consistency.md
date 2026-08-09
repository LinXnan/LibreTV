# 分页网格高度一致与断点切换：占位补足、子像素差、动态每页数量

## 背景

设置面板数据源（API 选择）区域分页网格在 PC 端每页 12 个、移动端每页 6 个。翻页时若末页不足整页项数，网格高度骤减导致面板跳动；真实项与占位项即使 `min-height` 相同仍出现 1px 级高度差；每页数量随断点动态变化后，窗口跨 640px 时若不做重渲染会出现切片错位/页码越界。逐一排查确认是四个独立小坑，每个都值得沉淀。

## 结论

1. **补足空白占位项，用无 input 的空 `<div>`**：动态分页网格每页渲染后补 `pageSize - 实际项数` 个 `visibility:hidden` 的占位元素（复用 item 的 class 以继承 `min-height` 布局）。用 `<div>` 而非 `<label>`/含 input 的元素，天然规避 `#容器 input:checked`、`input[type="checkbox"]` 选择器查询被占位项污染（`updateSelectedAPIs` / `selectAllAPIs` / 成人检测均安全）。
2. **子像素渲染差需固定 `height` 才彻底消除**：真实项与占位项 `min-height` 相同，但名称行高等内容子像素舍入（如 40.5px→41px）会让真实项比占位项高 1px，表现为"面板还跳动一点点"。解决：同 class 固定 `height`（项目全局 `box-sizing: border-box`，height 即含 padding/border 总高），使每格严格等高。内容（单行 nowrap + ellipsis）不超过固定高度则不溢出。
3. **每页数量按断点动态化时，窗口跨断点必须重渲染**：`getApiPageSize()` 返回 PC 12 / 移动 6 后，`window.innerWidth` 跨越 640px 时若不重渲染，`totalPages` 变化而切片仍是旧 pageSize，会出现"第 3/2 页"类越界、数据子集错位。用 debounce `resize` + 阈值状态守卫（记录当前是否 mobile，仅在跨越时触发）调用重渲染；跨入移动端且面板打开时同步滚动到列表顶部（与翻页行为一致）。
4. **固定高度/样式规则用容器 id 限定作用域**：`#normaldiv .mobile-api-item` 只命中普通资源组；不要用裸 `.mobile-api-item`，否则会波及含多行内容（`.mobile-api-url`）的自定义 API 列表或含 badge 的成人组项，造成截断。
5. **断点阈值在 JS/CSS 间必须一致**：JS 用 `window.innerWidth <= 640` 判断移动端，CSS 用 `max-width: 640px` / `min-width: 641px`，三处对齐避免 off-by-one（如 640 与 641 边界出现"pageSize 已变但样式未变"或反向错位）。

## 证据

- `js/app.js:104-107` — `getApiPageSize()` 按 `innerWidth <= 640` 返回 6/12
- `js/app.js:206-213` — `initAPICheckboxes()` 补足 `visibility:hidden` 占位空 `<div>`（无 input）
- `js/app.js:607-637` — `setupEventListeners()` debounce resize + 阈值守卫重渲染 + 移动端滚动同步
- `css/mobile-optimize.css:693-696, 757-760` — `#normaldiv .mobile-api-item { height: 3.5rem / 2.5rem }` 固定项高
- `.codestable/issues/2026-08-09-datasource-pagination-ui/fix-note.md` — 完整修复记录与 rounds 1-6 复审结论
