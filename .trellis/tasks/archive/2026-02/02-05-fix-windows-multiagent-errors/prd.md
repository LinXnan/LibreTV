# 修复 Windows 平台 Multi-Agent Pipeline 执行错误

## 问题概述

在本次会话中，Multi-Agent Pipeline 系统在 Windows 平台上遇到了多个执行错误，导致无法正常启动 worktree agent。

## 遇到的错误

### 错误 1: plan.py 执行失败

**错误信息**：
```
FileNotFoundError: [WinError 2] 系统找不到指定的文件。
```

**发生位置**：`.trellis/scripts/multi_agent/plan.py` 第 208 行

**调用命令**：
```bash
python3 ./.trellis/scripts/multi_agent/plan.py \
  --name "mobile-datasource-panel-redesign" \
  --type "frontend" \
  --requirement "..."
```

**错误原因**：
- 脚本尝试使用 `subprocess.Popen` 启动 claude CLI
- Windows 系统找不到 `claude` 命令
- 可能是路径问题或命令不存在

**影响**：
- Plan Agent 无法启动
- 无法自动分析代码库和生成计划
- 需要手动配置任务

### 错误 2: start.py 执行失败

**错误信息**：
```
FileNotFoundError: [WinError 2] 系统找不到指定的文件。
```

**发生位置**：`.trellis/scripts/multi_agent/start.py` 第 400 行

**调用命令**：
```bash
python3 ./.trellis/scripts/multi_agent/start.py ".trellis/tasks/02-05-mobile-datasource-panel-redesign"
```

**部分成功**：
- ✅ Worktree 创建成功
- ✅ 任务目录复制成功
- ✅ 当前任务设置成功
- ❌ Claude agent 启动失败

**错误原因**：
- 与错误 1 相同，找不到 `claude` 命令
- Windows 路径处理问题

### 错误 3: 验证失败 - 文件不存在

**错误信息**：
```
implement.jsonl:2: File not found: .trellis/spec/shared/index.md
implement.jsonl:4: File not found: .trellis/spec/frontend/components.md
check.jsonl:2: File not found: .trellis/spec/shared/index.md
debug.jsonl:1: File not found: .trellis/spec/shared/index.md
```

**发生位置**：`task.py validate` 命令

**错误原因**：
- `init-context` 命令自动添加了默认的 spec 文件引用
- 但这些文件在项目中不存在
- 文件名不匹配（`components.md` vs `component-guidelines.md`）

**已修复**：
- ✅ 手动编辑 jsonl 文件，移除不存在的文件引用
- ✅ 修正文件名（`components.md` → `component-guidelines.md`）

## 根本原因分析

### 1. Claude CLI 路径问题

**问题**：
- Windows 系统上 `claude` 命令不在 PATH 中
- 或者 Claude CLI 未安装
- 或者需要使用完整路径

**可能的原因**：
1. Claude CLI 未安装
2. 安装路径未添加到系统 PATH
3. Windows 需要使用 `.exe` 扩展名
4. 需要使用 `claude.cmd` 或 `claude.bat`

### 2. subprocess 调用方式问题

**当前代码**（推测）：
```python
process = subprocess.Popen(cli_cmd, **popen_kwargs)
```

**Windows 特殊处理**：
- Windows 需要 `shell=True` 或完整的可执行文件路径
- 需要处理 `.exe`、`.cmd`、`.bat` 扩展名
- 路径分隔符问题（`\` vs `/`）

### 3. 默认 spec 文件配置问题

**问题**：
- `init-context` 命令硬编码了默认的 spec 文件列表
- 没有检查文件是否存在
- 文件名与实际项目不匹配

## 解决方案

### 方案 1: 修复 Claude CLI 调用（推荐）

#### 1.1 检测 Claude CLI 是否可用

```python
import shutil

def find_claude_cli():
    """查找 Claude CLI 可执行文件"""
    # 尝试常见的命令名
    candidates = ['claude', 'claude.exe', 'claude.cmd', 'claude.bat']

    for cmd in candidates:
        path = shutil.which(cmd)
        if path:
            return path

    return None
```

#### 1.2 修改 subprocess 调用

```python
# 在 plan.py 和 start.py 中
claude_cli = find_claude_cli()

if not claude_cli:
    print("[ERROR] Claude CLI not found. Please install Claude CLI first.")
    sys.exit(1)

# 构建命令
cli_cmd = [claude_cli, 'code', '--session', session_id, ...]

# Windows 特殊处理
if sys.platform == 'win32':
    # 使用 shell=True 或确保路径正确
    process = subprocess.Popen(cli_cmd, shell=False, **popen_kwargs)
else:
    process = subprocess.Popen(cli_cmd, **popen_kwargs)
