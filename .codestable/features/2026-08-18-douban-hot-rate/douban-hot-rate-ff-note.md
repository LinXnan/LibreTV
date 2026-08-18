---
doc_type: feature-ff-note
feature: 2026-08-18-douban-hot-rate
date: 2026-08-18
requirement:
tags: [home, douban, carousel, ui, rate]
execution_lane: quick
---

## 做了什么
豆瓣热播轮播卡片在片名上方显示**豆瓣评分**（金色星星 + 分值，如「★ 8.9」）。数据流已有：`recent-watch.js` 已从豆瓣 API 取 `rate` 字段并 `escapeHtml` 转义（`safeRate`，如 `8.9`），只是未渲染到卡片。本次在卡片模板补评分行 + CSS 补评分样式，仅当评分存在时显示（`rate` 为空则整行省略，避免空白星）。

## 改了哪些
- `js/recent-watch.js`：
  - `.recent-watch-info` 内新增评分行（在片名上方）：
    ```html
    <span class="recent-watch-rate">★ <span class="recent-watch-rate-value">${safeRate}</span></span>
    ```
  - 评分存在才输出该行（`item.rate` 有值时）；`aria-label` 已有"片名 X 分"朗读，评分行 `aria-hidden="true"`（继承 info 层）不重复
- `css/index.css`：
  - `.recent-watch-rate`：金色星标 + 白字分值，居中，片名上方一行
  - 渐变衬底高度随 info 内容增高自动扩展（info 已有 padding 与渐变，无需改）

## 怎么验证的
- `read_lints`（js/recent-watch.js、css/index.css）0 报错
- 浏览器手动验证待用户执行：首页轮播卡片片名上方显示「★ 8.9」金色评分；无评分影片不显示评分行（片名仍常显）；中央放大卡评分随卡片缩放；移动端不溢出

## 设计要点（防回归）
- 评分行放在 `.recent-watch-info`（absolute 贴底 + 渐变衬底）内，随卡片缩放、受裁剪约束，无需改卡片布局
- 星星用文本 `★`（U+2605）避免额外 SVG/图片；金色 `#f5c518`（豆瓣评分标准色）
- `aria-label` 已含"X 分"，评分行不重复朗读；`pointer-events:none` 继承不拦截点击
- 渐变衬底已覆盖 bottom 区，评分+片名两行都在渐变内，可读性有保障

## Code Review 修复（2026-08-18，REV-001）
- REV-001（important）：`rate: String((s && s.rate) || '')` 只能排除数字 `0`，但豆瓣 API 返回字符串（无评分影片 rate 为 `"0.0"`），`"0.0" || ''` 为真值 → 无评分影片错误显示「★ 0.0」。
  - 修复：数据映射处归一化 `const rate = /^\s*0+(\.0+)?\s*$/.test(rawRate) ? '' : rawRate`——`0`/`"0"`/`"0.0"`/`"0.00"`/带空白零值视为无评分（空串），保留原始字符串避免 parseFloat 丢小数。
  - 验证：node 自测 `8.9`→保留、`0.0`/`0`/`0.00`/` 0.0 `→空、空串→空；lint 0 报错。
- nit：`.recent-watch-rate` 补 `white-space:nowrap + ellipsis`，防异常长文本换行撑高 info。
