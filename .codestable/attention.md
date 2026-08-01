# Attention

本文件是 CodeStable 技能启动必读的项目注意事项入口。所有 CodeStable 子技能开始工作前必须读取它。

## 报告语言

CodeStable 所有落盘产出的正文用**中文**：plan / design、plan review / design-review、code review、QA、验收、issue（report / analysis / fix-note）、refactor、roadmap、goal、沉淀（compound）等所有人读报告都用中文表达。机器状态（YAML / JSON / `state.yaml` / frontmatter 字段）保持机读格式不翻译。如需改默认语言，改这一节。

## 项目碎片知识

### 编译与构建

**无构建步骤**。项目是纯静态 HTML + Vanilla JS + Tailwind CSS CDN。修改 JS/CSS 后刷新浏览器即生效。

### 运行与本地起服务

```bash
npm install        # 安装 express + node-fetch
npm run dev        # 启动 → http://localhost:8080
```

`server.mjs` 负责：静态文件 + HTML 密码注入（`{{PASSWORD}}` → SHA-256） + `/proxy` 代理。`python -m http.server` 不可用（代理功能缺失）。

### 测试

无自动化测试。验证方式：本地 `npm run dev` 后浏览器访问 `http://localhost:8080`，手动测试搜索/播放/设置。

### 命令与脚本陷阱

- `node server.mjs` 等价于 `npm run dev`（端口 8080，`.env` 可改 `PORT`）
- 代理改动必须同步 4 个平台实现（Vercel `api/proxy/`、Netlify `netlify/functions/`、CF `functions/proxy/`、Express `server.mjs`）
- `.env` 包含 `PASSWORD` 明文，**禁止提交到 git**

### 路径与目录约定

- `js/` — 所有前端 JS（无模块加载，script 标签顺序即依赖顺序）
- `api/` — Vercel serverless 函数
- `netlify/functions/` — Netlify 函数
- `functions/` — Cloudflare Pages 函数
- `libs/` — 第三方库（ArtPlayer, HLS.js, Tailwind CDN 等）

### 环境变量与凭证

- `PASSWORD` — 必须设，服务端算 SHA-256 注入页面，前端与代理鉴权共用
- `PORT` — 仅本地 Express，默认 8080
- `BLOCKED_HOSTS` / `BLOCKED_IP_PREFIXES` — SSRF 黑名单（可选，有默认值）
- `DEBUG` — 代理调试日志开关

### 其他

- 无数据库，所有持久化在 `localStorage`
- `js/config.js` 是全局常量入口（PROXY_URL / API_CONFIG / PASSWORD_CONFIG）
- 架构文档：`.codestable/architecture/`
