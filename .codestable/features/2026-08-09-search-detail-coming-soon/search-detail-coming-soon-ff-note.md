---
doc_type: feature-ff-note
feature: search-detail-coming-soon
date: 2026-08-09
requirement:
tags: [search, detail, ui, modal, coming-soon, hero]
---

## 做了什么

把搜索后点击影片展示的详情弹窗改造成预告 / Coming-Soon 风格卡片：上半幅海报背景（cover + 上下渐变 mask），左下角浮出大字标题与来源副标题，右上角源名称首字角标；下半部分横向胶囊标签、简介段落与红色 CTA「立即观看第 1 集」；底部继续保留 episode grid 选集与"倒序 / 复制链接"工具栏，核心搜索→选集交互不变。

## 改了哪些

- `index.html` — `#modal` 内层 div 加类名 `modal-card relative ...`、抽出 modal-close-btn 到绝对定位右上角（原 modalTitle 与顶部标题行折掉）、`#modalTitle` 改为 `sr-only` 仅供屏幕阅读器；`#modalContent` 内层预先清空占位
- `js/app.js:1119-1240` — `showDetails` 内 modalContent 渲染完全重写为「hero + meta + episodes」三段：
  - hero：背景 `linear-gradient + url(vod_pic)`，渐变 mask，左下浮标题/副标题，右上源名首字角标
  - meta：胶囊标签（年份/类型/地区/class 或备注）、简介段落、CTA 按钮（点击 `playVideo` 第 1 集）；移动端 flex 调整
  - episodes：原 `倒序 / 复制链接` 工具栏 + `#episodesGrid` 选集 grid
  - modalTitle 改为 `textContent`（它现在是 sr-only，避免原 innerHTML 拼接带来的 XSS 风险）
- `css/styles.css:1063-1214` — 新增 `#modal .modal-card / .detail-hero / .shade / .source-badge / .title-wrap / .meta / .tags / .tag / .desc / .cta / .foot / .episodes / .center` 及 `≤640px` 响应式断点；不修改 `#modal > div` 旧 background 渐变（仅在 `.modal-card` 上覆盖为 `#0d0d0d !important` + `#2a2a2a !important` 边框 + 加深阴影）

## 兼容性 / 契约

- `#modalContent` 入参、id、滚动行为保持不变（`mobile-optimize.css:64-108`、`performance-optimize.css:81-187` 的旧选择器继续命中）
- `closeModal()`、`modalContent.innerHTML = ''` 关闭逻辑零改动
- `closeVideoPlayer` / `search() / resetSearchArea()` 隐藏 / 显示 modal 的逻辑零改动（仍按 `modal.classList.add/remove('hidden')` 工作）
- `playVideo`、`copyLinks`、`toggleEpisodeOrder`、`renderEpisodes` 入参不变；CTA 按钮仅复用 `playVideo` 第 1 集
- `window.currentVodPic` 写入逻辑保留，背景海报直接复用它

## 安全

- 所有用户可控字符串（视频名、来源名、年份/类型/地区/class/备注、描述、id、sourceCode）都过 `escapeHtml`
- HTML 属性拼接（`onclick` / `title`）单引号场景再过 `attrEsc`（`'&' < > " '` 全转实体），避免含 `'` 的字段破坏属性边界
- `descriptionRaw` 先 `replace(/<[^>]+>/g, '')` 清 HTML 再 escape，旧行为一致
- 海报 `url` 走 `/proxy/...` 与 ui.js 历史封面代理一致，仅允许 http/https 或 `//`（协议相对）或 `/` 同源路径；其它值兜底为空字符串（hero 退化为纯色背景，不裂图）

## 怎么验证的

