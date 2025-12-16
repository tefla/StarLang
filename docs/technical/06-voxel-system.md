# Voxel System

StarLang uses a voxel-based rendering system for all 3D geometry. This provides a consistent retro-futuristic aesthetic and enables data-driven asset creation.

## Overview

```mermaid
flowchart TB
    subgraph INPUT["Input"]
        FORGE[".asset.forge files"]
        LAYOUT[".layout.forge files"]
    end

    subgraph LOADING["Asset Loading"]
        DEF[VoxelAssetDef]
        LOADER[AssetLoader]
        ANIM_LOADER[AnimatedAssetLoader]
    end

    subgraph WORLD["Voxel World"]
        GRID["Voxel Grid<br/>(Uint16Array)"]
        ROOM[Room Geometry]
        ASSETS[Placed Assets]
    end

    subgraph RENDERING["Rendering"]
        MESHER[Greedy Mesher]
        MESH["THREE.js Mesh"]
        PARTS["Dynamic Parts<br/>(Animated Objects)"]
    end

    FORGE --> DEF --> LOADER
    DEF --> ANIM_LOADER
    LAYOUT --> ROOM
    LOADER --> ASSETS
    ASSETS --> GRID
    ROOM --> GRID
    GRID --> MESHER --> MESH
    ANIM_LOADER --> PARTS

    style INPUT fill:#4ade80,stroke:#166534
    style LOADING fill:#818cf8,stroke:#4338ca
    style WORLD fill:#fbbf24,stroke:#b45309
    style RENDERING fill:#f87171,stroke:#dc2626
```

## Voxel Pipeline

```mermaid
sequenceDiagram
    participant F as Forge File
    participant L as Loader
    participant W as VoxelWorld
    participant G as GreedyMesher
    participant R as Renderer

    F->>L: Parse asset definition
    L->>L: Resolve geometry
    L->>W: Set voxels in grid
    W->>G: Request mesh build
    G->>G: Merge adjacent faces
    G->>R: Optimized geometry
    R->>R: Display mesh
```

## Voxel Types

Voxels are defined by type, which determines their appearance:

```mermaid
graph LR
    subgraph STRUCTURAL["Structural"]
        HULL[HULL]
        METAL[METAL]
        FLOOR[FLOOR]
        WALL[WALL]
        CEILING[CEILING]
    end

    subgraph FUNCTIONAL["Functional"]
        DOOR_FRAME[DOOR_FRAME]
        DOOR_PANEL[DOOR_PANEL]
        SCREEN[SCREEN]
        BUTTON[BUTTON]
        SWITCH[SWITCH]
    end

    subgraph VISUAL["Visual"]
        LED_GREEN[LED_GREEN]
        LED_RED[LED_RED]
        LED_YELLOW[LED_YELLOW]
        LIGHT[LIGHT]
        GLASS[GLASS]
    end

    style STRUCTURAL fill:#4a4a55,stroke:#2a2a35
    style FUNCTIONAL fill:#3d5a80,stroke:#293241
    style VISUAL fill:#4ade80,stroke:#166534
```

```forge
# From voxel-types.config.forge
config voxelTypes
  AIR: 0          # Empty space
  HULL: 1         # Ship hull
  METAL: 2        # General metal
  FLOOR: 3        # Floor tiles
  WALL: 4         # Wall material
  CEILING: 5      # Ceiling tiles
  DOOR_FRAME: 6   # Door frame
  DOOR_PANEL: 7   # Movable door
  SCREEN: 8       # Terminal screen
  LED_GREEN: 9    # Green LED
  LED_RED: 10     # Red LED
  LED_YELLOW: 11  # Yellow LED
  BUTTON: 12      # Button surface
  SWITCH: 13      # Switch surface
  DUCT: 14        # Ventilation
  GLASS: 15       # Transparent
  VENT: 16        # Vent grating
  LIGHT: 17       # Light fixture
```

## Voxel Colors

Each type maps to a color:

```forge
# From voxel-colors.config.forge
config voxelColors
  HULL: #2a2a35
  METAL: #4a4a55
  FLOOR: #3a3a45
  WALL: #353540
  SCREEN: #1a2744
  LED_GREEN: #77dd77
  LED_RED: #ff6b6b
  GLASS: #aaccff
```

## Coordinate System

```mermaid
graph TB
    subgraph COORDS["Coordinate Systems"]
        VOXEL["Voxel Coordinates<br/>Integer grid (0, 40, 80)"]
        WORLD["World Coordinates<br/>Meters (0.0, 1.0, 2.0)"]
    end

    VOXEL -->|"× VOXEL_SIZE (0.025m)"| WORLD
    WORLD -->|"÷ VOXEL_SIZE + floor()"| VOXEL

    subgraph SCALE["Scale Reference"]
        V1["1 voxel = 2.5cm"]
        V2["40 voxels = 1m"]
        V3["Door height ≈ 86 voxels = 2.15m"]
    end
```

