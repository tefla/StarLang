/**
 * Forge Expression Evaluator
 *
 * Runtime evaluation of AST expressions. This module provides the ability
 * to evaluate Forge expressions against a context containing variable values,
 * reactive state, and configuration.
 */

import type * as AST from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * Evaluation context provides runtime values for expression evaluation.
 * The evaluator looks up identifiers and reactive refs from this context.
 */
export interface EvalContext {
  /** Local variables (params, loop variables, etc.) */
  vars: Record<string, unknown>

  /** Reactive state accessed via $path.to.value */
  state: Record<string, unknown>

  /** Configuration values accessed via config.path */
  config: Record<string, unknown>

  /** Parent context for nested scopes */
  parent?: EvalContext
}

/**
 * Result of vector evaluation - preserves structure.
 */
export interface Vec2Value {
  x: number
  y: number
}

export interface Vec3Value {
  x: number
  y: number
  z: number
}

export interface RangeValue {
  start: number
  end: number
}

/**
 * Color value with optional intensity.
 */
export interface ColorValue {
  hex: string
  intensity?: number
}

/**
 * Union of all possible evaluation results.
 */
export type EvalResult =
  | number
  | string
  | boolean
  | null
  | undefined
  | Vec2Value
  | Vec3Value
  | RangeValue
  | ColorValue
  | EvalResult[]
  | Record<string, unknown>

// ============================================================================
// Built-in Functions
// ============================================================================

type BuiltinFn = (...args: EvalResult[]) => EvalResult

const builtins: Record<string, BuiltinFn> = {
  // Math functions
  abs: (x) => Math.abs(asNumber(x)),
  floor: (x) => Math.floor(asNumber(x)),
  ceil: (x) => Math.ceil(asNumber(x)),
  round: (x) => Math.round(asNumber(x)),
  sqrt: (x) => Math.sqrt(asNumber(x)),
  pow: (base, exp) => Math.pow(asNumber(base), asNumber(exp)),
  sin: (x) => Math.sin(asNumber(x)),
  cos: (x) => Math.cos(asNumber(x)),
  tan: (x) => Math.tan(asNumber(x)),

  // Random
  random: () => Math.random(),

  // Clamping and range
  min: (...args) => Math.min(...args.map(asNumber)),
  max: (...args) => Math.max(...args.map(asNumber)),
  clamp: (value, minVal, maxVal) => {
    const v = asNumber(value)
    const lo = asNumber(minVal)
    const hi = asNumber(maxVal)
    return Math.max(lo, Math.min(hi, v))
  },

  // Interpolation
  lerp: (a, b, t) => {
    const av = asNumber(a)
    const bv = asNumber(b)
    const tv = asNumber(t)
    return av + (bv - av) * tv
  },

  // String functions
  len: (x) => {
    if (typeof x === 'string') return x.length
    if (Array.isArray(x)) return x.length
    return 0
  },
  upper: (x) => String(x).toUpperCase(),
  lower: (x) => String(x).toLowerCase(),
  trim: (x) => String(x).trim(),
  concat: (...args) => args.map(String).join(''),
  substr: (str, start, length) => {
    const s = String(str)
    const startIdx = asNumber(start)
    if (length !== undefined) {
      return s.substring(startIdx, startIdx + asNumber(length))
    }
    return s.substring(startIdx)
  },

  // Type conversion
  int: (x) => Math.floor(asNumber(x)),
  float: (x) => asNumber(x),
  str: (x) => String(x),
  bool: (x) => Boolean(x),

  // Color functions
  rgb: (r, g, b) => {
    const ri = Math.floor(asNumber(r))
    const gi = Math.floor(asNumber(g))
    const bi = Math.floor(asNumber(b))
    const hex = `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`
    return { hex } as ColorValue
  },
  rgba: (r, g, b, a) => {
    const ri = Math.floor(asNumber(r))
    const gi = Math.floor(asNumber(g))
    const bi = Math.floor(asNumber(b))
    const hex = `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`
    return { hex, intensity: asNumber(a) } as ColorValue
  },

  // Vector functions
  vec2: (x, y) => ({ x: asNumber(x), y: asNumber(y) } as Vec2Value),
  vec3: (x, y, z) => ({ x: asNumber(x), y: asNumber(y), z: asNumber(z) } as Vec3Value),

  // Easing functions (return 0-1 based on t 0-1)
  easeInQuad: (t) => {
    const tv = asNumber(t)
    return tv * tv
  },
  easeOutQuad: (t) => {
    const tv = asNumber(t)
    return 1 - (1 - tv) * (1 - tv)
  },
  easeInOutQuad: (t) => {
    const tv = asNumber(t)
    return tv < 0.5 ? 2 * tv * tv : 1 - Math.pow(-2 * tv + 2, 2) / 2
  },
  easeInCubic: (t) => {
    const tv = asNumber(t)
    return tv * tv * tv
  },
  easeOutCubic: (t) => {
    const tv = asNumber(t)
    return 1 - Math.pow(1 - tv, 3)
  },
  easeInOutCubic: (t) => {
    const tv = asNumber(t)
    return tv < 0.5 ? 4 * tv * tv * tv : 1 - Math.pow(-2 * tv + 2, 3) / 2
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Coerce a value to a number.
 */
function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return isNaN(n) ? 0 : n
  }
  return 0
}

