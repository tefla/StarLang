# Engine / Game Separation

StarLang follows a strict separation between the generic engine (`src/`) and game-specific content (`game/`).

## Architecture Overview

```mermaid
graph TB
    subgraph GAME["game/ (CONTENT)"]
        direction TB
        FORGE_FILES[".forge files<br/>assets, configs, behaviors, scenarios"]
        SL_FILES[".sl files<br/>ship system definitions"]

        subgraph FORGE_CONTENT["Forge Content"]
            ASSETS["assets/"]
            CONFIGS["configs/"]
            SCRIPTS["scripts/"]
            LAYOUTS["layouts/"]
            ENTITIES["entities/"]
        end
    end

    subgraph ENGINE["src/ (ENGINE)"]
        direction TB
        subgraph SYSTEMS["Engine Systems"]
            PLAYER[PlayerSystem]
            SCENE[SceneSystem]
            AUDIO[AudioSystem]
            PARTICLES[ParticleSystem]
            INTERACT[InteractionSystem]
        end

        subgraph FORGE_ENGINE["Forge Engine"]
            LEXER[Lexer]
            PARSER[Parser]
            VM[ForgeVM]
            REGISTRY[ConfigRegistry]
        end

        subgraph VOXEL["Voxel Engine"]
            WORLD[VoxelWorld]
            MESHER[GreedyMesher]
            LOADER[AssetLoader]
        end

        subgraph RUNTIME["Runtime"]
            RT[Runtime]
            BRIDGE[RuntimeForgeBridge]
        end
    end

    FORGE_FILES --> LEXER
    SL_FILES --> RT
    LEXER --> PARSER --> VM
    VM --> SYSTEMS
    VM --> REGISTRY
    REGISTRY --> SYSTEMS
    BRIDGE --> VM
    BRIDGE --> RT

    style GAME fill:#2d4a3e,stroke:#4ade80,color:#fff
    style ENGINE fill:#1e293b,stroke:#64748b,color:#fff
    style SYSTEMS fill:#4338ca,stroke:#818cf8
    style FORGE_ENGINE fill:#7c3aed,stroke:#a78bfa
    style VOXEL fill:#0891b2,stroke:#22d3ee
    style RUNTIME fill:#dc2626,stroke:#f87171
```

## Folder Structure

```
StarLang/
├── src/                        # ENGINE (TypeScript)
│   ├── engine/                 # Core game systems
│   │   ├── Game.ts             # Main game orchestrator
│   │   ├── PlayerSystem.ts     # First-person controller
│   │   ├── ShipScene.ts        # 3D scene management
│   │   ├── Interaction.ts      # Player interactions
│   │   ├── EntitySystem.ts     # Entity management
│   │   └── AudioSystem.ts      # Sound playback
│   │
│   ├── forge/                  # Forge DSL engine
│   │   ├── lexer.ts            # Tokenizer
│   │   ├── parser.ts           # AST builder
│   │   ├── vm.ts               # Virtual machine
│   │   ├── evaluator.ts        # Expression evaluation
│   │   ├── executor.ts         # Statement execution
│   │   └── ConfigRegistry.ts   # Config access
│   │
│   ├── voxel/                  # Voxel rendering
│   │   ├── VoxelWorld.ts       # World management
│   │   ├── GreedyMesher.ts     # Mesh optimization
│   │   └── VoxelAssetLoader.ts # Asset loading
│   │
│   ├── runtime/                # State management
│   │   ├── Runtime.ts          # StarLang runtime
│   │   └── RuntimeForgeBridge.ts # Forge integration
│   │
│   └── compiler/               # StarLang compiler
│       └── parser.ts           # .sl file parsing
│
├── game/                       # GAME CONTENT (Forge + StarLang)
│   ├── galley.game.forge       # Main game definition
│   │
│   ├── forge/                  # Forge definitions
│   │   ├── assets/             # Visual assets (.asset.forge)
│   │   ├── configs/            # Configuration (.config.forge)
│   │   ├── entities/           # Entity types (.entity.forge)
│   │   ├── layouts/            # Room layouts (.layout.forge)
│   │   └── scripts/            # Behaviors, scenarios, rules
│   │
│   └── ships/                  # Ship definitions
│       └── galley/
│           └── galley.sl       # Ship system code
│
└── tools/                      # Development tools
    └── layout-editor/          # Visual layout editor
```

