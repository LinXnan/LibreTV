---
doc_type: audit-finding
audit: 2026-08-02-lightweight-resources
finding_id: "maintainability-05"
nature: maintainability
severity: P2
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 05：死 CSS 与不应部署的杂项文件

## 速答

`css/modals.css` 无任何 HTML 引用（死文件）；根目录 `nul`（Windows 垃圾文件）、`image/nomedia.psd`（设计源文件）、`browser_check.html`（一次性调试工具）不应随站点部署。

## 关键证据

- `css/modals.css` — 全项目 grep `modals.css` 无任何 HTML `<link>` 引用（4 个 HTML 只引 styles / index / player / watch / mobile-optimize / performance-optimize）
- 根目录 `nul` — git status 显示 untracked，Windows 重定向产生的垃圾文件
- `image/nomedia.psd` — PSD 源文件，非 web 资源
- `browser_check.html` — 标题"历史记录图片URL检查工具"，一次性调试页（`browser_check.html:18-19`），非产品页面，未被任何页面链接

## 影响

仓库体积冗余、部署包携带无关文件（psd / 调试页可能被爬虫收录或泄露内部工具），属卫生问题而非运行故障。

## 修复方向

删除 `css/modals.css`（确认无引用后）、根目录 `nul`、`image/nomedia.psd`、`browser_check.html`；若 browser_check 有留存价值移入 `tools/` 或本地保留。

## 建议动作

`cs-refactor`，因为这是死文件与杂项清理，行为等价。
