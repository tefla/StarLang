# StarLang Syntax

## Design Goals

StarLang is designed to be:

1. **Readable**: A cook with no programming experience should be able to understand the gist
2. **Declarative**: Describe *what* things are, not *how* to build them step-by-step
3. **Consistent**: Similar things look similar
4. **Error-tolerant**: Helpful messages when things go wrong

---

## Critical Design Principle: Definition vs. State

**StarLang files (.sl) contain DEFINITIONS, not STATE.**

| Definitions (.sl files) | State (runtime only) |
|------------------------|---------------------|
| What things ARE | What things ARE DOING |
| Structure and topology | Current values |
| Connections and references | On/off, open/closed |
| Configuration and thresholds | Sensor readings |
| How the ship was BUILT | How the ship is NOW |

A shipyard delivers a working ship. The `.sl` files define how systems connect - they don't contain "disabled" or "offline" flags. The ship was built correctly; state emerges at runtime.

**What belongs in .sl files:**
- Node declarations (rooms, doors, vents, junctions)
- References to other nodes (`power_source: junction_4a`)
- Configuration values (`flow_rate: 2.4`, `target_temp: 22C`)
- Behavior definitions (`on_open: { ... }`)
- Thresholds and limits (`alarm_threshold: 18%`)

**What does NOT belong in .sl files:**
- Current state (`state: DISABLED` ❌)
- Runtime values (`current_temp: 22.4` ❌)
- On/off switches (`enabled: false` ❌)

**Puzzle implications**: When something is broken in the game, it's because a **reference is wrong** (pointing to the wrong node) or a **configuration value is incorrect** (wrong threshold, wrong target). The player fixes the ship by correcting the definition, not by toggling state.

---

## Basic Structure

A StarLang file consists of **declarations**. Each declaration defines a thing: a room, a door, a sensor, a relay, etc.

```starlang
# This is a comment

declaration_type identifier {
  property: value
  another_property: another_value
}
```

### Example

```starlang
# A simple room definition
room galley {
  display_name: "Galley"
  deck: 4
  section: 7
  capacity: 6
}
```

---

## Comments

```starlang
# Single line comment

# Multi-line comments are just
# multiple single-line comments

room example {
  property: value  # Inline comment
}
```

---

## Identifiers

Identifiers name things. They follow these rules:

- Start with a letter or underscore
- Contain letters, numbers, underscores
- Case-sensitive
- Convention: `snake_case` for most things

```starlang
# Valid identifiers
galley
cold_storage
door_4a_to_4b
_internal_system
sensor2

# Invalid identifiers
4th_room      # Starts with number
my-door       # Contains hyphen
"room name"   # Contains spaces and quotes
```

### Namespaced Identifiers

Many identifiers include a namespace, written with dots:

```starlang
atmo.deck4_main       # Atmosphere system, deck 4 main
power.local_4         # Power system, local node 4
signal.emergency      # Signal system, emergency channel
```

---

## Values

### Strings

```starlang
display_name: "Galley"
note: "This is a longer string with spaces"
message: "Line one\nLine two"  # Escape sequences work
```

### Numbers

```starlang
capacity: 6
flow_rate: 2.4
temperature: -18.5
```

### Numbers with Units

```starlang
target_temp: -18C
pressure: 1.0atm
flow: 2.4units/min
power: 500W
duration: 30s
```

Supported units:
- Temperature: `C` (Celsius), `K` (Kelvin)
- Pressure: `atm`, `kPa`
- Power: `W`, `kW`
- Time: `s`, `min`, `h`
- Flow: `units/min`, `L/min`

### Booleans

```starlang
enabled: true
sealed: false
```

### Enums

Predefined values in UPPER_CASE:

```starlang
type: SLIDING
lock: EMERGENCY_SEAL
status: ACTIVE
state: OPEN
```

### Lists

```starlang
adjacent: [crew_mess, cold_storage, corridor_4a]
serves: [galley, crew_mess, corridor_4a]
```

Lists can span multiple lines:

```starlang
consumers: [
  galley_light,
  galley_vent,
  galley_terminal,
  cold_storage_cooling
]
```

### References

References to other nodes use their identifier:

```starlang
power_source: power.local_4
target: atmo.deck4_return
location: galley
```

### Nested Objects

```starlang
environment: {
  target_temp: -18C
  atmo_class: SEALED
  humidity: 40%
}
```

---

## Declarations

### Basic Declaration

```starlang
type identifier {
  property: value
}
```

### Typed Declaration

Some declarations specify a subtype:

```starlang
node galley_vent : AtmoOutlet {
  # This node is specifically an AtmoOutlet type
}

sensor temp_galley : TEMPERATURE {
  # This sensor is specifically a temperature sensor
}
```

### Declaration with Behaviours

```starlang
door galley_to_corridor {
  connects: [galley, corridor_4a]
  type: SLIDING
  
  # Behaviour block
  on_open: {
    log("Door opened")
    announce(galley, "Door to corridor opening")
  }
}
```

---

## Expressions

### Conditions

Used in `if` statements and conditional properties:

```starlang
# Comparison
temp > 50C
level < 18%
state == OPEN
name != "admin"

# Boolean logic
condition_a AND condition_b
condition_a OR condition_b
NOT condition_a

# Grouping
(temp > 50C) AND (NOT emergency_mode)
```

### ANY and ALL

For lists of conditions:

```starlang
# ANY: at least one must be true
unseal_requires: ANY [
  credential(OFFICER),
  credential(SECURITY),
  signal(emergency_override)
]

# ALL: all must be true
activate_requires: ALL [
  power > 50%,
  NOT maintenance_mode,
  credential(ENGINEER)
]
```

