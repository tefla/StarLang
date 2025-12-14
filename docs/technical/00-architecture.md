# System Architecture

## The Three-Layer Model

StarLang uses a strict three-layer architecture separating definitions, physical layout, and runtime state.

```
┌─────────────────────────────────────────────────────────┐
│                    RUNTIME STATE                         │
│         (Current values, player actions, simulation)     │
│                     [Ephemeral]                          │
├─────────────────────────────────────────────────────────┤
│                   LAYOUT FILES                           │
│      (Physical positions, hardware damage status)        │
│                   [Read-only to player]                  │
├─────────────────────────────────────────────────────────┤
│                  STARLANG FILES (.sl)                    │
│        (Definitions, connections, behaviours)            │
│                   [Player editable]                      │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: StarLang Files (.sl)

**What they are**: The ship's operating system definitions.

**What they contain**:
- Node declarations (rooms, doors, vents, junctions, sensors)
- References to other nodes (`power_source: junction_4a`)
- Configuration values (`flow_rate: 2.4`, `target_temp: 22C`)
- Behaviour definitions (`on_open: { ... }`)
- Signal handlers and conditions
- Permission requirements

**What they DO NOT contain**:
- Current state (`state: OPEN` ❌)
- Runtime values (`current_temp: 22.4` ❌)
- Enabled/disabled flags (`enabled: false` ❌)
- Physical positions or geometry

**Correctness guarantee**: StarLang files are **correct when delivered by the shipyard**. The ship's OS was properly written and tested before launch.

**How they can be broken** (late-game puzzle scenarios):
- **Malicious intent**: Someone (saboteur?) deliberately changed the code
- **Bad repair job**: A crew member tried to fix something and made it worse
- **The incident**: Whatever happened during the journey corrupted some files

These scenarios require **slvc** (version control) to investigate:
- `slvc log` shows who changed what and when
- `slvc diff` reveals what was changed
- `slvc revert` can restore previous versions

**Player interaction**: Editable via engineering terminals.

---

## Layer 2: Layout Files (.layout.json)

**What they are**: Physical world definition - the 3D geometry and hardware state.

**What they contain**:
- 3D positions (x, y, z coordinates)
- Rotations (degrees)
- Room sizes (width, height, depth)
- Physical hardware status (`status: "FAULT"`, `status: "DAMAGED"`)
- Prop placements
- Visual/geometric properties

**What they DO NOT contain**:
- Logical connections (those are in .sl files)
- Behaviour definitions
- Permission rules

**Hardware damage**: Physical damage from "the incident" is recorded in layout files:
```json
{
  "switches": {
    "door_switch": {
      "position": { "x": 2.5, "y": 1.2, "z": -2.8 },
      "status": "FAULT"  // Physical damage - sparks when pressed
    }
  },
  "junctions": {
    "junction_4a": {
      "position": { "x": 0, "y": 2.5, "z": 0 },
      "status": "DAMAGED"  // Physical damage - offline
    }
  }
}
```

**Composition**: Multiple layout files can be combined to create the full game world:
- `galley.layout.json` - Galley room layout
- `corridor.layout.json` - Corridor layout
- `ship_systems.layout.json` - Infrastructure positions

**Player interaction**: Read-only. A cook can reconfigure software, but can't physically move walls or repair hardware.

---

## Layer 3: Runtime State

**What it is**: Current values that change during gameplay.

**Sources of state**:
1. **Default values**: Initialized from layout files when game starts
2. **Simulation**: Atmosphere depletes, temperatures change, sensors update
3. **StarLang execution**: Signals trigger, conditions evaluate, actions fire
4. **Player actions**: Opening doors, pressing switches, editing code

**What it contains**:
- Door states (OPEN, CLOSED, SEALED, JAMMED)
- Sensor readings (O2 level, temperature, pressure)
- Signal states (active/inactive)
- Room occupancy
- Power status per system

**Lifecycle**:
- Created when game starts
- Updated every tick by simulation
- Updated by player actions
- Updated when .sl files are recompiled
- Preserved across hot-reloads (editing doesn't reset state)
- Lost when game ends (unless saved)

**Player interaction**: Indirect. Player changes state by:
- Editing .sl files (triggers recompile, may change state)
- Pressing switches (direct state change)
- Moving through doors (occupancy changes)

---

## How The Layers Interact

### Example: Opening a Door

```
1. LAYOUT defines:
   - Door position in 3D space
   - Switch position on wall
   - Switch status: "OK" (working) or "FAULT" (broken)

