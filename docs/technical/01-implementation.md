# Implementation Overview

## Technology Stack

For a LangJam project targeting web:

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | TypeScript | Type safety, good for compilers |
| UI | React | Component model, reactive updates |
| Styling | Tailwind CSS | Rapid prototyping |
| State | Zustand or Redux | Predictable state management |
| Parser | Hand-written or PEG.js | Control over error messages |

---

## Core Types

### Node System

```typescript
// Base node definition
interface NodeDefinition {
  id: string
  type: NodeType
  properties: Record<string, any>
  connections: string[]
  permissions: PermissionSpec
  triggers: TriggerDefinition[]
  actions: Record<string, ActionBlock>
}

type NodeType = 
  | 'ROOM' 
  | 'CORRIDOR'
  | 'DOOR' 
  | 'SENSOR' 
  | 'RELAY' 
  | 'TERMINAL'
  | 'ATMO_INLET'
  | 'ATMO_OUTLET'
  | 'POWER_NODE'
  | 'SIGNAL'
  | 'SCRUBBER'
  | 'FIRE_SUPPRESSION'
  | 'INTERCOM'
  | 'ALERT'

// Runtime state
interface NodeState {
  id: string
  values: Record<string, any>
  lastModified: number
  modifiedBy: string
}
```

### Permission System

```typescript
interface PermissionSpec {
  view: PermissionExpr
  edit: PermissionExpr
}

type PermissionExpr =
  | { type: 'CREDENTIAL', role: Role, orHigher: boolean }
  | { type: 'SIGNAL', signalId: string }
  | { type: 'ANY', conditions: PermissionExpr[] }
  | { type: 'ALL', conditions: PermissionExpr[] }
  | { type: 'NOT', condition: PermissionExpr }

type Role = 
  | 'CAPTAIN' 
  | 'OFFICER' 
  | 'SECURITY'
  | 'ENGINEERING' 
  | 'ENGINEERING_JUNIOR'
  | 'MEDICAL'
  | 'SCIENCE'
  | 'OPERATIONS'
  | 'COOK'
  | 'MAINTENANCE'
  | 'STEWARD'
```

### Signal System

```typescript
interface SignalDefinition {
  id: string
  description: string
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
  triggersOn?: Condition
  clearsOn?: Condition
  autoClear?: number  // milliseconds
  manualOnly?: boolean
  onTrigger?: ActionBlock
  onClear?: ActionBlock
}

interface SignalState {
  active: boolean
  triggeredAt: number | null
  triggeredBy: string | null
  clearAt: number | null
}
```

### Conditions and Actions

```typescript
type Condition =
  | { type: 'COMPARISON', left: Expr, op: CompareOp, right: Expr }
  | { type: 'AND', operands: Condition[] }
  | { type: 'OR', operands: Condition[] }
  | { type: 'NOT', operand: Condition }
  | { type: 'ANY', conditions: Condition[] }
  | { type: 'ALL', conditions: Condition[] }
  | { type: 'SIGNAL', signalId: string }
  | { type: 'CREDENTIAL', role: Role, orHigher: boolean }

type CompareOp = '==' | '!=' | '<' | '>' | '<=' | '>='

type Expr =
  | { type: 'LITERAL', value: any }
  | { type: 'REFERENCE', path: string }
  | { type: 'FUNCTION', name: string, args: Expr[] }

interface ActionBlock {
  statements: Statement[]
}

type Statement =
  | { type: 'TRIGGER', signal: string }
  | { type: 'CLEAR', signal: string }
  | { type: 'ANNOUNCE', location: string, message: string }
  | { type: 'SET', target: string, value: Expr }
  | { type: 'OPEN', door: string }
  | { type: 'CLOSE', door: string }
  | { type: 'SEAL', door: string }
  | { type: 'UNSEAL', door: string }
  | { type: 'IF', condition: Condition, then: ActionBlock, else?: ActionBlock }
  | { type: 'AFTER', delay: number, action: ActionBlock }
  | { type: 'LOG', message: string }
```

---

## Class Structure

### Runtime Core

```typescript
class StarLangRuntime {
  private definitionStore: DefinitionStore
  private stateStore: StateStore
  private signalGraph: SignalGraph
  private executor: ActionExecutor
  private dirtyTracker: DirtyTracker
  private versionControl: VersionControl
  
  // Lifecycle
  initialize(files: Map<string, string>): void
  tick(deltaTime: number): void
  shutdown(): void
  
  // File operations
  loadFile(path: string, content: string): CompileResult
  recompile(path: string, newContent: string): ReconcileResult
  
  // Player actions
  playerAction(action: PlayerAction): ActionResult
  query(command: string): QueryResult
  
  // Subscriptions
  subscribe(path: string, callback: StateCallback): Unsubscribe
  
  // Events
  on(event: RuntimeEvent, handler: EventHandler): void
}
```

### Stores

```typescript
class DefinitionStore {
  private definitions: Map<string, NodeDefinition>
  
  get(id: string): NodeDefinition | undefined
  set(id: string, def: NodeDefinition): void
  delete(id: string): void
  getByType(type: NodeType): NodeDefinition[]
  getInScope(scope: string[]): NodeDefinition[]
  all(): IterableIterator<NodeDefinition>
}

class StateStore {
  private states: Map<string, NodeState>
  private subscribers: Map<string, Set<StateCallback>>
  
  get(id: string): NodeState | undefined
  getProperty(id: string, property: string): any
  set(id: string, state: NodeState): void
  setProperty(id: string, property: string, value: any): void
  delete(id: string): void
  subscribe(path: string, callback: StateCallback): Unsubscribe
}
```

### Signal Graph

