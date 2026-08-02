---
doc_type: refactor-design
refactor: 2026-08-02-password-inject-consolidation
status: approved
scope: 3 套密码注入中间件收敛为共享 injectPassword 模块
summary: 消除 Netlify 内联 sha256 重复，抽共享注入函数
---

# password-inject-consolidation refactor design

## 1. 本次范围

- scan 两条全勾选：#1（Netlify 内联 sha256 收口）、#2（抽共享 injectPassword 函数）
- **不做**：server.mjs（Node crypto，底层不同）、libs/sha256.min.js 浏览器端替换
- 预估总工作量：2 步，全部 AI 自证
- 总风险档位：**低**（逻辑逐行等价，grep 验证）

## 2. 前置依赖

- 无（无测试基建；grep 自证即可）

## 3. 执行顺序

### 步骤 1：Netlify inject-env 内联 sha256 改为 import js/sha256.js

- 引用方法：M-L2-02
- 具体操作：删除 `netlify/edge-functions/inject-env.js` 内联 sha256 函数（23-29 行），顶部加 `import { sha256 } from '../../js/sha256.js';`
- 退出信号：grep 内联 sha256 签名无残留
- 验证责任：AI 自证
- 回滚：git 恢复该文件

### 步骤 2：创建共享 injectPassword 函数，3 套中间件统一调用

- 引用方法：M-L3-07 + M-L2-01
- 具体操作：
  1. 新建 `js/password-inject.js`：import sha256 from js/sha256.js，导出 `injectPassword(html, password)`
  2. `middleware.js`：删 `import { sha256 }` 和注入逻辑，改为 `import { injectPassword } from './js/password-inject.js'` 调用
  3. `netlify/edge-functions/inject-env.js`：同 middleware 逻辑收口
  4. `functions/_middleware.js`：改 import 路径 `../js/password-inject.js` 并收口
- 退出信号：grep `{{PASSWORD}}` 替换字符串三处一致；三文件无直接 sha256 调用
- 验证责任：AI 自证
- 回滚：git 恢复四文件

## 4. 风险与看点

- 高风险步骤：无
- 容易出错的点：Netlify inject-env 的 import 路径 `../../js/sha256.js` 需能在 Netlify Edge 部署环境解析；如不可行需回退为保留内联 sha256 但调用共享 injectPassword
