---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 16
severity: P2
confidence: high
category: duplicate-implementation
file: js/player.js
---

# Finding 16 — `isMobile` 正则字面量重复 2 处

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 1668、2193 |
| 性质 | duplicate-implementation |
| 严重度 | P2 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// player.js:1668 (setupLongPressSpeedControl)
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// player.js:2193 (showPlaybackRateMenu)
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
```

## 为什么是冗余

- 同一段 verbose UA 正则复制 2 处。若新增机型（如折叠屏 UA）或修正误判需改 2 处。
- 提为模块级常量：

```js
const IS_MOBILE_DEVICE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
```

注意 CLAUDE.md 响应式约定：UA 检测**仅用于交互模式（触摸 vs 鼠标）**判断，不用于布局——两处均为长按/倍速菜单交互模式分支，符合约定，可保留。

## 影响

- 微小：净减 1 行 + 消除分岔可能。
- 顺便补一条全局注意：全仓 `grep` 同款正则若在其它文件也出现，应一并提到模块级 / utils.js 统一。

## 验证 checklist

- [ ] 桌面端 / 移动端长按调速与倍速菜单交互分支不变
