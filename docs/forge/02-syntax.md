# Forge Syntax Reference

Complete reference for Forge DSL syntax.

## Lexical Elements

### Keywords

**Structure Keywords**
```
asset, entity, layout, machine, config, rule, scenario, behavior,
condition, game, interaction, params, geometry, parts, states,
animations, when, on, match, extends, base, def, return, trigger,
effect, initial, type, message, player, ship, controller, collision,
spawn_room, spawn_position, target, range, prompt, on_interact, where,
display-template, width, height, header, footer, rows, label, value
```

**Geometry Keywords**
```
voxel, voxels, box, repeat, child, from, to, step, size, at, as
```

**Animation Keywords**
```
animate, spin, bob, pulse, fade, using, loop, play, setState,
emit, stopAnimation
```

**Layout Keywords**
```
rooms, doors, terminals, switches, assets, wallLights, connects,
facing, monitors, control, coordinate
```

**Control Keywords**
```
if, elif, else, and, or, not, in, for, while, break, continue
```

**Type Keywords**
```
enum, ref, list, float, int, bool, string
```

### Operators

| Operator | Description |
|----------|-------------|
| `+` | Addition |
| `-` | Subtraction / Negation |
| `*` | Multiplication |
| `/` | Division |
| `==` | Equal |
| `!=` | Not equal |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |
| `and` | Logical AND |
| `or` | Logical OR |
| `not` | Logical NOT |
| `in` | Membership test |
| `..` | Range |
| `->` | Arrow (transitions, keyframes) |
| `<->` | Bidirectional (connections) |
| `$` | Reactive reference |
| `@` | Intensity modifier |

## Type Annotations

Use type annotations in `params` blocks:

```forge
params:
  # Basic types
  enabled: bool = true
  count: int = 5
  speed: float = 2.5
  name: string = "Default"

  # Constrained float
  opacity: float[0..1] = 1.0
  health: float[0..100] = 100

  # Enumeration
  state: enum(OPEN, CLOSED, LOCKED) = CLOSED
  direction: enum(north, south, east, west) = north

  # Reference to another entity
  target: ref(room)
  controller: ref(switch)

  # List type
  items: list<string> = []
  values: list<int> = [1, 2, 3]
```

## Expressions

### Literals

```forge
# Numbers
42          # Integer
3.14        # Float
-0.5        # Negative
0xFF        # Hexadecimal

# Strings (double quotes required)
"Hello"
"Line 1\nLine 2"    # Escape sequences: \n \t \" \\

# Booleans
true
false

# Colors
#ff0000     # RGB (6 digits)
#f00        # RGB shorthand (3 digits)
#ff0000ff   # RGBA (8 digits)
#f00f       # RGBA shorthand (4 digits)

# Durations
100ms       # 100 milliseconds
2s          # 2 seconds
0.5m        # 30 seconds
1h          # 1 hour

# Vectors
(10, 20)              # Vec2
(10, 20, 30)          # Vec3
(0.5, 1.0, -0.5)      # Float components allowed

# Lists
[1, 2, 3]
["a", "b", "c"]
[]                    # Empty list

# Ranges
0..10                 # 0 to 10 inclusive
1..100                # 1 to 100 inclusive
```

### Identifiers

```forge
my_variable           # Underscore-separated
myVariable            # camelCase
MY_CONSTANT           # UPPER_SNAKE_CASE
door-sliding          # Hyphenated (for asset names)
wall_fan              # Snake_case
```

### Reactive References

Access reactive state with `$`:

```forge
$player_room          # Simple variable
$player_room_o2       # Compound path (maps to player_room.o2)
$entity.state         # Entity property
$config.value         # Config value
$delta                # Built-in: time since last tick
$tickCount            # Built-in: total tick count
```

### Member Access

```forge
entity.property
config.nested.value
$target.status
```

### Function Calls

