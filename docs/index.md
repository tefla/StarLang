---
layout: home

hero:
  name: "StarLang"
  text: "A LangJam Game Project"
  tagline: A survival/discovery game where the ship is the programming language.
  actions:
    - theme: brand
      text: Get Started
      link: /game/01-concept
    - theme: alt
      text: Language Spec
      link: /language/01-syntax

features:
  - title: One Language, One Ship
    details: StarLang defines everything - rooms, doors, sensors, relays, power systems, atmosphere controls, and permissions.
  - title: Learn With the Character
    details: A cook with no technical background discovers programming through necessity. Survival drives discovery.
  - title: The Mystery Unfolds
    details: As permissions expand, logs and configurations reveal what happened. The full story is there for those who dig.
---

## Quick Start

### The Elevator Pitch

You wake up alone on a damaged ship. You're a cook. The O2 is running out. The only way to survive is to learn the ship's programming language - StarLang - and hack your way to safety.

### The Language in 30 Seconds

```starlang
room galley {
  display_name: "Galley"
  deck: 4
  adjacent: [crew_mess, cold_storage, corridor_4a]
}

door galley_to_corridor {
  connects: [galley, corridor_4a]
  lock: EMERGENCY_SEAL

  unseal_requires: ANY [
    credential(OFFICER),
    signal(atmo_local.all_clear)
  ]
}

sensor temp_galley {
  location: galley
  type: TEMPERATURE

  on_reading: |temp| {
    if temp > 50C { trigger(alarm.fire) }
  }
}
```

### The Loop

1. **Discover** a problem (door won't open, O2 depleting, system offline)
2. **Investigate** using status queries and whatever documentation you can find
3. **Understand** by finding and reading the relevant StarLang definitions
4. **Solve** by modifying code, rerouting signals, or exploiting permission gaps
5. **Uncover** fragments of what happened as you gain deeper access

## Documentation

Explore the full documentation using the sidebar navigation, or jump directly to:

- **[Game Design](/game/01-concept)** - Core game loop, narrative, puzzles, and UI
- **[Language Specification](/language/01-syntax)** - StarLang grammar and constructs
- **[Runtime Architecture](/runtime/01-architecture)** - System design and state management
- **[Technical Implementation](/technical/01-implementation)** - Implementation details
