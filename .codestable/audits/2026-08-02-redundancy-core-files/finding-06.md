---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 06
severity: P1
confidence: high
category: dead-code
file: js/player.js
---

# Finding 06 — `startProgressSaveInterval` 及配套变量死代码

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 1569-1577（函数体）+ 1240-1243（无效 guard）+ 93（模块变量） |
| 性质 | dead-code |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// player.js:1569-1577
function startProgressSaveInterval() {
    // 清除可能存在的旧计时器
    if (progressSaveInterval) {
        clearInterval(progressSaveInterval);
    }
    // 每30秒保存一次播放进度
    progressSaveInterval = setInterval(saveCurrentProgress, 30000);
}
```

`startProgressSaveInterval` 在全文件**从未被调用**。唯一的引用痕迹是注释掉的旧调用：

```js
// player.js:886 附近
// startProgressSaveInterval(); // 已移除，使用更高效的节流方式
```

进度保存已改由节流方案（`saveCurrentProgress` / `flushProgressQueue`，约 1580-1649 行）承担，但旧的 interval 函数 + 模块级变量 `progressSaveInterval`（line 93）被遗留。

更隐蔽的是 `playEpisode` 里的无效 guard：

```js
// player.js:1240-1243
if (progressSaveInterval) {
    clearInterval(progressSaveInterval);
}
```

由于 `startProgressSaveInterval` 永不调用，`progressSaveInterval` 永远为 `null`，此 guard 永远走 false 分支——也是死代码。

## 为什么是冗余

- 旧函数 8 行 + 注释调用 + 模块变量声明 + 无效 guard 共约 12 行死代码。
- 留着会误导后续维护者以为进度保存仍可能走 interval 路径，干扰对当前节流方案的理解。
- 移除后保留 `saveCurrentProgress` / `flushProgressQueue` 即可。

## 修复方向

1. 删除 `startProgressSaveInterval` 函数体（1569-1577）。
2. 删除模块级变量 `progressSaveInterval`（line 93）。
3. 删除 `playEpisode` 里的无效 guard（1240-1243）。
4. 清理注释掉的旧调用行。

**注意**：删除模块变量前再 grep 一次全局，确认无其它隐藏引用。

## 影响

- 净减约 12 行死代码；进度保存路径单一化，降低认知负担。

## 验证 checklist

- [ ] 删除后 grep `startProgressSaveInterval` / `progressSaveInterval` 全仓为空
- [ ] 播放进度仍由节流方案正常保存（暂停 / 切集 / 关页时落盘）
