# Forge Configuration

Config blocks define game settings that can be accessed by the engine at runtime.

## Config Structure

```forge
config config-name
  property: value

  nested:
    sub_property: value
    another: value
```

## Basic Example

```forge
config player
  movement:
    walk_speed: 5          # m/s
    look_sensitivity: 0.002

  collision:
    height: 1.7            # meters
    radius: 0.3

  camera:
    fov: 75                # degrees
    near: 0.1
    far: 1000
```

## Value Types

```forge
config example
  # Numbers
  integer: 42
  float_value: 3.14
  negative: -0.5

  # Strings
  name: "Player One"
  message: "Welcome to the ship"

  # Booleans
  enabled: true
  debug: false

  # Colors
  primary: #ff6b6b
  secondary: #4a6fa5

  # Lists
  keys: ["KeyW", "KeyS", "KeyA", "KeyD"]
  values: [1, 2, 3, 4, 5]

  # Nested objects
  display:
    width: 1920
    height: 1080
    fullscreen: true
```

## Accessing Config in TypeScript

The `ConfigRegistry` provides type-safe access to config values:

```typescript
import { Config } from '../forge/ConfigRegistry'

// Access nested properties
const walkSpeed = Config.player.movement.walkSpeed
const fov = Config.player.camera.fov
const warningColor = Config.ui.warning.colorNormal
```

## Standard Configs

### player.config.forge

Player movement, collision, and camera settings:

```forge
config player
  movement:
    walk_speed: 5
    look_sensitivity: 0.002

  collision:
    height: 1.7
    radius: 0.3
    check_heights: [0.1, 0.5, 1.0, 1.6]

  camera:
    fov: 75
    near: 0.1
    far: 1000
    max_pitch: 1.4708

  keys:
    forward: ["KeyW", "ArrowUp"]
    backward: ["KeyS", "ArrowDown"]
    left: ["KeyA", "ArrowLeft"]
    right: ["KeyD", "ArrowRight"]
    interact: ["KeyE"]

  interaction:
    range: 2.5
    switch_height_offset: 48
```

### atmosphere.config.forge

Atmosphere simulation parameters:

```forge
config atmosphere
  o2:
    depletion_rate: 0.05       # % per second
    warning_threshold: 19
    critical_threshold: 15
    lethal_threshold: 12

  temperature:
    target: 22                  # Celsius
    regulation_rate: 0.1
    min_comfortable: 18
    max_comfortable: 24

  pressure:
    normal: 101.3               # kPa
    warning_low: 95
    warning_high: 110
```

### ui.config.forge

UI styling and messages:

```forge
config ui
  warning:
    colorNormal: "rgba(255, 180, 70, 0.9)"
    colorCritical: "rgba(255, 50, 50, 0.9)"
    displayDuration: 3000       # ms

  gameover:
    title: "LIFE SUPPORT FAILURE"
    subtitle: "Oxygen depleted"
    buttonText: "Restart"
    background: "rgba(0, 0, 0, 0.95)"
    titleColor: "#ff6b6b"
    buttonColor: "#ff6b6b"

  victory:
    title: "OBJECTIVE COMPLETE"
    subtitle: "You've escaped the galley!"
    buttonText: "Continue"
    background: "rgba(26, 39, 68, 0.98)"
    titleColor: "#77dd77"
    buttonColor: "#77dd77"
```

### voxel-colors.config.forge

Voxel type color definitions:

```forge
config voxelColors
  HULL: #2a2a35
  METAL: #4a4a55
  FLOOR: #3a3a45
  WALL: #353540
  CEILING: #454555
  DOOR_FRAME: #4a4a55
  DOOR_PANEL: #5a5a65
  SCREEN: #1a2744
  LED_GREEN: #77dd77
  LED_RED: #ff6b6b
  LED_YELLOW: #ffb347
  BUTTON: #5a5a65
  BUTTON_RED: #ff6b6b
  SWITCH: #4a4a55
  DUCT: #3a3a45
  GLASS: #aaccff
  VENT: #2a2a35
  LIGHT: #ffffee
  WARN_LIGHT: #ffb347
```

### game-rules.config.forge

Core game rules:

```forge
config gameRules
  initialO2Level: 19.5         # Starting O2%
  escapeRoom: "corridor"       # Victory condition

  atmosphere:
    tickRate: 60               # Updates per second
    depletionEnabled: true

  victory:
    checkInterval: 100         # ms between checks
```

## Using Config in Forge Scripts

Reference config values in expressions:

```forge
rule o2_depletion
  trigger: tick
  when: $player_room_powered
  effect:
    set player_room_o2: clamp(
      $player_room_o2 - config.atmosphere.o2.depletion_rate * $delta,
      0, 100
    )
```

## Dynamic Config Loading

Configs are loaded at startup from the `game/forge/configs/` directory:

```
game/forge/configs/
├── atmosphere.config.forge
├── audio.config.forge
├── game-rules.config.forge
├── lighting.config.forge
├── particles.config.forge
├── player.config.forge
├── ui.config.forge
├── voxel-colors.config.forge
└── world.config.forge
```

All `.config.forge` files are automatically parsed and merged into the global `Config` object.
