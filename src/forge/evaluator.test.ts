/**
 * Tests for Forge Expression Evaluator
 */

import { test, expect, describe } from 'bun:test'
import {
  evaluate,
  evaluateCondition,
  evaluateMatch,
  createContext,
  createChildContext,
  isConstant,
  getReactiveRefs,
  getIdentifiers,
  registerBuiltin,
  hasBuiltin,
  getBuiltinNames,
  EvalError,
  type EvalContext,
  type Vec2Value,
  type Vec3Value,
  type RangeValue,
  type ColorValue,
} from './evaluator'
import type * as AST from './types'

// ============================================================================
// Test Helpers
// ============================================================================

const loc: AST.SourceLocation = { line: 1, column: 1 }

function num(value: number): AST.NumberLiteral {
  return { kind: 'number', value, loc }
}

function str(value: string): AST.StringLiteral {
  return { kind: 'string', value, loc }
}

function bool(value: boolean): AST.BooleanLiteral {
  return { kind: 'boolean', value, loc }
}

function color(value: string): AST.ColorLiteral {
  return { kind: 'color', value, loc }
}

function duration(value: number, unit: 'ms' | 's' | 'm' | 'h' = 'ms'): AST.DurationLiteral {
  return { kind: 'duration', value, unit, loc }
}

function id(name: string): AST.Identifier {
  return { kind: 'identifier', name, loc }
}

function vec2(x: AST.Expression, y: AST.Expression): AST.Vec2 {
  return { kind: 'vec2', x, y, loc }
}

function vec3(x: AST.Expression, y: AST.Expression, z: AST.Expression): AST.Vec3 {
  return { kind: 'vec3', x, y, z, loc }
}

function range(start: AST.Expression, end: AST.Expression): AST.Range {
  return { kind: 'range', start, end, loc }
}

function reactive(...path: string[]): AST.ReactiveRef {
  return { kind: 'reactive', path, loc }
}

function member(object: AST.Expression, property: string): AST.MemberAccess {
  return { kind: 'member', object, property, loc }
}

function binary(left: AST.Expression, operator: string, right: AST.Expression): AST.BinaryOp {
  return { kind: 'binary', operator, left, right, loc }
}

function unary(operator: string, operand: AST.Expression): AST.UnaryOp {
  return { kind: 'unary', operator, operand, loc }
}

function call(name: string, ...args: AST.Expression[]): AST.FunctionCall {
  return { kind: 'call', name, args, loc }
}

function list(...elements: AST.Expression[]): AST.ListLiteral {
  return { kind: 'list', elements, loc }
}

// ============================================================================
// Literal Tests
// ============================================================================

describe('Literals', () => {
  const ctx = createContext()

  test('number literal', () => {
    expect(evaluate(num(42), ctx)).toBe(42)
    expect(evaluate(num(3.14), ctx)).toBe(3.14)
    expect(evaluate(num(-10), ctx)).toBe(-10)
    expect(evaluate(num(0), ctx)).toBe(0)
  })

  test('string literal', () => {
    expect(evaluate(str('hello'), ctx)).toBe('hello')
    expect(evaluate(str(''), ctx)).toBe('')
    expect(evaluate(str('with spaces'), ctx)).toBe('with spaces')
  })

  test('boolean literal', () => {
    expect(evaluate(bool(true), ctx)).toBe(true)
    expect(evaluate(bool(false), ctx)).toBe(false)
  })

  test('color literal', () => {
    const result = evaluate(color('#ff0000'), ctx) as ColorValue
    expect(result.hex).toBe('#ff0000')
  })

  test('duration literal', () => {
    expect(evaluate(duration(300, 'ms'), ctx)).toBe(300)
    expect(evaluate(duration(1000, 's'), ctx)).toBe(1000)
  })
})

// ============================================================================
// Vector Tests
// ============================================================================

