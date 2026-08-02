---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 22
severity: P2
confidence: medium
category: dead-code
file: js/ui.js
---

# Finding 22 — 历史面板点击外部关闭监听器与 app.js 重复（疑似多余）

| 项 | 值 |
|---|---|
| 文件 | `js/ui.js` |
| 行号 | 1126-1139 |
| 性质 | dead-code |
| 严重度 | P2 |
| 置信度 | medium |
| 建议动作 | cs-refactor |

## 证据

```js
// ui.js:1126-1139
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(e) {
        const historyPanel = document.getElementById('historyPanel');
        const historyButton = document.querySelector('button[onclick="toggleHistory(event)"]');
        if (historyPanel && historyButton &&
            !historyPanel.contains(e.target) &&
            !historyButton.contains(e.target) &&
            historyPanel.classList.contains('show')) {
            historyPanel.classList.remove('show');
        }
    });
});
```

## 为什么可能是冗余

- `app.js:569-594`（见 finding-18）已注册一个点击外部关闭的 listener，**同时处理 `#settingsPanel` 与 `#historyPanel`**。
- 本处 ui.js 又为 `#historyPanel` 单独注册一个等价的点击外部关闭 listener。若 app.js 那处已覆盖 history，本处属重复。
- 置信度 medium 而非 high：需确认两处是否会**互相干扰或时序竞争**。两处都 `document.addEventListener('click')`，且都无 `stopPropagation`，理论上都会触发；若 app.js 已收起 historyPanel，本处再 `remove('show')` 是无害幂等，但仍是冗余逻辑。
- 用 `querySelector('button[onclick="toggleHistory(event)"]')` 以 onclick 字符串匹配按钮，较脆弱——按钮若有任何属性调整即失效。

## 修复方向

1. 确认 app.js 的 listener 确实覆盖 history（finding-18 证据显示第 585-594 段处理的就是 `#historyPanel`）。
2. 若确认覆盖，删除 ui.js:1126-1139。
3. 若发现两处存在时序差异（如 app.js 未在某种移动端分支绑定），则将两处合并到 app.js 的统一 helper，删除本处。

## 影响

- 删除后净减 13 行 + 一条全文档级 click 监听器（轻度性能收益）。
- 风险：若实际历史面板在某种状态下只有 ui.js 这条能收起（比如 app.js listener 因 `panelClosed` 短路），删除会破坏关闭行为。改动需手动测：打开历史面板 → 点击各种外部区域。

## 验证 checklist

- [ ] 桌面端与移动端打开历史面板后，点击外部、点击设置按钮、点击其它按钮均能正确收起
- [ ] 删除 ui.js 监听器后行为与之前无异