/**
 * Coerce a value to a boolean.
 */
function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value.length > 0
  if (value === null || value === undefined) return false
  return true
}

/**
 * Check if a value is truthy.
 */
function isTruthy(value: EvalResult): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value.length > 0
  return true
}

/**
 * Get a nested value from an object using a path.
 */
function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj
  for (const key of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

/**
 * Create a child context with new local variables.
 */
export function createChildContext(parent: EvalContext, vars: Record<string, unknown> = {}): EvalContext {
  return {
    vars,
    state: parent.state,
    config: parent.config,
    parent,
  }
}

/**
 * Create an empty evaluation context.
 */
export function createContext(
  vars: Record<string, unknown> = {},
  state: Record<string, unknown> = {},
  config: Record<string, unknown> = {}
): EvalContext {
  return { vars, state, config }
}

/**
 * Look up a variable in the context chain.
 */
function lookupVar(ctx: EvalContext, name: string): unknown {
  if (name in ctx.vars) return ctx.vars[name]
  if (ctx.parent) return lookupVar(ctx.parent, name)
  return undefined
}

// ============================================================================
// Expression Evaluator
// ============================================================================

/**
 * Evaluate a Forge AST expression against a context.
 *
 * @param expr The AST expression to evaluate
 * @param ctx The evaluation context with variables and state
 * @returns The evaluated result
 */
export function evaluate(expr: AST.Expression, ctx: EvalContext): EvalResult {
  switch (expr.kind) {
    // Literals - return value directly
    case 'number':
      return expr.value

    case 'string':
      return expr.value

    case 'boolean':
      return expr.value

    case 'color':
      return { hex: expr.value } as ColorValue

    case 'duration':
      // Return duration in milliseconds
      return expr.value

    // Identifiers - look up in context
    case 'identifier':
      return lookupVar(ctx, expr.name) as EvalResult

    // Vectors
    case 'vec2': {
      const x = asNumber(evaluate(expr.x, ctx))
      const y = asNumber(evaluate(expr.y, ctx))
      return { x, y } as Vec2Value
    }

    case 'vec3': {
      const x = asNumber(evaluate(expr.x, ctx))
      const y = asNumber(evaluate(expr.y, ctx))
      const z = asNumber(evaluate(expr.z, ctx))
      return { x, y, z } as Vec3Value
    }

    // Range
    case 'range': {
      const start = asNumber(evaluate(expr.start, ctx))
      const end = asNumber(evaluate(expr.end, ctx))
      return { start, end } as RangeValue
    }

    // Reactive reference: $path.to.value
    case 'reactive': {
      const path = expr.path
      if (path.length === 0) return undefined

      // First element determines the root
      const root = path[0]
      const rest = path.slice(1)

      // Special handling for config
      if (root === 'config') {
        return getNestedValue(ctx.config, rest) as EvalResult
      }

      // Otherwise, look up in state
      return getNestedValue(ctx.state, path) as EvalResult
    }

    // Member access: obj.field
    case 'member': {
      const obj = evaluate(expr.object, ctx)
      if (obj === null || obj === undefined) return undefined
      if (typeof obj === 'object') {
        return (obj as Record<string, unknown>)[expr.property] as EvalResult
      }
      return undefined
    }

    // Binary operations
    case 'binary':
      return evaluateBinaryOp(expr.operator, expr.left, expr.right, ctx)

    // Unary operations
    case 'unary':
      return evaluateUnaryOp(expr.operator, expr.operand, ctx)

    // Function calls
    case 'call': {
      const fn = builtins[expr.name]
      if (!fn) {
        // Check if it's a user-defined function in context
        const userFn = lookupVar(ctx, expr.name)
        if (typeof userFn === 'function') {
          const args = expr.args.map((arg) => evaluate(arg, ctx))
          return (userFn as (...args: EvalResult[]) => EvalResult)(...args)
        }
        throw new EvalError(`Unknown function: ${expr.name}`, expr.loc)
      }
      const args = expr.args.map((arg) => evaluate(arg, ctx))
      return fn(...args)
    }

    // List literal
    case 'list':
      return expr.elements.map((el) => evaluate(el, ctx))

    default:
      throw new EvalError(`Unknown expression kind: ${(expr as AST.Expression).kind}`, expr.loc)
  }
}

/**
 * Evaluate a binary operation.
 */
function evaluateBinaryOp(
  op: string,
  left: AST.Expression,
  right: AST.Expression,
  ctx: EvalContext
): EvalResult {
  // Short-circuit evaluation for logical operators
  if (op === 'and' || op === '&&') {
    const leftVal = evaluate(left, ctx)
    if (!isTruthy(leftVal)) return false
    return asBoolean(evaluate(right, ctx))
  }

  if (op === 'or' || op === '||') {
    const leftVal = evaluate(left, ctx)
    if (isTruthy(leftVal)) return true
    return asBoolean(evaluate(right, ctx))
  }

  // Evaluate both sides for other operators
  const leftVal = evaluate(left, ctx)
  const rightVal = evaluate(right, ctx)

  switch (op) {
    // Arithmetic
    case '+':
      if (typeof leftVal === 'string' || typeof rightVal === 'string') {
        return String(leftVal) + String(rightVal)
      }
      return asNumber(leftVal) + asNumber(rightVal)
    case '-':
      return asNumber(leftVal) - asNumber(rightVal)
    case '*':
      return asNumber(leftVal) * asNumber(rightVal)
    case '/': {
      const divisor = asNumber(rightVal)
      if (divisor === 0) return 0 // Avoid division by zero
      return asNumber(leftVal) / divisor
    }
    case '%':
      return asNumber(leftVal) % asNumber(rightVal)
    case '**':
      return Math.pow(asNumber(leftVal), asNumber(rightVal))

    // Comparison
    case '==':
    case '===':
      return leftVal === rightVal
    case '!=':
    case '!==':
      return leftVal !== rightVal
    case '<':
      return asNumber(leftVal) < asNumber(rightVal)
    case '>':
      return asNumber(leftVal) > asNumber(rightVal)
    case '<=':
      return asNumber(leftVal) <= asNumber(rightVal)
    case '>=':
      return asNumber(leftVal) >= asNumber(rightVal)

    // Color with intensity: #color @ intensity
    case '@':
      if (typeof leftVal === 'object' && leftVal !== null && 'hex' in leftVal) {
        return { ...(leftVal as ColorValue), intensity: asNumber(rightVal) }
      }
      if (typeof leftVal === 'string' && leftVal.startsWith('#')) {
        return { hex: leftVal, intensity: asNumber(rightVal) } as ColorValue
      }
      return leftVal

    default:
      throw new EvalError(`Unknown binary operator: ${op}`, left.loc)
  }
}

/**
 * Evaluate a unary operation.
 */
function evaluateUnaryOp(op: string, operand: AST.Expression, ctx: EvalContext): EvalResult {
  const val = evaluate(operand, ctx)

  switch (op) {
    case '-':
      return -asNumber(val)
    case '+':
      return asNumber(val)
    case 'not':
    case '!':
      return !isTruthy(val)
    default:
      throw new EvalError(`Unknown unary operator: ${op}`, operand.loc)
  }
}

// ============================================================================
// Evaluation Error
// ============================================================================

export class EvalError extends Error {
  constructor(
    message: string,
    public loc?: AST.SourceLocation
  ) {
    super(loc ? `${message} at line ${loc.line}, column ${loc.column}` : message)
    this.name = 'EvalError'
  }
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Evaluate an expression as a boolean condition.
 */
export function evaluateCondition(expr: AST.Expression, ctx: EvalContext): boolean {
  return asBoolean(evaluate(expr, ctx))
}

// ============================================================================
// Match Evaluation
// ============================================================================

/**
 * Find the matching case in a match block and return its index.
 * Returns -1 if no match found.
 */
export function evaluateMatch(
  expr: AST.Expression,
  cases: AST.MatchCase[],
  ctx: EvalContext
): number {
  const value = evaluate(expr, ctx)

  for (let i = 0; i < cases.length; i++) {
    const casePattern = cases[i].pattern
    const patternValue = evaluate(casePattern, ctx)

    if (value === patternValue) {
      return i
    }
  }

  return -1
}

// ============================================================================
// Expression Utilities
// ============================================================================

/**
 * Check if an expression is a constant (no reactive refs or identifiers).
 */
export function isConstant(expr: AST.Expression): boolean {
  switch (expr.kind) {
    case 'number':
    case 'string':
    case 'boolean':
    case 'color':
    case 'duration':
      return true

    case 'identifier':
    case 'reactive':
      return false

    case 'vec2':
      return isConstant(expr.x) && isConstant(expr.y)

    case 'vec3':
      return isConstant(expr.x) && isConstant(expr.y) && isConstant(expr.z)

    case 'range':
      return isConstant(expr.start) && isConstant(expr.end)

    case 'member':
      return isConstant(expr.object)

    case 'binary':
      return isConstant(expr.left) && isConstant(expr.right)

    case 'unary':
      return isConstant(expr.operand)

    case 'call':
      return expr.args.every(isConstant)

    case 'list':
      return expr.elements.every(isConstant)

    default:
      return false
  }
}

/**
 * Get all reactive references in an expression.
 */
export function getReactiveRefs(expr: AST.Expression): string[][] {
  const refs: string[][] = []

  function collect(e: AST.Expression): void {
    switch (e.kind) {
      case 'reactive':
        refs.push(e.path)
        break
      case 'vec2':
        collect(e.x)
        collect(e.y)
        break
      case 'vec3':
        collect(e.x)
        collect(e.y)
        collect(e.z)
        break
      case 'range':
        collect(e.start)
        collect(e.end)
        break
      case 'member':
        collect(e.object)
        break
      case 'binary':
        collect(e.left)
        collect(e.right)
        break
      case 'unary':
        collect(e.operand)
        break
      case 'call':
        e.args.forEach(collect)
        break
      case 'list':
        e.elements.forEach(collect)
        break
    }
  }

  collect(expr)
  return refs
}

/**
 * Get all identifiers referenced in an expression.
 */
export function getIdentifiers(expr: AST.Expression): string[] {
  const ids: string[] = []

  function collect(e: AST.Expression): void {
    switch (e.kind) {
      case 'identifier':
        ids.push(e.name)
        break
      case 'vec2':
        collect(e.x)
        collect(e.y)
        break
      case 'vec3':
        collect(e.x)
        collect(e.y)
        collect(e.z)
        break
      case 'range':
        collect(e.start)
        collect(e.end)
        break
      case 'member':
        collect(e.object)
        break
      case 'binary':
        collect(e.left)
        collect(e.right)
        break
      case 'unary':
        collect(e.operand)
        break
      case 'call':
        e.args.forEach(collect)
        break
      case 'list':
        e.elements.forEach(collect)
        break
    }
  }

  collect(expr)
  return ids
}

// ============================================================================
// Custom Function Registration
// ============================================================================

/**
 * Register a custom built-in function.
 * Use this to extend the evaluator with game-specific functions.
 */
export function registerBuiltin(name: string, fn: BuiltinFn): void {
  builtins[name] = fn
}

/**
 * Check if a built-in function exists.
 */
export function hasBuiltin(name: string): boolean {
  return name in builtins
}

/**
 * Get all built-in function names.
 */
export function getBuiltinNames(): string[] {
  return Object.keys(builtins)
}
