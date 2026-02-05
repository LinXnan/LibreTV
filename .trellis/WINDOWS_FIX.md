# Windows 环境修复说明

## 问题描述

在 Windows 环境下执行 Trellis Python 脚本时，出现以下错误：

```
ValueError: I/O operation on closed file.
```

## 根本原因

原代码使用了 `io.TextIOWrapper(sys.stdout.buffer, ...)` 来重新包装 stdout 以支持 UTF-8 编码：

```python
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

这种方法在某些 Windows shell 环境（如 Git Bash）中会导致底层 buffer 被关闭或变得不可用。

## 解决方案

使用 Python 3.7+ 的 `reconfigure()` 方法，这是更安全和推荐的方式：

```python
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
```

### 优点

1. **不创建新对象**：重新配置现有的 stdout，而不是创建新的包装器
2. **避免 buffer 问题**：不会导致底层 buffer 关闭
3. **更简洁**：不需要导入 `io` 模块
4. **官方推荐**：Python 3.7+ 的标准做法

## 修复的文件

### 第一批修复（v1.0）

1. `.trellis/scripts/task.py`
2. `.trellis/scripts/common/git_context.py`
3. `.trellis/scripts/add_session.py`

### 第二批修复（v2.0 - 2026-02-05）

所有包含 `print()` 输出的脚本文件已全部修复：

**主脚本文件：**
4. `.trellis/scripts/create_bootstrap.py`
5. `.trellis/scripts/get_developer.py`
6. `.trellis/scripts/init_developer.py`

**Multi-Agent Pipeline 脚本：**
7. `.trellis/scripts/multi_agent/plan.py`
8. `.trellis/scripts/multi_agent/create_pr.py`
9. `.trellis/scripts/multi_agent/status.py`
10. `.trellis/scripts/multi_agent/cleanup.py`
11. `.trellis/scripts/multi_agent/start.py`

**Common 模块：**
12. `.trellis/scripts/common/developer.py`

### 第三批修复（v2.1 - 2026-02-05）

**Claude Code Hooks（从旧方法升级到 reconfigure）：**
13. `.claude/hooks/session-start.py`
14. `.claude/hooks/inject-subagent-context.py`
15. `.claude/hooks/ralph-loop.py`

**总计：15 个文件已修复**

## 使用说明

### 路径分隔符

在 Windows 上使用 Git Bash 或类似 shell 时，**必须使用正斜杠 `/`** 而不是反斜杠 `\`：

✅ **正确**：
```bash
python .trellis/scripts/get_context.py
python .trellis/scripts/task.py list
```

❌ **错误**：
```bash
python .trellis\scripts\get_context.py  # 会失败
python .trellis\scripts\task.py list    # 会失败
```

### 常用命令测试

所有命令现在都能正常工作：

```bash
# 获取会话上下文
python .trellis/scripts/get_context.py

# 获取开发者名称
python .trellis/scripts/get_developer.py

# 列出所有任务
python .trellis/scripts/task.py list

# 列出我的任务
python .trellis/scripts/task.py list --mine

# 查看帮助
python .trellis/scripts/task.py --help
python .trellis/scripts/add_session.py --help

# Multi-Agent Pipeline 命令
python .trellis/scripts/multi_agent/status.py --help
python .trellis/scripts/multi_agent/plan.py --help
python .trellis/scripts/multi_agent/cleanup.py --help
```

## 技术细节

### 测试结果

修复前：
```
$ python .trellis/scripts/task.py list
ValueError: I/O operation on closed file.
```

修复后：
```
$ python .trellis/scripts/task.py list
All active tasks:

  - 02-04-homepage-cyber-style/ (planning) [seanan]

Total: 1 task(s)
```

### Python 版本要求

- **最低版本**：Python 3.7+（`reconfigure()` 方法在 3.7 中引入）
- **当前版本**：Python 3.8.0 ✅

### 编码处理

- **Windows 默认编码**：GBK
- **修复后编码**：UTF-8
- **错误处理**：`errors="replace"`（替换无法编码的字符）

## 验证

运行以下命令验证修复：

```bash
# 测试基本功能
python .trellis/scripts/get_context.py

# 测试中文输出
python .trellis/scripts/task.py list

# 测试颜色输出
python .trellis/scripts/task.py list --mine
```

所有命令应该正常工作，不再出现 `ValueError` 错误。

## 注意事项

1. **Git Bash 环境**：推荐使用 Git Bash 或 WSL，避免使用 CMD
2. **路径格式**：始终使用正斜杠 `/`
3. **Python 命令**：`python` 和 `python3` 都可用
4. **颜色显示**：ANSI 颜色代码在 Git Bash 中可能显示为转义序列，这是正常的

## 相关资源

- [Python TextIOWrapper 文档](https://docs.python.org/3/library/io.html#io.TextIOWrapper)
- [Python 3.7 reconfigure() 方法](https://docs.python.org/3/library/io.html#io.TextIOWrapper.reconfigure)
- [Windows 编码问题](https://peps.python.org/pep-0528/)

---

## 修复历史

### v2.1 (2026-02-05)
- 修复 `.claude/hooks/` 目录中的 3 个 hook 脚本
- 从旧的 `io.TextIOWrapper` 方法升级到 `reconfigure()` 方法
- 这些 hook 脚本之前使用的旧方法会导致 `ValueError: I/O operation on closed file`

### v2.0 (2026-02-05)
- 修复所有 Multi-Agent Pipeline 脚本
- 修复所有主脚本文件
- 修复 common 模块中的 developer.py
- 总计新增 9 个文件修复

### v1.0 (2026-02-05)
- 初始修复：task.py, git_context.py, add_session.py

**测试环境**：Windows 10/11 + Git Bash + Python 3.8.0
