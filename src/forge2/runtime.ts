/**
 * Forge 2.0 Runtime
 *
 * Event-driven execution engine with closures and reactive state.
 * The engine provides only: event loop, state management, and evaluation.
 */

import type {
  Program,
  Statement,
  Expression,
  BlockStatement,
  ForgeValue,
  ForgeMap,
  ForgeFunction,
  ForgeSchema,
  ForgeInstance,
  Environment,
  EventHandler,
  Parameter,
  LetStatement,
  SetStatement,
  FunctionDeclaration,
  IfStatement,
  ForStatement,
  WhileStatement,
  MatchStatement,
  ReturnStatement,
  OnStatement,
  EmitStatement,
  ExpressionStatement,
  SchemaDeclaration,
  InstanceDeclaration,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  Identifier,
  ListLiteral,
  MapLiteral,
  VectorLiteral,
  MemberExpression,
  CallExpression,
  BinaryExpression,
  UnaryExpression,
  ConditionalExpression,
  ArrowFunction,
  ReactiveRef,
  Pattern,
  ColorLiteral,
} from './types'
import { createStdlibBindings } from './stdlib'

// ============================================================================
// Return Signal (for early returns)
// ============================================================================

class ReturnSignal {
  constructor(public value: ForgeValue) {}
}

// ============================================================================
// Runtime Class
// ============================================================================

export class Runtime {
  /** Global environment */
  private globalEnv: Environment

  /** Registered event handlers */
  private eventHandlers: Map<string, EventHandler[]> = new Map()

  /** Schema definitions */
  private schemas: Map<string, ForgeSchema> = new Map()

  /** Event queue for deferred processing */
  private eventQueue: Array<{ event: string; data: ForgeMap }> = []

  /** Whether we're currently processing events */
  private processing: boolean = false

  /** External event listeners (for integration with game engine) */
  private externalListeners: Map<string, Array<(data: ForgeMap) => void>> = new Map()

  /** Track which file each handler came from (for hot-reload) */
  private handlersByFile: Map<string, EventHandler[]> = new Map()

  /** Track which file each instance came from (for hot-reload) */
  private instancesByFile: Map<string, string[]> = new Map()

  /** Current file being executed (for tracking) */
  private currentFile: string | null = null

  /** Track runtime-mutated fields per instance (for hot-reload state preservation) */
  private mutatedFields: Map<string, Set<string>> = new Map()

  constructor() {
    this.globalEnv = this.createGlobalEnvironment()
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Execute a program.
   * @param program The parsed program AST
   * @param filename Optional filename for hot-reload tracking
   */
  execute(program: Program, filename?: string): void {
    this.currentFile = filename ?? null

    // Process imports first (TODO: module loading)
    // for (const imp of program.imports) { ... }

    // Execute all statements
    for (const stmt of program.body) {
      this.executeStatement(stmt, this.globalEnv)
    }

    this.currentFile = null
  }

  /**
   * Hot-reload a file: clear its handlers/definitions, re-execute.
   * Instance STATE is preserved - only definitions are updated.
   */
  reload(program: Program, filename: string): void {
    // 1. Remove event handlers from this file
    const oldHandlers = this.handlersByFile.get(filename) ?? []
    for (const handler of oldHandlers) {
      const handlers = this.eventHandlers.get(handler.event)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index >= 0) handlers.splice(index, 1)
      }
    }
    this.handlersByFile.delete(filename)

    // 2. For instances from this file, preserve their current state
    const instanceNames = this.instancesByFile.get(filename) ?? []
    const preservedState = new Map<string, ForgeMap>()
    for (const name of instanceNames) {
      const instance = this.globalEnv.bindings.get(name)
      if (instance && typeof instance === 'object' && '__type' in instance && instance.__type === 'instance') {
        // Save the current data (state)
        preservedState.set(name, { ...(instance as ForgeInstance).data })
      }
      // Remove the old instance (will be recreated)
      this.globalEnv.bindings.delete(name)
    }
    this.instancesByFile.delete(filename)

    // 3. Re-execute the file
    this.execute(program, filename)

