/**
 * Forge Statement Executor
 *
 * Executes Forge statements and manages function definitions.
 * Provides runtime execution of control flow, function calls, and statements.
 */

import {
  evaluate,
  evaluateCondition,
  createContext,
  createChildContext,
  type EvalContext,
  type EvalResult,
} from './evaluator'
import type * as AST from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of executing a statement block.
 */
export interface ExecutionResult {
  /** True if execution should break from a loop */
  break?: boolean
  /** True if execution should continue to next iteration */
  continue?: boolean
  /** Return value if a return statement was executed */
  returnValue?: EvalResult
  /** True if a return statement was executed */
  returned?: boolean
}

/**
 * User-defined function stored in the function registry.
 */
export interface ForgeFunction {
  name: string
  params: AST.FunctionParam[]
  body: AST.Statement[]
}

/**
 * Callbacks for side effects during execution.
 */
export interface ExecutionCallbacks {
  onSetState?: (state: string) => void
  onPlayAnimation?: (animation: string) => void
  onStopAnimation?: (animation: string) => void
  onEmit?: (event: string) => void
  onSet?: (property: string, value: EvalResult) => void
  onAnimate?: (animation: string, axis?: string, speed?: number) => void
}

// ============================================================================
// Function Registry
// ============================================================================

const functionRegistry: Map<string, ForgeFunction> = new Map()

/**
 * Register a user-defined function.
 */
export function registerFunction(fn: ForgeFunction): void {
  functionRegistry.set(fn.name, fn)
}

/**
 * Get a registered function by name.
 */
export function getFunction(name: string): ForgeFunction | undefined {
  return functionRegistry.get(name)
}

/**
 * Check if a function is registered.
 */
export function hasFunction(name: string): boolean {
  return functionRegistry.has(name)
}

/**
 * Get all registered function names.
 */
export function getFunctionNames(): string[] {
  return Array.from(functionRegistry.keys())
}

/**
 * Clear all registered functions.
 */
export function clearFunctions(): void {
  functionRegistry.clear()
}

/**
 * Load functions from a Forge module.
 */
export function loadFunctionsFromModule(module: AST.ForgeModule): void {
  for (const def of module.definitions) {
    if (def.kind === 'function') {
      registerFunction({
        name: def.name,
        params: def.params,
        body: def.body,
      })
    }
  }
}

// ============================================================================
// Statement Executor
// ============================================================================

/**
 * Maximum iterations for loops to prevent infinite loops.
 */
const MAX_LOOP_ITERATIONS = 10000

/**
 * Execute a single statement.
 */
export function executeStatement(
  stmt: AST.Statement,
  ctx: EvalContext,
  callbacks: ExecutionCallbacks = {}
): ExecutionResult {
  switch (stmt.kind) {
    case 'if':
      return executeIf(stmt, ctx, callbacks)

    case 'for':
      return executeFor(stmt, ctx, callbacks)

    case 'while':
      return executeWhile(stmt, ctx, callbacks)

    case 'break':
      return { break: true }

    case 'continue':
      return { continue: true }

    case 'return':
      return {
        returned: true,
        returnValue: stmt.value ? evaluate(stmt.value, ctx) : undefined,
      }

    case 'when':
      return executeWhen(stmt, ctx, callbacks)

    case 'match':
      return executeMatch(stmt, ctx, callbacks)

    case 'setState':
      callbacks.onSetState?.(stmt.state)
      return {}

    case 'play':
      callbacks.onPlayAnimation?.(stmt.animation)
      return {}

    case 'stopAnimation':
      callbacks.onStopAnimation?.(stmt.animation)
      return {}

    case 'emit':
      callbacks.onEmit?.(stmt.event)
      return {}

    case 'set':
      callbacks.onSet?.(stmt.property, evaluate(stmt.value, ctx))
      return {}

    case 'animate':
      callbacks.onAnimate?.(
        stmt.animation,
        stmt.axis,
        stmt.speed ? (evaluate(stmt.speed, ctx) as number) : undefined
      )
      return {}

    case 'on':
      // On blocks are event handlers, not directly executed
      return {}

    default:
      // Unknown statement type
      return {}
  }
}

/**
 * Execute a block of statements.
 */
export function executeStatements(
  statements: AST.Statement[],
  ctx: EvalContext,
  callbacks: ExecutionCallbacks = {}
): ExecutionResult {
  for (const stmt of statements) {
    const result = executeStatement(stmt, ctx, callbacks)
    if (result.break || result.continue || result.returned) {
      return result
    }
  }
  return {}
}

/**
 * Execute an if statement.
 */
function executeIf(
  stmt: AST.IfStatement,
  ctx: EvalContext,
  callbacks: ExecutionCallbacks
): ExecutionResult {
  // Check main condition
  if (evaluateCondition(stmt.condition, ctx)) {
    return executeStatements(stmt.body, ctx, callbacks)
  }

  // Check elif chains
  if (stmt.elif) {
    for (const elif of stmt.elif) {
      if (evaluateCondition(elif.condition, ctx)) {
        return executeStatements(elif.body, ctx, callbacks)
      }
    }
  }

  // Execute else block
  if (stmt.else) {
    return executeStatements(stmt.else, ctx, callbacks)
  }

  return {}
}

/**
 * Execute a for loop.
 */
