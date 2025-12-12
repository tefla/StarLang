# Annotated Examples

## Complete Example: The Galley

This is a complete, annotated StarLang file for the galley—the player's starting location.

```starlang
# ==========================================
# GALLEY - Deck 4, Section 7
# UTS Meridian
# ==========================================
# 
# The galley serves as the primary food preparation area
# for crew during waking periods. Capacity: 12 crew on
# rotating shifts.
#
# Last modified: 2287.203.14:22:58 by SYSTEM (emergency)
# Previous: 2287.156.09:15:33 by Chen, M. (Engineer)
# ==========================================

# ------------------------------
# PERMISSIONS
# ------------------------------
# Who can view and edit this file

@permissions {
  view: credential(CREW) OR HIGHER          # Any crew can see this
  edit: credential(COOK) OR credential(ENGINEERING)  # Cooks or engineers can edit
}

# ------------------------------
# THE ROOM ITSELF
# ------------------------------

room galley {
  display_name: "Galley"
  deck: 4
  section: 7
  
  # Physical connections to other spaces
  adjacent: [crew_mess, cold_storage, corridor_4a]
  
  # Maximum occupancy (safety regulation)
  capacity: 6
  
  # Environmental targets
  # The actual values are managed by the atmo system
  environment: {
    target_temp: 22C
    target_humidity: 45%
    atmo_class: STANDARD  # Normal ship atmosphere
  }
}

# ------------------------------
# ATMOSPHERE SYSTEM
# ------------------------------
# How air flows in and out of the galley

node galley_intake : AtmoInlet {
  # Where the air comes from
  # PROBLEM: This was deck4_main, but that's offline
  # SYSTEM changed it to emergency_reserve during the incident
  source: atmo.emergency_reserve
  
  # Cubic meters per minute
  flow_rate: 0.8    # Reduced from normal 2.4 due to emergency reserve limits
  
  # What gets filtered out of incoming air
  filters: [DUST, PARTICULATE, COOKING_ODORS]
}

node galley_outlet : AtmoOutlet {
  # Where the air goes
  # PROBLEM: This was deck4_return, but that line has a breach
  # SYSTEM changed it to VOID.external (!!!!) which is WRONG
  target: VOID.external    # <-- THIS IS THE BUG THE PLAYER MUST FIX
  
  flow_rate: 2.4    # Still trying to push full flow out
  
  # NOTE: With intake at 0.8 and outlet at 2.4, we're losing
  # 1.6 cubic meters per minute. That's why O2 is dropping.
}

# The CO2 scrubber
scrubber galley_scrubber {
  location: galley
  capacity: 89%              # Needs replacement soonish but not urgent
  power_source: power.local_4
  
  # Alert when running low
  on_capacity_change: |capacity| {
    if capacity < 50% {
      alert(terminal_galley, "Scrubber at {capacity}% - schedule replacement")
    }
    if capacity < 20% {
      trigger(alarm.scrubber_critical)
    }
  }
}

# ------------------------------
# DOORS
# ------------------------------

door galley_to_cold {
  display_name: "Cold Storage Access"
  connects: [galley, cold_storage]
  type: SLIDING
  lock: NONE                  # No lock - cooks need constant access
  power_source: power.local_4
  
  # Courtesy announcement when entering cold storage
  on_open: {
    if cold_storage.current_temp < 0C {
      announce(galley, "Cold storage access. Temperature: {cold_storage.current_temp}")
    }
  }
}

door galley_to_mess {
  display_name: "Mess Hall Access"
  connects: [galley, crew_mess]
  type: SLIDING
  lock: NONE
  power_source: power.local_4
  
  # This door is stuck due to debris - mechanical, not software
  # The player can fix this by power cycling or physical force
  mechanical_status: OBSTRUCTED  # Runtime flag, not editable
}

door galley_to_corridor {
  display_name: "Corridor 4-Alpha Access"
  connects: [galley, corridor_4a]
  type: SLIDING
  lock: EMERGENCY_SEAL        # Sealed by emergency protocols
  power_source: power.local_4
  
  # What triggers this door to seal
  seal_on: signal(atmo_local.critical)
  
  # What's required to unseal it
  # NOTE: The player needs to either:
  #   1. Get OFFICER credentials (hard)
  #   2. Get SECURITY credentials (hard)
  #   3. Trigger bridge.emergency_override (very hard)
  #   4. Clear atmo_local to trigger all_clear (this is the intended path!)
  unseal_requires: ANY [
    credential(OFFICER),
    credential(SECURITY),
    signal(bridge.emergency_override),
    signal(atmo_local.all_clear)
  ]
  
  on_access_denied: {
    announce(galley, "Door sealed: atmosphere emergency. Resolve atmosphere fault to unseal.")
  }
}

# ------------------------------
# SENSORS
# ------------------------------

sensor temp_galley : TEMPERATURE {
  location: galley
  sample_rate: 1Hz
  reports_to: [galley_env_controller, terminal_galley]
  
  on_reading: |temp| {
    if temp > 35C {
      alert(terminal_galley, "High temperature warning: {temp}")
    }
    if temp > 50C {
      trigger(alarm.fire)
    }
  }
}

sensor smoke_galley : SMOKE {
  location: galley
  sample_rate: 2Hz
  reports_to: [fire_suppression_galley, terminal_galley]
  
  # Cooking generates some smoke, so threshold is higher than normal
  threshold: 200ppm  # Normal rooms are 100ppm
  
  on_reading: |smoke| {
    if smoke > threshold {
      trigger(fire_check_galley)
    }
  }
}

sensor o2_galley : OXYGEN {
  location: galley
  sample_rate: 1Hz
  reports_to: [atmo_local, terminal_galley]
  
  on_reading: |o2| {
    if o2 < 19% {
      alert(terminal_galley, "Low oxygen: {o2}%")
    }
    if o2 < 16% {
      trigger(atmo_local.critical)
    }
  }
}

# ------------------------------
# TERMINALS
# ------------------------------

terminal terminal_galley {
  display_name: "Galley Control Terminal"
  location: galley
  type: APPLICATION           # Shows a GUI, not code
  power_source: power.local_4
  
  # Who can use this terminal
  access: credential(COOK) OR HIGHER
  
  # What application it runs
  application: "galley_control"
  
  # What files this terminal can access (for status queries)
  mounted_files: [
    "/deck_4/section_7/galley.sl",
    "/deck_4/section_7/cold_storage.sl",
    "/deck_4/section_7/crew_mess.sl"
  ]
  
  # What the terminal can "see" via status queries
  visible_scope: [galley, cold_storage, crew_mess, corridor_4a]
  
  # What the terminal can edit (with appropriate permissions)
  edit_scope: [galley, cold_storage]
}

# A second terminal - this one is an engineering workstation
# that Chen, M. was using and LEFT LOGGED IN
terminal terminal_galley_engineering {
  display_name: "Engineering Workstation (Portable)"
  location: galley
  type: ENGINEERING           # Shows code editor!
  power_source: power.local_4
  
  # Normal access requirement
  access: credential(ENGINEERING)
  
  # BUT: Current session is still active
  # This is how the player first sees StarLang code
  current_session: {
    user: "Chen, M."
    credential: credential(ENGINEERING)
    started: 2287.203.12:45:00
    timeout: NONE              # Maintenance mode - no timeout
  }
  
  # Engineering terminals see more
  visible_scope: deck_4.*
  edit_scope: [galley, cold_storage, crew_mess, corridor_4a, maintenance_j4]
}

# ------------------------------
# SAFETY SYSTEMS
# ------------------------------

fire_suppression fire_suppression_galley {
  location: galley
  type: CHEMICAL              # Not water - it's a kitchen
  
  # What triggers suppression
  trigger: ANY [
    signal(smoke_galley) > 300ppm,   # Higher threshold for kitchen
    signal(temp_galley) > 150C,
    manual_trigger                    # Physical button on wall
  ]
  
  # What happens when triggered
  # NOTE: This is exploitable! The all_clear signal can unseal doors!
  action: {
    # Suppress the fire
    suppress(galley)
    
    # Seal the room to contain
    seal(galley_to_cold)
    seal(galley_to_mess)
    seal(galley_to_corridor)
    
    # Alert the bridge
    alert(bridge, "Fire suppression activated: Galley")
    
    # After 60 seconds, check if we can clear
    after 60s: {
      if smoke_galley.current_reading < 50ppm {
        unseal(galley_to_cold)
        unseal(galley_to_mess)
        # Note: galley_to_corridor might still be sealed by atmo_local.critical
        
        # This signal is key - it can be used to unseal things!
        trigger(fire_suppression.galley.all_clear)
      }
    }
  }
}

# ------------------------------
# RELAYS
# ------------------------------

# A legacy relay that Torres installed years ago
# This runs with ENGINEERING permissions!
relay food_delivery_relay {
  note: "Installed 2284.203 by Torres, J. - Meal announcements"
  
  # When this triggers
  trigger: cold_storage.door_state == OPEN AND galley.prep_active == true
  
  # What it does (runs with installer's permissions!)
  installed_by: "Torres, J."
  runs_as: credential(ENGINEERING)
  
  action: {
    announce(crew_mess, "Meal service beginning shortly.")
  }
  
  # If the player modifies this action, it runs with ENGINEERING permissions
  # This is a key exploit for permission escalation
}
```

