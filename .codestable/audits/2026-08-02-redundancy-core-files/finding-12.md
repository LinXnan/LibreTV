---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 12
severity: P1
confidence: high
category: duplicate-implementation
file: js/player.js
---

# Finding 12 — custom API `apiParams` 构建块重复 2 处

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 1880-1883 (testVideoSourceSpeed) 与 2113-2116 (switchToResource) |
| 性质 | duplicate-implementation |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// player.js:1880-1883 (testVideoSourceSpeed)
if (customApi.detail) {
    apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&customDetail=' + encodeURIComponent(customApi.detail) + '&source=custom';
} else {
    apiParams = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
}

// player.js:2113-2116 (switchToResource) — 逐字相同
```

## 为什么是冗余

- 完全相同的 5 行“根据 detail 是否存在拼接 customApi 参数”块在两函数复制。
- 两个函数还都同构了 timestamp / cacheBuster 生成（`const timestamp = new Date().getTime(); const cacheBuster = ...`），属于同一对自定义 API 调用的准备流程重复。
- 维护风险：代理端 custom 调用参数协议若调整（如新增 `customName`），需改 2 处。
- 抽一个 helper：

```js
function buildCustomApiParams(customApi) {
    const base = '&customApi=' + encodeURIComponent(customApi.url) + '&source=custom';
    return customApi.detail
        ? '&customDetail=' + encodeURIComponent(customApi.detail) + base
        : base;
}
```

## 影响

- 净减约 5 行；自定义 API 调用参数协议单点维护。
- 与 finding-14（`custom_N` 解析）属同一自定义 API 处理域，若同时重构可一并收入 `customApi` 相关工具区。

## 验证 checklist

- [ ] 测速与切源两条路径在带 / 不带 detail 时 apiParams 输出一致
- [ ] encodeURIComponent 编码行为不变
