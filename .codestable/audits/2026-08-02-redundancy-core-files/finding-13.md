---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 13
severity: P1
confidence: high
category: duplicate-implementation
file: js/ui.js
---

# Finding 13 — localStorage 读 + JSON.parse + fallback 模板重复

| 项 | 值 |
|---|---|
| 文件 | `js/ui.js` |
| 行号 | 162-183 (getSearchHistory) 与 433-441 (getViewingHistory) |
| 性质 | duplicate-implementation |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// ui.js:162-183 (getSearchHistory)
try {
    const data = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => { ... }).filter(item => item && item.text);
} catch (e) {
    console.error('...', e);
    return [];
}

// ui.js:433-441 (getViewingHistory)
try {
    const data = localStorage.getItem('viewingHistory');
    return data ? JSON.parse(data) : [];
} catch (e) {
    console.error('获取观看历史失败:', e);
    return [];
}
```

## 为什么是冗余

- 两者都是同样的 try/catch 包 `getItem` + `JSON.parse` + 异常时回退 `[]` 结构模板。`getSearchHistory` 多一层 array 校验与 map，但骨架完全同构。
- 而 `utils.js` 的 `StorageManager.getItem(key)`（83-96 行）已经实现了带**内存缓存**的同款 try/catch/JSON.parse fallback，本文件却不用它（见 finding-03）。
- 两步走抽离：
  1. 短期：抽 `safeGetJSON(key, fallback = [])` 统一两处骨架。
  2. 接 finding-03: 直接改用 `window.storageManager.getItem(key)`，缓存命中即返回，无效数据回退默认值。

## 影响

- 与 finding-03 合并改造后，本模板可整体并入 StorageManager 调用，净减约 12 行 + 享缓存读加速。
- 注意：`getSearchHistory` 的 `parsed.map(...).filter(...)` 是数据塑形，不强属 fallback 模板——抽 helper 时保留这一步在外层调用。

## 验证 checklist

- [ ] 搜索历史与观看历史读取在空 / 损坏 JSON / 正常三种数据下行为不变
- [ ] 改用 storageManager 后，二次读命中缓存返回同一引用（注意是否需要深拷贝以防调用方篡改）
