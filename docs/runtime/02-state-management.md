# State Management

## The Fundamental Separation

StarLang separates **definitions** from **state**:

| Definitions | State |
|-------------|-------|
| What things ARE | What things ARE DOING |
| Compiled from .sl files | Updated at runtime |
| Immutable (until recompile) | Mutable (every tick) |
| Structure and behaviour | Current values |
| Survives file edits | Survives file edits |

This separation is crucial for hot-reloading: when the player edits a file, we update definitions without losing state.

---

## Definition Objects

Definitions describe the static structure and behaviour of nodes.

```
NodeDefinition {
  id: string              // Unique identifier
  type: NodeType          // ROOM, DOOR, SENSOR, etc.
  
  // Static properties from .sl file
  properties: {
    display_name: string
    deck: number
    adjacent: string[]
    // ... etc
  }
  
  // Connections to other nodes
  connections: string[]
  
  // Trigger conditions
  triggers: TriggerDefinition[]
  
  // Action blocks
  actions: {
    on_open: ActionBlock
    on_reading: ActionBlock
    // ... etc
  }
  
  // Permission requirements
  permissions: {
    view: PermissionExpr
    edit: PermissionExpr
  }
}
```

Definitions are **immutable** after compilation. If a file changes, we create new definitions and reconcile.

---

## State Objects

State objects hold runtime values that change during execution.

```
NodeState {
  id: string              // Matches definition id
  
  // Current values (varies by node type)
  values: {
    // Door state
    state: 'OPEN' | 'CLOSED' | 'SEALED' | 'JAMMED'
    sealed_by: string | null
    
    // Sensor state
    current_reading: number
    last_updated: timestamp
    
    // Room state
    occupants: string[]
    current_temp: number
    o2_level: number
    
    // ... etc
  }
  
  // Metadata
  lastModified: timestamp
  modifiedBy: string
}
```

State objects are **mutable**. They update every tick and persist across recompiles.

---

## The State Store

The state store provides access to all runtime state.

```
class StateStore {
  private states: Map<string, NodeState>
  private subscribers: Map<string, Set<Callback>>
  
  // Read state
  get(nodeId: string, property: string): any {
    return this.states.get(nodeId)?.values[property]
  }
  
  // Write state
  set(nodeId: string, property: string, value: any): void {
    const state = this.states.get(nodeId)
    if (state) {
      const oldValue = state.values[property]
      state.values[property] = value
      state.lastModified = Date.now()
      
      // Notify subscribers if changed
      if (oldValue !== value) {
        this.notify(nodeId, property, value, oldValue)
      }
    }
  }
  
  // Subscribe to changes
  subscribe(path: string, callback: Callback): Unsubscribe {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set())
    }
    this.subscribers.get(path).add(callback)
    
    return () => this.subscribers.get(path).delete(callback)
  }
  
  // Notify subscribers
  private notify(nodeId: string, property: string, value: any, oldValue: any): void {
    const path = `${nodeId}.${property}`
    const callbacks = this.subscribers.get(path)
    if (callbacks) {
      for (const callback of callbacks) {
        callback(value, oldValue)
      }
    }
  }
}
```

---

## State by Node Type

Different node types have different state schemas.

### Room State

```
RoomState {
  values: {
    occupants: string[]      // List of entity IDs in the room
    current_temp: number     // Actual temperature (°C)
    target_temp: number      // Thermostat setting
    humidity: number         // Relative humidity (%)
    o2_level: number         // Oxygen percentage
    co2_level: number        // CO2 percentage
    pressure: number         // Atmospheric pressure (atm)
    lighting: number         // Light level (0-100%)
    power_status: 'OK' | 'LOW' | 'FAULT' | 'OFFLINE'
  }
}
```

### Door State

```
DoorState {
  values: {
    state: 'OPEN' | 'CLOSED' | 'SEALED' | 'JAMMED'
    sealed_by: string | null    // Signal that sealed it
    sealed_at: timestamp | null
    last_opened: timestamp | null
    last_opened_by: string | null
    power_status: 'OK' | 'FAULT' | 'OFFLINE'
    mechanical_status: 'OK' | 'OBSTRUCTED' | 'DAMAGED'
  }
}
```

### Sensor State

```
SensorState {
  values: {
    current_reading: number
    last_updated: timestamp
    status: 'OK' | 'FAULT' | 'OFFLINE' | 'CALIBRATING'
    fault_reason: string | null
  }
}
```

### Atmosphere Node State

```
AtmoNodeState {
  values: {
    flow_rate: number        // Actual flow (may differ from configured)
    status: 'ACTIVE' | 'STANDBY' | 'FAULT' | 'OFFLINE'
    fault_reason: string | null
    source_available: boolean
    target_available: boolean
  }
}
```

### Signal State

```
SignalState {
  values: {
    active: boolean
    triggered_at: timestamp | null
    triggered_by: string | null    // What triggered it
    clear_at: timestamp | null     // Auto-clear time (if set)
  }
}
```

---

## State Initialisation

When a new node is compiled, state is initialised based on the definition.

```
function initializeState(def: NodeDefinition): NodeState {
  switch (def.type) {
    case 'DOOR':
      return {
        id: def.id,
        values: {
          state: def.properties.initial_state ?? 'CLOSED',
          sealed_by: null,
          sealed_at: null,
          last_opened: null,
          last_opened_by: null,
          power_status: 'OK',
          mechanical_status: def.properties.mechanical_status ?? 'OK'
        },
        lastModified: Date.now(),
        modifiedBy: 'SYSTEM'
      }
      
    case 'ROOM':
      return {
        id: def.id,
        values: {
          occupants: [],
          current_temp: def.properties.environment?.target_temp ?? 22,
          target_temp: def.properties.environment?.target_temp ?? 22,
          humidity: def.properties.environment?.target_humidity ?? 45,
          o2_level: 21,  // Normal Earth atmosphere
          co2_level: 0.04,
          pressure: 1.0,
          lighting: 100,
          power_status: 'OK'
        },
        lastModified: Date.now(),
        modifiedBy: 'SYSTEM'
      }
      
    // ... other node types
  }
}
```

