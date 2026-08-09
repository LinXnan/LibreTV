---
doc_type: refactor-apply-notes
refactor: 2026-08-09-player-stutter
status: apply-complete
---

# 变更总览

- 1 文件变更：`js/player.js`（+56 / -35 行净增约 21 行）
- 4 步 AI 侧退出信号全部满足，`node --check` 语法通过，lint 0 错误
- 待 HUMAN 验证项（checklist 中 human_checkpoint）：
  1. dblclick 暂停/播放多次后双击全屏仍单次生效
  2. 开/关广告过滤对比同一影片广告边界不再跳变/卡顿；统计胶囊仍显示过滤数
  3. Performance 面板确认 manifest 加载时主线程无长任务
  4. 弱网/正常网各播一段：降级后可自动回升、不连续切级、seek 不误降级

## 执行偏离记录

- **步骤 4（#1）API 修正**：design 原写 `hls.maxAutoLevel`，核实 hls.js 1.6.2 minified 后确认 `maxAutoLevel` 是**派生只读 getter**（`autoLevelCapping === -1` 时返回最高档），可写的 ABR 上限 API 是 **`hls.autoLevelCapping`**。实现改用 `autoLevelCapping`，恢复条件用自身标志 `qualityCapped`（避免 getter 在"未降级"与"上限=最高档"间不可区分）。design/checklist 已同步修正。
- **步骤 2（#2）加载器改动合并到步骤 3**：design 步骤 2 列了"Loader 不回写 response.data"，实现时确认 `filterAdsFromM3U8` 改为纯统计后 `response.data = filterAdsFromM3U8(...)` 是赋值同内容的无害回写，故步骤 2 只改函数本体；Loader 结构改写统一在步骤 3 完成（异步化），避免同区域两次编辑。
- **strictMode 参数**：`filterAdsFromM3U8(m3u8Content, strictMode = false)` 的 `strictMode` 原本就未被函数体使用（既有死参），未处理。

## 步骤记录

## 步骤 1: dblclick 监听改为每实例绑定一次（#4）
- 完成时间: 2026-08-09
- 改动文件: js/player.js
- 验证结果: `addEventListener('dblclick'` 全文件仅 1 处（842 后，每实例绑定）；`art.on('video:playing')` 已删除（原 1077-1085）；node --check 通过
- 偏离: 无

## 步骤 2: 广告过滤保留 DISCONTINUITY 行（#2，方案 ii）
- 完成时间: 2026-08-09
- 改动文件: js/player.js（filterAdsFromM3U8）
- 验证结果: 临时脚本断言 DISCONTINUITY 行保留 + 内容原样返回（`out === input`）通过；`totalAdsFiltered` 统计逻辑未动；node --check 通过
- 偏离: Loader 回写改动合并到步骤 3（见总览偏离记录）

## 步骤 3: Loader 广告统计移出下载关键路径（#3）
- 完成时间: 2026-08-09
- 改动文件: js/player.js（CustomHlsJsLoader）
- 验证结果: grep 确认 `filterAdsFromM3U8` 仅在 `setTimeout(() => {...}, 0)` 内调用（1107 行），onSuccess 同步路径先放行内容；node --check 通过
- 偏离: 无

## 步骤 4: 智能降级机制重构（#1）
- 完成时间: 2026-08-09
- 改动文件: js/player.js（智能降级块）
- 验证结果: grep 确认无 `hls.currentLevel = ... - 1` 锁级写法；`hls.autoLevelCapping` 降级/恢复；`qualityCapped` 标志、15s 冷却、5s seek 保护、`readyState < 3` 保护、waiting 计数修正均在；node --check 通过；lint 0 错误
- 偏离: design 的 maxAutoLevel → 实现用 autoLevelCapping（见总览偏离记录）

## review-fix（2026-08-09，code review 环节 A 后）

- **I1 修复**：`degradeLevel` 改为返回 boolean（被冷却/`currentLevel<1`/`target<1` 拦截时返回 false）；waiting 分支仅在实际降级成功时 `bufferStallCount = 0`，被拦截时保留计数、冷却过后继续累计。解决了"冷却期内计数→清零循环抹掉卡顿信息、延迟降级响应"的问题
- **I2 修复**：降级块 waiting/timeupdate/seeking 监听改为具名 handler + 模块级 `qualityHandlers` 持有引用；每次 customType 执行先 `removeEventListener` 上一源监听再绑定新源。已用 ArtPlayer v5.2.4 minified 源码核验 `art.switch`（setter = switchUrl → `e.url = url` → 对 customType 用同一 `$video` 调用）确认切集不重建 video、监听会累积；该问题 pre-existing（非本次回归），因本次重写降级块而一并处理
- 验证结果: node --check 通过；lint 0 错误；grep 确认先移除（831-834）后绑定（886-888）、无 `hls.currentLevel = ` 锁级残留
- 涉及设计偏差: 超出原 design 步骤 4 范围（新增监听去重逻辑），已在 review.md 记录，checklist 增补 c5
