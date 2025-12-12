---
id: task-2.1
title: Separate StarLang from layout data
status: To Do
assignee: []
created_date: '2025-12-12 17:59'
labels: []
dependencies: []
parent_task_id: task-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement .layout file support to separate logical ship definition from physical 3D positions. Player only sees/edits logical code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Create layout file format (YAML or JSON)
- [ ] #2 Parser loads .sl for logic, .layout for positions
- [ ] #3 Galley.sl contains only logical properties (no position/rotation/size)
- [ ] #4 Layout data stored separately in TypeScript or .layout files
- [ ] #5 Hot reload works with separated files
<!-- AC:END -->
