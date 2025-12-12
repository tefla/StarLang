# Compiler

## Overview

The compiler transforms the AST into runtime structures:

1. **Validation**: Check types, references, constraints
2. **Resolution**: Resolve all cross-file references
3. **Transformation**: Convert AST nodes to NodeDefinitions
4. **Graph Building**: Construct the signal dependency graph

---

## Compilation Pipeline

```
     AST (from parser)
           │
           ▼
    ┌─────────────┐
    │  Validator  │ ─── Type checking, constraint checking
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  Resolver   │ ─── Resolve cross-file references
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Transformer │ ─── AST → NodeDefinitions
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Graph Builder│ ─── Build signal dependency graph
    └──────┬──────┘
           │
           ▼
    NodeDefinitions + SignalGraph
```

---

## Validation

The validator checks that the AST is semantically correct.

### Type Checking

Each node type has expected properties with expected types:

```typescript
const NODE_SCHEMAS: Record<string, PropertySchema[]> = {
  'room': [
    { name: 'display_name', type: 'string', required: true },
    { name: 'deck', type: 'number', required: true },
    { name: 'section', type: 'number', required: false },
    { name: 'adjacent', type: 'reference[]', required: false },
    { name: 'capacity', type: 'number', required: false },
    { name: 'environment', type: 'object', required: false },
  ],
  
  'door': [
    { name: 'connects', type: 'reference[]', required: true, length: 2 },
    { name: 'type', type: 'enum', values: ['SLIDING', 'HATCH', 'BLAST', 'AIRLOCK'] },
    { name: 'lock', type: 'enum', values: ['NONE', 'STANDARD', 'SECURITY', 'EMERGENCY_SEAL'] },
    { name: 'power_source', type: 'reference', required: false },
    { name: 'access', type: 'permission', required: false },
    { name: 'seal_on', type: 'signal_condition', required: false },
    { name: 'unseal_requires', type: 'permission', required: false },
  ],
  
  // ... more schemas
}

function validateDeclaration(decl: DeclarationNode): ValidationError[] {
  const errors: ValidationError[] = []
  const schema = NODE_SCHEMAS[decl.nodeType]
  
  if (!schema) {
    errors.push({
      message: `Unknown node type '${decl.nodeType}'`,
      line: decl.line
    })
    return errors
  }
  
  // Check required properties
  for (const prop of schema.filter(p => p.required)) {
    const found = decl.properties.find(p => p.name === prop.name)
    if (!found) {
      errors.push({
        message: `Missing required property '${prop.name}'`,
        line: decl.line
      })
    }
  }
  
  // Check property types
  for (const prop of decl.properties) {
    const schemaEntry = schema.find(s => s.name === prop.name)
    
    if (!schemaEntry) {
      errors.push({
        message: `Unknown property '${prop.name}' for ${decl.nodeType}`,
        line: prop.line,
        suggestion: suggestSimilar(prop.name, schema.map(s => s.name))
      })
      continue
    }
    
    const typeError = validateType(prop.value, schemaEntry.type)
    if (typeError) {
      errors.push({
        message: `Property '${prop.name}': ${typeError}`,
        line: prop.line
      })
    }
  }
  
  return errors
}
```

### Reference Validation

All references must resolve to existing nodes:

```typescript
function validateReferences(
  ast: FileNode, 
  allDeclarations: Map<string, DeclarationNode>
): ValidationError[] {
  const errors: ValidationError[] = []
  
  // Walk the AST looking for references
  walkAST(ast, (node) => {
    if (node.type === 'Reference') {
      const refPath = (node as ReferenceNode).path.join('.')
      
      // Check if reference resolves
      if (!resolves(refPath, allDeclarations)) {
        errors.push({
          message: `Unresolved reference '${refPath}'`,
          line: node.line,
          suggestion: suggestSimilarNode(refPath, allDeclarations)
        })
      }
    }
  })
  
  return errors
}

function resolves(
  path: string, 
  declarations: Map<string, DeclarationNode>
): boolean {
  // Check namespaces
  for (const [namespace, prefix] of Object.entries(NAMESPACES)) {
    if (path.startsWith(namespace + '.')) {
      const resolved = prefix + path.slice(namespace.length)
      if (declarations.has(resolved)) return true
    }
  }
  
  // Check direct reference
  if (declarations.has(path)) return true
  
  // Check as property path (node.property)
  const parts = path.split('.')
  if (parts.length >= 2) {
    const nodeId = parts[0]
    if (declarations.has(nodeId)) {
      // Could validate property exists, but that requires type info
      return true
    }
  }
  
  return false
}
```

