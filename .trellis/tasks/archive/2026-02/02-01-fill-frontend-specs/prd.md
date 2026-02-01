# Fill Frontend Specification Documents

## Goal
Document the actual frontend conventions used in this project by filling the template spec files with real code examples and patterns from the codebase.

## Requirements

### 1. Directory Structure (.trellis/spec/frontend/directory-structure.md)
- Document the traditional MPA (Multi-Page Application) structure
- Explain the js/, css/, libs/, image/ organization
- Show how files are organized by function/page
- Include examples of actual file paths

### 2. Component Guidelines (.trellis/spec/frontend/component-guidelines.md)
- Document the non-framework approach (no React/Vue)
- Explain the Class-based vs Function-based patterns
- Show how to structure utility classes (StorageManager, LazyImageLoader, etc.)
- Show how to write UI functions (toggleSettings, showToast, etc.)
- Include real code examples from the codebase

### 3. Hook Guidelines (.trellis/spec/frontend/hook-guidelines.md)
- Clarify that this project doesn't use React Hooks
- Document the alternative patterns: utility classes, pure functions, global singletons
- Show examples of reusable logic patterns (LazyImageLoader, StorageManager)
- Explain when to use classes vs functions

### 4. State Management (.trellis/spec/frontend/state-management.md)
- Document the LocalStorage + global variables approach
- Show how to use StorageManager for persistent state
- Show how to use global variables for runtime state
- Include examples of state patterns (selectedAPIs, customAPIs, etc.)
- Document the config.js constants pattern

### 5. Quality Guidelines (.trellis/spec/frontend/quality-guidelines.md)
- Document that there are no linters/formatters configured
- Show the actual quality patterns used: error handling, XSS protection, performance optimization
- Include examples of try-catch patterns, escapeHtml, debouncing, lazy loading
- List common mistakes to avoid

### 6. Type Safety (.trellis/spec/frontend/type-safety.md)
- Document that this is pure JavaScript (no TypeScript)
- Show the runtime validation patterns (isValidImageUrl, type checks)
- Show the JSDoc comment patterns
- Show the data normalization patterns (normalizeCustomAPI)
- Document the use of optional chaining (?.) and nullish coalescing (??)

## Acceptance Criteria

- [ ] All 6 spec files are filled with actual project conventions
- [ ] Each spec includes 3-5 real code examples from the codebase
- [ ] Each spec explains WHY patterns are used, not just WHAT
- [ ] Each spec includes a "Common Mistakes" or "Anti-patterns" section
- [ ] All examples include file paths and line numbers for reference
- [ ] Documentation is written in English
- [ ] Content is specific to THIS project, not generic best practices

## Technical Notes

- This is a **traditional MPA** project, not a modern SPA framework
- Uses **pure JavaScript** (ES6+), no TypeScript
- Uses **ES Modules** for code organization
- No build step, files loaded directly in browser
- Focus on documenting ACTUAL patterns, not ideal practices
