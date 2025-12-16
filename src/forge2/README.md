# Forge 2.0 Language Reference

A minimal, extensible scripting language for game development.

**File Extension:** `.f2`

## Core Philosophy

- **~12 keywords** - everything else is data
- **Events are the only magic** - `on` and `emit`
- **Optional schemas** - validation when you want it
- **First-class functions** - closures and higher-order functions
- **Convention over configuration** - no hardcoded "entity" or "rule" types

## Quick Start

```forge
# Define game state as plain data
let player = {
  position: (0, 0, 0),
  health: 100,
  speed: 5
}

# React to events
on "tick":
  let dt = event.dt
  if input.isKeyDown("W"):
    set player.position.z: player.position.z - player.speed * dt

# Emit your own events
emit "player:moved" { from: old_pos, to: player.position }
```

## Data Types

### Primitives

```forge
42              # number (integer)
3.14            # number (float)
"hello"         # string (double quotes)
'world'         # string (single quotes)
true            # boolean
false           # boolean
null            # null
#ff0000         # color (hex)
```

### Composite Types

```forge
# List
[1, 2, 3]
["a", "b", "c"]

# Vector (sugar for list, used for 3D coordinates)
(0, 0, 0)
(x, y, z)

# Map (object)
{ name: "Alice", age: 30 }
{
  nested: {
    value: 42
  }
}

# Function
fn(x) -> x * 2
fn(a, b) -> a + b
```

## Keywords

| Keyword | Purpose |
|---------|---------|
| `let` | Declare variable |
| `set` | Mutate value |
| `fn` | Define function |
| `if` / `elif` / `else` | Conditionals |
| `for` / `while` | Loops |
| `match` | Pattern matching |
| `return` | Return value |
| `on` | Event handler |
| `emit` | Send event |
| `schema` | Define structure |

## Variables

### Declaration

```forge
let x = 42
let name = "Alice"
let position = (0, 0, 0)
let config = {
  speed: 5,
  health: 100
}
```

### Mutation

```forge
set x: 100
set player.health: player.health - 10
set inventory[0]: "sword"
```

## Functions

### Named Functions

```forge
fn greet(name):
  return "Hello, " + name

fn add(a, b):
  return a + b

fn clamp(value, min, max):
  if value < min:
    return min
  if value > max:
    return max
  return value
```

### Arrow Functions (Lambdas)

```forge
# Expression body
let double = fn(x) -> x * 2
let add = fn(a, b) -> a + b

# Use in higher-order functions
let doubled = list.map([1, 2, 3], fn(x) -> x * 2)  # [2, 4, 6]
```

### Default Parameters

```forge
fn greet(name, greeting = "Hello"):
  return greeting + ", " + name

greet("Alice")           # "Hello, Alice"
greet("Bob", "Hi")       # "Hi, Bob"
```

## Control Flow

### Conditionals

```forge
if health <= 0:
  emit "player:died"
elif health < 20:
  emit "warning:low_health"
else:
  emit "status:ok"
```

### Ternary Expression

```forge
let status = if health > 0 then "alive" else "dead"
```

### Loops

```forge
# For loop
for item in inventory:
  print(item)

for i in list.range(10):
  print(i)

# While loop
while bullets > 0:
  shoot()
  set bullets: bullets - 1
```

### Pattern Matching

```forge
match event.type:
  "keydown":
    handle_key(event.key)
  "click":
    handle_click(event.x, event.y)
  _:
    print("Unknown event")
```

## Events

### Handling Events

```forge
# Basic handler
on "tick":
  update_physics(event.dt)

# Handler with condition
on "tick" when game.active:
  move_player(event.dt)

# Specific event names
on "keydown:W":
  set player.velocity.z: -5

on "keydown:Escape":
  set game.paused: not game.paused
```

### Emitting Events

```forge
# Simple event
emit "game:started"

# Event with data
emit "player:damaged" { amount: 10, source: "enemy" }

# UI events
emit "ui:score_update" { score: score }
```

### Built-in Events

| Event | Data | Description |
|-------|------|-------------|
| `tick` | `{ dt }` | Every frame, dt = delta time |
| `init` | `{}` | Game initialization |
| `keydown` | `{ key, code, shift, ctrl, alt }` | Key pressed |
| `keyup` | `{ key, code }` | Key released |
| `keydown:X` | `{ key, code }` | Specific key pressed |
| `mousedown` | `{ button, x, y }` | Mouse button pressed |
| `mouseup` | `{ button, x, y }` | Mouse button released |
| `mousemove` | `{ x, y, movementX, movementY }` | Mouse moved |
| `wheel` | `{ deltaX, deltaY, deltaZ }` | Mouse wheel |

## Schemas (Optional Validation)

### Defining Schemas