### Constraint Validation

Some properties have additional constraints:

```typescript
function validateConstraints(decl: DeclarationNode): ValidationError[] {
  const errors: ValidationError[] = []
  
  switch (decl.nodeType) {
    case 'door':
      // 'connects' must have exactly 2 elements
      const connects = decl.properties.find(p => p.name === 'connects')
      if (connects && connects.value.type === 'List') {
        if (connects.value.elements.length !== 2) {
          errors.push({
            message: `'connects' must have exactly 2 rooms`,
            line: connects.line
          })
        }
      }
      break
      
    case 'sensor':
      // Sample rate must be positive
      const rate = decl.properties.find(p => p.name === 'sample_rate')
      if (rate && rate.value.type === 'Literal') {
        const value = parseUnitValue(rate.value.value)
        if (value <= 0) {
          errors.push({
            message: `'sample_rate' must be positive`,
            line: rate.line
          })
        }
      }
      break
  }
  
  return errors
}
```

---

## Resolution

The resolver handles cross-file references.

### Namespace Resolution

```typescript
const NAMESPACES: Record<string, string> = {
  'atmo': '/ship/systems/atmo.',
  'power': '/ship/systems/power.',
  'alert': '/ship/systems/alerts.',
  'safety': '/ship/systems/safety.',
  'signal': ''  // Signals are global
}

function resolveReference(
  ref: ReferenceNode,
  currentFile: string,
  allDefs: Map<string, NodeDefinition>
): string {
  const path = ref.path.join('.')
  
  // Try namespace resolution
  for (const [ns, prefix] of Object.entries(NAMESPACES)) {
    if (path.startsWith(ns + '.')) {
      const resolved = prefix + path.slice(ns.length + 1)
      if (allDefs.has(resolved)) {
        return resolved
      }
    }
  }
  
  // Try relative to current file
  const dir = dirname(currentFile)
  const relative = `${dir}/${path}`
  if (allDefs.has(relative)) {
    return relative
  }
  
  // Try absolute
  if (allDefs.has(path)) {
    return path
  }
  
  throw new Error(`Cannot resolve reference: ${path}`)
}
```

### Dependency Collection

Track which files depend on which:

```typescript
interface FileDependencies {
  file: string
  imports: string[]    // Files this file references
  exports: string[]    // Node IDs defined in this file
}

function collectDependencies(
  file: string, 
  ast: FileNode
): FileDependencies {
  const imports = new Set<string>()
  const exports: string[] = []
  
  for (const decl of ast.declarations) {
    exports.push(decl.id)
    
    // Walk declaration for references
    walkAST(decl, (node) => {
      if (node.type === 'Reference') {
        const ref = node as ReferenceNode
        const resolved = resolveToFile(ref.path.join('.'))
        if (resolved && resolved !== file) {
          imports.add(resolved)
        }
      }
    })
  }
  
  return {
    file,
    imports: [...imports],
    exports
  }
}
```

---

## Transformation

Convert AST nodes to runtime NodeDefinitions.

