# Ship Structure

## The File System

The ship is defined as a collection of `.sl` (StarLang) files organised in a directory hierarchy. This structure mirrors the physical layout of the ship.

```
/ship/
├── manifest.sl              # Ship metadata
├── permissions.sl           # Global permission definitions
├── systems/                 # Ship-wide systems
│   ├── atmo.sl             # Atmosphere backbone
│   ├── power.sl            # Power distribution
│   ├── alerts.sl           # Alert system
│   ├── doors.sl            # Door defaults and types
│   └── safety.sl           # Safety interlocks
├── deck_1/                  # Bridge deck
│   ├── layout.sl           # Deck layout and adjacency
│   ├── bridge/
│   │   ├── main.sl         # Bridge consoles
│   │   ├── navigation.sl   # Nav systems
│   │   └── comms.sl        # Communications
│   └── captain_quarters/
│       └── quarters.sl
├── deck_2/                  # Engineering deck
│   ├── layout.sl
│   ├── engineering/
│   │   ├── reactor.sl
│   │   ├── power_main.sl
│   │   └── workstations.sl
│   └── life_support/
│       ├── atmo_primary.sl
│       ├── atmo_backup.sl
│       └── water.sl
├── deck_3/                  # Passenger deck
│   ├── layout.sl
│   ├── stasis_bay/
│   │   └── pods.sl
│   └── passenger_common/
│       └── common.sl
├── deck_4/                  # Crew deck
│   ├── layout.sl
│   ├── section_7/
│   │   ├── galley.sl
│   │   ├── cold_storage.sl
│   │   └── crew_mess.sl
│   └── section_8/
│       └── quarters.sl
└── public/                  # Documentation
    ├── ship_directory.sl
    └── manuals/
        ├── ATMO-*.md
        ├── POWER-*.md
        └── ...
```

---

## File Organisation Principles

### One File Per Area

Each distinct area of the ship has its own file. This keeps files manageable and maps naturally to physical locations.

```
/deck_4/section_7/galley.sl
```

Contains: The galley room, its doors, sensors, terminals, and local systems.

Does not contain: The crew mess (separate file), ship-wide systems, or anything not physically in the galley area.

### Layout Files

Each deck has a `layout.sl` that defines:

- The physical arrangement of sections
- Major corridors and connectors
- Deck-level systems (like local power distribution)

```starlang
# /deck_4/layout.sl

deck deck_4 {
  display_name: "Crew Services Deck"
  sections: [section_7, section_8, section_9]
  
  elevator_access: elevator_main
  emergency_stairs: [stairs_forward, stairs_aft]
}

corridor corridor_4_main {
  deck: 4
  connects: [section_7, section_8, section_9, elevator_main]
}
```

### System Files

Ship-wide systems live in `/ship/systems/`. These define:

- Backbone infrastructure (main power grid, atmosphere backbone)
- Default behaviours (what a "standard door" does)
- Global alerts and signals

Area-specific files reference these systems:

```starlang
# In galley.sl
node galley_outlet : AtmoOutlet {
  target: atmo.deck4_return  # References /ship/systems/atmo.sl
}
```

---

## The Manifest

`/ship/manifest.sl` contains ship-wide metadata:

```starlang
ship UTS_Meridian {
  class: "Horizon-IV Colony Transport"
  registry: "UTS-7834-M"
  
  capacity: {
    passengers: 847
    crew: 62
    cargo: 12000_tonnes
  }
  
  journey: {
    origin: "Earth, Luna L5 Station"
    destination: "Tau Ceti e, Colony Site Alpha"
    departure: 2287.180
    arrival: 2301.245  # 14 year journey
  }
  
  current_status: EMERGENCY
  current_date: 2287.203
}
```

This file is mostly informational but can be queried:

```
> status ship

SHIP: UTS Meridian
  Class: Horizon-IV Colony Transport
  Status: EMERGENCY
  Current date: 2287.203.16:42:07
  Journey: Day 23 of ~5100
  Crew awake: 1 (should be: 62)
  Passengers: 847 (all in stasis)
```

---

## Permissions File

`/ship/permissions.sl` defines the global permission structure:

```starlang
# /ship/permissions.sl

@hierarchy {
  CAPTAIN: [OFFICER]
  OFFICER: [SECURITY, ENGINEERING, MEDICAL, SCIENCE, OPERATIONS]
  SECURITY: []
  ENGINEERING: [ENGINEERING_JUNIOR]
  MEDICAL: [MEDICAL_JUNIOR]
  SCIENCE: [SCIENCE_JUNIOR]
  OPERATIONS: [COOK, MAINTENANCE, STEWARD]
}

@defaults {
  # Public areas accessible to any crew
  public_areas: [
    "/ship/public/*",
    "/deck_*/layout.sl"
  ]
  
  # Default read access per role
  COOK: [
    "/deck_4/section_7/galley.sl",
    "/deck_4/section_7/cold_storage.sl",
    "/deck_4/section_7/crew_mess.sl"
  ]
  
  ENGINEERING: [
    "/ship/systems/*",
    "/deck_2/engineering/*",
    "/deck_*/section_*/env_*.sl"  # Environmental configs everywhere
  ]
  
  # ... etc
}
```

