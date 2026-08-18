---
doc_type: feature-review
feature: 2026-08-18-douban-hot-rate
status: passed
reviewer: subagent
reviewed: 2026-08-18
round: 2
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "OCR CLI 未安装（where ocr 未找到）"
---

# douban-hot-rate 代码审查报告（round 2）

## 1. Scope And Inputs

- Design: `.codestable/features/2026-08-18-douban-hot-rate/douban-hot-rate-ff-note.md`（Quick lane，ff-note 即 spec，含 REV-001 修复记录）
- Checklist: none（Quick lane 无 checklist）
- Implementation evidence: 对话实现（rateHtml 模板 + rate 归一化 + CSS rate 样式）
- Diff basis: `git status --short` → 本轮可归因：`js/recent-watch.js`（rate 归一化 + rateHtml 模板）、`css/index.css`（.recent-watch-rate 样式）；其余 10 文件为已审 baseline（douban-hot-merge/cover-418/carousel 归因）
- Review mode: re-review（round 2，REV-001 + nit 修复后完整复审）
- Baseline dirty files: 10 个（代理文件 4 + index.html + app.js + douban.js + password.js + 其余 css）

### Independent Review

- Detection: 独立 Task agent（code-explorer）可用；ocr CLI 不可用（`where ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed（round 1 发现 REV-001 + nit；round 2 确认修复闭环，无新 blocking/important）
- 环节 B OCR CLI: unavailable（未安装，不阻塞）
- OCR severity mapping: 不适用（未运行）
- Merge policy: 两轮 findings 已逐条本地事实核验后合并
- Gate effect: 环节 A round 2 completed，可定稿；reviewer=subagent 满足 gate 要求

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-18-douban-hot-rate/douban-hot-rate-ff-note.md`
- 修改：`js/recent-watch.js`（数据映射 rate 归一化 + 卡片模板 rateHtml 评分行）、`css/index.css`（.recent-watch-rate / .recent-watch-rate-value + nowrap 防御）
- 删除：none
- 未跟踪 / staged：`.codestable/features/2026-08-18-douban-hot-rate/`（新目录）
- 风险热点：数据边界（rate "0.0" 字符串）、XSS（safeRate 转义）、aria 不重复、布局溢出（移动端/长文本）

## 3. Adversarial Pass

- 假设的生产 bug：无评分影片错误显示「★ 0.0」（豆瓣 rate 为字符串 "0.0"，`"0.0" || ''` 为真值）——round 1 确认属实并修复
- 主动攻击过的反例：rate 为 0/"0"/"0.0"/"0.00"/" 0.0 "/"0.5"/"8.9"/"暂无"/长文本；XSS 注入；aria 重复朗读；移动端溢出；★ 字符注入
- 结果：REV-001（important）round 1 发现并修复；round 2 确认精确无误伤；nit 顺手修复；无新问题

## 4. Findings

### blocking

none

### important

- [x] REV-001 `js/recent-watch.js` 无评分影片错误显示「★ 0.0」：`rate: String((s && s.rate) || '')` 只排除数字 `0`，豆瓣 API 返回字符串（无评分影片 rate 为 `"0.0"`），`"0.0" || ''` 为真值
  - Evidence: 豆瓣 search_subjects 返回 rate 为字符串（如 "8.9"），无评分返回 "0.0"
  - Impact: 无评分影片显示无意义「★ 0.0」，aria-label 读"片名 0.0分"，违背 ff-note"无评分整行省略"目标
  - Fix: 数据映射层归一化 `const rate = /^\s*0+(\.0+)?\s*$/.test(rawRate) ? '' : rawRate`（0/"0"/"0.0"/"0.00"/带空白零值 → 空串；保留原始字符串避免 parseFloat 丢小数）
  - 验证: node 自测 8.9/9.7 保留、0/0.0/0.00/空白零值清空；round 2 正则推演确认 "0.5" 保留（含非零数字的评分不误清）

### nit

- [x] REV-002 `css/index.css` `.recent-watch-rate` 补 `white-space:nowrap + overflow:hidden + text-overflow:ellipsis`，防异常长文本换行撑高 info（round 1 nit，已修）

### suggestion

- REV-003 ★ 与分值间距为模板硬编码单空格，可改 gap/margin-left 更稳——纯视觉优化，非必需（round 1/2 均维持）
- REV-004 评分行与片名行间距（margin-bottom:2px）偏紧凑，可加大分层——主观布局偏好，不阻断

### learning

- 归一化放在数据映射层（产出 `item.rate` 单一真值源）是正确选择：模板 rateHtml 与 aria-label 两处共享同一判断，消除双份归一化逻辑漂移风险
- 正则 `/^\s*0+(\.0+)?\s*$/` 只清「纯零（含空白/全零小数）」，任何含非零数字的评分（0.5/8.9）保留——无误伤
- 保留原始字符串而非 parseFloat，避免浮点精度丢小数（"8.90" 尾零）

### praise

- rate 归一化精确：0/"0"/"0.0"/"0.00"/" 0.0 " 全清空，"0.5"/"8.9" 保留（round 2 逐字符推演验证）
- aria 一致性：rateHtml 用 item.rate、aria-label 用 safeRate，底层同源归一化后真值一致；`.recent-watch-info aria-hidden="true"` 继承隐藏不重复朗读
- XSS 无注入面：safeRate 经 escapeHtml 且模板仅插值一次；★（U+2605）HTML 中安全

## 5. Test And QA Focus

- QA 必须重点复核：
  - REV-001 核心回归：找到 rate="0.0" 影片确认无评分行、片名常显、无残留空行
  - 合法低分：rate="0.5" 显示「★ 0.5」不被误清
  - 正常评分：8.9/9.4 显示金色星 + 白字，随中央卡 scale=1.2 缩放
  - 极长异常 rate：单行 ellipsis 截断不换行撑高 info
  - 移动端 ≤640px：140px 卡下评分行不溢出、星+分值完整
  - 电影/电视剧切换 + 标签：各数据源无评分影片均不显示评分行
  - lint：read_lints 两文件 0 报错
- 不能靠 review 完全确认：豆瓣实际 rate 数据形态分布（"0.0" 触发率）、视觉效果（间距、金色可读性）

## 6. Residual Risk

- 极低：豆瓣若返回超约定形态 `"0."` 会被当真实评分显示「★ 0.」——当前协议返回 "0.0"，`0+` 已覆盖 "0"/"00"，理论边界不改动
- 无自动化测试（attention.md:17），视觉层回归依赖手动验证

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾提交

## 8. Focused Closure（无则写 none）

none
