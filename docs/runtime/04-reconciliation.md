# Reconciliation

## The Problem

When the player edits a StarLang file, we need to:

1. Parse and compile the new version
2. Update the runtime to use new definitions
3. **Preserve existing state**

That last point is crucial. If the player has been running the ship for 20 minutes and the O2 is at 18%, editing a file shouldn't reset O2 to 100%. The door they opened should stay open. The temperature they adjusted should stay adjusted.

---

## The Reconciliation Process

```
┌─────────────────────────────────────────────────────────────────┐
│                     RECONCILIATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Player edits file                                             │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────┐                                               │
│   │   Parse     │──── Syntax errors? ────► Show errors, abort   │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────┐                                               │
│   │  Validate   │──── Semantic errors? ──► Show errors, abort   │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────┐                                               │
│   │   Diff      │ Compare old defs to new defs                  │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ├──► New nodes ────────► Initialize with default state │
│          │                                                      │
│          ├──► Modified nodes ───► Update def, preserve state    │
│          │                                                      │
│          ├──► Deleted nodes ────► Remove from runtime           │
│          │                                                      │
│          └──► Unchanged nodes ──► No action                     │
│                                                                 │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────┐                                               │
│   │  Rewire     │ Update signal graph connections               │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────┐                                               │
│   │  Commit     │ Save to version control                       │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   Ship continues running with new definitions                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Diffing Definitions

The first step is understanding what changed.

```
interface DefinitionDiff {
  added: NodeDefinition[]      // New nodes
  removed: string[]            // Deleted node IDs
  modified: ModifiedNode[]     // Changed nodes
  unchanged: string[]          // Untouched nodes
}

interface ModifiedNode {
  id: string
  oldDef: NodeDefinition
  newDef: NodeDefinition
  changes: PropertyChange[]
}

