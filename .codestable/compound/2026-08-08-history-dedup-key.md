# LibreTV 观看历史去重键：身份字段必须跨上下文不变

## 背景

播放页切换视频源时，观看历史（localStorage `viewingHistory`）会新增重复记录，用户期望在原有记录上更新。修复过程中去重键经历两轮推翻：先尝试用 `vod_id` 当跨源稳定键，核实后作废，最终改用规范化片名。核心教训是"去重键的稳定性取决于所选身份字段是否跨上下文不变"。

## 结论

1. **源相关字段（`sourceName` / `vod_id`）跨源必变，不能做跨源去重键**：
   - `sourceName` 切源必变，直观。
   - `vod_id` 是源相关的：`switchToResource` 传入的是目标源自己的 `vod_id`（资源面板里 `result.vod_id`），且会把 URL 的 `id` 替换为新源 id。不同源对同一视频各自返回独立 id 体系。
2. **片名（title）是跨源唯一近似稳定的身份**，`saveToHistory` 最终以 `currentVideoTitle.trim()` 为去重键：切源/切集命中同一条记录并更新，不新增。
3. **配套约束**：更新命中记录时必须同步 `title/sourceName/sourceCode/vod_id/showIdentifier/url/episodes` 等全部字段——播放速度恢复、`flushProgressQueue` 等仍按 `title+sourceName+showIdentifier` 精确匹配，字段不同步会导致这些链路失配。
4. **自愈去重**：命中时移除同键残留记录，收敛历史存量重复；同键多条时保留 `timestamp` 最新一条。
5. **固有取舍（验收标记）**：title 键无法区分"同名不同剧"（会合并）；跨源返回片名格式差异大时仍会新增。若要根治需引入源无关的稳定影片标识，当前不可得。

## 证据

- `js/player.js` `saveToHistory()`：旧键 `title_sourceName_showIdentifier` → v1 `id:${vod_id}` → v2 规范化片名键（uniqueKey 约 1471-1472 行、Map 查找键约 1497-1505 行、更新分支约 1507-1541 行）
- `js/player.js` `getShowIdentifier()`（107-109 行）：`sourceName && id` 时返回 `${sourceName}_${id}`，本身含 sourceName → 旧键切源必变
- `js/player.js` `resourceCardHTML()`（2126 行）与 `switchToResource()`（2248 行）：切源传入并替换为**目标源自己的** `vod_id` → id 键跨源必变，作废
- `js/player.js` 播放速度恢复/更新（936-944、1011-1015 行）：按 `title+sourceName+showIdentifier` 精确匹配，依赖更新分支字段同步
- `.codestable/issues/2026-08-08-history-source-switch-dup/`：report / approval-report / fix-note / review（四轮独立复审，round 2 核实 vod_id 源相关、round 3 加固空 title 与保留最新、round 4 门禁通过）
