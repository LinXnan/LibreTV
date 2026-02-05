"""
Windows-specific utilities for Claude Code CLI.

Handles Windows-specific issues:
1. Git Bash requirement
2. subprocess execution of .cmd files
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def find_git_bash() -> Path | None:
    """Find Git Bash executable on Windows.

    Returns:
        Path to bash.exe if found, None otherwise
    """
    if sys.platform != "win32":
        return None

    # Check environment variable first
    env_path = os.environ.get("CLAUDE_CODE_GIT_BASH_PATH")
    if env_path and Path(env_path).is_file():
        return Path(env_path)

    # Check common Git installation paths
    common_paths = [
        Path(r"C:\Program Files\Git\bin\bash.exe"),
        Path(r"C:\Program Files\Git\usr\bin\bash.exe"),
        Path(r"C:\Program Files (x86)\Git\bin\bash.exe"),
        Path(r"C:\Program Files (x86)\Git\usr\bin\bash.exe"),
    ]

    for path in common_paths:
        if path.is_file():
            return path

    # Try to find bash.exe in PATH
    bash_path = shutil.which("bash.exe")
    if bash_path:
        return Path(bash_path)

    return None


def setup_claude_env_windows() -> dict[str, str]:
    """Setup environment variables for Claude Code on Windows.

    Returns:
        Dict of environment variables to add/update
    """
    env_updates = {}

    if sys.platform != "win32":
        return env_updates

    # Find Git Bash
    bash_path = find_git_bash()
    if bash_path:
        env_updates["CLAUDE_CODE_GIT_BASH_PATH"] = str(bash_path)

    return env_updates


def get_subprocess_kwargs_windows() -> dict:
    """Get subprocess.Popen kwargs for Windows.

    Returns:
        Dict of kwargs to pass to subprocess.Popen
    """
    kwargs = {}

    if sys.platform == "win32":
        # On Windows, we need shell=True to execute .cmd files
        kwargs["shell"] = True
        # Use CREATE_NEW_PROCESS_GROUP to allow Ctrl+C handling
        import subprocess
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    return kwargs


def check_claude_cli_available() -> tuple[bool, str]:
    """Check if Claude CLI is available and properly configured.

    Returns:
        Tuple of (is_available, error_message)
    """
    # Check if claude command exists
    claude_path = shutil.which("claude")
    if not claude_path:
        return False, "Claude CLI not found in PATH. Please install Claude Code CLI."

    # On Windows, check Git Bash
    if sys.platform == "win32":
        bash_path = find_git_bash()
        if not bash_path:
            return False, (
                "Git Bash not found. Claude Code on Windows requires git-bash.\n"
                "Please install Git for Windows: https://git-scm.com/downloads/win\n"
                "Or set CLAUDE_CODE_GIT_BASH_PATH environment variable."
            )

    return True, ""
