# 功能规范与PBT属性

## 需求规范

### R1: 历史记录封面展示

**场景1：PC端横向布局**
- **Given**: 用户在PC端（视口宽度 > 640px）打开历史记录面板
- **When**: 历史记录包含封面URL（vod_pic字段）
- **Then**:
  - 封面显示在左侧，尺寸100x150px（aspect-ratio: 2/3）
  - 标题最多显示2行，超出部分用省略号截断（line-clamp: 2）
  - 标题、集数、进度条等信息显示在右侧
  - 封面容器使用flex布局，gap: 12px
  - 非2:3比例图片使用object-fit: cover裁剪填充

**场景2：移动端背景布局**
- **Given**: 用户在移动端（视口宽度 ≤ 640px）打开历史记录面板
- **When**: 历史记录包含封面URL
- **Then**:
  - 封面作为卡片背景图（background-image）
  - 叠加半透明遮罩（linear-gradient: rgba(0,0,0,0.6) to rgba(0,0,0,0.8)）
  - 文字内容添加text-shadow确保可读性
  - 删除按钮始终可见（不依赖hover）
  - 非2:3比例图片使用background-size: cover裁剪填充

**场景3：封面缺失或加载失败**
- **Given**: 历史记录的vod_pic字段为空或图片加载失败（3秒超时）
- **When**: 渲染历史记录项
- **Then**:
  - 显示CSS渐变色占位符（基于视频标题生成颜色）
  - 不发起任何外部图片请求
  - 布局不发生抖动（预设aspect-ratio）

### R2: 封面数据传递与安全验证

**场景1：从搜索页面到播放器**
- **Given**: 用户在搜索结果中点击播放按钮
- **When**: 跳转到player.html
- **Then**:
  - URL包含vod_pic参数：`player.html?url=...&vod_pic=<encodeURIComponent(coverUrl)>`
  - player.js从URLSearchParams读取vod_pic
  - 保存历史记录时包含vod_pic字段

**场景2：URL参数解码与协议验证**
- **Given**: player.html接收到vod_pic参数
- **When**: player.js解析URL参数
- **Then**:
  - 使用decodeURIComponent正确解码
  - 处理特殊字符（#, &, ?, 中文, 空格）
  - **严格验证URL协议**：仅允许http/https，拒绝javascript:/data:/file:/blob:
  - 协议验证失败时使用占位符，不抛出错误

**场景3：XSS防护**
- **Given**: 恶意用户尝试注入危险URL
- **When**: 系统接收到vod_pic参数
- **Then**:
  - 使用URL构造函数解析协议（new URL(url).protocol）
  - 协议不在白名单时拒绝并记录警告
  - 渲染时使用占位符，不执行任何脚本

### R3: PC端撤销删除功能

**场景1：删除历史记录**
- **Given**: 用户在PC端点击历史记录的删除按钮
- **When**: 执行删除操作
- **Then**:
  - 历史项立即从DOM移除（180ms动画）
  - 显示撤销Toast在右下角（bottom: 20px, right: 20px）
  - 启动3秒倒计时定时器
  - localStorage暂不更新

**场景2：撤销删除**
- **Given**: 删除操作后3秒内
- **When**: 用户点击Toast中的"撤销"按钮
- **Then**:
  - 清除定时器
  - 恢复历史项到原始索引位置
  - 更新localStorage
  - 重新渲染历史列表
  - 隐藏Toast并显示"已恢复记录"提示

**场景3：自动提交删除**
- **Given**: 删除操作后3秒内用户未点击撤销
- **When**: 定时器到期
- **Then**:
  - 从localStorage永久删除该项
  - 隐藏Toast
  - 不重新渲染（已从DOM移除）

**场景4：连续删除多个项目**
- **Given**: 用户在3秒内连续删除项目A和项目B
- **When**: 第二次删除触发
- **Then**:
  - 立即提交项目A的删除（清除定时器并更新localStorage）
  - 项目B进入撤销缓冲区
  - Toast内容立即替换为项目B的信息（无堆叠）
  - 只有项目B可以被撤销

**场景5：页面刷新**
- **Given**: 删除操作后3秒内
- **When**: 用户刷新页面（F5/Ctrl+R）
- **Then**:
  - 静默提交待删除项（beforeunload时提交）
  - 撤销状态丢失（window.historyUndoState重置）
  - 重新加载后已删除项不再显示
  - 无需用户确认或警告

### R4: localStorage自动清理

