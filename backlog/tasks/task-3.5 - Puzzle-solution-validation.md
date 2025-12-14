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
Verify that rerouting to backup systems in corridor.sl correctly restores power and O2. Lights should come on, STATUS should show healthy values, and player can proceed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Changing power_source to junction_4b restores corridor power
- [ ] #2 Changing air_supply to scrubber_4b restores O2 supply
- [ ] #3 Corridor lights animate on when power is restored
- [ ] #4 STATUS terminal shows healthy readings when rerouted
- [ ] #5 O2 level stabilizes and stops dropping
- [ ] #6 Victory condition: player can exit corridor to next area
<!-- AC:END -->
