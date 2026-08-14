# 异步 fire-and-forget 加载函数禁止"兜底再调用"：会与在途请求并发覆盖分页

## 背景

LibreTV 播放页资源列表由 `js/player.js` 的 `loadVideo` 在页面加载时**无条件**调用 `loadResourceSwitchList()`（`player.js:314`）启动，桌面/移动皆如此（密码门禁路径由 `passwordVerified` 事件触发 `initializePageContent` 后同样启动）。该函数是**异步 fire-and-forget**：调用即返回，加载完成前 `resourcePageCtx` 保持 `null`。

移动端"选集/视频源 Tab"改造时，初版设计写了一个"兜底调用"：`activate('resources')` 时若 `resourcePageCtx === null` 则再调一次 `loadResourceSwitchList()`，理由是"资源尚未加载"。独立 code review 指出这是 blocking：首次请求仍在途时（弱网/慢 3G），用户快速点"视频源"Tab 会触发第二次请求，两次请求竞争同一组全局状态（`resourceResults` / `resourcePageCtx` / `resourcePage`），后完成的覆盖先完成的 → 分页归零、渲染错乱、多余网络请求。

## 结论

1. **fire-and-forget 异步加载函数（调用即返回、状态异步填充）绝不能再加"兜底再调用"**。只要存在无条件启动路径，`resourcePageCtx === null` 就可能是"在途"而非"未启动"，任何再调用都会与在途请求并发。正确做法：**完全移除加载触发，依赖既有加载链路**，面板只消费加载结果。
2. 判断是否该由你触发加载的唯一安全依据是"**是否真的没有启动路径**"，而不是"状态字段是否已填充"。用 in-flight 标记（`loading` 布尔 + 请求去重）代替"状态字段为空则重试"。
3. 若未来需新增"主动刷新资源"入口，必须先给 `loadResourceSwitchList` 加 in-flight 去重或统一入口，否则 B-1 竞态会以新形态回归。

## 证据

- `js/player.js:314` — `loadVideo` 无条件调用 `loadResourceSwitchList()`（fire-and-forget）
- `js/player.js:2204-2208` — `resourcePageCtx` / `resourceResults` / `resourcePage` 全局状态（异步填充）
- `js/mobile-panel-tabs.js` — 最终实现：对 `loadResourceSwitchList` **零调用**（仅注释说明，grep 实证），Tab 激活只做 `is-tab-active` 类切换
- `.codestable/features/2026-08-14-mobile-episode-resource-tabs/mobile-episode-resource-tabs-review.md` — B-1 完整记录（round 1 发现 blocking → round 2 修复后复审闭合）
