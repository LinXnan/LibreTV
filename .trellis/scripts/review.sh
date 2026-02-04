#!/usr/bin/env bash
# Multi-model code review helper script
# Usage: ./review.sh [--files <pattern>] [--scope <frontend|backend|fullstack>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
FILES_PATTERN=""
SCOPE="auto"
OUTPUT_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --files)
            FILES_PATTERN="$2"
            shift 2
            ;;
        --scope)
            SCOPE="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --files <pattern>   Only review files matching pattern (e.g., 'src/**/*.ts')"
            echo "  --scope <type>      Review scope: frontend|backend|fullstack|auto (default: auto)"
            echo "  --output <file>     Save review report to file"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

cd "$REPO_ROOT"

# Check if there are changes to review
if ! git diff --quiet HEAD; then
    echo -e "${GREEN}✓${NC} Found uncommitted changes to review"
elif ! git diff --quiet HEAD~1 HEAD; then
    echo -e "${YELLOW}!${NC} No uncommitted changes, will review last commit"
else
    echo -e "${RED}✗${NC} No changes to review"
    exit 1
fi

# Get modified files
echo -e "${BLUE}→${NC} Collecting modified files..."
if [ -n "$FILES_PATTERN" ]; then
    MODIFIED_FILES=$(git diff --name-only HEAD | grep -E "$FILES_PATTERN" || true)
else
    MODIFIED_FILES=$(git diff --name-only HEAD)
fi

if [ -z "$MODIFIED_FILES" ]; then
    echo -e "${RED}✗${NC} No files match the pattern"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found $(echo "$MODIFIED_FILES" | wc -l) modified files"

# Auto-detect scope if needed
if [ "$SCOPE" = "auto" ]; then
    HAS_FRONTEND=false
    HAS_BACKEND=false

    while IFS= read -r file; do
        if [[ "$file" =~ (components|pages|hooks|styles|public)/ ]]; then
            HAS_FRONTEND=true
        fi
        if [[ "$file" =~ (src|lib|api|server|services|models)/ ]]; then
            HAS_BACKEND=true
        fi
    done <<< "$MODIFIED_FILES"

    if [ "$HAS_FRONTEND" = true ] && [ "$HAS_BACKEND" = true ]; then
        SCOPE="fullstack"
    elif [ "$HAS_FRONTEND" = true ]; then
        SCOPE="frontend"
    elif [ "$HAS_BACKEND" = true ]; then
        SCOPE="backend"
    else
        SCOPE="fullstack"
    fi

    echo -e "${BLUE}→${NC} Auto-detected scope: ${YELLOW}$SCOPE${NC}"
fi

# Generate review context file
CONTEXT_FILE="/tmp/trellis-review-context-$$.txt"
trap "rm -f $CONTEXT_FILE" EXIT

echo "# Code Review Context" > "$CONTEXT_FILE"
echo "" >> "$CONTEXT_FILE"
echo "## Modified Files" >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"
echo "$MODIFIED_FILES" >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"
echo "" >> "$CONTEXT_FILE"
echo "## Code Changes" >> "$CONTEXT_FILE"
echo '```diff' >> "$CONTEXT_FILE"
git diff HEAD >> "$CONTEXT_FILE"
echo '```' >> "$CONTEXT_FILE"

echo -e "${GREEN}✓${NC} Review context prepared at: $CONTEXT_FILE"
echo ""
echo -e "${BLUE}→${NC} Next steps:"
echo "  1. Run: ${YELLOW}/trellis:review${NC} in Claude Code"
echo "  2. Or use the review agent directly"
echo ""
echo -e "${BLUE}→${NC} Review scope: ${YELLOW}$SCOPE${NC}"
echo -e "${BLUE}→${NC} Files to review:"
echo "$MODIFIED_FILES" | sed 's/^/  - /'

if [ -n "$OUTPUT_FILE" ]; then
    echo ""
    echo -e "${BLUE}→${NC} Review report will be saved to: ${YELLOW}$OUTPUT_FILE${NC}"
fi
