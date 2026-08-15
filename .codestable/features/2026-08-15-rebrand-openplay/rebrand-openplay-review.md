---
doc_type: feature-review
feature: 2026-08-15-rebrand-openplay
status: passed
reviewer: subagent
reviewed: 2026-08-15
round: 1
lane_a_state: completed
lane_a_ref: ""
lane_a_reason: ""
lane_b_state: unavailable
lane_b_ref: ""
lane_b_reason: "ocr CLI 未安装（where ocr 未找到）"
---

# rebrand-openplay 代码审查报告

## 1. Scope And Inputs

- Design: none（Quick lane，见 `rebrand-openplay-ff-note.md`）
- Checklist: none（Quick lane）
- Evidence pack: none
- Gate results: none
- DoD results: none
- Implementation evidence: ff-note + 全仓 grep 核验 + 独立 reviewer 输出
- Diff basis: `git status --short`（18 个修改文件 + 1 个未跟踪目录）
- Review mode: initial
- Baseline dirty files: none

### Independent Review

- Detection: 主 agent 自检——独立 Task agent 可用；`ocr` CLI 不可用（`where ocr` 未找到）
- 环节 A 独立隔离 Task agent: independent-agent + completed
- 环节 B OCR CLI: unavailable（未安装）
- OCR severity mapping: 未启用
- Merge policy: 独立 reviewer 结果已逐条本地核验后合并
- Gate effect: 环节 A 完成，gate 放行；环节 B 不可用不阻塞

## 2. Diff Summary

- 新增：`.codestable/features/2026-08-15-rebrand-openplay/`（ff-note）
- 修改：`index.html` `player.html` `watch.html` `about.html` `manifest.json` `js/app.js` `js/player.js` `js/index-page.js` `js/douban.js` `README.md` `Dockerfile` `LICENSE` `AGENTS.md` `css/styles.css` `css/performance-optimize.css` `css/mobile-optimize.css` `image/logo.png` `image/logo-black.png`
- 删除：none
- 未跟踪 / staged：仅 feature 目录
- 风险热点：全站文案替换（品牌）、manifest 图标声明、配置协议字段兼容、无 API/并发/权限改动

## 3. Adversarial Pass

- 假设的生产 bug：改名过程中误伤配置导入导出协议字段，或 JS 模板字符串替换破坏语法
- 主动攻击过的反例：全仓 grep `LibreTV` 核验 21 处残留（区分基础设施标识 vs 品牌残留）；4 个 JS 文件模板字符串逐一检查闭合；JSON-LD/meta/title 一致性；manifest 图标声明 vs 实际尺寸；localStorage 键名是否受品牌影响
- 结果：无 blocking；2 个 important（均处理）；manifest 尺寸不一致已修复

## 4. Findings

### blocking

none

### important

- [x] REV-001 `manifest.json:13-14` icons 声明 `512x512` 但新 logo 实际为 `1024x1024`（PWA 安装可能告警/拒装）
  - Evidence: `System.Drawing` 实测 `logo-black.png` = 1024x1024
  - Impact: PWA 安装能力受损（用户可见）
  - Expected fix scope: manifest sizes 声明与实际一致
  - 处置：已修复（sizes → `1024x1024`）
- [x] REV-002 `index.html:528,532` JSON-LD `url`/`target` 仍为 `libretv.is-an.org`
  - Evidence: 部署域名 + DNS 基础设施标识，非本次纯前端改名范围
  - Impact: 品牌彻底脱离需联动 DNS/README，属独立"换域名"任务
  - 处置：判定为合理保留项，移入 Residual Risk（ff-note 顺手发现已记录）

### nit

- [x] REV-003 `js/player.js:297,2393` 运行时 title 用 `OpenPlay播放器`（无空格），与 `player.html:7` 静态 `OpenPlay 播放器` 不一致
  - 处置：已统一为 `OpenPlay 播放器`

### suggestion

- [ ] REV-004 `js/app.js:1595` 导出文件名 `LibreTV-Settings_<ts>.json` 保留旧品牌（内部 `name` 字段 `LibreTV-Settings` 为兼容必须保留）
  - 建议：未来 cfgVer 升版本时把导出文件名改为 `OpenPlay-Settings_<ts>.json`，内部 name 字段继续保留旧值兼容导入。非本次必改。

### learning

- rebrand 类改动最大风险是 localstorage 键名与配置协议字段：本仓键名（`selectedAPIs`/`viewingHistory` 等）均不依赖品牌，`LibreTV-Settings` 协议字段正确保留，用户本地数据不丢
- 全仓 21 处 `LibreTV` 残留均为正确保留的基础设施标识（镜像名/域名/npm 包名/KV 环境变量），无误改

### praise

- 保留边界判断准确：协议字段、仓库链接、部署标识与品牌文案分离清晰

## 5. Test And QA Focus

- QA 必测：`npm run dev` 后逐页核对 title/header h1/logo 渲染；搜索→播放链路浏览器标签始终为 OpenPlay
- 配置导入导出回归（最高优先）：导出（文件名含 LibreTV-Settings）→ 重导，确认 `js/app.js:1478/1531` 校验通过
- PWA：DevTools Application→Manifest 确认新 logo 无尺寸警告
- 全仓再 grep 一次 `LibreTV` 确认无新残留
- 建议：品牌字符串一致性 grep CI（断言 title/meta 含 OpenPlay、LibreTV 残留命中白名单）

## 6. Residual Risk

- `libretv.is-an.org` 部署域名未随品牌更换——需独立"换域名"任务联动 DNS、README 门户链接、JSON-LD URL
- AI 生成 logo 为非透明 PNG，favicon 小尺寸渲染效果需部署后目视确认
- logo 内容质量（渐变配色、可辨识度）review 无法完全确认，需 QA 目视

## 7. Verdict

- Status: passed
- Next: Quick lane 收尾——提示用户确认效果，之后可 scoped-commit（含 ff-note）

## 8. Focused Closure（无则写 none）

none（initial review，round 1）
