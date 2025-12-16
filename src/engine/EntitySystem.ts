// EntitySystem - Generic entity management driven by Forge definitions
// Provides a unified interface for all game entities

import * as THREE from 'three'
import type {
  CompiledEntityDef,
  EntityEventHandler,
  EntityAction,
  RenderElement
} from '../types/entity'
import { ScreenRenderer, type RenderContext } from './ScreenRenderer'
import type { Runtime } from '../runtime/Runtime'
import type { VoxelWorld } from '../voxel/VoxelWorld'
import { VoxelType, getVoxelType, VOXEL_SIZE } from '../voxel/VoxelTypes'
import { Config } from '../forge/ConfigRegistry'

/**
 * Base interface for all entities in the game.
 */
export interface Entity {
  id: string
  group: THREE.Group
  isInteractable: boolean

  update(deltaTime: number, context: RenderContext): void
  dispose(): void

  // Optional methods
  focus?(): void
  unfocus?(): void
  handleEvent?(event: string, context: RenderContext): void
}

/**
 * Screen bounds from detected SCREEN voxels.
 */
interface ScreenBounds {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
  normalAxis: 'x' | 'z'
  normalDir: 1 | -1
}

/**
 * Terminal type for terminal-specific behavior.
 */
type TerminalType = 'STATUS' | 'ENGINEERING' | 'COMMAND' | null

/**
 * Screen-based entity instance created from a Forge entity definition.
 * Used for terminals and similar screen-based entities.
 *
 * Enhanced to support terminal functionality:
 * - Runtime state polling for STATUS terminals
 * - VoxelWorld integration for screen detection
 * - Code editing display for ENGINEERING terminals
 */
export class ScreenEntity implements Entity {
  public id: string
  public group: THREE.Group
  public isInteractable: boolean = true
  public isFocused: boolean = false

  private definition: CompiledEntityDef
  private renderer: ScreenRenderer
  private screenMesh: THREE.Mesh
  private params: Record<string, unknown> = {}
  private eventHandlers: EntityEventHandler[]

  // Terminal-specific properties
  private runtime: Runtime | null = null
  private voxelWorld: VoxelWorld | null = null
  private terminalType: TerminalType = null
  private location: string = ''
  private displayName: string = ''
  private updateTimer: number = 0
  private terminalLines: string[] = []

  constructor(
    id: string,
    definition: CompiledEntityDef,
    position: THREE.Vector3,
    rotation: number = 0
  ) {
    this.id = id
    this.definition = definition

    // Initialize params with defaults
    if (definition.params) {
      for (const [name, param] of Object.entries(definition.params)) {
        this.params[name] = param.default
      }
    }

    // Create screen renderer
    this.renderer = new ScreenRenderer(
      definition.screen!,
      definition.styles ?? {},
      definition.render ?? []
    )

    // Create THREE.js group
    this.group = new THREE.Group()
    this.group.name = `entity_${id}`
    this.group.userData = { type: 'entity', entityType: definition.id, id, interactable: true }

    // Create screen mesh
    const [width, height] = this.renderer.getSize()
    const aspect = width / height
    const meshWidth = Config.entitySystem.terminal.screenWidth
    const meshHeight = meshWidth / aspect

    const geometry = new THREE.PlaneGeometry(meshWidth, meshHeight)
    const material = this.renderer.createMaterial()
    this.screenMesh = new THREE.Mesh(geometry, material)
    this.screenMesh.position.set(0, 0, 0)
    this.group.add(this.screenMesh)

    // Position and rotate
    this.group.position.copy(position)
    this.group.rotation.y = (rotation * Math.PI) / 180

    // Store event handlers
    this.eventHandlers = definition.events ?? []

    // Initial render
    this.render()
  }

  /**
   * Set a parameter value and re-render.
   */
  setParam(name: string, value: unknown): void {
    this.params[name] = value
    this.render()
  }

  /**
   * Get a parameter value.
   */
  getParam(name: string): unknown {
    return this.params[name]
  }

  /**
   * Render the screen with current state.
   */
  render(state?: Record<string, unknown>): void {
    const context: RenderContext = {
      params: this.params,
      state
    }
    this.renderer.render(context)
  }

