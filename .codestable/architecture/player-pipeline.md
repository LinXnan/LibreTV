---
doc_type: architecture
slug: player-pipeline
scope: 播放器管道：ArtPlayer + Hls.js 集成、M3U8 广告过滤、自动连播、进度恢复、资源切换与智能画质调整
summary: 基于前端 hls.js 加载与 ArtPlayer 渲染的播放器；DISCONTINUITY 广告检测、自定义 Loader 过滤、按网络自适应缓冲与降画质
status: current
last_reviewed: 2026-08-01
tags: [player, m3u8, ad-filter, hls, artplayer, autoplay, progress]
depends_on: [system-overview, proxy-gateway]
implements: []
---

## 0. 术语

- **ArtPlayer**：第三方 HTML5 播放器外壳，负责任意 UI 层（控件、全屏、快捷键骨架）（`player.js:506`）
- **Hls.js**：前端 HLS 客户端，接管 m3u8 加载、分片下载与自适应 ABR（`player.js:570`）
- **customType: m3u8**：ArtPlayer 注册的自定义视频类型，委托 hls.js 加载→Media 解码（`player.js:559-798`）
- **DISCONTINUITY 广告过滤**：检测 `#EXT-X-DISCONTINUITY` 前后 TS 序号异常跳跃，识别广告区间计数，同时在加载线拦截并移除标签行（`player.js:1103-1200`）
- **源切换 / 资源切换**：同影片在不同 vod 站点间切换（`player.js:2067-2265`）
- **智能画质降级**：缓冲区不足或连续卡顿≥3次时自动降 ABR 层级（`player.js:746-797`）

（`/proxy`、M3U8 改写定义见 [proxy-gateway](proxy-gateway.md) 第 0 节。）

## 1. 定位与受众

- **哪一块**：`player.html` 内加载的播放器内核（全部在 `js/player.js`）
- **谁读**：design 对接播放特性 / issue 排「广告没滤掉」「连播不停」/ 改播放器交互
- **读完能**：定位为何某行为只在特定网络或平台出现、知道广告过滤链路、知道切源与进度恢复机制

## 2. 结构与交互

### 2.1 分层

```
┌──────────────────────────────┐
│  player.html  UI shell       │  header / goBack / shortcuts hint / password modal
├──────────────────────────────┤
│  ArtPlayer renderer          │  controls / fullscreen / pip / event dispatch
├──────────────────────────────┤
│  customType: m3u8            │  Hls.js lifecycle: loadSource→attachMedia→parse→play
│  ├─ Hls config (adaptive)   │  按 NetworkInformation API 调 buffer
│  ├─ CustomHlsJsLoader       │  注入 filterAdsFromM3U8 到 manifest/level
│  └─ Error recovery          │  NETWORK → retry; MEDIA → recover
├──────────────────────────────┤
│  Video element + MediaSource │  hardware decode
└──────────────────────────────┘
```

不依赖后端播放服务——所有 m3u8 请求通过同源 `/proxy`（见 [proxy-gateway](proxy-gateway.md)），分片 URI 可能已被代理改写也可能直连。

### 2.2 初始化链路

1. `DOMContentLoaded` → 密码门禁（复用 `password.js`）（`player.js:99-113`）
2. `initializePageContent()` → URL 参数解析（`url`/`title`/`source`/`episodes`/`position`/`index`）（`player.js:124-310`）
   - 嵌套 `player.html?url=player.html?...` 历史链接展开（`player.js:136-168`）
   - `autoplayEnabled` / `adFilteringEnabled` 从 localStorage 读（`player.js:178-191`）
   - `currentEpisodes` 优先 URL，fallback localStorage（`player.js:194-228`）
3. `initPlayer(videoUrl)`（`player.js:429-1076`）
   - 销毁旧 ArtPlayer/Hls 实例
   - 根据 `navigator.connection.effectiveType` 生成 `hlsConfig`（`player.js:455-501`）
   - 若 `adFilteringEnabled` → `loader: CustomHlsJsLoader`（`player.js:471`）
   - `new Artplayer({ customType: { m3u8: ... } })`（`player.js:506-798`）
4. 加载完毕 → `video:loadedmetadata` 恢复进度 + 恢复播放速度 + 加入观看历史（`player.js:868-958`）

### 2.3 广告过滤管道

