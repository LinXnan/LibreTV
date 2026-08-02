---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 20
severity: P2
confidence: high
category: duplicate-implementation
file: js/ui.js
---

# Finding 20 — `deleteHistoryItem` 与 `deleteHistoryItemWithUndo` 重复查找

| 项 | 值 |
|---|---|
| 文件 | `js/ui.js` |
| 行号 | 671-682 (deleteHistoryItem) 与 692-700 (deleteHistoryItemWithUndo) |
| 性质 | duplicate-implementation |
| 严重度 | P2 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// ui.js:671-682 (deleteHistoryItem)
function deleteHistoryItem(encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    const history = getViewingHistory();
    const itemIndex = history.findIndex(item => item.url === url);
    if (itemIndex === -1) {
        showToast('记录不存在', 'error');
        return;
    }
    deleteHistoryItemWithUndo(encodedUrl, itemIndex);
}

// ui.js:692-700 (deleteHistoryItemWithUndo) 内部又做一次:
const url = decodeURIComponent(encodedUrl);
const history = getViewingHistory();
const item = history.find(h => h.url === url);
```

## 为什么是冗余

- `deleteHistoryItem` 已 `decodeURIComponent` + `getViewingHistory` + `findIndex`，然后把 `itemIndex` 传给 `deleteHistoryItemWithUndo`——但后者仍重复 `decodeURIComponent` + `getViewingHistory` + `find` 一次（没复用传入的 index）。
- 外层做的工作内层又做一遍。要么外层把已算出的 `item`/`itemIndex` 透传给内层，要么外层直接退役调用方一律走内层。
- 注意：内层 `deleteHistoryItemWithUndo` 可能也被其它地方直接调用（如撤销栈），所以更稳妥的是：内层接收已算好的 `item` / `itemIndex` 作为入参，不再自查。

## 影响

- 净减一次 `getViewingHistory`（含 localStorage 读 + JSON.parse）+ 一次 `find`，约 3-4 行；删除热点路径下少一次反序列化，顺带性能小收益。

## 验证 checklist

- [ ] 删除单条历史后 toast 与撤销行为不变
- [ ] 内层若被其它调用方直接调用，仍能在无外层预查的情况下独立完成
