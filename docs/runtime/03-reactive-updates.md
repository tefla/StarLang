# Reactive Updates

## Overview

StarLang uses a reactive update model: instead of continuously polling every node, the runtime only evaluates nodes whose inputs have changed. This is efficient and predictable.

---

## The Signal Graph

The signal graph tracks dependencies between nodes.

```
┌─────────────────────────────────────────────────────────────┐
│                      SIGNAL GRAPH                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   sensor.o2_galley ──────┬──────► relay.atmo_warning        │
│                          │                                  │
│                          ├──────► signal.atmo.critical      │
│                          │              │                   │
│                          │              ├───► door.seal     │
│                          │              │                   │
│                          │              └───► alert.atmo    │
│                          │                                  │
│                          └──────► ui.o2_display             │
│                                                             │
│   sensor.temp_galley ────┬──────► relay.fire_check          │
│                          │              │                   │
│                          │              └───► signal.fire   │
│                          │                                  │
│                          └──────► ui.temp_display           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Building the Graph

The graph is built during compilation by analysing:

1. **Explicit dependencies**: `trigger: signal(X)` means this node depends on X
2. **Property references**: `target: node.property` means this node depends on that node
3. **Condition expressions**: `if sensor.reading > 50` means dependency on that sensor

```
function buildSignalGraph(definitions: NodeDefinition[]): SignalGraph {
  const graph = new SignalGraph()
  
  for (const def of definitions) {
    // Find all references in this definition
    const refs = extractReferences(def)
    
    for (const ref of refs) {
      // This node depends on ref
      graph.addDependency(ref, def.id)
    }
    
    // Find all signals this node listens to
    const signals = extractSignalListeners(def)
    
    for (const signal of signals) {
      graph.addListener(signal, def.id)
    }
    
    // Find all signals this node can emit
    const emits = extractSignalEmitters(def)
    
    for (const signal of emits) {
      graph.addEmitter(def.id, signal)
    }
  }
  
  return graph
}
```

---

## Update Types

### Event-Driven Updates

Most updates are event-driven: something happens, affected nodes react.

**Trigger Events:**
- Signal triggered/cleared
- Player action (open door, edit file)
- Sensor reading crosses threshold
- Timer fires

**Propagation:**
```
Event occurs
    │
    ▼
Mark source node dirty
    │
    ▼
Find all nodes that depend on source
    │
    ▼
Mark them dirty too
    │
    ▼
Evaluate dirty nodes in dependency order
    │
    ▼
Each evaluation may trigger more events (cascade)
```

### Time-Varying Updates

Some values change continuously with time:

- O2 levels (based on flow imbalance)
- Temperatures (drift toward equilibrium)
- Power reserves (drain based on consumption)
- Scrubber capacity (depletion)

These update every tick based on deltaTime:

```
function updateTimeVarying(deltaTime: number) {
  for (const node of timeVaryingNodes) {
    switch (node.type) {
      case 'ATMO_ZONE':
        updateAtmosphere(node, deltaTime)
        break
      case 'THERMAL_ZONE':
        updateTemperature(node, deltaTime)
        break
      case 'POWER_RESERVE':
        updatePowerReserve(node, deltaTime)
        break
    }
  }
}

function updateAtmosphere(zone: AtmoZone, dt: number) {
  // Calculate net flow
  const inflow = zone.inlets.reduce((sum, i) => sum + i.state.flow_rate, 0)
  const outflow = zone.outlets.reduce((sum, o) => sum + o.state.flow_rate, 0)
  const netFlow = inflow - outflow
  
  // Update O2 level
  // Simplified: actual would consider O2 concentration of inflow
  const o2Change = netFlow * O2_CONCENTRATION * dt / zone.volume
  zone.state.o2_level = clamp(zone.state.o2_level + o2Change, 0, 100)
  
  // Mark as dirty if changed significantly
  if (Math.abs(o2Change) > 0.01) {
    markDirty(zone.id)
  }
}
```

---

## The Dirty Set

The runtime tracks which nodes need re-evaluation using a "dirty set."

```
class DirtyTracker {
  private dirty: Set<string> = new Set()
  private processing: boolean = false
  
  mark(nodeId: string): void {
    this.dirty.add(nodeId)
  }
  
  process(evaluator: NodeEvaluator): void {
    if (this.processing) {
      // Already processing - this is a cascade
      return
    }
    
    this.processing = true
    let iterations = 0
    const MAX_ITERATIONS = 10  // Cascade limit
    
    while (this.dirty.size > 0 && iterations < MAX_ITERATIONS) {
      // Get nodes in dependency order
      const ordered = this.topologicalSort(this.dirty)
      this.dirty.clear()
      
      // Evaluate each
      for (const nodeId of ordered) {
        evaluator.evaluate(nodeId)
        // evaluate() may call mark() for downstream nodes
      }
      
      iterations++
    }
    
    if (iterations >= MAX_ITERATIONS) {
      console.warn('Cascade limit reached - possible infinite loop')
    }
    
    this.processing = false
  }
  
  private topologicalSort(nodes: Set<string>): string[] {
    // Sort by dependency depth (nodes with no dirty dependencies first)
    // ... implementation ...
  }
}
```

---

## Evaluation

When a node is evaluated, its conditions are checked and actions may fire.

```
class NodeEvaluator {
  evaluate(nodeId: string): void {
    const def = this.definitions.get(nodeId)
    const state = this.stateStore.get(nodeId)
    
    switch (def.type) {
      case 'RELAY':
        this.evaluateRelay(def, state)
        break
      case 'SENSOR':
        this.evaluateSensor(def, state)
        break
      case 'DOOR':
        this.evaluateDoor(def, state)
        break
      case 'SIGNAL':
        this.evaluateSignal(def, state)
        break
      // ... etc
    }
  }
  
