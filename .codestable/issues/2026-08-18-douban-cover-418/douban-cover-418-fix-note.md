---
doc_type: issue-fix-note
issue: 2026-08-18-douban-cover-418
status: verified
verified: 2026-08-18
fix_plan_ref: douban-cover-418-analysis.md（方案 A，owner 已确认）
---

# 豆瓣热播轮播封面 418 修复记录

## 1. 修复摘要

- 根因：豆瓣图床（`img*.doubanio.com`）防盗链要求请求携带 douban 域名 `Referer`，否则返回 HTTP 418。4 个平台代理转发图片请求时 Referer 均不符合：Express 完全不转发；Vercel/Netlify/CF 转发浏览器 origin 或图床自身 origin。
- 方案：代理层新增 `getDoubanReferer(targetUrl)`：目标 hostname 以 `doubanio.com` / `douban.com` 结尾时强制 `Referer: https://movie.douban.com/`（与 `douban.js` API 已验证成功路径一致）；其他域名返回空串回退到原逻辑（Express 不设 Referer、其余转发原 Referer/origin），零影响。
- 涉及文件（按 AGENTS.md 四平台同步规则）：
  - `server.mjs`（Express，axios headers）
  - `api/proxy/[...path].mjs`（Vercel）
  - `netlify/functions/proxy.mjs`（Netlify）
  - `functions/proxy/[[path]].js`（CF）

## 2. 修复后行为

- 豆瓣图床图片经代理返回 200 正常加载（轮播 + 豆瓣推荐区 doubanArea 一并修复）
- 非豆瓣域名（其他采集源图床）行为与修复前完全一致

## 3. 验证记录

### 逻辑自测（node）
```
img3.doubanio.com -> true（命中）
movie.douban.com  -> true（命中）
example.com       -> false（不影响）
attacker.doubanio.com.evil.com -> false（endsWith 完整 hostname，伪造子域被拒）
```

### 端到端实测（本地 dev server，真实豆瓣图床 URL）
- 修复前：proxy 请求返回 418
- 修复后：`PROXY_STATUS=200 CONTENT_TYPE=image/jpeg LENGTH=23654`

### 影响面回归
- 非豆瓣域名：`getDoubanReferer` 返回 `''`，各平台回退到原 Referer 逻辑，行为不变

### 待用户浏览器验证
- 首页豆瓣热播轮播封面显示、电影/电视剧切换后新封面显示、豆瓣推荐区封面

## 4. Code Review 修复（2026-08-18，REV-001）

- REV-001（important）：`getDoubanReferer` 原用裸 `hostname.endsWith('doubanio.com') || endsWith('douban.com')`，会前向误判 `mydouban.com` / `notdouban.com` / `fake-doubanio.com` 等以 douban 结尾的第三方域名并为其注入豆瓣 Referer，违背"非豆瓣域名零影响"承诺。
  - 修复：改为 DNS label 精确匹配 `hostname === 'doubanio.com' || hostname === 'douban.com' || hostname.endsWith('.doubanio.com') || hostname.endsWith('.douban.com')`（前导点约束），4 平台逐字同步。
  - 验证：`mydouban.com`/`notdouban.com`/`fake-doubanio.com` → false；`img3.doubanio.com`/`movie.douban.com`/裸域/子域/大小写/端口 → true；`attacker.doubanio.com.evil.com` → false。4 文件 lint 0 报错。
- 未修：N-1 尾点 FQDN（`douban.com.`）漏判——实际豆瓣图床 URL 无尾点，理论边界，接受当前限制。

## 5. 顺手发现（不本次修复）

> 顺手发现：`server.mjs` 的 Express 代理与其他 3 平台 Referer 行为不一致（Express 不转发浏览器 Referer，其余转发）——既有差异，非本次 bug 根因，可后续统一。
