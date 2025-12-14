# Progression System

## Overview

The player progresses through three interrelated systems:

1. **Physical Access**: Which rooms and areas they can reach
2. **System Permissions**: Which StarLang files they can view/edit
3. **Knowledge**: What they understand about how things work

These three gates work together. Getting into a new room might reveal a terminal with new permissions. New permissions might let you open a door to a new room. Understanding a system might reveal how to bypass permission requirements.

---

## Learning Through Play (No Tutorials)

**Critical Design Principle**: The game teaches entirely through puzzles. There are no tutorials, hint systems, or instructional overlays. Every mechanic is discovered through necessity.

### Why No Tutorials

- Tutorials break immersion - Riley Chen doesn't have a floating hint system
- Tutorials assume the player is stupid - our players are problem-solvers
- Tutorials rob players of discovery - the "aha!" moment IS the reward
- Tutorials create dependency - players expect to be told what to do

### How Puzzles Teach

Each puzzle is designed to force discovery of exactly one or two mechanics:

| Puzzle | What It Forces Player to Discover |
|--------|-----------------------------------|
| 1 - Broken Switch | Terminals exist, code is editable, changes affect the world |
| 2 - O2 Crisis | STATUS shows live state, config files control behavior, tradeoffs exist |
| 3 - Frozen Door | Systems are connected, physical state differs from software state |
| 4 - Permission Block | Access control exists, legacy systems have gaps |
| 5 - Sealed Bridge | Systems can be chained, signals matter, documentation is useful |
| 6 - The Anomaly | Everything synthesized into a moral choice |

The player never reads "Press E to interact with terminals." They discover it because the door won't open, the switch is broken, and the glowing terminal is the only other object in the room.

See [03-puzzles.md](03-puzzles.md) for detailed puzzle designs and the "Anti-Tutorial Design" section.

---

## Physical Access

### Starting State

The player begins in the **Galley**, trapped:

- Galley (starting room) - locked in by Puzzle 1
- Corridor 4A (adjacent, blocked by broken door switch)
- Engineering Bay (beyond corridor, accessible after Puzzle 1)

**Current Implementation (VS1-VS2)**:
- Player spawns in galley at position (0, 0, 0)
- Door switch marked "FAULT" - sparks when pressed, doesn't work
- Engineering terminal mounts `galley.sl` - player must edit to escape
- Corridor has STATUS terminal showing atmosphere data
- Victory condition triggers when player enters corridor

All other areas blocked by:

- Broken mechanisms (Puzzle 1 - door switch)
- Atmosphere emergencies (Puzzle 2 - O2 venting)
- Locked doors (permission required)
- Physical damage (debris, ice, hull breach)

### Expansion Paths

```
GALLEY (start) ─────────────────────────────────────────────────────────
    │                                                                   │
    │  [PUZZLE 1: Broken Switch]                                        │
    │  Door switch is FAULT - must edit galley.sl to bypass             │
    │                                                                   │
    └── Corridor 4A ────────────────────────────────────────────────────
            │                                                           │
            │  [PUZZLE 2: O2 Crisis]                                    │
            │  Atmosphere venting to space - edit env_config.sl         │
            │                                                           │
            ├── Cold Storage (solution option for Puzzle 2)
            │       │
            │       └── Medical Bay Corridor (solve: frozen door - Puzzle 3)
            │               │
            │               └── Medical Bay (solve: permission)
            │
            ├── Engineering Bay (after Puzzle 2)
            │       │
            │       └── Maintenance Junction 4A (solve: find access)
            │               │
            │               └── Engineering Sublevel (solve: Puzzle 4)
            │
            └── Deck Access Elevator (late game)
                    │
                    ├── Deck 1: Bridge Area (solve: Puzzle 5)
                    │
                    └── Deck 2: Main Engineering (solve: clearance)
```

### Physical Obstacles