---

## Example: A Door Puzzle

Here's a simpler example showing just a door with multiple unlock paths:

```starlang
# Medical bay auxiliary door
# The player wants to get in for medical supplies

door medbay_aux_door {
  display_name: "Medical Bay Auxiliary"
  connects: [corridor_4a, medbay_auxiliary]
  type: SLIDING
  lock: STANDARD
  power_source: power.local_4
  
  # Multiple ways to open this door:
  access: ANY [
    # Path 1: Have medical credentials (player doesn't)
    credential(MEDICAL),
    
    # Path 2: Have officer credentials (player doesn't)
    credential(OFFICER),
    
    # Path 3: Medical emergency signal active
    # The player could fake a medical emergency somehow
    signal(medical_emergency),
    
    # Path 4: Physical override from INSIDE the medbay
    # If the player can get in another way, they can unlock from inside
    manual_override(medbay_auxiliary)
  ]
  
  on_access_denied: |requester| {
    log("Access denied: {requester} attempted medbay entry")
    
    # This log is visible to anyone who can query the door
    # It might reveal that Dr. Yusuf tried to get in right before the incident
  }
}

# The medical emergency signal definition
signal medical_emergency {
  description: "Medical emergency requiring immediate response"
  
  # Can be triggered by:
  triggers_on: ANY [
    # Medical staff pressing emergency button
    button(medical_emergency_button),
    
    # Automated detection of health crisis
    sensor.vitals.any < CRITICAL_THRESHOLD,
    
    # Ship-wide emergency protocols
    signal(emergency.all_hands)
  ]
  
  # Auto-clears after 10 minutes unless renewed
  auto_clear: 600s
}
```

