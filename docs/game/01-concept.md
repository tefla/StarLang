# Game Concept

## Core Loop

The player's experience cycles through five phases:

**Discover → Investigate → Understand → Solve → Uncover**

### Discover

Something is wrong. An alarm blares. A door won't open. The O2 meter is dropping. The game presents problems through environmental cues, status displays, and system alerts—not tutorial popups.

### Investigate

The player queries systems to understand the current state. What's the O2 level? Why is this door sealed? What's drawing so much power? Early game, this is poking at terminals and reading status screens. Later, it's using `slvc log` to see who changed what and when.

### Understand

Investigation leads to source files. The player finds the StarLang definition that governs the broken system. At first, the code is intimidating. But the syntax is readable, the structure is logical, and necessity is a powerful teacher.

### Solve

Understanding enables solutions. Maybe it's a simple edit—change a target, flip a flag. Maybe it's a hack—exploit a permission gap, trigger a cascade of signals. Maybe it's a workaround—the "right" solution is locked behind permissions you don't have, so you find another way.

### Uncover

Each solution grants access to more of the ship. More terminals. More logs. More history. The mystery of what happened unfolds not through cutscenes but through `slvc log` entries, corrupted commit messages, and configuration changes made minutes before the disaster.

---

## Genre Definition

**StarLang** sits at the intersection of several genres:

### Survival Game (Lite)

Resources are finite. O2 depletes. Power drains. Food spoils. But this isn't a survival sim with hunger meters and crafting trees. Resources create urgency and stakes, not busywork.

### Puzzle Game

Each blocked path is a puzzle. The solution is always in the code—understanding what's there, figuring out what to change, predicting the consequences. Puzzles are systemic, not arbitrary.

### Immersive Sim (Minimal)

Problems have multiple solutions. The "intended" solution might require permissions you don't have. The clever solution exploits a legacy relay with engineer credentials. The brute-force solution triggers a fire alarm to unlock doors. Player creativity is rewarded.

### Mystery / Walking Simulator

The narrative is environmental. Logs, commit histories, personal effects, terminal sessions left open. The player pieces together the story through exploration, not exposition.

---

## Player Experience Goals

### First Five Minutes

- Wake up disoriented
- Immediately feel the danger (alarm, O2 warning)
- Discover you're a cook with limited access
- Find a terminal you can actually use
- See StarLang code for the first time
- Make a change that has an immediate effect (even if it's wrong)
- Survive long enough to explore

### First Thirty Minutes

- Understand the basics of StarLang syntax
- Learn to use `status` and `inspect` commands
- Solve 2-3 puzzles of increasing complexity
- Gain access to at least one new area
- Find the first clue about what happened
- Feel competent but aware of how much you don't know

### Full Playthrough

- Explore most of the ship
- Solve environmental puzzles (atmosphere, power, doors)
- Escalate permissions through legitimate and illegitimate means
- Uncover the core mystery (what happened, who's responsible)
- Face a final challenge that tests mastery of the language
- Reach an ending (multiple endings possible based on choices)

---

## Scope Boundaries

### In Scope (Jam Version)

- 5-8 rooms across 2-3 areas
- 3-5 major puzzles
- 1 complete narrative thread
- Core StarLang features (rooms, doors, atmosphere, power, sensors, relays)
- Basic version control (log, diff, revert)
- 2-3 terminal types (status display, engineering workstation)

### Stretch Goals

- More rooms and puzzles
- Branching narrative
- Multiple endings
- Simulation mode for testing changes
- More node types (communications, navigation)
- Physical junction boxes (non-code puzzles)

### Out of Scope

- Multiplayer
- Procedural generation
- Combat
- Real-time threats (everything waits for player action, despite "real-time" displays)
- Save/load (jam scope—single session expected)

---

## Difficulty Philosophy

### Learning Curve, Not Difficulty Curve

The game gets harder because you encounter more complex systems, not because the puzzles become artificially obscure. Early puzzles are simple once you understand the basics. Late puzzles require combining multiple systems, but each component is something you've seen before.

### No Fail States (Almost)

Running out of O2 or power ends the game, but the margin should be generous enough that any engaged player won't hit it accidentally. The threat creates urgency; actually dying feels like a bug.

### Hints Through Documentation

The ship's (verbose, poorly organised) manuals contain everything you need. The puzzle is often finding the right section. If stuck, the player can always dig deeper into docs rather than hitting a wall.

---

## Emotional Arc

| Phase | Player Feels |
|-------|--------------|
| Wake up | Confused, alarmed |
| First crisis | Panicked, overwhelmed |
| First success | Relief, maybe surprise ("I did that?") |
| Exploration | Curiosity, growing confidence |
| Finding clues | Intrigue, maybe dread |
| Mid-game | Competent, invested in the mystery |
| Discovering the truth | Depends on the story—horror? tragedy? anger? |
| Final challenge | Tension, mastery |
| Ending | Catharsis, satisfaction |

---

## Why This Works for LangJam

LangJam requires building a language and a game that uses it. The common failure mode is:

1. Build a cool language
2. Bolt on a trivial game that doesn't really exercise the language
3. The language feels pointless

StarLang avoids this because:

- **The game IS learning the language**: The player's journey mirrors learning to program
- **The language has real complexity**: Permission systems, signal propagation, state vs definition—these aren't trivial
- **The puzzles require the language**: You can't solve them without reading and writing StarLang
- **The narrative is embedded in the language**: Version control history, corrupted commits, permission logs—the story is told through code

The language isn't a gimmick. It's the point.
