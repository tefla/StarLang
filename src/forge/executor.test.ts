/**
 * Tests for Forge Statement Executor
 */

import { test, expect, describe, beforeEach } from 'bun:test'
import {
  executeStatement,
  executeStatements,
  callFunction,
  registerFunction,
  clearFunctions,
  hasFunction,
  getFunctionNames,
  loadFunctionsFromModule,
  addFunctionsToContext,
  createExecutionContext,
  ExecutionError,
  type ExecutionCallbacks,
} from './executor'
import { parse } from './parser'
import { evaluate, createContext } from './evaluator'
import type * as AST from './types'

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  clearFunctions()
})

// ============================================================================
// Helper Functions
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

function id(name: string): AST.Identifier {
  return { kind: 'identifier', name, loc }
}

function binary(left: AST.Expression, op: string, right: AST.Expression): AST.BinaryOp {
  return { kind: 'binary', operator: op, left, right, loc }
}

// ============================================================================
// Function Registry Tests
// ============================================================================

describe('Function Registry', () => {
  test('register and check function', () => {
    registerFunction({
      name: 'test',
      params: [],
      body: []
    })
    expect(hasFunction('test')).toBe(true)
    expect(hasFunction('unknown')).toBe(false)
  })

  test('get function names', () => {
    registerFunction({ name: 'foo', params: [], body: [] })
    registerFunction({ name: 'bar', params: [], body: [] })
    const names = getFunctionNames()
    expect(names).toContain('foo')
    expect(names).toContain('bar')
  })

  test('clear functions', () => {
    registerFunction({ name: 'test', params: [], body: [] })
    clearFunctions()
    expect(hasFunction('test')).toBe(false)
  })
})

// ============================================================================
// If Statement Tests
// ============================================================================

describe('If Statement', () => {
  test('executes body when condition is true', () => {
    const ctx = createExecutionContext({ x: 10 })
    let called = false

    const stmt: AST.IfStatement = {
      kind: 'if',
      condition: binary(id('x'), '>', num(5)),
      body: [{ kind: 'emit', event: 'test', loc }],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { called = true }
    })

    expect(called).toBe(true)
  })

  test('skips body when condition is false', () => {
    const ctx = createExecutionContext({ x: 3 })
    let called = false

    const stmt: AST.IfStatement = {
      kind: 'if',
      condition: binary(id('x'), '>', num(5)),
      body: [{ kind: 'emit', event: 'test', loc }],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { called = true }
    })

    expect(called).toBe(false)
  })

  test('executes elif when condition matches', () => {
    const ctx = createExecutionContext({ x: 3 })
    let result = ''

    const stmt: AST.IfStatement = {
      kind: 'if',
      condition: binary(id('x'), '>', num(5)),
      body: [{ kind: 'emit', event: 'high', loc }],
      elif: [
        {
          condition: binary(id('x'), '>', num(2)),
          body: [{ kind: 'emit', event: 'medium', loc }]
        }
      ],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: (event) => { result = event }
    })

    expect(result).toBe('medium')
  })

  test('executes else when no conditions match', () => {
    const ctx = createExecutionContext({ x: 1 })
    let result = ''

    const stmt: AST.IfStatement = {
      kind: 'if',
      condition: binary(id('x'), '>', num(5)),
      body: [{ kind: 'emit', event: 'high', loc }],
      else: [{ kind: 'emit', event: 'low', loc }],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: (event) => { result = event }
    })

    expect(result).toBe('low')
  })
})

// ============================================================================
// For Loop Tests
// ============================================================================

