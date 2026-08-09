---
doc_type: issue-fix
issue: 2026-08-09-datasource-pagination-ui
status: confirmed
path: fast-track
fix_date: 2026-08-09
tags: [settings-panel, pagination, app.js]
---

# 数据源面板分页文案与翻页跳动 修复记录

## 1. 问题描述

设置面板的数据源（API 选择）区域分页控件存在三个问题：

1. 分页信息行显示"第 X/Y 页 · 每页 12 个"，多出"每页 N 个"字眼。
2. PC 端点击"下一页"按钮后，整个设置面板平滑滚动跳到 API 列表顶部，造成面板内容向上跳动。
3. 末页不足 12 个数据源时，网格项变少，面板高度随之变化（面板大小变动）。

## 2. 根因

- **问题 1**：`js/app.js:132` 分页信息直接拼接了每页数量：`info.textContent = \`第 ${apiPage}/${totalPages} 页 · 每页 ${API_PAGE_SIZE} 个\`;`。
- **问题 2**：`js/app.js:154-159` 的 `changeApiPage()` 在翻页重建 DOM 后无条件执行 `panel.scrollTo({ top: anchor.offsetTop - 24, behavior: 'smooth' })`。PC 端（窗口宽度 > 640px）点击位于列表下方的"下一页"时，整个面板被平滑滚回 API 列表顶部，表现为"面板往上跳"。

## 3. 修复方案

1. `js/app.js:132`：信息行改为只显示 `第 ${apiPage}/${totalPages} 页`，去掉 `· 每页 ${API_PAGE_SIZE} 个`。
2. `js/app.js:150-162`：`changeApiPage()` 中的滚动逻辑加移动端条件 `window.innerWidth <= 640`，PC 端翻页后保持原滚动位置，不再跳动。移动端保留原滚动行为，与 `toggleSettings()` 等现有端区分判断一致。
3. `js/app.js:204-209`：`initAPICheckboxes()` 渲染完当前页真实项后，补足 `API_PAGE_SIZE - pageKeys.length` 个 `visibility: hidden` 的占位项（复用 `mobile-api-item` 结构），使每页网格始终满 12 格。占位项不含 input，不影响勾选统计与全选逻辑。
4. `css/mobile-optimize.css`：在 `#apiCheckboxes` 范围内固定数据源网格项高（PC ≥641px 为 `height: 2.5rem`，移动 ≤640px 为 `height: 3.5rem`），消除真实项与占位项因子像素渲染产生的高度差，末页面板高度与整页严格一致（不扩大范围到自定义 API 列表，避免其含 URL 的多行内容被截断）。
5. `js/app.js:104-107`：`API_PAGE_SIZE` 常量改为 `getApiPageSize()` 函数，按端返回每页数量（PC ≥641px 为 12，移动 ≤640px 为 6），并在 `getApiTotalPages()` / `initAPICheckboxes()` 切片与补位逻辑中统一使用，移动端数据源面板每页显示 6 个。
6. `js/app.js:607-616`：`setupEventListeners()` 增加 debounce `resize` 监听，窗口宽度跨越 640px 阈值时重渲染分页（`initAPICheckboxes()`），避免 pageSize 变化后切片/页码错位（round 4 复审发现的 important 项）。
7. `css/mobile-optimize.css`：固定高度选择器收窄为 `#normaldiv .mobile-api-item`，仅普通资源组生效，成人组项不被固定高度影响。
8. `js/app.js:630-637`：resize 回调跨入移动端且面板打开（`show` class）时，滚动到 API 选择区域顶部，与 `changeApiPage()` 移动端滚动语义一致（round 6 复审确认；面板关闭时不滚动）。

## 4. 改动文件清单

- `js/app.js`：修改 `buildPagination()` 的 info 文案（132 行）、`changeApiPage()` 的滚动条件（154-161 行）、`initAPICheckboxes()` 的补位逻辑（204-209 行）、分页数量（`API_PAGE_SIZE` → `getApiPageSize()`，104-107 行）与 `setupEventListeners()` 的 resize 重渲染 + 移动端滚动同步（607-637 行）。
- `css/mobile-optimize.css`：移动端段（693-696 行）与 PC 段（757-760 行）各一条 `#normaldiv .mobile-api-item` 固定高度规则。

## 5. 验证结果

- `node --check js/app.js` 通过，无语法错误；`read_lints` 无诊断。
- 逻辑核对：
  - 问题 1：分页信息字符串不再包含"每页 N 个"，只显示"第 X/Y 页"。
  - 问题 2：PC 端（`window.innerWidth > 640`）翻页时跳过滚动分支，`initAPICheckboxes()` 重建 DOM 后保持面板原滚动位置；移动端（`≤ 640`）仍滚动到 API 列表顶部。
  - 问题 3：每页渲染后补足占位项至 `API_PAGE_SIZE`，网格恒为 12 格，末页面板高度与整页一致；占位项 `visibility: hidden` 且无 input，不影响 `updateSelectedAPIs()` / `selectAllAPIs()` / `checkAdultAPIsSelected()` 的 `input:checked` 与 `input[type="checkbox"]` 查询。
- 影响面回归：分页数据切片、勾选状态更新、`stopPropagation` 防冒泡逻辑均未改动；移动端滚动行为保留。
- 浏览器手动验证待用户执行（打开设置面板 → 查看分页文案；PC 端点击"下一页"确认面板不跳动；翻到末页确认面板高度不再变动；移动端确认原滚动行为保留）。

## 6. 遗留事项

无。
