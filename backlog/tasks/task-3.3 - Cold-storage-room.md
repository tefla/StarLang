---
id: task-3.3
title: Corridor StarLang with correct references to damaged systems
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
Create corridor.sl with CORRECT references to the primary systems (which are damaged). The code is right, the hardware is broken. This reinforces the narrative that the player is adapting to damage, not fixing bugs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 corridor.sl defines room corridor with deck: 4
- [ ] #2 power_source: junction_4a (CORRECT reference, but hardware damaged)
- [ ] #3 air_supply: scrubber_4a (CORRECT reference, but hardware damaged)
- [ ] #4 lights corridor_main with power: junction_4a.main
- [ ] #5 File editable from engineering terminal
- [ ] #6 Player changes references to _4b systems to fix
<!-- AC:END -->
