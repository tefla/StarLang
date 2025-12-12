# Exploration: Web-Based Retro 3D Approach

This document explores using web technologies (Three.js/TypeScript) for a retro, pixelated 3D implementation of StarLang—old-school, minimal, almost Minecraft-like.

## The Aesthetic Vision

**Old-school 3D, not modern realism.**

Think:
- PS1-era graphics with visible pixels
- Minecraft's blocky simplicity
- Limited color palettes
- Chunky geometry, no smooth curves
- Dithering instead of gradients

This aesthetic actually **strengthens** the game's themes:
- The ship feels like a **system**, not a place—matching how Riley must learn to see it
- Retro graphics evoke **computer terminals** and early simulations
- Simplicity keeps focus on the **code puzzles**, not pretty scenery
- Faster to create assets with low-poly/voxel approach

---

## Why 3D Still Makes Sense

Even with retro graphics, 3D offers:

1. **Physical Presence** - Walking through corridors, even blocky ones, creates isolation
2. **Spatial Discovery** - Finding terminals, navigating sealed sections
3. **Diegetic Interfaces** - Approaching screens feels natural
4. **Atmosphere** - Low-fi lighting and fog work great with pixelation

The abstraction of retro graphics actually **matches** StarLang's nature—the ship IS code, and seeing it as a simplified representation reinforces that.

---

## Technology Stack

### Three.js + TypeScript

The standard for web 3D, and it integrates perfectly with the existing Bun/TypeScript plan.

```typescript
// Works with Bun.serve() and HTML imports
import * as THREE from 'three';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';
```

**Pros:**
- Same TypeScript codebase as StarLang parser
- Massive ecosystem and documentation
- Built-in pixelation post-processing
- Works with Bun's HTML imports

### React Three Fiber (Optional)

Declarative React wrapper for Three.js.

```tsx
import { Canvas } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';

function Ship() {
  return (
    <Canvas>
      <PointerLockControls />
      <Room position={[0, 0, 0]} />
      <Terminal position={[2, 1, -3]} />
    </Canvas>
  );
}
```