Individual files can also specify their own permissions:

```starlang
# In any .sl file
@permissions {
  view: credential(CREW) OR HIGHER
  edit: credential(ENGINEERING) OR HIGHER
}
```

---

## Node Referencing

### Local References

Within the same file, reference nodes by identifier:

```starlang
# Both in galley.sl
door galley_to_cold {
  connects: [galley, cold_storage]  # Local rooms
}
```

### Cross-File References

Reference nodes in other files using the full path or registered namespace:

```starlang
# In galley.sl, referencing systems/atmo.sl
node galley_intake : AtmoInlet {
  source: atmo.deck4_main  # Registered namespace
}

# Or full path
node galley_intake : AtmoInlet {
  source: /ship/systems/atmo.deck4_main
}
```

### System Namespaces

Core systems register namespaces for convenient access:

| Namespace | Resolves To |
|-----------|-------------|
| `atmo.*` | `/ship/systems/atmo.sl` |
| `power.*` | `/ship/systems/power.sl` |
| `alert.*` | `/ship/systems/alerts.sl` |
| `safety.*` | `/ship/systems/safety.sl` |

---

## File Dependencies

When a file references another file, it creates a dependency. The compiler tracks these:

```starlang
# galley.sl depends on:
# - /ship/systems/atmo.sl (atmo.* references)
# - /ship/systems/power.sl (power.* references)
# - /deck_4/layout.sl (corridor_4a reference)
```

### Compilation Order

Files are compiled in dependency order. If file A depends on file B, B is compiled first.

### Circular Dependencies

Allowed but handled carefully:

```starlang
# room_a.sl
door a_to_b {
  connects: [room_a, room_b]  # References room_b.sl
}

# room_b.sl
door b_to_a {
  connects: [room_b, room_a]  # References room_a.sl
}
```

The compiler resolves this by:
1. First pass: Collect all node declarations (names and types)
2. Second pass: Resolve references and validate

---

## Documentation in /public

The `/public/` directory contains documentation and reference materials. These are readable files (Markdown format) that the player can access through documentation terminals.

```
/public/
├── ship_directory.sl        # Searchable ship info
└── manuals/
    ├── ATMO-PRIMARY-001.md  # Primary atmosphere system
    ├── ATMO-EMERGENCY-042.md
    ├── POWER-GRID-001.md
    ├── DOOR-TYPES-001.md
    ├── COOK-GALLEY-003.md   # Relevant to our cook!
    └── ...
```

### Documentation Naming Convention

```
[SYSTEM]-[SUBSYSTEM]-[NUMBER].md

ATMO-PRIMARY-001.md     # Atmosphere, primary system, doc #1
COOK-GALLEY-003.md      # Cook operations, galley, doc #3
SAFETY-INTERLOCK-012.md # Safety systems, interlocks, doc #12
```

### Documentation Content

Manuals are written in-universe: technical, sometimes obtuse, occasionally revealing.

```markdown
# ATMO-EMERGENCY-042: Emergency Atmosphere Protocols

## Overview

In the event of atmospheric containment failure, the ship's
automated systems will execute the following protocols...

## Automatic Responses

When O2 levels drop below 18% in any monitored area:

1. Emergency seals activate on all doors to the affected area
2. Backup atmosphere reserves route to the area
3. Alert signal ATMO.CRITICAL triggers
4. One (1) crew member is designated for manual assessment

## Manual Override

To manually override emergency atmosphere routing, an
authorized engineer must access the local AtmoController
terminal and execute:

    set atmo_local.override: true
    set atmo_local.outlet.target: [valid_target]
    
WARNING: Improper routing may result in...
```

---

## Runtime View vs Source View

The player can view the file system in two ways:

### Source View (Engineering Terminals)

Shows actual `.sl` files with syntax highlighting. Can be edited.

```
/deck_4/section_7/galley.sl
────────────────────────────
room galley {
  display_name: "Galley"
  ...
```

### Compiled View (Status Queries)

Shows the runtime state of compiled nodes.

```
> status galley

ROOM: galley
  Display: Galley
  Deck: 4, Section: 7
  O2: 18.2% (LOW)
  Temp: 22.4C
  Occupants: 1 (Riley Chen)
  Adjacent: crew_mess, cold_storage, corridor_4a
  
Doors:
  galley_to_cold: OPEN
  galley_to_corridor: SEALED (atmo.critical)
```

Same data, different perspective. Early game, the player mostly sees the compiled view. As they gain engineering access, they see the source.
