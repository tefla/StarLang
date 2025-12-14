---
id: task-3.3
title: Corridor StarLang with wrong references
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
Create corridor.sl with intentionally wrong references to deck 3 systems. This is the "hop 1" file - the problem the player must discover and fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 corridor.sl defines room corridor with deck: 4
- [ ] #2 power_source: junction_3b (WRONG - should be junction_4a)
- [ ] #3 air_supply: scrubber_alpha (WRONG - should be scrubber_beta)
- [ ] #4 lights corridor_main with power: junction_3b.main (also wrong)
- [ ] #5 File editable from engineering terminal
<!-- AC:END -->