**场景1：触发清理**
- **Given**: localStorage总大小超过5MB
- **When**: 保存新的历史记录
- **Then**:
  - 执行自动清理
  - 按时间戳从旧到新删除记录（LRU策略）
  - 清理后总大小 ≤ 5MB
  - 至少保留10条最新记录

**场景2：清理失败处理**
- **Given**: 清理后仍然超过限制或捕获QuotaExceededError
- **When**: 尝试保存历史记录
- **Then**:
  - 捕获QuotaExceededError
  - 执行更激进的清理（删除更多旧记录）
  - **重试保存一次**（仅一次）
  - 如果仍失败，显示"存储空间不足"Toast提示
  - 不阻止用户继续使用应用

**场景3：多标签页存储冲突**
- **Given**: 两个标签页同时操作历史记录
- **When**: 标签页A保存新记录
- **Then**:
  - 标签页B的内存状态不自动更新
  - 标签页B刷新后读取最新localStorage数据
  - 不监听storage事件（无跨标签实时同步）

### R5: 异步图片鉴权与加载

**场景1：LazyImageLoader集成**
- **Given**: 历史记录渲染完成
- **When**: 图片元素进入视口（IntersectionObserver触发）
- **Then**:
  - 检查data-src是否包含/proxy/
  - 如果是代理URL，**渲染时动态调用**ProxyAuth.addAuthToProxyUrl()
  - 等待异步鉴权完成（不阻塞其他图片）
  - 设置img.src为带签名的URL
  - 如果鉴权失败或超时（3秒），使用CSS渐变色占位符

**场景2：鉴权失败处理**
- **Given**: ProxyAuth.addAuthToProxyUrl()抛出异常或超时
- **When**: 处理异步鉴权
- **Then**:
  - 捕获异常并记录日志
  - 设置img.src为data-fallback（CSS渐变色）
  - 不阻塞其他图片加载
  - 不显示错误提示给用户

**场景3：图片加载超时**
- **Given**: 图片请求发起后3秒内未完成
- **When**: 超时定时器触发
- **Then**:
  - 中止图片请求
  - 触发onerror回调
  - 显示占位符
  - 记录超时日志

---

## PBT属性定义

### P1: 数据完整性与安全性

#### P1.1: URL协议白名单验证
```javascript
Property: URL_Protocol_Whitelist
Invariant: 只有http/https协议的URL被接受，其他协议被拒绝
Falsification:
  - 生成javascript:, data:, file:, ftp:, blob: 协议的URL
  - 大小写混合协议（JavaScript:, HTTP:）
  - 协议后缺少//（http:example.com）
Boundary:
  - http://（最短有效URL）
  - https://（最短有效URL）
  - 空字符串
  - 仅包含协议无域名
Counterexample:
  - javascript:alert(1) 被接受
  - data:text/html,<script>alert(1)</script> 被接受
  - file:///etc/passwd 被接受
```

#### P1.2: URL参数往返
```javascript
Property: URL_Param_Roundtrip
Invariant: decodeURIComponent(URLSearchParams.get('vod_pic')) === original_url
Falsification:
  - 生成包含特殊字符的URL：#, &, ?, 中文, 空格, %
  - 超长URL（2KB+）
  - 包含非法编码字符
Boundary:
  - 空字符串
  - 仅包含特殊字符
  - 超过浏览器URL长度限制（2083字符）
Counterexample:
  - vod_pic=http://example.com?a=1&b=2
  - vod_pic=http://example.com#fragment
  - vod_pic=http://例子.com/图片.jpg
```

#### P1.3: 存储序列化恒等
```javascript
Property: Storage_Serialization_Identity
Invariant: JSON.parse(JSON.stringify(historyItem)) 深度等于 historyItem
Falsification:
  - 包含undefined、Function、Symbol的对象
  - 嵌套深度 > 10的对象
  - 包含循环引用
Boundary:
  - 空对象 {}
  - 仅包含null值
  - 极大的数字（Number.MAX_SAFE_INTEGER）
Counterexample:
  - { vod_pic: undefined }
  - { timestamp: NaN }
  - { title: Symbol('test') }
```

### P2: UI一致性与响应式

