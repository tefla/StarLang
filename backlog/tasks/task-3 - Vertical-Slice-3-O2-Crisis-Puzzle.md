---
id: task-3
title: Vertical Slice 3 - O2 Crisis Puzzle (Puzzle 2)
status: To Do
assignee: []
created_date: '2025-12-14 08:38'
labels: []
dependencies: [task-2]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Puzzle 2: the O2 crisis. After escaping the galley (Puzzle 1), player discovers the corridor has an atmosphere emergency - O2 is venting to space due to a misconfigured outlet. This puzzle builds on skills learned in Puzzle 1 and introduces new concepts.

**Context:**
- **Puzzle 1 (complete)**: Door switch FAULT → edit galley.sl to bypass → teaches basic editing
- **Puzzle 2 (this VS)**: O2 venting → find and fix env_config.sl → teaches status vs config, tradeoffs

**Puzzle 2 Setup:**
Player enters corridor after solving Puzzle 1. The corridor STATUS terminal shows O2 dropping rapidly. Investigation reveals an atmosphere outlet is misconfigured to vent to `VOID.external`.

**Solution paths:**
1. **Basic**: Change outlet target to `corridor_intake` (closed loop - CO2 builds up slowly)
2. **Better**: Change target to `cold_storage.intake` (valid - but food spoils)
3. **Best**: Use `slvc revert` to restore original config (requires learning version control)

**What this teaches:**
- Status terminals show live state (observation)
- Configuration files control behavior (cause and effect)
- Multiple valid solutions have different tradeoffs (consequence thinking)
- The ship is a connected system (systems thinking)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Atmosphere outlet/intake nodes in StarLang (AtmoOutlet, AtmoIntake types)
- [ ] #2 O2 depletion rate varies based on outlet target (VOID = emergency drain)
- [ ] #3 env_config.sl file editable from corridor engineering terminal
- [ ] #4 Cold storage room accessible from corridor (provides solution option)
- [ ] #5 All three solution paths work and are detectable by runtime
- [ ] #6 STATUS terminals show O2 stabilizing when fixed
- [ ] #7 Cold storage temperature rises if used as outlet target (visible consequence)
- [ ] #8 Basic slvc commands (log, diff, revert) for "best" solution path
<!-- AC:END -->