describe('Vectors', () => {
  const ctx = createContext({ x: 10, y: 20, z: 30 })

  test('vec2 with literals', () => {
    const result = evaluate(vec2(num(1), num(2)), ctx) as Vec2Value
    expect(result.x).toBe(1)
    expect(result.y).toBe(2)
  })

  test('vec2 with identifiers', () => {
    const result = evaluate(vec2(id('x'), id('y')), ctx) as Vec2Value
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
  })

  test('vec3 with literals', () => {
    const result = evaluate(vec3(num(1), num(2), num(3)), ctx) as Vec3Value
    expect(result.x).toBe(1)
    expect(result.y).toBe(2)
    expect(result.z).toBe(3)
  })

  test('vec3 with identifiers', () => {
    const result = evaluate(vec3(id('x'), id('y'), id('z')), ctx) as Vec3Value
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.z).toBe(30)
  })

  test('vec3 with expressions', () => {
    const result = evaluate(
      vec3(binary(id('x'), '+', num(5)), id('y'), binary(id('z'), '*', num(2))),
      ctx
    ) as Vec3Value
    expect(result.x).toBe(15)
    expect(result.y).toBe(20)
    expect(result.z).toBe(60)
  })
})

// ============================================================================
// Range Tests
// ============================================================================

describe('Ranges', () => {
  const ctx = createContext({ min: 0, max: 100 })

  test('range with literals', () => {
    const result = evaluate(range(num(0), num(10)), ctx) as RangeValue
    expect(result.start).toBe(0)
    expect(result.end).toBe(10)
  })

  test('range with identifiers', () => {
    const result = evaluate(range(id('min'), id('max')), ctx) as RangeValue
    expect(result.start).toBe(0)
    expect(result.end).toBe(100)
  })
})

// ============================================================================
// Identifier Tests
// ============================================================================

describe('Identifiers', () => {
  test('simple identifier lookup', () => {
    const ctx = createContext({ foo: 42, bar: 'hello' })
    expect(evaluate(id('foo'), ctx)).toBe(42)
    expect(evaluate(id('bar'), ctx)).toBe('hello')
  })

  test('undefined identifier returns undefined', () => {
    const ctx = createContext({})
    expect(evaluate(id('missing'), ctx)).toBeUndefined()
  })

  test('nested context lookup', () => {
    const parent = createContext({ parentVar: 100 })
    const child = createChildContext(parent, { childVar: 50 })
    expect(evaluate(id('childVar'), child)).toBe(50)
    expect(evaluate(id('parentVar'), child)).toBe(100)
  })

  test('child shadows parent', () => {
    const parent = createContext({ x: 100 })
    const child = createChildContext(parent, { x: 50 })
    expect(evaluate(id('x'), child)).toBe(50)
  })
})

// ============================================================================
// Reactive Reference Tests
// ============================================================================

describe('Reactive References', () => {
  test('simple reactive ref', () => {
    const ctx = createContext({}, { o2_level: 21.0 })
    expect(evaluate(reactive('o2_level'), ctx)).toBe(21.0)
  })

  test('nested reactive ref', () => {
    const ctx = createContext({}, { player: { room: { name: 'galley' } } })
    expect(evaluate(reactive('player', 'room', 'name'), ctx)).toBe('galley')
  })

  test('config reactive ref', () => {
    const ctx = createContext({}, {}, { atmosphere: { o2: { threshold: 19 } } })
    expect(evaluate(reactive('config', 'atmosphere', 'o2', 'threshold'), ctx)).toBe(19)
  })

  test('missing reactive ref returns undefined', () => {
    const ctx = createContext({}, {})
    expect(evaluate(reactive('missing', 'path'), ctx)).toBeUndefined()
  })
})

// ============================================================================
// Member Access Tests
// ============================================================================

