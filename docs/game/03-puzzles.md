# Puzzle Design

## Puzzle Philosophy

Every puzzle in StarLang follows three rules:

1. **The solution is in the code**: No pixel-hunting, no arbitrary combinations, no "adventure game logic"
2. **Multiple approaches are valid**: The "intended" solution isn't the only solution
3. **Failure has consequences, not game-overs**: Wrong answers make things harder, not impossible

---

## Puzzle Taxonomy

### Type 1: Configuration Puzzles

The system is misconfigured. Fix the config.

**Example**: O2 is venting to space because the outlet target is wrong. Change the target to something valid.

**Skills tested**: Reading StarLang, understanding node references, basic editing

### Type 2: Permission Puzzles

You understand the fix but can't make it—you don't have access.

**Example**: The door definition is on an engineering terminal. You're a cook.

**Skills tested**: Understanding the permission system, finding alternative paths, exploiting legacy code

### Type 3: Signal Puzzles

Multiple systems interact. You need to trigger a cascade or break a loop.

**Example**: The door unseals when atmosphere is stable. Atmosphere stabilizes when the scrubber has power. Power routing is locked. But the fire suppression system can seal/unseal doors and has a power override...

**Skills tested**: Tracing signal paths, understanding dependencies, predicting consequences

### Type 4: Information Puzzles

You don't know what to change because you don't understand the system.

**Example**: The documentation says to "reset the phase coupling" but you don't know which node that is or what values to set.

**Skills tested**: Documentation navigation, inference, experimentation

### Type 5: Timing Puzzles

The solution requires coordinated actions or specific sequences.

**Example**: Both ends of a connection must be modified within 30 seconds or the system rejects the change as partial.

**Skills tested**: Planning, potentially writing automated relays

---

## Puzzle Catalogue

### Puzzle 1: The Oxygen Crisis (Opening)

**Location**: Galley
**Urgency**: High (O2 meter dropping)
**Type**: Configuration

**Setup**: The player wakes up. Alarms. The galley's atmosphere outlet is pointing at `VOID.external`—venting to space. O2 is dropping.

**Investigation**:
```
> status galley.atmosphere

ATMOSPHERE: galley
  o2_level: 16.2% (CRITICAL - dropping)
  co2_level: 2.1% (elevated)
  pressure: 0.94 atm
  flow_in: 0.8 units/min (emergency reserve)
  flow_out: 2.4 units/min (ERROR: invalid target)
```

**Discovery**: The terminal shows `env_config.sl`. The player sees:

```starlang
node galley_outlet : AtmoOutlet {
  target: VOID.external    # ERROR: Invalid target
  flow_rate: 2.4
}
```

**Solution Options**:

1. **Basic**: Change target to `galley_intake` (closed loop, recycled air, buys time)
2. **Better**: Change target to `cold_storage.intake` (valid target you have access to)
3. **Best**: Find the original value in version control and restore it (requires learning `slvc`)

**Complications**: Cold storage solution works but starts warming your food. Closed loop works but CO2 builds up slowly. Both are temporary.

**Teaching**: This puzzle teaches that StarLang code has real effects, that the terminal shows both status AND definitions, and that solutions have tradeoffs.

---

### Puzzle 2: The Frozen Door

**Location**: Cold Storage → Medical Bay
**Urgency**: Low (you want access, not survival)
**Type**: Signal

**Setup**: Through a window, you can see a first aid kit in the medical bay. The door mechanism is frozen—ice in the tracks.

**Investigation**:
```
> status door_cold_to_medical

DOOR: door_cold_to_medical
  state: JAMMED
  jam_reason: MECHANICAL (ice obstruction)
  power: OK
  last_opened: 2287.198.11:22:07
```

**Discovery**: The door isn't software-locked, it's physically frozen. But you notice cold storage and the medical corridor share a heating conduit (visible in the definitions or a schematic).

**Solution Options**:

1. **Intended**: Crank cold storage heating demand to max. This pulls heat through the shared conduit, thawing the door. Side effect: your galley gets colder (heat is redistributed)

2. **Clever**: Find the conduit definition and reverse the flow direction, actively pushing heat toward the door

3. **Brute force**: There's a maintenance panel in the corridor that lets you physically cut power to the door, then force it open manually (but then it won't close properly)

**Teaching**: Systems affect each other. Physical state and software state are different. Sometimes the solution isn't in the broken thing but in an adjacent system.

---

### Puzzle 3: The Permission Escalation

**Location**: Maintenance Junction Alpha
**Urgency**: Medium (you need engineering access to proceed)
**Type**: Permission

**Setup**: You found an engineering tablet wedged behind a panel. Dead battery. The charging ports require engineering credentials to activate—you're a cook.

**Investigation**:
```
> status charger_junction_4a

CHARGER: charger_junction_4a
  state: STANDBY
  access: credential(ENGINEER) required
  power_source: power.junction_4a_aux
```

**Discovery**: The charger is on the same power bus as the emergency lighting. Emergency lighting is categorised as "passenger comfort" and you have access to environmental controls.