- **Voxel coordinates**: Integer grid positions
- **World coordinates**: Floating-point meters
- **VOXEL_SIZE**: 0.025m (2.5cm per voxel)

```typescript
// Conversion functions
function voxelToWorld(vx: number, vy: number, vz: number): THREE.Vector3 {
  return new THREE.Vector3(
    vx * VOXEL_SIZE,
    vy * VOXEL_SIZE,
    vz * VOXEL_SIZE
  )
}

function worldToVoxel(x: number, y: number, z: number): { x: number, y: number, z: number } {
  return {
    x: Math.floor(x / VOXEL_SIZE),
    y: Math.floor(y / VOXEL_SIZE),
    z: Math.floor(z / VOXEL_SIZE)
  }
}
```

## VoxelAssetLoader

Loads and resolves assets from Forge definitions:

```typescript
import { assetLoader, loadBuiltinAssetsAsync } from './VoxelAssetLoader'

// Load all assets at startup
await loadBuiltinAssetsAsync()

// Get asset definition
const door = assetLoader.getAsset('door-sliding')

// Resolve to voxels at position
const voxels = assetLoader.resolve(
  'door-sliding',           // Asset ID
  { x: 100, y: 0, z: 50 },  // Position
  90,                       // Rotation (0, 90, 180, 270)
  { state: 'OPEN' },        // Parameters
  0                         // Height offset
)
```

## AnimatedAssetLoader

Handles assets with dynamic parts:

```mermaid
flowchart TB
    subgraph DEFINITION["Asset Definition"]
        STATIC["Static Geometry<br/>(merged into world)"]
        DYNAMIC["Dynamic Parts<br/>(panel, blades, etc.)"]
        STATES["States<br/>(open, closed, spinning)"]
        ANIMS["Animations<br/>(open, close, spin)"]
    end

    subgraph RUNTIME["Runtime Instance"]
        WORLD_MESH["World Mesh<br/>(static voxels)"]
        THREE_OBJ["THREE.js Objects<br/>(dynamic parts)"]
        CONTROLS["Animation Controls<br/>(play, setState)"]
    end

    STATIC --> WORLD_MESH
    DYNAMIC --> THREE_OBJ
    STATES --> CONTROLS
    ANIMS --> CONTROLS
```

```typescript
import { animatedAssetLoader, loadAnimatedAssetsAsync } from './AnimatedAssetLoader'

// Load animated assets
await loadAnimatedAssetsAsync()

// Create runtime instance
const instance = animatedAssetLoader.createInstance(
  'wall-fan',
  { x: 80, y: 50, z: 120 },
  180,  // rotation
  { powered: true, speed: 4.0 }
)

// Instance provides:
// - Static voxels (for world mesh)
// - Dynamic parts (THREE.js objects)
// - Animation controls
```

## VoxelWorld

Manages the voxel grid and mesh generation:

```typescript
class VoxelWorld {
  // Dimensions
  private width: number
  private height: number
  private depth: number
  private voxels: Uint16Array

  // Set a voxel
  setVoxel(x: number, y: number, z: number, type: number): void

  // Get a voxel
  getVoxel(x: number, y: number, z: number): number

  // Build mesh from voxels
  buildMesh(): THREE.Mesh

  // Check collision at world position
  isColliding(worldPos: THREE.Vector3, radius: number): boolean
}
```

## GreedyMesher

Optimizes voxel rendering by merging adjacent faces:

```mermaid
flowchart LR
    subgraph BEFORE["Before Greedy Meshing"]
        B1["100 individual voxels<br/>600 quads<br/>1200 triangles"]
    end

    subgraph AFTER["After Greedy Meshing"]
        A1["Merged regions<br/>~50 quads<br/>~100 triangles"]
    end

    BEFORE -->|"80-95% reduction"| AFTER
```

```typescript
class GreedyMesher {
  // Generate optimized mesh from voxel data
  mesh(
    voxels: Uint16Array,
    width: number,
    height: number,
    depth: number
  ): {
    positions: Float32Array
    normals: Float32Array
    colors: Float32Array
    indices: Uint32Array
  }
}
```

The greedy mesher algorithm:

```mermaid
flowchart TB
    START([Start]) --> AXIS[For each axis X, Y, Z]
    AXIS --> SLICE[Get 2D slice]
    SLICE --> SCAN[Scan for regions]
    SCAN --> SAME{Same type<br/>& not visited?}
    SAME -->|Yes| EXTEND[Extend region]
    EXTEND --> SAME
    SAME -->|No| EMIT[Emit merged quad]
    EMIT --> NEXT{More slices?}
    NEXT -->|Yes| SLICE
    NEXT -->|No| DONE([Return mesh])
```

