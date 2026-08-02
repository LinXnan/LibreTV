---
doc_type: audit-index
date: 2026-08-02
slug: lightweight-resources
scope: 前端资源体积 + 死文件 + 多平台重复实现
dimensions: [performance, maintainability]
status: done
total_findings: 5
---

# lightweight-resources 审计报告

## 范围

| 项 | 值 |
|---|---|
| 审计对象 | `libs/`（4 个第三方库）、`css/`（7 个文件）、`js/`（21 个文件）、`image/`、根目录杂项（nul / browser_check.html / service-worker.js）、4 套代理实现（server.mjs / api/proxy / netlify/functions / functions/proxy）、4 套密码注入实现 |
| 维度 | performance（体积/加载）+ maintainability（死文件/重复实现）。**不做**代码行级冗余重构（用户已取消 redundancy-core-files，不重复该角度） |
| 触发 | 用户要求排查"项目代码是否还有可以轻量化一点的" |

## 总评

共发现 **5 条**：performance 1 条、maintainability 4 条；P1×3、P2×2。

前端体积最大的单一负担是 `libs/tailwindcss.min.js`——Tailwind Play CDN 运行时（约 300KB+ 浏览器端 JIT 编译器），每个页面都要下载并在运行时扫描 DOM 生成 CSS。其次是系统性重复：**4 套代理实现**（Express / Vercel / Netlify / CF，各数百行）和 **4 套密码注入实现**（server.mjs / middleware.js / inject-env.js / _middleware.js）逻辑几乎相同，属于典型的"多平台适配靠复制"。

死文件方面：`swipe-actions.js` / `undo-toast.js` / `daily-quote.js` 定义了全局对象却**未在任何 HTML 加载**（app.js 用 `typeof` 守卫兜底，相关 UI 功能实际未生效）；`css/modals.css` 无引用；根目录 `nul`（Windows 垃圾文件）、`image/nomedia.psd`（源文件）、`browser_check.html`（一次性调试工具）不应部署。

## 发现清单（交叉分类矩阵）

| # | 文件 | 标题 | 性质 | 严重度 | 置信度 | 建议动作 |
|---|---|---|---|---|---|---|
| 01 | libs/tailwindcss.min.js | Tailwind Play CDN 运行时（~300KB+ 每页加载，浏览器端 JIT） | performance | P1 | high | cs-refactor |
| 02 | server.mjs + api/proxy + netlify/functions + functions/proxy | 4 套代理实现重复（各数百行，含 SSRF/鉴权/超时逻辑） | maintainability | P1 | high | cs-refactor |
| 03 | server.mjs + middleware.js + netlify/edge-functions + functions/_middleware.js | 4 套密码注入实现重复 + sha256 三份实现 | maintainability | P1 | high | cs-refactor |
| 04 | js/swipe-actions.js, js/undo-toast.js, js/daily-quote.js | 3 个 JS 死文件：定义全局对象但未在任何 HTML 加载，功能实际失效 | maintainability | P1 | high | cs-refactor |
| 05 | css/modals.css, nul, image/nomedia.psd, browser_check.html | 死 CSS 与不应部署的杂项文件 | maintainability | P2 | high | cs-refactor |

**统计**：共 5 条 · P1×3 · P2×2 · 潜在可减体积约 300–400KB 前端加载 + 千行重复实现。

## 按维度分布

| 性质 | P0 | P1 | P2 | 合计 |
|---|---|---|---|---|
| performance | 0 | 1 | 0 | 1 |
| maintainability | 0 | 2 | 2 | 4 |
| **合计** | **0** | **3** | **2** | **5** |

## 下一步建议

- **P1（本迭代）**：#01 Tailwind 运行时替换（换成预编译 CSS 或减小体积）、#02/#03 多平台实现收口（至少把密码注入抽成共享逻辑）、#04 死 JS 三件套确认后删除
- **P2（有空再看）**：#05 杂项文件清理（nul / psd / 调试页 / 死 CSS）

用户选中某条后，按其建议动作在当前 run 加载 `cs-refactor` 并传递 finding 路径。
