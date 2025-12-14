---
id: task-3
title: Vertical Slice 3 - Wrong Wiring Puzzle (Puzzle 2)
status: To Do
assignee: []
created_date: '2025-12-14 08:38'
labels: []
dependencies: [task-2]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Puzzle 2: Wrong Wiring. After escaping the galley (Puzzle 1), player enters a dark corridor with dropping O2. The problem is that the corridor's system references are WRONG - pointing to deck 3 systems instead of deck 4. This puzzle builds on skills learned in Puzzle 1 and introduces multi-file investigation.

**Context:**
- **Puzzle 1 (complete)**: Door switch FAULT → edit galley.sl to bypass control → teaches basic editing
- **Puzzle 2 (this VS)**: Dark corridor, O2 dropping → find and fix wrong references → teaches 2-hop reference tracing

**Puzzle 2 Setup:**
Player enters corridor. It's dark except for STATUS terminal glow (emergency power). STATUS shows "Main Power: NO SOURCE" and "O2: CRITICAL - NO SUPPLY". Investigation reveals corridor.sl has wrong references to deck 3 systems.

**The Core Problem:**
The corridor's `.sl` file contains WRONG REFERENCES - not disabled state, but incorrect node references:
- `power_source: junction_3b` → should be `junction_4a`
- `air_supply: scrubber_alpha` → should be `scrubber_beta`

**Solution:**
1. Open corridor.sl - see wrong references (junction_3b, scrubber_alpha)
2. Check ship_systems.sl - find deck 4 systems (junction_4a, scrubber_beta)
3. Fix references in corridor.sl to point to correct deck 4 systems
4. Lights come on, O2 stabilizes

**Why 2-hop matters:**
- Hop 1: corridor.sl contains wrong references
- Hop 2: ship_systems.sl reveals correct references
- Player must cross-reference between files

**What this teaches:**
- Definitions contain references to other nodes
- References must point to correct/appropriate systems
- Multiple files work together to define the ship
- The ship has topology (deck 3 vs deck 4 systems)

**What this does NOT teach (saved for later):**
- Version control (slvc) - too early
- Permissions - not blocked yet
- Signals - not needed here
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Corridor room exists with STATUS terminal and engineering terminal
- [ ] #2 ship_systems.sl file defines deck 3 and deck 4 power/atmo systems
- [ ] #3 corridor.sl file initially has wrong references (deck 3 instead of deck 4)
- [ ] #4 Corridor starts dark with O2 dropping when player enters
- [ ] #5 STATUS terminal shows "NO SOURCE" / "NO SUPPLY" errors
- [ ] #6 Fixing references in corridor.sl restores power and O2
- [ ] #7 Lights come on and O2 stabilizes when puzzle is solved
- [ ] #8 Victory condition: player reaches end of corridor with stable atmosphere
<!-- AC:END -->
