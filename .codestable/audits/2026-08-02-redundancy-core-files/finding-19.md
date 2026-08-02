---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 19
severity: P2
confidence: medium
category: redundant-state
file: js/app.js
---

# Finding 19 — `initDouban` 幂等标志与 observer/disconnect 冗余状态

| 项 | 值 |
|---|---|
| 文件 | `js/app.js` |
| 行号 | 1947-1980 |
| 性质 | redundant-state |
| 严重度 | P2 |
| 置信度 | medium |
| 建议动作 | cs-refactor |

## 证据

```js
let doubanLoaded = false;
function initDouban() {
    if (doubanLoaded) return;
    doubanLoaded = true;
    if (typeof updateDoubanVisibility === 'function') {
        updateDoubanVisibility();
    }
}
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                initDouban();
                observer.disconnect();
            }
        });
    }, { rootMargin: '200px' });
    observer.observe(doubanArea);
}
setTimeout(() => { initDouban(); }, 2000);
```

## 为什么是冗余

- `observer.disconnect()` 已经保证 observer 回调触发一次后不再触发；2 秒 setTimeout 兜底才是可能重复调用的来源。
- 因此 `doubanLoaded` 标志主要用于防止"observer 已触发 + setTimeout 兜底"两者的重复，而非多 observer 实例。
- 更清晰的写法：observer 触发后 `clearTimeout(timer)` 取消兜底，即可去掉 `doubanLoaded` 标志；或仅保留 `doubanLoaded` 不在 observer 内 disconnect（语义等价但两者并存属多余防御）。
- 注意 `disconnect` 本身能防 observer 重复，但 observer 触发与 setTimeout 兜底两条路径之间仍需一处同步——所以**不是纯死代码**，只是两套机制并存。置信度 medium。

## 影响

- 净减一个标志位 + 一行 `disconnect` 或一行 `clearTimeout`，约 2-3 行；微清理。
- 风险：若误删 disconnect 而保留 setTimeout，observer 仍可能在滚动到视区时多次触发；若误删 setTimeout 取消会改兜底时序。改动需测试滚动 + 静态加载两种场景。

## 验证 checklist

- [ ] 滚动到豆瓣区域只触发一次 `updateDoubanVisibility`
- [ ] 不滚动仅等 2 秒兜底也能初始化豆瓣可见性
- [ ] 两者叠加不重复执行