```forge
# Built-in functions
clamp(value, 0, 100)
abs(-5)
min(a, b)
max(a, b)
floor(3.7)
ceil(3.2)
round(3.5)
sin(angle)
cos(angle)
sqrt(value)

# Easing functions
easeIn(t)
easeOut(t)
easeInOut(t)
easeInQuad(t)
easeOutQuad(t)
easeInOutQuad(t)
linear(t)
```

### Binary Operations

```forge
# Arithmetic
a + b
a - b
a * b
a / b

# Comparison
a == b
a != b
a < b
a > b
a <= b
a >= b

# Logical
a and b
a or b
not a

# Membership
value in [1, 2, 3]
type in ["SWITCH", "BUTTON"]
```

## Statements

### Set Statement

Set a state value:

```forge
set property: value
set player_room_o2: 19.5
set victory: true
set door.state: "OPEN"
```

### Emit Statement

Emit an event:

```forge
emit "event:name"
emit "door:open"
emit "audio:switch_click"
emit "game:victory"
```

### setState Statement

Change an entity's visual state:

```forge
setState(open)
setState(closed)
setState(locked)
```

### play Statement

Play an animation:

```forge
play(open)
play(close)
play(spin)
```

### stopAnimation Statement

Stop a running animation:

```forge
stopAnimation(spin)
stopAnimation(bob)
```

### animate Statement

Start a procedural animation:

```forge
animate spin on z at $speed
animate bob on y
animate pulse
animate fade
```

### If Statement

Conditional execution:

```forge
if $condition:
  # statements

if $health <= 0:
  emit "game:over"
elif $health < 20:
  emit "warning:low_health"
else:
  # healthy
```

### Match Statement

Pattern matching:

```forge
match $state:
  OPEN -> setState(open), play(open)
  CLOSED -> setState(closed), play(close)
  LOCKED -> setState(locked)
  SEALED -> setState(sealed)
```

### For Statement

Iteration:

```forge
for item in $items:
  emit "process:" + item

for i in 0..10:
  set values[i]: i * 2
```

### While Statement

Loop while condition is true:

```forge
while $count > 0:
  set count: $count - 1
  emit "tick"
```

### Break/Continue

Loop control:

```forge
for item in $items:
  if item == "skip":
    continue
  if item == "stop":
    break
  # process item
```

### Return Statement

Return from function:

```forge
def max(a, b)
  if a > b:
    return a
  return b
```

## Block Types

### When Block

React to condition changes:

```forge
when $powered:
  animate spin on z at $speed

when $state:
  match $state:
    OPEN -> setState(open)
    CLOSED -> setState(closed)
```

### On Block

React to events:

```forge
on door_open:
  play(open)
  emit "audio:door_whoosh"

on tick when $player_room_o2 < 15:
  emit "warning:o2_low"

on room_change when $player_room == "corridor":
  set victory: true
```

### Match Block

Pattern matching for expressions:

```forge
match $type:
  STATUS:
    text "Status Terminal"
  ENGINEERING:
    text "Engineering Terminal"
  COMMAND:
    text "Command Interface"
```

## Function Definitions

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

def distance(x1, y1, x2, y2)
  dx = x2 - x1
  dy = y2 - y1
  return sqrt(dx * dx + dy * dy)
```

## Comments

```forge
# Single line comment

# Multi-line comments are just
# multiple single-line comments
```

## Indentation Rules

1. Use consistent indentation (2 spaces recommended)
2. Child blocks are indented from parent
3. Continuation lines maintain block level
4. Empty lines preserve current indentation context

```forge
asset my-asset                    # Level 0
  params:                         # Level 1
    enabled: bool = true          # Level 2

  geometry:                       # Level 1
    box (0, 0, 0) to (10, 10, 10) as METAL  # Level 2

  when $enabled:                  # Level 1
    emit "enabled"                # Level 2
    if $powered:                  # Level 2
      animate spin                # Level 3
```