describe('Member Access', () => {
  test('simple member access', () => {
    const ctx = createContext({ obj: { x: 10, y: 20 } })
    expect(evaluate(member(id('obj'), 'x'), ctx)).toBe(10)
    expect(evaluate(member(id('obj'), 'y'), ctx)).toBe(20)
  })

  test('nested member access', () => {
    const ctx = createContext({ a: { b: { c: 42 } } })
    expect(evaluate(member(member(id('a'), 'b'), 'c'), ctx)).toBe(42)
  })

  test('member access on null returns undefined', () => {
    const ctx = createContext({ obj: null })
    expect(evaluate(member(id('obj'), 'x'), ctx)).toBeUndefined()
  })

  test('member access on missing property returns undefined', () => {
    const ctx = createContext({ obj: { x: 10 } })
    expect(evaluate(member(id('obj'), 'missing'), ctx)).toBeUndefined()
  })
})

// ============================================================================
// Arithmetic Operator Tests
// ============================================================================

describe('Arithmetic Operators', () => {
  const ctx = createContext()

  test('addition', () => {
    expect(evaluate(binary(num(2), '+', num(3)), ctx)).toBe(5)
    expect(evaluate(binary(num(-1), '+', num(1)), ctx)).toBe(0)
    expect(evaluate(binary(num(1.5), '+', num(2.5)), ctx)).toBe(4)
  })

  test('string concatenation', () => {
    expect(evaluate(binary(str('hello'), '+', str(' world')), ctx)).toBe('hello world')
    expect(evaluate(binary(str('count: '), '+', num(42)), ctx)).toBe('count: 42')
  })

  test('subtraction', () => {
    expect(evaluate(binary(num(10), '-', num(4)), ctx)).toBe(6)
    expect(evaluate(binary(num(5), '-', num(10)), ctx)).toBe(-5)
  })

  test('multiplication', () => {
    expect(evaluate(binary(num(3), '*', num(4)), ctx)).toBe(12)
    expect(evaluate(binary(num(-2), '*', num(3)), ctx)).toBe(-6)
  })

  test('division', () => {
    expect(evaluate(binary(num(10), '/', num(2)), ctx)).toBe(5)
    expect(evaluate(binary(num(7), '/', num(2)), ctx)).toBe(3.5)
  })

  test('division by zero returns 0', () => {
    expect(evaluate(binary(num(10), '/', num(0)), ctx)).toBe(0)
  })

  test('modulo', () => {
    expect(evaluate(binary(num(10), '%', num(3)), ctx)).toBe(1)
    expect(evaluate(binary(num(15), '%', num(5)), ctx)).toBe(0)
  })

  test('exponentiation', () => {
    expect(evaluate(binary(num(2), '**', num(3)), ctx)).toBe(8)
    expect(evaluate(binary(num(9), '**', num(0.5)), ctx)).toBe(3)
  })
})

// ============================================================================
// Comparison Operator Tests
// ============================================================================

describe('Comparison Operators', () => {
  const ctx = createContext()

  test('equality', () => {
    expect(evaluate(binary(num(5), '==', num(5)), ctx)).toBe(true)
    expect(evaluate(binary(num(5), '==', num(6)), ctx)).toBe(false)
    expect(evaluate(binary(str('a'), '==', str('a')), ctx)).toBe(true)
    expect(evaluate(binary(bool(true), '==', bool(true)), ctx)).toBe(true)
  })

  test('inequality', () => {
    expect(evaluate(binary(num(5), '!=', num(6)), ctx)).toBe(true)
    expect(evaluate(binary(num(5), '!=', num(5)), ctx)).toBe(false)
  })

  test('less than', () => {
    expect(evaluate(binary(num(3), '<', num(5)), ctx)).toBe(true)
    expect(evaluate(binary(num(5), '<', num(5)), ctx)).toBe(false)
    expect(evaluate(binary(num(7), '<', num(5)), ctx)).toBe(false)
  })

  test('greater than', () => {
    expect(evaluate(binary(num(7), '>', num(5)), ctx)).toBe(true)
    expect(evaluate(binary(num(5), '>', num(5)), ctx)).toBe(false)
    expect(evaluate(binary(num(3), '>', num(5)), ctx)).toBe(false)
  })

  test('less than or equal', () => {
    expect(evaluate(binary(num(3), '<=', num(5)), ctx)).toBe(true)
    expect(evaluate(binary(num(5), '<=', num(5)), ctx)).toBe(true)
    expect(evaluate(binary(num(7), '<=', num(5)), ctx)).toBe(false)
  })

  test('greater than or equal', () => {
    expect(evaluate(binary(num(7), '>=', num(5)), ctx)).toBe(true)
    expect(evaluate(binary(num(5), '>=', num(5)), ctx)).toBe(true)
    expect(evaluate(binary(num(3), '>=', num(5)), ctx)).toBe(false)
  })
})

