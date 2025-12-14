---
id: task-3.4
title: Reference validation in runtime
status: To Do
assignee: []
created_date: '2025-12-14 08:38'
labels: []
dependencies: []
parent_task_id: task-3
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Runtime should validate that references point to valid nodes and check if the referenced system can actually serve the room (deck matching). STATUS terminal should show appropriate errors when references are wrong.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Compiler validates references exist
- [ ] #2 Runtime tracks when power_source reference is unreachable/mismatched
- [ ] #3 Runtime tracks when air_supply reference is unreachable/mismatched
- [ ] #4 STATUS terminal shows "Main Power: NO SOURCE" for wrong power ref
- [ ] #5 STATUS terminal shows "O2: NO SUPPLY" for wrong air ref
<!-- AC:END -->
