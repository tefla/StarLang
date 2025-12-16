/**
 * Tests for Forge Config System
 */

import { test, expect, describe, beforeEach } from 'bun:test'
import {
  getConfig,
  getConfigValue,
  getConfigNumber,
  getConfigString,
  getConfigBoolean,
  setConfigValue,
  clearConfig,
  loadConfigsFromSource,
  createConfigContext,
  getConfigNames,
  hasConfig,
} from './config'
import { evaluate } from './evaluator'
import { parse } from './parser'
import type * as AST from './types'

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  clearConfig()
})

// ============================================================================
// Config Registry Tests
// ============================================================================

describe('Config Registry', () => {
  test('setConfigValue and getConfigValue', () => {
    setConfigValue('foo', 42)
    expect(getConfigValue('foo')).toBe(42)
  })

  test('nested config values', () => {
    setConfigValue('atmosphere.o2.threshold', 19)
    setConfigValue('atmosphere.o2.depletion_rate', 0.05)
    setConfigValue('atmosphere.temp.min', 10)

    expect(getConfigValue('atmosphere.o2.threshold')).toBe(19)
    expect(getConfigValue('atmosphere.o2.depletion_rate')).toBe(0.05)
    expect(getConfigValue('atmosphere.temp.min')).toBe(10)
  })

  test('getConfigNumber with default', () => {
    setConfigValue('foo', 42)
    expect(getConfigNumber('foo')).toBe(42)
    expect(getConfigNumber('bar', 100)).toBe(100)
    expect(getConfigNumber('missing')).toBe(0)
  })

  test('getConfigString with default', () => {
    setConfigValue('name', 'test')
    expect(getConfigString('name')).toBe('test')
    expect(getConfigString('missing', 'default')).toBe('default')
    expect(getConfigString('missing')).toBe('')
  })

  test('getConfigBoolean with default', () => {
    setConfigValue('enabled', true)
    setConfigValue('disabled', false)
    expect(getConfigBoolean('enabled')).toBe(true)
    expect(getConfigBoolean('disabled')).toBe(false)
    expect(getConfigBoolean('missing', true)).toBe(true)
    expect(getConfigBoolean('missing')).toBe(false)
  })

  test('clearConfig removes all values', () => {
    setConfigValue('a', 1)
    setConfigValue('b', 2)
    clearConfig()
    expect(getConfigValue('a')).toBeUndefined()
    expect(getConfigValue('b')).toBeUndefined()
  })

  test('getConfig returns full registry', () => {
    setConfigValue('x', 1)
    setConfigValue('y', 2)
    const config = getConfig()
    expect(config.x).toBe(1)
    expect(config.y).toBe(2)
  })
})

// ============================================================================
// Config Parsing Tests
// ============================================================================

describe('Config Parsing', () => {
  test('simple config with literals', () => {
    const source = `
config settings
  value: 42
  name: "test"
  enabled: true
`
    loadConfigsFromSource(source)

    expect(getConfigValue('settings.value')).toBe(42)
    expect(getConfigValue('settings.name')).toBe('test')
    expect(getConfigValue('settings.enabled')).toBe(true)
  })

  test('nested config', () => {
    const source = `
config atmosphere
  o2:
    depletion_rate: 0.05
    warning_threshold: 19
    critical_threshold: 16
    gameover_threshold: 12
  temperature:
    min: 10
    max: 35
`
    loadConfigsFromSource(source)

    expect(getConfigValue('atmosphere.o2.depletion_rate')).toBe(0.05)
    expect(getConfigValue('atmosphere.o2.warning_threshold')).toBe(19)
    expect(getConfigValue('atmosphere.o2.critical_threshold')).toBe(16)
    expect(getConfigValue('atmosphere.o2.gameover_threshold')).toBe(12)
    expect(getConfigValue('atmosphere.temperature.min')).toBe(10)
    expect(getConfigValue('atmosphere.temperature.max')).toBe(35)
  })

  test('config with expressions', () => {
    const source = `
config math
  pi: 3.14159
  two_pi: 3.14159 * 2
  half: 100 / 2
  sum: 10 + 20 + 30
`
    loadConfigsFromSource(source)

    expect(getConfigValue('math.pi')).toBe(3.14159)
    expect(getConfigValue('math.two_pi')).toBeCloseTo(6.28318, 4)
    expect(getConfigValue('math.half')).toBe(50)
    expect(getConfigValue('math.sum')).toBe(60)
  })

  test('config with color literals', () => {
    const source = `
config colors
  primary: #ff0000
  secondary: #00ff00
`
    loadConfigsFromSource(source)

    expect(getConfigValue('colors.primary')).toBe('#ff0000')
    expect(getConfigValue('colors.secondary')).toBe('#00ff00')
  })

  test('multiple configs in one file', () => {
    const source = `
config world
  gravity: 9.81
  air_resistance: 0.1

config player
  speed: 5.0
  jump_height: 2.0
`
    loadConfigsFromSource(source)

    expect(getConfigValue('world.gravity')).toBe(9.81)
    expect(getConfigValue('player.speed')).toBe(5.0)
  })

  test('deeply nested config', () => {
    const source = `
config game
  levels:
    level1:
      enemies:
        count: 10
        speed: 1.5
      rewards:
        gold: 100
`
    loadConfigsFromSource(source)

    expect(getConfigValue('game.levels.level1.enemies.count')).toBe(10)
    expect(getConfigValue('game.levels.level1.enemies.speed')).toBe(1.5)
    expect(getConfigValue('game.levels.level1.rewards.gold')).toBe(100)
  })
})

