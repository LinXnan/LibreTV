---
doc_type: audit-finding
audit: 2026-08-01-core-subsystems
finding_id: "maintainability-06"
nature: maintainability
severity: P1
confidence: high
suggested_action: cs-refactor
status: open
---

# Finding 06：player.js 2971 行 49 函数单体文件

## 速答

`js/player.js` 把所有播放器逻辑集中在单一文件中：HLS 生命周期管理、广告过滤管道、自动连播、进度保存/恢复、键盘快捷键、播放速度管理、集选择面板、资源切换、源速测试、长按加速、控制锁定、嵌入式播放器关闭——没有任何模块边界。49 个顶层函数全在全局作用域。修改任何一个功能都必须翻阅前后数百行找到相关引用点。

## 关键证据

- 全文件 2971 行（`wc -l js/player.js` → 2971）
- 49 个顶层函数（`grep '^function ' player.js | wc -l` → 49）
- 具体关注点划分：
  - 核心播放管道（`initPlayer` + customType m3u8）：~650 行（lines 429-1076）
  - 广告过滤（`CustomHlsJsLoader` + `filterAdsFromM3U8`）：~120 行（lines 1079-1200）
  - 连播/进度/剧集（`playEpisode` + `renderEpisodes*` + `save*`）：~700 行
  - 资源切换（`testVideoSourceSpeed` + `switch*`）：~300 行
  - UI 控制（`show*Menu`、`toggle*`）：~500 行

## 影响

- **范围**：所有播放器改动（扩展、修复、UI 调整）
- **影响**：定位功能需全文搜索、修改一个函数可能影响距它 500 行以外的全局状态、新增播放特性会在文件末尾继续追加——文件会持续膨胀
- **严重度 P1**：不是功能性 bug，但它是当前改动播放器相关功能成本高的根因

## 修复方向

- 按关注点拆分为独立模块（建议 `player-core.js` + `player-ads.js` + `player-episodes.js` + `player-resources.js` + `player-shortcuts.js`）
- 用类封装全局状态（`currentHls`、`art`、`currentEpisodes` 等 11 个全局 let/var）
- 建议动作：`cs-refactor`
