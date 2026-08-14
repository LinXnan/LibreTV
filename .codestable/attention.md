# Attention

本文件是 CodeStable 技能启动必读的项目注意事项入口。所有 CodeStable 子技能开始工作前必须读取它。

> **分工约定**：稳定约定（技术栈 / 文件结构 / 命令 / 禁区 / 代码约定）见根目录 `AGENTS.md`，本文件只记录易变运行细节与陷阱。两边信息冲突时以 AGENTS.md 为准。

## 报告语言

CodeStable 所有落盘产出的正文用**中文**：plan / design、plan review / design-review、code review、QA、验收、issue（report / analysis / fix-note）、refactor、roadmap、goal、沉淀（compound）等所有人读报告都用中文表达。机器状态（YAML / JSON / `state.yaml` / frontmatter 字段）保持机读格式不翻译。如需改默认语言，改这一节。

## 运行与验证

- 启动命令见 AGENTS.md 命令节：`npm install` → `npm run dev` → http://localhost:8080
- `node server.mjs` 等价于 `npm start`；端口由 `.env` 的 `PORT` 控制，默认 8080
- `python -m http.server` **不可用**——`server.mjs` 的 `/proxy` 代理功能会缺失
- 修改 JS/CSS 后刷新浏览器即生效（无构建步骤）
- 无自动化测试。验证方式：本地起服务后浏览器手动测试搜索/播放/设置

## 路径与目录陷阱

- `js/` 无模块加载，script 标签顺序即依赖顺序
- `js/password-inject.js` 和 `js/sha256.js` 是 **ES module**，仅供服务端 import（Vercel/Netlify/CF 中间件），不进页面 `<script>` 列表；页面用的 SHA-256 是 `libs/sha256.min.js`
- 完整目录速查见 AGENTS.md 文件结构节

## 环境变量与凭证

- `PASSWORD` — 必须设，服务端算 SHA-256 注入页面，前端与代理鉴权共用
- `PORT` — 仅本地 Express，默认 8080
- `BLOCKED_HOSTS` / `BLOCKED_IP_PREFIXES` — SSRF 黑名单（可选，有默认值）
- `DEBUG` — 代理调试日志开关
- `.env` 含 `PASSWORD` 明文，**禁止提交 git**（见 AGENTS.md 禁区）

## 其他

- 无数据库，所有持久化在 `localStorage`
- `js/config.js` 是全局常量入口（PROXY_URL / API_CONFIG / PASSWORD_CONFIG）
- 架构文档：`.codestable/architecture/`

## 项目碎片知识

<!-- cs-note managed: 用 cs-note 维护，新条目按下面分节追加 -->

### 编译与构建

### 运行与本地起服务

### 测试

### 命令与脚本陷阱

- 本会话执行环境 execute_command 无法解析带空格的 pwsh 路径（如 `C:\Program Files\...`），`node`/`git`/`npm` 命令会报 `'C:\Program' 不是内部或外部命令`；语法验证用 IDE 语言服务 read_lints 替代

### 路径与目录约定

### 环境变量与凭证

### 其他
