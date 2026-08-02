---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 08
severity: P1
confidence: high
category: duplicate-implementation
file: js/ui.js
---

# Finding 08 — `clearLocalStorage` 与 `showImportBox` 模态脚手架重复

| 项 | 值 |
|---|---|
| 文件 | `js/ui.js` |
| 行号 | 1142-1231（clearLocalStorage）、1234-1311（showImportBox） |
| 性质 | duplicate-implementation |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

两个函数各 ~80-90 行，遵循完全相同的模态框生命周期：

```js
// ui.js:1142-1178 (clearLocalStorage)
let modal = document.getElementById('messageBoxModal');
if (modal) { document.body.removeChild(modal); }
modal = document.createElement('div');
modal.id = 'messageBoxModal';
modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';
modal.innerHTML = `...`;
document.body.appendChild(modal);
document.getElementById('closeBoxModal').addEventListener('click', function (e) {
    e.stopPropagation();
    document.body.removeChild(modal);
});
modal.addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target === modal) { document.body.removeChild(modal); }
});

// ui.js:1234-1289 (showImportBox) — 同样 6 步，仅 modal.id 与 innerHTML 不同
//   1224-1230 与 1283-1288 两处关闭监听器逐字相同
```

## 为什么是冗余

- 六步模态脚手架（按 id 清旧实例 → 建 div → 同款 className → setHTML → append → 关闭按钮/遮罩关闭监听）逐字复制，仅 `modal.id` 与 `innerHTML` 内容不同。
- 关闭监听器（`closeBoxModal` 点击 + 遮罩点击）两处 copy-paste 完全相同。
- 抽一个工厂即可消除约 50 行重复：

```js
function createModal(id, contentHTML, options = {}) {
    let modal = document.getElementById(id);
    if (modal) document.body.removeChild(modal);
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';
    modal.innerHTML = contentHTML;
    document.body.appendChild(modal);
    const close = modal.querySelector('[data-close]') /* 或约定 close 按钮 id */;
    if (close) close.addEventListener('click', e => { e.stopPropagation(); document.body.removeChild(modal); });
    modal.addEventListener('click', e => { e.stopPropagation(); if (e.target === modal) document.body.removeChild(modal); });
    return modal;
}
```

**注意**：两个函数当前都用 `closeBoxModal` 作为关闭按钮 id，但 `clearLocalStorage` 的 modal id 是 `messageBoxModal`，`showImportBox` 是 `showImportBoxModal`——若两 modal 同时存在会因同 id 关闭按钮冲突。工厂应改为按 modal 内部查询关闭按钮。

## 影响

- 净减约 50 行；后续新增同类模态（导出、提示、二次确认）只需传 id+content。
- 顺带可统一关闭按钮 selector 约定，消除潜在 id 冲突。

## 验证 checklist

- [ ] 清空确认框与导入框各自能创建、关闭、遮罩点击关闭
- [ ] 两框不会因 id 冲突互相误关
- [ ] innerHTML 注入的按钮事件回调仍正常绑定
