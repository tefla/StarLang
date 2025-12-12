# Runtime Architecture

## Overview

The StarLang runtime is responsible for:

1. **Parsing** `.sl` files into an Abstract Syntax Tree (AST)
2. **Compiling** the AST into a runtime graph of nodes
3. **Executing** the simulation: updating state, propagating signals, evaluating conditions
4. **Reconciling** changes when files are edited without losing state

This document provides a high-level view of how these pieces fit together.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         STARLANG RUNTIME                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Parser    │───▶│  Compiler   │───▶│   Runtime   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        ▲                   │                  │                 │
│        │                   │                  │                 │
│        │                   ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  .sl Files  │    │  Node Defs  │◀──▶│    State    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                            │                  │                 │
│                            ▼                  ▼                 │
│                     ┌─────────────┐    ┌─────────────┐         │
│                     │Signal Graph │───▶│  UI Binding │         │
│                     └─────────────┘    └─────────────┘         │
│                                               │                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │   Game UI   │
                                         └─────────────┘
```

---

## The Pipeline

### Stage 1: Parsing

**Input:** `.sl` source files (text)
**Output:** Abstract Syntax Tree (AST)

The parser reads StarLang source code and produces a tree structure representing the program. At this stage, we're just checking syntax—not whether references are valid.

```
Source:                          AST:
                                 
room galley {                    Declaration {
  display_name: "Galley"           type: "room"
  deck: 4                          id: "galley"
}                                  properties: [
                                     Property { name: "display_name", value: "Galley" }
                                     Property { name: "deck", value: 4 }
                                   ]
                                 }
```

### Stage 2: Compilation

**Input:** AST from all files
**Output:** Node definitions, signal graph

The compiler:
1. Collects all declarations across all files
2. Resolves references (e.g., `power.local_4` → actual node)
3. Validates types and constraints
4. Builds the signal graph (who listens to whom)
5. Produces immutable node definitions

```
AST Declarations              Node Definitions
                              
room galley { ... }     ──▶   NodeDef {
door galley_to_cold { ... }     id: "galley"
sensor temp_galley { ... }      type: ROOM
                                properties: { ... }
                                connections: ["galley_to_cold", "temp_galley"]
                              }
```

### Stage 3: Runtime Execution

**Input:** Node definitions, signal graph
**Output:** Continuously updated state

The runtime:
1. Initialises state for each node
2. Runs the simulation loop
3. Propagates signals when conditions change
4. Updates time-varying values (O2 levels, temperatures)
5. Responds to player actions

```
Loop:
  1. Process player input
  2. Update time-varying state (deltaTime)
  3. Evaluate triggered conditions
  4. Propagate signals
  5. Execute action blocks
  6. Notify UI of state changes
