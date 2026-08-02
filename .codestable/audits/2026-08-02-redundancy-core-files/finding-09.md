---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 09
severity: P1
confidence: high
category: duplicate-dom-pattern
file: js/app.js
---

# Finding 09 — 自定义 API 表单 reset 逻辑重复 4 处

| 项 | 值 |
|---|---|
| 文件 | `js/app.js` |
| 行号 | 347-351、358-365、440-448、484-487 |
| 性质 | duplicate-dom-pattern |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

同一套“清空 name/url/detail/isAdult + 隐藏表单”在 4 个函数里几乎逐字重复：

```js
// app.js:347-351 (updateCustomApi)
nameInput.value = '';
urlInput.value = '';
if (detailInput) detailInput.value = '';
if (isAdultInput) isAdultInput.checked = false;
document.getElementById('addCustomApiForm').classList.add('hidden');

// app.js:358-365 (cancelEditCustomApi) — 用 getElementById 重新取，结构同
// app.js:440-448 (cancelAddCustomApi) — 同
// app.js:484-487 (addCustomApi) — 同
```

## 为什么是冗余

- 4 个调用点处理同一张表单的 reset，差异仅是取到 DOM 引用的方式（局部变量 vs `getElementById`），核心 5 行动作一致。
- 维护风险：若表单新增一个字段（如“分类”输入），需改 4 处 reset，漏改会导致旧值残留。
- 抽 helper：

```js
function resetCustomApiForm() {
    document.getElementById('customApiName').value = '';
    document.getElementById('customApiUrl').value = '';
    const detail = document.getElementById('customApiDetail');
    if (detail) detail.value = '';
    const isAdult = document.getElementById('customApiIsAdult');
    if (isAdult) isAdult.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
}
```

## 与 finding-10 的关系

本 finding 是 **reset**，finding-10 是 **validate**，二者同属自定义 API 表单逻辑，建议在同一 `cs-refactor` 批次一并抽取 `resetCustomApiForm` + `validateCustomApiInput`。

## 影响

- 净减约 15 行；表单字段增减时单点维护。
- 注意：各调用点在 reset 前后还各有额外动作（如保存、toast），抽函数只替换 reset 那 5 行，不要连带顺手改控制流。

## 验证 checklist

- [ ] 新增/编辑/取消/删除自定义 API 后表单均被清空且隐藏
- [ ] 4 个原调用点在 reset 之后各自的后续动作仍执行
