---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 21
severity: P2
confidence: high
category: duplicate-dom-pattern
file: js/ui.js
---

# Finding 21 — HTML escape replace 链重复 3 处（含 1 处残缺）

| 项 | 值 |
|---|---|
| 文件 | `js/ui.js` |
| 行号 | 513-517 (safeTitle)、520-524 (safeSource)、555-558 (safeCoverUrl) |
| 性质 | duplicate-dom-pattern |
| 严重度 | P2 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// ui.js:513-517 (safeTitle) — 5 个 escape
.replace(/&/g, '&')
.replace(/</g, '<')
.replace(/>/g, '>')
.replace(/"/g, '"')
.replace(/'/g, '&#39;');

// ui.js:520-524 (safeSource) — 同 5 个
// ui.js:555-558 (safeCoverUrl) — 仅 3 个（& " '，缺 < >）
```

## 为什么是冗余

- `safeTitle` 与 `safeSource` 的 5-replace 链逐字相同；`safeCoverUrl` 是**残缺 3-replace**（漏 `<` `>`）。
- 漏改隐患：`safeCoverUrl` 用于注入 img 的 URL 属性，若 URL 中含 `>` 不会转义——在 URL 场景下风险较低，但不一致本身是分岔味道。
- 抽单 helper：

```js
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
        .replace(/"/g, '"').replace(/'/g, '&#39;');
}
```

三个 safe 函数退化为 `escapeHtml(title)` / `escapeHtml(source)` / `escapeHtml(coverUrl)`，且残缺版自动补齐为完整转义。

## 影响

- 净减约 10 行；XSS 转义逻辑单点维护，杜绝残缺分岔。
- 注意：补齐 `safeCoverUrl` 后确认 URL 渲染不被 `<` `>` 转义破坏（正常 URL 不含这些字符，应无影响）。

## 验证 checklist

- [ ] 标题 / 来源 / 封面 URL 含 `& " ' < >` 五类字符渲染均正确转义
- [ ] 封面 URL 转义后仍能正常加载图片
