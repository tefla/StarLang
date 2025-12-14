---
id: task-3.4
title: Hardware damage tracking in runtime
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
Runtime should track which physical systems are damaged vs operational. STATUS terminal should show HARDWARE FAULT for damaged systems and list available backup systems. This creates the information the player needs to solve the puzzle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Runtime tracks damage state for junctions and scrubbers
- [ ] #2 junction_4a and scrubber_4a marked as DAMAGED at game start
- [ ] #3 junction_4b and scrubber_4b marked as STANDBY (available)
- [ ] #4 STATUS terminal shows "HARDWARE FAULT - physical damage detected"
- [ ] #5 STATUS terminal shows "BACKUP SYSTEMS AVAILABLE" with list
- [ ] #6 Referencing damaged system = no power/atmosphere
<!-- AC:END -->
