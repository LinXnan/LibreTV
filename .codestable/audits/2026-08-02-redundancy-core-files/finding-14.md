---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 14
severity: P2
confidence: high
category: duplicate-implementation
file: js/player.js
---

# Finding 14 — `custom_N` 解析模式重复 4 处且解析方式不一致

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 1847、1875、1993、2105 |
| 性质 | duplicate-implementation |
| 严重度 | P2 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// player.js:1847 (renderResourceInfoBar)
const customIndex = parseInt(currentSource.replace('custom_', ''), 10);

// player.js:1875 (testVideoSourceSpeed)
const customIndex = sourceKey.replace('custom_', '');   // 字符串，未 parseInt

// player.js:1993 (showSwitchResourceModal)
const customIndex = parseInt(curr.replace('custom_', ''), 10);

// player.js:2105 (switchToResource)
const customIndex = sourceKey.replace('custom_', '');   // 字符串
```

## 为什么是冗余

- 从 `custom_N` 提取数字索引的逻辑分散 4 处，**且解析方式不一致**：1847 与 1993 `parseInt`，1875 与 2105 留字符串直接传给 `getCustomApiInfo`。
- 风险：若 `getCustomApiInfo` 内部对字符串与数字两套处理不严格相等，字符串路径与数字路径行为可能分岔（如 `custom_01` 与 `custom_1`），属隐性不一致。
- 抽单 helper 并统一约定（建议都 parseInt 为数字）：

```js
function getCustomIndex(sourceKey) {
    return parseInt(String(sourceKey).replace('custom_', ''), 10);
}
```

## 影响

- 净减 4 处重复 + 消除字符串/数字分岔隐患。
- 与 finding-12 同属自定义 API 处理域，可一并整理。

## 验证 checklist

- [ ] `getCustomApiInfo` 在收到数字与字符串参数时行为一致，或统一改成数字入参
- [ ] 自定义源渲染、测速、弹框切源、切到资源四条路径索引一致
