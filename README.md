# StarLang: A LangJam Game Project

> A survival/discovery game where the ship *is* the programming language.

---

## Overview

**StarLang** is a LangJam entry that combines a domain-specific ship definition language with a 2D top-down survival game. The player awakens as a cook on a damaged interstellar vessel, alone except for hundreds of crew in inaccessible stasis pods. With no programming knowledge and minimal system permissions, they must learn to read, understand, and eventually modify StarLang code to survive—and uncover what happened.

The language "compiles" into a reactive ship simulation. Definitions describe structure and behaviour; runtime state (temperatures, O2 levels, door positions) is tracked separately and persists across recompiles. This separation enables hot-reloading without losing game progress.

### Core Concept

- **One language, one ship**: StarLang defines everything—rooms, doors, sensors, relays, power systems, atmosphere controls, permissions
- **The player learns with the character**: A cook with no technical background discovers programming through necessity
- **Survival drives discovery**: Immediate crises (depleting O2) force engagement before the player can overthink
- **The mystery unfolds through access**: As permissions expand, logs and configurations reveal what happened

### Genre & Scope

- 2D top-down point-and-click
- Split-screen: ship map on the right, terminals/documents on the left
- Target playtime: 30-60 minutes (jam scope)
- Single-player, narrative-driven puzzle game

---

## Table of Contents

### Game Design

| Document | Description |
|----------|-------------|
| [01-concept.md](docs/game/01-concept.md) | Core game loop, genre, player experience |
| [02-narrative.md](docs/game/02-narrative.md) | Story, character, the mystery, themes |
| [03-puzzles.md](docs/game/03-puzzles.md) | Puzzle design, difficulty progression, examples |
| [04-ui-layout.md](docs/game/04-ui-layout.md) | Screen layout, terminal interfaces, visual design |
| [05-progression.md](docs/game/05-progression.md) | How the player gains access and abilities over time |

### Language Specification

| Document | Description |
|----------|-------------|
| [01-syntax.md](docs/language/01-syntax.md) | StarLang grammar, constructs, keywords |
| [02-ship-structure.md](docs/language/02-ship-structure.md) | File/folder organisation, the .sl file format |
| [03-permissions.md](docs/language/03-permissions.md) | Access control, credentials, permission escalation |
| [04-node-types.md](docs/language/04-node-types.md) | Rooms, doors, sensors, relays, terminals, etc. |
| [05-signals.md](docs/language/05-signals.md) | The signal system: events, triggers, propagation |
| [06-examples.md](docs/language/06-examples.md) | Annotated example ship definitions |

### Runtime Architecture

| Document | Description |
|----------|-------------|
| [01-architecture.md](docs/runtime/01-architecture.md) | High-level system design, compilation pipeline |
| [02-state-management.md](docs/runtime/02-state-management.md) | Separating definitions from runtime state |
| [03-reactive-updates.md](docs/runtime/03-reactive-updates.md) | Signal graph, event propagation, time-varying nodes |
| [04-reconciliation.md](docs/runtime/04-reconciliation.md) | Hot-reload without state loss |
| [05-version-control.md](docs/runtime/05-version-control.md) | slvc: history, diff, revert |

### Technical Implementation

| Document | Description |
|----------|-------------|
| [01-implementation.md](docs/technical/01-implementation.md) | Core types, classes, data structures |
| [02-ui-binding.md](docs/technical/02-ui-binding.md) | How the UI subscribes to ship state |
| [03-terminal-types.md](docs/technical/03-terminal-types.md) | GUI terminals vs StarLang editors |
| [04-parser.md](docs/technical/04-parser.md) | Parsing StarLang into AST |
| [05-compiler.md](docs/technical/05-compiler.md) | Compiling AST into runtime structures |

### Appendices

| Document | Description |
|----------|-------------|
| [A-glossary.md](docs/appendices/A-glossary.md) | In-universe and technical terminology |
| [B-ship-manifest.md](docs/appendices/B-ship-manifest.md) | The UTS Meridian: decks, sections, crew |
| [C-timeline.md](docs/appendices/C-timeline.md) | What happened before the player wakes up |
| [D-art-direction.md](docs/appendices/D-art-direction.md) | Visual style, UI aesthetics, mood |
| [E-audio-direction.md](docs/appendices/E-audio-direction.md) | Sound design, ambient audio, music |
| [F-scope-cuts.md](docs/appendices/F-scope-cuts.md) | Features to cut if time runs short |

---

## Quick Start

### The Elevator Pitch

You wake up alone on a damaged ship. You're a cook. The O2 is running out. The only way to survive is to learn the ship's programming language—StarLang—and hack your way to safety.

### The Language in 30 Seconds

```starlang
room galley {
  display_name: "Galley"
  deck: 4
  adjacent: [crew_mess, cold_storage, corridor_4a]
}

door galley_to_corridor {
  connects: [galley, corridor_4a]
  lock: EMERGENCY_SEAL
  
  unseal_requires: ANY [
    credential(OFFICER),
    signal(atmo_local.all_clear)
  ]
}

sensor temp_galley {
  location: galley
  type: TEMPERATURE
  
  on_reading: |temp| {
    if temp > 50C { trigger(alarm.fire) }
  }
}
```

### The Loop

1. **Discover** a problem (door won't open, O2 depleting, system offline)
2. **Investigate** using status queries and whatever documentation you can find
3. **Understand** by finding and reading the relevant StarLang definitions
4. **Solve** by modifying code, rerouting signals, or exploiting permission gaps
5. **Uncover** fragments of what happened as you gain deeper access

---

## Design Principles

### 1. The Language is Learnable

A cook with no programming background needs to be able to figure this out. That means:
- Readable, English-like syntax
- Meaningful error messages
- Discoverable structure (autocomplete, documentation)
- Problems that can be solved by small, local changes

### 2. Physical Presence Matters

You can't do everything from one terminal. Different terminals have different access. Some things require being physically present. This creates:
- Reasons to explore the ship
- Puzzle gating that feels natural
- A sense of the ship as a real place

### 3. State Persists

When you fix the O2 routing, the O2 you lost doesn't come back. When you revert a file, the physical damage remains. The ship has history and momentum.

### 4. The Mystery is Optional

Survival is mandatory. Understanding what happened is a reward for curiosity. The player can "win" without uncovering everything, but the full story is there for those who dig.

### 5. Failure is Interesting

Bad code doesn't crash the game—it has consequences. Reroute power wrong and something else goes dark. The ship is resilient enough to survive your mistakes, but mistakes matter.

---

## Project Status

- [x] Core concept defined
- [x] Language design sketched
- [x] Runtime architecture planned
- [ ] Parser implementation
- [ ] Runtime implementation
- [ ] UI implementation
- [ ] Content (ship, puzzles, narrative)
- [ ] Playtesting
- [ ] Polish

---

## License

TBD (LangJam submission)

---

*Last updated: December 2024*