```typescript
class SignalGraph {
  private dependencies: Map<string, Set<string>>  // A affects B
  private listeners: Map<string, Set<string>>     // signal → nodes
  private emitters: Map<string, Set<string>>      // node → signals
  
  addNode(def: NodeDefinition): void
  removeNode(id: string): void
  rewireNode(id: string, newDef: NodeDefinition): void
  
  getDependents(nodeId: string): string[]
  getListeners(signalId: string): string[]
  getEmitters(nodeId: string): string[]
  
  // For topological sort
  topologicalOrder(nodes: Set<string>): string[]
}
```

---

## File Structure

```
src/
├── index.ts                 # Entry point
├── runtime/
│   ├── Runtime.ts          # Main runtime class
│   ├── DefinitionStore.ts
│   ├── StateStore.ts
│   ├── SignalGraph.ts
│   ├── DirtyTracker.ts
│   └── Executor.ts
├── compiler/
│   ├── Parser.ts           # Source → AST
│   ├── Validator.ts        # AST validation
│   ├── Compiler.ts         # AST → Definitions
│   └── Reconciler.ts       # Hot-reload
├── types/
│   ├── nodes.ts            # Node type definitions
│   ├── conditions.ts       # Condition types
│   ├── actions.ts          # Action types
│   └── permissions.ts      # Permission types
├── version-control/
│   ├── CommitStore.ts
│   └── Commands.ts         # slvc commands
├── game/
│   ├── Game.tsx            # Main Three.js game
│   ├── scene/
│   │   ├── ShipScene.ts    # 3D ship environment
│   │   ├── RoomMesh.ts     # Room geometry
│   │   ├── DoorMesh.ts     # Door objects
│   │   └── LightingRig.ts  # Scene lighting
│   ├── player/
│   │   ├── PlayerController.ts  # WASD + mouse look
│   │   ├── Interaction.ts       # Raycast interaction
│   │   └── CameraRig.ts         # First-person camera
│   ├── terminals/
│   │   ├── TerminalMesh.ts      # 3D terminal object
│   │   ├── ScreenTexture.ts     # Canvas-to-texture
│   │   ├── StatusTerminal.tsx   # Status panel content
│   │   ├── EngineeringTerminal.tsx
│   │   └── CommandTerminal.tsx
│   ├── hooks/
│   │   ├── useShipState.ts
│   │   └── useRuntime.ts
│   └── store/
│       └── gameStore.ts
└── content/
    ├── ship/               # .sl files defining the ship
    │   ├── manifest.sl
    │   ├── systems/
    │   ├── deck_1/
    │   └── ...
    └── docs/               # In-game documentation
        └── manuals/
```

---

## Key Algorithms

### Topological Sort for Dependencies

```typescript
function topologicalSort(
  nodes: Set<string>, 
  getDeps: (id: string) => string[]
): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  
  function visit(id: string) {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      throw new Error(`Circular dependency: ${id}`)
    }
    
    visiting.add(id)
    
    for (const dep of getDeps(id)) {
      if (nodes.has(dep)) {
        visit(dep)
      }
    }
    
    visiting.delete(id)
    visited.add(id)
    result.push(id)
  }
  
  for (const id of nodes) {
    visit(id)
  }
  
  return result
}
```

### Condition Evaluation

```typescript
function evaluateCondition(
  condition: Condition, 
  context: EvalContext
): boolean {
  switch (condition.type) {
    case 'COMPARISON':
      const left = evaluateExpr(condition.left, context)
      const right = evaluateExpr(condition.right, context)
      return compare(left, condition.op, right)
      
    case 'AND':
      return condition.operands.every(op => 
        evaluateCondition(op, context)
      )
      
    case 'OR':
      return condition.operands.some(op => 
        evaluateCondition(op, context)
      )
      
    case 'NOT':
      return !evaluateCondition(condition.operand, context)
      
    case 'SIGNAL':
      return context.signalStore.isActive(condition.signalId)
      
    case 'CREDENTIAL':
      return hasCredential(
        context.credentials, 
        condition.role, 
        condition.orHigher
      )
      
    default:
      throw new Error(`Unknown condition type`)
  }
}
```

### Reference Resolution

```typescript
function resolveReference(
  path: string, 
  context: EvalContext
): any {
  const parts = path.split('.')
  
  // First part is node ID or namespace
  let current: any
  const firstPart = parts[0]
  
  // Check namespaces
  if (NAMESPACES[firstPart]) {
    current = context.definitionStore.get(
      NAMESPACES[firstPart] + '.' + parts[1]
    )
    parts.splice(0, 2)
  } else {
    current = context.definitionStore.get(firstPart) 
           || context.stateStore.get(firstPart)
    parts.shift()
  }
  
  // Navigate remaining path
  for (const part of parts) {
    if (current?.properties?.[part] !== undefined) {
      current = current.properties[part]
    } else if (current?.values?.[part] !== undefined) {
      current = current.values[part]
    } else {
      throw new Error(`Cannot resolve: ${path}`)
    }
  }
  
  return current
}
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Tick rate | 60 Hz | Smooth UI updates |
| Parse time | <100ms | For single file |
| Compile time | <200ms | For single file |
| Reconcile time | <50ms | Hot reload feels instant |
| Memory | <100MB | Reasonable for browser |

---

## Testing Strategy

### Unit Tests

- Parser: Edge cases, error messages
- Compiler: Type validation, reference resolution
- Executor: All action types
- Conditions: All operators and combinations

### Integration Tests

- Full compile-run cycle
- Hot reload scenarios
- Signal cascade limits
- Permission checking

### Gameplay Tests

- Complete puzzle walkthroughs
- Verify player can't get stuck
- Check all endings reachable
