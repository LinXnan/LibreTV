# 移除历史记录封面预加载逻辑

## Goal
修改历史记录封面图片的保存和展示逻辑，从"保存时预加载缓存"改为"展示时按需加载"，以减少存储占用和提升保存速度。

## Background
当前实现中，在保存历史记录时会主动调用 `imageCacheManager.preload()` 下载并缓存封面图片到 localStorage（base64 格式）。这导致：
1. 每次保存历史记录都需要等待图片下载和压缩
2. localStorage 存储大量 base64 图片数据（每张约 50-200KB）
3. 用户可能永远不会查看某些历史记录，但图片已被缓存

## Requirements

### 1. 移除预加载逻辑
- 在 `js/player.js` 中，删除保存历史记录时的 `imageCacheManager.preload()` 调用（约行 1614-1617）
- 在 `js/ui.js` 中，删除 `addToViewingHistory` 函数中的 `imageCacheManager.preload()` 调用（约行 1050-1053）

### 2. 保留源URL存储
- 继续在历史记录对象中保存 `vod_pic` 字段（源URL）
- 不修改 URL 验证逻辑（`isValidImageUrl` 函数）

### 3. 保持展示逻辑不变
- 历史记录渲染逻辑已使用 `lazy-load` 和 `data-src`，无需修改
- `LazyImageLoader` 会在图片进入视口时自动代理请求并缓存
- 保持现有的鉴权和错误处理逻辑

## Acceptance Criteria
- [ ] `js/player.js` 中移除了 `imageCacheManager.preload()` 调用
- [ ] `js/ui.js` 中移除了 `imageCacheManager.preload()` 调用
- [ ] 历史记录仍然保存 `vod_pic` 字段
- [ ] 打开历史面板时，封面图片能正常通过懒加载显示
- [ ] 代码通过 lint 检查（如果项目有配置）
- [ ] 无新增 console 错误

## Technical Notes

### 修改位置
1. **js/player.js** (行 1614-1617)
   ```javascript
   // 删除或注释这段代码
   if (videoInfo.vod_pic && window.imageCacheManager) {
       window.imageCacheManager.preload(`/proxy/${encodeURIComponent(videoInfo.vod_pic)}`);
   }
   ```

2. **js/ui.js** (行 1050-1053)
   ```javascript
   // 删除或注释这段代码
   if (videoInfo.vod_pic && window.imageCacheManager) {
       window.imageCacheManager.preload(`/proxy/${encodeURIComponent(videoInfo.vod_pic)}`);
   }
   ```

### 不需要修改的部分
- `LazyImageLoader` 类（已实现懒加载 + 代理鉴权 + 缓存）
- `ImageCacheManager` 类（仍用于懒加载时的缓存）
- 历史记录渲染逻辑（已使用 `data-src` + `lazy-load`）
- `ProxyAuth` 鉴权逻辑

## Impact Analysis

### 优点
- 减少 localStorage 存储占用
- 加快历史记录保存速度
- 降低不必要的网络流量

### 缺点
- 首次打开历史面板时需要下载图片（但有浏览器缓存）
- 离线时历史记录封面无法显示（但已有占位符处理）

### 兼容性
- 向后兼容：现有历史记录的 `vod_pic` 字段已存储源URL，无需迁移
- 渐进增强：LazyImageLoader 已实现完整的错误处理和占位符回退
