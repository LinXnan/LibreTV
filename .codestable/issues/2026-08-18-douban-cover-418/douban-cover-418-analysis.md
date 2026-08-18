---
doc_type: issue-analysis
issue: 2026-08-18-douban-cover-418
status: confirmed
root_cause_type: config
related: [douban-cover-418-report.md]
tags: [proxy, douban, cover, referer, 418]
---

# 豆瓣热播轮播封面 418 根因分析

## 1. 问题定位

| 关键位置 | 说明 |
|---|---|
| `server.mjs:186-188` | Express 代理 axios 转发仅设 `User-Agent`，**不设 Referer** → 豆瓣图床收到无 Referer 请求 |
| `api/proxy/[...path].mjs:195` | Vercel 代理 `'Referer': requestHeaders['referer'] || new URL(targetUrl).origin` → 转发浏览器 `localhost` Referer 或图床自身 origin |
| `netlify/functions/proxy.mjs:178` | Netlify 同 Vercel 逻辑 |
| `functions/proxy/[[path]].js:285` | CF 同 Vercel 逻辑 |
| `js/douban.js:405` | API 请求显式 `'Referer': 'https://movie.douban.com/'` → API 成功（对照组） |
| `js/recent-watch.js:37-48` | 封面 URL 构造 `/proxy/...`，图片请求经代理转发 |

## 2. 失败路径还原

**正常路径**（API 数据）：`douban.js fetchDoubanData` → fetch 代理 URL → 代理请求 `movie.douban.com/j/search_subjects`，请求头带 `Referer: https://movie.douban.com/` → 豆瓣 API 校验通过 → 返回 JSON。

**失败路径**（封面图片）：浏览器 `<img src="/proxy/https%3A%2F%2Fimg3.dou...">` → Express 代理 `axios` 转发请求到 `img3.doubanio.com`，请求头只有 UA（`server.mjs:186-188`）**无 Referer** → 豆瓣图床防盗链校验失败 → 返回 **HTTP 418** → 代理原样转发 418 → 图片加载失败，显示占位符。

**分叉点**：`server.mjs:186-188`（以及 Vercel/Netlify/CF 的 `requestHeaders['referer']`）— 代理转发图片请求时，Referer 要么缺失、要么是浏览器页面 origin（`http://localhost:8080`）、要么是图床自身 origin（`https://img3.doubanio.com`），**均非豆瓣允许的 douban 域名** → 触发豆瓣图床防盗链 418。

## 3. 根因

**根因类型**：config（代理请求头配置缺失/错误）

**根因描述**：豆瓣图床（`img*.doubanio.com`）启用了防盗链校验，要求请求 `Referer` 为豆瓣域名（`https://movie.douban.com/` 等），否则返回 HTTP 418。本项目代理在转发图片请求时未携带正确的 douban Referer：Express 完全不转发 Referer；Vercel/Netlify/CF 转发浏览器 origin 或图床自身 origin。唯一成功路径是 `douban.js` 的 API 请求显式设置了 `Referer: https://movie.douban.com/`。因此所有经代理加载的豆瓣图床封面（新轮播 + 既有豆瓣推荐区）全部 418。

**是否有多个根因**：否（单一根因：代理转发豆瓣图片请求时 Referer 不符合防盗链要求）

## 4. 影响面

- **影响范围**：所有经 `/proxy/` 加载的豆瓣图床图片，包括：豆瓣热播轮播（本次改动）、豆瓣推荐区 doubanArea 封面（既有，`doubanEnabled` 启用时同样受影响）
- **潜在受害模块**：任何引用 `img*.doubanio.com` 封面且走代理的功能；未来新增豆瓣图片源同样受影响
- **数据完整性风险**：无（仅图片展示失败，不影响数据）
- **严重程度复核**：维持 **P1**。不只是本次新增轮播受影响，既有豆瓣推荐区封面同样 418（用户可能未启用该区所以此前未暴露）；且线上 3 个平台（Vercel/Netlify/CF）均存在，非仅本地

## 5. 修复方案

### 方案 A：代理层按目标 host 强制 douban Referer（4 平台同步）

- **做什么**：在 4 个平台代理（`server.mjs`、`api/proxy/[...path].mjs`、`netlify/functions/proxy.mjs`、`functions/proxy/[[path]].js`）转发请求时，若目标 host 是 `doubanio.com` / `douban.com` 域名，强制设置 `Referer: https://movie.douban.com/`；其他域名维持现状（Express 无 Referer、其余转发原 Referer/origin）
- **优点**：根治所有豆瓣图床图片（轮播 + 推荐区 + 未来豆瓣源）；host 条件限定不影响其他采集源图床；与 douban.js API 已验证行为一致
- **缺点 / 风险**：改 4 个平台代理文件，改动面较大；需按 AGENTS.md 同步规则逐平台验证语法
- **影响面**：仅代理层；非豆瓣域名请求零影响；豆瓣图片恢复正常

### 方案 B：前端封面直连豆瓣图床 + referrerpolicy

- **做什么**：`recent-watch.js` / `douban.js` 对豆瓣封面改为 `<img src="https://img3.doubanio.com/...">` 直连 + `referrerpolicy="no-referrer"`，不走 `/proxy/`
- **优点**：不动代理，改动小（仅前端 2 处）
- **缺点 / 风险**：**不确定有效**——豆瓣图床对无 Referer 请求是否放行需实测，若同样 418 则白改；绕过代理鉴权与图片缓存（LazyImageLoader 的 `/proxy/` 分支失效）；直连图片受浏览器混合内容/CSP 约束风险
- **影响面**：仅前端豆瓣封面，但存在方案失败风险

### 方案 C：Express 对齐"转发 Referer" + douban 特判

- **做什么**：先把 `server.mjs` 对齐 Vercel/Netlify/CF 的 `requestHeaders['referer'] || origin` 转发逻辑，再在 4 平台统一加 douban host 特判（即方案 A 的完整版）
- **优点**：行为统一
- **缺点 / 风险**：实质是方案 A + 额外对齐改动，风险更高；单独转发浏览器 Referer 不解决 418（`localhost` 仍非 douban 域名）
- **影响面**：同方案 A，但多一步 Express 行为变更

### 推荐方案

**推荐方案 A**，理由：根因最直接（代理转发豆瓣图片时补上防盗链要求的 douban Referer）；host 条件限定风险最小（非豆瓣图床零影响）；一次修复所有豆瓣图片路径（轮播 + 推荐区 + 未来源）；与 `douban.js` 已验证的成功路径行为一致。方案 B 因"无 Referer 是否被豆瓣接受"不确定而排除；方案 C 的额外 Express 对齐不必要。
