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
  evaluate,
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

/**
 * Registered condition in the VM.
 * Conditions are checked every tick and fire events when triggered.
 */
interface VMCondition {
  name: string
  conditionType: 'victory' | 'defeat' | 'checkpoint'
  trigger: AST.Expression
  message?: AST.Expression
  effects: AST.Statement[]
  fired: boolean  // Track if already triggered
}

/**
 * Registered interaction in the VM.
 * Interactions define player-entity interactions.
 */
export interface VMInteraction {
  name: string
  target?: {
    entityType?: string
    condition?: AST.Expression
  }
  range?: number
  prompt?: string
  promptBroken?: string
  onInteract?: AST.Statement[]
  properties?: Record<string, unknown>
}

/**
 * Display row in a template.
 */
export interface VMDisplayRow {
  label: string
  value: string  // Template with {var} substitution
  colorConditions?: {
    colorName: string
    condition: AST.Expression
  }[]
}

/**
 * Registered display template in the VM.
 * Templates define how terminals/screens render content.
 */
export interface VMDisplayTemplate {
  name: string
  width?: number
  height?: number
  header?: string  // Template with {var} substitution
  footer?: string  // Template with {var} substitution
  rows?: VMDisplayRow[]
  properties?: Record<string, unknown>
}

/**
 * Registered game definition in the VM.
 * Games define the entry point: what ship/scenario to load and player config.
 */
export interface VMGame {
  name: string
  ship?: string
  layout?: string
  scenario?: string
  player?: {
    controller?: string
    spawnRoom?: string
    spawnPosition?: { x: number; y: number; z: number }
    collision?: {
      type: 'cylinder' | 'box' | 'none'
      params: Record<string, number>
    }
  }
  camera?: {
    type: 'perspective' | 'orthographic'
    position?: { x: number; y: number; z: number }
    lookAt?: { x: number; y: number; z: number }
    fov?: number
    viewSize?: number
  }
  sync?: Record<string, string> // entity name -> state path
  onStart?: AST.Statement[]
  onVictory?: AST.Statement[]
  onGameover?: AST.Statement[]
  properties?: Record<string, unknown>
}

// ============================================================================
// ForgeVM Class
// ============================================================================