| Obstacle | Blocks | Solution | Puzzle |
|----------|--------|----------|--------|
| Broken door switch | Galley → Corridor | Edit code to bypass switch | 1 |
| O2 venting to space | Corridor progress | Fix outlet target in config | 2 |
| Ice in mechanism | Cold Storage → Medical | Redirect heating system | 3 |
| No charging access | Tablet dead | Permission exploitation | 4 |
| Security seal | Corridor → Bridge | Fake emergency signal | 5 |

---

## System Permissions

### The Permission Hierarchy

StarLang has a role-based permission system:

```
CAPTAIN
  └── OFFICER
        ├── SECURITY
        ├── ENGINEERING
        │     └── ENGINEERING_JUNIOR
        ├── MEDICAL
        ├── SCIENCE
        └── OPERATIONS
              ├── COOK         ← You are here
              ├── MAINTENANCE
              └── STEWARD
```

Each role grants access to specific files and terminals.

### Starting Permissions (COOK)

**Can View:**
- Galley systems
- Cold storage systems
- Crew mess public systems
- Public documentation
- Public ship directory

**Can Edit:**
- Galley environment config
- Galley inventory
- Cold storage temperature settings
- Meal planning systems

**Cannot Access:**
- Any engineering files
- Life support primary
- Power distribution
- Navigation
- Communications
- Security systems
- Personnel records
- Most other decks

### Permission Escalation Methods

#### Method 1: Found Credentials

Discover terminals left logged in, tablets with saved sessions, or credential tokens.

| Credential | Location | Unlocks |
|------------|----------|---------|
| ENGINEERING (Chen, M.) | Tablet in Maintenance Junction | Engineering files for Deck 4 |
| MEDICAL (Dr. Yusuf) | Terminal in Medical Bay | Medical systems, health records |
| OPERATIONS (Torres, J.) | Personal quarters | Operations-level files |
| ENGINEERING (Okafor, A.) | Engineering sublevel | Ship-wide engineering access |

Each found credential is a major progression moment.

#### Method 2: Permission Inheritance

Some legacy systems have permission configurations that can be exploited.

**Example**: The meal delivery relay

```starlang
relay food_delivery_relay {
  installed_by: credential(ENGINEER)
  runs_as: credential(ENGINEER)  # Runs with installer's permissions
  
  trigger: cold_storage.door_open AND galley.prep_status == ACTIVE
  action: announce(crew_mess, "Meal service beginning shortly.")
}
```

If you can modify what action this relay takes, it executes with ENGINEER permissions.

#### Method 3: Signal Exploitation

Signals bypass permissions if the sender is authorised.

**Example**: You can't edit the door, but fire suppression can unseal it

```starlang
door secure_door {
  unseal_requires: ANY [
    credential(SECURITY),
    signal(fire_suppression.all_clear)
  ]
}
```

Trigger fire suppression → wait for all-clear → door unseals.

#### Method 4: Classification Tricks

Systems are classified into categories. Sometimes classifications are wrong or exploitable.

**Example**: The charging port

The charging port requires ENGINEER access. But it's on the same power bus as emergency lighting, classified as PASSENGER_COMFORT. You can control passenger comfort systems. Create a "light" that's actually your tablet charging.

---

## Knowledge Progression

What the player *understands* is as important as what they can access.

### Concept Milestones

These are learned through puzzles, never through instruction:

| Milestone | Player Learns | Forced By Puzzle |
|-----------|---------------|------------------|
| Terminals are interactive | Walk up, press E | Puzzle 1 - no other option |
| Code defines the ship | Files control physical objects | Puzzle 1 - door won't open otherwise |
| Editing causes change | Save → recompile → world updates | Puzzle 1 - first successful edit |
| Status shows live state | STATUS terminals reflect reality | Puzzle 2 - O2 dropping visible |
| Config vs structure | Separate files for different concerns | Puzzle 2 - env_config.sl |
| Tradeoffs exist | Solutions have consequences | Puzzle 2 - cold storage warms up |
| Systems connect | One thing affects another | Puzzle 3 - heating thaws door |
| Permissions exist | Some files are restricted | Puzzle 4 - "access denied" |
| Permissions have gaps | Legacy systems exploitable | Puzzle 4 - fake lighting node |
| Version control exists | Files have history | Puzzle 2 (best solution) - slvc |
| Signals chain systems | A→B→C dependencies | Puzzle 5 - sensor→alarm→door |
| Choices matter | Final decision has weight | Puzzle 6 - moral choice |

