# Forge Layouts

Layouts define the physical structure of the game world: rooms, doors, terminals, and placed assets.

## Layout Structure

```forge
layout layout-name
  coordinate: voxel | world

  rooms:
    # Room definitions

  doors:
    # Door placements

  terminals:
    # Terminal placements

  switches:
    # Switch placements

  wallLights:
    # Light placements

  assets:
    # Asset instances
```

## Coordinate Systems

```forge
# Voxel coordinates (integers, 1 unit = 1 voxel)
coordinate: voxel

# World coordinates (floats, 1 unit = 1 meter)
coordinate: world
```

Voxel coordinates are converted to world coordinates using `VOXEL_SIZE` (default 0.025m = 2.5cm per voxel).

## Rooms

Define room boundaries:

```forge
rooms:
  galley at (-16, 0, 0) size (240, 120, 240):
    name: "Galley"

  corridor at (280, 0, 0) size (320, 120, 240):
    name: "Corridor"

  engineering at (616, 0, -24) size (320, 120, 320):
    name: "Engineering"
```

Room properties:
- `at (x, y, z)` - Center position
- `size (width, height, depth)` - Room dimensions
- `name` - Display name

## Doors

Place doors with connections:

```forge
doors:
  galley_exit at (104, 0, 40) facing east:
    connects: galley <-> corridor

  engineering_door at (440, 0, 0) facing east:
    connects: corridor <-> engineering
    control: engineering_switch   # Optional switch reference
```

Door properties:
- `at (x, y, z)` - Position
- `facing: north | south | east | west` - Door orientation
- `connects: room1 <-> room2` - Connected rooms
- `control` - Optional controlling switch

## Terminals

Place interactive terminals:

```forge
terminals:
  galley_status at (-136, 0, 0):
    rotation: 90
    type: STATUS

  galley_engineering at (60, 0, -80):
    rotation: 0
    type: ENGINEERING

  corridor_status at (280, 0, 60):
    rotation: 180
    type: STATUS
```

Terminal properties:
- `at (x, y, z)` - Position
- `rotation` - Rotation in degrees (0, 90, 180, 270)
- `type: STATUS | ENGINEERING | COMMAND` - Terminal type

## Switches

Place interactive switches:

```forge
switches:
  door_switch at (104, 0, -40):
    rotation: 270
    status: FAULT     # Physical damage

  light_switch at (40, 0, -120):
    rotation: 0
    status: OK

  engineering_switch at (440, 0, 40):
    rotation: 270
    status: OK
```

Switch properties:
- `at (x, y, z)` - Position
- `rotation` - Rotation in degrees
- `status: OK | FAULT | DAMAGED | STANDBY` - Hardware status

## Wall Lights

Place lighting fixtures:

```forge
wallLights:
  wall-light-1 at (-64, 60, 120):
    rotation: 180
    color: #ffffee
    intensity: 1

  wall-light-2 at (600, 60, -156):
    rotation: 90
    color: #ffffee
    intensity: 1
```

Wall light properties:
- `at (x, y, z)` - Position
- `rotation` - Rotation in degrees
- `color` - Light color (hex)
- `intensity` - Light intensity (0-2)

## Asset Instances

Place custom assets:

```forge
assets:
  engineering_workstation at (60, 0, -80):
    asset: workstation
    rotation: 180

  galley_vent_fan at (-80, 50, 120):
    asset: wall-fan
    rotation: 180
    powered: true     # Asset parameter
    speed: 4.0        # Asset parameter
```

Asset properties:
- `at (x, y, z)` - Position
- `asset: asset-name` - Reference to asset definition
- `rotation` - Rotation in degrees
- Additional properties are passed as asset parameters

## Complete Example

```forge
# Galley Deck Layout
layout galley-deck
  coordinate: voxel

  rooms:
    galley at (-16, 0, 0) size (240, 120, 240):
      name: "Galley"

    corridor at (280, 0, 0) size (320, 120, 240):
      name: "Corridor"

    engineering at (616, 0, -24) size (320, 120, 320):
      name: "Engineering"

  doors:
    galley_exit at (104, 0, 40) facing east:
      connects: galley <-> corridor

    engineering_door at (440, 0, 0) facing east:
      connects: corridor <-> engineering

  terminals:
    galley_status at (-136, 0, 0):
      rotation: 90

    galley_engineering at (60, 0, -80):
      rotation: 0

    corridor_status at (280, 0, 60):
      rotation: 180

  switches:
    door_switch at (104, 0, -40):
      rotation: 270
      status: FAULT

    light_switch at (40, 0, -120):
      rotation: 0
      status: OK

    engineering_switch at (440, 0, 40):
      rotation: 270
      status: OK

  wallLights:
    wall-light-1 at (-64, 60, 120):
      rotation: 180
      color: #ffffee
      intensity: 1

  assets:
    engineering_workstation at (60, 0, -80):
      asset: workstation
      rotation: 180

    galley_vent_fan at (-80, 50, 120):
      asset: wall-fan
      rotation: 180
```

## Layout Compilation

Layouts are compiled to JSON at build time or runtime:

```typescript
import { compileLayout } from '../forge'

const layoutSource = await fetch('/game/forge/layouts/galley.layout.forge')
const layout = compileLayout(await layoutSource.text(), 'galley.layout.forge')

// Result is a ShipLayout object:
interface ShipLayout {
  rooms: Map<string, RoomDef>
  doors: DoorDef[]
  terminals: TerminalDef[]
  switches: SwitchDef[]
  wallLights: WallLightDef[]
  assets: AssetInstanceDef[]
}
```

## Hardware Status

Layout files define physical hardware status:

| Status | Description |
|--------|-------------|
| `OK` | Working normally |
| `FAULT` | Physically damaged (sparks, won't work) |
| `DAMAGED` | Partially working |
| `STANDBY` | Powered down but functional |
| `OFFLINE` | Completely non-functional |

Hardware status is read-only during gameplay - players work around damaged hardware using software (StarLang) modifications.
