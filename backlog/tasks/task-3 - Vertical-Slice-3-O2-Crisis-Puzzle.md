---
id: task-3
title: Vertical Slice 3 - Damaged Junction Puzzle (Puzzle 2)
status: To Do
assignee: []
created_date: '2025-12-14 08:38'
labels: []
dependencies: [task-2]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Puzzle 2: The Damaged Junction. After escaping the galley (Puzzle 1), player enters a dark corridor with dropping O2. The primary power junction and scrubber were physically damaged during the incident. The player must reroute to backup systems.

**Narrative Principle:**
The ship's code is CORRECT. The hardware is DAMAGED. The player adapts working software to route around physical damage. This is a workaround, not a bug fix.

**Context:**
- **Puzzle 1 (complete)**: Door switch physically broken → edit galley.sl to bypass → teaches software workaround
- **Puzzle 2 (this VS)**: Junction physically damaged → reroute to backup systems → teaches redundancy and multi-file

**Puzzle 2 Setup:**
Player enters corridor. It's dark except for STATUS terminal glow (emergency power). STATUS shows junction_4a OFFLINE (hardware fault) and O2 dropping. The code correctly references junction_4a, but the hardware is broken.

**The Core Problem:**
Physical damage, not bad code. The corridor.sl correctly says `power_source: junction_4a`, but junction_4a is damaged. The ship has backup systems (junction_4b, scrubber_4b) that the player must activate.

**STATUS Terminal Shows:**
- junction_4a: HARDWARE FAULT - physical damage detected
- scrubber_4a: HARDWARE FAULT - physical damage detected
- BACKUP SYSTEMS AVAILABLE: junction_4b, scrubber_4b (STANDBY)

**Solution:**
1. See STATUS showing damaged primary systems and available backups
2. Open corridor.sl - see correct references to damaged systems
3. Open ship_systems.sl - find backup systems defined
4. Reroute: change references from `_4a` to `_4b` systems
5. Lights come on, O2 stabilizes

**What this teaches:**
- Physical damage requires software adaptation
- The ship has redundant systems for emergencies
- STATUS terminals show what's working and what's damaged
- Multiple files define the ship's systems
- Rerouting is about changing references, not "fixing bugs"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Corridor room exists with STATUS terminal and engineering terminal
- [ ] #2 ship_systems.sl defines primary (damaged) and backup (working) systems
- [ ] #3 corridor.sl correctly references primary systems (which are damaged)
- [ ] #4 Corridor starts dark with O2 dropping when player enters
- [ ] #5 STATUS terminal shows HARDWARE FAULT for junction_4a and scrubber_4a
- [ ] #6 STATUS terminal shows BACKUP SYSTEMS AVAILABLE
- [ ] #7 Rerouting to backup systems restores power and O2
- [ ] #8 Lights come on and O2 stabilizes when puzzle is solved
<!-- AC:END -->
