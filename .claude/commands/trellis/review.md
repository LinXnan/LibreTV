# Cross-Model Code Review

Multi-model code review using Codex and Gemini for cross-validation.

Execute these steps:

## Step 1: Gather Context

1. Run `git status` and `git diff --name-only` to see modified files
2. Run `git diff` to get the actual changes
3. Identify the type of changes (frontend/backend/both)
4. Read relevant spec files based on change type:
   - Frontend changes → `.trellis/spec/frontend/index.md` and relevant docs
   - Backend changes → `.trellis/spec/backend/index.md` and relevant docs
   - Cross-layer → `.trellis/spec/guides/cross-layer-thinking-guide.md`

## Step 2: Prepare Review Context

Create a review prompt that includes:
- List of modified files
- The actual code changes (git diff)
- Relevant project guidelines
- Specific review focus areas based on change type

## Step 3: Parallel Review (Codex + Gemini)

Call both models in parallel using MCP tools:

### Codex Review (Backend Focus)
Use `mcp__codex__codex` tool with:
- `PROMPT`: "Review the following code changes against the project guidelines. Focus on: architecture, error handling, type safety, performance, and security. Provide specific issues and suggestions.\n\n[Include context here]"
- `cd`: Current project directory
- `sandbox`: "read-only"

### Gemini Review (Frontend Focus)
Use `mcp__gemini__gemini` tool with:
- `PROMPT`: "Review the following code changes against the project guidelines. Focus on: component design, user experience, accessibility, state management, and code quality. Provide specific issues and suggestions.\n\n[Include context here]"
- `cd`: Current project directory
- `sandbox`: false

## Step 4: Cross-Validation Analysis

After receiving both reviews:

1. **Identify Consensus Issues** - Problems both models agree on (HIGH PRIORITY)
2. **Identify Unique Issues** - Problems only one model found (MEDIUM PRIORITY)
3. **Identify Conflicting Opinions** - Where models disagree (NEEDS DISCUSSION)
4. **Synthesize Recommendations** - Combine insights from both models

## Step 5: Generate Report

Output a structured report in Chinese:

```markdown
# 🔍 交叉验证代码审查报告

## 📊 审查概览
- 修改文件数：X
- Codex 发现问题：Y
- Gemini 发现问题：Z
- 共识问题：N

## 🚨 高优先级问题（两个模型都发现）
[列出两个模型都指出的问题]

## ⚠️ 中优先级问题

### Codex 独立发现
[Codex 独立发现的问题]

### Gemini 独立发现
[Gemini 独立发现的问题]

## 🤔 需要讨论的分歧
[两个模型意见不一致的地方]

## ✅ 修改建议
[综合两个模型的建议，给出具体的修改方案]

## 📝 详细审查结果

### Codex 完整反馈
[Codex 的完整输出]

### Gemini 完整反馈
[Gemini 的完整输出]
```

## Important Notes

- **Always call both models in parallel** to save time
- **Preserve SESSION_ID** from responses for potential follow-up questions
- **Focus on actionable feedback** - specific file locations and code snippets
- **Respect model strengths**: Codex for backend/architecture, Gemini for frontend/UX
- **Output in Chinese** for user-facing content
- **Use English** for tool interactions
