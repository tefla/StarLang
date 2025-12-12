# Signals System

## Overview

Signals are StarLang's communication mechanism. They allow nodes to react to events happening elsewhere on the ship without direct coupling. When something happens (a sensor reading exceeds a threshold, a door opens, a button is pressed), a signal propagates through the system and any listening nodes can respond.

This is the core of StarLang's reactive behaviour—and the core of many puzzles.

---

## Signal Basics

### Triggering a Signal

```starlang
# Explicitly in an action block
trigger(alarm.fire)

# Automatically based on conditions
signal atmo.critical {
  triggers_on: sensor.o2_level < 16%
}
```

### Listening for a Signal

```starlang
# In a property
door blast_door {
  seal_on: signal(atmo.critical)
}

# In a relay
relay fire_response {
  trigger: signal(smoke_detected)
  action: { ... }
}

# As a permission condition
door secure_door {
  unseal_requires: signal(bridge.override)
}
```

### Clearing a Signal

```starlang
# Explicitly
clear(alarm.fire)

# Automatically
signal atmo.critical {
  clears_on: sensor.o2_level > 18%
}
```

---

## Signal Lifecycle

```
┌─────────────┐
│   INACTIVE  │ ←──────────────────────┐
└──────┬──────┘                        │
       │ trigger condition met         │ clear condition met
       │ OR explicit trigger()         │ OR explicit clear()
       ▼                               │
┌─────────────┐                        │
│   ACTIVE    │ ───────────────────────┘
└──────┬──────┘
       │
       │ propagates to listeners
       ▼
┌─────────────┐
│  LISTENERS  │ ← Each listener evaluates and may act
└─────────────┘
```

### Signal State

Signals are either **active** or **inactive**. Once triggered, a signal stays active until cleared.

```
> status signal.atmo.critical

SIGNAL: atmo.critical
  State: ACTIVE
  Triggered: 2287.203.14:23:07
  Triggered by: sensor.o2_galley (reading: 15.8%)
  Listeners: 47 nodes
  Clear condition: o2_level > 18% (currently: 16.2%)
```

---

## Signal Namespaces

Signals are organised into namespaces for clarity:

| Namespace | Purpose |
|-----------|---------|
| `atmo.*` | Atmosphere-related signals |
| `power.*` | Power system signals |
| `alarm.*` | Alert and alarm signals |
| `door.*` | Door state signals |
| `safety.*` | Safety interlock signals |
| `bridge.*` | Bridge command signals |
| `emergency.*` | Ship-wide emergency signals |

### Examples

```starlang
atmo.critical          # Atmosphere unsafe
atmo.all_clear         # Atmosphere safe
power.overload         # Power system overloaded
power.backup_active    # Running on backup power
alarm.fire             # Fire detected
alarm.intruder         # Security alert
door.emergency_release # All doors releasing
safety.interlock_7     # Specific interlock triggered
bridge.override        # Bridge authorised override
emergency.evacuate     # Ship-wide evacuation
```

---

## Signal Definition

### Automatic Signals

Signals that trigger based on conditions:

```starlang
signal atmo.critical {
  description: "Atmosphere unsafe for human life"
  severity: CRITICAL
  
  triggers_on: ANY [
    sensor.any.o2_level < 16%,
    sensor.any.co2_level > 5%,
    sensor.any.pressure < 0.8atm
  ]
  
  clears_on: ALL [
    sensor.all.o2_level > 18%,
    sensor.all.co2_level < 3%,
    sensor.all.pressure > 0.9atm
  ]
  
  # Actions when signal state changes
  on_trigger: {
    announce(ship_wide, "Atmosphere alert. Check environmental readings.")
  }
  
  on_clear: {
    announce(ship_wide, "Atmosphere normalised.")
  }
}
```

### Manual Signals

Signals that only trigger explicitly:

```starlang
signal bridge.override {
  description: "Bridge-authorised emergency override"
  manual_only: true
  
  trigger_requires: credential(CAPTAIN)
  
  auto_clear: 300s  # Clears after 5 minutes
}
```

### Composite Signals

Signals derived from other signals:

```starlang
signal emergency.critical {
  description: "Any critical emergency active"
  
  triggers_on: ANY [
    signal(atmo.critical),
    signal(power.critical),
    signal(alarm.fire),
    signal(hull.breach)
  ]
  
  clears_on: NONE [
    signal(atmo.critical),
    signal(power.critical),
    signal(alarm.fire),
    signal(hull.breach)
  ]
}
```

---

## Signal Propagation

When a signal triggers or clears, it propagates to all listeners. The propagation is:

1. **Immediate**: Happens within the same tick
2. **Ordered**: Processed in dependency order
3. **Cascading**: One signal can trigger another

### Propagation Example