```starlang
power_bus junction_4a_aux {
  consumers: [
    charger_junction_4a,
    lighting.emergency.junction_4a,  # You can control this
    ...
  ]
}
```

**Solution**:

Create a fake lighting node that draws power from the bus:

```starlang
node fake_light : EmergencyLight {
  location: junction_4a
  power_source: power.junction_4a_aux
  state: ACTIVE
}
```

Wire the tablet to your "light." It's drawing power, just not for lighting.

**Alternative**: Find an engineering terminal that's already logged in somewhere (left open during the incident).

**Teaching**: Permissions aren't perfect. Legacy systems have gaps. Thinking about *how* the permission system works lets you route around it.

---

### Puzzle 4: The Sealed Bridge

**Location**: Deck 1 access
**Urgency**: Late game
**Type**: Signal + Permission

**Setup**: The bridge is sealed behind blast doors. Captain-level access required. You don't have it and can't fake it—the bridge has actual security.

**Investigation**: The blast doors are controlled by a dedicated security system. But they have safety overrides for emergencies.

```starlang
door bridge_blast_door {
  lock: SECURITY_SEAL
  
  unseal_requires: ANY [
    credential(CAPTAIN),
    credential(SECURITY_OVERRIDE),
    signal(bridge.internal_emergency),
    # Fire, decompression, or medical emergency inside bridge
  ]
}
```

**Problem**: You can't signal an emergency you're not inside.

**Discovery**: Deep in the documentation, you find that the bridge has an atmospheric sensor. And atmospheric sensors report to the central life support monitoring system. And that system has a testing mode that engineering can access...

**Solution**:

1. Use engineering credentials to access life support testing
2. Find the bridge atmospheric sensor in the test harness
3. Inject a simulated "decompression" reading
4. The sensor reports emergency to the security system
5. Blast doors unseal for evacuation

**Complication**: This triggers ship-wide alerts. You have about 60 seconds to get through before automated systems figure out it's a false alarm and reseal.

**Teaching**: Big puzzles require chaining multiple systems. Information from documentation matters. The security system isn't broken—you're exploiting its correct behaviour.

---

### Puzzle 5: The Anomaly

**Location**: Engineering Core
**Urgency**: Endgame
**Type**: Information + Signal

**Setup**: You've found Okafor's research. There's code in the navigation system that shouldn't exist. It's dormant now but it triggered the cascade that nearly killed everyone.

**Investigation**: The anomalous code is hidden in layers of legitimate navigation calculations. It activates in response to specific signal patterns—patterns that look like... searching?

**The Question**: What do you do?

**Option A - Purge**:

Delete the anomalous code. But it's deeply integrated. Removing it might break navigation. You'd need to understand it well enough to excise cleanly.

```
> slvc diff anomaly_code navigation.sl

WARNING: 847 interconnected references
Removing this code may affect: [nav_primary, nav_backup, 
  course_correction, stellar_reference, ...]
```

**Option B - Isolate**:

Cut its ability to receive signals. It can't activate if it can't hear.

```starlang
signal_filter navigation_quarantine {
  blocks: [
    signals matching /0x7F3A.*/,  # The patterns Okafor identified
  ]
  applies_to: [navigation.*]
}
```

But you're not sure you've found all the trigger patterns.

**Option C - Communicate**:

Okafor was studying it. Her notes suggest it might be... waiting. Not malicious, just watching. What if you could understand what it wants?

This path requires decoding Okafor's research, finding the signal patterns, and deliberately activating the anomaly in a controlled way.

**Option D - Ignore**:

It's dormant. The crew needs to be woken. This isn't your problem. Let the experts handle it once everyone's safe.

**Teaching**: The final puzzle isn't mechanical—it's moral. The game's language and systems have been teaching you to think about consequences, dependencies, and unintended effects. Now apply that to a choice.

---

## Difficulty Progression

| Phase | Puzzle Complexity | New Concepts |
|-------|-------------------|--------------|
| Opening | Single-node edits | Basic syntax, status vs definition |
| Early | Multi-node awareness | Signal connections, permissions |
| Mid | Cross-system chains | Version control, legacy exploits |
| Late | Full system understanding | Testing/simulation, deep investigation |
| Final | Synthesis + moral choice | Everything |

---

## Hint System

The game doesn't have a hint button. Instead:

### Level 1: Context Clues

The terminal shows related files. Error messages name the problem. The ship is verbose about what's wrong.

### Level 2: Documentation

The ship's manuals explain how systems work—but they're dense and poorly organised. Searching is a skill.

### Level 3: Version Control

`slvc log` shows what changed. `slvc diff` shows how. Often the solution is "put it back how it was."

### Level 4: Experimentation

The simulation feature (if implemented) lets you test changes safely. Otherwise, the game is forgiving enough to recover from mistakes.

### Level 5: Persistence

If truly stuck, exploring other areas might reveal information that unlocks understanding. The game shouldn't have hard gates where progress is impossible.
