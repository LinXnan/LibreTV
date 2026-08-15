---
doc_type: approval-report
issue: 2026-08-15-continue-watch-player-return
approvals:
  issue-fast-path:
    status: approved # pending | approved | rejected
    ref: approval-report.md#issue-fast-path
    decided_by: owner
    decided_at: "2026-08-15"
---

# Approval Report

## 待决决策：issue-fast-path（是否走快速通道直接修复）

### 根因（已读代码确认）

`js/continue-watch.js` 的 `showIfNeeded()` 在首页加载时无条件检查观看历史并弹出「继续观看」弹窗，不区分用户是「直接访问首页」还是「从播放页点 logo 返回」。播放页 `player.html`（约 255-289 行）`#homeButton` 点击跳回首页时，未做任何"来源"标记，因此返回后必然触发弹窗。

### 修复方案（2 处，小范围）

1. **`player.html`**（`#homeButton` 点击处理，约 261 行起）：在两条跳转路径（iframe `closeVideoPlayer(true)` / 独立 `window.location.href = '/'`）之前，设置 `sessionStorage.setItem('skipContinueWatchPrompt', '1')` 标记。
2. **`js/continue-watch.js`**（`showIfNeeded()` 开头）：检查 `sessionStorage.getItem('skipContinueWatchPrompt') === '1'`，存在则 `removeItem` 并直接 return（本次不弹）。

### 影响与风险

- 低风险：标记用后即删（`removeItem`），仅拦截"刚离开播放器返回首页"这一次；刷新首页或直接访问首页不受影响，仍正常弹窗
- `sessionStorage` 同源共享，iframe 场景（播放页嵌在首页）父页面同样可读，两条路径均覆盖
- 无跨模块架构影响，不改变弹窗既有行为（默认开启、密码/免责声明排队逻辑不变）

### 决策

- 批准（approve）：跳过 analysis，进入 fix 阶段直接修复
- 拒绝（reject）：走标准路径，先做根因分析再修复
- 修改（revise）：反馈修订意见