## Engine Components

### Game.ts - Main Orchestrator

```mermaid
flowchart LR
    START([Game Start]) --> LOAD[Load game.forge]
    LOAD --> INIT[Initialize Systems]
    INIT --> SCENARIO[Start Scenario]
    SCENARIO --> LOOP{Game Loop}
    LOOP --> TICK[VM Tick]
    TICK --> UPDATE[Update Systems]
    UPDATE --> RENDER[Render Frame]
    RENDER --> LOOP
```

- Loads game definition from `.game.forge`
- Initializes all systems
- Manages the game loop
- Handles lifecycle events

### PlayerSystem.ts - Generic FPS Controller

```mermaid
flowchart TB
    INPUT[Input Events] --> MOVEMENT{Movement Type}
    MOVEMENT -->|WASD| WALK[Calculate Walk Vector]
    MOVEMENT -->|Mouse| LOOK[Update Camera Rotation]
    MOVEMENT -->|E Key| INTERACT[Trigger Interaction]

    WALK --> COLLISION[Check Collision]
    COLLISION --> POSITION[Update Position]

    subgraph CONFIG["From player.config.forge"]
        SPEED[walk_speed: 5]
        SENS[look_sensitivity: 0.002]
        HEIGHT[height: 1.7]
    end

    CONFIG --> WALK
    CONFIG --> LOOK
    CONFIG --> COLLISION
```

### ShipScene.ts - 3D Scene Management

- Loads layouts and assets
- Manages lighting
- Handles entity rendering
- All visual parameters from config

### ForgeVM (vm.ts)

The brain of the game - executes Forge scripts:

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Tick: Every frame
    Tick --> ExecuteRules: Process tick triggers
    ExecuteRules --> CheckConditions: Evaluate conditions
    CheckConditions --> UpdateState: Set state values
    UpdateState --> Idle

    Idle --> Event: Event received
    Event --> FindHandlers: Match event handlers
    FindHandlers --> Execute: Run handler code
    Execute --> UpdateState

    UpdateState --> EmitCallbacks: Notify listeners
    EmitCallbacks --> Idle
```

### RuntimeForgeBridge.ts

Connects ForgeVM to game systems:

```mermaid
sequenceDiagram
    participant RT as Runtime (StarLang)
    participant Bridge as RuntimeForgeBridge
    participant VM as ForgeVM
    participant Scene as SceneSystem

    RT->>Bridge: Signal changed
    Bridge->>VM: setStateValue()
    VM->>VM: Trigger watchers
    VM->>Scene: Visual callback

    VM->>Bridge: State changed
    Bridge->>RT: Update runtime state
```

## Game Content

### Assets (`game/forge/assets/`)

Visual objects defined in Forge DSL:

```forge
asset door-sliding
  parts:
    panel:
      box (0, 0, 0) size (48, 86, 10) as DOOR_PANEL
  states:
    open: panel.position: (0, 87, 0)
    closed: panel.position: (0, 1, 0)
```

### Configs (`game/forge/configs/`)

Game settings and parameters:

```forge
config player
  movement:
    walk_speed: 5
  collision:
    height: 1.7
```

### Scripts (`game/forge/scripts/`)

Game logic and behaviors:

```forge
scenario galley_escape
  initial:
    player_room: "galley"
    galley_o2: 19.5

  on room_change when $player_room == "corridor":
    emit "game:victory"
```

### Layouts (`game/forge/layouts/`)

World structure:

```forge
layout galley-deck
  rooms:
    galley at (-16, 0, 0) size (240, 120, 240)
  doors:
    galley_exit at (104, 0, 40) facing east
