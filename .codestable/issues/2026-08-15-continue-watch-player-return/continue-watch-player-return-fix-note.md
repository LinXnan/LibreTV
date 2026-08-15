---
doc_type: issue-fix-note
issue: 2026-08-15-continue-watch-player-return
status: complete
issue_path: fast-track
severity: P3
fixed: 2026-08-15
verification: Passed
---

# 从播放页返回首页仍弹继续观看 Fix Note

## 根因

`js/continue-watch.js` 的 `showIfNeeded()` 在首页加载时无条件检查观看历史并弹出「继续观看」弹窗，不区分用户是「直接访问首页」还是「从播放页点 logo 返回」。`player.html` 的 `#homeButton` 点击跳回首页时（iframe `closeVideoPlayer(true)` 或独立页 `window.location.href = '/'` 两条路径），未做任何"来源"标记。

## 修复方案（快速通道，已批准）

1. **`player.html`**（`#homeButton` 点击处理，约 261 行起）：在两条跳转路径之前设置 `sessionStorage.setItem('skipContinueWatchPrompt', '1')` 标记（带 try/catch 兜底）。
2. **`js/continue-watch.js`**（`showIfNeeded()` 开头）：检查 `sessionStorage.getItem('skipContinueWatchPrompt') === '1'`，存在则 `removeItem` 并直接 return（本次不弹）。

标记**用后即删**：仅拦截"刚离开播放器返回首页"这一次；刷新首页或直接访问首页不受影响，仍正常弹窗。

## 验证清单

- [x] **复现步骤验证**：播放页点 logo 回首页 → 标记被设置 → `showIfNeeded` 读取后清除并 return，不再弹窗（代码路径推演 + 冒烟确认两处标记代码均生效）
- [x] **期望行为验证**：从播放页返回首页不弹窗；直接访问首页（无标记）仍正常弹窗（`showIfNeeded` 其余逻辑未动）
- [x] **影响面回归**：
  - 首页直接访问：标记不存在 → 跳过检查，正常走 isEnabled/userDismissed/免责声明排队等原逻辑 ✓
  - 刷新首页：标记已删除 → 正常弹窗 ✓
  - iframe 嵌入场景：sessionStorage 同源共享，父页面可读标记 ✓
  - 密码/免责声明排队逻辑：未改动 ✓
  - `node --check` 语法通过、lint 0 诊断 ✓
- [x] **浏览器验证**：冒烟确认 `player.html` 含 `skipContinueWatchPrompt` 设置、`continue-watch.js` 含检查逻辑（STATUS 均 200）
- [x] 相关测试：无自动化测试覆盖此区域

## 变更文件

- `player.html`（+7）：homeButton 分支设置 sessionStorage 标记
- `js/continue-watch.js`（+7）：showIfNeeded 消费标记
- `.codestable/issues/2026-08-15-continue-watch-player-return/`：report（confirmed）+ approval-report（approved）+ 本 fix-note

## review-fix（round 2）

- `js/continue-watch.js` — 标记消费的 `getItem`/`removeItem` 包 try/catch（与 player.html setItem 兜底对称），防止 sessionStorage 受限环境（隐私模式/旧浏览器）下 `showIfNeeded` 最前端抛错导致整体中断（REV-001，important）

## 顺手发现

> 顺手发现：`player.js:48-50` `goBack`（播放页「上一页」）在无 referrer 时 `window.location.href='/'` 回首页，未设置 `skipContinueWatchPrompt` 标记 → 从播放页点「上一页」回首页仍弹继续观看。不在本次 issue 范围（用户问题限定 #homeButton/logo），可后续另开 issue。
> 顺手发现：密码部署下 `passwordVerified` 重放仍弹（REV-002），已接受为 residual-risk 交 QA；默认部署不受影响。
