# Cloudflare Pages 环境变量配置指南

## 问题诊断

### 当前状态
- ✅ 原始图片 URL 可访问（200 OK）
- ✅ 时间戳有效（未过期）
- ✅ 认证参数格式正确
- ❌ **服务器端 PASSWORD 环境变量未设置**

### 客户端发送的认证哈希
```
9646f275f10ae73f70fa297fef85e62b5accd3a38284eb0a64b8203e12dd1373
```

这个哈希是某个密码的 SHA-256 值，服务器端需要配置相同的密码。

## 解决方案

### 方案 1：配置 Cloudflare Pages 环境变量（推荐）

#### 步骤 1：登录 Cloudflare Dashboard
1. 访问：https://dash.cloudflare.com/
2. 使用你的账号登录

#### 步骤 2：进入 Pages 项目
1. 在左侧菜单中选择 "Workers & Pages"
2. 找到并点击 `linxunantv` 项目

#### 步骤 3：配置环境变量
1. 点击 "Settings"（设置）标签
2. 在左侧菜单中找到 "Environment variables"（环境变量）
3. 点击 "Add variable"（添加变量）按钮

#### 步骤 4：添加 PASSWORD 变量
```
变量名：PASSWORD
变量值：[你的密码明文]
环境：Production (生产环境)
```

**重要提示**：
- 变量名必须是 `PASSWORD`（全大写）
- 变量值是明文密码，不是哈希值
- 服务器会自动计算 SHA-256 哈希并与客户端比对

#### 步骤 5：重新部署
1. 保存环境变量后
2. 在 "Deployments" 标签中
3. 点击最新部署右侧的 "..." 菜单
4. 选择 "Retry deployment"（重新部署）

或者推送一个新的提交触发自动部署：
```bash
git push origin main
```

### 方案 2：查找你的密码

如果你不记得密码，可以在浏览器控制台中查看：

1. 打开 https://linxunantv.pages.dev
2. 按 F12 打开开发者工具
3. 切换到 Console（控制台）标签
4. 执行以下命令：

```javascript
// 查看存储的密码
localStorage.getItem('userPassword')

// 查看密码哈希
localStorage.getItem('passwordHash')

// 查看代理认证哈希
localStorage.getItem('proxyAuthHash')

// 使用 ProxyAuth 获取哈希
await window.ProxyAuth.getPasswordHash()
```

### 方案 3：临时禁用认证（不推荐，仅用于调试）

如果你想临时禁用认证进行测试，可以修改服务器端代码。

**警告**：这会让你的代理服务对所有人开放，存在安全风险！

## 验证配置是否成功

### 1. 检查环境变量
在 Cloudflare Pages 设置中确认 PASSWORD 变量已添加。

### 2. 重新部署
确保在添加环境变量后重新部署了应用。

### 3. 测试图片加载
1. 访问：https://linxunantv.pages.dev
2. 打开历史记录页面
3. 检查图片是否正常显示

### 4. 检查网络请求
1. 按 F12 打开开发者工具
2. 切换到 Network（网络）标签
3. 刷新页面
4. 找到图片请求
5. 检查状态码：
   - ✅ 200 OK - 成功
   - ❌ 401 Unauthorized - 认证失败
   - ❌ 403 Forbidden - 权限被拒绝

### 5. 查看 Cloudflare 日志
1. 在 Cloudflare Pages 项目中
2. 点击 "Functions" 标签
3. 查看实时日志
4. 查找错误信息：
   - "服务器未设置 PASSWORD 环境变量"
   - "代理请求鉴权失败：密码哈希不匹配"

## 常见问题

### Q1: 我配置了环境变量，但还是不行？
A: 确保：
1. 变量名是 `PASSWORD`（全大写）
2. 已经重新部署
3. 清除浏览器缓存并刷新页面

### Q2: 我不知道密码是什么？
A: 在浏览器控制台执行：
```javascript
localStorage.getItem('userPassword')
```

### Q3: 如何重置密码？
A: 
1. 在浏览器中清除 localStorage
2. 重新访问网站
3. 输入新密码
4. 在 Cloudflare Pages 中更新 PASSWORD 环境变量

### Q4: 密码哈希如何计算？
A: 使用 SHA-256 算法：
```javascript
// 在浏览器控制台
const password = 'your_password';
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
const hashArray = Array.from(new Uint8Array(hash));
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
console.log(hashHex);
```

## 技术细节

### 认证流程
1. 客户端从 localStorage 获取密码
2. 计算密码的 SHA-256 哈希
3. 将哈希和时间戳添加到图片 URL
4. 服务器从环境变量获取 PASSWORD
5. 计算 PASSWORD 的 SHA-256 哈希
6. 比对客户端和服务器的哈希
7. 验证时间戳（10分钟有效期）

### 代码位置
- 客户端认证：`js/proxy-auth.js`
- 服务器端验证：`netlify/functions/proxy.mjs` (第 93-124 行)

## 联系支持

如果按照以上步骤操作后仍然无法解决问题，请提供：
1. Cloudflare Pages 环境变量截图
2. 浏览器控制台错误信息
3. Network 面板中失败请求的详细信息
4. Cloudflare Functions 日志
