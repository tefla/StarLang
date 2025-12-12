# Permission System

## Overview

StarLang has a role-based access control system that determines:

- Who can **view** a file or node
- Who can **edit** a file or node
- Who can **execute** certain actions
- Who can **access** physical locations and systems

This system is central to gameplay—the cook starts with minimal permissions and must find ways to expand their access.

---

## The Credential Hierarchy

```
                    CAPTAIN
                       │
                    OFFICER
         ┌─────────┬──┴──┬─────────┬─────────┐
         │         │     │         │         │
     SECURITY  ENGINEERING  MEDICAL  SCIENCE  OPERATIONS
                   │                              │
           ENGINEERING_JUNIOR              ┌─────┼─────┐
                                           │     │     │
                                         COOK  MAINT  STEWARD
```

### Role Definitions

| Role | Description | Typical Access |
|------|-------------|----------------|
| CAPTAIN | Ship commander | Everything |
| OFFICER | Bridge crew | Most systems, all areas |
| SECURITY | Security personnel | Weapons, cameras, locks |
| ENGINEERING | Engineers | All technical systems |
| ENGINEERING_JUNIOR | Junior engineers | Technical systems (supervised) |
| MEDICAL | Medical staff | Medical systems, health records |
| SCIENCE | Scientists | Research systems, sensors |
| OPERATIONS | Operations crew | Day-to-day ship operations |
| COOK | Galley staff | Food systems, galley area |
| MAINTENANCE | Maintenance crew | Cleaning, basic repairs |
| STEWARD | Passenger services | Passenger areas |

### The Player's Starting Role

Riley Chen is a **COOK**. This grants:

**View Access:**
- Galley systems
- Cold storage systems
- Crew mess public displays
- Public documentation
- Ship directory

**Edit Access:**
- Galley environment settings
- Food inventory
- Meal planning systems
- Cold storage temperature

**Physical Access:**
- Galley
- Cold storage
- Crew mess
- Public corridors

---

## Permission Declarations

### File-Level Permissions

Each `.sl` file can declare its access requirements:

```starlang
@permissions {
  view: credential(CREW) OR HIGHER
  edit: credential(ENGINEERING)
}

# ... rest of file
```

If no permissions are declared, the file inherits from its directory or uses system defaults.

### Node-Level Permissions

Individual nodes can have their own access requirements:

```starlang
terminal engineering_workstation {
  location: maintenance_junction
  
  access: credential(ENGINEERING) OR HIGHER
  
  # Even finer-grained
  view_files: credential(ENGINEERING)
  edit_files: credential(ENGINEERING) AND NOT signal(lockdown)
}
```

### Action Permissions

Some actions require specific credentials:

```starlang
door secure_door {
  # Anyone can try to open
  open_requires: credential(CREW)
  
  # But only security can change the lock settings
  configure_requires: credential(SECURITY)
  
  # And only officers can emergency override
  override_requires: credential(OFFICER)
}
```

---

## Permission Expressions

### Basic Credential Check

```starlang
access: credential(COOK)
```

Requires exactly COOK credential.

### Hierarchy Check

```starlang
access: credential(COOK) OR HIGHER
```

Requires COOK or any role above it in the hierarchy (OPERATIONS, OFFICER, CAPTAIN).

### Multiple Credentials

```starlang
# Either one works
access: ANY [
  credential(ENGINEERING),
  credential(SECURITY)
]

# Both required
access: ALL [
  credential(MEDICAL),
  credential(OFFICER)
]
```

### Combined Conditions

```starlang
access: ALL [
  credential(ENGINEERING),
  NOT signal(lockdown),
  time_between(0800, 2000)  # Daytime only
]
```

### Signal-Based Access

```starlang
unseal_requires: ANY [
  credential(CAPTAIN),
  signal(bridge.emergency_override)
]
```

This allows both credential-based and signal-based access—a key puzzle mechanism.

---

## How Players Gain Permissions

### Method 1: Found Credentials

The most straightforward way. Find a device or terminal with saved credentials.

**Engineering Tablet:**
```
DEVICE: Engineering Tablet (Model ST-4200)
Owner: Chen, M. (Engineer First Class)
Status: LOW BATTERY
Session: SAVED (last active 2287.203.14:18)

When powered, grants: credential(ENGINEERING)
```

**Logged-In Terminal:**
```
> whoami

Current session: Okafor, A. (Chief Engineer)
Credentials: ENGINEERING, OFFICER (acting)
Session timeout: NONE (maintenance mode)
```

### Method 2: Permission Inheritance

Some systems run with their installer's credentials.

```starlang
relay food_delivery_relay {
  # Installed by an engineer
  installed_by: "Torres, J."
  installed_credentials: credential(ENGINEERING)
  
  # Runs with those credentials!
  runs_as: credential(ENGINEERING)
  
  trigger: galley.meal_prep_complete
  action: {
    # This action executes with ENGINEERING permissions
    announce(crew_mess, "Meal service beginning")
  }
}
```

**The Exploit:**

If you can modify `action`, your modifications run with ENGINEERING permissions.

