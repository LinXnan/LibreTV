---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 17
severity: P2
confidence: medium
category: duplicate-dom-pattern
file: js/player.js
---

# Finding 17 — `updateOrderButton` 与 `updateOrderButtonInModal` 近重复

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 1330-1337 (updateOrderButton) 与 2823-2840 (updateOrderButtonInModal) |
| 性质 | duplicate-dom-pattern |
| 严重度 | P2 |
| 置信度 | medium |
| 建议动作 | cs-refactor |

## 证据

```js
// player.js:1330-1337
function updateOrderButton() {
    const orderText = document.getElementById('orderText');
    const orderIcon = document.getElementById('orderIcon');
    if (orderText && orderIcon) {
        orderText.textContent = episodesReversed ? '正序排列' : '倒序排列';
        orderIcon.style.transform = episodesReversed ? 'rotate(180deg)' : '';
    }
}

// player.js:2823-2840 (updateOrderButtonInModal) — 操作 modal 版 id，
//   且用 innerHTML 切换 SVG path（非 rotate transform）表达上下箭头
```

配套的 `toggleEpisodeOrder` (1316-1327) 与 `toggleEpisodeOrderInModal` (2804-2820) 也同样成对，modal 版 toggle 调用完自己的渲染后再调用主版 toggle，造成重复渲染。

## 为什么是冗余

- 两个函数表达同一 `episodesReversed` 状态到按钮的映射，差异是 DOM id 与视觉表达方式（transform rotate vs SVG path 切换）。
- 风险：若排序状态语义变化（如新增“随机序”），2 处映射 + 2 处 toggle 都要改。
- 因表达方式不同，不宜强行合并为同一函数；可抽**状态→标签**映射的纯数据，再让两处各读 mapped 值绘制：

```js
const ORDER_LABELS = { reversed: '正序排列', normal: '倒序排列' }; // 主版
// modal 版若坚持 SVG，单独维护箭头 path
```

## 影响（中等）

- 收益较小，且因视觉表达不同，强行抽象反而可能更绕。**置信度 medium**：是否值得抽取决于是否计划统一两处视觉。
- 建议：优先修 `toggleEpisodeOrderInModal` 在自己的渲染后**还调用主版 toggle** 导致的重复渲染，这处副作用比样式重叠更值得处理。

## 验证 checklist

- [ ] 排序按钮文本 / 图标在主列表与弹框两处切换状态一致
- [ ] modal toggle 不再触发主列表的重复渲染
