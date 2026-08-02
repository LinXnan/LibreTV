---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 18
severity: P2
confidence: high
category: duplicate-dom-pattern
file: js/app.js
---

# Finding 18 — 设置/历史面板点击外部关闭逻辑重复 2 处

| 项 | 值 |
|---|---|
| 文件 | `js/app.js` |
| 行号 | 574-583 与 585-594 |
| 性质 | duplicate-dom-pattern |
| 严重度 | P2 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// app.js:574-583 (settingsPanel)
const settingsPanel = document.querySelector('#settingsPanel.show');
const settingsButton = document.querySelector('#settingsPanel .close-btn');
if (settingsPanel && settingsButton &&
    !settingsPanel.contains(e.target) &&
    !settingsButton.contains(e.target)) {
    settingsPanel.classList.remove('show');
    panelClosed = true;
}

// app.js:585-594 (historyPanel) — 仅 selector #settingsPanel/#historyPanel 不同
```

## 为什么是冗余

- 两段 10 行结构同构：取 panel + close-btn + 点击点不落在 panel/btn 内则收起。仅 selector 字符串不同。
- 抽 helper：

```js
function closePanelIfClickOutside(e, panelSelector, closeBtnSelector, state) {
    const panel = document.querySelector(panelSelector + '.show');
    const btn = document.querySelector(closeBtnSelector);
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('show');
        state.panelClosed = true;
    }
}
```

## 影响

- 净减约 8 行；新增同款可外部关闭的面板时复用 helper。
- 注意：与 finding-22 的 ui.js 历史面板监听器**功能重叠**——app.js 这处已同时处理 settings 与 history 两个面板，ui.js 那处对 history 的单独监听可能多余，两者择一即可（见 finding-22）。

## 验证 checklist

- [ ] 设置面板与历史面板在点击外部时均正确收起
- [ ] `panelClosed` 状态赋值行为不变（后续代码可能依赖它）
