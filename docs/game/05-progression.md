# Progression System

## Overview

The player progresses through three interrelated systems:

1. **Physical Access**: Which rooms and areas they can reach
2. **System Permissions**: Which StarLang files they can view/edit
3. **Knowledge**: What they understand about how things work

These three gates work together. Getting into a new room might reveal a terminal with new permissions. New permissions might let you open a door to a new room. Understanding a system might reveal how to bypass permission requirements.

---

## Physical Access

### Starting State

The player begins in the **Galley** with access to:

- Galley (starting room)
- Cold Storage (adjacent, unlocked)
- Crew Mess Hall (adjacent, but door is stuck—minor obstacle)

All other areas are blocked by:

- Emergency seals (atmosphere containment)
- Locked doors (permission required)
- Physical damage (debris, ice, hull breach)

### Expansion Paths

```
GALLEY (start)
    │
    ├── Cold Storage (immediate access)
    │       │
    │       └── Medical Bay Corridor (solve: frozen door)
    │               │
    │               └── Medical Bay Auxiliary (solve: permission or manual override)
    │
    ├── Crew Mess Hall (solve: stuck door mechanism)
    │       │
    │       ├── Crew Quarters Corridor (solve: emergency seal)
    │       │       │
    │       │       └── Individual Quarters (various locks)
    │       │
    │       └── Maintenance Junction 4A (solve: find access code)
    │               │
    │               └── Engineering Sublevel (solve: permission escalation)
    │
    └── Corridor 4A (solve: atmosphere crisis)
            │
            ├── Life Support Local (solve: engineering credentials)
            │
            └── Deck Access Elevator (solve: late game)
                    │
                    ├── Deck 1: Bridge Area (solve: major security)
                    │
                    └── Deck 2: Engineering (solve: clearance)
```

### Physical Obstacles

| Obstacle | Blocks | Solution |
|----------|--------|----------|
| Venting atmosphere | Corridor 4A | Fix O2 routing |
| Ice in mechanism | Cold Storage → Medical | Redirect heating |
| Stuck door | Galley → Mess | Kick it / power cycle |
| Emergency seal | Mess → Quarters | Trigger all-clear or fire alarm |
| Access code | Mess → Maintenance | Find it in documentation or on a body |
| Security door | Anywhere → Bridge | Major late-game puzzle |

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

| Milestone | Player Learns | Unlocked By |
|-----------|---------------|-------------|
| Files exist | The ship is defined in code | Opening first terminal |
| Status vs definition | Current state vs configured behaviour | First puzzle |
| Editing works | Changes affect the ship | Fixing O2 |
| Permissions limit access | You can't edit everything | First "access denied" |
| Signals connect things | Systems talk to each other | Reading a relay definition |
| Version control exists | Files have history | First `slvc` usage |
| Permissions have gaps | Legacy systems can be exploited | First permission bypass |
| State persists | The ship remembers | Reverting doesn't fix everything |
| Simulation is possible | (stretch goal) | Finding engineering workstation |

### Documentation as Progression

The ship's manuals are verbose and poorly organised—intentionally. Learning to navigate them is itself progression.

**Early game**: "Where is ANYTHING? There are thousands of documents!"

**Mid game**: "Okay, the naming convention is [SYSTEM]-[SUBSYSTEM]-[NUMBER]. Galley stuff is under COOK- or GALLEY-."

**Late game**: "I need the interlock specification, that'll be SAFETY-INTERLOCK-xxx... got it."

The player develops expertise organically.

---

## Pacing

### Act 1: Survival (10-15 minutes)

**Focus**: Immediate crisis, basic mechanics

- Fix O2 (learn editing)
- Get out of galley area (learn doors/seals)
- Find first engineering credentials
- Establish stable life support

**Feeling**: Panic → relief → curiosity

### Act 2: Exploration (15-20 minutes)

**Focus**: Expanding access, learning systems

- Open new areas
- Solve environmental puzzles
- Find logs and clues
- Piece together what happened

**Feeling**: Curiosity → competence → intrigue

### Act 3: Investigation (10-15 minutes)

**Focus**: The mystery, moral choices

- Access restricted systems
- Find Okafor's research
- Discover the anomaly
- Make endgame choices

**Feeling**: Intrigue → understanding → decision

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
