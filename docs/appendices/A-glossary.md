# Appendix A: Glossary

## In-Universe Terms

### Ship and Navigation

| Term | Definition |
|------|------------|
| **UTS** | United Terran Ship, standard prefix for Earth-registered vessels |
| **Meridian** | The player's ship, a Horizon-IV class colony transport |
| **Deck** | A horizontal level of the ship (Deck 1 is topmost/bridge) |
| **Section** | A subdivision of a deck, containing related areas |
| **Stasis** | Suspended animation for long-duration spaceflight |
| **Waking period** | Times when crew/passengers are active (departure, arrival) |
| **SCRAM** | Emergency reactor shutdown (Safety Control Rod Axe Man) |

### Ship Systems

| Term | Definition |
|------|------------|
| **Atmo** | Atmosphere system—air circulation, O2, CO2 scrubbing |
| **Scrubber** | Device that removes CO2 from atmosphere |
| **Interlock** | Safety device that prevents dangerous operations |
| **Bus** | Power distribution line serving multiple consumers |
| **Relay** | Automated system that responds to signals |
| **Terminal** | User interface device for ship systems |
| **Seal** | Emergency closure of a door due to atmosphere danger |

### Roles and Permissions

| Term | Definition |
|------|------------|
| **Credential** | Permission level associated with a role |
| **Access** | Permission to use or view something |
| **Override** | Higher-authority action that bypasses normal restrictions |
| **Clearance** | General permission level (e.g., "engineering clearance") |

### The Incident

| Term | Definition |
|------|------------|
| **The incident** | The unexplained event that damaged the ship |
| **Cascade failure** | Chain reaction of system failures |
| **Anomaly** | The mysterious code/signal discovered by Okafor |

---

## Technical Terms (StarLang)

### Language Concepts

| Term | Definition |
|------|------------|
| **Node** | Any defined entity in StarLang (room, door, sensor, etc.) |
| **Definition** | The static description of a node from source code |
| **State** | The runtime values of a node (can change during execution) |
| **Property** | A named attribute of a node definition |
| **Reference** | A link from one node to another |
| **Signal** | An event that propagates through the system |
| **Condition** | A boolean expression evaluated at runtime |
| **Action block** | Code that executes in response to events |

### File System

| Term | Definition |
|------|------------|
| **.sl file** | StarLang source file |
| **Manifest** | Ship-wide metadata file |
| **Layout** | File defining physical arrangement of a deck |
| **Namespace** | Shorthand prefix for system references (e.g., `atmo.`) |

### Runtime Concepts

| Term | Definition |
|------|------------|
| **Tick** | One cycle of the simulation loop |
| **Dirty** | A node that needs re-evaluation |
| **Propagation** | Spreading signal effects to listeners |
| **Cascade** | Chain of signal triggers |
| **Reconciliation** | Updating runtime after code changes |
| **Hot-reload** | Applying code changes without losing state |

### Version Control (slvc)

| Term | Definition |
|------|------------|
| **Commit** | A saved snapshot of a file's content |
| **Hash** | Short unique identifier for a commit |
| **Log** | History of commits for a file |
| **Diff** | Comparison showing changes between versions |
| **Revert** | Restore a file to a previous version |
| **Blame** | Per-line attribution showing who changed what |

---

## Abbreviations

| Abbrev | Meaning |
|--------|---------|
| **AST** | Abstract Syntax Tree |
| **CO2** | Carbon dioxide |
| **GUI** | Graphical User Interface |
| **Hz** | Hertz (cycles per second) |
| **kW** | Kilowatts |
| **O2** | Oxygen |
| **slvc** | StarLang Version Control |
| **UI** | User Interface |

---

## Node Type Quick Reference

| Type | Description | Key Properties |
|------|-------------|----------------|
| `room` | Physical space | deck, adjacent, capacity |
| `corridor` | Connecting space | connects, capacity |
| `door` | Passage control | connects, lock, access |
| `sensor` | Environmental detection | type, location, threshold |
| `relay` | Automated response | trigger, action |
| `terminal` | User interface | type, access, mounted_files |
| `signal` | Event notification | triggers_on, clears_on |
| `scrubber` | CO2 removal | location, capacity |
| `power_node` | Power distribution | source, consumers |
| `fire_suppression` | Fire response | location, trigger |

---

## Signal Namespaces

| Namespace | Purpose | Examples |
|-----------|---------|----------|
| `atmo.*` | Atmosphere | `atmo.critical`, `atmo.all_clear` |
| `power.*` | Power system | `power.overload`, `power.backup_active` |
| `alarm.*` | Alerts | `alarm.fire`, `alarm.intruder` |
| `door.*` | Door states | `door.emergency_release` |
| `safety.*` | Safety systems | `safety.interlock_7` |
| `bridge.*` | Bridge commands | `bridge.override` |
| `emergency.*` | Ship-wide | `emergency.evacuate` |