**Puzzle Analysis:**

The player wants into the medbay. Looking at the door definition, they see four paths:

1. **MEDICAL credentials** - They'd need to find Dr. Yusuf's badge or terminal
2. **OFFICER credentials** - Even harder to get
3. **medical_emergency signal** - Could be triggered by... what?
4. **Manual override from inside** - Useless unless they're already in

Looking at the signal definition, `medical_emergency` triggers on:
- A button they don't have access to
- A vitals sensor they can't fake
- `emergency.all_hands` - what triggers THAT?

Investigating `emergency.all_hands` might reveal it's triggered by the bridge, or by multiple simultaneous emergencies, leading to a longer puzzle chain.

---

## Example: Signal Chain

A more complex example showing how signals cascade:

```starlang
# The sequence: smoke → fire check → alarm → response → door unlock

sensor smoke_engineering : SMOKE {
  location: engineering_main
  threshold: 100ppm
  
  on_reading: |smoke| {
    if smoke > threshold {
      trigger(fire_check.engineering)  # Step 1
    }
  }
}

relay fire_check_engineering {
  trigger: signal(fire_check.engineering)
  
  action: {
    # Check if it's a real fire or just steam
    wait(5s)
    
    if smoke_engineering.current_reading > 150ppm {
      trigger(alarm.fire.engineering)  # Step 2: Real fire
    } else {
      clear(fire_check.engineering)    # False alarm
      log("Fire check: engineering - cleared (transient)")
    }
  }
}

relay fire_response_engineering {
  trigger: signal(alarm.fire.engineering)
  
  action: {
    # Step 3: Full fire response
    trigger(emergency.fire)             # Ship-wide fire status
    
    activate(fire_suppression.engineering)
    seal(engineering_main.doors)
    
    # Alert appropriate personnel
    alert(bridge, "FIRE: Engineering Main")
    alert(damage_control, "FIRE: Engineering Main")
  }
}

signal emergency.fire {
  severity: CRITICAL
  
  # When ANY fire alarm is active
  triggers_on: ANY [
    signal(alarm.fire.*),  # Wildcard - any fire alarm
  ]
  
  # Ship-wide effects
  on_trigger: {
    # This releases all fire-related door locks
    trigger(door.fire_release)  # Step 4: Doors unlock!
  }
}

door engineering_blast_door {
  lock: SECURITY_SEAL
  
  # Normally requires security credentials
  access: credential(SECURITY) OR HIGHER
  
  # BUT: Fire release overrides security!
  unseal_on: signal(door.fire_release)  # This is the exploit
  
  # Re-seals when fire is cleared
  seal_on: clear(emergency.fire)
}
```

**The Chain:**

```
smoke_engineering reads > 100ppm
    │
    ▼
fire_check.engineering triggers
    │
    ▼
fire_check_engineering relay waits 5s, confirms smoke
    │
    ▼
alarm.fire.engineering triggers
    │
    ▼
fire_response_engineering activates
    │
    ├─► emergency.fire triggers
    │       │
    │       ▼
    │   door.fire_release triggers
    │       │
    │       ▼
    │   engineering_blast_door UNSEALS!  ← Player goal
    │
    └─► fire_suppression activates, etc.
```

**How the player exploits this:**

1. Find a way to make smoke in engineering (or fake the sensor reading)
2. Wait for the cascade to complete
3. Walk through the now-unsealed blast door
4. Deal with the consequences (fire suppression, alerts, etc.)
