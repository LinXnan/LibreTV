---
doc_type: feature-ff-note
feature: remove-sync-toasts
date: 2026-08-08
requirement:
tags: [ui, toast, playback]
---

## 做了什么
进入播放页面（从历史记录播放）时不再弹出"正在同步最新剧集列表..."和"已同步最新剧集列表/剧集列表已是最新"两类通知，避免打扰用户。同步逻辑本身保留。

## 改了哪些
- js/ui.js:playFromHistory — 删除同步开始前的 `showToast('正在同步最新剧集列表...', 'info')`；删除同步成功后按新旧集数对比的 3 条 success toast，顺带移除仅为此 toast 服务的 `oldEpisodeCount`/`newEpisodeCount` 计算；code review 复审后同步删除仅赋值未读取的死变量 `syncSuccessful`

## 怎么验证的
- 人工核对修改后代码块：if/else 与 try/catch 结构完整，纯删除改动无新增语法结构
- 独立 Task agent 两轮 review：首轮无 blocking，修复 `syncSuccessful` 死代码后复审无 blocking/important
- 保留未要求移除的失败/超时类 warning toast 与"未获取到/无法同步"提示
- 待本地 `npm run dev` 后从历史记录点播验证不再弹这两类通知

## 顺手发现（可选，不阻塞）
- 无
