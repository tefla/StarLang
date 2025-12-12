---
id: task-1.3
title: Ship runtime and state management
status: To Do
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
- [ ] #1 Compiler transforms AST to runtime ship structure
- [ ] #2 Separate state for door positions (open/closed)
- [ ] #3 Hot-reload: recompile without losing state
- [ ] #4 State persists across code changes
<!-- AC:END -->