#### P2.1: 占位符可靠性
```javascript
Property: Placeholder_Visual_Reliability
Invariant: 图片加载失败或超时（3秒）时，CSS渐变色必须可渲染且不为透明
Falsification:
  - 模拟404、403、超时（>3秒）
  - DataURL格式错误
  - 空src属性
Boundary:
  - 标题为空字符串
  - 标题仅包含空格
  - 标题包含emoji
Counterexample:
  - title: "" → 占位符透明或不显示
  - title: "   " → 占位符透明或不显示
  - title: "🎬🎥📺" → 占位符透明或不显示
```

#### P2.2: 响应式断点精确性
```javascript
Property: Responsive_Breakpoint_Accuracy
Invariant: width <= 640 → 移动端布局, width > 640 → PC端布局
Falsification:
  - 随机视口宽度：639px - 641px
  - 动态调整视口跨越640px边界
  - 设备像素比（DPR）变化
Boundary:
  - width = 640px（移动端）
  - width = 641px（PC端）
  - width = 639px（移动端）
Counterexample:
  - width = 640px 显示PC端布局
  - width = 641px 显示移动端布局
```

#### P2.3: 标题截断一致性
```javascript
Property: Title_Truncation_Consistency
Invariant: PC端标题最多显示2行，超出部分用省略号截断
Falsification:
  - 生成不同长度的标题（10-200字符）
  - 包含宽字符（中文、emoji）
  - 包含窄字符（i, l, 1）
Boundary:
  - 标题恰好2行（无省略号）
  - 标题2行+1字符（显示省略号）
  - 标题为空
Counterexample:
  - 长标题显示3行或更多
  - 超出2行但无省略号
```

#### P2.4: Toast单例性
```javascript
Property: Toast_Singleton
Invariant: 同一时刻只显示一个Toast，新Toast立即替换旧Toast
Falsification:
  - 快速连续触发多个Toast（<100ms间隔）
  - 在Toast动画期间触发新Toast
  - 并发触发多个Toast
Boundary:
  - Toast A显示中，Toast B触发
  - Toast A hiding动画中，Toast B触发
Counterexample:
  - 屏幕上同时显示2个或更多Toast
  - Toast堆叠显示
```

#### P2.5: 移动端删除按钮可见性
```javascript
Property: Mobile_Delete_Button_Visibility
Invariant: width <= 640 时，删除按钮始终可见（不依赖hover）
Falsification:
  - 设置width = 320px - 640px
  - 模拟触摸设备（无hover能力）
  - 滚动列表时检查按钮可见性
Boundary:
  - width = 640px（移动端，按钮可见）
  - width = 641px（PC端，可以hover显示）
Counterexample:
  - width <= 640 时删除按钮隐藏或需要hover
```

### P3: 存储管理

#### P3.1: 存储配额边界
```javascript
Property: Storage_Quota_Boundary
Invariant:
  - 存储 > 5MB → 触发清理
  - 清理后 ≤ 5MB
  - 至少保留10条记录
Falsification:
  - 连续写入随机大小数据
  - 单条记录 > 512KB
  - 并发写入
Boundary:
  - 存储大小 = 5MB - 1字节（不触发清理）
  - 存储大小 = 5MB + 1字节（触发清理）
  - 仅有1条记录但超过5MB
Counterexample:
  - 清理后仍 > 5MB
  - 清理后 < 10条记录（当总记录 > 10时）
```

#### P3.2: LRU驱逐顺序
```javascript
Property: LRU_Eviction_Order
Invariant: 清理按时间戳从旧到新，最近访问的不被移除
Falsification:
  - 生成乱序时间戳数据
  - 所有时间戳相同
  - 时间戳为负数
Boundary:
  - 时间戳 = 0
  - 时间戳 = Date.now() + 1000000（未来）
  - 时间戳 = -1
Counterexample:
  - 清理后最旧的时间戳 < 被清理项的最新时间戳
```

#### P3.3: 清理重试机制
```javascript
Property: Cleanup_Retry_Once
Invariant: QuotaExceededError后执行清理并重试保存，仅重试一次
Falsification:
  - 模拟持续的QuotaExceededError
  - 清理后仍然超出配额
  - 并发写入触发多次重试
Boundary:
  - 第一次写入失败（触发清理+重试）
  - 第二次写入失败（显示错误，不再重试）
Counterexample:
  - 重试超过1次
  - 清理后不重试
  - 重试失败后继续重试
```

#### P3.4: 多标签页隔离
```javascript
Property: Multi_Tab_Isolation
Invariant: 标签页A的状态变更不影响标签页B，直到B刷新
Falsification:
  - 标签页A保存新记录
  - 标签页B监听storage事件
  - 标签页B自动更新UI
Boundary:
  - 标签页B刷新前（不同步）
  - 标签页B刷新后（同步）
Counterexample:
  - 标签页A保存后，标签页B立即显示新记录（无刷新）
```

