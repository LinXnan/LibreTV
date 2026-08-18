---
doc_type: issue-review
issue: 2026-08-18-douban-cover-418
status: passed
reviewer: subagent
reviewed: 2026-08-18
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 未安装（where ocr 未找到）"
---

# douban-cover-418 代码审查报告（round 2）

## 1. Scope And Inputs

- Design: `.codestable/issues/2026-08-18-douban-cover-418/douban-cover-418-report.md`（confirmed）+ `douban-cover-418-analysis.md`（confirmed，方案 A）+ `douban-cover-418-fix-note.md`（verified）
- Checklist: none（issue 流程无 checklist）
- Evidence pack: none（非 goal/gate 模式）
- Gate results: none
- DoD results: none
- Implementation evidence: 对话实现（4 平台代理 `getDoubanReferer`）+ fix-note 验证记录
- Diff basis: `git status --short` → M 4 个代理文件（server.mjs / api/proxy/[...path].mjs / netlify/functions/proxy.mjs / functions/proxy/[[path]].js）+ M index.html、M js/recent-watch.js（baseline：上一轮 feature douban-hot-carousel 未提交改动，已单独审过）+ ?? 两个 .codestable 目录
- Review mode: re-review（round 2，I-1 修复后完整复审）
- Baseline dirty files: index.html、js/recent-watch.js（上一轮 feature 改动，非本 issue 归因）

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 I-1；round 2 确认修复，无新 blocking/important）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮环节 A findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/issues/2026-08-18-douban-cover-418/`（report + analysis + fix-note）
- 修改：4 个平台代理文件新增 `getDoubanReferer(targetUrl)`（DNS label 精确匹配，目标为豆瓣域名时强制 `Referer: https://movie.douban.com/`，其余回退原逻辑）
- 删除：none
- 未跟踪 / staged：`.codestable/issues/.../`（新目录）
- 风险热点：域名边界判断（前向误判 / 反向伪造 / 漏判）、四平台一致性（AGENTS.md 同步规则）、非豆瓣域名零影响

## 3. Adversarial Pass

- 假设的生产 bug：裸 `endsWith` 前向误判——第三方域名以 `douban.com`/`doubanio.com` 结尾时被强制注入豆瓣 Referer（round 1 确认属实并修复）
- 主动攻击过的反例：`mydouban.com` / `notdouban.com` / `fake-doubanio.com` / `attacker.doubanio.com.evil.com` / 大小写 / 端口 / 尾点 FQDN / 非法 URL
- 结果：I-1（important）round 1 发现并修复；round 2 确认彻底关闭；N-1 尾点维持 nit；R-1~R-4 维持 residual-risk

## 4. Findings

### blocking

none

### important

- [x] REV-001 `server.mjs`/`api/proxy/[...path].mjs`/`netlify/functions/proxy.mjs`/`functions/proxy/[[path]].js` `getDoubanReferer` 裸 `endsWith` 前向误判
  - Evidence: `mydouban.com`→true、`notdouban.com`→true、`fake-doubanio.com`→true（node 实测）
  - Impact: 以 douban 结尾的第三方域名被强制注入豆瓣 Referer，违背"非豆瓣域名零影响"
  - Fix: 改为 DNS label 精确匹配（`===` + `endsWith('.doubanio.com')` 等，前导点约束），4 平台逐字同步
  - 验证: `mydouban.com`/`notdouban.com`/`fake-doubanio.com`→false；`img3.doubanio.com`/`movie.douban.com`/裸域/子域/大小写/端口→true；`attacker.doubanio.com.evil.com`→false；4 文件 lint 0 报错

### nit

- N-1 尾点 FQDN（`douban.com.` hostname 带根尾点）漏判——实际豆瓣图床 URL 无尾点，理论边界，接受当前限制（round 1/2 均维持）

### suggestion

- S-1 `https://movie.douban.com/` 魔法字符串 4 平台重复，可定义文件级常量（round 1 提出，未要求本次采用）
- S-2 Express 与其他 3 平台非豆瓣 Referer 行为未统一（既有差异，fix-note 第 5 节"顺手发现"已记录）

### learning

- "按 DNS label 精确匹配（`===` + `endsWith('.suffix')`）"是识别域后缀的可靠范式，可覆盖正向命中、反向伪造拒绝、前向误判消除三个维度
- 各平台 Referer 回退语义正确：Vercel/Netlify `requestHeaders['referer']`（键小写）、CF `request.headers.get('Referer')`（大小写不敏感）、Express 条件展开

### praise

- 四平台 `getDoubanReferer` 逐字一致，符合 AGENTS.md 同步规则
- I-1 修复为外科式最小改动（仅 hostname 判断 4 行），未触碰鉴权/缓存/M3U8 路径
- 修复前已用端到端实测确认（proxy 真实豆瓣图床 URL 200 + image/jpeg + 23654B，修复前 418）

## 5. Test And QA Focus

- QA 必须重点复核：
  - 首页豆瓣热播轮播封面 + 豆瓣推荐区 doubanArea 封面均正常显示（HTTP 200，Network 无 418）
  - 电影/电视剧切换后新封面正常加载
  - 非豆瓣图床（其他采集源）经 `/proxy/` 行为与修复前一致（Express 无 Referer、其余转发原 Referer/origin）
  - 代理鉴权回归：带 auth+t 通过，缺参 401
- 建议新增测试：`getDoubanReferer` 单测（正向命中/前向拒绝/反向拒绝/大小写/端口/非法 URL）；四平台一致性断言
- 不能靠 review 完全确认：R-1 线上平台真实图床域名覆盖、R-2 豆瓣对 `https://movie.douban.com/` Referer 全子域放行、R-4 CF KV 缓存部署后即时生效

## 6. Residual Risk

- R-1 线上三平台真实图床域名是否全被 `doubanio.com`/`douban.com` 两后缀覆盖，需线上实测
- R-2 豆瓣图床对固定 `https://movie.douban.com/` Referer 是否全子域统一放行，无法静态确认
- R-3 真实采集源中是否存在以 douban 结尾的第三方图床域名（I-1 场景）——修复后已正确拒绝，风险消除，但运行时可观察
- R-4 CF KV 缓存：二进制封面不缓存，修复即时生效；曾缓存的文本型豆瓣响应在 TTL 内仍旧——风险低

## 7. Verdict

- Status: passed
- Next: issue fix 收尾提交（review passed，无 blocking；REV-001 已修复并关闭，REV-002~004 已在上轮完成，N-1/S-1/S-2 为可选或既有差异）

## 8. Focused Closure（无则写 none）

none
