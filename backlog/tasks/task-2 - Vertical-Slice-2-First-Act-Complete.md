---
id: task-2
title: Vertical Slice 2 - First Act Complete (Puzzle 1)
status: In Progress
assignee: []
created_date: '2025-12-12 17:58'
labels: []
dependencies: [task-1]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete Puzzle 1 (Broken Switch) as the opening experience. Player wakes in galley, discovers the door switch is broken, must use engineering terminal to edit galley.sl and bypass the switch to escape.

**Design Philosophy**: No tutorials or hints. The puzzle itself teaches the core mechanic (terminals exist, code is editable, changes affect the world) through necessity. See docs/game/03-puzzles.md for "Anti-Tutorial Design" principles.

**Current Status**: Most features implemented, needs final polish and commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Separate StarLang files from physical layout data (JSON layout file)
- [x] #2 Status terminals display live room state (O2, temp, pressure)
- [x] #3 Basic atmosphere system with O2 depletion
- [x] #4 Player can escape galley and reach corridor (via code editing)
- [x] #5 Victory message when reaching corridor
- [x] #6 Broken switch provides clear failure feedback (sparks, no action)
- [ ] #7 Polish pass: commit uncommitted changes, verify all systems work
<!-- AC:END -->
