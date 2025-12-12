---
id: task-1.3
title: Ship runtime and state management
status: Done
assignee: []
created_date: '2025-12-12 12:53'
labels: []
dependencies:
  - task-1.2
parent_task_id: task-1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build runtime that compiles AST to ship structure and manages runtime state separately from definitions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compiler transforms AST to runtime ship structure
- [x] #2 Separate state for door positions (open/closed)
- [x] #3 Hot-reload: recompile without losing state
- [x] #4 State persists across code changes
<!-- AC:END -->