### Function-like Expressions

```starlang
credential(OFFICER)           # Check for credential
signal(atmo.all_clear)        # Check for signal
within(10m, player)           # Proximity check (stretch goal)
```

---

## Behaviour Blocks

Behaviour blocks define what happens in response to events or conditions.

### on_event Handlers

```starlang
door example_door {
  on_open: {
    # Code runs when door opens
  }
  
  on_close: {
    # Code runs when door closes
  }
  
  on_access_denied: {
    # Code runs when someone is denied
  }
}
```

### on_reading Handler (Sensors)

```starlang
sensor temp_sensor {
  type: TEMPERATURE
  sample_rate: 1Hz
  
  on_reading: |temp| {
    if temp > 50C {
      trigger(alarm.fire)
    }
    if temp > 80C {
      trigger(emergency_shutdown)
    }
  }
}
```

The `|temp|` syntax captures the sensor reading as a variable.

### Conditional Blocks

```starlang
on_open: {
  if humidity > 80% {
    announce(location, "High humidity warning")
  }
}
```

### Actions

Actions that can be performed in behaviour blocks:

```starlang
# Trigger a signal
trigger(signal_name)
trigger(alarm.fire)

# Stop a signal
clear(signal_name)

# Make an announcement
announce(location, "Message text")
announce(ship_wide, "Emergency alert")

# Log an entry
log("Something happened")
log("Temperature: {temp}")  # String interpolation

# Control other nodes
open(door_name)
close(door_name)
seal(door_name)
unseal(door_name)

# Set a value
set(node.property, new_value)

# Wait (in timed sequences)
wait(5s)
after(10s) { ... }
```

---

## Signals

Signals are the communication mechanism between nodes.

### Triggering Signals

```starlang
trigger(atmo.critical)
trigger(alarm.fire)
trigger(door.emergency_release)
```

### Listening for Signals

```starlang
door blast_door {
  seal_on: signal(emergency_lockdown)
  unseal_on: signal(all_clear)
}

relay alarm_relay {
  trigger: signal(fire_detected)
  action: {
    trigger(alarm.fire)
    announce(ship_wide, "Fire detected")
  }
}
```

### Signal Conditions

```starlang
# Check if signal is active
if signal(emergency_mode) {
  ...
}

# In requirements
unseal_requires: ANY [
  signal(atmo.all_clear),
  credential(OFFICER)
]
```

---

## Credentials

Credentials represent access rights.

### Checking Credentials

```starlang
access: credential(COOK)
access: credential(ENGINEER) OR HIGHER

edit_requires: ALL [
  credential(ENGINEER),
  NOT signal(lockdown)
]
```

### Credential Hierarchy

The `OR HIGHER` modifier includes all credentials above in the hierarchy:

```starlang
access: credential(COOK) OR HIGHER
# Allows: COOK, OPERATIONS, OFFICER, CAPTAIN
```

---

## Complete Example

```starlang
# ==========================================
# GALLEY - Deck 4, Section 7
# Last modified: 2287.156 by Chen, M.
# ==========================================

room galley {
  display_name: "Galley"
  deck: 4
  section: 7
  adjacent: [crew_mess, cold_storage, corridor_4a]
  capacity: 6
}

node galley_intake : AtmoInlet {
  source: atmo.emergency_reserve
  flow_rate: 0.8
}

node galley_outlet : AtmoOutlet {
  target: atmo.deck4_return
  flow_rate: 2.4
}

door galley_to_cold {
  connects: [galley, cold_storage]
  type: SLIDING
  lock: NONE
  power_source: power.local_4
  
  on_open: {
    if cold_storage.temp < 0C {
      announce(galley, "Cold storage access. Mind the temperature.")
    }
  }
}

door galley_to_corridor {
  connects: [galley, corridor_4a]
  type: SLIDING
  lock: EMERGENCY_SEAL
  power_source: power.local_4
  
  seal_on: signal(atmo_local.critical)
  
  unseal_requires: ANY [
    credential(OFFICER),
    credential(SECURITY),
    signal(bridge.emergency_override),
    signal(atmo_local.all_clear)
  ]
}

sensor temp_galley : TEMPERATURE {
  location: galley
  sample_rate: 1Hz
  
  on_reading: |temp| {
    if temp > 50C {
      trigger(alarm.fire)
      log("High temperature detected: {temp}")
    }
  }
}

terminal galley_terminal {
  location: galley
  type: APPLICATION
  access: credential(COOK) OR HIGHER
  power_source: power.local_4
  
  application: "food_inventory"
  
  mounted_files: [
    "/galley/inventory.sl",
    "/galley/temp_control.sl",
    "/galley/env_config.sl"
  ]
}
```

---

## Syntax Summary

| Construct | Syntax |
|-----------|--------|
| Comment | `# text` |
| Declaration | `type id { ... }` |
| Typed declaration | `type id : subtype { ... }` |
| Property | `name: value` |
| String | `"text"` |
| Number | `42`, `3.14`, `-18.5` |
| Number with unit | `50C`, `2.4kW`, `30s` |
| Boolean | `true`, `false` |
| Enum | `UPPERCASE_VALUE` |
| List | `[a, b, c]` |
| Nested object | `{ prop: val }` |
| Reference | `node.property` |
| Condition | `a > b`, `a AND b`, `NOT a` |
| ANY/ALL | `ANY [...]`, `ALL [...]` |
| Handler | `on_event: { ... }` |
| Capture | `\|var\| { ... }` |
| Conditional | `if cond { ... }` |
| Action | `trigger(x)`, `announce(x, "y")` |
| Credential check | `credential(ROLE)` |
| Signal check | `signal(name)` |