// ============================================================================
// Logical Operator Tests
// ============================================================================

describe('Logical Operators', () => {
  const ctx = createContext()

  test('and operator', () => {
    expect(evaluate(binary(bool(true), 'and', bool(true)), ctx)).toBe(true)
    expect(evaluate(binary(bool(true), 'and', bool(false)), ctx)).toBe(false)
    expect(evaluate(binary(bool(false), 'and', bool(true)), ctx)).toBe(false)
    expect(evaluate(binary(bool(false), 'and', bool(false)), ctx)).toBe(false)
  })

  test('or operator', () => {
    expect(evaluate(binary(bool(true), 'or', bool(true)), ctx)).toBe(true)
    expect(evaluate(binary(bool(true), 'or', bool(false)), ctx)).toBe(true)
    expect(evaluate(binary(bool(false), 'or', bool(true)), ctx)).toBe(true)
    expect(evaluate(binary(bool(false), 'or', bool(false)), ctx)).toBe(false)
  })

  test('&& operator', () => {
    expect(evaluate(binary(bool(true), '&&', bool(true)), ctx)).toBe(true)
    expect(evaluate(binary(bool(false), '&&', bool(true)), ctx)).toBe(false)
  })

  test('|| operator', () => {
    expect(evaluate(binary(bool(false), '||', bool(true)), ctx)).toBe(true)
    expect(evaluate(binary(bool(false), '||', bool(false)), ctx)).toBe(false)
  })

  test('short-circuit evaluation for and', () => {
    // If left is false, right should not be evaluated (no error thrown)
    const ctx = createContext({ x: false })
    expect(evaluate(binary(id('x'), 'and', call('nonexistent')), ctx)).toBe(false)
  })

  test('short-circuit evaluation for or', () => {
    // If left is true, right should not be evaluated (no error thrown)
    const ctx = createContext({ x: true })
    expect(evaluate(binary(id('x'), 'or', call('nonexistent')), ctx)).toBe(true)
  })
})

// ============================================================================
// Unary Operator Tests
// ============================================================================

describe('Unary Operators', () => {
  const ctx = createContext()

  test('negation', () => {
    expect(evaluate(unary('-', num(5)), ctx)).toBe(-5)
    expect(evaluate(unary('-', num(-3)), ctx)).toBe(3)
  })

  test('positive', () => {
    expect(evaluate(unary('+', num(5)), ctx)).toBe(5)
    expect(evaluate(unary('+', str('42')), ctx)).toBe(42)
  })

  test('not operator', () => {
    expect(evaluate(unary('not', bool(true)), ctx)).toBe(false)
    expect(evaluate(unary('not', bool(false)), ctx)).toBe(true)
    expect(evaluate(unary('not', num(0)), ctx)).toBe(true)
    expect(evaluate(unary('not', num(1)), ctx)).toBe(false)
  })

  test('! operator', () => {
    expect(evaluate(unary('!', bool(true)), ctx)).toBe(false)
    expect(evaluate(unary('!', bool(false)), ctx)).toBe(true)
  })
})

// ============================================================================
// Color Operator Tests
// ============================================================================

describe('Color Operators', () => {
  const ctx = createContext()

  test('color with intensity', () => {
    const result = evaluate(binary(color('#ff0000'), '@', num(0.8)), ctx) as ColorValue
    expect(result.hex).toBe('#ff0000')
    expect(result.intensity).toBe(0.8)
  })

  test('color literal with intensity', () => {
    const result = evaluate(binary(str('#00ff00'), '@', num(0.5)), ctx) as ColorValue
    expect(result.hex).toBe('#00ff00')
    expect(result.intensity).toBe(0.5)
  })
})

