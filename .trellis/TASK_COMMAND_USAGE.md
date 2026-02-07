# Task Command Usage Guide

## Problem Analysis

### The Error You Encountered

```bash
# WRONG - This command failed
python3 ./.trellis/scripts/task.py finish ".trellis/tasks/02-07-fix-daily-quote-click-area"

# Error message:
# task.py: error: unrecognized arguments: .trellis/tasks/02-07-fix-daily-quote-click-area
```

### Root Cause

**NOT a Windows path issue** - It's a **command argument error**!

The `finish` command does NOT accept any arguments.

---

## Windows Path Handling

### Good News: pathlib Handles Both Slash Types

Python's `pathlib.Path` automatically handles both forward slashes and backslashes on Windows:

```python
# Both work perfectly on Windows
Path('.trellis/tasks')      # Unix style - OK
Path(r'.trellis\tasks')     # Windows style - OK

# Both resolve to: .trellis\tasks
```

**Conclusion**: You can use forward slashes (/) in all commands, even on Windows.

---

## Command Reference

### 1. start - Set Current Task (REQUIRES argument)

```bash
# Syntax
python3 ./.trellis/scripts/task.py start <task-directory>

# Example (forward slash - recommended)
python3 ./.trellis/scripts/task.py start ".trellis/tasks/02-07-fix-daily-quote-click-area"

# Example (backslash - also works)
python3 ./.trellis/scripts/task.py start ".trellis\tasks\02-07-fix-daily-quote-click-area"
```

**What it does**:
- Sets the specified task as current task
- Writes to `.trellis/.current-task` file
- Hooks will read this file to inject context

---

### 2. finish - Clear Current Task (NO arguments)

```bash
# Syntax
python3 ./.trellis/scripts/task.py finish

# That's it! No arguments needed.
```

**What it does**:
- Automatically reads `.trellis/.current-task` file
- Clears the current task marker
- Deletes the `.current-task` file

**Why no arguments?**
- Only one task can be current at a time
- The command automatically knows which task to clear

**Code reference** (task.py:632-643):
```python
def cmd_finish(args: argparse.Namespace) -> int:
    """Clear current task."""
    repo_root = get_repo_root()
    current = get_current_task(repo_root)  # Auto-reads current task

    if not current:
        print("No current task set")
        return 0

    clear_current_task(repo_root)
    print(f"Cleared current task (was: {current})")
    return 0
```

---

### 3. archive - Archive Task (REQUIRES task name)

```bash
# Syntax
python3 ./.trellis/scripts/task.py archive <task-name>

# Example (task name only, NOT full path)
python3 ./.trellis/scripts/task.py archive 02-07-fix-daily-quote-click-area

# WRONG - Don't use full path
python3 ./.trellis/scripts/task.py archive ".trellis/tasks/02-07-fix-daily-quote-click-area"
```

**What it does**:
- Moves task from `.trellis/tasks/` to `.trellis/tasks/archive/YYYY-MM/`
- Updates task status to `completed`
- Records completion time

---

## Complete Workflow Example

```bash
# Step 1: Create a task
python3 ./.trellis/scripts/task.py create "Fix bug in login" --slug fix-login-bug

# Output: .trellis/tasks/02-07-fix-login-bug

# Step 2: Set as current task
python3 ./.trellis/scripts/task.py start ".trellis/tasks/02-07-fix-login-bug"

# Step 3: Do your work...
# (write code, test, commit)

# Step 4: Clear current task (when switching tasks or taking a break)
python3 ./.trellis/scripts/task.py finish

# Step 5: Archive when completely done
python3 ./.trellis/scripts/task.py archive 02-07-fix-login-bug
```

---

## Command Comparison Table

| Command | Arguments | Example | Purpose |
|---------|-----------|---------|---------|
| `start` | Task directory (required) | `task.py start ".trellis/tasks/my-task"` | Set current task |
| `finish` | None | `task.py finish` | Clear current task |
| `archive` | Task name (required) | `task.py archive my-task` | Archive completed task |

---

## Why This Design?

### start - Needs argument
- You need to specify WHICH task to set as current
- Multiple tasks can exist, you choose one

### finish - No argument
- Only ONE task can be current at a time
- The command knows which task to clear (reads from `.current-task` file)
- Simpler and safer

### archive - Needs task name
- You need to specify WHICH task to archive
- Uses task name (not full path) for simplicity

---

## Troubleshooting

### Error: "unrecognized arguments"

```bash
# If you see this error:
task.py: error: unrecognized arguments: .trellis/tasks/...

# Check if you're passing arguments to a command that doesn't accept them
# Most likely: you're passing an argument to 'finish'
```

**Solution**: Remove the argument from `finish` command.

### Error: "Task not found"

```bash
# If archive command says task not found:
Error: Task not found: .trellis/tasks/my-task

# You're probably using the full path instead of just the task name
```

**Solution**: Use only the task name (e.g., `my-task`), not the full path.

---

## Summary

1. **Windows paths are fine** - pathlib handles both `/` and `\`
2. **finish command takes NO arguments** - it auto-reads current task
3. **Use forward slashes** - they work everywhere (Windows, Linux, macOS)
4. **Task names vs paths** - `archive` uses task name, `start` uses full path

---

Generated: 2026-02-07
