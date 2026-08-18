---
doc_type: feature-ff-note
feature: 2026-08-18-douban-hot-title
date: 2026-08-18
requirement:
tags: [home, douban, carousel, ui, title]
execution_lane: quick
---

## 做了什么
豆瓣热播轮播卡片常显影片名（封面底部渐变衬底）：片名叠在封面底部，用半透明渐变遮罩保证可读性。JS 卡片模板本已含 `.recent-watch-info`/`.recent-watch-title` 结构，仅需在 `css/index.css` 恢复视觉层（历史因"封面上叠色块"而 `display:none`，本次以渐变衬底方式重新启用，避开旧问题）。

## 改了哪些
- `css/index.css`：
  - `.recent-watch-info`：从 `display:none` 改为 `position:absolute; bottom:0; 左右贴边`，`background: linear-gradient(to top, rgba(0,0,0,0.85), transparent)` 渐变衬底，`z-index` 高于封面图
  - `.recent-watch-title`：`display:block`，白字居中、单行省略（`text-overflow: ellipsis`），小字号适配移动端
  - `.recent-watch-play`（播放徽章）：保持 `display:none` 不变（用户未要求）

## 怎么验证的
- `read_lints`（css/index.css）0 报错
- 浏览器手动验证待用户执行：首页轮播每张卡片底部常显片名、渐变衬底可读、长片名单行省略、移动端尺寸正常、中央放大卡片标题随卡片放大

## 设计要点（防回归）
- 渐变衬底（`to top` 上浅下深）只压暗封面底部，不遮挡封面主体，避免历史"整块深色面板盖封面"的视觉问题
- `.recent-watch-card` 已有 `overflow:hidden`，info 绝对定位被裁剪在卡片内，无需改卡片容器
- 片名仍从卡片 `aria-label`/`title` 读屏朗读，`.recent-watch-info` 保留 `aria-hidden="true"` 避免重复朗读