```starlang
# Modified by the clever cook
action: {
  announce(crew_mess, "Meal service beginning")
  
  # Snuck in with engineering permissions!
  unseal(door_to_maintenance)
}
```

### Method 3: Signal Exploitation

Many systems accept signals as alternatives to credentials.

```starlang
door blast_door {
  unseal_requires: ANY [
    credential(CAPTAIN),
    signal(internal_emergency)
  ]
}
```

The door doesn't care *how* `internal_emergency` gets triggered. If you can trigger that signal through any means, the door opens.

**The Exploit Chain:**
1. Fire suppression system triggers `fire_detected` on smoke
2. `fire_detected` triggers `internal_emergency`
3. `internal_emergency` unseals blast doors
4. Solution: Make smoke (or fake a smoke reading)

### Method 4: Classification Exploits

Systems are classified into categories for permission purposes. Sometimes classifications are wrong or exploitable.

```starlang
power_bus aux_power_4 {
  classification: PASSENGER_COMFORT  # Oops
  
  access: credential(OPERATIONS) OR HIGHER
  
  consumers: [
    lighting_corridor_4,
    charging_station_4,  # Requires ENGINEERING to use directly
    entertainment_display_4
  ]
}
```

The charging station requires ENGINEERING to activate directly. But it draws power from a bus classified as PASSENGER_COMFORT, which OPERATIONS (including COOK) can control.

**The Exploit:**
Create a fake "light" node that draws from the bus, wire your tablet to it.

### Method 5: Legacy Code

Old systems sometimes have outdated or lax permissions.

```starlang
# Ancient backup system nobody remembers
terminal backup_console_7 {
  location: storage_closet_4b
  
  # Set up in 2268, never updated
  access: credential(CREW)  # Any crew member!
  
  capabilities: [
    view_logs,
    backup_configs,
    restore_configs  # This is powerful
  ]
}
```

Finding legacy systems with broader access than they should have is a discovery moment.

---

## Permission Checking Flow

When a player attempts an action:

```
1. Get player's current credentials
   - Base role (COOK)
   - Found credentials (maybe ENGINEERING from tablet)
   - Active signals that grant access
   
2. Get action's requirements
   - Read from node definition
   - Apply any conditional modifiers
   
3. Evaluate
   - Check credential hierarchy
   - Check ANY/ALL conditions
   - Check signal conditions
   
4. Result
   - GRANTED: Action proceeds
   - DENIED: Show what's required
```

### Informative Denial

When access is denied, the player sees *why*:

```
> edit /deck_2/engineering/reactor.sl

ACCESS DENIED

Required: credential(ENGINEERING) OR HIGHER
You have: credential(COOK)

Hint: Engineering credentials can be obtained from:
  - Engineering terminals (when logged in)
  - Engineering personnel devices
  - Officer override (if available)
```

This transforms "you can't do that" into "here's what you need."

---

## Credential Stacking

A player can hold multiple credentials simultaneously:

```
> credentials

Current credentials:
  - COOK (base role: Riley Chen)
  - ENGINEERING (device: Chen, M.'s tablet)

Effective access level: ENGINEERING OR HIGHER
```

The highest credential applies for permission checks.

### Credential Sources

| Source | Persistence | Notes |
|--------|-------------|-------|
| Base role | Permanent | Your actual job |
| Found device | While carried/powered | Tablets, badges |
| Terminal session | While at terminal | Logged-in terminals |
| Signal | While signal active | Emergency overrides |

---

## Security Zones

Some areas have additional security beyond standard permissions.

### Physical Interlocks

```starlang
area bridge {
  security_zone: RESTRICTED
  
  # Multiple checks required
  entry_requires: ALL [
    credential(OFFICER) OR HIGHER,
    NOT signal(lockdown),
    biometric_scan(authorized_list)
  ]
}
```

The bridge requires credentials AND biometric verification. You can't just find a captain's badge—you need to either:
- Fool the biometric scanner
- Disable the scanner
- Find an override that bypasses it

### Cascading Permissions

Some high-security actions require multi-step authorization:

```starlang
action reactor_scram {
  # Step 1: Initiate
  initiate_requires: credential(ENGINEERING)
  
  # Step 2: Confirm (from different terminal)
  confirm_requires: ALL [
    credential(OFFICER),
    terminal != initiate_terminal
  ]
  
  # Both within 60 seconds
  timeout: 60s
}
```

This prevents a single compromised credential from triggering critical actions.

---

## Audit Logging

All permission-related actions are logged:

```
> slvc audit door_to_engineering

AUDIT LOG: door_to_engineering

[2287.203.16:42:15] ACCESS DENIED
  Requestor: Riley Chen (COOK)
  Action: open
  Required: credential(ENGINEERING)
  
[2287.203.14:22:58] ACCESS GRANTED
  Requestor: SYSTEM (automatic)
  Action: seal
  Reason: signal(atmo.critical)
  
[2287.203.12:45:22] ACCESS GRANTED
  Requestor: Chen, M. (ENGINEERING)
  Action: open
```

These logs are themselves permission-protected—but they're also valuable clues.