interface PropertyChange {
  property: string
  oldValue: any
  newValue: any
  affectsState: boolean       // Does this change require state update?
  affectsConnections: boolean // Does this change affect signal graph?
}
```

### Computing the Diff

```
function diffDefinitions(
  oldDefs: Map<string, NodeDefinition>,
  newDefs: Map<string, NodeDefinition>
): DefinitionDiff {
  const diff: DefinitionDiff = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  }
  
  // Find added and modified
  for (const [id, newDef] of newDefs) {
    const oldDef = oldDefs.get(id)
    
    if (!oldDef) {
      diff.added.push(newDef)
    }
    else if (!deepEqual(oldDef, newDef)) {
      diff.modified.push({
        id,
        oldDef,
        newDef,
        changes: computePropertyChanges(oldDef, newDef)
      })
    }
    else {
      diff.unchanged.push(id)
    }
  }
  
  // Find removed
  for (const id of oldDefs.keys()) {
    if (!newDefs.has(id)) {
      diff.removed.push(id)
    }
  }
  
  return diff
}
```

---

## Handling Each Case

### New Nodes

Create fresh state with default values.

```
function handleAddedNodes(added: NodeDefinition[]): void {
  for (const def of added) {
    // Initialize state
    const state = initializeState(def)
    stateStore.set(def.id, state)
    
    // Add to definition store
    definitionStore.set(def.id, def)
    
    // Add to signal graph
    signalGraph.addNode(def)
    
    // Mark for initial evaluation
    dirtyTracker.mark(def.id)
    
    log(`Node added: ${def.id}`)
  }
}
```

### Removed Nodes

Clean up state and connections.

```
function handleRemovedNodes(removed: string[]): void {
  for (const id of removed) {
    // Remove from state store
    stateStore.delete(id)
    
    // Remove from definition store
    definitionStore.delete(id)
    
    // Remove from signal graph
    signalGraph.removeNode(id)
    
    // Cancel any pending timers
    timerStore.cancelForNode(id)
    
    log(`Node removed: ${id}`)
  }
}
```

### Modified Nodes

This is the tricky part. Update the definition while preserving state.

```
function handleModifiedNodes(modified: ModifiedNode[]): void {
  for (const mod of modified) {
    // Update definition
    definitionStore.set(mod.id, mod.newDef)
    
    // Get current state
    const state = stateStore.get(mod.id)
    
    // Check each change
    for (const change of mod.changes) {
      if (change.affectsState) {
        // Some definition changes might need state updates
        handleStateAffectingChange(mod.id, state, change)
      }
      
      if (change.affectsConnections) {
        // Rewire signal graph
        signalGraph.rewireNode(mod.id, mod.newDef)
      }
    }
    
    // Mark for re-evaluation
    dirtyTracker.mark(mod.id)
    
    log(`Node modified: ${mod.id}`)
  }
}
```

### State-Affecting Changes

Most definition changes don't affect state. But some do:

```
function handleStateAffectingChange(
  id: string, 
  state: NodeState, 
  change: PropertyChange
): void {
  // Example: If a door's lock type changes from NONE to SECURITY,
  // and the door is currently OPEN, it might need to close
  
  if (change.property === 'lock') {
    if (change.newValue !== 'NONE' && state.values.state === 'OPEN') {
      // Don't force close, but log a warning
      log(`Warning: ${id} lock changed while door open`)
    }
  }
  
  // Example: If a sensor's threshold changes, re-evaluate
  if (change.property === 'threshold') {
    // The next evaluation will use the new threshold
    // No immediate state change needed
  }
  
  // Example: If target of an outlet changes
  if (change.property === 'target') {
    // This affects signal graph connections
    // State (flow rate) stays the same
    // But the signal graph needs rewiring
  }
}
```

---

## Signal Graph Rewiring

When connections change, the signal graph must update.

```
function rewireNode(nodeId: string, newDef: NodeDefinition): void {
  // Remove old connections
  this.dependencies.delete(nodeId)
  this.removeListenerReferences(nodeId)
  this.removeEmitterReferences(nodeId)
  
  // Add new connections based on new definition
  const refs = extractReferences(newDef)
  for (const ref of refs) {
    this.addDependency(ref, nodeId)
  }
  
  const signals = extractSignalListeners(newDef)
  for (const signal of signals) {
    this.addListener(signal, nodeId)
  }
  
  const emits = extractSignalEmitters(newDef)
  for (const signal of emits) {
    this.addEmitter(nodeId, signal)
  }
}
```

---

## Error Handling

If compilation fails, the ship keeps running with old definitions.

```
function attemptRecompile(file: string, newContent: string): RecompileResult {
  // Parse
  const parseResult = parse(newContent)
  if (parseResult.errors.length > 0) {
    return {
      success: false,
      phase: 'PARSE',
      errors: parseResult.errors,
      message: 'Syntax errors - file not applied'
    }
  }
  
  // Validate
  const validateResult = validate(parseResult.ast, definitionStore)
  if (validateResult.errors.length > 0) {
    return {
      success: false,
      phase: 'VALIDATE',
      errors: validateResult.errors,
      message: 'Validation errors - file not applied'
    }
  }
  
  // Compile
  const compileResult = compile(parseResult.ast)
  if (compileResult.errors.length > 0) {
    return {
      success: false,
      phase: 'COMPILE',
      errors: compileResult.errors,
      message: 'Compilation errors - file not applied'
    }
  }
  
  // All good - reconcile
  const diff = diffDefinitions(currentDefs, compileResult.definitions)
  reconcile(diff)
  
  // Commit to version control
  slvc.commit(file, newContent, 'User edit')
  
  return {
    success: true,
    diff: diff,
    message: `Applied: +${diff.added.length} -${diff.removed.length} ~${diff.modified.length}`
  }
}
```

---

## What Persists vs What Resets

### Always Persists

| State | Why |
|-------|-----|
| O2 levels | Physical reality doesn't change with code |
| Temperatures | Same |
| Door positions | Player opened it, it stays open |
| Player location | Obviously |
| Sensor readings | Physical measurements |
| Power levels | Resource continuity |

### Resets on Node Recreation

| State | Why |
|-------|-----|
| Relay fired flags | If relay definition changed, reset tracking |
| Timer state | Timers may have changed |
| Fault flags | Give the player a fresh start on the fix |

### Definition-Dependent

| State | Behaviour |
|-------|-----------|
| Sealed doors | If seal_on signal still active, stays sealed |
| Alert states | Re-evaluated against new conditions |
| Signal states | Re-evaluated against new triggers |

---

## Example: The O2 Fix

The player's first edit: changing `target: VOID.external` to `target: galley_intake`.

**Before Edit:**
```
galley_outlet definition:
  target: VOID.external
  
galley_outlet state:
  flow_rate: 2.4
  status: ACTIVE
  
galley state:
  o2_level: 18.2%
```

**Edit Applied:**
```
Diff:
  modified: galley_outlet
    target: VOID.external → galley_intake
    (affectsConnections: true)

Reconciliation:
  1. Update galley_outlet definition
  2. Rewire signal graph (outlet now targets galley_intake)
  3. Preserve state (flow_rate: 2.4, status: ACTIVE)
  4. Preserve galley state (o2_level: 18.2%)
```

**After Edit:**
```
galley_outlet definition:
  target: galley_intake  ← Changed
  
galley_outlet state:
  flow_rate: 2.4         ← Preserved
  status: ACTIVE         ← Preserved
  
galley state:
  o2_level: 18.2%        ← Preserved (will now stabilize!)
```

The O2 level doesn't magically refill—it just stops dropping because the outlet is no longer venting to space.

---

## Reconciliation Events

The UI can subscribe to reconciliation events:

```
runtime.on('reconcile', (event) => {
  switch (event.type) {
    case 'NODE_ADDED':
      showNotification(`New node: ${event.node.display_name}`)
      break
    case 'NODE_REMOVED':
      showNotification(`Removed: ${event.nodeId}`)
      break
    case 'NODE_MODIFIED':
      // Maybe highlight the node briefly
      break
    case 'COMPILE_ERROR':
      showErrorPanel(event.errors)
      break
  }
})
```
