---
id: task-3.2
title: Ship systems with primary and backup definitions
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
Create ship_systems.sl file with primary systems (damaged) and backup systems (operational). This demonstrates the ship's built-in redundancy and provides the alternative systems the player needs to reroute to.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ship_systems.sl defines junction_4a (primary, DAMAGED)
- [ ] #2 ship_systems.sl defines junction_4b (backup, STANDBY)
- [ ] #3 ship_systems.sl defines scrubber_4a (primary, DAMAGED)
- [ ] #4 ship_systems.sl defines scrubber_4b (backup, STANDBY)
- [ ] #5 File accessible from engineering terminal in corridor
- [ ] #6 Comments indicate which systems are damaged vs available
<!-- AC:END -->