```
Hls.js fetch manifest/level
  → CustomHlsJsLoader.load() (player.js:1083-1097)
  → filterAdsFromM3U8(m3u8, true) (player.js:1103-1200)
     ├─ 统计：扫描全部 .ts 行，记录序号 + DISCONTINUITY 位置
     ├─ 判定：序号向前跳跃 + 有 DISCONTINUITY → 进入广告区间（累计 totalAdsFiltered）
     ├─ 判定：序号向后回跳 + 有 DISCONTINUITY → 退出广告区间
     └─ 过滤：遍历移除所有 #EXT-X-DISCONTINUITY 行
  → onSuccess(response) → Hls.js 继续解析
```

**不是替代服务端改写**——代理侧已声明 `FILTER_DISCONTINUITY=false`，广告过滤责任完全在前端。自定义 Loader 拦截 `type === 'manifest'` 或 `'level'` 的请求（`player.js:1085`），碎片的 ts 请求不走过滤。过滤后的 m3u8 缺少 discont 边界，播放器不感知广告插入点。

### 2.4 智能画质降级

由两个监听协同（`player.js:746-797`）：

1. `video:waiting` → `bufferStallCount++`；连续 ≥3 次且多码率 → `hls.currentLevel = currentLevel - 1`
2. `timeupdate` 缓冲健康检查：当前缓冲 < 5s → 预防性降级

要求 `hls.levels.length > 1`（否则无级可降）。每次降后重置计数。

### 2.5 自动连播

- `video:ended` → `videoHasEnded = true`（`player.js:1031-1047`）
- 条件：`autoplayEnabled && currentEpisodeIndex < currentEpisodes.length - 1`
- 延迟约 1 秒后调用 `playNextEpisode()`（`player.js:1388-1391`）
- 无下一集 → `art.fullscreen = false`（退出全屏）

### 2.6 资源 / 源切换

用户可在播放器内切换到同一影片在另一种 API 源下的流（`player.js:2067-2265`）：

1. `showSwitchResourceModal` → 展示选中源 + 自定义源
2. `testVideoSourceSpeed(sourceKey, vodId)` → HEAD 测试（5s 超时，`player.js:1960-2043`），返回延迟 ms
3. `switchToResource(sourceKey, vodId)` → 设 `isSwitchingVideo = true` → 用 `/api/detail` 拉 episodes → 更新 URL → 重建播放（`player.js:2186-2265`）

源切换本质上重新进入 initPlayer 流程。

### 2.7 进度保存与恢复

| 动作 | 机制 |
|---|---|
| 播放中 | `timeupdate` 节流（≥10s 间隔 + 位置偏移 >5s）→ `saveCurrentProgress()`（`player.js:275-310,1676-1741`） |
| 暂停 | `pause` → 立即保存（`player.js:299`） |
| 切后台 | `visibilitychange:hidden` → 保存（`player.js:268-271`） |
| 离开页面 | `beforeunload` → 保存（`player.js:265`） |
| 存储 key | `videoProgress_` + `getVideoId()`（`player.js:1869`） |
| 恢复 | `video:loadedmetadata` 时优先 URL `position` 参数，再 fallback localStorage（`player.js:871-898`） |

进度队列用 `progressQueue`（`Map<videoId, progressData>`）+ `flushProgressQueue`（`player.js:1673-1743`）合并连续写入。

### 2.8 历史/播放速度恢复

- 观看历史存 `localStorage.viewingHistory`，`saveToHistory()` 记录 title/source/showId/timestamp/playbackRate（`player.js:1503-1618`）
- 速度恢复优先历史条目中的 `playbackRate`，再 fallback 进度存储（`player.js:900-948`）
- 速度变更时 `video:ratechange` 实时回写历史（`player.js:981-1028`）

## 3. 数据与状态

| 状态 | 位置 | 所有权 | 说明 |
|---|---|---|---|
| `art` | 全局 `let` | `initPlayer` 写 | ArtPlayer 实例 |
| `currentHls` | 全局 `let` | customType m3u8 创建/销毁 | `Hls` 实例，切换视频时重建 |
| `currentEpisodes` / `currentEpisodeIndex` | 全局 `let` | `initializePageContent` 读/`playEpisode` 写 | URL query 优先，localStorage fallback |
| `autoplayEnabled` / `adFilteringEnabled` | 全局 `let` + `localStorage` | UI toggle + 初始化 | 持久开关 |
| `videoHasEnded` | 全局 `let` | `video:ended` 设 true / `initPlayer` 重置 false | 防重复连播分支 |
| `totalAdsFiltered` | 全局 `let`（同 session 累计） | `filterAdsFromM3U8` 写入 | 展示用计数器 |
| 播放进度 | `localStorage`（key 模式 `videoProgress_*`） | `saveCurrentProgress` 写 | position + duration + playbackRate |
| 观看历史 | `localStorage.viewingHistory` | `saveToHistory` 写 | Array，每项含 title/sourceName/showIdentifier/timestamp/playbackRate |
| 源速测结果 | 内存（不持久） | `testVideoSourceSpeed` 返回 | 仅展示模态窗内 |
| 自定义播放速度 | ArtPlayer `playbackRate` + 进度/历史回写 | `setPlaybackRate` / `ratechange` | 0.5x–3x，每影片独立 |
| 进度队列 | 内存 `Map`（`progressQueue`）+ 500ms 批量写 | `flushProgressQueue` | 合并同 id 多次写入 |