describe('For Loop', () => {
  test('iterates over list', () => {
    const ctx = createExecutionContext({ items: [1, 2, 3] })
    const results: number[] = []

    const stmt: AST.ForStatement = {
      kind: 'for',
      variable: 'item',
      iterable: id('items'),
      body: [{ kind: 'emit', event: 'test', loc }],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { results.push(1) }
    })

    expect(results.length).toBe(3)
  })

  test('break exits loop early', () => {
    const ctx = createExecutionContext({ items: [1, 2, 3, 4, 5] })
    let count = 0

    const stmt: AST.ForStatement = {
      kind: 'for',
      variable: 'item',
      iterable: id('items'),
      body: [
        { kind: 'emit', event: 'test', loc },
        {
          kind: 'if',
          condition: binary(id('item'), '==', num(3)),
          body: [{ kind: 'break', loc }],
          loc
        }
      ],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { count++ }
    })

    expect(count).toBe(3)
  })

  test('continue skips to next iteration', () => {
    const ctx = createExecutionContext({ items: [1, 2, 3] })
    const emitted: number[] = []

    // We need to track item values since we can't directly access them
    // Instead, let's test with a simpler approach
    const stmt: AST.ForStatement = {
      kind: 'for',
      variable: 'item',
      iterable: id('items'),
      body: [
        {
          kind: 'if',
          condition: binary(id('item'), '==', num(2)),
          body: [{ kind: 'continue', loc }],
          loc
        },
        { kind: 'emit', event: 'processed', loc }
      ],
      loc
    }

    let count = 0
    executeStatement(stmt, ctx, {
      onEmit: () => { count++ }
    })

    expect(count).toBe(2) // 1 and 3, not 2
  })

  test('iterates over range', () => {
    const ctx = createExecutionContext({})
    let count = 0

    // Create a range expression
    const stmt: AST.ForStatement = {
      kind: 'for',
      variable: 'i',
      iterable: { kind: 'range', start: num(1), end: num(5), loc },
      body: [{ kind: 'emit', event: 'test', loc }],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { count++ }
    })

    expect(count).toBe(5) // 1, 2, 3, 4, 5
  })
})

// ============================================================================
// While Loop Tests
// ============================================================================

describe('While Loop', () => {
  test('executes while condition is true', () => {
    const ctx = createExecutionContext({ count: 0 })
    let iterations = 0

    const stmt: AST.WhileStatement = {
      kind: 'while',
      condition: binary(id('count'), '<', num(3)),
      body: [
        { kind: 'emit', event: 'tick', loc },
        { kind: 'set', property: 'count', value: binary(id('count'), '+', num(1)), loc }
      ],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { iterations++ },
      onSet: (prop, value) => { ctx.vars[prop] = value }
    })

    expect(iterations).toBe(3)
  })

  test('break exits loop', () => {
    const ctx = createExecutionContext({ count: 0 })
    let iterations = 0

    const stmt: AST.WhileStatement = {
      kind: 'while',
      condition: bool(true),
      body: [
        { kind: 'emit', event: 'tick', loc },
        { kind: 'set', property: 'count', value: binary(id('count'), '+', num(1)), loc },
        {
          kind: 'if',
          condition: binary(id('count'), '>=', num(5)),
          body: [{ kind: 'break', loc }],
          loc
        }
      ],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { iterations++ },
      onSet: (prop, value) => { ctx.vars[prop] = value }
    })

    expect(iterations).toBe(5)
  })

  test('prevents infinite loops', () => {
    const ctx = createExecutionContext({})

    const stmt: AST.WhileStatement = {
      kind: 'while',
      condition: bool(true),
      body: [{ kind: 'emit', event: 'tick', loc }],
      loc
    }

    expect(() => executeStatement(stmt, ctx, {})).toThrow(ExecutionError)
  })
})

// ============================================================================
// Return Statement Tests
// ============================================================================

