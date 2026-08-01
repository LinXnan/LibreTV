---
doc_type: issue-report
issue: search-debounce
slug: search-debounce
status: confirmed
severity: P1
nature: bug
source: audit-2026-08-01-core-subsystems-finding-05
issue_path: fast-track
tags: [search, debounce, ui]
created: 2026-08-01
---

# 搜索按钮无防抖保护

## 问题

`search()` 可被连续快速触发（多次 Enter/点击搜索按钮），每次都会并发拉取所有选中 API 源、生成筛选按钮、渲染分页。多次并发搜索导致 UI 闪烁和代理负载浪费。代码库已有 `debounce()` 工具但未接入。

## 根因

`search()` 入口无并发守卫标志。

## 修复方案

在 `search()` 开头加 `isSearching` 标志位——在搜索中直接 return。搜索完成/出错后在 finally 中重置。