```forge
schema creature:
  required:
    name: string
    health: number
    position: vec3

  optional:
    faction: string
    inventory: list

  # Methods
  take_damage: fn(amount):
    set self.health: self.health - amount
    if self.health <= 0:
      emit "creature:died" { name: self.name }

  heal: fn(amount):
    set self.health: math.min(self.health + amount, 100)
```

### Creating Instances

```forge
creature goblin:
  name: "Goblin Scout"
  health: 30
  position: (10, 0, 5)
  faction: "monsters"

creature player:
  name: "Hero"
  health: 100
  position: (0, 0, 0)
  inventory: []

# Use methods
goblin.take_damage(10)
player.heal(20)
```

### Schema Inheritance

```forge
schema entity:
  required:
    id: string
    position: vec3

schema creature extends entity:
  required:
    health: number

schema player extends creature:
  optional:
    inventory: list
    experience: number = 0
```

## Standard Library

### `math` - Math Functions

```forge
math.sin(x)           # Trigonometry
math.cos(x)
math.atan2(y, x)

math.floor(x)         # Rounding
math.ceil(x)
math.round(x)

math.abs(x)           # Utilities
math.min(a, b)
math.max(a, b)
math.sqrt(x)
math.pow(x, n)

math.clamp(v, min, max)   # Clamp value to range
math.lerp(a, b, t)        # Linear interpolation
math.smoothstep(e0, e1, x)

math.radians(deg)     # Angle conversion
math.degrees(rad)

math.PI               # Constants
math.TAU
math.E
```

### `vec` - Vector Math

```forge
vec.add(a, b)         # Component-wise addition
vec.sub(a, b)         # Subtraction
vec.mul(v, scalar)    # Scalar multiplication
vec.div(v, scalar)

vec.dot(a, b)         # Dot product
vec.cross(a, b)       # Cross product (3D)
vec.length(v)         # Magnitude
vec.normalize(v)      # Unit vector
vec.distance(a, b)    # Distance between points

vec.lerp(a, b, t)     # Interpolate vectors
vec.angle(a, b)       # Angle between vectors
```

### `list` - List Operations

```forge
list.range(10)            # [0, 1, 2, ..., 9]
list.range(1, 5)          # [1, 2, 3, 4]

list.map(lst, fn)         # Transform elements
list.filter(lst, fn)      # Filter elements
list.reduce(lst, fn, init)
list.find(lst, fn)        # Find first match

list.first(lst)           # First element
list.last(lst)            # Last element
list.length(lst)          # Count
list.sum(lst)             # Sum numbers
list.shuffle(lst)         # Random order

list.concat(a, b)         # Join lists
list.slice(lst, start, end)
list.reverse(lst)
list.sort(lst)
```

### `string` - String Operations

```forge
string.length(s)
string.toUpperCase(s)
string.toLowerCase(s)
string.trim(s)
string.split(s, sep)
string.join(lst, sep)
string.includes(s, sub)
string.replace(s, from, to)
string.format("{} + {} = {}", 1, 2, 3)  # "1 + 2 = 3"
```

### `random` - Random Numbers

```forge
random.random()           # 0.0 to 1.0
random.int(min, max)      # Integer in range
random.float(min, max)    # Float in range
random.bool(0.5)          # Boolean with probability
random.choice(list)       # Random element
random.shuffle(list)      # Shuffled copy
random.gaussian(mean, stddev)
```

## Engine Bridge

### `render` - 3D Rendering

```forge
# Create objects
let box = render.box(1, 1, 1, "#ff0000")
let sphere = render.sphere(0.5, "#00ff00")

# Add to scene
render.spawn(box)

# Transform
render.setPosition(box, x, y, z)
render.setRotation(box, rx, ry, rz)
render.setScale(box, sx, sy, sz)
render.move(box, dx, dy, dz)

# Appearance
render.setColor(box, "#0000ff")
render.setEmissive(box, "#ffffff", 0.5)
render.setOpacity(box, 0.5)
render.setVisible(box, false)

# Debug drawing
render.drawLine(x1, y1, z1, x2, y2, z2, "#ff0000")
render.drawBox(x, y, z, w, h, d, "#00ff00")
render.clearDebug()
```

### `voxel` - Voxel World

```forge
# Get/set voxels
let v = voxel.get(x, y, z)
voxel.set(x, y, z, voxelType)
voxel.fill(x1, y1, z1, x2, y2, z2, voxelType)

# Voxel type utilities
let type = voxel.type(v)
let variant = voxel.variant(v)
let v = voxel.make("WALL", 0)

# Coordinate conversion
let [vx, vy, vz] = voxel.worldToVoxel(wx, wy, wz)
let [wx, wy, wz] = voxel.voxelToWorld(vx, vy, vz)

# Queries
voxel.isSolid(x, y, z)
voxel.isTransparent(x, y, z)
voxel.isEmpty(x, y, z)

# Batch operations
voxel.box(x1, y1, z1, x2, y2, z2, type, hollow)
voxel.sphere(cx, cy, cz, radius, type)
voxel.replace(x1, y1, z1, x2, y2, z2, fromType, toType)
```