  /**
   * Update entity each frame.
   */
  update(deltaTime: number, context: RenderContext): void {
    // Terminal-specific: periodic state updates for STATUS terminals
    if (this.terminalType === 'STATUS' && this.runtime) {
      this.updateTimer += deltaTime
      if (this.updateTimer >= Config.entitySystem.terminal.updateInterval) {
        this.updateTimer = 0
        this.updateFromState()
        return  // Skip generic render since we just rendered
      }
    }

    // Re-render with latest context (for reactive updates)
    this.renderer.render({
      params: { ...this.params, ...context.params },
      state: context.state
    })
  }

  /**
   * Handle an event (from user interaction or system).
   */
  handleEvent(event: string, context: RenderContext): void {
    for (const handler of this.eventHandlers) {
      if (handler.event !== event) continue

      // Check condition if present
      if (handler.condition) {
        const conditionMet = this.evaluateCondition(handler.condition, context)
        if (!conditionMet) continue
      }

      // Execute actions
      for (const action of handler.actions) {
        this.executeAction(action, context)
      }
    }
  }

  /**
   * Focus the entity (e.g., when player interacts).
   */
  focus(): void {
    this.isFocused = true
    const material = this.screenMesh.material as THREE.MeshStandardMaterial
    this.renderer.setEmissiveIntensity(material, 0.8)
    this.handleEvent('focus', { params: this.params })
  }

  /**
   * Unfocus the entity.
   */
  unfocus(): void {
    this.isFocused = false
    const material = this.screenMesh.material as THREE.MeshStandardMaterial
    this.renderer.setEmissiveIntensity(material, 0.5)
    this.handleEvent('blur', { params: this.params })
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this.renderer.dispose()
    this.screenMesh.geometry.dispose()
    if (this.screenMesh.material instanceof THREE.Material) {
      this.screenMesh.material.dispose()
    }
  }

  /**
   * Evaluate a condition expression.
   */
  private evaluateCondition(condition: string, context: RenderContext): boolean {
    // Simple condition parsing: "$param == VALUE"
    const match = condition.match(/^\$(\w+)\s*==\s*(\w+)$/)
    if (match) {
      const [, paramName, expectedValue] = match
      const actualValue = this.params[paramName!]
      return String(actualValue) === expectedValue
    }

    // Handle reactive refs directly: "$focused"
    if (condition.startsWith('$')) {
      const paramName = condition.slice(1)
      return Boolean(this.params[paramName])
    }

    return false
  }

  /**
   * Execute an action.
   */
  private executeAction(action: EntityAction, _context: RenderContext): void {
    switch (action.type) {
      case 'set':
        this.params[action.property] = action.value
        this.render()
        break
      case 'emit':
        // Emit custom event - can be listened to via addEventListener
        // Note: THREE.js events have limited type support, so we use a custom property
        const customEvent = new CustomEvent(action.event, { detail: { entityId: this.id } })
        window.dispatchEvent(customEvent)
        break
    }
  }

  // =============================================================
  // Terminal-specific methods
  // =============================================================

  /**
   * Set the runtime reference for state polling.
   */
  setRuntime(runtime: Runtime): void {
    this.runtime = runtime
  }

  /**
   * Set the voxel world reference for screen detection.
   */
  setVoxelWorld(voxelWorld: VoxelWorld): void {
    this.voxelWorld = voxelWorld
    // Auto-detect screen bounds when voxel world is set
    this.detectScreenBounds()
  }

  /**
   * Configure terminal type and metadata.
   */
  setTerminalConfig(type: 'STATUS' | 'ENGINEERING' | 'COMMAND', location: string, displayName: string): void {
    this.terminalType = type
    this.location = location
    this.displayName = displayName
    this.params['type'] = type
    this.params['location'] = location
    this.params['display_name'] = displayName
    this.updateFromState()
  }

