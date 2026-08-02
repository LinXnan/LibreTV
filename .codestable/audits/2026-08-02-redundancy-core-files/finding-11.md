---
doc_type: audit-finding
date: 2026-08-02
slug: redundancy-core-files
finding: 11
severity: P1
confidence: high
category: duplicate-dom-pattern
file: js/player.js
---

# Finding 11 — episode 按钮 HTML 模板重复（inline + modal）

| 项 | 值 |
|---|---|
| 文件 | `js/player.js` |
| 行号 | 1211-1217 (renderEpisodes) 与 2748-2752 (renderEpisodesForTab) |
| 性质 | duplicate-dom-pattern |
| 严重度 | P1 |
| 置信度 | high |
| 建议动作 | cs-refactor |

## 证据

```js
// player.js:1211-1217 (renderEpisodes)
html += `
    <button id="episode-${realIndex}" 
            onclick="playEpisode(${realIndex})" 
            class="px-4 py-2 ${isActive ? 'episode-active' : '!bg-[#222] hover:!bg-[#333] hover:!shadow-none'} !border ${isActive ? '!border-blue-500' : '!border-[#333]'} rounded-lg transition-colors text-center episode-btn">
        ${realIndex + 1}
    </button>
`;

// player.js:2748-2752 (renderEpisodesForTab)
html += `
    <button onclick="playEpisodeFromModal(${realIndex})"
            class="px-4 py-2 ${isActive ? 'episode-active' : '!bg-[#222] hover:!bg-[#333]'} !border ${isActive ? '!border-blue-500' : '!border-[#333]'} rounded-lg transition-colors text-center">
        ${realIndex + 1}
    </button>
`;
```

## 为什么是冗余

- 两处生成集数按钮，className 几乎相同，仅三处差异：(a) onclick（`playEpisode` vs `playEpisodeFromModal`）；(b) 是否有 `id="episode-N"`；(c) 桌面版多一个 `hover:!shadow-none` 与 `episode-btn` 类。
- 风险：集数按钮样式需要调整（如颜色、hover）时需改 2 处；两处 className 已经出现微妙分岔（modal 版缺 `!shadow-none` / `episode-btn`），说明已经各自改过。
- 抽 helper：

```js
function episodeButtonHTML(realIndex, isActive, { onClick, withId, extraClass }) {
    const idAttr = withId ? `id="episode-${realIndex}"` : '';
    return `
    <button ${idAttr} onclick="${onClick}(${realIndex})"
        class="px-4 py-2 ${isActive ? 'episode-active' : '!bg-[#222] hover:!bg-[#333]'} !border ${isActive ? '!border-blue-500' : '!border-[#333]'} rounded-lg transition-colors text-center ${extraClass || ''}">
        ${realIndex + 1}
    </button>`;
}
```

## 影响

- 净减约 6 行 + 消除 className 分岔；集数按钮样式单点维护。
- 注意：两处视焦点 / hover 视觉差异需在抽函数时显式以参数表达，不要静默合并掉 modal 版缺的类——否则会改变 modal 集数按钮的视觉。

## 验证 checklist

- [ ] 两个集数列表（主播放页 inline 与弹框 modal）按钮样式与 active 态一致
- [ ] hover 行为在两处符合原文中各自定义（modal 无 `!shadow-none` 的差异是否为有意）
- [ ] onclick 调用方向正确（主列表 `playEpisode`，弹框 `playEpisodeFromModal`）
