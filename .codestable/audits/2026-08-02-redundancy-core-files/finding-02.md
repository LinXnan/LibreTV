---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 02
severity: P0
confidence: high
category: duplicate-implementation
file: 跨文件 (app.js / ui.js / api.js)
---

# Finding 02 — 密码守卫 6 行模板全仓库复制粘贴 8 处

| 项 | 值 |
|---|---|
| 文件 | `js/app.js`、`js/ui.js`、`js/api.js` |
| 行号 | app.js:717-728 / 954-958 / 1089-1093；ui.js:8-14 / 310-315 / 329-334 / 1015-1019；api.js:628-629 |
| 性质 | duplicate-implementation |
| 严重度 | P0 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

完全相同的 6 行密码守卫模板在 8 个位置逐字重复：

```js
if (window.isPasswordProtected && window.isPasswordVerified) {
    if (window.isPasswordProtected() && !window.isPasswordVerified()) {
        showPasswordModal && showPasswordModal();
        return;
    }
}
```

**8 处分布**：

| 文件 | 函数 | 行号 | 变体说明 |
|---|---|---|---|
| app.js | `search` | 717-728 | 多一层 `try/catch` + `ensurePasswordProtection()` 兜底 |
| app.js | `showDetails` | 954-958 | 纯模板 |
| app.js | `playVideo` | 1089-1093 | 纯模板 |
| ui.js | `toggleSettings` | 8-14 | 纯模板（且此处与 finding-01 的死代码相邻） |
| ui.js | `clearSearchHistory` | 310-315 | 纯模板 |
| ui.js | `toggleHistory` | 329-334 | 纯模板 |
| ui.js | `addToViewingHistory` | 1015-1019 | 纯模板 |
| api.js | （API 入口） | 628-629 | 模板（略简） |

## 为什么是冗余

- 同一段“全局存在性检查 + 实际状态检查 + 弹密码框 + return”逻辑重复 8 次，约 **48 行重复代码**。
- app.js `search` 的变体额外包了 `try/catch` 与 `ensurePasswordProtection()` 兜底，说明守卫语义已经出现**微小分岔**——这正是复制粘贴会演化的方向：未来若有人新增“成年人验证”或调整校验顺序，需要改 8 处，漏改概率极高（且 ui.js `toggleSettings` 那处还已是死代码，隐患更隐蔽）。
- 完全可以抽成单个集中函数：

```js
function requirePasswordOrPrompt() {
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return false; // 调用方: if (requirePasswordOrPrompt() === false) return;
        }
    }
    return true;
}
```

调用方由 6 行模板退化为 1 行判断。

## 修复方向（仅指出，不实施）

1. 新增集中守卫（建议放 `password.js` 或 `utils.js`），约定返回布尔（true=通过，false=已弹框需 return）。
2. 逐处替换 8 个调用点；app.js `search` 的 `try/catch` + `ensurePasswordProtection()` 兜底逻辑需单独保留（它语义更强），不要在抽函数时丢掉。
3. 顺手解决 finding-01 的 ui.js 死代码覆盖——它和此处的 ui.js:8-14 是同一个 `toggleSettings` 的两段失败逻辑。

## 影响

- 重复维护成本：单点修改需同步 8 处。
- 已发生一处隐性失效（finding-01），说明该模板的维护已经出错过一次而未被察觉。
- 抽象后 8×6≈48 行重复压成 8×1 行调用 + 1 个 ~8 行集中函数，净减约 30 行。

## 验证 checklist（修复时）

- [ ] 每个原调用点替换后，未登录态触发→应弹密码框且不继续执行
- [ ] 已登录态→应正常放行
- [ ] app.js `search` 的 try/catch 兜底行为保持不变
- [ ] finding-01 的 ui.js 覆盖段同步清理
