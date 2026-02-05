#!/usr/bin/env python3
"""
Get Session Context for AI Agent.

Usage:
    python3 get_context.py           Output context in text format
    python3 get_context.py --json    Output context in JSON format
"""

from __future__ import annotations

import sys

# IMPORTANT: Force stdout to use UTF-8 on Windows
# This fixes UnicodeEncodeError when outputting non-ASCII characters
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from common.git_context import main


if __name__ == "__main__":
    main()
