# Game Definitions

The `game` block is the entry point that defines what to load and how to start a game session.

## Game Structure

```forge
game game-name
  ship: "ship-name"
  layout: "path/to/layout.forge"
  scenario: "scenario-name"

  player:
    controller: first_person
    spawn_room: "room-id"
    spawn_position: (x, y, z)
    collision: cylinder { height: 1.6, radius: 0.35 }

  on start:
    # Statements executed on game start

  on victory:
    # Statements executed on victory

  on gameover:
    # Statements executed on game over
```

## Properties

### Core Properties

```forge
game galley_escape
  # Ship to load (folder name under game/ships/)
  ship: "galley"

  # Layout file path (relative to game/)
  layout: "forge/layouts/galley.layout.forge"

  # Starting scenario
  scenario: "galley_escape"
```

### Player Configuration

```forge
player:
  # Controller type
  controller: first_person    # FPS with mouse look
  # controller: third_person  # Over-shoulder camera
  # controller: fixed_camera  # Static camera positions

  # Starting position
  spawn_room: "galley"
  spawn_position: (0, 0.1, 0)  # Slightly above floor

  # Collision shape
  collision: cylinder { height: 1.6, radius: 0.35 }
  # collision: box { width: 0.6, height: 1.6, depth: 0.6 }
  # collision: none
```

### Lifecycle Hooks

```forge
on start:
  emit "scenario:start"
  emit "audio:ambient_ship"

on victory:
  emit "ui:show_overlay"
  emit "audio:victory_fanfare"

on gameover:
  emit "ui:show_gameover"
  emit "audio:flatline"
```

## Complete Example

```forge
# Game Definition - Galley Escape
# Entry point that defines what ship/scenario to load

game galley_escape
  # What to load
  ship: "galley"
  layout: "forge/layouts/galley.layout.forge"
  scenario: "galley_escape"

  # Player setup
  player:
    controller: first_person
    spawn_room: "galley"
    spawn_position: (0, 0.1, 0)
    collision: cylinder { height: 1.6, radius: 0.35 }

  # Lifecycle hooks
  on start:
    emit "scenario:start"

  on victory:
    emit "ui:show_overlay"

  on gameover:
    emit "ui:show_gameover"
```

## Using Game Definitions

```typescript
// Load game file
await gameRunner.loadGameFile('/game/forge/galley.game.forge')

// Get game configuration
const gameConfig = gameRunner.startGame('galley_escape')

// gameConfig contains:
// {
//   name: 'galley_escape',
//   ship: 'galley',
//   layout: 'forge/layouts/galley.layout.forge',
//   scenario: 'galley_escape',
//   player: {
//     controller: 'first_person',
//     spawnRoom: 'galley',
//     spawnPosition: { x: 0, y: 0.1, z: 0 },
//     collision: { type: 'cylinder', height: 1.6, radius: 0.35 }
//   }
// }
```

## Multiple Games

A project can define multiple games:

```forge
# game/forge/games/tutorial.game.forge
game tutorial
  ship: "training_vessel"
  layout: "forge/layouts/tutorial.layout.forge"
  scenario: "basic_training"
  ...

# game/forge/games/main.game.forge
game main_campaign
  ship: "galley"
  layout: "forge/layouts/full_ship.layout.forge"
  scenario: "act_1"
  ...
```

## Game Loading Flow

```
1. Load game.forge file
2. Parse game definition
3. Load ship definition (.sl file)
4. Load layout file (compile if .forge)
5. Start scenario (apply initial state)
6. Execute on_start handlers
7. Begin game loop
```
