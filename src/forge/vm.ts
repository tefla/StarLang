/**
 * ForgeVM - Virtual Machine for Forge Scripting
 *
 * The ForgeVM is the runtime engine that executes Forge scripts:
 * - Manages game state
 * - Executes tick-based rules
 * - Dispatches events to handlers
 * - Runs behaviors for entities
 */

import {
  executeStatements,
  loadFunctionsFromModule,
  addFunctionsToContext,
  clearFunctions,
  type ExecutionCallbacks,
} from './executor'
import {
  loadConfigsFromModule,
  clearConfig,
  getConfig,
  type ConfigRecord,
} from './config'
import {
  createContext,
  evaluateCondition,
  type EvalContext,
} from './evaluator'
import { parse } from './parser'
import type * as AST from './types'

// ============================================================================
// Types
// ============================================================================

/**
 * Game state managed by the VM.
 */
export interface VMState {
  [key: string]: unknown
}

/**
 * Event dispatched in the VM.
 */
export interface VMEvent {
  name: string
  data?: Record<string, unknown>
}

/**
 * Listener for VM events.
 */
export type VMEventListener = (event: VMEvent) => void

/**
 * Registered rule in the VM.
 */
interface VMRule {
  name: string
  trigger: 'tick' | string
  condition?: AST.Expression
  effects: AST.Statement[]
}

/**
 * Registered scenario in the VM.
 */
interface VMScenario {
  name: string
  initial: Record<string, AST.Expression>
  handlers: AST.OnBlock[]
}

/**
 * Registered behavior in the VM.
 */
interface VMBehavior {
  name: string
  handlers: AST.OnBlock[]
}

// ============================================================================
// ForgeVM Class
// ============================================================================

export class ForgeVM {
  private state: VMState = {}
  private rules: VMRule[] = []
  private scenarios: VMScenario[] = []
  private behaviors: VMBehavior[] = []
  private eventListeners: Map<string, VMEventListener[]> = new Map()
  private activeScenario: VMScenario | null = null
  private tickCount = 0
  private paused = false

  // Execution callbacks for side effects
  private callbacks: ExecutionCallbacks = {}

  constructor() {
    // Initialize with empty state
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get the current game state.
   */
  getState(): VMState {
    return this.state
  }

  /**
   * Get a state value by path (e.g., "player.room.o2_level").
   */
  getStateValue(path: string): unknown {
    const parts = path.split('.')
    let current: unknown = this.state

    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }

    return current
  }

  /**
   * Set a state value by path.
   */
  setStateValue(path: string, value: unknown): void {
    const parts = path.split('.')
    let current: Record<string, unknown> = this.state

    // Navigate to parent, creating intermediate objects as needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    // Set the value
    const lastPart = parts[parts.length - 1]!
    current[lastPart] = value
  }

  /**
   * Merge state values.
   */
  mergeState(values: VMState): void {
    for (const [key, value] of Object.entries(values)) {
      this.setStateValue(key, value)
    }
  }

  /**
   * Reset state to initial values.
   */
  resetState(): void {
    this.state = {}
    this.tickCount = 0
  }

  // ============================================================================
  // Loading
  // ============================================================================

  /**
   * Load a Forge module into the VM.
   */
  loadModule(module: AST.ForgeModule): void {
    // Load configs
    loadConfigsFromModule(module)

    // Load functions
    loadFunctionsFromModule(module)

    // Load rules
    for (const def of module.definitions) {
      if (def.kind === 'rule') {
        this.rules.push({
          name: def.name,
          trigger: def.trigger,
          condition: def.condition,
          effects: def.effects,
        })
      }
    }

    // Load scenarios
    for (const def of module.definitions) {
      if (def.kind === 'scenario') {
        this.scenarios.push({
          name: def.name,
          initial: def.initial,
          handlers: def.handlers,
        })
      }
    }

    // Load behaviors
    for (const def of module.definitions) {
      if (def.kind === 'behavior') {
        this.behaviors.push({
          name: def.name,
          handlers: def.handlers,
        })
      }
    }
  }

