# Node Types

## Overview

Everything in StarLang is a **node**. Nodes are the building blocks of the ship—physical spaces, devices, systems, and abstract concepts. Each node type has specific properties and behaviours.

---

## Physical Spaces

### room

Defines a physical space on the ship.

```starlang
room galley {
  display_name: "Galley"
  deck: 4
  section: 7
  adjacent: [crew_mess, cold_storage, corridor_4a]
  capacity: 6
  
  environment: {
    target_temp: 22C
    target_humidity: 45%
    atmo_class: STANDARD
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| display_name | string | Human-readable name |
| deck | number | Deck number |
| section | number | Section number |
| adjacent | list | Connected rooms |
| capacity | number | Max occupants |
| environment | object | Environmental settings |

**Runtime State:**

| State | Type | Description |
|-------|------|-------------|
| occupants | list | Who's in the room |
| current_temp | number | Actual temperature |
| current_humidity | number | Actual humidity |
| o2_level | number | Oxygen percentage |
| co2_level | number | CO2 percentage |
| pressure | number | Atmospheric pressure |

### corridor

A connective space between rooms.

```starlang
corridor corridor_4a {
  display_name: "Corridor 4-Alpha"
  deck: 4
  connects: [galley, crew_mess, maintenance_j4, medbay_aux]
  capacity: 8
}
```

Similar to room but typically narrower and used for transit.

### deck

A horizontal level of the ship.

```starlang
deck deck_4 {
  display_name: "Crew Services Deck"
  sections: [section_7, section_8, section_9]
  elevator_access: elevator_main
  emergency_stairs: [stairs_forward, stairs_aft]
}
```

---

## Doors and Access

### door

Controls passage between spaces.

```starlang
door galley_to_corridor {
  connects: [galley, corridor_4a]
  type: SLIDING           # SLIDING, HATCH, BLAST, AIRLOCK
  lock: STANDARD          # NONE, STANDARD, SECURITY, EMERGENCY_SEAL
  power_source: power.local_4
  
  access: credential(CREW) OR HIGHER
  
  seal_on: signal(atmo.critical)
  
  unseal_requires: ANY [
    credential(OFFICER),
    signal(atmo.all_clear)
  ]
  
  on_open: {
    log("Door opened by {requester}")
  }
  
  on_access_denied: {
    announce(location, "Access denied. Insufficient credentials.")
  }
}
```

**Door Types:**

| Type | Description |
|------|-------------|
| SLIDING | Standard automatic door |
| HATCH | Manual hatch (submarine style) |
| BLAST | Heavy security/emergency door |
| AIRLOCK | Two-stage door for vacuum areas |

**Lock Types:**

| Lock | Description |
|------|-------------|
| NONE | Always openable |
| STANDARD | Requires basic credentials |
| SECURITY | Requires security credentials |
| EMERGENCY_SEAL | Sealed by emergency signal |

**Runtime State:**

| State | Type | Description |
|-------|------|-------------|
| state | enum | OPEN, CLOSED, SEALED, JAMMED |
| sealed_by | signal | What signal sealed it |
| last_opened | timestamp | When it was last opened |
| last_opened_by | string | Who opened it |

### airlock

Specialised door for vacuum transitions.

```starlang
airlock cargo_airlock_1 {
  inner_door: airlock_1_inner
  outer_door: airlock_1_outer
  chamber: airlock_1_chamber
  
  cycle_time: 30s
  
  safety: {
    prevent_both_open: true
    require_suit_check: true
    emergency_vent: signal(emergency_evac)
  }
}
```

---

## Atmosphere System

### atmo_node

A node in the atmosphere distribution system.

```starlang
node galley_intake : AtmoInlet {
  source: atmo.deck4_main
  flow_rate: 2.4
  filters: [DUST, PARTICULATE]
}