```

## Key Principles

### 1. No TypeScript in game/

```mermaid
graph LR
    subgraph ALLOWED["game/ - Allowed"]
        F1[".forge files"]
        F2[".sl files"]
        F3[".json layouts"]
    end

    subgraph FORBIDDEN["game/ - Forbidden"]
        T1[".ts files"]
        T2[".tsx files"]
        T3[".js files"]
    end

    style ALLOWED fill:#2d4a3e,stroke:#4ade80
    style FORBIDDEN fill:#4a2d2d,stroke:#f87171
```

All game content is defined using:
- **Forge DSL** for visuals, config, and scripting
- **StarLang** for ship system definitions

This allows content creators to work without TypeScript knowledge.

### 2. Engine is Generic

The `src/` code should work with any game content. Game-specific logic belongs in Forge scripts, not TypeScript.

### 3. Config-Driven

Engine behavior is controlled by Forge configs:

```typescript
// Engine reads from Forge config
this.player = new PlayerSystem({
  moveSpeed: Config.player.movement.walkSpeed,
  lookSensitivity: Config.player.movement.lookSensitivity,
  ...
})
```

### 4. Event-Based Communication

```mermaid
sequenceDiagram
    participant Engine
    participant ForgeVM
    participant Behavior
    participant Visual

    Engine->>ForgeVM: emit('door:open', {id})
    ForgeVM->>Behavior: Match event handler
    Behavior->>Behavior: Update state
    Behavior->>Visual: setState(open)
    Behavior->>Visual: play(open)
```

### 5. Runtime State in ForgeVM

Game state lives in ForgeVM, not hardcoded:

```typescript
// Get state from VM
const o2Level = vm.getStateValue('galley.o2_level')

// Set state in VM
vm.setStateValue('player_room', 'corridor')
```

## Data Flow

```mermaid
flowchart TB
    subgraph LOOP["Game Loop (every frame)"]
        direction LR
        E1[1. Engine tick] --> E2[2. Forge VM tick]
        E2 --> E3[3. State sync]
        E3 --> E4[4. Render]
    end

    subgraph INTERACTION["Player Interaction"]
        direction LR
        I1[1. Press E] --> I2[2. Find target]
        I2 --> I3[3. Execute handler]
        I3 --> I4[4. Events propagate]
        I4 --> I5[5. Visual updates]
    end

    LOOP --> INTERACTION
```

## System Initialization

```mermaid
flowchart TB
    START([Load game.forge]) --> PARSE[Parse Forge files]
    PARSE --> INIT_VM[Initialize ForgeVM]
    INIT_VM --> LOAD_CONFIG[Load configs]
    LOAD_CONFIG --> INIT_PLAYER[Initialize PlayerSystem]
    INIT_PLAYER --> INIT_SCENE[Initialize SceneSystem]
    INIT_SCENE --> LOAD_LAYOUT[Load layout]
    LOAD_LAYOUT --> SPAWN_ENTITIES[Spawn entities]
    SPAWN_ENTITIES --> START_SCENARIO[Start scenario]
    START_SCENARIO --> READY([Game Ready])
```

## Benefits

| Benefit | Description |
|---------|-------------|
| **Modding Support** | Game content can be modified without recompiling |
| **Rapid Iteration** | Change Forge files, see results immediately |
| **Separation of Concerns** | Programmers work on engine, designers on content |
| **Reusability** | Engine can power multiple games |
| **Testing** | Engine and content can be tested independently |

## Example: Adding a New Asset

To add a new interactive object:

```mermaid
flowchart LR
    A[1. Create asset.forge] --> B[2. Define states]
    B --> C[3. Add animations]
    C --> D[4. Create behavior.forge]
    D --> E[5. Place in layout.forge]
    E --> F[6. Test in game]
```

No TypeScript changes needed - the engine handles everything through Forge.
