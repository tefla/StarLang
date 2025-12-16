/**
 * Forge Config Registry
 *
 * Manages configuration values loaded from .config.forge files.
 * Configuration is evaluated at load time and stored as a flat key-value structure.
 */

import { parse } from './parser'
import { evaluate, createContext, type EvalContext } from './evaluator'
import type * as AST from './types'

// ============================================================================
// Types
// ============================================================================

export type ConfigValueType = number | string | boolean | ConfigRecord

export interface ConfigRecord {
  [key: string]: ConfigValueType
}

// ============================================================================
// Config Registry
// ============================================================================

/**
 * Global config registry storing evaluated configuration values.
 */
const configRegistry: ConfigRecord = {}

/**
 * Get the full config registry.
 */
export function getConfig(): ConfigRecord {
  return configRegistry
}

/**
 * Get a config value by path (e.g., "atmosphere.o2.threshold").
 */
export function getConfigValue(path: string): ConfigValueType | undefined {
  const parts = path.split('.')
  let current: ConfigValueType | undefined = configRegistry

  for (const part of parts) {
    if (current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as ConfigRecord)[part]
  }

  return current
}

/**
 * Get a config value with type checking.
 */
export function getConfigNumber(path: string, defaultValue: number = 0): number {
  const value = getConfigValue(path)
  return typeof value === 'number' ? value : defaultValue
}

export function getConfigString(path: string, defaultValue: string = ''): string {
  const value = getConfigValue(path)
  return typeof value === 'string' ? value : defaultValue
}

export function getConfigBoolean(path: string, defaultValue: boolean = false): boolean {
  const value = getConfigValue(path)
  return typeof value === 'boolean' ? value : defaultValue
}

/**
 * Set a config value by path.
 */
export function setConfigValue(path: string, value: ConfigValueType): void {
  const parts = path.split('.')
  let current: ConfigRecord = configRegistry

  // Navigate to parent, creating intermediate objects as needed
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part] as ConfigRecord
  }

  // Set the value
  const lastPart = parts[parts.length - 1]!
  current[lastPart] = value
}

/**
 * Clear all config values.
 */
export function clearConfig(): void {
  for (const key of Object.keys(configRegistry)) {
    delete configRegistry[key]
  }
}

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load a config definition into the registry.
 */
export function loadConfigDef(configDef: AST.ConfigDef): void {
  const ctx = createContext({}, {}, configRegistry)
  const evaluated = evaluateConfigProperties(configDef.properties, ctx)
  configRegistry[configDef.name] = evaluated
}

/**
 * Recursively evaluate config properties.
 */
function evaluateConfigProperties(
  properties: Record<string, AST.ConfigValue>,
  ctx: EvalContext
): ConfigRecord {
  const result: ConfigRecord = {}

  for (const [key, value] of Object.entries(properties)) {
    if (value.kind === 'configObject') {
      // Nested config object
      result[key] = evaluateConfigProperties(value.properties, ctx)
    } else {
      // Expression - evaluate it
      const evaluated = evaluate(value, ctx)
      result[key] = toConfigValue(evaluated)
    }
  }

  return result
}

/**
 * Convert an evaluated expression result to a config value.
 */
function toConfigValue(value: unknown): ConfigValueType {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined) return 0

  // Handle objects (like Vec3, ColorValue, etc.)
  if (typeof value === 'object') {
    if ('hex' in value) {
      // ColorValue - store as hex string
      return (value as { hex: string }).hex
    }
    if ('x' in value && 'y' in value) {
      // Vec2 or Vec3 - convert to record
      const result: ConfigRecord = {}
      for (const [k, v] of Object.entries(value)) {
        result[k] = toConfigValue(v)
      }
      return result
    }
    // Generic object
    const result: ConfigRecord = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = toConfigValue(v)
    }
    return result
  }

  return String(value)
}

/**
 * Load configs from a Forge module.
 */
export function loadConfigsFromModule(module: AST.ForgeModule): void {
  for (const def of module.definitions) {
    if (def.kind === 'config') {
      loadConfigDef(def)
    }
  }
}

/**
 * Parse and load configs from Forge source.
 */
export function loadConfigsFromSource(source: string): void {
  const module = parse(source)
  loadConfigsFromModule(module)
}

// ============================================================================
// Config Evaluation Context Integration
// ============================================================================

/**
 * Create an evaluation context with config values loaded.
 */
export function createConfigContext(
  vars: Record<string, unknown> = {},
  state: Record<string, unknown> = {}
): EvalContext {
  return createContext(vars, state, configRegistry)
}

/**
 * Get all config names currently loaded.
 */
export function getConfigNames(): string[] {
  return Object.keys(configRegistry)
}

/**
 * Check if a config is loaded.
 */
export function hasConfig(name: string): boolean {
  return name in configRegistry
}