export class ForgeVM {
  private state: VMState = {}
  private rules: VMRule[] = []
  private scenarios: VMScenario[] = []
  private behaviors: VMBehavior[] = []
  private conditions: VMCondition[] = []
  private games: VMGame[] = []
  private interactions: VMInteraction[] = []
  private displayTemplates: VMDisplayTemplate[] = []
  private eventListeners: Map<string, VMEventListener[]> = new Map()
  private activeScenario: VMScenario | null = null
  private activeGame: VMGame | null = null
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
    this.resetConditions()
  }

  /**
   * Reset all conditions to unfired state.
   */
  resetConditions(): void {
    for (const condition of this.conditions) {
      condition.fired = false
    }
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

    // Load conditions
    for (const def of module.definitions) {
      if (def.kind === 'condition') {
        this.conditions.push({
          name: def.name,
          conditionType: def.conditionType,
          trigger: def.trigger,
          message: def.message,
          effects: def.effects,
          fired: false,
        })
      }
    }

    // Load games
    for (const def of module.definitions) {
      if (def.kind === 'game') {
        const ctx = this.createContext()
        const game: VMGame = {
          name: def.name,
          ship: def.ship,
          layout: def.layout,
          scenario: def.scenario,
          onStart: def.onStart,
          onVictory: def.onVictory,
          onGameover: def.onGameover,
        }

        // Parse player config if present
        if (def.player) {
          game.player = {
            controller: def.player.controller,
            spawnRoom: def.player.spawnRoom,
          }

          // Evaluate spawn position
          if (def.player.spawnPosition) {
            const pos = def.player.spawnPosition
            game.player.spawnPosition = {
              x: this.evaluateExpression(pos.x, ctx) as number,
              y: this.evaluateExpression(pos.y, ctx) as number,
              z: this.evaluateExpression(pos.z, ctx) as number,
            }
          }

          // Parse collision config
          if (def.player.collision) {
            const params: Record<string, number> = {}
            for (const [key, expr] of Object.entries(def.player.collision.params)) {
              params[key] = this.evaluateExpression(expr, ctx) as number
            }
            game.player.collision = {
              type: def.player.collision.type,
              params,
            }
          }
        }

        // Parse camera config if present
        if (def.camera) {
          game.camera = {
            type: def.camera.type,
          }
          if (def.camera.position) {
            game.camera.position = {
              x: this.evaluateExpression(def.camera.position.x, ctx) as number,
              y: this.evaluateExpression(def.camera.position.y, ctx) as number,
              z: this.evaluateExpression(def.camera.position.z, ctx) as number,
            }
          }
          if (def.camera.lookAt) {
            game.camera.lookAt = {
              x: this.evaluateExpression(def.camera.lookAt.x, ctx) as number,
              y: this.evaluateExpression(def.camera.lookAt.y, ctx) as number,
              z: this.evaluateExpression(def.camera.lookAt.z, ctx) as number,
            }
          }
          if (def.camera.fov !== undefined) {
            game.camera.fov = def.camera.fov
          }
          if (def.camera.viewSize !== undefined) {
            game.camera.viewSize = def.camera.viewSize
          }
        }

        // Parse sync config if present
        if (def.sync) {
          game.sync = { ...def.sync.entries }
        }

        // Evaluate custom properties
        if (def.properties) {
          game.properties = {}
          for (const [key, expr] of Object.entries(def.properties)) {
            game.properties[key] = this.evaluateExpression(expr, ctx)
          }
        }

        this.games.push(game)
      }
    }

    // Load interactions
    for (const def of module.definitions) {
      if (def.kind === 'interaction') {
        const ctx = this.createContext()
        const interaction: VMInteraction = {
          name: def.name,
          onInteract: def.onInteract,
        }

        // Parse target specification
        if (def.target) {
          interaction.target = {
            entityType: def.target.entityType,
            condition: def.target.condition,
          }
        }

        // Evaluate range
        if (def.range) {
          interaction.range = this.evaluateExpression(def.range, ctx) as number
        }

        // Evaluate prompts
        if (def.prompt) {
          interaction.prompt = this.evaluateExpression(def.prompt, ctx) as string
        }
        if (def.promptBroken) {
          interaction.promptBroken = this.evaluateExpression(def.promptBroken, ctx) as string
        }

        // Evaluate custom properties
        if (def.properties) {
          interaction.properties = {}
          for (const [key, expr] of Object.entries(def.properties)) {
            interaction.properties[key] = this.evaluateExpression(expr, ctx)
          }
        }

        this.interactions.push(interaction)
      }
    }

    // Load display templates
    for (const def of module.definitions) {
      if (def.kind === 'displayTemplate') {
        const ctx = this.createContext()
        const template: VMDisplayTemplate = {
          name: def.name,
        }

        // Evaluate width/height
        if (def.width) {
          template.width = this.evaluateExpression(def.width, ctx) as number
        }
        if (def.height) {
          template.height = this.evaluateExpression(def.height, ctx) as number
        }

        // Evaluate header/footer (keep as template strings)
        if (def.header) {
          template.header = this.evaluateExpression(def.header, ctx) as string
        }
        if (def.footer) {
          template.footer = this.evaluateExpression(def.footer, ctx) as string
        }

        // Parse rows
        if (def.rows) {
          template.rows = []
          for (const rowDef of def.rows) {
            const row: VMDisplayRow = {
              label: this.evaluateExpression(rowDef.label, ctx) as string,
              value: this.evaluateExpression(rowDef.value, ctx) as string,
            }

            // Parse color conditions (keep expressions for runtime evaluation)
            if (rowDef.colorConditions) {
              row.colorConditions = rowDef.colorConditions.map(cc => ({
                colorName: cc.colorName,
                condition: cc.condition,
              }))
            }

            template.rows.push(row)
          }
        }

        // Evaluate custom properties
        if (def.properties) {
          template.properties = {}
          for (const [key, expr] of Object.entries(def.properties)) {
            template.properties[key] = this.evaluateExpression(expr, ctx)
          }
        }

        this.displayTemplates.push(template)
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
    this.conditions = []
    this.games = []
    this.interactions = []
    this.displayTemplates = []
    this.activeScenario = null
    this.activeGame = null
    this.eventListeners.clear()
    clearFunctions()
    clearConfig()
    this.resetState()
  }

  // ============================================================================
  // Game Management
  // ============================================================================

  /**
   * Get a game definition by name.
   */
  getGame(name: string): VMGame | undefined {
    return this.games.find(g => g.name === name)
  }

  /**
   * Get all loaded game definitions.
   */
  getGames(): VMGame[] {
    return [...this.games]
  }

  /**
   * Get the active game.
   */
  getActiveGame(): VMGame | null {
    return this.activeGame
  }

  /**
   * Start a game by name.
   * This sets the active game and executes on_start handlers.
   */
  startGame(name: string): boolean {
    const game = this.games.find(g => g.name === name)
    if (!game) return false

    this.activeGame = game

    // Execute on_start handlers
    if (game.onStart && game.onStart.length > 0) {
      const ctx = this.createContext()
      executeStatements(game.onStart, ctx, this.createExecutionCallbacks())
    }

    this.emit('game:start', { name, game })
    return true
  }

  /**
   * Trigger victory for the active game.
   */
  triggerVictory(): void {
    if (!this.activeGame) return

    // Execute on_victory handlers
    if (this.activeGame.onVictory && this.activeGame.onVictory.length > 0) {
      const ctx = this.createContext()
      executeStatements(this.activeGame.onVictory, ctx, this.createExecutionCallbacks())
    }

    this.emit('game:victory', { name: this.activeGame.name })
  }

  /**
   * Trigger game over for the active game.
   */
  triggerGameover(): void {
    if (!this.activeGame) return

    // Execute on_gameover handlers
    if (this.activeGame.onGameover && this.activeGame.onGameover.length > 0) {
      const ctx = this.createContext()
      executeStatements(this.activeGame.onGameover, ctx, this.createExecutionCallbacks())
    }

    this.emit('game:gameover', { name: this.activeGame.name })
  }

  // ============================================================================
  // Interaction Management
  // ============================================================================

  /**
   * Get an interaction definition by name.
   */
  getInteraction(name: string): VMInteraction | undefined {
    return this.interactions.find(i => i.name === name)
  }

  /**
   * Get all loaded interaction definitions.
   */
  getInteractions(): VMInteraction[] {
    return [...this.interactions]
  }

  /**
   * Find interactions that match a target entity.
   * @param entityData Data about the entity to match against
   */
  findMatchingInteractions(entityData: Record<string, unknown>): VMInteraction[] {
    const matches: VMInteraction[] = []
    const ctx = this.createContext()

    // Add entity data to context for condition evaluation
    // Spread properties directly so `type == "switch"` works (not just `target.type`)
    ctx.vars = { ...ctx.vars, target: entityData, ...entityData }

    for (const interaction of this.interactions) {
      if (!interaction.target) {
        // No target filter - matches everything
        matches.push(interaction)
        continue
      }

      // Check entity type filter (simple target: switch)
      if (interaction.target.entityType) {
        const entityType = entityData.type ?? entityData.entityType
        if (entityType !== interaction.target.entityType) {
          continue
        }
      }

      // Check condition filter (target: entity where type == "switch")
      if (interaction.target.condition) {
        if (!evaluateCondition(interaction.target.condition, ctx)) {
          continue
        }
      }

      matches.push(interaction)
    }

    return matches
  }

  /**
   * Execute an interaction's on_interact handler.
   * @param interactionName Name of the interaction to execute
   * @param targetData Data about the target entity
   */
  executeInteraction(interactionName: string, targetData?: Record<string, unknown>): void {
    const interaction = this.interactions.find(i => i.name === interactionName)
    if (!interaction || !interaction.onInteract) return

    const ctx = this.createContext()

    // Add target data to context
    if (targetData) {
      ctx.vars = { ...ctx.vars, target: targetData }

      // Also set target in state for reactive access ($target.name becomes target.name)
      this.setStateValue('target', targetData)
    }

    // Execute on_interact statements
    executeStatements(interaction.onInteract, ctx, this.createExecutionCallbacks())

    // Emit interaction event
    this.emit('interaction:execute', {
      interaction: interactionName,
      target: targetData,
    })
  }

  /**
   * Get the prompt text for an interaction.
   * Supports template substitution with {name} syntax.
   * @param interactionName Name of the interaction
   * @param targetData Data to use for template substitution
   * @param isBroken Whether to use the broken prompt
   */
  getInteractionPrompt(
    interactionName: string,
    targetData?: Record<string, unknown>,
    isBroken = false
  ): string | null {
    const interaction = this.interactions.find(i => i.name === interactionName)
    if (!interaction) return null

    const promptTemplate = isBroken && interaction.promptBroken
      ? interaction.promptBroken
      : interaction.prompt

    if (!promptTemplate) return null

    // Substitute {key} templates with target data
    let prompt = promptTemplate
    if (targetData) {
      for (const [key, value] of Object.entries(targetData)) {
        prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
      }
    }

    return prompt
  }

  // ============================================================================
  // Display Template Management
  // ============================================================================

  /**
   * Get a display template by name.
   */
  getDisplayTemplate(name: string): VMDisplayTemplate | undefined {
    return this.displayTemplates.find(t => t.name === name)
  }

  /**
   * Get all loaded display templates.
   */
  getDisplayTemplates(): VMDisplayTemplate[] {
    return [...this.displayTemplates]
  }

  /**
   * Render a display template with variable substitution.
   * @param templateName Name of the template
   * @param data Data for variable substitution and color evaluation
   * @returns Rendered template with substituted values and evaluated colors
   */
  renderDisplayTemplate(
    templateName: string,
    data: Record<string, unknown>
  ): {
    header?: string
    footer?: string
    rows: {
      label: string
      value: string
      color: string  // 'nominal', 'warning', 'error', or custom
    }[]
  } | null {
    const template = this.getDisplayTemplate(templateName)
    if (!template) return null

    const ctx = this.createContext()
    // Add data to context for evaluation
    ctx.vars = { ...ctx.vars, ...data }

    const result: {
      header?: string
      footer?: string
      rows: { label: string; value: string; color: string }[]
    } = {
      rows: []
    }

    // Substitute header
    if (template.header) {
      result.header = this.substituteTemplate(template.header, data)
    }

    // Substitute footer
    if (template.footer) {
      result.footer = this.substituteTemplate(template.footer, data)
    }

    // Render rows
    if (template.rows) {
      for (const row of template.rows) {
        const renderedRow = {
          label: this.substituteTemplate(row.label, data),
          value: this.substituteTemplate(row.value, data),
          color: 'nominal'  // Default color
        }

        // Evaluate color conditions
        if (row.colorConditions) {
          for (const colorCond of row.colorConditions) {
            if (evaluateCondition(colorCond.condition, ctx)) {
              renderedRow.color = colorCond.colorName
              break  // Use first matching condition
            }
          }
        }

        result.rows.push(renderedRow)
      }
    }

    return result
  }

  /**
   * Substitute {var} templates in a string with values from data.
   */
  private substituteTemplate(template: string, data: Record<string, unknown>): string {
    let result = template
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
    }
    return result
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

    // Check conditions
    this.checkConditions()
  }

  /**
   * Check all conditions and fire events when triggered.
   */
  private checkConditions(): void {
    const context = this.createContext()

    for (const condition of this.conditions) {
      // Skip already fired conditions
      if (condition.fired) continue

      // Evaluate trigger expression
      const triggered = evaluateCondition(condition.trigger, context)
      if (!triggered) continue

      // Mark as fired
      condition.fired = true

      // Evaluate message if present
      let message: string | undefined
      if (condition.message) {
        message = String(evaluate(condition.message, context))
      }

      // Emit condition event
      const eventName = `condition:${condition.conditionType}`
      this.emit(eventName, {
        condition: condition.name,
        type: condition.conditionType,
        message,
      })

      // Also emit game-specific events for backwards compatibility
      if (condition.conditionType === 'victory') {
        this.emit('game:victory', { condition: condition.name, message })
      } else if (condition.conditionType === 'defeat') {
        this.emit('game:over', { condition: condition.name, message })
      }

      // Execute effects
      if (condition.effects.length > 0) {
        executeStatements(condition.effects, context, this.createExecutionCallbacks())
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