### P4: 撤销系统

#### P4.1: 撤销原子性
```javascript
Property: Undo_State_Atomicity
Invariant: 撤销后localStorage与删除前完全一致
Falsification:
  - 删除 → 插入新项 → 撤销
  - 删除 → 修改其他项 → 撤销
  - 并发删除多项 → 撤销最后一项
Boundary:
  - 在Toast即将消失时撤销（2999ms）
  - 撤销已被其他标签页删除的项
Counterexample:
  - 撤销后项目顺序错误
  - 撤销后项目内容不一致
```

#### P4.2: 连续删除提交策略
```javascript
Property: Sequential_Deletion_Commit
Invariant: 3秒内连续删除时，前一个删除立即提交，只有最后一个可撤销
Falsification:
  - 删除A → 1秒后删除B → 撤销
  - 删除A → 删除B → 删除C（快速连续）
  - 删除A → 2.9秒后删除B
Boundary:
  - 删除间隔 = 2999ms（前一个即将提交）
  - 删除间隔 = 3001ms（前一个已提交）
Counterexample:
  - 撤销后恢复了多个项目
  - 前一个删除未提交就被撤销
```

#### P4.3: 页面刷新静默提交
```javascript
Property: Refresh_Silent_Commit
Invariant: 页面刷新时静默提交待删除项，无需用户确认
Falsification:
  - 删除 → 立即刷新（F5）
  - 删除 → 硬刷新（Ctrl+Shift+R）
  - 删除 → 关闭标签页
Boundary:
  - 软刷新（Ctrl+R）
  - 硬刷新（Ctrl+Shift+R）
  - beforeunload事件触发
Counterexample:
  - 刷新后待删除项仍存在
  - 显示beforeunload警告对话框
  - 刷新后Toast仍显示
```

### P5: 图片加载与鉴权

#### P5.1: 鉴权动态生成
```javascript
Property: Auth_Dynamic_Generation
Invariant: ProxyAuth在渲染时动态生成，不持久化存储
Falsification:
  - 渲染两次，检查auth参数是否相同
  - 检查localStorage是否存储auth token
  - 跨会话检查auth token复用
Boundary:
  - 首次渲染（生成新token）
  - 二次渲染（重新生成token）
  - 跨标签页渲染（独立生成）
Counterexample:
  - auth token存储在localStorage
  - 多次渲染使用相同的静态token
```

#### P5.2: 图片加载超时
```javascript
Property: Image_Load_Timeout
Invariant: 图片请求超过3秒未完成时中止并显示占位符
Falsification:
  - 模拟慢速网络（响应时间>3秒）
  - 模拟无响应服务器
  - 模拟部分响应（卡在传输中）
Boundary:
  - 响应时间 = 2999ms（成功）
  - 响应时间 = 3000ms（边界）
  - 响应时间 = 3001ms（超时）
Counterexample:
  - 图片加载持续超过3秒仍在等待
  - 超时后未显示占位符
```

#### P5.3: 封面比例归一化
```javascript
Property: Cover_Aspect_Normalization
Invariant: 所有封面使用object-fit: cover，保持容器2:3比例
Falsification:
  - 加载1:1正方形图片
  - 加载16:9横向图片
  - 加载9:16竖向图片
Boundary:
  - 源图比例 = 2:3（无裁剪）
  - 源图比例 ≠ 2:3（裁剪）
Counterexample:
  - 图片被拉伸变形（object-fit: fill）
  - 图片留白（object-fit: contain）
  - 容器比例改变以适应图片
```

#### P5.4: 懒加载触发精度
```javascript
Property: Lazy_Load_Trigger_Accuracy
Invariant: 图片进入视口50px内触发加载，离开视口后停止观察
Falsification:
  - 滚动到图片上方100px
  - 滚动到图片下方100px
  - 快速滚动跳过图片
Boundary:
  - 距离视口 = 51px（不加载）
  - 距离视口 = 50px（触发加载）
  - 距离视口 = 49px（触发加载）
Counterexample:
  - 图片在视口外100px就开始加载
  - 图片进入视口后仍未加载
```

### P6: 幂等性

