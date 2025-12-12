# UI Layout

## Screen Structure

The game uses a split-screen layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│                            HEADER BAR                               │
│  O2: ██████░░░░ 62%    PWR: ████████░░ 84%    TIME: 2287.203.16:42  │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │                                   │
│                                 │                                   │
│         TERMINAL PANEL          │          SHIP VIEW                │
│         (Interactive)           │          (Map/Visual)             │
│                                 │                                   │
│                                 │                                   │
│                                 │                                   │
│                                 │                                   │
│                                 │                                   │
│                                 │                                   │
│                                 │                                   │
│                                 │                                   │
├─────────────────────────────────┴───────────────────────────────────┤
│                          CONTEXT BAR                                │
│  [Location: Galley]  [Terminal: Food Inventory]  [Access: COOK]     │
└─────────────────────────────────────────────────────────────────────┘
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

## Ship View (Right Side)

Top-down 2D view of the current deck/area.

### Elements

- **Rooms**: Coloured by status (normal, warning, critical, inaccessible)
- **Player Position**: Clear indicator of where Riley is
- **Doors**: Show open/closed/locked/sealed state
- **Interactables**: Terminals, panels, objects that can be clicked
- **Connections**: Lines showing what connects to what (optional layer)

### Visual States

| Element | Normal | Warning | Critical | Inaccessible |
|---------|--------|---------|----------|--------------|
| Room | Soft blue | Yellow | Red pulse | Grey/dark |
| Door | Green | Yellow | Red | Dark grey |
| Terminal | Lit screen | - | - | Dark |

### Interaction

- Click a room to move there (if accessible)
- Click a door to attempt to open/examine
- Click a terminal/panel to access it (shows in left panel)
- Hover for tooltips with basic status

### Layers (Toggleable)

- **Default**: Rooms, doors, objects
- **Power**: Power grid overlay, shows what's powered
- **Atmosphere**: Airflow patterns, shows routing
- **Signals**: Signal connections between systems

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

For jam scope, target a single resolution (1920x1080 or similar). The split-screen layout can flex slightly:

- Terminal panel: 40-60% of width
- Ship view: 40-60% of width
- Header/context bars: Fixed height

Future consideration: Collapsible panels for smaller screens.
