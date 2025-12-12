# UI Layout

## Screen Structure

The game uses a **3D first-person view** with HUD overlays and modal terminal interfaces:

```
┌─────────────────────────────────────────────────────────────────────┐
│  O2: ██████░░ 62%   PWR: ████████░░ 84%              ┌───────────┐  │
│                                                      │  MINI-MAP │  │
│                                                      │  (toggle) │  │
│                                                      └───────────┘  │
│                                                                     │
│                     ┌─────────────────────┐                         │
│                     │   ███  TERMINAL ███ │                         │
│                     │   ███           ███ │  ← 3D terminal object   │
│                     │   ███  [SCREEN] ███ │                         │
│                     │   ███           ███ │                         │
│                     └─────────────────────┘                         │
│                              ═══════                                │
│                            ═════════  ← corridor floor              │
│                                                                     │
│                                                                     │
│  Galley                                      [E] Access Terminal    │
└─────────────────────────────────────────────────────────────────────┘

When accessing a terminal, UI overlays the 3D view:

┌─────────────────────────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░╔══════════════════════════════════════════════════════════╗░░░░│
│░░░░║  ENGINEERING WORKSTATION                                 ║░░░░│
│░░░░╠══════════════════════════════════════════════════════════╣░░░░│
│░░░░║  /deck_4/galley.sl                          [Modified]   ║░░░░│
│░░░░╠══════════════════════════════════════════════════════════╣░░░░│
│░░░░║   1 │ room galley {                                      ║░░░░│
│░░░░║   2 │   display_name: "Galley"                           ║░░░░│
│░░░░║   3 │   ...                                              ║░░░░│
│░░░░╠══════════════════════════════════════════════════════════╣░░░░│
│░░░░║  [Save] [Compile] [Revert]              [ESC to close]   ║░░░░│
│░░░░╚══════════════════════════════════════════════════════════╝░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────────────────────────────────┘
  ░ = dimmed/blurred 3D world behind terminal overlay
```

---

## Header Bar

Always visible. Shows critical survival metrics.

### Elements

- **O2 Level**: Percentage with visual bar. Colour-coded (green/yellow/red)
- **Power Reserve**: Ship-wide power status
- **Time**: Ship time (for correlating with logs)
- **Alert Indicator**: Flashes when there are active warnings

### Behaviour

- Metrics update in real-time from ship state
- Clicking a metric opens detailed status for that system
- Critical states trigger subtle pulsing/colour changes

---

## Terminal Panel (Left Side)

The primary interaction area. Shows whatever terminal or system the player is currently accessing.

### Terminal Types

#### Status Display Terminal

Read-only displays found throughout the ship. Shows sensor readings, system status, simple controls.

```
╔══════════════════════════════════════╗
║  GALLEY ENVIRONMENTAL MONITOR        ║
╠══════════════════════════════════════╣
║                                      ║
║  Temperature    22.4°C    ✓          ║
║  Humidity       45%       ✓          ║
║  O2 Level       18.2%     ⚠ LOW      ║
║  CO2 Level      1.8%      ✓          ║
║  Pressure       0.96 atm  ✓          ║
║                                      ║
╠══════════════════════════════════════╣
║  ┌──────────────────────────────┐    ║
║  │ O2 LEVEL - LAST 6 HOURS     │    ║
║  │                         ╱   │    ║
║  │                        ╱    │    ║
║  │     ──────────────────      │    ║
║  │                             │    ║
║  └──────────────────────────────┘    ║
║                                      ║
╠══════════════════════════════════════╣
║  [Refresh]  [Alert Settings]         ║
╚══════════════════════════════════════╝
```

#### Application Terminal

Purpose-built interfaces for specific systems. The player interacts through GUI controls, not code.

```
╔══════════════════════════════════════╗
║  FOOD INVENTORY SYSTEM v2.4.1        ║
╠══════════════════════════════════════╣
║                                      ║
║  COLD STORAGE                        ║
║  ├─ Temperature: -18.2°C  [SET]      ║
║  ├─ Protein: 124 kg                  ║
║  ├─ Vegetables: 89 kg                ║
║  └─ Dairy: 45 kg                     ║
║                                      ║
║  DRY GOODS                           ║
║  ├─ Grains: 312 kg                   ║
║  ├─ Preserved: 234 kg                ║
║  └─ Spices: 28 kg                    ║
║                                      ║
║  FRESH (3 days remaining)            ║
║  ├─ Fruits: 34 kg                    ║
║  └─ Vegetables: 45 kg                ║
║                                      ║
╠══════════════════════════════════════╣
║  [Meal Planning]  [Restock Request]  ║
╚══════════════════════════════════════╝
```