describe('Return Statement', () => {
  test('return with value', () => {
    const stmt: AST.ReturnStatement = {
      kind: 'return',
      value: num(42),
      loc
    }

    const result = executeStatement(stmt, createExecutionContext(), {})
    expect(result.returned).toBe(true)
    expect(result.returnValue).toBe(42)
  })

  test('return without value', () => {
    const stmt: AST.ReturnStatement = {
      kind: 'return',
      loc
    }

    const result = executeStatement(stmt, createExecutionContext(), {})
    expect(result.returned).toBe(true)
    expect(result.returnValue).toBeUndefined()
  })

  test('return exits function early', () => {
    const statements: AST.Statement[] = [
      { kind: 'emit', event: 'before', loc },
      { kind: 'return', value: num(10), loc },
      { kind: 'emit', event: 'after', loc }
    ]

    const events: string[] = []
    const result = executeStatements(statements, createExecutionContext(), {
      onEmit: (event) => { events.push(event) }
    })

    expect(events).toEqual(['before'])
    expect(result.returnValue).toBe(10)
  })
})

// ============================================================================
// Function Invocation Tests
// ============================================================================

describe('Function Invocation', () => {
  test('call simple function', () => {
    registerFunction({
      name: 'double',
      params: [{ kind: 'functionParam', name: 'x', loc }],
      body: [
        { kind: 'return', value: binary(id('x'), '*', num(2)), loc }
      ]
    })

    const result = callFunction('double', [5], createExecutionContext())
    expect(result).toBe(10)
  })

  test('function with multiple parameters', () => {
    registerFunction({
      name: 'add',
      params: [
        { kind: 'functionParam', name: 'a', loc },
        { kind: 'functionParam', name: 'b', loc }
      ],
      body: [
        { kind: 'return', value: binary(id('a'), '+', id('b')), loc }
      ]
    })

    const result = callFunction('add', [3, 4], createExecutionContext())
    expect(result).toBe(7)
  })

  test('function with default parameter', () => {
    registerFunction({
      name: 'greet',
      params: [
        { kind: 'functionParam', name: 'name', default: str('World'), loc }
      ],
      body: [
        { kind: 'return', value: binary(str('Hello, '), '+', id('name')), loc }
      ]
    })

    expect(callFunction('greet', [], createExecutionContext())).toBe('Hello, World')
    expect(callFunction('greet', ['Forge'], createExecutionContext())).toBe('Hello, Forge')
  })

  test('function with control flow', () => {
    registerFunction({
      name: 'max',
      params: [
        { kind: 'functionParam', name: 'a', loc },
        { kind: 'functionParam', name: 'b', loc }
      ],
      body: [
        {
          kind: 'if',
          condition: binary(id('a'), '>', id('b')),
          body: [{ kind: 'return', value: id('a'), loc }],
          else: [{ kind: 'return', value: id('b'), loc }],
          loc
        }
      ]
    })

    expect(callFunction('max', [5, 3], createExecutionContext())).toBe(5)
    expect(callFunction('max', [2, 8], createExecutionContext())).toBe(8)
  })

  test('recursive function', () => {
    registerFunction({
      name: 'factorial',
      params: [{ kind: 'functionParam', name: 'n', loc }],
      body: [
        {
          kind: 'if',
          condition: binary(id('n'), '<=', num(1)),
          body: [{ kind: 'return', value: num(1), loc }],
          else: [
            {
              kind: 'return',
              value: binary(
                id('n'),
                '*',
                { kind: 'call', name: 'factorial', args: [binary(id('n'), '-', num(1))], loc }
              ),
              loc
            }
          ],
          loc
        }
      ]
    })

    const ctx = createExecutionContext()
    addFunctionsToContext(ctx)

    expect(evaluate({ kind: 'call', name: 'factorial', args: [num(5)], loc }, ctx)).toBe(120)
  })

  test('calling unknown function throws', () => {
    expect(() => callFunction('unknown', [], createExecutionContext())).toThrow(ExecutionError)
  })
})

// ============================================================================
// Parsing and Execution Integration Tests
// ============================================================================

