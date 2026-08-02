---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 07
severity: P1
confidence: high
category: duplicate-implementation
file: js/player.js
---

# Finding 07 — `show_identifier` 计算逻辑重复 3 处

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 837-841、918-922、1445-1449 |
| 性质 | duplicate-implementation |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

完全相同的 9 行标识符推导逻辑出现 3 次：

```js
// player.js:837-841
let show_identifier;
if (sourceName && id_from_params) {
    show_identifier = `${sourceName}_${id_from_params}`;
} else {
    show_identifier = (currentEpisodes && currentEpisodes.length > 0) ? currentEpisodes[0] : currentVideoUrl;
}

// player.js:918-922  （逐字相同）
// player.js:1445-1449（变量名 show_identifier_for_video_info，逻辑同构）
```

第 3 处仅变量名不同（`show_identifier_for_video_info`），分支结构完全一致。

## 为什么是冗余

- 同一条“优先 `sourceName_id` 回退首集/URL”的推导规则复制 3 次。
- 若规则要调整（如改分隔符、加新回退源），需改 3 处且必须保持变量名差异——易漏改且易让三处推导结果不一致，进而影响历史/进度键的命中率。
- 抽成单 helper：

```js
function getShowIdentifier() {
    if (sourceName && id_from_params) return `${sourceName}_${id_from_params}`;
    return (currentEpisodes && currentEpisodes.length > 0) ? currentEpisodes[0] : currentVideoUrl;
}
```

## 影响

- 净减约 18 行；历史/进度键推导单一来源，杜绝三处分岔。
- 注意 `sourceName` / `id_from_params` / `currentEpisodes` / `currentVideoUrl` 需在该 helper 的作用域内可见——它们是模块级/闭包变量，抽函数时确认作用域。

## 验证 checklist

- [ ] 历史/进度键在三处调用点产生的值与原逻辑一致
- [ ] 切源、切集后历史记录仍能正确关联到同一标识符
