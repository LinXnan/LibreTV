---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 03
severity: P1
confidence: high
category: overlaps-utils
file: js/app.js / js/player.js / js/ui.js
---

# Finding 03 — StorageManager 形同虚设，46+ 处裸用 localStorage

| 项 | 值 |
|---|---|
| 文件 | `js/app.js`、`js/player.js`、`js/ui.js`（对照 `js/utils.js`） |
| 行号 | 见证据表 |
| 性质 | overlaps-utils |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

`js/utils.js:55-166` 定义了完整的 `StorageManager`：防抖写入、内存缓存、配额超限自动清理、`saveWithRetry`。`js/utils.js:476` 全局实例化：

```js
window.storageManager = new StorageManager(1000);
```

`grep` 跨文件统计（`localStorage.setItem` 计数）：

| 文件 | 裸 `setItem` 次数 | 是否使用 `storageManager` |
|---|---|---|
| js/app.js | 23 | 否 |
| js/player.js | 15 | 否 |
| js/ui.js | 8 | 否 |
| js/utils.js | 7 | （StorageManager 内部） |
| js/optimize-apply.js | 0 | 是（唯一使用者） |

裸调用示例（每个都伴随手写 `JSON.stringify` / `JSON.parse`）：

```js
// app.js:2
let selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '["tyyszy","dyttzy","bfzy","ruyi"]');

// app.js:343
localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

// ui.js:219 / 300 / 760 / 910 / 1093
localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
localStorage.setItem('viewingHistory', JSON.stringify(newHistory));
// ... 等

// player.js 15 处裸 setItem 同理
```

## 为什么是冗余

- 项目已造好 `StorageManager`，具备 **防抖写入 / 内存读缓存 / 配额超限自动清历史 / 写失败重试** 四项能力，但 3 个核心前端文件 **46 处** localStorage 访问全部绕过它，手写 `JSON.parse`/`JSON.stringify` + 无缓存 + 无配额保护。
- 后果：
  1. **无防抖**：高频写入场景（如播放进度保存）直写磁盘，丢性能。
  2. **无配额保护**：`QuotaExceededError` 直接抛出未处理，而 `StorageManager.saveWithRetry` 已实现“超限自动清历史再重试”。
  3. **重复模板**：46 处各自手写 `JSON.parse(x || '[]')` 的 try/catch fallback 模板（见 finding-13 的 ui.js 子集）。
- `optimize-apply.js` 是唯一正确使用 `storageManager` 的先例，证明接口可用。

## 修复方向（仅指出，不实施）

按值/风险分批接入，**不要一把梭**：

1. **低风险先手**：`ui.js` 的 `viewingHistory` / `SEARCH_HISTORY_KEY` 读改用 `storageManager.getItem`（带缓存）；写若无需立即落盘可改 `setItem`（防抖），需立即落盘用 `setItemImmediate`。
2. **中风险**：`app.js` 的 `customAPIs` / `selectedAPIs` / 设置面板导入导出——这些是结构化配置，读多写少，接缓存收益明显。
3. **需谨慎**：`player.js` 的播放进度保存——此处对“立即落盘”敏感（防丢进度），应一律用 `setItemImmediate` 而非防抖 `setItem`，避免标签页关闭丢进度。
4. 接入后移除手写 `JSON.parse`/`JSON.stringify` 包装，统一走 `storageManager`。

**注意**：接入 StorageManager 会改变写入时序（防抖延迟），任何依赖“写入后下一行即读到新值”的代码需改用 `setItemImmediate` 或直接读内存缓存。需逐处确认。

## 影响

- 收益：净减 ~46 处手写模板（约 60–100 行），统一配额保护，热点写路径性能提升。
- 风险：写入时序语义变化，需逐处核对“立即 vs 防抖”。这是本批次改动面最广的一处，建议单独成一个 `cs-refactor` 批次。

## 验证 checklist（修复时）

- [ ] 浏览器 DevTools Application → localStorage，确认 key 值在写入后生效
- [ ] 模拟配额超限（填满 localStorage）触发写入，确认不再抛未捕获异常
- [ ] 播放进度场景：关闭标签页前后进度一致（用 `setItemImmediate`，不用防抖）
- [ ] 设置面板导入导出：导入后立即读取能拿到新值
