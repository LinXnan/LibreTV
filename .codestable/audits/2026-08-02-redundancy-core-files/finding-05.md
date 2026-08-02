---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 05
severity: P1
confidence: high
category: duplicate-implementation
file: js/app.js
---

# Finding 05 — `filterBySource/Category/Latency` 三个近重复函数

| 项 | 值 |
|---|---|
| 文件 | `js/app.js` |
| 行号 | 1586-1625 |
| 性质 | duplicate-implementation |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// app.js:1586-1597
function filterBySource(source) {
    currentFilters.source = source;
    applySearchFilters();
    document.querySelectorAll('#sourceFilters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === source) btn.classList.add('active');
    });
}

// app.js:1600-1611
function filterByCategory(category) {
    currentFilters.category = category;
    applySearchFilters();
    document.querySelectorAll('#categoryFilters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === category) btn.classList.add('active');
    });
}

// app.js:1614-1625
function filterByLatency(latency) {
    currentFilters.latency = latency;
    applySearchFilters();
    document.querySelectorAll('#latencyFilters .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === latency) btn.classList.add('active');
    });
}
```

## 为什么是冗余

- 三个函数**仅差两个变量**：(a) 写入 `currentFilters` 的哪个键；(b) 查询哪个 `#{...}Filters` 容器。结构完全同构，40 行可压成 ~8 行：

```js
function filterBy(dimension, value, containerId) {
    currentFilters[dimension] = value;
    applySearchFilters();
    document.querySelectorAll(`#${containerId} .filter-btn`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === value);
    });
}
// 调用: filterBy('source', source, 'sourceFilters'); 等
```

## 影响

- 净减约 30 行；新增一类筛选维度时只需新增一行调用而非复制整段。
- 注意：`onclick` 调用方（HTML 中可能写 `onclick="filterBySource('xxx')"`）需同步改名，否则会断。重构时需 grep HTML/字符串模板里的调用名。

## 验证 checklist

- [ ] 三个维度的筛选按钮 active 态切换正常
- [ ] `applySearchFilters()` 仍被正确触发
- [ ] HTML 中所有 `onclick="filterBy*"` 调用点已同步更新
