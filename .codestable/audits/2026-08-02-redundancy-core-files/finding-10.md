---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 10
severity: P1
confidence: high
category: duplicate-implementation
file: js/app.js
---

# Finding 10 — 自定义 API 表单校验逻辑重复 2 处

| 项 | 值 |
|---|---|
| 文件 | `js/app.js` |
| 行号 | 324-340 (updateCustomApi) 与 452-470 (addCustomApi) |
| 性质 | duplicate-implementation |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// app.js:324-340 (updateCustomApi)
const name = nameInput.value.trim();
let url = urlInput.value.trim();
const detail = detailInput ? detailInput.value.trim() : '';
const isAdult = isAdultInput ? isAdultInput.checked : false;
if (!name || !url) {
    showToast('请输入API名称和链接', 'warning');
    return;
}
if (!/^https?:\/\/.+/.test(url)) {
    showToast('API链接格式不正确，需以http://或https://开头', 'warning');
    return;
}
if (url.endsWith('/')) url = url.slice(0, -1);

// app.js:452-470 (addCustomApi) — 同样 11 行校验
```

## 为什么是冗余

- 读字段 → 非空校验 → URL 协议校验 → 去尾斜杠，11 行完全相同。
- 抽 helper 后两边各退化为一次调用 + 拿到规范化后的 `{name, url, detail, isAdult}`：

```js
function readAndValidateCustomApiInput() {
    const name = document.getElementById('customApiName').value.trim();
    let url = document.getElementById('customApiUrl').value.trim();
    if (!name || !url) { showToast('请输入API名称和链接', 'warning'); return null; }
    if (!/^https?:\/\/.+/.test(url)) { showToast('API链接格式不正确，需以http://或https://开头', 'warning'); return null; }
    if (url.endsWith('/')) url = url.slice(0, -1);
    const detailInput = document.getElementById('customApiDetail');
    const isAdultInput = document.getElementById('customApiIsAdult');
    return {
        name, url,
        detail: detailInput ? detailInput.value.trim() : '',
        isAdult: isAdultInput ? isAdultInput.checked : false,
    };
}
// 调用: const input = readAndValidateCustomApiInput(); if (!input) return;
```

## 与 finding-09 的关系

同 finding-09 的批注：reset + validate 同属自定义 API 表单，建议同一 `cs-refactor` 批次处理。

## 影响

- 净减约 11 行；校验规则单点维护（如未来加“去重名”校验只改一处）。
- 注意调用点原有控制流（addCustomApi 在校验后 push，updateCustomApi 在校验后 findIndex 替换），抽函数后保持返回 null 即 return 的早退语义。

## 验证 checklist

- [ ] 空 name / 空 url / 非法协议 / 尾斜杠 四种边界在 add 与 update 两条路径表现一致
- [ ] 规范化后的 url 不带尾斜杠