```

### 方案 2: 优雅降级（备选）

如果 Claude CLI 不可用，提供替代方案：

```python
claude_cli = find_claude_cli()

if not claude_cli:
    print("[WARNING] Claude CLI not found.")
    print("[INFO] Worktree has been created successfully.")
    print("[INFO] You can manually work in the worktree using your IDE.")
    print(f"[INFO] Worktree path: {worktree_path}")
    print("[INFO] Task directory: {task_dir}")
    return 0  # 成功退出，但不启动 agent
```

### 方案 3: 修复 init-context 默认文件列表

#### 3.1 动态检测可用的 spec 文件

```python
def get_available_specs(dev_type):
    """获取实际存在的 spec 文件"""
    specs = []

    # 检查 workflow.md
    if os.path.exists('.trellis/workflow.md'):
        specs.append({
            'file': '.trellis/workflow.md',
            'reason': 'Project workflow and conventions'
        })

    # 检查前端 spec
    if dev_type in ['frontend', 'fullstack']:
        frontend_index = '.trellis/spec/frontend/index.md'
        if os.path.exists(frontend_index):
            specs.append({
                'file': frontend_index,
                'reason': 'Frontend development guide'
            })

        # 检查 component-guidelines.md（不是 components.md）
        component_guide = '.trellis/spec/frontend/component-guidelines.md'
        if os.path.exists(component_guide):
            specs.append({
                'file': component_guide,
                'reason': 'Component conventions'
            })

    return specs
```

#### 3.2 移除硬编码的 shared/index.md

```python
# 不要假设 .trellis/spec/shared/index.md 存在
# 只添加实际存在的文件
```

## 实施计划

### 阶段 1: 诊断 Claude CLI 问题

1. 检查 Claude CLI 是否安装
2. 检查 PATH 环境变量
3. 测试不同的命令名（`claude`, `claude.exe`, `claude.cmd`）

### 阶段 2: 修复 plan.py

1. 添加 `find_claude_cli()` 函数
2. 修改 subprocess 调用
3. 添加错误处理和友好提示

### 阶段 3: 修复 start.py

1. 添加 `find_claude_cli()` 函数
2. 修改 subprocess 调用
3. 实现优雅降级

### 阶段 4: 修复 init-context

1. 实现 `get_available_specs()` 函数
2. 移除硬编码的文件列表
3. 动态检测可用的 spec 文件

### 阶段 5: 测试

1. Windows 平台测试
2. Linux/macOS 平台回归测试
3. 边缘情况测试（Claude CLI 不存在）

## 验收标准

### 必须满足

- [ ] `plan.py` 在 Windows 上能正确检测 Claude CLI
- [ ] 如果 Claude CLI 不存在，提供友好的错误提示
- [ ] `start.py` 在 Windows 上能正确启动 agent
- [ ] 如果 Claude CLI 不存在，优雅降级（创建 worktree 但不启动 agent）
- [ ] `init-context` 只添加实际存在的 spec 文件
- [ ] `task.py validate` 不会报告文件不存在错误

### 测试场景

#### 场景 1: Claude CLI 已安装
**Given**: Windows 系统，Claude CLI 已安装并在 PATH 中
**When**: 运行 `plan.py` 或 `start.py`
**Then**: Agent 正常启动

#### 场景 2: Claude CLI 未安装
**Given**: Windows 系统，Claude CLI 未安装
**When**: 运行 `plan.py` 或 `start.py`
**Then**:
- 显示友好的错误提示
- 提示用户安装 Claude CLI
- 或提示用户手动在 worktree 中工作

#### 场景 3: init-context 文件检测
**Given**: 项目中只有部分 spec 文件
**When**: 运行 `task.py init-context`
**Then**: 只添加实际存在的文件到 jsonl

## 相关文件

### 需要修改的文件

- `.trellis/scripts/multi_agent/plan.py` - 添加 Claude CLI 检测
- `.trellis/scripts/multi_agent/start.py` - 添加 Claude CLI 检测和优雅降级
- `.trellis/scripts/task.py` - 修复 `init-context` 命令

### 参考文件

- `.trellis/scripts/common/` - 可能需要添加共享的 CLI 检测函数

## 技术约束

1. **必须保持跨平台兼容性**
   - Windows, Linux, macOS 都要支持
   - 不能破坏现有的 Linux/macOS 功能

2. **必须向后兼容**
   - 不能破坏现有的工作流
   - 如果 Claude CLI 可用，行为应该与之前一致

3. **必须提供友好的错误提示**
   - 用户应该知道为什么失败
   - 用户应该知道如何修复

## 优先级

**高优先级** - 影响 Multi-Agent Pipeline 的核心功能