**Pros:**
- Component-based (rooms, terminals as reusable components)
- Great ecosystem (@react-three/drei has many helpers)
- First-person controls already built ([R3F-First-person-camera](https://github.com/xWxfFle/R3F-First-person-camera))

**Cons:**
- Additional abstraction layer
- React overhead (though minimal)

**Recommendation:** Start with vanilla Three.js. Move to R3F if component complexity grows.

---

## Achieving the Retro Look

### 1. Pixelation Post-Processing

Three.js has a built-in [RenderPixelatedPass](https://threejs.org/examples/webgl_postprocessing_pixel.html):

```typescript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';

const composer = new EffectComposer(renderer);
const pixelPass = new RenderPixelatedPass(6, scene, camera); // 6 = pixel size
pixelPass.normalEdgeStrength = 1;  // Edge outlines
pixelPass.depthEdgeStrength = 1;
composer.addPass(pixelPass);

// In render loop
composer.render();
```

This creates:
- Blocky, chunky pixels (adjustable size)
- Single-pixel outlines on edges (like old 3D games)
- Camera-aligned pixelation (stable during movement)

### 2. Low-Poly Geometry

Keep models simple:

```typescript
// Corridor segment - just boxes
function createCorridor(): THREE.Group {
  const corridor = new THREE.Group();

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.2, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a })
  );
  floor.position.y = -1;
  corridor.add(floor);

  // Walls - simple boxes
  const wallGeo = new THREE.BoxGeometry(0.2, 3, 8);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });

  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.x = -2;
  corridor.add(leftWall);

  // ... ceiling, right wall

  return corridor;
}
```

### 3. Limited Color Palette

Use the existing art direction colors, but fewer of them:

```typescript
const PALETTE = {
  // Walls/floors (cool greys)
  DARK: 0x1a2744,
  MID: 0x2d3a52,
  LIGHT: 0x4a5a72,

  // Status colors
  OK: 0x77dd77,
  WARN: 0xffb347,
  CRIT: 0xff6b6b,

  // Accent
  TERMINAL_GLOW: 0x4a6fa5,
  PLAYER: 0x2dd4bf,
};
```

### 4. Flat/Lambert Shading

No PBR materials—use `MeshLambertMaterial` or `MeshBasicMaterial`:

```typescript
// Simple, flat shading
const material = new THREE.MeshLambertMaterial({
  color: PALETTE.MID,
  // No metalness, roughness, normal maps
});
```

### 5. Hard Shadows (Optional)

If using shadows, make them hard-edged:

```typescript
const light = new THREE.DirectionalLight(0xffffff, 1);
light.castShadow = true;
light.shadow.mapSize.width = 256;  // Low resolution = blocky shadows
light.shadow.mapSize.height = 256;
light.shadow.radius = 0;  // No softening
```

---

## Voxel Option: Full Minecraft Style

If going fully blocky, consider a voxel approach:

### Option A: Simple Box Grid

Not a full voxel engine—just place boxes on a grid:

```typescript
type VoxelType = 'floor' | 'wall' | 'ceiling' | 'terminal' | 'door';

interface Voxel {
  x: number;
  y: number;
  z: number;
  type: VoxelType;
}

function buildRoom(voxels: Voxel[]): THREE.Group {
  const room = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  for (const v of voxels) {
    const material = getMaterial(v.type);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(v.x, v.y, v.z);
    room.add(mesh);
  }

  return room;
}
```

### Option B: Existing Voxel Libraries

- **[voxel.js](https://voxel.github.io/voxeljs-site/)** - Classic, ~200 npm addons, but older
- **[Divine Voxel Engine](https://github.com/Divine-Star-Software/DivineVoxelEngine)** - Modern TypeScript, multi-threaded

For StarLang's scope (5-8 rooms), Option A is simpler. Full voxel engines are overkill unless we want terrain generation.

---

## Architecture

### Unified TypeScript Codebase

```
src/
├── parser/           # StarLang parser (existing plan)
│   ├── lexer.ts
│   ├── parser.ts
│   └── types.ts
├── runtime/          # Ship state management (existing plan)
│   ├── ship.ts
│   └── signals.ts
├── renderer/         # NEW: 3D rendering
│   ├── scene.ts      # Three.js setup, pixelation
│   ├── rooms.ts      # Room geometry builders
│   ├── player.ts     # First-person controller
│   └── terminals.ts  # Interactive terminal meshes
├── ui/               # 2D overlays (HUD, code editor)
│   ├── hud.ts
│   └── editor.ts
└── index.ts          # Bun.serve() entry point
```

The 3D renderer consumes the same ship state as the 2D version would—just renders it differently.

### Integration with Bun.serve()

```typescript
// index.ts
import { shipScene } from './renderer/scene';
import index from './index.html';

Bun.serve({
  routes: {
    '/': index,
    '/api/ship/state': {
      GET: () => Response.json(shipScene.getState()),
    },
    '/api/ship/compile': {
      POST: async (req) => {
        const { source } = await req.json();
        const result = shipScene.compile(source);
        return Response.json(result);
      },
    },
  },
  development: { hmr: true },
});
```

---

## First-Person Controls

Basic pointer-lock FPS controls:

```typescript
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

const controls = new PointerLockControls(camera, renderer.domElement);

// Click to lock pointer
renderer.domElement.addEventListener('click', () => {
  controls.lock();
});

// WASD movement
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

function updateMovement(delta: number) {
  direction.z = Number(keys.w) - Number(keys.s);
  direction.x = Number(keys.d) - Number(keys.a);
  direction.normalize();

  if (keys.w || keys.s) velocity.z -= direction.z * SPEED * delta;
  if (keys.a || keys.d) velocity.x -= direction.x * SPEED * delta;

  controls.moveRight(-velocity.x);
  controls.moveForward(-velocity.z);

  velocity.multiplyScalar(0.9); // Friction
}
```

For collision detection, use raycasting or a simple physics library like [cannon-es](https://github.com/pmndrs/cannon-es).

---

## Terminal Interaction

### Approach: HTML Overlay

When player approaches and activates a terminal:

1. Pointer unlocks
2. HTML/CSS terminal UI appears as overlay
3. 3D world dims/blurs behind
4. ESC to exit back to 3D

```typescript
function activateTerminal(terminal: Terminal) {
  controls.unlock();
  terminalUI.show(terminal.id);
  renderer.domElement.style.filter = 'blur(4px) brightness(0.5)';
}

function deactivateTerminal() {
  terminalUI.hide();
  renderer.domElement.style.filter = '';
  controls.lock();
}
```

This keeps the code editor in HTML/CSS (easier to build, better text editing) while the 3D world provides exploration.

---

## Simplified Scope

### MVP 3D World

- **3 rooms**: Galley, Corridor, Crew Mess
- **1 terminal type**: Engineering workstation
- **Basic geometry**: Boxes only, no curves
- **Pixelation**: 4-6 pixel size
- **No physics**: Simple collision with walls via raycasting

### Room Building

Rooms defined as data, rendered procedurally:

```typescript
const GALLEY: RoomDefinition = {
  id: 'galley',
  size: { x: 6, y: 3, z: 8 },
  elements: [
    { type: 'terminal', position: { x: 1, y: 1.2, z: -3 }, facing: 'south' },
    { type: 'door', position: { x: 3, y: 0, z: 4 }, connects: 'corridor_4a' },
    { type: 'prop', model: 'counter', position: { x: -2, y: 0, z: 0 } },
  ],
};
```

---

## Pros and Cons

### Web 3D Retro Approach

| Pros | Cons |
|------|------|
| Same TypeScript codebase | More complex than 2D canvas |
| Retro aesthetic is fast to build | Still need to learn Three.js |
| Pixelation hides rough edges | Performance on low-end devices |
| No external tools needed | 3D scope creep risk |
| Hot reload with Bun | |
| Immersive but stylized | |

### vs. Godot

| Factor | Web (Three.js) | Godot |
|--------|----------------|-------|
| Language | TypeScript (shared) | GDScript (separate) |
| Parser | Same codebase | Must reimplement |
| Tooling | VSCode, Bun | Godot Editor |
| Asset pipeline | Programmatic | Visual editor |
| Learning curve | Moderate | Moderate |
| Web export | Native | WebAssembly |

**Recommendation:** Web-based 3D keeps everything in TypeScript, which is a significant advantage for a language-focused game.

---

## Next Steps

1. [ ] Create Three.js proof-of-concept with pixelation pass
2. [ ] Build one room (galley) with box geometry
3. [ ] Implement first-person controls with pointer lock
4. [ ] Add one interactive terminal (HTML overlay)
5. [ ] Integrate with Bun.serve() and HTML imports
6. [ ] Test hot reload workflow

---

## Resources

- [Three.js Pixelation Example](https://threejs.org/examples/webgl_postprocessing_pixel.html) - Official pixelation post-processing
- [Three.js Retro Arcade Effect](https://www.appfoundry.be/blog/three-js-retro-arcade-effect-using-post-processing) - Tutorial on retro effects
- [R3F First Person Camera](https://github.com/xWxfFle/R3F-First-person-camera) - React Three Fiber FPS controls
- [Three.js Fundamentals](https://threejs.org/manual/#en/fundamentals) - Getting started guide
- [voxel.js](https://voxel.github.io/voxeljs-site/) - Minecraft-style voxel engine (reference)
- [Lo-Fi 3D Look Tutorial](https://joooooo308.medium.com/three-js-pixelated-lo-fi-energy-look-298b8dc3eaad) - Pixelated aesthetic techniques