  /**
   * Update STATUS terminal from runtime state.
   */
  updateFromState(): void {
    if (!this.runtime || this.terminalType !== 'STATUS') return

    const state = this.runtime.getState(this.location)
    if (!state) return

    const values = state.values
    const o2Level = values['o2_level'] as number | undefined
    const temperature = values['temperature'] as number | undefined
    const pressure = values['pressure'] as number | undefined
    const powered = values['powered'] as boolean | undefined

    // Build terminal display lines
    this.terminalLines = [
      `=== ${this.displayName} ===`,
      '',
      `  O2 Level:     ${o2Level?.toFixed(1) ?? '--'}%`,
      `  Temperature:  ${temperature?.toFixed(1) ?? '--'}°C`,
      `  Pressure:     ${pressure?.toFixed(1) ?? '--'} kPa`,
      '',
      `  Power:        ${powered !== false ? 'ONLINE' : 'OFFLINE'}`,
      `  Atmosphere:   ${this.getAtmosphereStatus(o2Level ?? 21)}`,
    ]

    // Update params for renderer
    this.params['lines'] = this.terminalLines
    this.params['o2_level'] = o2Level ?? 21
    this.params['temperature'] = temperature ?? 20
    this.params['pressure'] = pressure ?? 101
    this.params['powered'] = powered !== false

    // Re-render with updated state
    this.render({ room: values })
  }

  /**
   * Get atmosphere status string based on O2 level.
   */
  private getAtmosphereStatus(o2Level: number): string {
    if (o2Level >= Config.gameRules.o2WarningThreshold) return 'NOMINAL'
    if (o2Level >= Config.gameRules.o2CriticalThreshold) return 'WARNING'
    if (o2Level >= Config.gameRules.o2GameoverThreshold) return 'CRITICAL'
    return 'DANGER'
  }

  /**
   * Set code content for ENGINEERING terminals.
   */
  setCodeContent(filename: string, content: string, cursorLine?: number): void {
    if (this.terminalType !== 'ENGINEERING') return

    this.params['filename'] = filename
    this.params['code'] = content
    this.params['cursor_line'] = cursorLine ?? 0

    // Split content into lines for display
    const lines = content.split('\n')
    this.terminalLines = lines

    this.render({ code: content, filename })
  }

  /**
   * Detect screen bounds from SCREEN voxels in the voxel world.
   */
  private detectScreenBounds(): void {
    if (!this.voxelWorld) return

    const bounds = this.findScreenVoxels()
    if (!bounds) return

    // Calculate screen dimensions and position from bounds
    const width = (bounds.maxX - bounds.minX + 1) * VOXEL_SIZE
    const height = (bounds.maxY - bounds.minY + 1) * VOXEL_SIZE

    // Update mesh geometry to match screen bounds
    const geometry = new THREE.PlaneGeometry(width, height)
    this.screenMesh.geometry.dispose()
    this.screenMesh.geometry = geometry

    // Position mesh at center of screen bounds
    const centerX = (bounds.minX + bounds.maxX) / 2 * VOXEL_SIZE
    const centerY = (bounds.minY + bounds.maxY) / 2 * VOXEL_SIZE
    const centerZ = (bounds.minZ + bounds.maxZ) / 2 * VOXEL_SIZE

    // Offset slightly in front of screen voxels based on normal direction
    const offset = Config.entitySystem.terminal.screenOffset
    if (bounds.normalAxis === 'z') {
      this.screenMesh.position.set(centerX, centerY, centerZ + offset * bounds.normalDir)
      this.screenMesh.rotation.y = bounds.normalDir > 0 ? 0 : Math.PI
    } else {
      this.screenMesh.position.set(centerX + offset * bounds.normalDir, centerY, centerZ)
      this.screenMesh.rotation.y = bounds.normalDir > 0 ? Math.PI / 2 : -Math.PI / 2
    }
  }

  /**
   * Find SCREEN voxels near this entity's position.
   */
  private findScreenVoxels(): ScreenBounds | null {
    if (!this.voxelWorld) return null

    // Search area around entity position
    const pos = this.group.position
    const searchRadius = Config.entitySystem.terminal.searchRadius
    const searchVoxels = Math.ceil(searchRadius / VOXEL_SIZE)

    const screenVoxels: { x: number; y: number; z: number }[] = []

    // Convert world position to voxel coordinates
    const baseX = Math.floor(pos.x / VOXEL_SIZE)
    const baseY = Math.floor(pos.y / VOXEL_SIZE)
    const baseZ = Math.floor(pos.z / VOXEL_SIZE)

    // Search for SCREEN voxels
    for (let dx = -searchVoxels; dx <= searchVoxels; dx++) {
      for (let dy = -searchVoxels; dy <= searchVoxels; dy++) {
        for (let dz = -searchVoxels; dz <= searchVoxels; dz++) {
          const vx = baseX + dx
          const vy = baseY + dy
          const vz = baseZ + dz

          const voxel = this.voxelWorld.getVoxel(vx, vy, vz)
          if (voxel) {
            const voxelType = getVoxelType(voxel)
            if (voxelType === VoxelType.SCREEN) {
              screenVoxels.push({ x: vx, y: vy, z: vz })
            }
          }
        }
      }
    }

    if (screenVoxels.length === 0) return null

    // Calculate bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    for (const v of screenVoxels) {
      minX = Math.min(minX, v.x)
      minY = Math.min(minY, v.y)
      minZ = Math.min(minZ, v.z)
      maxX = Math.max(maxX, v.x)
      maxY = Math.max(maxY, v.y)
      maxZ = Math.max(maxZ, v.z)
    }