2. STARLANG defines:
   - door galley_exit { control: door_switch, ... }
   - What the switch is connected to

3. STATE tracks:
   - Current door state: CLOSED
   - Switch last pressed: never

4. PLAYER presses switch:
   - If switch status is "FAULT" (layout): sparks, nothing happens
   - If switch status is "OK" (layout):
     - Runtime reads .sl to find what switch controls
     - State changes: door_state → OPEN
     - 3D scene updates to show open door
```

### Example: Puzzle 1 (Broken Switch)

```
LAYOUT: door_switch.status = "FAULT" (physical damage)
STARLANG: door galley_exit { control: door_switch } (correct code)
STATE: door_state = CLOSED

Problem: Switch is physically broken (layout), code is correct (sl)
Solution: Edit .sl to bypass broken hardware:
  - Remove control reference, OR
  - Point to different switch

After edit:
STARLANG: door galley_exit { control: light_switch } (adapted)
STATE: door can now be opened via light switch
```

### Example: Puzzle 2 (Damaged Junction)

```
LAYOUT: junction_4a.status = "DAMAGED" (physical damage)
        junction_4b.status = "STANDBY" (backup, working)
STARLANG: corridor { power_source: junction_4a } (correct code)
STATE: corridor.powered = false (damaged junction can't provide power)

Problem: Code correctly references junction_4a, but hardware is damaged
Solution: Reroute to backup:
  - Edit .sl: power_source: junction_4b

After edit:
STATE: corridor.powered = true (backup junction provides power)
```

---

## Key Design Principles

### 1. StarLang is Never "Buggy Out of the Box"

The shipyard delivered correct code. If .sl files are wrong, there's a story reason:
- Sabotage (someone changed them maliciously)
- Bad repair (crew tried to fix something wrong)
- Corruption (the incident damaged data)

Early puzzles: Hardware damage, work around with software
Late puzzles: Investigate WHO changed the code using slvc

### 2. Physical Damage is in Layout, Not StarLang

```
WRONG: door_switch { status: "FAULT" }  // State in .sl file

RIGHT: Layout file contains hardware status
       .sl file just references the switch
       Runtime checks layout status when switch is pressed
```

### 3. State is Ephemeral, Definitions are Persistent

- Editing .sl files creates new definitions
- State is preserved across edits where possible
- But editing definitions CAN affect state (changing a reference may power something on/off)

### 4. The Ship Has Redundancy

Physical systems have backups (this is realistic engineering):
- Multiple power junctions per deck
- Backup atmosphere scrubbers
- Alternative routing paths

Puzzles involve discovering and activating these alternatives.

---

## File Organization

```
src/content/ship/
├── galley.sl              # StarLang: Galley definitions
├── galley.layout.json     # Layout: Galley 3D positions
├── corridor.sl            # StarLang: Corridor definitions
├── corridor.layout.json   # Layout: Corridor 3D positions
├── ship_systems.sl        # StarLang: Ship-wide systems
└── ship_systems.layout.json

src/runtime/
├── Runtime.ts             # Manages state
├── StateStore.ts          # State storage and subscriptions
└── Simulation.ts          # Tick-based updates

src/compiler/
├── compiler.ts            # Compiles .sl to definitions
└── parser.ts              # Parses StarLang syntax
```

---

## Summary Table

| Aspect | StarLang (.sl) | Layout (.json) | State (runtime) |
|--------|----------------|----------------|-----------------|
| Contains | Definitions, connections, behaviour | Positions, geometry, hardware status | Current values |
| Player editable | Yes | No | Indirectly |
| Persistence | Files on disk | Files on disk | Memory only |
| Changes when | Player edits | Never (during gameplay) | Every tick |
| Example | `door { control: switch_a }` | `switch_a: { status: "FAULT" }` | `door_state: CLOSED` |
