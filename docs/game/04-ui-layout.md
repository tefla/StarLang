# In-World UI Design

## Design Philosophy

All interfaces exist as physical objects within the 3D game world. There is no traditional HUD, no split-screen, and no overlay UI. The player experiences the ship through the character's eyes, interacting with terminals, displays, and controls as physical objects.

This creates:
- **Immersion**: The player is Riley Chen, not someone controlling Riley Chen
- **Spatial awareness**: Information has location—you must go to a terminal to use it
- **Natural progression gates**: Access to information requires physical access to terminals
- **Environmental storytelling**: UI placement itself tells stories (why is this terminal here?)

---

## In-World Display Types

### Wall-Mounted Status Panels

Small screens embedded in walls showing live data. Found throughout the ship.

```
┌─────────────────────────────┐
│  ╔═══════════════════════╗  │
│  ║  GALLEY - ENV STATUS  ║  │
│  ╠═══════════════════════╣  │
│  ║  O2      18.2%   ⚠   ║  │
│  ║  TEMP    22.4°C  ✓   ║  │
│  ║  PRESS   0.96atm ✓   ║  │
│  ╚═══════════════════════╝  │
│     [physical screen]       │
└─────────────────────────────┘
```

**Behaviour:**
- Always on when powered
- Updates in real-time
- Colour-coded status (green/amber/red glow)
- Player can glance at these while moving

### Engineering Terminals

Full workstations with keyboard and large screen. The primary interaction point for code editing.

```
         ┌────────────────────────────────────┐
         │  ╔════════════════════════════════╗│
         │  ║  ENGINEERING WORKSTATION       ║│
         │  ║  /deck_4/galley.sl             ║│
         │  ╠════════════════════════════════╣│
         │  ║  1 │ room galley {             ║│
         │  ║  2 │   display_name: "Galley"  ║│
         │  ║  3 │   deck: 4                 ║│
         │  ║  4 │ }                         ║│
         │  ║  5 │                           ║│
         │  ║  6 │ door galley_exit {        ║│
         │  ║  7 │   locked: true  ← CHANGE  ║│
         │  ║  8 │ }                         ║│
         │  ╚════════════════════════════════╝│
         └────────────────────────────────────┘
                    ┌────────────┐
                    │ [KEYBOARD] │
                    └────────────┘
```

**Behaviour:**
- Player must approach and interact (E key) to use
- Camera focuses on screen when using terminal
- Keyboard input goes to terminal while focused
- Esc to step back from terminal
- Screen has subtle CRT/LCD glow effect

### Command Terminals

Text-based interface terminals for querying ship systems.

```
┌──────────────────────────────────┐
│  ╔══════════════════════════════╗│
│  ║  COMMAND INTERFACE           ║│
│  ║  User: Riley Chen (Cook)     ║│
│  ╠══════════════════════════════╣│
│  ║  > status galley             ║│
│  ║                              ║│
│  ║  ROOM: galley                ║│
│  ║    O2: 18.2% (LOW)           ║│
│  ║    Temp: 22.4°C              ║│
│  ║                              ║│
│  ║  > _                         ║│
│  ╚══════════════════════════════╝│
└──────────────────────────────────┘
```

### Door Control Panels

Small panels beside doors showing status and controls.

```
    ┌─────────────┐
    │ ╔═════════╗ │
    │ ║ SEALED  ║ │  ← Red glow when locked
    │ ║ ━━━━━━━ ║ │
    │ ║ [OPEN]  ║ │  ← Button (disabled when locked)
    │ ╚═════════╝ │
    └─────────────┘
```

### Environmental Signs

Static text rendered in the 3D world for navigation and information.

- Room name plates above doorways
- Deck/section markers
- Warning signs ("AUTHORIZED PERSONNEL ONLY")
- Directional arrows
- Emergency procedure posters

---

## Screen Rendering Approach

### Canvas-to-Texture Method