#### Engineering Workstation

The code editor. Shows StarLang files. This is where the real gameplay happens.

```
╔══════════════════════════════════════════════════════════════╗
║  ENGINEERING WORKSTATION                                     ║
║  User: CHEN, M. (Engineer First Class) [NOT YOU]             ║
╠══════════════════════════════════════════════════════════════╣
║  /deck_4/section_7/galley.sl                    [Modified]   ║
╠══════════════════════════════════════════════════════════════╣
║   1 │ # Galley - Deck 4, Section 7                           ║
║   2 │ # Serves: 12 crew rotating shifts                      ║
║   3 │                                                        ║
║   4 │ room galley {                                          ║
║   5 │   display_name: "Galley"                               ║
║   6 │   deck: 4                                              ║
║   7 │   section: 7                                           ║
║   8 │   adjacent: [crew_mess, cold_storage, corridor_4a]     ║
║   9 │   capacity: 6                                          ║
║  10 │ }                                                      ║
║  11 │                                                        ║
║  12 │ node galley_outlet : AtmoOutlet {                      ║
║  13 │   target: VOID.external  ← ERROR                       ║
║  14 │   flow_rate: 2.4                                       ║
║  15 │ }                                                      ║
║     │                                                        ║
╠══════════════════════════════════════════════════════════════╣
║  ERRORS: Line 13 - Invalid target reference                  ║
╠══════════════════════════════════════════════════════════════╣
║  [Save] [Compile] [Revert] [History] [Help]                  ║
╚══════════════════════════════════════════════════════════════╝
```

#### Command Terminal

Text-based interface for querying ship systems and using version control.

```
╔══════════════════════════════════════════════════════════════╗
║  COMMAND INTERFACE                                           ║
║  User: Riley Chen (Cook)                                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  > status door_galley_to_corridor                            ║
║                                                              ║
║  DOOR: door_galley_to_corridor                               ║
║    state: SEALED                                             ║
║    sealed_by: signal(atmo_local.critical) at 14:23:07        ║
║    power: OK                                                 ║
║    last_opened: 12:45:22 by Chen, M.                         ║
║                                                              ║
║  > slvc log galley.sl                                        ║
║                                                              ║
║  [4a7f2c1] 2287.203.14:22:58 - SYSTEM (automatic)            ║
║      Emergency atmosphere reroute                            ║
║  [3b8e1d0] 2287.156.09:15:33 - Chen, M.                      ║
║      Increased scrubber capacity                             ║
║                                                              ║
║  > _                                                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

#### Documentation Viewer

The ship's manuals. Searchable but verbose.

```
╔══════════════════════════════════════════════════════════════╗
║  SHIP DOCUMENTATION SYSTEM                                   ║
║  Search: [atmosphere routing____________] [Go]               ║
╠══════════════════════════════════════════════════════════════╣
║  Results for "atmosphere routing" (847 matches)              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ▸ ATMO-PRIMARY-001: Primary Atmosphere System Overview      ║
║    "...atmosphere routing through the primary..."            ║
║                                                              ║
║  ▸ ATMO-EMERGENCY-042: Emergency Atmosphere Protocols        ║
║    "...automatic atmosphere routing changes..."              ║
║                                                              ║
║  ▸ MAINT-HVAC-007: HVAC Maintenance Procedures               ║
║    "...verify atmosphere routing connections..."             ║
║                                                              ║
║  ▸ COOK-GALLEY-003: Galley Operations Manual         ← Hmm   ║
║    "...galley atmosphere routing is handled..."              ║
║                                                              ║
║  [Page 1 of 85]  [Next →]                                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 3D Ship View

First-person 3D exploration of the ship using a retro, pixelated aesthetic (Three.js with post-processing).

### Perspective

Player sees through Riley's eyes, walking through corridors and rooms. WASD + mouse controls (standard FPS).

### Visual Style

**Retro/Lo-Fi Aesthetic:**
- Pixelation post-processing (4-6 pixel size)
- Single-pixel edge outlines
- Low-poly box geometry (no curves)
- Flat Lambert shading (no PBR)
- Limited color palette

The chunky, pixelated look reinforces that the ship IS a system—it looks like a simulation Riley is learning to understand.

### Environment Elements

