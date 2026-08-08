# 顶部 fixed 提示必须纵向避让固定 header，不能靠 z-index

## 背景

2026-08-08 统一全系统通知为「顶部居中」（feature `unify-toast-position`）。把 `.position-restore-hint` 从底部改到顶部 `top:16px` 后，独立 code review 发现它被播放页固定 header 完全遮挡：`.player-header` 的 z-index 达 `2147483647 !important`（int 上限），`.player-header-fixed` 也是 `z-index:9000 !important` 且背景不透明 `#111`、高约 78px。`top:16px` 落在 header 覆盖区内 → 用户完全看不到提示，属净回归。

## 结论

1. **顶部 fixed 提示的 z-index 无法盖过本项目固定 header**：header 已用 `2147483647 !important`（int 上限），任何同栈元素靠 z-index 都压不过。正确做法是**纵向避让**：`top` 下移到 header 高度之下（如 `top: calc(88px + 16px)`，88px 是 `.container.mx-auto` 的 margin-top 佐证的 header 高度，实际约 78px 留有裕量）。
2. **判断 header 高度的可靠方式**：找页面里"贴合 header 的内容区上边距"（本项目是 `.container.mx-auto { margin-top: 88px }`），它就是作者认定的 header 高度；再核对 header 结构（padding + 内容行高）确认不会超出。
3. **移动端刘海屏 safe-area 要与 header 高度叠加**：`top: max(calc(88px + 16px), calc(88px + env(safe-area-inset-top) + 16px))`，不能只写 `1rem`，否则修好 header 遮挡后又被刘海遮挡。
4. **把「上移到顶部」当成一次可见性回归风险**：底部元素上移后，顶部固定层（header / 菜单 / 通知条）都可能遮挡它，review 时优先攻击这一点。

## 证据

- `css/player.css:16-30` — `.player-header { z-index:2147483647 !important }`、`.player-header-fixed { position:fixed !important; top:0; z-index:9000 !important; background:#111 }`
- `css/player.css:11-12` — `.container.mx-auto { margin-top:88px }`（header 高度佐证）
- `css/player.css:202` — 修复后 `top: calc(88px + 16px)`；`player.html:65` header `p-4` + 两行内容实际约 78px
- `.codestable/features/2026-08-08-unify-toast-position/unify-toast-position-review.md` — REV-001（blocking，header 遮挡）与 round 2 复审通过记录