// ============================================================================
// Config AST Tests
// ============================================================================

describe('Config AST', () => {
  test('parsed config has correct structure', () => {
    const source = `
config test
  value: 42
`
    const module = parse(source)
    expect(module.definitions).toHaveLength(1)

    const config = module.definitions[0] as AST.ConfigDef
    expect(config.kind).toBe('config')
    expect(config.name).toBe('test')
    expect('value' in config.properties).toBe(true)
  })

  test('nested config produces configObject nodes', () => {
    const source = `
config test
  outer:
    inner: 42
`
    const module = parse(source)
    const config = module.definitions[0] as AST.ConfigDef

    expect(config.properties.outer).toBeDefined()
    const outer = config.properties.outer as AST.ConfigObject
    expect(outer.kind).toBe('configObject')
    expect('inner' in outer.properties).toBe(true)
  })
})

// ============================================================================
// Config Context Integration Tests
// ============================================================================

describe('Config Context Integration', () => {
  test('evaluator can access config via reactive refs', () => {
    const source = `
config settings
  threshold: 50
  multiplier: 2
`
    loadConfigsFromSource(source)

    const ctx = createConfigContext({}, {})

    // Create a reactive ref expression: $config.settings.threshold
    const expr: AST.ReactiveRef = {
      kind: 'reactive',
      path: ['config', 'settings', 'threshold'],
      loc: { line: 1, column: 1 }
    }

    expect(evaluate(expr, ctx)).toBe(50)
  })

  test('config values available in expression evaluation', () => {
    const source = `
config game
  base_damage: 10
  crit_multiplier: 2.5
`
    loadConfigsFromSource(source)

    const ctx = createConfigContext({ attack: 5 }, {})

    // Simulate: $config.game.base_damage + attack
    const expr: AST.BinaryOp = {
      kind: 'binary',
      operator: '+',
      left: {
        kind: 'reactive',
        path: ['config', 'game', 'base_damage'],
        loc: { line: 1, column: 1 }
      },
      right: {
        kind: 'identifier',
        name: 'attack',
        loc: { line: 1, column: 1 }
      },
      loc: { line: 1, column: 1 }
    }

    expect(evaluate(expr, ctx)).toBe(15)
  })
})

// ============================================================================
// Config Utility Tests
// ============================================================================

describe('Config Utilities', () => {
  test('getConfigNames returns loaded config names', () => {
    loadConfigsFromSource(`
config alpha
  x: 1

config beta
  y: 2
`)
    const names = getConfigNames()
    expect(names).toContain('alpha')
    expect(names).toContain('beta')
  })

  test('hasConfig checks if config exists', () => {
    loadConfigsFromSource(`
config test
  value: 42
`)
    expect(hasConfig('test')).toBe(true)
    expect(hasConfig('missing')).toBe(false)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Config Edge Cases', () => {
  test('empty config', () => {
    // This should parse but produce empty properties
    const source = `
config empty
  placeholder: 0
`
    loadConfigsFromSource(source)
    expect(hasConfig('empty')).toBe(true)
  })

  test('config with negative numbers', () => {
    const source = `
config numbers
  negative: -10
  zero: 0
  positive: 10
`
    loadConfigsFromSource(source)

    expect(getConfigValue('numbers.negative')).toBe(-10)
    expect(getConfigValue('numbers.zero')).toBe(0)
    expect(getConfigValue('numbers.positive')).toBe(10)
  })

  test('config with float values', () => {
    const source = `
config floats
  pi: 3.14159
  e: 2.71828
  small: 0.001
`
    loadConfigsFromSource(source)

    expect(getConfigValue('floats.pi')).toBeCloseTo(3.14159, 5)
    expect(getConfigValue('floats.e')).toBeCloseTo(2.71828, 5)
    expect(getConfigValue('floats.small')).toBeCloseTo(0.001, 5)
  })

  test('overwriting config values', () => {
    loadConfigsFromSource(`
config test
  value: 1
`)
    expect(getConfigValue('test.value')).toBe(1)

    loadConfigsFromSource(`
config test
  value: 2
`)
    expect(getConfigValue('test.value')).toBe(2)
  })
})