- **Rooms**: Simple box geometry with flat-colored walls
- **Corridors**: Modular pieces (straight, corner, T-junction)
- **Doors**: Visible state via color (green=open, red=sealed, grey=locked)
- **Terminals**: 3D objects with glowing screens, interactable
- **Props**: Minimal furniture (tables, counters) as simple boxes

### Interaction

- **WASD**: Move through the ship
- **Mouse**: Look around
- **E**: Interact with terminals/doors when near
- **Tab**: Toggle mini-map overlay (optional 2D deck diagram)
- **ESC**: Release pointer lock / exit terminal

### Terminal Interaction Flow

1. Player approaches terminal in 3D space
2. Press E → pointer unlocks, terminal UI appears as HTML overlay
3. 3D world dims/blurs behind the terminal interface
4. ESC → return to 3D exploration

### Visual States

| Element | Normal | Warning | Critical | Offline |
|---------|--------|---------|----------|---------|
| Room lighting | Cool white | Amber tint | Red pulse | Dark |
| Door frame | Green glow | Yellow | Red | No glow |
| Terminal screen | Blue glow | - | - | Dark |

### HUD Elements (Always Visible)

- **O2/Power bars**: Top of screen, minimal
- **Context prompt**: Bottom center ("Press E to access terminal")
- **Location**: Bottom left (current room name)
- **Mini-map**: Top right corner (optional toggle)

---

## Context Bar

Bottom bar showing current context.

### Elements

- **Location**: Current room name
- **Terminal**: What system you're accessing (if any)
- **Access Level**: Your current credentials
- **Notifications**: Queued messages/alerts

---

## Modal Overlays

For focused interactions that need full attention.

### Error Display

When compilation fails:

```
╔══════════════════════════════════════════════════════════════╗
║  COMPILATION FAILED                                          ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  galley.sl:13 - Invalid target reference                     ║
║                                                              ║
║    12 │ node galley_outlet : AtmoOutlet {                    ║
║  → 13 │   target: VOID.external                              ║
║    14 │   flow_rate: 2.4                                     ║
║                                                              ║
║  'VOID.external' is not a valid atmosphere target.           ║
║  Did you mean: cold_storage.intake, galley_intake,           ║
║                crew_mess.intake?                             ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                              [Dismiss]       ║
╚══════════════════════════════════════════════════════════════╝
```

### Confirmation Dialogs

For dangerous actions:

```
╔══════════════════════════════════════════════════════════════╗
║  CONFIRM REVERT                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  You are about to revert galley.sl to commit 3b8e1d0         ║
║  (2287.156.09:15:33 by Chen, M.)                             ║
║                                                              ║
║  This will undo:                                             ║
║  • Emergency atmosphere reroute (SYSTEM)                     ║
║                                                              ║
║  WARNING: The conditions that triggered the emergency        ║
║  response may still exist. The system may immediately        ║
║  re-apply the same changes.                                  ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                              [Cancel]  [Revert Anyway]       ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Visual Design Notes

### Aesthetic: Functional Future

Not sleek sci-fi, not grimy industrial. The Meridian is a working ship—professional but not glamorous. Think: hospital meets cargo ship meets office building.

- Muted colours (blues, greys, soft greens)
- Functional typography (readable, not stylised)
- Rounded corners on UI elements (feels less harsh)
- Subtle gradients and shadows (depth without distraction)

### Colour Palette

| Colour | Use |
|--------|-----|
| Deep blue (#1a2744) | Backgrounds, headers |
| Soft blue (#4a6fa5) | Normal states, active elements |
| Warm grey (#d0d0d0) | Text, borders |
| Amber (#ffb347) | Warnings |
| Coral red (#ff6b6b) | Critical, errors |
| Soft green (#77dd77) | Success, OK states |
| Dark grey (#2d2d2d) | Inaccessible, disabled |

### Typography

- **Headers**: Sans-serif, medium weight (system feels modern)
- **Body text**: Sans-serif, regular weight
- **Code**: Monospace, distinct from UI text
- **Terminal**: Monospace with slight glow (feels "computerish")

### Animation

Minimal but meaningful:

- Meters fill/drain smoothly
- Doors slide open (brief animation)
- Terminal text appears character-by-character for messages
- Alert indicators pulse gently
- No gratuitous transitions

---

## Responsive Considerations

For jam scope, target a single resolution (1920x1080 or similar).

- 3D canvas fills the screen
- HUD elements use fixed positioning (corners)
- Terminal overlay is centered, max-width constrained
- Pixelation effect scales with resolution (maintains chunky look)

Future consideration: Resolution options for lower-end devices (increase pixel size).
