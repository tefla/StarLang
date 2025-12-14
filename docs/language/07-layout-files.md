# Layout Files

> See also: [System Architecture](../technical/00-architecture.md) for the full three-layer model.

## Separation of Concerns

StarLang uses a **three-layer architecture**:

| Layer | File Type | Contains | Player Editable |
|-------|-----------|----------|-----------------|
| **Definitions** | `.sl` (StarLang) | Logical structure, connections, behaviours | Yes |
| **Layout** | `.layout.json` | Physical positions, hardware status | No (read-only) |
| **State** | Runtime only | Current values (O2, door states, etc.) | Indirectly |

This separation reflects reality: a cook can reconfigure door access rules, but can't physically move walls or repair damaged hardware.

---

## StarLang Files (.sl)

Define the logical structure of the ship:

```starlang
# galley.sl - What the player can edit

room galley {
  display_name: "Galley"
  deck: 4
  section: 7
  adjacent: [crew_mess, cold_storage, corridor_4a]
  capacity: 6
}

door galley_exit {
  display_name: "Galley Exit"
  connects: [galley, corridor_4a]
  locked: false
  access: credential(CREW) OR HIGHER
}

terminal galley_engineering {
  display_name: "Engineering Terminal"
  terminal_type: ENGINEERING
  location: galley
  mounted_files: ["galley.sl"]
}
```

**What belongs in .sl files:**
- Node identifiers and display names
- Logical connections (adjacent rooms, door connects)
- Access controls and permissions
- Behaviours and event handlers
- Signals and conditions
- System references

**What does NOT belong in .sl files:**
- Physical positions (x, y, z)
- Rotations
- Sizes and dimensions
- 3D geometry details

---

## Layout Files (.layout)

Define the physical placement of nodes in 3D space:

```yaml
# galley.layout - Physical placement (read-only to player)

layout:
  file: galley.sl

rooms:
  galley:
    position: { x: 0, y: 0, z: 0 }
    size: { width: 6, height: 3, depth: 6 }

  corridor_4a:
    position: { x: 8, y: 0, z: 0 }
    size: { width: 8, height: 3, depth: 4 }

doors:
  galley_exit:
    position: { x: 3, y: 0, z: 0 }
    rotation: 90

terminals:
  galley_engineering:
    position: { x: 1.5, y: 0, z: -2 }
    rotation: 180

  galley_status:
    position: { x: -2.8, y: 0, z: 0 }
    rotation: 90
```

**What belongs in .layout files:**
- 3D positions (x, y, z coordinates)
- Rotations (degrees)
- Room sizes (width, height, depth)
- Visual/geometric properties
- Prop placements
- **Hardware status** (physical damage from the incident)

---

## Hardware Status

Layout files record the **physical condition** of hardware. This is where damage from "the incident" is defined:

```json
{
  "switches": {
    "door_switch": {
      "position": { "x": 2.5, "y": 1.2, "z": -2.8 },
      "status": "FAULT"
    }
  },
  "junctions": {
    "junction_4a": {
      "position": { "x": 0, "y": 2.5, "z": 0 },
      "status": "DAMAGED"
    },
    "junction_4b": {
      "position": { "x": 2, "y": 2.5, "z": 0 },
      "status": "STANDBY"
    }
  }
}
```

### Status Values

| Status | Meaning | Visual Feedback |
|--------|---------|-----------------|
| `OK` | Working normally | Normal appearance |
| `FAULT` | Malfunctioning | Sparks, flickering |
| `DAMAGED` | Physically broken | Visible damage, offline |
| `STANDBY` | Working but inactive | Dim indicator light |

### Why Hardware Status is in Layout, Not StarLang

The ship's code (.sl) was correct when delivered. Physical damage happened during the incident. This means:

- **StarLang**: `door { control: door_switch }` - Correct definition
- **Layout**: `door_switch: { status: "FAULT" }` - Physical damage
- **Puzzle**: Player must adapt correct software to work around damaged hardware

This is NOT a bug to fix - it's a workaround to discover.

---

## Why This Separation?

### 1. Narrative Consistency

A cook character logically can:
- Change door access permissions
- Modify alert conditions
- Reconfigure terminal access

A cook character cannot:
- Move physical walls
- Relocate doors
- Resize rooms

### 2. Puzzle Design

Puzzles focus on logical problem-solving:
- "The door is locked - modify the code to unlock it"
- "The atmosphere system is misconfigured - fix the routing"

Not on spatial manipulation:
- ~~"Move the door 2 meters to the left"~~

### 3. Code Clarity

Players see clean, readable code without coordinates cluttering the logic:

**Good (what player sees):**
```starlang
door galley_exit {
  connects: [galley, corridor]
  locked: true
}
```

**Avoided (confusing):**
```starlang
door galley_exit {
  connects: [galley, corridor]
  locked: true
  position: { x: 3, y: 0, z: 0 }
  rotation: 90
  size: { width: 1.2, height: 2.4 }
}
```

---

## Runtime Behaviour

### Loading

1. Parser loads `.sl` file for logical structure
2. Engine loads associated `.layout` file for physical placement
3. Renderer combines both to create 3D scene

### Hot Reload

When player saves changes to a `.sl` file:
1. Logical structure recompiles
2. Layout positions remain unchanged
3. Scene updates to reflect logical changes (door states, etc.)

### Layout Override (Development Only)

During development, layout can be embedded in `.sl` for convenience:

```starlang
# DEVELOPMENT ONLY - will be split before release
room galley {
  display_name: "Galley"
  adjacent: [corridor]

  @layout {
    position: { x: 0, y: 0, z: 0 }
    size: { width: 6, height: 3, depth: 6 }
  }
}
```

The `@layout` block is stripped when shown to player.

---

## File Associations

Layout files are associated with StarLang files by naming convention:

| StarLang File | Layout File |
|---------------|-------------|
| `galley.sl` | `galley.layout` |
| `deck_4/layout.sl` | `deck_4/layout.layout` |
| `systems/atmo.sl` | `systems/atmo.layout` |

Or explicitly in the layout file:
```yaml
layout:
  file: galley.sl
```

---

## Implementation Notes

### Current MVP

For the MVP, layout is embedded in the content files (TypeScript):

```typescript
// src/content/ship/galley.ts
export const GALLEY_SHIP = `...` // StarLang
export const GALLEY_LAYOUT = {...} // Layout data
```

### Future

- Separate `.layout` files parsed alongside `.sl`
- Layout editor for level designers (not player-facing)
- Procedural layout generation for some areas