```typescript
function transformDeclaration(
  decl: DeclarationNode,
  context: TransformContext
): NodeDefinition {
  const properties: Record<string, any> = {}
  const triggers: TriggerDefinition[] = []
  const actions: Record<string, ActionBlock> = {}
  const connections: string[] = []
  
  for (const prop of decl.properties) {
    // Handle special properties
    if (prop.name.startsWith('on_')) {
      // Action handler
      actions[prop.name] = transformActionBlock(prop.value as ActionBlockNode)
    }
    else if (prop.name === 'seal_on' || prop.name === 'trigger') {
      // Trigger definition
      triggers.push({
        event: prop.name,
        condition: transformCondition(prop.value as ConditionNode)
      })
    }
    else if (isConnectionProperty(prop.name)) {
      // Track connections for signal graph
      const refs = extractReferences(prop.value)
      connections.push(...refs)
      properties[prop.name] = transformValue(prop.value, context)
    }
    else {
      // Regular property
      properties[prop.name] = transformValue(prop.value, context)
    }
  }
  
  return {
    id: decl.id,
    type: mapNodeType(decl.nodeType),
    subtype: decl.subtype,
    properties,
    connections,
    triggers,
    actions,
    permissions: context.filePermissions
  }
}

function transformValue(
  value: ValueNode, 
  context: TransformContext
): any {
  switch (value.type) {
    case 'Literal':
      if (value.unit) {
        return { value: value.value, unit: value.unit }
      }
      return value.value
      
    case 'List':
      return value.elements.map(e => transformValue(e, context))
      
    case 'Object':
      const obj: Record<string, any> = {}
      for (const prop of value.properties) {
        obj[prop.name] = transformValue(prop.value, context)
      }
      return obj
      
    case 'Reference':
      return resolveReference(value, context.currentFile, context.allDefs)
      
    case 'Condition':
      return transformCondition(value)
      
    case 'ActionBlock':
      return transformActionBlock(value)
      
    default:
      throw new Error(`Unknown value type: ${value.type}`)
  }
}

function transformCondition(cond: ConditionNode): Condition {
  switch (cond.operator) {
    case 'AND':
      return { type: 'AND', operands: cond.operands!.map(transformCondition) }
    case 'OR':
      return { type: 'OR', operands: cond.operands!.map(transformCondition) }
    case 'NOT':
      return { type: 'NOT', operand: transformCondition(cond.operands![0]) }
    case 'ANY':
      return { type: 'ANY', conditions: cond.operands!.map(transformCondition) }
    case 'ALL':
      return { type: 'ALL', conditions: cond.operands!.map(transformCondition) }
    case 'COMPARE':
      return {
        type: 'COMPARISON',
        left: transformExpr(cond.left!),
        op: cond.compareOp!,
        right: transformExpr(cond.right!)
      }
    default:
      throw new Error(`Unknown condition operator: ${cond.operator}`)
  }
}
```

---

## Graph Building

Build the signal dependency graph from definitions.

```typescript
function buildSignalGraph(
  definitions: Map<string, NodeDefinition>
): SignalGraph {
  const graph = new SignalGraph()
  
  for (const [id, def] of definitions) {
    // Add node to graph
    graph.addNode(id)
    
    // Add dependencies from connections
    for (const conn of def.connections) {
      graph.addDependency(conn, id)  // id depends on conn
    }
    
    // Add signal listeners from triggers
    for (const trigger of def.triggers) {
      const signals = extractSignalsFromCondition(trigger.condition)
      for (const signal of signals) {
        graph.addListener(signal, id)
      }
    }
    
    // Add signal emitters from actions
    for (const action of Object.values(def.actions)) {
      const signals = extractEmittedSignals(action)
      for (const signal of signals) {
        graph.addEmitter(id, signal)
      }
    }
  }
  
  // Validate: check for circular dependencies that could cause infinite loops
  graph.validateNoCycles()
  
  return graph
}

function extractSignalsFromCondition(cond: Condition): string[] {
  const signals: string[] = []
  
  switch (cond.type) {
    case 'SIGNAL':
      signals.push(cond.signalId)
      break
    case 'AND':
    case 'OR':
    case 'ANY':
    case 'ALL':
      for (const operand of cond.operands || cond.conditions || []) {
        signals.push(...extractSignalsFromCondition(operand))
      }
      break
  }
  
  return signals
}
```

---

## Compile Result

The compiler produces:

```typescript
interface CompileResult {
  success: boolean
  definitions?: Map<string, NodeDefinition>
  signalGraph?: SignalGraph
  errors: CompileError[]
  warnings: CompileWarning[]
}

interface CompileError {
  file: string
  line: number
  column: number
  message: string
  suggestion?: string
}

interface CompileWarning {
  file: string
  line: number
  message: string
}
```

---

## Incremental Compilation

For hot-reloading, only recompile changed files:

```typescript
function incrementalCompile(
  changedFile: string,
  newContent: string,
  existingDefs: Map<string, NodeDefinition>
): IncrementalCompileResult {
  // Parse just the changed file
  const tokens = new Lexer(newContent).tokenize()
  const parseResult = new Parser(tokens).parse()
  
  if (parseResult.errors.length > 0) {
    return { success: false, errors: parseResult.errors }
  }
  
  // Validate with knowledge of existing definitions
  const validationErrors = validate(parseResult.ast, existingDefs, changedFile)
  
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors }
  }
  
  // Transform just this file's declarations
  const newDefs = new Map<string, NodeDefinition>()
  for (const decl of parseResult.ast.declarations) {
    const def = transformDeclaration(decl, {
      currentFile: changedFile,
      allDefs: existingDefs,
      filePermissions: parseResult.ast.permissions
    })
    newDefs.set(def.id, def)
  }
  
  return {
    success: true,
    definitions: newDefs,
    affectedNodes: [...newDefs.keys()]
  }
}
```
