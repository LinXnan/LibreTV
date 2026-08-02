---
doc_type: audit-index
audit: 2026-08-01-core-subsystems
scope: proxy 网关层 + player 播放管道 + frontend-app 首页 SPA + server.mjs（~8000 行可执行代码）
created: 2026-08-01
status: cancelled
total_findings: 11
---

# core-subsystems 审计报告

## 范围

`js/player.js`(2971 行)、`js/app.js`(2004 行)、`js/ui.js`(1401 行)、`server.mjs`(259 行)、`api/proxy/[...path].mjs`(497 行)、`functions/proxy/[[path]].js`(623 行)、`netlify/functions/proxy.mjs`(327 行)、`js/proxy-auth.js`(127 行)、`js/optimize-apply.js`(162 行)。跳过 libs/、css/、node_modules/。

## 总评

共发现 **11 条**问题：安全 2 条、bug 3 条、可维护性 4 条、性能 2 条。其中 P0 一条（密码哈希泄露到日志）、P1 七条、P2 三条。最值得关注的三条：**server.mjs 日志暴露完整密码哈希**（P0/安全）、**Vercel/Netlify 二进制内容全量 text() 导致损坏**（P1/bug，但 CF 已修而另两个平台未同步修复）、**player.js 2971 行单体亟待拆分**（P1/可维护性，是目前改播放器改不动的主要原因）。

整体代码质量属个人项目常见模式：逻辑全集中在少数超长文件里、多平台适配靠复制、安全基线在不同部署目标上不对称。这些问题（除了日志泄露需立刻修）不是生产级威胁，但在持续迭代中会增加改动成本、拉高复现差异类 bug 的概率。

## 发现清单

| # | 性质 | 严重度 | 置信度 | 标题 | 文件 |
|---|---|---|---|---|---|
| 1 | security | P0 | high | server.mjs 日志暴露完整 PASSWORD 哈希 | [finding-01.md](finding-01.md) |
| 2 | security | P1 | high | SSRF 防护不对称: Express 有黑名单,Vercel/Netlify/CF 无 | [finding-02.md](finding-02.md) |
| 3 | bug | P1 | high | CF proxy 死代码: validateAuth 被调用两次,第二次无 await | [finding-03.md](finding-03.md) |
| 4 | bug | P1 | medium | Vercel/Netlify 代理对二进制内容使用 response.text() 导致损坏 | [finding-04.md](finding-04.md) |
| 5 | bug | P1 | medium | 搜索按钮无防抖,可被快速重复触发 | [finding-05.md](finding-05.md) |
| 6 | maintainability | P1 | high | player.js 2971 行 49 函数单体文件 | [finding-06.md](finding-06.md) |
| 7 | maintainability | P1 | high | app.js 2004 行 56 函数混合 5 种不同关注点 | [finding-07.md](finding-07.md) |
| 8 | maintainability | P2 | medium | Vercel proxy ≈ Netlify proxy 约 400 行重复代码 | [finding-08.md](finding-08.md) |
| 9 | maintainability | P2 | medium | 多处空 catch 块无声吞异常 | [finding-09.md](finding-09.md) |
| 10 | performance | P1 | high | Vercel/Netlify 代理全量缓冲响应为文本 | [finding-10.md](finding-10.md) |
| 11 | performance | P2 | medium | 搜索结果不缓存,每次重新拉所有源 | [finding-11.md](finding-11.md) |

## 按维度分布

| 性质 | P0 | P1 | P2 | 合计 |
|---|---|---|---|---|
| security | 1 | 1 | 0 | 2 |
| bug | 0 | 3 | 0 | 3 |
| maintainability | 0 | 2 | 2 | 4 |
| performance | 0 | 1 | 1 | 2 |
| **合计** | **1** | **7** | **3** | **11** |

## 下一步建议

- **P0 立刻修**：#1 删除 server.mjs:138 日志行（或改为仅输出 last 4 字符校验比对失败），一次提交
- **P1 本迭代修**：#2 #3 #4 #5 #6 #7 #10 — 其中 #4/#10 共享同一根因（代理文本/二进制分支缺失）, #6/#7 需拆分文件
- **P2 有空再看**：#8 #9 #11 — 重构类,不以当前稳定性为交换
