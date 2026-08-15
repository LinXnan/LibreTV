---
doc_type: feature-ff-note
feature: rebrand-openplay
date: 2026-08-15
requirement:
tags: [branding, rename, logo, quick]
---

## 做了什么

将全站品牌从 LibreTV 更名为 OpenPlay：替换 4 个 HTML 页面、4 个 JS 文件的标题/文案，更新 manifest.json、README、Dockerfile、CSS 注释、LICENSE、AGENTS.md，并生成新的 OpenPlay 品牌 logo 覆盖 `image/logo.png` / `image/logo-black.png`（路径不变，引用无需改动）。

## 改了哪些

- `image/logo.png` / `image/logo-black.png` — AI 生成的 OpenPlay 品牌 logo（青→紫渐变 + 播放三角），覆盖原图；删除无引用的 `image/nomedia.png`
- `index.html` — title/meta/header h1/免责声明/JSON-LD name 改为 OpenPlay；slogan 改为"欢迎来到观影净土"
- `player.html` — title/header h1 改为 OpenPlay
- `watch.html` — 跳转页 logo-text 改为 OpenPlay
- `about.html` — title/header/简介/隐私政策/免责声明 改为 OpenPlay（GitHub 仓库链接保留）
- `js/player.js` / `js/index-page.js` / `js/douban.js` / `js/app.js` — document.title 与 history 标题拼接改为 OpenPlay
- `manifest.json` — name/short_name 改为 OpenPlay
- `README.md` — 品牌文字同步，logo alt 与 slogan 同步更新；`Dockerfile` / `LICENSE` / `AGENTS.md` / 3 个 CSS 文件头注释 — 品牌文字同步

## 怎么验证的

- 全仓 grep 确认用户可见品牌文案均已是 OpenPlay
- `js/app.js` 中 `LibreTV-Settings` 协议字段保留（导入导出兼容）
- 部署标识保留：GitHub 仓库链接、`bestzwei/libretv` 镜像名、`libretv.is-an.org` 域名、npm 包名、`LIBRETV_PROXY_KV` 环境变量
- IDE lint 通过（js 4 文件 0 错误）；本地 `npm run dev` 刷新首页/播放页/关于页目视检查标题与 logo

## 顺手发现（可选，不阻塞）

- `libretv.is-an.org` 部署域名未变，若同步换域名需在 `index.html` JSON-LD、`README.md` 及 DNS 处一起改
- logo 为 AI 生成图，非透明 PNG；favicon 小尺寸显示效果需实际部署确认
