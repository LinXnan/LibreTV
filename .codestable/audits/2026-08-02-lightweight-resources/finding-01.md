---
doc_type: audit-finding
audit: 2026-08-02-lightweight-resources
finding_id: "performance-01"
nature: performance
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 01：Tailwind Play CDN 运行时每页加载，前端最大体积负担

## 速答

`libs/tailwindcss.min.js` 是 Tailwind Play CDN 的浏览器端运行时（JIT 编译器，约 300KB+），`index.html` / `player.html` / `about.html` 每页都加载，浏览器下载后在运行时扫描 DOM 生成 CSS——体积大、解析开销高，是前端最值得轻量化的一点。

## 关键证据

- `libs/tailwindcss.min.js` — 完整 Tailwind v3 运行时（含全部 theme 配置、postcss 解析器、JIT 引擎，压缩后 ~300KB）
- `index.html:551` — `<script src="libs/tailwindcss.min.js" defer></script>`
- `player.html:37` — `<script src="libs/tailwindcss.min.js" defer></script>`
- `about.html:7` — `<script src="libs/tailwindcss.min.js"></script>`
- `index.html:22-76` — 为防 FOUC 已内联大量关键 Tailwind 类的手写 CSS（`.flex` / `.hidden` / `.rounded-lg` / `.bg-[\#222]` 等），说明样式依赖面其实很窄

## 影响

每个页面多下载 ~300KB 未压缩代码并在主线程跑 JIT 编译，移动端首屏明显变慢。项目实际用到的 Tailwind 类有限（约几十个），换预编译 CSS（Tailwind CLI 或手工子集）可把体积降到个位数 KB。

## 修复方向

用 Tailwind CLI 构建预编译 CSS（content 指向 `*.html`/`*.js` 扫描类名），替换运行时 CDN；或把现有内联样式补全后直接移除 Tailwind 依赖。

## 建议动作

`cs-refactor`，因为这是体积/加载优化，行为等价（最终渲染样式不变），符合重构语义。