// ============================================================================
// Built-in Function Tests
// ============================================================================

describe('Math Functions', () => {
  const ctx = createContext()

  test('abs', () => {
    expect(evaluate(call('abs', num(-5)), ctx)).toBe(5)
    expect(evaluate(call('abs', num(5)), ctx)).toBe(5)
  })

  test('floor', () => {
    expect(evaluate(call('floor', num(3.7)), ctx)).toBe(3)
    expect(evaluate(call('floor', num(-3.2)), ctx)).toBe(-4)
  })

  test('ceil', () => {
    expect(evaluate(call('ceil', num(3.2)), ctx)).toBe(4)
    expect(evaluate(call('ceil', num(-3.7)), ctx)).toBe(-3)
  })

  test('round', () => {
    expect(evaluate(call('round', num(3.4)), ctx)).toBe(3)
    expect(evaluate(call('round', num(3.5)), ctx)).toBe(4)
  })

  test('sqrt', () => {
    expect(evaluate(call('sqrt', num(9)), ctx)).toBe(3)
    expect(evaluate(call('sqrt', num(2)), ctx)).toBeCloseTo(1.414, 2)
  })

  test('pow', () => {
    expect(evaluate(call('pow', num(2), num(3)), ctx)).toBe(8)
    expect(evaluate(call('pow', num(10), num(0)), ctx)).toBe(1)
  })

  test('sin/cos/tan', () => {
    expect(evaluate(call('sin', num(0)), ctx)).toBe(0)
    expect(evaluate(call('cos', num(0)), ctx)).toBe(1)
    expect(evaluate(call('tan', num(0)), ctx)).toBe(0)
  })

  test('min', () => {
    expect(evaluate(call('min', num(3), num(1), num(4)), ctx)).toBe(1)
    expect(evaluate(call('min', num(-5), num(0)), ctx)).toBe(-5)
  })

  test('max', () => {
    expect(evaluate(call('max', num(3), num(1), num(4)), ctx)).toBe(4)
    expect(evaluate(call('max', num(-5), num(0)), ctx)).toBe(0)
  })

  test('clamp', () => {
    expect(evaluate(call('clamp', num(5), num(0), num(10)), ctx)).toBe(5)
    expect(evaluate(call('clamp', num(-5), num(0), num(10)), ctx)).toBe(0)
    expect(evaluate(call('clamp', num(15), num(0), num(10)), ctx)).toBe(10)
  })

  test('lerp', () => {
    expect(evaluate(call('lerp', num(0), num(10), num(0.5)), ctx)).toBe(5)
    expect(evaluate(call('lerp', num(0), num(100), num(0.25)), ctx)).toBe(25)
  })
})

describe('String Functions', () => {
  const ctx = createContext()

  test('len', () => {
    expect(evaluate(call('len', str('hello')), ctx)).toBe(5)
    expect(evaluate(call('len', str('')), ctx)).toBe(0)
  })

  test('upper', () => {
    expect(evaluate(call('upper', str('hello')), ctx)).toBe('HELLO')
  })

  test('lower', () => {
    expect(evaluate(call('lower', str('HELLO')), ctx)).toBe('hello')
  })

  test('trim', () => {
    expect(evaluate(call('trim', str('  hello  ')), ctx)).toBe('hello')
  })

  test('concat', () => {
    expect(evaluate(call('concat', str('hello'), str(' '), str('world')), ctx)).toBe('hello world')
  })

  test('substr', () => {
    expect(evaluate(call('substr', str('hello'), num(1)), ctx)).toBe('ello')
    expect(evaluate(call('substr', str('hello'), num(1), num(3)), ctx)).toBe('ell')
  })
})