### `asset` - Animated Assets

```forge
# Create asset
let door = asset.create("door", x, y, z, rotation, { state: "closed" })

# Parameters
asset.setParam(door, "state", "open")
let state = asset.getParam(door, "state")

# Animation
asset.playAnimation(door, "open_anim")
asset.stopAnimation(door, "open_anim")
asset.setState(door, "open")

# Transform
asset.setPosition(door, x, y, z)
asset.setRotation(door, rx, ry, rz)
asset.setVisible(door, false)
```

### `input` - Input State

```forge
# Keyboard
input.isKeyDown("W")
input.isKeyPressed("Space")  # Just pressed this frame
input.isKeyReleased("E")     # Just released this frame

# Mouse
let [mx, my] = input.getMousePosition()
input.isMouseDown(0)         # Left button
input.isMouseClicked(0)      # Just clicked this frame

# Convenience
input.isUp()      # W or ArrowUp
input.isDown()    # S or ArrowDown
input.isLeft()    # A or ArrowLeft
input.isRight()   # D or ArrowRight
input.isSpace()
input.isEscape()
```

### `time` - Time Utilities

```forge
time.now()        # Seconds since start
time.fps()        # Current FPS
time.frame()      # Frame counter
```

## Comments

```forge
# Single line comment

# Multi-line comments use multiple # symbols
# Like this
# And this
```

## Example: Complete Game

```forge
# Pong in Forge 2.0

let config = {
  arena_width: 20,
  arena_depth: 12,
  paddle_speed: 8,
  win_score: 5
}

let ball = { x: 0, z: 0, vx: 5, vz: 3 }
let paddle_left = { z: 0 }
let paddle_right = { z: 0 }
let score = { left: 0, right: 0 }
let game = { active: true }

fn clamp_paddle(z):
  let limit = config.arena_depth / 2 - 1.5
  return math.clamp(z, -limit, limit)

# Ball physics
on "tick" when game.active:
  let dt = event.dt
  set ball.x: ball.x + ball.vx * dt
  set ball.z: ball.z + ball.vz * dt

# Wall bounce
on "tick" when abs(ball.z) > config.arena_depth / 2 - 0.3:
  set ball.vz: -ball.vz
  emit "sound:bounce"

# Paddle collision
on "tick" when ball.x < -8.5 and ball.vx < 0:
  if abs(ball.z - paddle_left.z) < 1.5:
    set ball.vx: abs(ball.vx) * 1.05
    emit "sound:hit"

# Player input
on "tick" when game.active and input.isUp():
  set paddle_left.z: clamp_paddle(paddle_left.z - config.paddle_speed * event.dt)

on "tick" when game.active and input.isDown():
  set paddle_left.z: clamp_paddle(paddle_left.z + config.paddle_speed * event.dt)

# Scoring
on "tick" when ball.x < -config.arena_width / 2:
  set score.right: score.right + 1
  emit "score:changed"

# Victory
on "tick" when score.left >= config.win_score:
  set game.active: false
  emit "game:victory" { winner: "player" }
```

## Game Structure

A Forge 2.0 game is a single `.f2` file (or multiple files loaded together):

```
game/
└── pong2/
    └── pong.f2       # Complete game logic
```

**File naming convention:** `<game-name>.f2`

The engine detects Forge 2.0 games by looking for a `.f2` file in the game directory.

## Hot Reload

Forge 2.0 supports hot-reloading for live game development:

```typescript
// When player edits a file
vm.reload(newSource, 'galley.f2')
```

**Behavior:**
- Event handlers from the file are replaced
- Instance **definitions** are updated from file
- Instance **runtime state** (mutated via `set`) is preserved
- `file:reloaded` event is emitted

This enables players to edit game scripts and see changes immediately without losing game state.

## TypeScript Integration

```typescript
import { ForgeVM, EngineBridge, RenderBridge } from './forge2'

// Create VM and load game
const vm = new ForgeVM()
vm.load(source, 'pong.f2')

// Attach engine bridge for render/input/time
const engineBridge = new EngineBridge({ renderBridge: new RenderBridge(scene) })
engineBridge.attachTo(vm)

// Game loop
vm.emit('init')
function gameLoop(dt: number) {
  engineBridge.update(dt)
  vm.tick(dt)
  requestAnimationFrame(gameLoop)
}
```