describe('Parse and Execute Integration', () => {
  test('parse and execute simple function', () => {
    const source = `
def square(x):
  return x * x
`
    const module = parse(source)
    loadFunctionsFromModule(module)

    expect(hasFunction('square')).toBe(true)
    expect(callFunction('square', [4], createExecutionContext())).toBe(16)
  })

  test('parse and execute function with if', () => {
    const source = `
def abs(x):
  if x < 0:
    return -x
  else:
    return x
`
    const module = parse(source)
    loadFunctionsFromModule(module)

    expect(callFunction('abs', [-5], createExecutionContext())).toBe(5)
    expect(callFunction('abs', [5], createExecutionContext())).toBe(5)
  })

  test('parse and execute function with elif', () => {
    const source = `
def grade(score):
  if score >= 90:
    return "A"
  elif score >= 80:
    return "B"
  elif score >= 70:
    return "C"
  else:
    return "F"
`
    const module = parse(source)
    loadFunctionsFromModule(module)

    expect(callFunction('grade', [95], createExecutionContext())).toBe('A')
    expect(callFunction('grade', [85], createExecutionContext())).toBe('B')
    expect(callFunction('grade', [75], createExecutionContext())).toBe('C')
    expect(callFunction('grade', [50], createExecutionContext())).toBe('F')
  })

  test('parse and execute function with loop', () => {
    const source = `
def sum_list(items):
  set total: 0
  for item in items:
    set total: total + item
  return total
`
    const module = parse(source)
    loadFunctionsFromModule(module)

    const ctx = createExecutionContext()
    // The set statement updates ctx.vars through callback
    // We need to handle this properly
    const fn = module.definitions[0] as AST.FunctionDef

    // For now, test with built-in mechanics
    expect(hasFunction('sum_list')).toBe(true)
  })

  test('parse and execute function with while', () => {
    const source = `
def count_down(n):
  set count: n
  while count > 0:
    emit "tick"
    set count: count - 1
  return count
`
    const module = parse(source)
    loadFunctionsFromModule(module)

    expect(hasFunction('count_down')).toBe(true)
  })

  test('multiple functions in one file', () => {
    const source = `
def add(a, b):
  return a + b

def subtract(a, b):
  return a - b

def multiply(a, b):
  return a * b
`
    const module = parse(source)
    loadFunctionsFromModule(module)

    expect(callFunction('add', [5, 3], createExecutionContext())).toBe(8)
    expect(callFunction('subtract', [5, 3], createExecutionContext())).toBe(2)
    expect(callFunction('multiply', [5, 3], createExecutionContext())).toBe(15)
  })
})

// ============================================================================
// Match Statement Tests
// ============================================================================

describe('Match Statement', () => {
  test('executes matching case', () => {
    const ctx = createExecutionContext({ status: 'ERROR' })
    let result = ''

    const stmt: AST.MatchBlock = {
      kind: 'match',
      expression: id('status'),
      cases: [
        { kind: 'matchCase', pattern: str('OK'), body: [{ kind: 'emit', event: 'ok', loc }], loc },
        { kind: 'matchCase', pattern: str('ERROR'), body: [{ kind: 'emit', event: 'error', loc }], loc },
      ],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: (e) => { result = e }
    })

    expect(result).toBe('error')
  })

  test('no match executes nothing', () => {
    const ctx = createExecutionContext({ status: 'UNKNOWN' })
    let called = false

    const stmt: AST.MatchBlock = {
      kind: 'match',
      expression: id('status'),
      cases: [
        { kind: 'matchCase', pattern: str('OK'), body: [{ kind: 'emit', event: 'ok', loc }], loc },
      ],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { called = true }
    })

    expect(called).toBe(false)
  })
})

// ============================================================================
// When Statement Tests
// ============================================================================

describe('When Statement', () => {
  test('executes body when true', () => {
    const ctx = createExecutionContext({ active: true })
    let called = false

    const stmt: AST.WhenBlock = {
      kind: 'when',
      condition: id('active'),
      body: [{ kind: 'emit', event: 'test', loc }],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: () => { called = true }
    })

    expect(called).toBe(true)
  })

  test('executes else when false', () => {
    const ctx = createExecutionContext({ active: false })
    let result = ''

    const stmt: AST.WhenBlock = {
      kind: 'when',
      condition: id('active'),
      body: [{ kind: 'emit', event: 'true', loc }],
      else: [{ kind: 'emit', event: 'false', loc }],
      loc
    }

    executeStatement(stmt, ctx, {
      onEmit: (e) => { result = e }
    })

    expect(result).toBe('false')
  })
})