## Room Building

Rooms are built from layout definitions:

```mermaid
sequenceDiagram
    participant L as Layout
    participant W as VoxelWorld
    participant A as AssetLoader
    participant M as Mesher

    L->>W: Create empty world
    loop Each Room
        L->>W: Build floor geometry
        L->>W: Build wall geometry
        L->>W: Build ceiling geometry
    end
    loop Each Asset
        L->>A: Resolve asset voxels
        A->>W: Set voxels in world
    end
    W->>M: Build mesh
    M->>M: Greedy merge
    M-->>W: Optimized mesh
```

```typescript
// Build voxel world from layout
const world = new VoxelWorld(width, height, depth)

// Add room geometry (floor, walls, ceiling)
for (const room of layout.rooms) {
  buildRoomGeometry(world, room)
}

// Add placed assets
for (const asset of layout.assets) {
  const voxels = assetLoader.resolve(asset.asset, asset.position, asset.rotation)
  for (const voxel of voxels) {
    world.setVoxel(voxel.x, voxel.y, voxel.z, voxel.type)
  }
}

// Generate mesh
const mesh = world.buildMesh()
scene.add(mesh)
```

## Animated Parts

Assets with `parts` blocks create runtime THREE.js objects:

```forge
asset door-sliding
  parts:
    panel:
      box (0, 0, 0) size (48, 86, 10) as DOOR_PANEL
      at: (0, 1, 0)

  states:
    open:
      panel.position: (0, 87, 0)
    closed:
      panel.position: (0, 1, 0)
```

At runtime:

```mermaid
flowchart LR
    ASSET[door-sliding asset] --> STATIC["Static geometry<br/>(door frame)"]
    ASSET --> PANEL["Panel part<br/>(THREE.js mesh)"]

    STATIC --> WORLD[World Mesh]
    PANEL --> SCENE[Scene as child]

    STATE[State Change] --> ANIM[Animate Position]
    ANIM --> PANEL
```

1. Static geometry goes into world mesh
2. `panel` becomes separate THREE.js mesh
3. State changes animate panel position

## Asset Resolution

When resolving assets:

```mermaid
flowchart TB
    GET[Get asset definition] --> ROT[Apply rotation]
    ROT --> POS[Apply position offset]
    POS --> COND{Conditional<br/>geometry?}
    COND -->|Yes| EVAL[Evaluate conditions]
    COND -->|No| REPEAT{Repeat<br/>pattern?}
    EVAL --> REPEAT
    REPEAT -->|Yes| EXPAND[Expand pattern]
    REPEAT -->|No| OUTPUT[Output voxels]
    EXPAND --> OUTPUT
```

```typescript
interface ResolvedVoxel {
  x: number
  y: number
  z: number
  type: number
}

// Resolution process:
// 1. Get asset definition
// 2. Apply rotation transformation
// 3. Apply position offset
// 4. Evaluate conditional geometry
// 5. Expand repeat patterns
// 6. Return flat array of voxels
```

## Collision

```mermaid
flowchart TB
    POS[Player Position] --> CONVERT[Convert to voxel coords]
    CONVERT --> RADIUS[Expand by radius]
    RADIUS --> CHECK{Check each voxel}
    CHECK -->|Solid| COLLIDE[Collision detected]
    CHECK -->|Air| NEXT{More voxels?}
    NEXT -->|Yes| CHECK
    NEXT -->|No| CLEAR[No collision]
```

Voxel world provides collision detection:

```typescript
// Check if position collides with solid voxels
const collides = voxelWorld.isColliding(position, playerRadius)

// Get collision heights at position
const heights = voxelWorld.getCollisionHeights(x, z, radius)

// Find floor height at position
const floorY = voxelWorld.getFloorHeight(x, z)
```

## Performance

| Technique | Benefit |
|-----------|---------|
| **Pre-built meshes** | Layouts can be pre-compiled to mesh data |
| **Greedy meshing** | Reduces triangle count by 80-95% |
| **Instancing** | Repeated assets share geometry |
| **Frustum culling** | THREE.js automatic culling |
| **Uint16Array** | Efficient voxel storage (65k types) |

## File Organization

```
src/voxel/
├── VoxelTypes.ts           # Type definitions and constants
├── VoxelWorld.ts           # World grid management
├── GreedyMesher.ts         # Mesh optimization
├── VoxelAsset.ts           # Asset type definitions
├── VoxelAssetLoader.ts     # Static asset loading
├── AnimatedAsset.ts        # Animated asset types
├── AnimatedAssetLoader.ts  # Animated asset loading
└── AnimatedAssetInstance.ts # Runtime instances
```
