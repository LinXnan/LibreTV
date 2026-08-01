# LibreTV — AI Agent 入口

## 技术栈

- 纯静态前端：HTML5 + Vanilla JS (ES6+) + Tailwind CSS
- 播放器：ArtPlayer + HLS.js
- 后端代理：Express `server.mjs` / Vercel serverless / Netlify functions / CF Pages functions
- 无构建步骤，无框架，无 TypeScript，无数据库

## 文件结构速查

```
js/
├── config.js          # 常量：PROXY_URL, API_CONFIG, PASSWORD_CONFIG
├── customer_site.js   # 内置采集源 → 合并到 API_SITES
├── password.js        # 密码门禁
├── proxy-auth.js      # 代理鉴权加签
├── search.js          # 单源搜索（经代理）
├── api.js             # apiCache, /api/search, /api/detail
├── app.js             # 首页 SPA：搜索编排/详情/筛选分页/设置面板/导入导出
├── player.js          # 播放器：HLS 管理/广告过滤/连播/快捷键/资源切换（~3000行）
├── ui.js              # UI 辅助：历史面板/每日一言/设置面板样式
├── index-page.js      # 首页初始化
├── watch.js           # 到 player 的 query 桥接
├── douban.js          # 豆瓣推荐
├── utils.js           # debounce, ConcurrentPool, StorageManager
└── optimize-apply.js  # ArtPlayer 插件

css/
├── styles.css         # 全局基础样式 + 所有组件（含移动端 @media 块）
├── index.css          # 首页特定：搜索框/豆瓣/筛选/骨架屏/每日一言
├── player.css         # 播放器：播放器布局/选集弹框/Tab栏/加载动画
├── watch.css          # 重定向页面
├── modals.css         # 模态框和提示框
├── mobile-optimize.css # 跨页面移动端微调（字体/间距/网格/触摸/手势）
└── performance-optimize.css # 性能优化
```

> **注意**：`mobile-optimize.css` 已于 2026-08 重构精简（1975→929行），仅保留跨页面移动端工具样式。**新增组件样式禁止追加到此文件**——应放在对应页面 CSS 的 `@media` 块内。

## 命令

```bash
npm run dev     # 启动开发服务器 → http://localhost:8080
npm install     # 安装依赖（仅 express + node-fetch）
```

无构建，无测试命令。部署用 Vercel/Netlify/CF/Docker 按钮。

## 禁区

- **禁止引入构建工具**（webpack/vite/esbuild），项目无构建步骤
- **禁止引入 TypeScript**，保持 Vanilla JS
- **禁止引入框架**（React/Vue/Svelte），所有 UI 用原生 DOM + Tailwind
- **禁止向 git 提交 `.env`**，`PASSWORD` 是敏感环境变量
- **player.js 和 app.js 不再追加新功能**到文件末尾，新功能应拆到独立模块（审计 #6/#7 延后执行）
- **修改代理逻辑必须同步所有平台**：Vercel (`api/proxy/`)、Netlify (`netlify/functions/`)、CF (`functions/proxy/`)、Express (`server.mjs`) 四个实现路径
- **禁止创建独立的移动端 CSS 文件**：移动端样式通过 `@media (max-width: 640px)` 写在组件所在的主 CSS 文件中，不要新增 `mobile-*.css`

## 代码约定

- 前端通过 `PROXY_URL = '/proxy/'` 请求代理，不直连外部 API
- 代理需要 `auth`（SHA-256 密码哈希）+ `t`（时间戳）鉴权
- CSS 用 Tailwind utility class，避免自定义 CSS
- 增删 API 源通过设置面板或 `js/customer_site.js`
- 所有持久化状态在 `localStorage`，无服务端数据库

### 响应式设计（2026-08 重构沉淀）

**核心原则：单一 DOM + CSS 媒体查询，禁止 JS 层的 DOM 分岔。**

```javascript
// ❌ 禁止 — JS 根据屏幕宽度生成不同的 HTML 结构
const isMobile = window.innerWidth <= 640;
div.className = isMobile ? 'mobile-grid' : 'desktop-grid';
if (isMobile) { /* 完全不同的 DOM */ } else { /* 另一套 DOM */ }

// ✅ 正确 — JS 始终生成同一套 DOM，CSS 处理差异
div.className = 'responsive-grid';
```

```css
/* ✅ 移动优先的媒体查询 */
.responsive-grid { display: flex; flex-direction: column; }
@media (min-width: 641px) { .responsive-grid { display: grid; grid-template-columns: repeat(2, 1fr); } }
```

**细则**：
- `window.innerWidth` **只能用于行为逻辑**（面板动画方式、分页条数、手势激活），**不得用于 DOM 结构选择**
- 每个组件的移动端/桌面端样式放在**同一个 CSS 文件的相邻位置**，用 `@media` 分隔，不要拆到独立文件
- 媒体查询断点：`640px`（手机/桌面分界）、`768px`（平板/宽屏分界）
- 避免 `!important`——如果出现则说明选择器优先级或组织结构有问题
- `navigator.userAgent` 检测仅用于**交互模式**判断（触摸 vs 鼠标），不用于布局

## 文档索引

- 系统总览：`.codestable/architecture/system-overview.md`
- 代理网关：`.codestable/architecture/proxy-gateway.md`
- 播放管线：`.codestable/architecture/player-pipeline.md`
- 首页 SPA：`.codestable/architecture/frontend-app.md`
- 审计报告：`.codestable/audits/2026-08-01-core-subsystems/index.md`
- 经验沉淀：`.codestable/compound/`
- CodeStable 入口：`.codestable/attention.md`
