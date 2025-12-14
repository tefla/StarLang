---
id: task-3.5
title: Puzzle solution and victory condition
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
Verify that fixing the wrong references in corridor.sl correctly restores power and O2. Lights should come on, STATUS should show healthy values, and player can proceed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Changing power_source to junction_4a restores corridor power
- [ ] #2 Changing air_supply to scrubber_beta restores O2 supply
- [ ] #3 Corridor lights animate on when power is fixed
- [ ] #4 STATUS terminal shows healthy readings when fixed
- [ ] #5 Victory condition: player can exit corridor to next area
<!-- AC:END -->
