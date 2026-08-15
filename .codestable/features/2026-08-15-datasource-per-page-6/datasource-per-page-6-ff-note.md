---
doc_type: feature-ff-note
feature: datasource-per-page-6
date: 2026-08-15
requirement:
tags: [datasource, pagination, settings-panel]
---

## 做了什么

设置面板的数据源（API 选择）分页统一为每页最多 6 个，去掉 PC 端 12 个 / 移动端 6 个的断点差异，两端展示一致。

## 改了哪些

- `js/app.js:98-101`（`getApiPageSize`）— 固定返回 6，不再按 `window.innerWidth` 区分 6/12

## 怎么验证的

IDE 语言服务 lint 通过；`getApiTotalPages()` / `initAPICheckboxes()` 切片 / 末页占位补足均复用 `getApiPageSize()`，改动为纯常量替换，无其他引用点。浏览器手动验证：设置面板数据源每页固定 6 个，翻页与占位高度正常。

## 顺手发现（可选，不阻塞）

- `js/app.js:615-632`（resize 断点重渲染）— 每页数量固定后，跨断点重渲染已无实际作用（pageSize 不再变化），但保留无害，未在本次移除