## 4. 关键决策

无已落档 ADR/decision。观察项：

- 广告过滤只移 `#EXT-X-DISCONTINUITY` 行而非有选择地删片段——如果有在段落中插入不连续标记的合法编码场景会被误伤
- 智能降级依赖 `navigator.connection.effectiveType`（Chrome only），其他浏览器退化为 4g 默认参数
- 源切换本质是全量重建播放器而非复用 Hls 实例，切换延迟较高

`TODO: 广告过滤策略是否需要可配置白名单片段、切源是否应 lazy 加载到 ArtPlayer.switch — cs-decide`

## 5. 代码锚点

| 入口 | 说明 |
|---|---|
| `player.html:61-78` | header UI（logo + 标题 + 上一页） |
| `player.html:99-113` | 密码门禁入口 |
| `js/player.js:1-94` | 全局状态变量 |
| `js/player.js:124-310` | `initializePageContent`——URL 解析、开关、episodes、键盘绑定 |
| `js/player.js:429-501` | `initPlayer`——`getAdaptiveHlsConfig`、网络感知 buffer |
| `js/player.js:506-798` | ArtPlayer 创建 + customType m3u8 闭包（Hls 生命周期、进度条、错误恢复、画质降级） |
| `js/player.js:1079-1099` | `CustomHlsJsLoader`——拦截 manifest/level，注入广告过滤 |
| `js/player.js:1103-1200` | `filterAdsFromM3U8`——DISCONTINUITY + TS 序号异常检测 |
| `js/player.js:1031-1047` | `video:ended` 自动连播触发 |
| `js/player.js:1311-1378` | `playEpisode`——集切换全流程 |
| `js/player.js:868-958` | `video:loadedmetadata`——进度恢复 + 速度恢复 + 历史 |
| `js/player.js:1676-1743` | 进度队列保存 |
| `js/player.js:1503-1618` | `saveToHistory` |
| `js/player.js:1960-2043` | `testVideoSourceSpeed`——源速测（HEAD + 5s 超时） |
| `js/player.js:2067-2265` | `showSwitchResourceModal`/`switchToResource` |
| `js/player.js:1745-1859` | `setupLongPressSpeedControl`——移动端长按三倍速 |
| `js/player.js:314-389` | 键盘快捷键（方向/空格/f） |

## 6. 已知约束 / 边界情况

- **零集影片**：`currentEpisodes.length === 0` 时上一页/下一页按钮禁稿、连播不触发
- **嵌套历史链接**：`player.html?url=player.html?...` 由 init 展开（`player.js:136-168`），非通用递归——仅解一层
- **`art.switch` vs `initPlayer`**：Webkit 必须重建 player（`player.js:1362-1365`，因 HLS 在某些 Webkit 版本不支持 attach/detach），非 Webkit 用 `art.switch` 更快
- **进度恢复阈值**：position 必须 >10s 且 < duration-2s 才恢复，避免片头/片尾跳转（`player.js:875,888`）
- **错误恢复上限**：NETWORK retry 3 次（递增延迟 500/1000/1500ms），MEDIA recover 3 次，bufferAppend 默认不 fatal（`player.js:582-584,673-734`）
- **广告过滤开关**：`adFilteringEnabled=false` 时不启用 CustomHlsJsLoader（`player.js:471`），且统计面板隐藏
- **智能降级依赖**：`navigator.connection` 仅为 Chrome/Edge，Safari/Firefox 使用 `4g` 默认值（`player.js:456-466`）
- **播放速度**：仅 0.5x–3x 范围有效，超出不恢复（`player.js:941`）
- **无 DRM / EME 集成**——Hls.js 加载 raw m3u8/ts

## 7. 相关文档

- 依赖：[system-overview](system-overview.md)（播放器入口 + 密码门禁）、[proxy-gateway](proxy-gateway.md)（m3u8 改写与代理契约）
- 需求/ADR：无