#### P6.1: 重复条目稳定性
```javascript
Property: Duplicate_Entry_Stability
Invariant: 多次保存同一vod_id仅保留一份，更新时间戳和进度
Falsification:
  - 毫秒级并发保存相同vod_id
  - 保存 → 立即再次保存
  - 不同页面同时保存
Boundary:
  - vod_id = 0
  - vod_id = "0"（字符串）
  - vod_id = null
Counterexample:
  - localStorage中存在多个相同vod_id的记录
  - 时间戳未更新
```

### P7: 单调性

#### P7.1: 历史时序排序
```javascript
Property: History_Temporal_Ordering
Invariant: 历史记录列表按时间戳严格降序排列
Falsification:
  - 系统时间回拨后写入
  - 手动修改localStorage中的时间戳
  - 跨年/闰秒时间点写入
Boundary:
  - 时间戳相同的多条记录
  - 时间戳为负数
  - 时间戳为0
Counterexample:
  - history[i].timestamp < history[i+1].timestamp
```

---

## 验证策略

### 自动化测试

```javascript
// 示例：URL参数往返测试
describe('P1.1: URL_Param_Roundtrip', () => {
  const testCases = [
    'http://example.com/image.jpg',
    'http://example.com?a=1&b=2',
    'http://example.com#fragment',
    'http://例子.com/图片.jpg',
    'http://example.com/path with spaces.jpg',
    'a'.repeat(2000) // 超长URL
  ];

  testCases.forEach(url => {
    it(`should roundtrip: ${url.substring(0, 50)}...`, () => {
      const encoded = encodeURIComponent(url);
      const params = new URLSearchParams(`vod_pic=${encoded}`);
      const decoded = decodeURIComponent(params.get('vod_pic'));
      expect(decoded).toBe(url);
    });
  });
});
```

### 手动测试清单

- [ ] PC端历史记录显示左侧封面（100x150px）
- [ ] 移动端历史记录显示背景封面
- [ ] 封面缺失时显示CSS渐变色
- [ ] 图片加载失败时显示占位符
- [ ] PC端删除显示右下角Toast
- [ ] 移动端删除显示底部Toast
- [ ] 3秒内撤销成功恢复
- [ ] 3秒后自动提交删除
- [ ] 页面刷新后撤销状态丢失
- [ ] localStorage超过2MB时自动清理
- [ ] 清理后保留最新10条记录
- [ ] 响应式切换时布局正确
- [ ] 图片懒加载正常工作
- [ ] 代理鉴权成功加载图片

---

## 成功判据

| ID | 判据 | 验证方式 | 优先级 |
|----|------|----------|--------|
| C1 | 新保存的历史记录包含vod_pic字段 | 检查localStorage数据 | P0 |
| C2 | PC端封面显示在左侧（100x150px） | 视觉检查 + DOM测量 | P0 |
| C3 | 移动端封面作为背景显示 | 检查CSS background-image | P0 |
| C4 | 封面缺失时显示CSS渐变色 | 测试空vod_pic | P0 |
| C5 | 图片加载失败时显示占位符 | 使用无效URL测试 | P0 |
| C6 | PC端撤销Toast在右下角 | 视觉检查位置 | P0 |
| C7 | 3秒内撤销成功 | 手动测试 | P0 |
| C8 | 3秒后自动提交 | 手动测试 | P0 |
| C9 | 页面刷新后撤销状态丢失 | 刷新测试 | P1 |
| C10 | localStorage超过2MB时清理 | 添加大量数据测试 | P0 |
| C11 | 清理后 ≤ 1.5MB | 测量存储大小 | P0 |
| C12 | 至少保留10条记录 | 清理后计数 | P1 |
| C13 | 响应式布局正确切换 | 调整视口测试 | P0 |
| C14 | 图片懒加载工作正常 | 滚动测试 | P1 |
| C15 | 代理鉴权成功 | 检查Network面板 | P0 |

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 | 验证方法 |
|------|------|------|----------|----------|
| URL参数过长导致浏览器截断 | 封面丢失 | 中 | 限制URL长度或使用sessionStorage | 测试2KB+ URL |
| localStorage溢出 | 应用崩溃 | 低 | 自动清理机制 | 压力测试 |
| 图片鉴权失败 | 封面不显示 | 中 | 占位符回退 | 模拟鉴权失败 |
| 页面刷新导致撤销失效 | 用户困惑 | 高 | 文档说明 + 保持现状 | 用户测试 |
| CSS渐变色可读性差 | 视觉体验差 | 低 | 选择对比度高的颜色 | 视觉测试 |
