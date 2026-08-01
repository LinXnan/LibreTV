---
doc_type: learning
track: knowledge
date: 2026-08-01
slug: frontend-loading-layer-pattern
component: 播放器嵌入页面/全局交互层
refactor: 2026-08-01-player-loading-facade
---

# 前端“加载指示层”设计反模式与推荐规范

## 背景

本项目历史上采用自定义 #player-loading 遮罩，叠加 ArtPlayer 内建 loading，导致播放页“加载中...”与播放器自带转圈并存，管理点繁杂、进度易丢失、各类异步事件分布于 12+ 处 JS 和多套 DOM/CSS 体系。实践后发现，无论是直接 DOM 操作，还是后期重构出的 show/hide 统一入口，本质上都难与三方播放器良好协同，解释成本极高。

## 主要反模式

- 项目自定义 loading 遮罩，三方播放器自带 loading 未清理，形成双层（UI 冲突）
- 进度条 DOM/状态机多处写死逻辑，异步更新点分散
- 统一入口重构虽提升局部维护、但整体架构复杂度与原问题等价，无法根治多头状态
- QA 难以回归所有显示/隐藏路径，体验不可预期

## 推荐规范

1. **能用三方播放器内建 loading 就不用项目自带**
   - 保持“唯一责任源”，交互层只做错误兜底提示
2. **进度跟踪、加载遮罩等交互由播放器内建管理**
   - 只在明确需要覆盖播放器能力的场景（如特殊权限/自定义错误态）另加弱提示，不可写全屏遮罩
3. **彻底移除历史遮罩相关 JS/CSS/DOM**
   - 包含入口函数、CSS class、文档节点
4. **QA 验收时确认唯一 loading 层，无 Z-index 叠加，无遗漏**
   - 常见场景：首集加载/换集/切源/网络错误/全屏切换/低网速

## 沉淀价值

- 该规范应用于 LibreTV 项目 2026-08 一轮审计，直接砍去了 12 处 JS/DOM 重复，消除了困扰数次重构的“多层 loading”问题。
- 新增页/新项目前须明确责任归属，优先信任主流播放器能力，少补 JS 逻辑层遮罩。

## 参考链接
- 审计报告：`.codestable/audits/2026-08-01-player-loading-redundancy/`
- 重构笔记：`.codestable/refactors/2026-08-01-player-loading-facade/`
- 响应式单 DOM 指南：`.codestable/compound/2026-08-01-learning-responsive-single-dom-pattern.md`