---

## State Persistence

State needs to survive:

1. **Tick-to-tick**: Normal operation
2. **File edits**: Hot-reloading
3. **Game saves**: (Stretch goal)

### In-Memory Persistence

During normal operation, state lives in the StateStore. It's just JavaScript objects in memory.

### Hot-Reload Preservation

When a file is edited:

```
function reconcileState(oldDefs: Map, newDefs: Map, stateStore: StateStore) {
  for (const [id, newDef] of newDefs) {
    const oldDef = oldDefs.get(id)
    const currentState = stateStore.get(id)
    
    if (!oldDef) {
      // New node - initialize fresh state
      stateStore.setState(id, initializeState(newDef))
    } 
    else if (currentState) {
      // Existing node - preserve state
      // State stays as-is; only definition changes
    }
  }
  
  // Handle deleted nodes
  for (const id of oldDefs.keys()) {
    if (!newDefs.has(id)) {
      stateStore.delete(id)
    }
  }
}
```

### Save/Load (Stretch Goal)

For full game saves:

```
function saveGame(): SaveData {
  return {
    timestamp: Date.now(),
    playerPosition: player.currentRoom,
    playerCredentials: player.credentials,
    stateSnapshot: stateStore.serialize(),
    versionControlState: slvc.serialize()
  }
}

function loadGame(save: SaveData): void {
  stateStore.deserialize(save.stateSnapshot)
  slvc.deserialize(save.versionControlState)
  player.moveTo(save.playerPosition)
  player.credentials = save.playerCredentials
}
```

---

## State Queries

The player queries state through the command interface.

### Simple Query

```
> status galley

ROOM: galley
  Display: Galley
  Deck: 4, Section: 7
  Temperature: 22.4°C (target: 22°C)
  Humidity: 45%
  O2: 18.2% (LOW)
  CO2: 1.8%
  Pressure: 0.96 atm
  Occupants: Riley Chen
```

### Detailed Query

```
> status galley --verbose

ROOM: galley (NodeDefinition v3b8e1d0)
  Display Name: "Galley"
  Location: Deck 4, Section 7
  
  State:
    current_temp: 22.4
    target_temp: 22
    humidity: 45
    o2_level: 18.2 [WARNING: < 19%]
    co2_level: 1.8
    pressure: 0.96
    lighting: 100
    power_status: OK
    occupants: ["riley_chen"]
  
  Last Modified: 2287.203.16:42:15
  Modified By: SYSTEM (atmosphere update)
  
  Adjacent Rooms:
    crew_mess (door: galley_to_mess, state: JAMMED)
    cold_storage (door: galley_to_cold, state: OPEN)
    corridor_4a (door: galley_to_corridor, state: SEALED)
```

### Query Specific Property

```
> status galley.o2_level

galley.o2_level: 18.2%
  Status: WARNING (< 19%)
  Trend: FALLING (-0.3%/min)
  Time to critical: ~7 minutes
```

---

## State Validation

State changes are validated to prevent impossible situations.

```
function validateStateChange(
  nodeId: string, 
  property: string, 
  newValue: any
): ValidationResult {
  const def = definitions.get(nodeId)
  const currentState = stateStore.get(nodeId)
  
  // Type checking
  const expectedType = getPropertyType(def.type, property)
  if (typeof newValue !== expectedType) {
    return { valid: false, error: `Expected ${expectedType}, got ${typeof newValue}` }
  }
  
  // Range checking
  const range = getPropertyRange(def.type, property)
  if (range && (newValue < range.min || newValue > range.max)) {
    return { valid: false, error: `Value out of range [${range.min}, ${range.max}]` }
  }
  
  // Constraint checking
  const constraints = getPropertyConstraints(def.type, property)
  for (const constraint of constraints) {
    if (!constraint.check(newValue, currentState)) {
      return { valid: false, error: constraint.message }
    }
  }
  
  return { valid: true }
}
```

### Example Constraints

```
// Door can't be OPEN and SEALED simultaneously
DoorConstraints = {
  state: {
    check: (newState, currentState) => {
      if (newState === 'OPEN' && currentState.sealed_by) {
        return false  // Can't open while sealed
      }
      return true
    },
    message: "Cannot open sealed door"
  }
}

// O2 level can't exceed 100%
RoomConstraints = {
  o2_level: {
    check: (newLevel) => newLevel >= 0 && newLevel <= 100,
    message: "O2 level must be 0-100%"
  }
}
```

---

## State Debugging

For development and testing:

```
> debug state galley

STATE DEBUG: galley
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Definition Hash: 3b8e1d0
State Version: 47
Subscribers: 3 active

Values:
  current_temp: 22.4 (modified: 16:42:15)
  o2_level: 18.2 (modified: 16:42:15)
  occupants: ["riley_chen"] (modified: 16:40:22)
  ...

Recent Changes (last 10):
  16:42:15 o2_level: 18.5 → 18.2 (by: atmosphere_tick)
  16:42:14 o2_level: 18.8 → 18.5 (by: atmosphere_tick)
  16:42:13 o2_level: 19.1 → 18.8 (by: atmosphere_tick)
  ...

Active Subscribers:
  - UI:OxygenDisplay (galley.o2_level)
  - UI:TemperatureDisplay (galley.current_temp)
  - Relay:atmo_warning (galley.o2_level)
```