```

---

## Core Components

### The Definition Store

Holds compiled node definitions. Immutable between recompiles.

```
DefinitionStore {
  nodes: Map<NodeId, NodeDefinition>
  signals: Map<SignalId, SignalDefinition>
  permissions: PermissionRules
  
  // Lookup methods
  getNode(id: NodeId): NodeDefinition
  getNodesOfType(type: NodeType): NodeDefinition[]
  getNodesInScope(scope: Scope): NodeDefinition[]
}
```

### The State Store

Holds runtime state. Mutable, updated every tick.

```
StateStore {
  nodeStates: Map<NodeId, NodeState>
  signalStates: Map<SignalId, SignalState>
  
  // Mutation methods
  setState(nodeId, property, value): void
  getState(nodeId, property): any
  
  // Subscription for UI binding
  subscribe(nodeId, property, callback): Unsubscribe
}
```

### The Signal Graph

Tracks dependencies between nodes for reactive updates.

```
SignalGraph {
  // Node A's output affects Node B
  dependencies: Map<NodeId, Set<NodeId>>
  
  // What signals each node listens to
  listeners: Map<SignalId, Set<NodeId>>
  
  // What signals each node can emit
  emitters: Map<NodeId, Set<SignalId>>
  
  // Propagation
  propagate(changedNode: NodeId): Set<NodeId>
  trigger(signal: SignalId): Set<NodeId>
}
```

### The Executor

Runs action blocks and updates state.

```
Executor {
  // Execute an action block with context
  execute(action: ActionBlock, context: ExecutionContext): void
  
  // Evaluate a condition
  evaluate(condition: Condition, context: EvaluationContext): boolean
  
  // Built-in actions
  actions: {
    trigger(signal): void
    clear(signal): void
    announce(location, message): void
    open(door): void
    seal(door): void
    set(node.property, value): void
    // ... etc
  }
}
```

---

## Execution Model

### The Tick

The runtime updates in discrete ticks. Each tick:

```
tick(deltaTime: number) {
  // 1. Process queued player actions
  for (action of playerActionQueue) {
    executePlayerAction(action)
  }
  
  // 2. Update time-varying state
  for (node of timeVaryingNodes) {
    updateTimeVarying(node, deltaTime)
  }
  
  // 3. Check trigger conditions
  for (signal of signals) {
    if (shouldTrigger(signal) && !signal.active) {
      trigger(signal)
    }
    if (shouldClear(signal) && signal.active) {
      clear(signal)
    }
  }
  
  // 4. Process dirty nodes (signal propagation)
  while (dirtyNodes.size > 0) {
    node = dirtyNodes.pop()
    evaluateNode(node)
    // May add more nodes to dirtyNodes
  }
  
  // 5. Notify UI of changes
  notifySubscribers()
}
```

### Time-Varying State

Some values change continuously over time:

- **O2 levels**: Decrease based on flow imbalance
- **Temperatures**: Drift toward equilibrium
- **Power reserves**: Drain based on consumption
- **Scrubber capacity**: Depletes with use

```
updateTimeVarying(node, deltaTime) {
  switch (node.type) {
    case ATMO_ZONE:
      // Calculate net flow
      netFlow = totalInflow - totalOutflow
      // Update O2 level
      node.state.o2_level += netFlow * deltaTime * O2_FACTOR
      break
      
    case POWER_RESERVE:
      // Drain based on current draw
      node.state.charge -= node.state.current_draw * deltaTime
      break
      
    // ... etc
  }
}
```

### Signal Propagation

When a signal triggers:

```
trigger(signal: SignalId) {
  // Mark signal as active
  signalStates.set(signal, { active: true, triggeredAt: now() })
  
  // Execute on_trigger actions
  executeOnTrigger(signal)
  
  // Find all listeners
  listeners = signalGraph.listeners.get(signal)
  
  // Mark them dirty for re-evaluation
  for (listener of listeners) {
    dirtyNodes.add(listener)
  }
}
```

### Evaluation Order

Nodes are evaluated in dependency order to ensure consistency:

```
evaluateInOrder(dirtyNodes: Set<NodeId>) {
  // Topological sort based on dependencies
  sorted = topologicalSort(dirtyNodes, signalGraph.dependencies)
  
  // Evaluate in order
  for (nodeId of sorted) {
    evaluateNode(nodeId)
  }
}
```

---

## Performance Considerations

### What Makes This Fast

1. **Reactive, not polling**: Only evaluate nodes whose inputs changed
2. **Compiled definitions**: No parsing at runtime
3. **Indexed lookups**: O(1) access to nodes and state
4. **Minimal propagation**: Track dirty nodes to avoid re-evaluating everything

### What Could Be Slow

1. **Large cascade chains**: A signal that triggers 1000 listeners
2. **Complex conditions**: Deeply nested boolean expressions
3. **Frequent time-varying updates**: Many nodes changing every frame

### Mitigation Strategies

- **Cascade limits**: Cap propagation depth at 10
- **Condition caching**: Cache evaluated conditions until inputs change
- **Update batching**: Group time-varying updates, don't notify UI until batch complete
- **Level-of-detail**: Only run detailed simulation for "nearby" nodes

---

## Integration Points

### Player Actions

The game sends player actions to the runtime:

```
runtime.playerAction({
  type: 'EDIT_FILE',
  file: '/deck_4/section_7/galley.sl',
  changes: [
    { line: 13, oldText: 'target: VOID.external', newText: 'target: galley_intake' }
  ]
})

runtime.playerAction({
  type: 'INTERACT',
  target: 'door_galley_to_cold',
  action: 'OPEN'
})

runtime.playerAction({
  type: 'QUERY',
  command: 'status galley'
})
```

### UI Binding

The UI subscribes to state changes:

```
// React example
function OxygenDisplay({ roomId }) {
  const o2 = useShipState(`${roomId}.atmosphere.o2_level`)
  
  return <Gauge value={o2} max={100} label="O2" />
}

// The hook subscribes to runtime state
function useShipState(path) {
  const [value, setValue] = useState(runtime.getState(path))
  
  useEffect(() => {
    return runtime.subscribe(path, setValue)
  }, [path])
  
  return value
}
```

### Version Control

The runtime integrates with the version control system:

```
// On file edit
runtime.onFileChange(file, newContent) {
  // 1. Parse and validate
  result = parseAndValidate(newContent)
  
  if (result.errors.length > 0) {
    return { success: false, errors: result.errors }
  }
  
  // 2. Commit to version control
  slvc.commit(file, newContent, 'User edit')
  
  // 3. Recompile and reconcile
  newDefs = compile(file, newContent)
  reconcile(currentDefs, newDefs)
  
  return { success: true }
}
```