function executeFor(
  stmt: AST.ForStatement,
  ctx: EvalContext,
  callbacks: ExecutionCallbacks
): ExecutionResult {
  const iterable = evaluate(stmt.iterable, ctx)

  // Handle different iterable types
  let items: EvalResult[]
  if (Array.isArray(iterable)) {
    items = iterable
  } else if (typeof iterable === 'object' && iterable !== null) {
    // Range object: { start, end }
    if ('start' in iterable && 'end' in iterable) {
      const start = (iterable as { start: number }).start
      const end = (iterable as { end: number }).end
      items = []
      for (let i = start; i <= end && items.length < MAX_LOOP_ITERATIONS; i++) {
        items.push(i)
      }
    } else {
      items = Object.values(iterable)
    }
  } else {
    items = []
  }

  // Execute loop
  let iterations = 0
  for (const item of items) {
    if (iterations++ >= MAX_LOOP_ITERATIONS) {
      throw new ExecutionError(`For loop exceeded maximum iterations (${MAX_LOOP_ITERATIONS})`)
    }

    const loopCtx = createChildContext(ctx, { [stmt.variable]: item })
    const result = executeStatements(stmt.body, loopCtx, callbacks)

    if (result.break) break
    if (result.returned) return result
    // continue just skips to next iteration
  }

  return {}
}

/**
 * Execute a while loop.
 */
function executeWhile(
  stmt: AST.WhileStatement,
  ctx: EvalContext,
  callbacks: ExecutionCallbacks
): ExecutionResult {
  let iterations = 0

  while (evaluateCondition(stmt.condition, ctx)) {
    if (iterations++ >= MAX_LOOP_ITERATIONS) {
      throw new ExecutionError(`While loop exceeded maximum iterations (${MAX_LOOP_ITERATIONS})`)
    }

    const result = executeStatements(stmt.body, ctx, callbacks)

    if (result.break) break
    if (result.returned) return result
    // continue just skips to next iteration
  }

  return {}
}

/**
 * Execute a when block.
 */
function executeWhen(
  stmt: AST.WhenBlock,
  ctx: EvalContext,
  callbacks: ExecutionCallbacks
): ExecutionResult {
  if (evaluateCondition(stmt.condition, ctx)) {
    return executeStatements(stmt.body, ctx, callbacks)
  } else if (stmt.else) {
    return executeStatements(stmt.else, ctx, callbacks)
  }
  return {}
}

/**
 * Execute a match block.
 */
function executeMatch(
  stmt: AST.MatchBlock,
  ctx: EvalContext,
  callbacks: ExecutionCallbacks
): ExecutionResult {
  const value = evaluate(stmt.expression, ctx)

  for (const case_ of stmt.cases) {
    const pattern = evaluate(case_.pattern, ctx)
    if (value === pattern) {
      return executeStatements(case_.body, ctx, callbacks)
    }
  }

  return {}
}

// ============================================================================
// Function Invocation
// ============================================================================

/**
 * Call a user-defined function.
 */
export function callFunction(
  name: string,
  args: EvalResult[],
  ctx: EvalContext,
  callbacks: ExecutionCallbacks = {}
): EvalResult {
  const fn = functionRegistry.get(name)
  if (!fn) {
    throw new ExecutionError(`Unknown function: ${name}`)
  }

  // Create function context with parameters bound
  const vars: Record<string, unknown> = {}
  for (let i = 0; i < fn.params.length; i++) {
    const param = fn.params[i]!
    if (i < args.length) {
      vars[param.name] = args[i]
    } else if (param.default) {
      vars[param.name] = evaluate(param.default, ctx)
    } else {
      vars[param.name] = undefined
    }
  }

  const fnCtx = createChildContext(ctx, vars)

  // Execute function body
  const result = executeStatements(fn.body, fnCtx, callbacks)

  return result.returnValue
}

/**
 * Create a callable wrapper for a Forge function.
 * This allows user functions to be called from expressions.
 */
export function createFunctionWrapper(
  name: string,
  ctx: EvalContext,
  callbacks: ExecutionCallbacks = {}
): (...args: EvalResult[]) => EvalResult {
  return (...args: EvalResult[]) => callFunction(name, args, ctx, callbacks)
}

/**
 * Add all registered functions to an evaluation context.
 * This allows user functions to be called from expressions.
 */
export function addFunctionsToContext(
  ctx: EvalContext,
  callbacks: ExecutionCallbacks = {}
): void {
  for (const name of functionRegistry.keys()) {
    ctx.vars[name] = createFunctionWrapper(name, ctx, callbacks)
  }
}

// ============================================================================
// Execution Error
// ============================================================================

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExecutionError'
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Execute a function definition's body with given arguments.
 */
export function executeFunction(
  fn: AST.FunctionDef,
  args: EvalResult[],
  ctx: EvalContext,
  callbacks: ExecutionCallbacks = {}
): EvalResult {
  // Create function context with parameters bound
  const vars: Record<string, unknown> = {}
  for (let i = 0; i < fn.params.length; i++) {
    const param = fn.params[i]!
    if (i < args.length) {
      vars[param.name] = args[i]
    } else if (param.default) {
      vars[param.name] = evaluate(param.default, ctx)
    } else {
      vars[param.name] = undefined
    }
  }

  const fnCtx = createChildContext(ctx, vars)

  // Execute function body
  const result = executeStatements(fn.body, fnCtx, callbacks)

  return result.returnValue
}

/**
 * Create a basic execution context.
 */
export function createExecutionContext(
  vars: Record<string, unknown> = {},
  state: Record<string, unknown> = {},
  config: Record<string, unknown> = {}
): EvalContext {
  return createContext(vars, state, config)
}