```
Temperature sensor reads 85°C
    │
    ▼
signal(temp_high) triggers
    │
    ├──► relay fire_check activates
    │         │
    │         ▼
    │    signal(smoke_check) triggers
    │         │
    │         ▼
    │    If smoke > threshold:
    │         │
    │         ▼
    │    signal(alarm.fire) triggers
    │         │
    │         ├──► All fire_suppression nodes activate
    │         ├──► All doors seal
    │         └──► Bridge alert sounds
    │
    └──► Climate control adjusts
```

### Cascade Limits

To prevent infinite loops, the runtime limits cascade depth:

```
MAX_CASCADE_DEPTH: 10

If a signal chain exceeds this depth, the runtime:
1. Logs a warning
2. Stops further propagation
3. Marks the signal as FAULT_CASCADE
```

---

## Listening Patterns

### Direct Listen

A node explicitly waits for a signal:

```starlang
door emergency_exit {
  seal_on: signal(emergency.lockdown)
  unseal_on: signal(emergency.all_clear)
}
```

### Conditional Listen

React only if additional conditions are met:

```starlang
relay conditional_response {
  trigger: signal(alarm.fire) AND location == galley
  action: { 
    # Only responds to fires in the galley
  }
}
```

### One-Shot Listen

React once, then stop listening:

```starlang
relay one_time_setup {
  trigger: signal(system.boot)
  once: true
  action: {
    # Runs once at startup, never again
  }
}
```

### Debounced Listen

Ignore rapid repeated signals:

```starlang
relay debounced_alarm {
  trigger: signal(motion_detected)
  debounce: 5s  # Ignore for 5s after each trigger
  action: {
    announce(security, "Motion in restricted area")
  }
}
```

---

## Signal as Puzzle Mechanism

Signals are central to puzzles because:

1. **They bypass permissions**: A door might require CAPTAIN credentials OR a specific signal
2. **They can be faked**: If you can trigger the signal, you get the effect
3. **They cascade**: One signal might enable triggering another
4. **They're traceable**: `slvc` shows what signals fired and when

### Puzzle Example: The Sealed Door

```starlang
door engineering_access {
  unseal_requires: ANY [
    credential(ENGINEERING),
    signal(fire_suppression.galley.all_clear)
  ]
}
```

The player doesn't have ENGINEERING credentials. But they notice that fire suppression emits `all_clear` after a fire is resolved.

```starlang
fire_suppression galley_suppression {
  action: {
    suppress(galley)
    seal(galley.doors)
    
    after 60s: {
      if smoke_level < 50ppm {
        unseal(galley.doors)
        trigger(fire_suppression.galley.all_clear)  # There it is!
      }
    }
  }
}
```

**Solution**: Deliberately trigger the fire suppression (make smoke, trigger manually, or fake a sensor reading), wait for it to clear, and the signal unseals the door.

---

## Signal Inspection

### Query Active Signals

```
> signals

ACTIVE SIGNALS (nearby):
  atmo.critical (since 14:23:07)
  alarm.atmosphere (since 14:23:07)
  power.backup_active (since 14:22:55)

ACTIVE SIGNALS (ship-wide):
  emergency.condition_yellow (since 14:22:50)
```

### Trace a Signal

```
> trace signal.atmo.critical

SIGNAL TRACE: atmo.critical

Triggered: 2287.203.14:23:07
Triggered by: sensor.o2_galley
  Condition: o2_level < 16%
  Reading: 15.8%

Listeners notified: 47
  door.galley_to_corridor → SEALED
  door.galley_to_mess → SEALED
  alarm.atmosphere → TRIGGERED
  relay.emergency_response → EXECUTED
  ...

Cascade depth: 3
Cascade path:
  atmo.critical
    → alarm.atmosphere
      → emergency.condition_yellow
```

### Signal History

```
> slvc log signals --filter atmo

SIGNAL HISTORY: atmo.*

[2287.203.14:23:07] atmo.critical TRIGGERED
  by: sensor.o2_galley (15.8%)
  
[2287.203.14:22:58] atmo.warning TRIGGERED
  by: sensor.o2_galley (17.2%)
  
[2287.203.14:22:58] atmo.warning CLEARED
  by: auto_clear (condition no longer met)
  
[2287.203.12:00:00] atmo.all_clear TRIGGERED
  by: daily_check routine
```

---

## Advanced Signal Patterns

### Signal Guards

Prevent signals under certain conditions:

```starlang
signal alarm.fire {
  guard: NOT signal(maintenance_mode)
  # Won't trigger during maintenance
}
```

### Signal Priority

Some signals override others:

```starlang
signal bridge.override {
  priority: CRITICAL
  
  # When active, suppresses these signals
  suppresses: [
    door.emergency_seal,
    atmo.lockdown
  ]
}
```

### Timed Signals

Signals that auto-clear after a duration:

```starlang
signal door.emergency_release {
  auto_clear: 30s
  description: "Temporary door release during evacuation"
}
```

### Scoped Signals

Signals that only affect certain areas:

```starlang
signal atmo.critical {
  # Can be scoped to an area
  scope: [galley, cold_storage, crew_mess]
}

# Usage
trigger(atmo.critical, scope: [galley])
```