    // 4. Restore preserved state to new instances
    // Only restore MUTATED fields (runtime state), not file definition values
    for (const [name, oldData] of preservedState) {
      const newInstance = this.globalEnv.bindings.get(name)
      if (newInstance && typeof newInstance === 'object' && '__type' in newInstance && newInstance.__type === 'instance') {
        const inst = newInstance as ForgeInstance

        // Get fields that were mutated at runtime
        const mutatedFields = oldData.__mutatedFields as Set<string> | undefined

        if (mutatedFields) {
          // Only restore fields that were mutated at runtime
          for (const key of mutatedFields) {
            if (key in oldData && typeof inst.data[key] !== 'function') {
              inst.data[key] = oldData[key]
            }
          }
          // Preserve the mutation tracking
          inst.data.__mutatedFields = mutatedFields
        }
      }
    }

    // 5. Emit reload event so game can react
    this.emit('file:reloaded', { filename })
  }

  /**
   * Emit an event (can be called from external code).
   */
  emit(event: string, data: ForgeMap = {}): void {
    // Debug: log sound and game events
    if (event.startsWith('sound:') || event.startsWith('game:')) {
      console.log('[Runtime] Emitting:', event)
    }
    this.eventQueue.push({ event, data })

    if (!this.processing) {
      this.processEventQueue()
    }
  }

  /**
   * Register an external listener for events.
   */
  onEvent(event: string, listener: (data: ForgeMap) => void): () => void {
    console.log('[Runtime] Registering listener for:', event)
    if (!this.externalListeners.has(event)) {
      this.externalListeners.set(event, [])
    }
    this.externalListeners.get(event)!.push(listener)

    // Return unsubscribe function
    return () => {
      const listeners = this.externalListeners.get(event)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index >= 0) listeners.splice(index, 1)
      }
    }
  }

  /**
   * Get a global value.
   */
  get(name: string): ForgeValue {
    return this.lookup(name, this.globalEnv)
  }

  /**
   * Set a global value.
   */
  set(name: string, value: ForgeValue): void {
    this.globalEnv.bindings.set(name, value)
  }

  /**
   * Update (tick) - call this each frame.
   */
  tick(dt: number): void {
    this.emit('tick', { dt })
  }

  /**
   * Get all registered schemas.
   */
  getSchemas(): Map<string, ForgeSchema> {
    return new Map(this.schemas)
  }

  /**
   * Get global environment for inspection.
   */
  getGlobals(): Map<string, ForgeValue> {
    return new Map(this.globalEnv.bindings)
  }

  // ==========================================================================
  // Event Processing
  // ==========================================================================

  private processEventQueue(): void {
    this.processing = true

    while (this.eventQueue.length > 0) {
      const { event, data } = this.eventQueue.shift()!

      // Notify external listeners first
      const externalListeners = this.externalListeners.get(event)
      if (event.startsWith('sound:')) {
        console.log('[Runtime] Processing sound event:', event, 'listeners:', externalListeners?.length ?? 0)
      }
      if (externalListeners) {
        for (const listener of externalListeners) {
          listener(data)
        }
      }

      // Also notify wildcard listeners
      const wildcardListeners = this.externalListeners.get('*')
      if (wildcardListeners) {
        for (const listener of wildcardListeners) {
          listener({ ...data, __event: event })
        }
      }

      // Process internal handlers
      const handlers = this.eventHandlers.get(event) || []
      for (const handler of handlers) {
        // Check condition if present
        if (handler.condition) {
          const condEnv = this.createChildEnv(handler.environment)
          condEnv.bindings.set('event', data)
          const condResult = this.evaluate(handler.condition, condEnv)
          if (!this.isTruthy(condResult)) continue
        }

        // Execute handler
        const handlerEnv = this.createChildEnv(handler.environment)
        handlerEnv.bindings.set('event', data)

        try {
          this.executeBlock(handler.body, handlerEnv)
        } catch (e) {
          if (e instanceof ReturnSignal) {
            // Return in event handler just exits the handler
          } else {
            throw e
          }
        }
      }
    }

    this.processing = false
  }

  // ==========================================================================
  // Statement Execution
  // ==========================================================================

  private executeStatement(stmt: Statement, env: Environment): void {
    switch (stmt.type) {
      case 'LetStatement':
        this.executeLet(stmt, env)
        break
      case 'SetStatement':
        this.executeSet(stmt, env)
        break
      case 'FunctionDeclaration':
        this.executeFunction(stmt, env)
        break
      case 'IfStatement':
        this.executeIf(stmt, env)
        break
      case 'ForStatement':
        this.executeFor(stmt, env)
        break
      case 'WhileStatement':
        this.executeWhile(stmt, env)
        break
      case 'MatchStatement':
        this.executeMatch(stmt, env)
        break
      case 'ReturnStatement':
        this.executeReturn(stmt, env)
        break
      case 'OnStatement':
        this.executeOn(stmt, env)
        break
      case 'EmitStatement':
        this.executeEmit(stmt, env)
        break
      case 'ExpressionStatement':
        this.evaluate(stmt.expression, env)
        break
      case 'BlockStatement':
        this.executeBlock(stmt, env)
        break
      case 'SchemaDeclaration':
        this.executeSchema(stmt, env)
        break
      case 'InstanceDeclaration':
        this.executeInstance(stmt, env)
        break
      case 'ImportStatement':
        // TODO: Module loading
        break
      default:
        throw new Error(`Unknown statement type: ${(stmt as Statement).type}`)
    }
  }

  private executeLet(stmt: LetStatement, env: Environment): void {
    const value = this.evaluate(stmt.value, env)
    env.bindings.set(stmt.name, value)
  }

  private executeSet(stmt: SetStatement, env: Environment): void {
    const value = this.evaluate(stmt.value, env)

    if (stmt.target.type === 'Identifier') {
      // Simple assignment: set x: value
      this.assign(stmt.target.name, value, env)
    } else if (stmt.target.type === 'MemberExpression') {
      // Property assignment: set obj.prop: value
      this.assignMember(stmt.target, value, env)
    } else if (stmt.target.type === 'ReactiveRef') {
      // Reactive assignment: set $state.path: value
      this.assignReactive(stmt.target, value, env)
    } else {
      throw new Error(`Invalid set target: ${stmt.target.type}`)
    }
  }

  private executeFunction(stmt: FunctionDeclaration, env: Environment): void {
    const fn: ForgeFunction = {
      __type: 'function',
      name: stmt.name,
      params: stmt.params,
      body: stmt.body,
      closure: env,
    }
    env.bindings.set(stmt.name, fn)
  }

  private executeIf(stmt: IfStatement, env: Environment): void {
    const test = this.evaluate(stmt.test, env)

    if (this.isTruthy(test)) {
      this.executeBlock(stmt.consequent, this.createChildEnv(env))
    } else if (stmt.alternate) {
      if (stmt.alternate.type === 'BlockStatement') {
        this.executeBlock(stmt.alternate, this.createChildEnv(env))
      } else {
        // elif chain
        this.executeIf(stmt.alternate, env)
      }
    }
  }

  private executeFor(stmt: ForStatement, env: Environment): void {
    const iterable = this.evaluate(stmt.iterable, env)

    if (!Array.isArray(iterable)) {
      throw new Error('For loop requires an iterable (list)')
    }

    for (const item of iterable) {
      const loopEnv = this.createChildEnv(env)
      loopEnv.bindings.set(stmt.variable, item)
      this.executeBlock(stmt.body, loopEnv)
    }
  }

  private executeWhile(stmt: WhileStatement, env: Environment): void {
    while (this.isTruthy(this.evaluate(stmt.test, env))) {
      this.executeBlock(stmt.body, this.createChildEnv(env))
    }
  }

  private executeMatch(stmt: MatchStatement, env: Environment): void {
    const value = this.evaluate(stmt.discriminant, env)

    for (const matchCase of stmt.cases) {
      const caseEnv = this.createChildEnv(env)

      if (this.matchPattern(matchCase.pattern, value, caseEnv)) {
        // Check guard if present
        if (matchCase.guard) {
          if (!this.isTruthy(this.evaluate(matchCase.guard, caseEnv))) {
            continue
          }
        }

        this.executeBlock(matchCase.body, caseEnv)
        return
      }
    }
  }

  private executeReturn(stmt: ReturnStatement, env: Environment): void {
    const value = stmt.argument ? this.evaluate(stmt.argument, env) : null
    throw new ReturnSignal(value)
  }

  private executeOn(stmt: OnStatement, env: Environment): void {
    const event = this.evaluate(stmt.event, env)
    if (typeof event !== 'string') {
      throw new Error('Event name must be a string')
    }

    const handler: EventHandler = {
      event,
      condition: stmt.condition,
      body: stmt.body,
      environment: env,
    }

    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)

    // Track handler by source file for hot-reload
    if (this.currentFile) {
      if (!this.handlersByFile.has(this.currentFile)) {
        this.handlersByFile.set(this.currentFile, [])
      }
      this.handlersByFile.get(this.currentFile)!.push(handler)
    }
  }

  private executeEmit(stmt: EmitStatement, env: Environment): void {
    const event = this.evaluate(stmt.event, env)
    if (typeof event !== 'string') {
      throw new Error('Event name must be a string')
    }

    const data = stmt.data ? (this.evaluate(stmt.data, env) as ForgeMap) : {}
    this.emit(event, data)
  }

  private executeBlock(block: BlockStatement, env: Environment): void {
    for (const stmt of block.body) {
      this.executeStatement(stmt, env)
    }
  }

  private executeSchema(stmt: SchemaDeclaration, env: Environment): void {
    const methods = new Map<string, ForgeFunction>()

    for (const method of stmt.methods) {
      methods.set(method.name, {
        __type: 'function',
        name: method.name,
        params: method.params,
        body: method.body,
        closure: env,
      })
    }

    const schema: ForgeSchema = {
      __type: 'schema',
      name: stmt.name,
      extends: stmt.extends,
      fields: stmt.fields,
      methods,
    }

    this.schemas.set(stmt.name, schema)
    env.bindings.set(stmt.name, schema)
  }

  private executeInstance(stmt: InstanceDeclaration, env: Environment): void {
    const schema = this.schemas.get(stmt.schema)
    if (!schema) {
      throw new Error(`Unknown schema: ${stmt.schema}`)
    }

    // Build instance data
    const data: ForgeMap = {}

    // Apply defaults from schema
    for (const field of schema.fields) {
      if (field.defaultValue) {
        data[field.name] = this.evaluate(field.defaultValue, env)
      }
    }

    // Apply provided values
    for (const entry of stmt.fields) {
      const key = entry.key.type === 'Identifier' ? entry.key.name : this.evaluate(entry.key, env)
      if (typeof key !== 'string') {
        throw new Error('Instance field keys must be strings')
      }
      data[key] = this.evaluate(entry.value, env)
    }

    // Validate required fields
    for (const field of schema.fields) {
      if (field.required && !(field.name in data)) {
        throw new Error(`Missing required field "${field.name}" in ${stmt.schema} instance "${stmt.name}"`)
      }
    }

    // Create instance with methods bound
    const instance: ForgeInstance = {
      __type: 'instance',
      schema: stmt.schema,
      data,
    }

    // Add methods to data (bound to instance)
    for (const [methodName, method] of schema.methods) {
      data[methodName] = this.bindMethod(method, instance)
    }

    env.bindings.set(stmt.name, instance)

    // Track instance by source file for hot-reload
    if (this.currentFile) {
      if (!this.instancesByFile.has(this.currentFile)) {
        this.instancesByFile.set(this.currentFile, [])
      }
      this.instancesByFile.get(this.currentFile)!.push(stmt.name)
    }
  }

  // ==========================================================================
  // Expression Evaluation
  // ==========================================================================

  private evaluate(expr: Expression, env: Environment): ForgeValue {
    switch (expr.type) {
      case 'NumberLiteral':
        return expr.value
      case 'StringLiteral':
        return expr.value
      case 'BooleanLiteral':
        return expr.value
      case 'NullLiteral':
        return null
      case 'ColorLiteral':
        return '#' + expr.value
      case 'Identifier':
        return this.lookup(expr.name, env)
      case 'VectorLiteral':
        return expr.elements.map(e => this.evaluate(e, env))
      case 'ListLiteral':
        return expr.elements.map(e => this.evaluate(e, env))
      case 'MapLiteral':
        return this.evaluateMap(expr, env)
      case 'MemberExpression':
        return this.evaluateMember(expr, env)
      case 'CallExpression':
        return this.evaluateCall(expr, env)
      case 'BinaryExpression':
        return this.evaluateBinary(expr, env)
      case 'UnaryExpression':
        return this.evaluateUnary(expr, env)
      case 'ConditionalExpression':
        return this.evaluateConditional(expr, env)
      case 'ArrowFunction':
        return this.evaluateArrow(expr, env)
      case 'ReactiveRef':
        return this.evaluateReactive(expr, env)
      default:
        throw new Error(`Unknown expression type: ${(expr as Expression).type}`)
    }
  }

  private evaluateMap(expr: MapLiteral, env: Environment): ForgeMap {
    const result: ForgeMap = {}

    for (const entry of expr.entries) {
      const key = entry.key.type === 'Identifier'
        ? entry.key.name
        : this.evaluate(entry.key, env)

      if (typeof key !== 'string') {
        throw new Error('Map keys must be strings')
      }

      result[key] = this.evaluate(entry.value, env)
    }

    return result
  }

  private evaluateMember(expr: MemberExpression, env: Environment): ForgeValue {
    const object = this.evaluate(expr.object, env)

    if (object === null) {
      throw new Error('Cannot access property of null')
    }

    let key: string | number

    if (expr.computed) {
      const propValue = this.evaluate(expr.property, env)
      if (typeof propValue !== 'string' && typeof propValue !== 'number') {
        throw new Error('Property key must be a string or number')
      }
      key = propValue
    } else {
      if (expr.property.type !== 'Identifier') {
        throw new Error('Non-computed property access requires identifier')
      }
      key = expr.property.name
    }

    if (Array.isArray(object)) {
      if (typeof key === 'number') {
        return object[key] ?? null
      }
      // Array methods
      return this.getArrayMethod(object, key as string)
    }

    if (typeof object === 'object' && object !== null) {
      // Handle instance
      if ('__type' in object && object.__type === 'instance') {
        const instance = object as ForgeInstance
        return instance.data[key as string] ?? null
      }

      // Regular map
      return (object as ForgeMap)[key as string] ?? null
    }

    // String methods
    if (typeof object === 'string') {
      return this.getStringMethod(object, key as string)
    }

    throw new Error(`Cannot access property "${key}" on ${typeof object}`)
  }

  private evaluateCall(expr: CallExpression, env: Environment): ForgeValue {
    const callee = this.evaluate(expr.callee, env)
    const args = expr.arguments.map(arg => this.evaluate(arg, env))

    // Native function
    if (typeof callee === 'function') {
      return callee(...args)
    }

    // Forge function
    if (typeof callee === 'object' && callee !== null && '__type' in callee) {
      if (callee.__type === 'function') {
        return this.callFunction(callee as ForgeFunction, args)
      }
    }

    throw new Error(`${expr.callee.type} is not callable`)
  }

  private evaluateBinary(expr: BinaryExpression, env: Environment): ForgeValue {
    const left = this.evaluate(expr.left, env)
    const right = this.evaluate(expr.right, env)

    switch (expr.operator) {
      // Arithmetic
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right)
        }
        return (left as number) + (right as number)
      case '-':
        return (left as number) - (right as number)
      case '*':
        return (left as number) * (right as number)
      case '/':
        return (left as number) / (right as number)
      case '%':
        return (left as number) % (right as number)

      // Comparison
      case '<':
        return (left as number) < (right as number)
      case '>':
        return (left as number) > (right as number)
      case '<=':
        return (left as number) <= (right as number)
      case '>=':
        return (left as number) >= (right as number)
      case '==':
        return this.equals(left, right)
      case '!=':
        return !this.equals(left, right)

      // Logical
      case 'and':
        return this.isTruthy(left) && this.isTruthy(right)
      case 'or':
        return this.isTruthy(left) || this.isTruthy(right)

      default:
        throw new Error(`Unknown operator: ${expr.operator}`)
    }
  }

  private evaluateUnary(expr: UnaryExpression, env: Environment): ForgeValue {
    const value = this.evaluate(expr.argument, env)

    switch (expr.operator) {
      case '-':
        return -(value as number)
      case 'not':
        return !this.isTruthy(value)
      default:
        throw new Error(`Unknown unary operator: ${expr.operator}`)
    }
  }

  private evaluateConditional(expr: ConditionalExpression, env: Environment): ForgeValue {
    const test = this.evaluate(expr.test, env)
    return this.isTruthy(test)
      ? this.evaluate(expr.consequent, env)
      : this.evaluate(expr.alternate, env)
  }

  private evaluateArrow(expr: ArrowFunction, env: Environment): ForgeFunction {
    return {
      __type: 'function',
      params: expr.params,
      body: expr.body,
      closure: env,
    }
  }

  private evaluateReactive(expr: ReactiveRef, env: Environment): ForgeValue {
    // Start from global state
    let value: ForgeValue = this.globalEnv.bindings.get(expr.path[0]!) ?? null

    // Navigate path
    for (let i = 1; i < expr.path.length; i++) {
      if (value === null) return null

      const key = expr.path[i]!

      if (typeof value === 'object' && value !== null) {
        if ('__type' in value && value.__type === 'instance') {
          value = (value as ForgeInstance).data[key] ?? null
        } else if (Array.isArray(value)) {
          value = value[parseInt(key)] ?? null
        } else {
          value = (value as ForgeMap)[key] ?? null
        }
      } else {
        return null
      }
    }

    return value
  }

  // ==========================================================================
  // Function Calling
  // ==========================================================================

  private callFunction(fn: ForgeFunction, args: ForgeValue[]): ForgeValue {
    const callEnv = this.createChildEnv(fn.closure)

    // Bind parameters
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i]!
      const value = args[i] ?? (param.defaultValue
        ? this.evaluate(param.defaultValue, fn.closure)
        : null)
      callEnv.bindings.set(param.name, value)
    }

    // Execute body
    try {
      if ('type' in fn.body && fn.body.type === 'BlockStatement') {
        this.executeBlock(fn.body, callEnv)
        return null
      } else {
        // Arrow function with expression body
        return this.evaluate(fn.body as Expression, callEnv)
      }
    } catch (e) {
      if (e instanceof ReturnSignal) {
        return e.value
      }
      throw e
    }
  }

  private bindMethod(method: ForgeFunction, instance: ForgeInstance): ForgeFunction {
    return {
      ...method,
      closure: {
        parent: method.closure,
        bindings: new Map([['self', instance]]),
      },
    }
  }

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  private matchPattern(pattern: Pattern, value: ForgeValue, env: Environment): boolean {
    switch (pattern.type) {
      case 'WildcardPattern':
        return true

      case 'IdentifierPattern':
        env.bindings.set(pattern.name, value)
        return true

      case 'LiteralPattern':
        const litValue = this.evaluate(pattern.value, env)
        return this.equals(litValue, value)

      case 'ListPattern':
        if (!Array.isArray(value)) return false
        if (pattern.elements.length !== value.length) return false
        return pattern.elements.every((p, i) => this.matchPattern(p, value[i]!, env))

      case 'MapPattern':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
        const map = value as ForgeMap
        return pattern.entries.every(entry =>
          entry.key in map && this.matchPattern(entry.pattern, map[entry.key]!, env)
        )

      default:
        return false
    }
  }

  // ==========================================================================
  // Assignment Helpers
  // ==========================================================================

  private assign(name: string, value: ForgeValue, env: Environment): void {
    // Walk up the scope chain to find the binding
    let current: Environment | undefined = env
    while (current) {
      if (current.bindings.has(name)) {
        current.bindings.set(name, value)
        return
      }
      current = current.parent
    }

    // If not found, create in current scope
    env.bindings.set(name, value)
  }

  private assignMember(expr: MemberExpression, value: ForgeValue, env: Environment): void {
    const object = this.evaluate(expr.object, env)

    if (object === null) {
      throw new Error('Cannot assign to property of null')
    }

    let key: string | number

    if (expr.computed) {
      const propValue = this.evaluate(expr.property, env)
      if (typeof propValue !== 'string' && typeof propValue !== 'number') {
        throw new Error('Property key must be a string or number')
      }
      key = propValue
    } else {
      if (expr.property.type !== 'Identifier') {
        throw new Error('Non-computed property access requires identifier')
      }
      key = expr.property.name
    }

    if (Array.isArray(object)) {
      object[key as number] = value
    } else if (typeof object === 'object' && object !== null) {
      if ('__type' in object && object.__type === 'instance') {
        const inst = object as ForgeInstance
        inst.data[key as string] = value
        // Track this field as runtime-mutated (for hot-reload state preservation)
        if (!inst.data.__mutatedFields) {
          inst.data.__mutatedFields = new Set<string>()
        }
        (inst.data.__mutatedFields as Set<string>).add(key as string)
      } else {
        (object as ForgeMap)[key as string] = value
      }
    } else {
      throw new Error(`Cannot assign property "${key}" on ${typeof object}`)
    }
  }

  private assignReactive(ref: ReactiveRef, value: ForgeValue, env: Environment): void {
    if (ref.path.length === 1) {
      this.globalEnv.bindings.set(ref.path[0]!, value)
      return
    }

    // Navigate to parent, then set
    let current: ForgeValue = this.globalEnv.bindings.get(ref.path[0]!) ?? null

    for (let i = 1; i < ref.path.length - 1; i++) {
      if (current === null) {
        throw new Error(`Cannot navigate to ${ref.path.slice(0, i + 1).join('.')}`)
      }

      const key = ref.path[i]!

      if (typeof current === 'object' && current !== null) {
        if ('__type' in current && current.__type === 'instance') {
          current = (current as ForgeInstance).data[key] ?? null
        } else if (Array.isArray(current)) {
          current = current[parseInt(key)] ?? null
        } else {
          current = (current as ForgeMap)[key] ?? null
        }
      } else {
        throw new Error(`Cannot navigate to ${ref.path.slice(0, i + 1).join('.')}`)
      }
    }

    if (current === null) {
      throw new Error(`Cannot set ${ref.path.join('.')}`)
    }

    const lastKey = ref.path[ref.path.length - 1]!

    if (typeof current === 'object' && current !== null) {
      if ('__type' in current && current.__type === 'instance') {
        (current as ForgeInstance).data[lastKey] = value
      } else if (Array.isArray(current)) {
        current[parseInt(lastKey)] = value
      } else {
        (current as ForgeMap)[lastKey] = value
      }
    }
  }

  // ==========================================================================
  // Environment Helpers
  // ==========================================================================

  private createChildEnv(parent: Environment): Environment {
    return {
      parent,
      bindings: new Map(),
    }
  }

  private lookup(name: string, env: Environment): ForgeValue {
    let current: Environment | undefined = env
    while (current) {
      if (current.bindings.has(name)) {
        return current.bindings.get(name)!
      }
      current = current.parent
    }
    throw new Error(`Undefined variable: ${name}`)
  }

  private createGlobalEnvironment(): Environment {
    const bindings = new Map<string, ForgeValue>()

    // Built-in functions
    bindings.set('print', (...args: ForgeValue[]) => {
      console.log(...args.map(a => this.stringify(a)))
      return null
    })

    bindings.set('len', (value: ForgeValue) => {
      if (Array.isArray(value)) return value.length
      if (typeof value === 'string') return value.length
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length
      }
      return 0
    })

    bindings.set('type', (value: ForgeValue) => {
      if (value === null) return 'null'
      if (Array.isArray(value)) return 'list'
      if (typeof value === 'object') {
        if ('__type' in value) return value.__type
        return 'map'
      }
      return typeof value
    })

    bindings.set('keys', (obj: ForgeValue) => {
      if (typeof obj !== 'object' || obj === null) return []
      if ('__type' in obj && obj.__type === 'instance') {
        return Object.keys((obj as ForgeInstance).data)
      }
      return Object.keys(obj)
    })

    bindings.set('values', (obj: ForgeValue) => {
      if (typeof obj !== 'object' || obj === null) return []
      if ('__type' in obj && obj.__type === 'instance') {
        return Object.values((obj as ForgeInstance).data)
      }
      return Object.values(obj)
    })

    // Math functions
    bindings.set('abs', Math.abs)
    bindings.set('floor', Math.floor)
    bindings.set('ceil', Math.ceil)
    bindings.set('round', Math.round)
    bindings.set('min', Math.min)
    bindings.set('max', Math.max)
    bindings.set('sqrt', Math.sqrt)
    bindings.set('sin', Math.sin)
    bindings.set('cos', Math.cos)
    bindings.set('tan', Math.tan)
    bindings.set('random', Math.random)
    bindings.set('PI', Math.PI)

    // Add standard library namespaces (vec, math, list, string, random)
    for (const [key, value] of createStdlibBindings()) {
      bindings.set(key, value)
    }

    return { bindings }
  }

  // ==========================================================================
  // Array/String Methods
  // ==========================================================================

  private getArrayMethod(arr: ForgeValue[], method: string): ForgeValue {
    switch (method) {
      case 'length':
        return arr.length
      case 'push':
        return (item: ForgeValue) => { arr.push(item); return arr.length }
      case 'pop':
        return () => arr.pop() ?? null
      case 'shift':
        return () => arr.shift() ?? null
      case 'unshift':
        return (item: ForgeValue) => { arr.unshift(item); return arr.length }
      case 'slice':
        return (start: number, end?: number) => arr.slice(start, end)
      case 'concat':
        return (other: ForgeValue[]) => arr.concat(other)
      case 'indexOf':
        return (item: ForgeValue) => arr.findIndex(v => this.equals(v, item))
      case 'includes':
        return (item: ForgeValue) => arr.some(v => this.equals(v, item))
      case 'join':
        return (sep: string = ',') => arr.map(v => this.stringify(v)).join(sep)
      case 'reverse':
        return () => [...arr].reverse()
      case 'sort':
        return () => [...arr].sort()
      default:
        return null
    }
  }

  private getStringMethod(str: string, method: string): ForgeValue {
    switch (method) {
      case 'length':
        return str.length
      case 'toUpperCase':
        return () => str.toUpperCase()
      case 'toLowerCase':
        return () => str.toLowerCase()
      case 'trim':
        return () => str.trim()
      case 'split':
        return (sep: string) => str.split(sep)
      case 'includes':
        return (sub: string) => str.includes(sub)
      case 'startsWith':
        return (sub: string) => str.startsWith(sub)
      case 'endsWith':
        return (sub: string) => str.endsWith(sub)
      case 'slice':
        return (start: number, end?: number) => str.slice(start, end)
      case 'replace':
        return (from: string, to: string) => str.replace(from, to)
      default:
        return null
    }
  }

  // ==========================================================================
  // Utility Helpers
  // ==========================================================================

  private isTruthy(value: ForgeValue): boolean {
    if (value === null) return false
    if (value === false) return false
    if (value === 0) return false
    if (value === '') return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  }

  private equals(a: ForgeValue, b: ForgeValue): boolean {
    if (a === b) return true
    if (a === null || b === null) return false
    if (typeof a !== typeof b) return false

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((v, i) => this.equals(v, b[i]!))
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      if (keysA.length !== keysB.length) return false
      return keysA.every(k => this.equals((a as ForgeMap)[k]!, (b as ForgeMap)[k]!))
    }

    return false
  }

  private stringify(value: ForgeValue): string {
    if (value === null) return 'null'
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) return `[${value.map(v => this.stringify(v)).join(', ')}]`
    if (typeof value === 'object') {
      if ('__type' in value) {
        if (value.__type === 'function') return `<function ${(value as ForgeFunction).name || 'anonymous'}>`
        if (value.__type === 'schema') return `<schema ${(value as ForgeSchema).name}>`
        if (value.__type === 'instance') {
          return `<${(value as ForgeInstance).schema} instance>`
        }
      }
      const entries = Object.entries(value)
        .map(([k, v]) => `${k}: ${this.stringify(v)}`)
        .join(', ')
      return `{ ${entries} }`
    }
    return String(value)
  }
}
