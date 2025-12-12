# Appendix F: Scope Cuts

## Overview

This document tracks features considered but cut for jam scope, and features that could be added post-jam. Use this for planning what to cut if running short on time, and what to add if there's time left.

---

## Jam Scope (Must Have)

These features define the minimum viable game:

### Core Loop
- [x] Player can move between rooms
- [x] Player can interact with terminals
- [x] Player can view and edit StarLang files
- [x] Hot-reload works (edit → compile → state preserved)
- [x] O2 system works (levels change based on config)
- [x] Doors can be opened/closed/sealed

### Puzzles
- [x] O2 crisis (first puzzle, teaches editing)
- [x] At least one door puzzle
- [x] At least one permission puzzle

### UI (In-World)
- [x] 3D immersive environment (no HUD/split-screen)
- [x] In-world status displays (wall-mounted screens)
- [x] In-world engineering terminal (3D workstation)
- [x] First-person movement (WASD + mouse look)
- [x] Terminal interaction system (approach + E key)

### Narrative
- [x] Wake-up scenario
- [x] Environmental storytelling via slvc logs
- [x] At least one ending

---

## Should Have (If Time Permits)

Features that significantly improve the experience:

### Gameplay
- [ ] Command terminal (text queries)
- [ ] More puzzle variety (3-5 total)
- [ ] Multiple solution paths per puzzle
- [ ] Hint system via documentation

### Systems
- [ ] Temperature system
- [ ] Power management
- [ ] Multiple signals interacting

### Narrative
- [ ] Multiple endings (3)
- [ ] Okafor's research notes
- [ ] More crew backstory via logs

### Polish
- [ ] Sound effects (basic set)
- [ ] Ambient audio
- [ ] Status animations
- [ ] Error messages with suggestions

---

## Nice to Have (Stretch Goals)

Features that would be great but aren't essential:

### Gameplay
- [ ] Application terminals (GUI controls)
- [ ] Inventory system
- [ ] Physical item puzzles
- [ ] More complex signal chains

### Systems
- [ ] Full atmosphere simulation
- [ ] Fire system
- [ ] Security cameras
- [ ] Intercom system

### Narrative
- [ ] Character portraits
- [ ] More detailed timeline
- [ ] Hidden endings
- [ ] Post-game content

### Polish
- [ ] Full sound design
- [ ] Music (ambient)
- [ ] Particle effects
- [ ] Save/load system

---

## Won't Have (Post-Jam)

Features explicitly out of scope for the jam:

### Scope Limits
- **No VR**: Standard first-person 3D only
- **No real-time combat**: Puzzle/exploration only
- **No voice acting**: Text only
- **No multiplayer**: Single-player experience
- **No mobile**: Desktop browser target

### Technical Limits
- **No persistent saves**: Session-based (refresh = restart)
- **No cloud features**: Fully client-side
- **No procedural generation**: Hand-crafted content
- **No mod support**: Fixed content

### Content Limits
- **Single ship area**: Deck 4 only for jam
- **Limited crew**: 3-5 relevant characters
- **One main storyline**: No branching narratives

---

## Cut Features (Considered but Removed)

Features we designed but decided not to implement:

### Complex Atmosphere Model
**Original idea**: Full fluid dynamics simulation with pressure equalization, gas mixing, leak rates.

**Why cut**: Too complex for jam scope. The simplified "O2 level per room" model conveys the same gameplay.

**If restored**: Would need significant runtime work, probably not worth it even post-jam.

### Crew AI
**Original idea**: NPCs wandering the ship, conversations, giving hints.

**Why cut**: Massive scope increase. The "everyone in stasis" premise elegantly sidesteps this.

**If restored**: Would fundamentally change the game feel. Probably a different game.

### Real-Time Elements
**Original idea**: Time pressure on puzzles, O2 dropping in real-time.

**Why cut**: Conflicts with the "thinking puzzle" feel. Players need time to read and understand code.

**If restored**: Could be an optional "hardcore" mode, but tick-based works fine.

### Multiple Decks
**Original idea**: Full ship exploration across 5 decks.

**Why cut**: Content multiplication. Each deck needs rooms, puzzles, terminals, narrative.

**If restored**: Natural expansion path. Each deck could be a "chapter."

### Crafting/Inventory
**Original idea**: Find items, combine them, use them in puzzles.

**Why cut**: Shifts focus from code to adventure game mechanics. StarLang should be the puzzle.

**If restored**: Could work for physical puzzles (find key card → use on door), but keep minimal.

### Dialogue System
**Original idea**: Conversations with ship AI, recorded messages.

**Why cut**: Writing-heavy, needs audio or lots of text. Logs and commits tell the story.

**If restored**: Ship AI assistant could be interesting ("ARIA, what's the status?").

---

## Prioritised Cut List

If running out of time, cut in this order:

### First to Cut
1. Multiple endings → Single ending is fine
2. Sound effects → Silent is acceptable
3. Temperature system → Focus on O2 only
4. Command terminal → Engineering terminal is enough

### Second to Cut
5. Permission puzzles → Focus on pure code puzzles
6. Multiple solution paths → One solution per puzzle
7. Environmental storytelling → Minimal narrative
8. Ship map details → Box-and-line diagram

### Last Resort Cuts
9. Hot-reload → Could require restart on save (worse UX)
10. Door puzzles → Only O2 puzzle
11. slvc (version control) → No history viewing
12. Syntax highlighting → Plain text editor

### Never Cut
- Basic editing → Core mechanic
- O2 system → Defines the crisis
- Compile feedback → Players need errors
- At least one puzzle → It's a puzzle game

---

## Post-Jam Roadmap

If continuing development after the jam:

### Phase 1: Polish
- Add sound design
- Improve error messages
- Add hint system
- Multiple solutions per puzzle

### Phase 2: Content
- More puzzles (10+ total)
- Full narrative with multiple endings
- Expanded ship area (more of Deck 4)
- More environmental storytelling

### Phase 3: Systems
- Temperature system
- Power management
- Fire and safety systems
- More complex signal interactions

### Phase 4: Expansion
- Additional decks
- New puzzle types
- Hidden content
- Achievement system

---

## Time Estimates

Rough estimates for jam implementation:

| Feature | Time | Priority |
|---------|------|----------|
| Core runtime (parse, compile, run) | 8-12 hrs | Must |
| 3D environment + player controller | 6-10 hrs | Must |
| In-world terminal system | 4-6 hrs | Must |
| O2 system | 2-3 hrs | Must |
| Door system | 2-3 hrs | Must |
| First puzzle (O2 fix) | 1-2 hrs | Must |
| slvc (version control) | 3-4 hrs | Should |
| Second puzzle | 1-2 hrs | Should |
| Third puzzle | 1-2 hrs | Should |
| Narrative content | 2-4 hrs | Should |
| Sound effects | 2-3 hrs | Nice |
| Polish/testing | 2-4 hrs | Must |

**Total estimate**: 30-50 hours for "should have" scope

---

## Decision Log

Key decisions made during design:

| Decision | Rationale |
|----------|-----------|
| Cook protagonist | Non-technical character learning = player learning |
| Everyone in stasis | Avoids NPC complexity, explains isolation |
| 3D immersive (no HUD) | Full immersion, terminals as physical objects |
| Tick-based not real-time | Allows thinking time for puzzles |
| Hot-reload core feature | Defines the "programming game" feel |
| Version control included | Narrative delivery + safety net |
| Permission system | Progression without combat |
| Signal-based reactivity | Enables puzzle chains |