    // Determine screen normal (which face is exposed)
    const depthX = maxX - minX
    const depthZ = maxZ - minZ
    const normalAxis: 'x' | 'z' = depthX < depthZ ? 'x' : 'z'

    // Determine normal direction based on entity position relative to screen
    let normalDir: 1 | -1 = 1
    if (normalAxis === 'z') {
      normalDir = pos.z > (minZ + maxZ) / 2 * VOXEL_SIZE ? 1 : -1
    } else {
      normalDir = pos.x > (minX + maxX) / 2 * VOXEL_SIZE ? 1 : -1
    }

    return { minX, minY, minZ, maxX, maxY, maxZ, normalAxis, normalDir }
  }

  /**
   * Get terminal type.
   */
  getTerminalType(): TerminalType {
    return this.terminalType
  }

  /**
   * Get location string.
   */
  getLocation(): string {
    return this.location
  }

  /**
   * Get display name.
   */
  getDisplayName(): string {
    return this.displayName
  }

  /**
   * Get mounted files (for ENGINEERING terminals).
   */
  getMountedFiles(): string[] {
    return (this.params['mounted_files'] as string[]) ?? []
  }

  /**
   * Set mounted files (for ENGINEERING terminals).
   */
  setMountedFiles(files: string[]): void {
    this.params['mounted_files'] = files
  }
}

/**
 * EntitySystem - Manages entity definitions and instances.
 */
export class EntitySystem {
  private definitions: Map<string, CompiledEntityDef> = new Map()
  private instances: Map<string, Entity> = new Map()

  /**
   * Register an entity definition from Forge.
   */
  registerDefinition(definition: CompiledEntityDef): void {
    this.definitions.set(definition.id, definition)
  }

  /**
   * Get a registered definition.
   */
  getDefinition(id: string): CompiledEntityDef | undefined {
    return this.definitions.get(id)
  }

  /**
   * Create an entity instance from a registered definition.
   */
  createEntity(
    definitionId: string,
    instanceId: string,
    position: THREE.Vector3,
    rotation: number = 0
  ): Entity | null {
    const definition = this.definitions.get(definitionId)
    if (!definition) {
      console.warn(`Entity definition not found: ${definitionId}`)
      return null
    }

    // Create appropriate entity type based on definition
    let entity: Entity

    if (definition.screen) {
      // Screen-based entity (terminal, etc.)
      entity = new ScreenEntity(instanceId, definition, position, rotation)
    } else {
      // For now, only screen entities are supported
      console.warn(`Entity type not supported: ${definitionId}`)
      return null
    }

    this.instances.set(instanceId, entity)
    return entity
  }

  /**
   * Get an entity instance by ID.
   */
  getInstance(id: string): Entity | undefined {
    return this.instances.get(id)
  }

  /**
   * Get all entity instances.
   */
  getAllInstances(): Entity[] {
    return Array.from(this.instances.values())
  }

  /**
   * Update all entities.
   */
  update(deltaTime: number, context: RenderContext): void {
    for (const entity of Array.from(this.instances.values())) {
      entity.update(deltaTime, context)
    }
  }

  /**
   * Remove an entity instance.
   */
  removeEntity(id: string): void {
    const entity = this.instances.get(id)
    if (entity) {
      entity.dispose()
      this.instances.delete(id)
    }
  }

  /**
   * Dispose of all entities.
   */
  dispose(): void {
    for (const entity of Array.from(this.instances.values())) {
      entity.dispose()
    }
    this.instances.clear()
  }
}