describe('Type Conversion Functions', () => {
  const ctx = createContext()

  test('int', () => {
    expect(evaluate(call('int', num(3.7)), ctx)).toBe(3)
    expect(evaluate(call('int', str('42')), ctx)).toBe(42)
  })

  test('float', () => {
    expect(evaluate(call('float', str('3.14')), ctx)).toBeCloseTo(3.14)
  })

  test('str', () => {
    expect(evaluate(call('str', num(42)), ctx)).toBe('42')
    expect(evaluate(call('str', bool(true)), ctx)).toBe('true')
  })

  test('bool', () => {
    expect(evaluate(call('bool', num(0)), ctx)).toBe(false)
    expect(evaluate(call('bool', num(1)), ctx)).toBe(true)
    expect(evaluate(call('bool', str('')), ctx)).toBe(false)
    expect(evaluate(call('bool', str('x')), ctx)).toBe(true)
  })
})

describe('Color Functions', () => {
  const ctx = createContext()

  test('rgb', () => {
    const result = evaluate(call('rgb', num(255), num(128), num(0)), ctx) as ColorValue
    expect(result.hex).toBe('#ff8000')
  })

  test('rgba', () => {
    const result = evaluate(call('rgba', num(255), num(0), num(0), num(0.5)), ctx) as ColorValue
    expect(result.hex).toBe('#ff0000')
    expect(result.intensity).toBe(0.5)
  })
})

describe('Vector Functions', () => {
  const ctx = createContext()

  test('vec2', () => {
    const result = evaluate(call('vec2', num(10), num(20)), ctx) as Vec2Value
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
  })

  test('vec3', () => {
    const result = evaluate(call('vec3', num(1), num(2), num(3)), ctx) as Vec3Value
    expect(result.x).toBe(1)
    expect(result.y).toBe(2)
    expect(result.z).toBe(3)
  })
})

describe('Easing Functions', () => {
  const ctx = createContext()

  test('easeInQuad', () => {
    expect(evaluate(call('easeInQuad', num(0)), ctx)).toBe(0)
    expect(evaluate(call('easeInQuad', num(1)), ctx)).toBe(1)
    expect(evaluate(call('easeInQuad', num(0.5)), ctx)).toBe(0.25)
  })

  test('easeOutQuad', () => {
    expect(evaluate(call('easeOutQuad', num(0)), ctx)).toBe(0)
    expect(evaluate(call('easeOutQuad', num(1)), ctx)).toBe(1)
    expect(evaluate(call('easeOutQuad', num(0.5)), ctx)).toBe(0.75)
  })

  test('easeInOutQuad', () => {
    expect(evaluate(call('easeInOutQuad', num(0)), ctx)).toBe(0)
    expect(evaluate(call('easeInOutQuad', num(1)), ctx)).toBe(1)
    expect(evaluate(call('easeInOutQuad', num(0.5)), ctx)).toBe(0.5)
  })

  test('easeInCubic', () => {
    expect(evaluate(call('easeInCubic', num(0.5)), ctx)).toBe(0.125)
  })

  test('easeOutCubic', () => {
    expect(evaluate(call('easeOutCubic', num(0.5)), ctx)).toBe(0.875)
  })
})

// ============================================================================
// List Tests
// ============================================================================

describe('Lists', () => {
  const ctx = createContext()

  test('list literal', () => {
    const result = evaluate(list(num(1), num(2), num(3)), ctx) as number[]
    expect(result).toEqual([1, 2, 3])
  })

  test('empty list', () => {
    const result = evaluate(list(), ctx) as unknown[]
    expect(result).toEqual([])
  })

  test('mixed list', () => {
    const result = evaluate(list(num(1), str('two'), bool(true)), ctx)
    expect(result).toEqual([1, 'two', true])
  })

  test('len on list', () => {
    expect(evaluate(call('len', list(num(1), num(2), num(3))), ctx)).toBe(3)
  })
})

// ============================================================================
// Complex Expression Tests
// ============================================================================

