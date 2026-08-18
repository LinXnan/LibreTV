---
doc_type: issue-report
issue: 2026-08-18-douban-cover-418
status: confirmed
issue_path: standard
severity: P1
summary: 首页豆瓣热播轮播封面全部加载失败，Network 面板见 418 状态码
tags: [proxy, douban, cover, hot-carousel, 418]
---

# 豆瓣热播轮播封面 418 加载失败 Issue Report

## 1. 问题现象

打开首页 `http://localhost:8080`，搜索框下方出现「豆瓣热播」轮播区域，标题旁「电影/电视剧」切换按钮与左右切换按钮位置正常，但所有轮播卡片只有渐变背景占位符与图标，**封面图全部不显示**。DevTools Network 面板看到大量以 `https%3A%2F%2Fimg3.dou...`（即 `https://img3.douban...` 的 URL 编码形式）开头的请求，**全部状态码 418**，响应体大小 0.0 kB，类型标记为「其他」。

左侧「豆瓣热播」标题、切换按钮、左右按钮位置正常 → DOM 渲染正常，问题发生在图片加载阶段。

## 2. 复现步骤

1. 启动开发服务器 `npm run dev`
2. 浏览器打开 `http://localhost:8080`
3. 等待首页加载完毕，等待「豆瓣热播」轮播区域自动显示
4. 打开 DevTools Network 面板，过滤 `Img` 或查看所有请求
5. 观察到：每张轮播卡片都触发了一次 `/proxy/https%3A%2F%2Fimg3.dou...` 请求，全部返回 418；轮播卡片仅显示渐变占位符

复现频率：稳定（每次首页加载均复现，全部豆瓣图床封面 100% 失败）

## 3. 期望 vs 实际

**期望行为**：首页「豆瓣热播」轮播正常展示每张影片的封面图（与「豆瓣热门推荐」区域一致），切换电影/电视剧按钮后刷新列表并展示新封面。

**实际行为**：所有轮播卡片只有渐变占位符，无封面图。Network 面板显示 `/proxy/https%3A%2F%2Fimg3.dou...` 请求全部返回 HTTP 418。

## 4. 环境信息

- 涉及模块 / 功能：首页豆瓣热播轮播（`#recentWatchArea`），数据源 `movie.douban.com/j/search_subjects`，封面来自 `img\d.douban.com` / `doubanio.com` 图床
- 相关文件 / 函数：用户报告的改动为本日 cs-feat `2026-08-18-douban-hot-carousel`，涉及 `js/recent-watch.js` 与 `index.html`；代理路径涉及 `server.mjs` / `api/proxy/` / `netlify/functions/` / `functions/proxy/`（按 AGENTS.md 同步规则）
- 运行环境：本地 dev（`npm run dev` → http://localhost:8080）
- 其他上下文：截图显示浏览器自动展开 Network 面板；其他时间未观察到相同 418

## 5. 严重程度

**P1** — 核心 UI 功能（首页推荐区域封面）完全不可用，但用户可禁用「豆瓣推荐」区域绕过；本轮播作为首页首屏必经路径，影响首次访问体验。

## 备注

- 截图证据：Network 面板 `https%3A%2F%2Fimg3.dou...` 全部 418 状态码、0.0 kB 大小；左侧 UI 位置正常
- 用户消息原文："封面加载不出来"
- 418 是 HTTP "I'm a teapot" 状态码，豆瓣图床常用于拒绝未带正确 Referer 的请求；具体根因待阶段 2 analyze 阶段读代码确认
- 上一轮 cs-feat review 的 residual risk（R-2 代理鉴权在 CDN 部署下的加载）已部分命中，但本次复现于本地 dev server，问题更广