- `node --check js/app.js js/ui.js js/search.js` 全部 OK
- `node server.mjs`（端口 8788）启动后 `GET /` 返回 200，HTML 内容含 `modal-card / modal-close-btn / sr-only`，CSS/JS 路径无 404
- Select-String 验证三文件 patch 落盘：
  - `index.html`: `modal-card`×1、`modal-close-btn`×1、`sr-only`×2
  - `js/app.js`: `detail-hero`×9、`detail-cta`×2、`attrEsc`×4、`detail-hero-source-mark`×1
  - `css/styles.css`: `detail-hero`×9、`detail-cta`×3、`detail-hero-source-mark`×1、`modal-card`×1、`detail-episodes`×2
- 浏览器视觉验证（待用户执行）：
  1. 搜索影片 → 点击搜索结果卡 → 弹窗打开
  2. 视觉：上半幅海报 + 渐变 + 左下大标题 + 右上角蓝色源角标 + 关闭按钮
  3. 移动端（≤640px）：hero 保持 16/9、左下大标题自适应字号；标签与描述紧凑
  4. 「立即观看第 1 集」红色 CTA 点击 → 跳转播放页
  5. 底部 episode grid 仍可选集；「倒序 / 复制链接」仍可用
  6. 点 ✕ 关闭 → 弹窗消失
  7. 含 `'` 或 `<>` 的标题 / 来源名不破属性边界（手测输入 `Te<script>alert(1)</script>'s title` 应被 escapeHtml 兜住）
  8. 海报为空（`vod_pic` 为空）→ hero 退化为纯 `#1a1a1a` 背景，不裂图

## 迭代 7（2026-08-09，用户反馈"把立即观看第一集按钮去掉"）

移除 meta 区的红色 CTA「立即观看第 1 集」按钮：`js/app.js` 删除 `firstEpisodeUrl`/`safeFirstUrl` 变量与按钮 HTML 块；`css/styles.css` 删除 `.detail-cta`、`.detail-cta:hover`、`.detail-cta-icon` 三条样式。`detail-foot`（仅供测试）保留。`node --check` 通过，全库 `detail-cta/firstEpisodeUrl/safeFirstUrl` 0 残留。

## 迭代 6（2026-08-09，用户反馈"打开时周围不要一片黑"）

弹窗外层遮罩从 `bg-black/95`（95% 不透明纯黑）改为 `background-color: rgba(0,0,0,0.55) !important` + `backdrop-filter: blur(8px) saturate(1.1)`。背景页面柔和模糊透出，避免"一片黑"的死板观感，与参考图里 Netflix/Disney+ 弹窗风格一致。`!important` 覆盖 `<div id="modal" class="... bg-black/95 ...">` 的 Tailwind 背景色。

## 迭代 5（2026-08-09，用户改方案："直接采用封面作为背景，高斯模糊显示"）

彻底改背景策略：hero 由「contain 完整小图居中」改为「封面 cover 铺满 + 高斯模糊背景」（主流流媒体详情页做法）：
- `.detail-hero`：去掉 flex 居中，恢复 `position: relative`，高度桌面 180px / 移动 130px，`#1a1a1a` 作为加载失败或无封面占位底色
- `.detail-hero-bg`：`position: absolute; inset: 0; object-fit: cover; filter: blur(24px) saturate(1.1); transform: scale(1.15)`——模糊掩盖封面低分辨率导致的失真，scale 防模糊边缘露边
- `.detail-hero-shade` 叠加层调轻（0.05/0.45/0.95 → 0.10/0.30/0.82），让模糊背景色彩透出，底部仍保证标题可读
- 标题字号回调 `clamp(1.3rem, 3vw, 1.8rem)`、副标题 `0.85rem`，成为前景主角
- 优点：竖版/横版海报都铺满、不受原始分辨率拉伸失真影响、无需 contain 留黑边

## 迭代 4（2026-08-09，用户反馈"还是太大"）

hero 继续压小：桌面 `height: 220px → 130px`、移动端 `≤640px 160px → 100px`；标题字号 `clamp(1.6rem,4vw,2.25rem) → clamp(1.1rem,2.5vw,1.6rem)`、副标题 `0.95rem → 0.8rem`、无封面占位字 `4rem → 2.5rem`，与缩小后的 hero 协调。hero 现约占弹窗 16%（桌面）。