  /**
   * Load Forge source code into the VM.
   */
  loadSource(source: string): void {
    const module = parse(source)
    this.loadModule(module)
  }

  /**
   * Clear all loaded content.
   */
  clear(): void {
    this.rules = []
    this.scenarios = []
    this.behaviors = []
    this.activeScenario = null
    this.eventListeners.clear()
    clearFunctions()
    clearConfig()
    this.resetState()
  }

  // ============================================================================
  // Scenario Management
  // ============================================================================

  /**
   * Start a scenario by name.
   */
  startScenario(name: string): boolean {
    const scenario = this.scenarios.find(s => s.name === name)
    if (!scenario) return false

    this.activeScenario = scenario

    // Apply initial state
    const ctx = this.createContext()
    for (const [key, expr] of Object.entries(scenario.initial)) {
      const value = this.evaluateExpression(expr, ctx)
      this.setStateValue(key, value)
    }

    this.emit('scenario:start', { name })
    return true
  }

  /**
   * Get the current scenario name.
   */
  getCurrentScenario(): string | null {
    return this.activeScenario?.name ?? null
  }

  /**
   * Get all available scenario names.
   */
  getScenarioNames(): string[] {
    return this.scenarios.map(s => s.name)
  }

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Set execution callbacks for side effects.
   */
  setCallbacks(callbacks: ExecutionCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Execute a single tick.
   * @param delta Time since last tick in seconds
   */
  tick(delta: number = 1 / 60): void {
    if (this.paused) return

    this.tickCount++
    this.setStateValue('delta', delta)
    this.setStateValue('tickCount', this.tickCount)

    // Execute tick-triggered rules
    for (const rule of this.rules) {
      if (rule.trigger === 'tick') {
        this.executeRule(rule)
      }
    }

    // Check scenario handlers
    if (this.activeScenario) {
      for (const handler of this.activeScenario.handlers) {
        this.executeHandler(handler)
      }
    }
  }

  /**
   * Pause execution.
   */
  pause(): void {
    this.paused = true
  }

  /**
   * Resume execution.
   */
  resume(): void {
    this.paused = false
  }

  /**
   * Check if execution is paused.
   */
  isPaused(): boolean {
    return this.paused
  }

  /**
   * Execute a rule if its condition is met.
   */
  private executeRule(rule: VMRule): void {
    const ctx = this.createContext()

    // Check condition
    if (rule.condition) {
      if (!evaluateCondition(rule.condition, ctx)) {
        return
      }
    }

    // Execute effects
    executeStatements(rule.effects, ctx, this.createExecutionCallbacks())
  }

  /**
   * Execute an event handler if its condition is met.
   */
  private executeHandler(handler: AST.OnBlock): void {
    const ctx = this.createContext()

    // Check condition
    if (handler.condition) {
      if (!evaluateCondition(handler.condition, ctx)) {
        return
      }
    }

    // Execute body
    executeStatements(handler.body, ctx, this.createExecutionCallbacks())
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Emit an event.
   * If data includes $entity, it will be set as entity context during handler execution.
   */
  emit(name: string, data?: Record<string, unknown>): void {
    const event: VMEvent = { name, data }

    // Set entity context if provided in event data
    const entityId = data?.$entity as string | undefined
    const previousEntity = this.getEntityContext()
    if (entityId) {
      this.setEntityContext(entityId)
    }

    try {
      // Execute event-triggered rules
      for (const rule of this.rules) {
        if (rule.trigger === name) {
          this.executeRule(rule)
        }
      }

      // Execute behavior handlers
      for (const behavior of this.behaviors) {
        for (const handler of behavior.handlers) {
          if (handler.event === name) {
            this.executeHandler(handler)
          }
        }
      }
    } finally {
      // Restore previous entity context
      this.setEntityContext(previousEntity)
    }

    // Notify external listeners
    const listeners = this.eventListeners.get(name)
    if (listeners) {
      for (const listener of listeners) {
        listener(event)
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.eventListeners.get('*')
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        listener(event)
      }
    }
  }

  /**
   * Subscribe to an event.
   */
  on(event: string, listener: VMEventListener): () => void {
    const listeners = this.eventListeners.get(event) ?? []
    listeners.push(listener)
    this.eventListeners.set(event, listeners)

    // Return unsubscribe function
    return () => {
      const idx = listeners.indexOf(listener)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }

  /**
   * Unsubscribe from an event.
   */
  off(event: string, listener: VMEventListener): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const idx = listeners.indexOf(listener)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }

  // ============================================================================
  // Entity Context
  // ============================================================================

  /**
   * Set the current entity context for behavior execution.
   * When behaviors execute setState() or playAnimation(), this identifies
   * which visual entity should be updated.
   */
  setEntityContext(entityId: string | null): void {
    if (entityId) {
      this.setStateValue('$entity', entityId)
    } else {
      delete this.state['$entity']
    }
  }

  /**
   * Get the current entity context.
   */
  getEntityContext(): string | null {
    return this.state['$entity'] as string ?? null
  }

  /**
   * Execute a behavior's handlers for a specific entity.
   * Sets entity context before execution, clears it after.
   */
  executeEntityBehavior(behaviorName: string, eventName: string, entityId: string): void {
    const behavior = this.behaviors.find(b => b.name === behaviorName)
    if (!behavior) return

    // Set entity context
    this.setEntityContext(entityId)

    try {
      for (const handler of behavior.handlers) {
        if (handler.event === eventName) {
          this.executeHandler(handler)
        }
      }
    } finally {
      // Clear entity context
      this.setEntityContext(null)
    }
  }

  // ============================================================================
  // Behaviors
  // ============================================================================

  /**
   * Get all registered behavior names.
   */
  getBehaviorNames(): string[] {
    return this.behaviors.map(b => b.name)
  }

  /**
   * Check if a behavior is registered.
   */
  hasBehavior(name: string): boolean {
    return this.behaviors.some(b => b.name === name)
  }

  // ============================================================================
  // Rules
  // ============================================================================

  /**
   * Get all registered rule names.
   */
  getRuleNames(): string[] {
    return this.rules.map(r => r.name)
  }

  /**
   * Check if a rule is registered.
   */
  hasRule(name: string): boolean {
    return this.rules.some(r => r.name === name)
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Create an evaluation context with current state.
   */
  private createContext(): EvalContext {
    const ctx = createContext({}, this.state, getConfig())
    addFunctionsToContext(ctx, this.createExecutionCallbacks())
    return ctx
  }

  /**
   * Create execution callbacks.
   */
  private createExecutionCallbacks(): ExecutionCallbacks {
    return {
      ...this.callbacks,
      onSet: (property, value) => {
        this.setStateValue(property, value)
        this.callbacks.onSet?.(property, value)
      },
      onEmit: (event) => {
        this.emit(event)
        this.callbacks.onEmit?.(event)
      },
    }
  }

  /**
   * Evaluate an expression in the current context.
   */
  private evaluateExpression(expr: AST.Expression, ctx: EvalContext): unknown {
    const { evaluate } = require('./evaluator')
    return evaluate(expr, ctx)
  }
}

// ============================================================================
// Global VM Instance
// ============================================================================

let globalVM: ForgeVM | null = null

/**
 * Get the global ForgeVM instance.
 */
export function getVM(): ForgeVM {
  if (!globalVM) {
    globalVM = new ForgeVM()
  }
  return globalVM
}

/**
 * Create a new ForgeVM instance.
 */
export function createVM(): ForgeVM {
  return new ForgeVM()
}

/**
 * Reset the global VM instance.
 */
export function resetVM(): void {
  if (globalVM) {
    globalVM.clear()
  }
  globalVM = null
}
