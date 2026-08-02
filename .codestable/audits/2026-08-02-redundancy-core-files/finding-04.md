---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 04
severity: P1
confidence: high
category: duplicate-implementation
file: js/app.js
---

# Finding 04 — banned 关键词数组与过滤逻辑逐字重复 2 处

| 项 | 值 |
|---|---|
| 文件 | `js/app.js` |
| 行号 | 690-694 与 862-866 |
| 性质 | duplicate-implementation |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

两处完全相同的 18 元素 banned 关键词数组 + 相同过滤逻辑：

```js
// app.js:690-694 (renderCachedResults)
const banned = ['伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑', '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码', '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频', '福利片'];
const filtered = results.filter(r =>
    !banned.some(k => (r.vod_name || '').includes(k))
);

// app.js:862-866 (search)
const banned = ['伦理片', '福利', '里番动漫', '门事件', '萝莉少女', '制服诱惑', '国产传媒', 'cosplay', '黑丝诱惑', '无码', '日本无码', '有码', '日本有码', 'SWAG', '网红主播', '色情片', '同性片', '福利视频', '福利片'];
const filtered = results.filter(r =>
    !banned.some(k => (r.vod_name || '').includes(k))
);
```

## 为什么是冗余

- 18 个关键词的字面量数组 + filter 谓词**逐字复制**，7 行逻辑完全相同。
- 维护风险：新增/删除敏感词需改 2 处，漏改会导致缓存结果与实时搜索结果过滤不一致（一处过滤一处不过滤）。
- 建议抽成模块级常量 + 单个过滤函数：

```js
const BANNED_KEYWORDS = ['伦理片', ...];   // 模块级 const，唯一定义
function filterBanned(results) {
    return results.filter(r => !BANNED_KEYWORDS.some(k => (r.vod_name || '').includes(k)));
}
```

调用处各退化为 `const filtered = filterBanned(results);`。

## 影响

- 净减约 7 行重复 + 消除分岔维护风险。
- 若未来要把 banned 列表做成可配置（设置面板），单点更易迁移。

## 验证 checklist

- [ ] 抽函数后两处过滤行为一致
- [ ] 含敏感词的结果仍被过滤掉
- [ ] 无误伤（正常影视名不被过滤）