node galley_outlet : AtmoOutlet {
  target: atmo.deck4_return
  flow_rate: 2.4
}
```

**Inlet Properties:**

| Property | Type | Description |
|----------|------|-------------|
| source | reference | Where air comes from |
| flow_rate | number | Volume per time |
| filters | list | What gets filtered |

**Outlet Properties:**

| Property | Type | Description |
|----------|------|-------------|
| target | reference | Where air goes |
| flow_rate | number | Volume per time |

### scrubber

CO2 removal and air processing.

```starlang
scrubber galley_scrubber {
  location: galley
  capacity: 100%
  power_source: power.local_4
  
  on_capacity_low: {
    if capacity < 20% {
      alert(terminal_galley, "Scrubber capacity low: {capacity}")
    }
  }
}
```

**Runtime State:**

| State | Type | Description |
|-------|------|-------------|
| capacity | number | Remaining capacity |
| status | enum | ACTIVE, STANDBY, FAULT |
| processing_rate | number | Current CO2 removal rate |

---

## Power System

### power_node

A node in the power distribution grid.

```starlang
power_node power.local_4 {
  source: power.deck4_grid
  backup: power.emergency_battery_4
  
  capacity: 2.4kW
  
  consumers: [
    galley_lights,
    galley_vent,
    galley_terminal,
    cold_storage_cooling
  ]
  
  priority_order: [
    cold_storage_cooling,  # Highest
    galley_vent,
    galley_lights,         # Lowest
  ]
  
  on_overload: {
    shed_load(priority: LOW_FIRST)
  }
}
```

**Runtime State:**

| State | Type | Description |
|-------|------|-------------|
| current_draw | number | Watts being consumed |
| available | number | Watts available |
| status | enum | OK, OVERLOADED, FAULT |
| backup_active | boolean | Using backup power? |

### power_bus

A shared power distribution bus.

```starlang
power_bus aux_power_4 {
  source: power.local_4
  
  consumers: [
    charging_station_4,
    lighting_corridor_4,
    entertainment_display
  ]
  
  classification: PASSENGER_COMFORT
}
```

---

## Sensors

### sensor

Detects environmental conditions.

```starlang
sensor temp_galley : TEMPERATURE {
  location: galley
  sample_rate: 1Hz
  reports_to: [galley_env_controller, terminal_galley]
  
  on_reading: |temp| {
    if temp > 50C {
      trigger(alarm.fire)
    }
  }
}
```

**Sensor Types:**

| Type | Measures |
|------|----------|
| TEMPERATURE | Temperature |
| PRESSURE | Atmospheric pressure |
| OXYGEN | O2 percentage |
| CO2 | CO2 percentage |
| HUMIDITY | Relative humidity |
| SMOKE | Smoke/particulates |
| MOTION | Movement detection |
| RADIATION | Radiation levels |

**Common Properties:**

| Property | Type | Description |
|----------|------|-------------|
| location | reference | Where the sensor is |
| sample_rate | duration | How often it reads |
| reports_to | list | What receives readings |

**Runtime State:**

| State | Type | Description |
|-------|------|-------------|
| current_reading | number | Latest measurement |
| last_updated | timestamp | When last read |
| status | enum | OK, FAULT, OFFLINE |

---

## Terminals

### terminal

User interface devices.

```starlang
terminal galley_terminal {
  location: galley
  type: APPLICATION        # APPLICATION, ENGINEERING, STATUS, COMMAND
  
  access: credential(COOK) OR HIGHER
  power_source: power.local_4
  
  application: "food_inventory"
  
  mounted_files: [
    "/galley/inventory.sl",
    "/galley/temp_control.sl"
  ]
  
  visible_scope: [galley, cold_storage, crew_mess]
  edit_scope: [galley, cold_storage]
}
```

**Terminal Types:**

| Type | Description | Shows |
|------|-------------|-------|
| APPLICATION | Purpose-built GUI | Specific application |
| ENGINEERING | Code editor | StarLang files |
| STATUS | Read-only displays | Sensor data, status |
| COMMAND | Command line | Query interface |

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| type | enum | Terminal type |
| application | string | App to display (APPLICATION type) |
| mounted_files | list | Accessible files (ENGINEERING type) |
| visible_scope | list | Nodes that can be queried |
| edit_scope | list | Nodes that can be edited |

---

## Relays and Logic

### relay

Connects signals and triggers automated responses.

```starlang
relay fire_response_relay {
  trigger: signal(smoke_detected)
  
  action: {
    trigger(alarm.fire)
    trigger(fire_suppression.activate)
    seal(affected_area.doors)
    announce(ship_wide, "Fire detected in {location}")
  }
  
  installed_by: "Torres, J."
  runs_as: credential(ENGINEERING)
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| trigger | condition | What activates it |
| action | block | What it does |
| installed_by | string | Who created it |
| runs_as | credential | Permission level |

### timer

Time-based triggers.

```starlang
timer daily_report {
  schedule: "0800 daily"
  
  action: {
    generate_report(ship_status)
    distribute(officers)
  }
}
```

### condition

Named condition for reuse.

```starlang
condition atmosphere_safe {
  expression: ALL [
    o2_level > 18%,
    co2_level < 3%,
    pressure > 0.9atm,
    pressure < 1.1atm
  ]
}

door some_door {
  unseal_requires: condition(atmosphere_safe)
}
```

---

## Safety Systems

### safety_interlock

Prevents dangerous operations.

```starlang
safety_interlock airlock_interlock {
  prevents: ALL [
    airlock.inner_door.state == OPEN,
    airlock.outer_door.state == OPEN
  ]
  
  override_requires: ALL [
    credential(OFFICER),
    physical_key(airlock_override)
  ]
  
  on_violation_attempt: {
    alert(bridge, "Airlock interlock violation attempt")
  }
}
```

### fire_suppression

Fire response system.

```starlang
fire_suppression galley_suppression {
  location: galley
  type: CHEMICAL
  
  trigger: ANY [
    signal(smoke_galley) > 200ppm,
    signal(temp_galley) > 150C,
    manual_trigger
  ]
  
  action: {
    suppress(galley)
    seal(galley.doors)
    alert(bridge, "Fire suppression: Galley")
    
    after 60s: {
      if smoke_level < 50ppm {
        unseal(galley.doors)
        clear(alarm.fire)
      }
    }
  }
}
```

---

## Communication

### intercom

Ship-wide or local communication.

```starlang
intercom ic_section_7 {
  serves: [galley, cold_storage, crew_mess, corridor_4a]
  power_source: power.local_4
  
  access: ANY [
    credential(OFFICER),
    terminal_galley WITH credential(COOK)
  ]
}
```

### alert

Ship alert system.

```starlang
alert alarm.fire {
  severity: CRITICAL
  visual: RED_FLASH
  audio: KLAXON
  message: "Fire detected - {location}"
  
  triggers: [
    fire_response_relay,
    bridge_notification
  ]
}
```

---

## Abstract Nodes

### signal

Named signal that can be triggered and listened for.

```starlang
signal atmo.critical {
  description: "Atmosphere unsafe for human life"
  
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
}
```

### credential

Defined in permissions but can be referenced as nodes.

```starlang
credential COOK {
  display_name: "Galley Staff"
  parent: OPERATIONS
  
  default_access: [
    "/deck_4/section_7/galley.sl",
    "/deck_4/section_7/cold_storage.sl"
  ]
}
```

---

## Quick Reference

| Category | Node Types |
|----------|------------|
| Physical spaces | room, corridor, deck |
| Access | door, airlock |
| Atmosphere | atmo_node (AtmoInlet, AtmoOutlet), scrubber |
| Power | power_node, power_bus |
| Sensors | sensor (many subtypes) |
| Interfaces | terminal |
| Logic | relay, timer, condition |
| Safety | safety_interlock, fire_suppression |
| Communication | intercom, alert |
| Abstract | signal, credential |