### Documentation as Progression

The ship's manuals are verbose and poorly organised—intentionally. Learning to navigate them is itself progression.

**Early game**: "Where is ANYTHING? There are thousands of documents!"

**Mid game**: "Okay, the naming convention is [SYSTEM]-[SUBSYSTEM]-[NUMBER]. Galley stuff is under COOK- or GALLEY-."

**Late game**: "I need the interlock specification, that'll be SAFETY-INTERLOCK-xxx... got it."

The player develops expertise organically.

---

## Pacing

### Act 1: Survival (10-15 minutes)

**Puzzles**: 1 (Broken Switch) → 2 (O2 Crisis)

**Focus**: Immediate crisis, discovering core mechanics through necessity

- Wake up trapped (galley)
- Discover terminals exist, code is editable (Puzzle 1)
- Escape to corridor, face O2 emergency (Puzzle 2)
- Learn status vs config, experience tradeoffs

**Feeling**: Confusion → experimentation → success → new crisis → resolution

**Current Implementation Status**: VS1 complete (Puzzle 1), VS3 planned (Puzzle 2)

### Act 2: Exploration (15-20 minutes)

**Puzzles**: 3 (Frozen Door) → 4 (Permission Block)

**Focus**: Expanding access, discovering system interconnections

- Access cold storage, discover frozen door
- Learn systems affect each other (Puzzle 3)
- Find dead tablet, need to charge it
- Learn permissions exist and can be bypassed (Puzzle 4)
- Find first engineering credentials

**Feeling**: Curiosity → competence → "I can hack this ship" confidence

### Act 3: Investigation (10-15 minutes)

**Puzzles**: 5 (Sealed Bridge) → 6 (The Anomaly)

**Focus**: The mystery, complex system chaining, moral choice

- Need bridge access, face real security
- Chain multiple systems to fake an emergency (Puzzle 5)
- Discover Okafor's research, find the anomaly
- Make final choice about the unknown code (Puzzle 6)

**Feeling**: Intrigue → mastery → uncertainty → decision

---

## Gating Philosophy

### Hard Gates

Some things are absolutely blocked until you have the right access:

- Bridge: Requires captain-level access or a complex multi-step bypass
- Stasis control: Requires medical + engineering + security (endgame)
- The anomaly: Requires deep engineering access + investigation

Hard gates are rare. They mark major story beats.

### Soft Gates

Most progression is soft-gated—you *could* bypass it early if you're clever:

- The frozen door could be forced with enough engineering access
- The emergency seal could be bypassed by faking an evacuation signal
- Documentation could be found in multiple places

Soft gates reward exploration and experimentation.

### No Invisible Walls

If the player can see a door, they should be able to inspect it and understand why it's locked. No "this door is locked" with no further information. Always:

```
> status door_to_bridge

DOOR: door_to_bridge
  state: SEALED
  lock: SECURITY_SEAL
  unseal_requires: credential(CAPTAIN) OR signal(bridge.internal_emergency)
  
  You do not have CAPTAIN credentials.
  No internal emergency signal detected.
```

The player knows exactly what they need. Finding *how* to get it is the puzzle.

---

## Tracking Progression

### Internal State

The game tracks:

- Which rooms the player has visited
- Which terminals they've accessed
- Which credentials they've acquired
- Which puzzles they've solved
- Which story elements they've discovered
- Version control state (for revert functionality)

### Player-Visible Progress

Unlike most games, explicit progress indicators ("42% complete") would break immersion. Instead:

- The ship map fills in as you explore
- Terminals remember what you've accessed
- Your command history persists
- Logs show when you first viewed them

The player can see their own footprints without gamified progress bars.
