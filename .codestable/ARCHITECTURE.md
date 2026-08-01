# LibreTV 架构索引

本文件是系统地图入口。详细结构见 `.codestable/architecture/` 下各文档。
**只记现状，不记规划。**

## 文档清单

| 文档 | 范围 | 摘要 |
|---|---|---|
| [system-overview](architecture/system-overview.md) | 全系统 | 多部署目标下的静态前端 + 同源代理 + 密码注入总图；无服务端业务库 |
| [frontend-app](architecture/frontend-app.md) | 首页 SPA | 搜索聚合、详情弹窗、设置/历史面板、筛选分页、豆瓣推荐与工具库 |
| [proxy-gateway](architecture/proxy-gateway.md) | 同源 /proxy | 四平台代理实现、鉴权、M3U8 改写与 SSRF 能力对照 |
| [player-pipeline](architecture/player-pipeline.md) | 播放器管道 | ArtPlayer + Hls.js 集成、DISCONTINUITY 广告过滤、连播、进度恢复、智能画质降级 |

## 怎么用

- 做 feature design：先读 system-overview 定位模块边界与请求链路
- 动首页 / 搜索 / 设置 / 历史：读 frontend-app
- 动代理 / 排平台差异：读 proxy-gateway
- 动播放器 / 广告 / 连播 / 进度：读 player-pipeline
- 做 issue 根因：从「代码锚点」进具体文件