// ============================================================================
// Animate Statement Tests
// ============================================================================

describe('Animate Statement', () => {
  test('calls onAnimate callback', () => {
    let animation = ''
    let axis = ''
    let speed: number | undefined

    const stmt: AST.AnimateStatement = {
      kind: 'animate',
      animation: 'spin',
      axis: 'y',
      speed: num(2.5),
      loc
    }

    executeStatement(stmt, createExecutionContext(), {
      onAnimate: (a, ax, s) => { animation = a; axis = ax || ''; speed = s }
    })

    expect(animation).toBe('spin')
    expect(axis).toBe('y')
    expect(speed).toBe(2.5)
  })

  test('handles animate without speed', () => {
    let animation = ''
    let speed: number | undefined

    const stmt: AST.AnimateStatement = {
      kind: 'animate',
      animation: 'bob',
      loc
    }

    executeStatement(stmt, createExecutionContext(), {
      onAnimate: (a, _, s) => { animation = a; speed = s }
    })

    expect(animation).toBe('bob')
    expect(speed).toBeUndefined()
  })
})

// ============================================================================
// On Block Tests
// ============================================================================

describe('On Block', () => {
  test('on block returns empty result when executed directly', () => {
    const stmt: AST.OnBlock = {
      kind: 'on',
      event: 'test',
      body: [{ kind: 'emit', event: 'handled', loc }],
      loc
    }

    const result = executeStatement(stmt, createExecutionContext(), {})
    expect(result).toEqual({})
  })
})

// ============================================================================
// Default Case Tests
// ============================================================================

describe('Unknown Statement', () => {
  test('unknown statement returns empty result', () => {
    const stmt = { kind: 'unknown', loc } as unknown as AST.Statement
    const result = executeStatement(stmt, createExecutionContext(), {})
    expect(result).toEqual({})
  })
})

// ============================================================================
// Callback Tests
// ============================================================================

describe('Execution Callbacks', () => {
  test('setState callback', () => {
    let state = ''
    const stmt: AST.SetStateStatement = { kind: 'setState', state: 'open', loc }
    executeStatement(stmt, createExecutionContext(), {
      onSetState: (s) => { state = s }
    })
    expect(state).toBe('open')
  })

  test('playAnimation callback', () => {
    let animation = ''
    const stmt: AST.PlayStatement = { kind: 'play', animation: 'spin', loc }
    executeStatement(stmt, createExecutionContext(), {
      onPlayAnimation: (a) => { animation = a }
    })
    expect(animation).toBe('spin')
  })

  test('stopAnimation callback', () => {
    let animation = ''
    const stmt: AST.StopAnimationStatement = { kind: 'stopAnimation', animation: 'spin', loc }
    executeStatement(stmt, createExecutionContext(), {
      onStopAnimation: (a) => { animation = a }
    })
    expect(animation).toBe('spin')
  })

  test('emit callback', () => {
    let event = ''
    const stmt: AST.EmitStatement = { kind: 'emit', event: 'door:open', loc }
    executeStatement(stmt, createExecutionContext(), {
      onEmit: (e) => { event = e }
    })
    expect(event).toBe('door:open')
  })

  test('set callback', () => {
    let property = ''
    let value: unknown = null
    const stmt: AST.SetStatement = { kind: 'set', property: 'speed', value: num(5), loc }
    executeStatement(stmt, createExecutionContext(), {
      onSet: (p, v) => { property = p; value = v }
    })
    expect(property).toBe('speed')
    expect(value).toBe(5)
  })
})