Terminal content is rendered to an HTML canvas, then applied as a texture to the 3D screen mesh.

```
┌──────────────────────────────────────────────────┐
│                                                   │
│   [HTML Canvas]  ──render──►  [Texture]          │
│        │                          │               │
│        │                          ▼               │
│   React/DOM UI              3D Screen Mesh       │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Advantages:**
- Full HTML/CSS capabilities for terminal UI
- Syntax highlighting "just works"
- Can reuse existing UI component patterns

**Implementation:**
1. Create off-screen canvas
2. Render terminal UI (React) to canvas
3. Update Three.js texture each frame (or on change)
4. Apply emissive material for screen glow

### Text Rendering

For static in-world text (signs, labels):
- SDF (Signed Distance Field) text for crisp rendering at any distance
- Or: Three.js TextGeometry for 3D extruded text
- Pre-baked textures for performance-critical text

---

## Interaction Model

### Proximity Detection

Player must be close enough to interact with terminals.

```typescript
const INTERACTION_RANGE = 2.0  // meters

function canInteract(player: Player, terminal: Terminal): boolean {
  const distance = player.position.distanceTo(terminal.position)
  return distance <= INTERACTION_RANGE && isLookingAt(player, terminal)
}
```

### Focus States

**Free Movement**
- Player moves with WASD + mouse look
- Crosshair in center of screen
- Interactable objects highlight when looked at

**Terminal Focused**
- Camera locked to view terminal screen
- Player cannot move (standing at terminal)
- Mouse controls cursor on terminal screen
- Keyboard input goes to terminal
- Esc returns to free movement

### Interaction Feedback

When looking at an interactable object:
- Subtle outline or highlight
- Crosshair changes (expands, changes colour)
- Proximity text appears: "Press E to use terminal"

---

## Terminal Types and Locations

| Terminal Type | Found In | Capability |
|--------------|----------|------------|
| Status Panel | Corridors, all rooms | Read-only sensor data |
| Door Panel | Beside every door | Door status, manual controls |
| Command Terminal | Common areas | Text queries, slvc commands |
| Engineering Terminal | Maintenance areas | Full code editor |

### Narrative Placement

Terminal placement tells stories:
- Engineering terminals in maintenance areas (not public)
- Status panels everywhere (crew need to monitor)
- Riley starts near a terminal they can access (lucky?)
- Higher-access terminals behind locked doors

---

## Visual Design

### Screen Aesthetics

Functional future aesthetic—professional equipment, not flashy sci-fi.

**Characteristics:**
- Muted colour palette (blues, greys, soft greens)
- Monospace fonts for code and data
- Subtle scanlines or CRT effect (optional)
- Screen glow illuminates nearby surfaces
- Status colours: green (OK), amber (warning), red (critical)

### Colour Palette

| Colour | Hex | Use |
|--------|-----|-----|
| Screen background | #1a2744 | Terminal backgrounds |
| Text primary | #d0d0d0 | Main text |
| Text secondary | #808080 | Comments, labels |
| Accent blue | #4a6fa5 | Highlights, links |
| Warning amber | #ffb347 | Warnings |
| Critical red | #ff6b6b | Errors, alerts |
| Success green | #77dd77 | OK states |

### Lighting

Terminal screens act as light sources:
- Emissive material on screen mesh
- Optional point light for ambient glow
- Powered-off terminals are dark (no glow)
- Critical alerts pulse red light

---

## Implementation Notes

### Performance

- Only render terminal content when player is nearby
- LOD for distant screens (static texture or blank)
- Batch text rendering where possible
- Limit canvas-to-texture updates (not every frame)

### Accessibility Considerations

- Text size must be readable at interaction distance
- High contrast text on screens
- Audio cues for status changes (beeps, alerts)
- Consider colour-blind friendly status indicators

### Future Enhancements

- VR support (native 3D interaction)
- Hand/tool interaction instead of crosshair
- Multi-screen terminals
- Holographic displays (narrative unlock)