describe('Complex Expressions', () => {
  test('nested arithmetic', () => {
    const ctx = createContext({ x: 10 })
    // (x + 5) * 2 - 3
    const expr = binary(binary(binary(id('x'), '+', num(5)), '*', num(2)), '-', num(3))
    expect(evaluate(expr, ctx)).toBe(27)
  })

  test('conditional logic', () => {
    const ctx = createContext({ level: 15, threshold: 19 })
    // level < threshold
    expect(evaluate(binary(id('level'), '<', id('threshold')), ctx)).toBe(true)
  })

  test('reactive expression', () => {
    const ctx = createContext(
      {},
      { player: { room: { o2_level: 18.5 } } },
      { atmosphere: { threshold: 19 } }
    )
    // $player.room.o2_level < $config.atmosphere.threshold
    const expr = binary(
      reactive('player', 'room', 'o2_level'),
      '<',
      reactive('config', 'atmosphere', 'threshold')
    )
    expect(evaluate(expr, ctx)).toBe(true)
  })

  test('function with expressions', () => {
    const ctx = createContext({ a: 5, b: 15 })
    // clamp(a + b, 0, 10)
    const expr = call('clamp', binary(id('a'), '+', id('b')), num(0), num(10))
    expect(evaluate(expr, ctx)).toBe(10)
  })
})

// ============================================================================
// Condition Evaluation Tests
// ============================================================================

describe('evaluateCondition', () => {
  test('returns boolean from boolean expression', () => {
    const ctx = createContext()
    expect(evaluateCondition(bool(true), ctx)).toBe(true)
    expect(evaluateCondition(bool(false), ctx)).toBe(false)
  })

  test('coerces number to boolean', () => {
    const ctx = createContext()
    expect(evaluateCondition(num(0), ctx)).toBe(false)
    expect(evaluateCondition(num(1), ctx)).toBe(true)
    expect(evaluateCondition(num(-1), ctx)).toBe(true)
  })

  test('coerces string to boolean', () => {
    const ctx = createContext()
    expect(evaluateCondition(str(''), ctx)).toBe(false)
    expect(evaluateCondition(str('hello'), ctx)).toBe(true)
  })

  test('comparison returns boolean', () => {
    const ctx = createContext({ x: 5 })
    expect(evaluateCondition(binary(id('x'), '>', num(3)), ctx)).toBe(true)
    expect(evaluateCondition(binary(id('x'), '>', num(10)), ctx)).toBe(false)
  })
})

// ============================================================================
// Match Evaluation Tests
// ============================================================================