## 迭代 3（2026-08-09，用户反馈"还是显示的有点大，而且有点模糊失真"）

第二轮收紧到 `21/9` + `max-height: 240` 仍不够：modal ~850px 宽下 height 被 `max-height` 卡死成 ~240px，实际比例 ≈ 3.5:1，`object-fit: cover` 把竖版（2:3）海报横向拉伸人脸铺满，产生严重放大失真。

治本改固定高度 + flex 居中 + `object-fit: contain`：
- `aspect-ratio` + `max-height` 移除，hero 改为 `height: 220px`（移动端 `≤640px` 160px）+ `display: flex; align-items: center; justify-content: center`
- `.detail-hero-bg` 由 `position: absolute + object-fit: cover` 改为 `max-width: 100%; max-height: 100%; object-fit: contain`，海报按原始比例居中显示，竖版海报完整呈现两侧以 `#1a1a1a` 填充，不再放大失真
- 加 `image-rendering: high-quality` 显式声明高质量采样
- 视觉上：hero 占弹窗约 25%、海报完整可辨、不再糊

## 迭代 2（2026-08-09，用户反馈"背景封面显示的比例有点大了"）

`detail-hero` 比例从 `aspect-ratio: 16/9; max-height: 360px` 收紧到 `aspect-ratio: 21/9; max-height: 240px; min-height: 140px`，并加 `flex-shrink: 0` 防 modalContent 收缩时塌陷。竖版海报被 21/9 cover 后人物脸不再撑满 hero 区，hero 占弹窗整体从约 45% 降到约 28%。移动端沿用同一组参数，必要时后续再单独压。

## 迭代 1（2026-08-09，用户反馈"没有显示封面图片"）

问题根因：首版把 hero 封面写成 `background-image: url('/proxy/...')`，而 `server.mjs` 的 `/proxy/` 强制校验 `auth`+`t` 鉴权参数（401）。项目内所有封面（历史卡片、最近观看）都走 `img.lazy-load[data-src]` 由 `LazyImageLoader` 自动补鉴权 + 缓存 + 失败降级，CSS 背景图不经过该链路，导致 401 → 封面不显示。

修复：
- `js/app.js` — hero 改为 `<img class="detail-hero-bg lazy-load" data-src="${backdropUrl}">`，交给 `optimize-apply.js` 的 MutationObserver 自动 observe（LazyImageLoader 补鉴权、加载失败 `handleLoadError` 隐藏 img 露出 `#1a1a1a` 占位底）；无封面时显示 `.detail-hero-empty-mark`（源名首字半透明大字，避免空白）
- `css/styles.css` — `.detail-hero` 去掉 background-size/position 仅留 `background-color: #1a1a1a` 作占位；删 `.detail-hero-fallback`，新增 `.detail-hero-bg`（absolute 铺满 + object-fit: cover）与 `.detail-hero-empty-mark`（居中半透明大字）
- 验证：`node --check js/app.js` OK、`node server.mjs` 首页 200
- 浏览器确认（待用户）：搜索点开影片 → hero 显示封面；无封面影片显示首字占位；加载失败的封面自动降级纯色底

## 已识别的非本任务范围（不动）

- `renderEpisodes()` 内把 `vodName` 直接拼到 onclick 属性，未转义单引号；属既有 XSS 面，**不在本次范围**，待下次独立加固
- 旧 `#modal .modal-detail-info / .detail-grid / .detail-item / .detail-label / .detail-value / .detail-desc` 等类仍残留在 `styles.css` 与 `performance-optimize.css`，本轮未删除（无元素使用，作为历史样式可清理），独立重构时一并移除
- 未引入 SCSS / Tailwind 自定义类，新样式为纯 CSS 以匹配既有结构