  private evaluateRelay(def: RelayDef, state: RelayState): void {
    // Check trigger condition
    const shouldFire = this.evaluateCondition(def.trigger)
    
    if (shouldFire && !state.fired) {
      // Fire the relay
      state.fired = true
      this.executeAction(def.action, { relay: def })
    }
    else if (!shouldFire && state.fired && !def.once) {
      // Reset for re-triggerable relays
      state.fired = false
    }
  }
  
  private evaluateSignal(def: SignalDef, state: SignalState): void {
    // Check trigger condition
    if (def.triggers_on) {
      const shouldTrigger = this.evaluateCondition(def.triggers_on)
      if (shouldTrigger && !state.active) {
        this.triggerSignal(def.id)
      }
    }
    
    // Check clear condition
    if (def.clears_on && state.active) {
      const shouldClear = this.evaluateCondition(def.clears_on)
      if (shouldClear) {
        this.clearSignal(def.id)
      }
    }
    
    // Check auto-clear
    if (def.auto_clear && state.active) {
      const elapsed = Date.now() - state.triggered_at
      if (elapsed >= def.auto_clear) {
        this.clearSignal(def.id)
      }
    }
  }
}
```

---

## Condition Evaluation

Conditions are expressions that return true/false.

```
function evaluateCondition(condition: Condition, context: Context): boolean {
  switch (condition.type) {
    case 'COMPARISON':
      const left = evaluateExpr(condition.left, context)
      const right = evaluateExpr(condition.right, context)
      return compare(left, condition.operator, right)
      
    case 'AND':
      return condition.operands.every(op => evaluateCondition(op, context))
      
    case 'OR':
      return condition.operands.some(op => evaluateCondition(op, context))
      
    case 'NOT':
      return !evaluateCondition(condition.operand, context)
      
    case 'ANY':
      return condition.conditions.some(c => evaluateCondition(c, context))
      
    case 'ALL':
      return condition.conditions.every(c => evaluateCondition(c, context))
      
    case 'SIGNAL':
      return this.signalStore.isActive(condition.signalId)
      
    case 'CREDENTIAL':
      return context.credentials.includes(condition.credential) ||
             hasHigherCredential(context.credentials, condition.credential)
      
    default:
      throw new Error(`Unknown condition type: ${condition.type}`)
  }
}
```

---

## Action Execution

Actions modify state and can trigger cascades.

```
class ActionExecutor {
  execute(action: ActionBlock, context: ExecutionContext): void {
    for (const statement of action.statements) {
      this.executeStatement(statement, context)
    }
  }
  
  private executeStatement(stmt: Statement, ctx: ExecutionContext): void {
    switch (stmt.type) {
      case 'TRIGGER':
        this.triggerSignal(stmt.signal)
        break
        
      case 'CLEAR':
        this.clearSignal(stmt.signal)
        break
        
      case 'ANNOUNCE':
        this.announce(stmt.location, stmt.message, ctx)
        break
        
      case 'SET':
        this.setState(stmt.target, stmt.value, ctx)
        break
        
      case 'OPEN':
        this.openDoor(stmt.door, ctx)
        break
        
      case 'SEAL':
        this.sealDoor(stmt.door, ctx)
        break
        
      case 'IF':
        if (evaluateCondition(stmt.condition, ctx)) {
          this.execute(stmt.thenBlock, ctx)
        } else if (stmt.elseBlock) {
          this.execute(stmt.elseBlock, ctx)
        }
        break
        
      case 'AFTER':
        this.scheduleDelayed(stmt.delay, stmt.action, ctx)
        break
        
      case 'LOG':
        this.log(stmt.message, ctx)
        break
    }
  }
  
  private triggerSignal(signalId: string): void {
    const state = this.signalStore.get(signalId)
    if (!state.active) {
      state.active = true
      state.triggered_at = Date.now()
      
      // Mark all listeners dirty
      const listeners = this.signalGraph.getListeners(signalId)
      for (const listener of listeners) {
        this.dirtyTracker.mark(listener)
      }
    }
  }
}
```

---

## Performance Characteristics

### What's Fast

| Operation | Complexity | Notes |
|-----------|------------|-------|
| State lookup | O(1) | Hash map |
| Signal check | O(1) | Boolean flag |
| Mark dirty | O(1) | Set add |
| Find listeners | O(1) | Pre-computed graph |

### What's Potentially Slow

| Operation | Complexity | Mitigation |
|-----------|------------|------------|
| Cascade propagation | O(n) | Cascade limit |
| Topological sort | O(V+E) | Cache when possible |
| Complex conditions | O(depth) | Condition caching |
| Many time-varying nodes | O(n) | Batch updates |

### Expected Performance

For a ship with ~500 nodes:

- **Idle tick** (no events): <1ms
- **Single event**: 1-5ms
- **Large cascade** (50 nodes): 5-15ms
- **Time-varying updates**: 1-3ms

Target: 60fps with room to spare.

---

## Debugging Reactive Updates

```
> debug reactive

REACTIVE DEBUG MODE: ON

[16:42:15.001] TICK START
[16:42:15.002] Time-varying: 12 nodes updated
[16:42:15.003] Dirty: sensor.o2_galley (time-varying)
[16:42:15.003] Dirty: signal.atmo.critical (depends on sensor.o2_galley)
[16:42:15.004] Evaluate: sensor.o2_galley
  - reading: 18.2 → 18.1
  - threshold check: 18.1 < 19 → trigger warning
[16:42:15.004] Evaluate: signal.atmo.critical
  - condition: o2 < 16% → false (18.1%)
  - state unchanged: INACTIVE
[16:42:15.005] Dirty set empty
[16:42:15.005] TICK END (4ms)
```