describe('evaluateMatch', () => {
  test('finds matching case', () => {
    const ctx = createContext({ state: 'OPEN' })
    const cases: AST.MatchCase[] = [
      { kind: 'matchCase', pattern: str('CLOSED'), body: [], loc },
      { kind: 'matchCase', pattern: str('OPEN'), body: [], loc },
      { kind: 'matchCase', pattern: str('LOCKED'), body: [], loc },
    ]
    expect(evaluateMatch(id('state'), cases, ctx)).toBe(1)
  })

  test('returns -1 when no match', () => {
    const ctx = createContext({ state: 'UNKNOWN' })
    const cases: AST.MatchCase[] = [
      { kind: 'matchCase', pattern: str('CLOSED'), body: [], loc },
      { kind: 'matchCase', pattern: str('OPEN'), body: [], loc },
    ]
    expect(evaluateMatch(id('state'), cases, ctx)).toBe(-1)
  })

  test('matches numbers', () => {
    const ctx = createContext({ code: 42 })
    const cases: AST.MatchCase[] = [
      { kind: 'matchCase', pattern: num(0), body: [], loc },
      { kind: 'matchCase', pattern: num(42), body: [], loc },
    ]
    expect(evaluateMatch(id('code'), cases, ctx)).toBe(1)
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('isConstant', () => {
  test('literals are constant', () => {
    expect(isConstant(num(42))).toBe(true)
    expect(isConstant(str('hello'))).toBe(true)
    expect(isConstant(bool(true))).toBe(true)
    expect(isConstant(color('#ff0000'))).toBe(true)
  })

  test('identifiers are not constant', () => {
    expect(isConstant(id('x'))).toBe(false)
  })

  test('reactive refs are not constant', () => {
    expect(isConstant(reactive('player', 'x'))).toBe(false)
  })

  test('expressions with constants are constant', () => {
    expect(isConstant(binary(num(1), '+', num(2)))).toBe(true)
    expect(isConstant(vec3(num(1), num(2), num(3)))).toBe(true)
    expect(isConstant(call('max', num(1), num(2)))).toBe(true)
  })

  test('expressions with identifiers are not constant', () => {
    expect(isConstant(binary(id('x'), '+', num(2)))).toBe(false)
    expect(isConstant(vec3(num(1), id('y'), num(3)))).toBe(false)
  })
})

describe('getReactiveRefs', () => {
  test('finds reactive refs', () => {
    const expr = binary(reactive('player', 'x'), '+', reactive('config', 'speed'))
    const refs = getReactiveRefs(expr)
    expect(refs).toHaveLength(2)
    expect(refs).toContainEqual(['player', 'x'])
    expect(refs).toContainEqual(['config', 'speed'])
  })

  test('returns empty for no refs', () => {
    const refs = getReactiveRefs(num(42))
    expect(refs).toHaveLength(0)
  })

  test('finds refs in nested expressions', () => {
    const expr = call('clamp', reactive('value'), num(0), reactive('max'))
    const refs = getReactiveRefs(expr)
    expect(refs).toHaveLength(2)
  })
})

describe('getIdentifiers', () => {
  test('finds identifiers', () => {
    const expr = binary(id('x'), '+', id('y'))
    const ids = getIdentifiers(expr)
    expect(ids).toContain('x')
    expect(ids).toContain('y')
  })

  test('returns empty for no identifiers', () => {
    const ids = getIdentifiers(num(42))
    expect(ids).toHaveLength(0)
  })
})

// ============================================================================
// Custom Function Registration Tests
// ============================================================================

describe('Custom Functions', () => {
  test('registerBuiltin adds function', () => {
    registerBuiltin('double', (x) => (x as number) * 2)
    expect(hasBuiltin('double')).toBe(true)
    const ctx = createContext()
    expect(evaluate(call('double', num(5)), ctx)).toBe(10)
  })

  test('getBuiltinNames returns all names', () => {
    const names = getBuiltinNames()
    expect(names).toContain('abs')
    expect(names).toContain('clamp')
    expect(names).toContain('lerp')
  })

  test('hasBuiltin returns false for unknown', () => {
    expect(hasBuiltin('nonexistent_function')).toBe(false)
  })
})

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  test('unknown function throws EvalError', () => {
    const ctx = createContext()
    expect(() => evaluate(call('unknownFunc', num(1)), ctx)).toThrow(EvalError)
  })

  test('unknown binary operator throws EvalError', () => {
    const ctx = createContext()
    expect(() => evaluate(binary(num(1), '???', num(2)), ctx)).toThrow(EvalError)
  })

  test('unknown unary operator throws EvalError', () => {
    const ctx = createContext()
    expect(() => evaluate(unary('???', num(1)), ctx)).toThrow(EvalError)
  })

  test('error includes location', () => {
    const ctx = createContext()
    try {
      evaluate(call('unknownFunc', num(1)), ctx)
    } catch (e) {
      expect(e).toBeInstanceOf(EvalError)
      expect((e as EvalError).message).toContain('line 1')
    }
  })
})

// ============================================================================
// User-defined Function Tests
// ============================================================================

describe('User-defined Functions', () => {
  test('calls user function from context', () => {
    const ctx = createContext({
      myFunc: (a: number, b: number) => a + b,
    })
    expect(evaluate(call('myFunc', num(3), num(4)), ctx)).toBe(7)
  })

  test('user function with expressions', () => {
    const ctx = createContext({
      x: 10,
      scale: (v: number) => v * 2,
    })
    expect(evaluate(call('scale', id('x')), ctx)).toBe(20)
  })
})
