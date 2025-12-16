# Forge Scripting

Forge provides several scripting constructs for game logic: rules, scenarios, behaviors, conditions, and interactions.

## Rules

Rules execute on specific triggers and define game simulation logic.

### Structure

```forge
rule rule-name
  trigger: tick | event-name
  when: condition          # Optional
  effect:
    # statements
```

### Tick-Triggered Rules

Execute every game tick (frame):

```forge
rule o2_depletion
  trigger: tick
  when: $player_room and $player_room_powered
  effect:
    set player_room_o2: clamp($player_room_o2 - 0.05 * $delta, 0, 100)
    if $player_room_o2 <= 12:
      emit "game:over"

rule temperature_regulation
  trigger: tick
  when: $player_room and $player_room_powered
  effect:
    if $player_room_temp < 18:
      set player_room_temp: $player_room_temp + 0.1 * $delta
    elif $player_room_temp > 24:
      set player_room_temp: $player_room_temp - 0.1 * $delta
```

### Event-Triggered Rules

Execute when specific events are emitted:

```forge
rule on_door_open
  trigger: door:open
  effect:
    set collision_dirty: true
    emit "audio:door_whoosh"

rule on_switch_use
  trigger: switch:toggle
  when: $target.status != "FAULT"
  effect:
    # Toggle connected device
    if $target.connected_door:
      emit "door:toggle"
```

## Scenarios

Scenarios define gameplay sequences with initial state and event handlers.

### Structure

```forge
scenario scenario-name
  initial:
    state_var: value
    another_var: value

  on event_name when condition:
    # statements
```

### Example

```forge
scenario galley_escape
  initial:
    player_room: "galley"
    player_position_x: 0
    player_position_y: 0.1
    player_position_z: 0
    galley_o2: 19.5
    galley_powered: true
    corridor_o2: 21.0
    corridor_powered: true
    galley_door_state: "CLOSED"
    victory: false

  on room_change when $player_room == "corridor" and $previous_room == "galley":
    set victory: true
    emit "game:victory"

  on door_open when $door_id == "galley_exit":
    set galley_door_state: "OPEN"
    emit "door:opened"

  on door_close when $door_id == "galley_exit":
    set galley_door_state: "CLOSED"
    emit "door:closed"
```

### Using Scenarios

```typescript
// Start a scenario
vm.startScenario('galley_escape')

// Check current scenario
vm.getCurrentScenario()  // 'galley_escape'

// Get available scenarios
vm.getScenarioNames()    // ['galley_escape', ...]
```

## Behaviors

Behaviors are reusable event handlers that can be attached to entities.

### Structure

```forge
behavior behavior-name
  on event_name:
    # statements

  on another_event when condition:
    # statements
```

### Example

```forge
behavior door_opening
  on door:open:
    setState(open)
    play(open_animation)
    emit "audio:door_whoosh"

  on door:close:
    setState(closed)
    play(close_animation)

  on interact when $state == "CLOSED":
    emit "door:open"

  on interact when $state == "OPEN":
    emit "door:close"
```

### Entity Behavior Execution

```typescript
// Execute behavior for specific entity
vm.executeEntityBehavior('door_opening', 'door:open', 'galley_exit')
```

## Conditions

Conditions define victory, defeat, or checkpoint triggers.

### Structure

```forge
condition condition-name
  type: victory | defeat | checkpoint
  trigger: expression
  message: "Optional message"
  effect:
    # statements
```

### Example

```forge
condition escape_galley
  type: victory
  trigger: $player_room == "corridor" and $previous_room == "galley"
  message: "You've escaped the galley!"
  effect:
    emit "game:victory"
    emit "achievement:escape"

condition oxygen_depleted
  type: defeat
  trigger: $player_room_o2 <= 12
  message: "Life support failed. You couldn't breathe."
  effect:
    emit "game:over"
```

### Condition Events

Conditions emit events when triggered:
- `condition:victory` - Victory condition met
- `condition:defeat` - Defeat condition met
- `condition:checkpoint` - Checkpoint reached
- `game:victory` - Emitted for victory conditions
- `game:over` - Emitted for defeat conditions

## Interactions

Interactions define player-entity interactions.

### Structure

```forge
interaction interaction-name
  target: entity-type | entity where condition
  range: distance
  prompt: "Prompt text with {template}"
  prompt_broken: "Broken prompt"

  on_interact:
    # statements
```

### Examples

```forge
# Switch interaction
interaction switch_use
  target: entity where voxel_type == "SWITCH" or voxel_type == "SWITCH_BUTTON"
  range: 2.0
  prompt: "Press [E] to use {name}"
  prompt_broken: "{name} is broken"

  on_interact:
    if $target.status == "FAULT":
      emit "particles:sparks"
      emit "audio:switch_broken"
    else:
      emit "switch:toggle"
      emit "audio:switch_click"

# Terminal interaction
interaction terminal_use
  target: terminal
  range: 1.5
  prompt: "{name} - Press [E]"
  prompt_broken: "{name} - OFFLINE"

  on_interact:
    if $target.status == "FAULT":
      emit "audio:terminal_denied"
    elif $target.terminal_type == "ENGINEERING":
      emit "editor:open"
    else:
      emit "audio:terminal_beep"

# Door interaction
interaction door_manual
  target: door
  range: 1.5
  prompt: "Press [E] to open {name}"

  on_interact:
    if $target.status == "FAULT":
      emit "audio:door_jammed"
    else:
      emit "door:toggle"
```

### Target Conditions

```forge
# Simple type match
target: switch
target: terminal
target: door

# Complex conditions
target: entity where type == "switch"
target: entity where voxel_type in ["SWITCH", "SWITCH_BUTTON"]
target: entity where interactable == true and distance < 2
```

### Using Interactions

```typescript
// Find matching interactions for entity
const interactions = vm.findMatchingInteractions({
  type: 'switch',
  name: 'Door Switch',
  status: 'OK'
})

// Execute interaction
vm.executeInteraction('switch_use', {
  name: 'Door Switch',
  status: 'OK'
})

// Get prompt text
const prompt = vm.getInteractionPrompt('switch_use', {
  name: 'Door Switch'
})  // "Press [E] to use Door Switch"
```

## Helper Functions

Define reusable functions:

```forge
def clamp(value, min, max)
  if value < min:
    return min
  if value > max:
    return max
  return value

def lerp(a, b, t)
  return a + (b - a) * t

def within_range(pos1, pos2, range)
  dx = pos1.x - pos2.x
  dy = pos1.y - pos2.y
  dz = pos1.z - pos2.z
  return sqrt(dx*dx + dy*dy + dz*dz) <= range
```

## Event Flow

```
┌─────────────────────────────────────────────────────────┐
│                      Game Loop                          │
├─────────────────────────────────────────────────────────┤
│  1. vm.tick(delta)                                      │
│     └─> Execute tick-triggered rules                    │
│     └─> Check scenario handlers                         │
│     └─> Check conditions (victory/defeat)               │
├─────────────────────────────────────────────────────────┤
│  2. Player interaction                                  │
│     └─> Find matching interactions                      │
│     └─> Execute on_interact statements                  │
│     └─> Emit events                                     │
├─────────────────────────────────────────────────────────┤
│  3. Events propagate                                    │
│     └─> Event-triggered rules execute                   │
│     └─> Behavior handlers execute                       │
│     └─> External listeners notified                     │
└─────────────────────────────────────────────────────────┘
```
