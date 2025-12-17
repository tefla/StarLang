/**
 * RuntimeForgeBridge - Bridges Runtime and ForgeVM
 *
 * This class mediates between the StarLang Runtime (ship state) and the
 * ForgeVM (scripting engine), enabling:
 * - Bidirectional state synchronization
 * - Event routing between systems
 * - Tick-based rule execution for O2 depletion, etc.
 */

import { Runtime, type EventType } from './Runtime'
import { ForgeVM } from '../forge/vm'
import { forgeLoader } from '../engine/ForgeLoader'
import { Config } from '../forge/ConfigRegistry'
import type { SceneManager } from '../engine/SceneManager'

/**
 * State mapping configuration.
 * Maps Runtime paths to ForgeVM paths.
 */
interface StateMapping {
  runtimePath: string // e.g., "galley.o2_level"
  forgePath: string   // e.g., "galley_o2"
  direction: 'runtime-to-forge' | 'forge-to-runtime' | 'bidirectional'
}

/**
 * Event route configuration.
 * Maps Runtime events to ForgeVM events and vice versa.
 */
interface EventRoute {
  from: 'runtime' | 'forge'
  sourceName: string
  targetName: string
}

/**
 * Bridge options for configuration.
 */
export interface RuntimeForgeBridgeOptions {
  stateMappings?: StateMapping[]
  eventRoutes?: EventRoute[]
}

// Default state mappings (fallback if config not loaded)
const DEFAULT_STATE_MAPPINGS: StateMapping[] = [
  // Player location
  { runtimePath: 'playerRoomId', forgePath: 'player_room', direction: 'runtime-to-forge' },
  { runtimePath: 'previousRoomId', forgePath: 'previous_room', direction: 'runtime-to-forge' },

  // Galley room state
  { runtimePath: 'galley.o2_level', forgePath: 'galley_o2', direction: 'bidirectional' },
  { runtimePath: 'galley.temperature', forgePath: 'galley_temp', direction: 'bidirectional' },
  { runtimePath: 'galley.powered', forgePath: 'galley_powered', direction: 'bidirectional' },

  // Corridor room state
  { runtimePath: 'corridor.o2_level', forgePath: 'corridor_o2', direction: 'bidirectional' },
  { runtimePath: 'corridor.temperature', forgePath: 'corridor_temp', direction: 'bidirectional' },
  { runtimePath: 'corridor.powered', forgePath: 'corridor_powered', direction: 'bidirectional' },

  // Player room derived state (computed from player_room)
  { runtimePath: 'player_room_o2', forgePath: 'player_room_o2', direction: 'bidirectional' },
  { runtimePath: 'player_room_temp', forgePath: 'player_room_temp', direction: 'bidirectional' },
  { runtimePath: 'player_room_powered', forgePath: 'player_room_powered', direction: 'bidirectional' },
]

// Default event routes (fallback if config not loaded)
const DEFAULT_EVENT_ROUTES: EventRoute[] = [
  // Runtime → ForgeVM
  { from: 'runtime', sourceName: 'door:open', targetName: 'door_open' },
  { from: 'runtime', sourceName: 'door:close', targetName: 'door_close' },
  { from: 'runtime', sourceName: 'state:change', targetName: 'state_changed' },

  // ForgeVM → Runtime
  { from: 'forge', sourceName: 'game:victory', targetName: 'game:over' },
  { from: 'forge', sourceName: 'warning:o2_low', targetName: 'atmosphere:warning' },
  { from: 'forge', sourceName: 'warning:o2_critical', targetName: 'atmosphere:critical' },
  { from: 'forge', sourceName: 'game:over', targetName: 'game:over' },
]

/**
 * Get state mappings from config, falling back to defaults.
 */
function getStateMappings(): StateMapping[] {
  const configMappings = Config.bridge.stateMappings
  if (configMappings.length > 0) {
    return configMappings as StateMapping[]
  }
  return DEFAULT_STATE_MAPPINGS
}

/**
 * Get event routes from config, falling back to defaults.
 */
function getEventRoutes(): EventRoute[] {
  const configRoutes = Config.bridge.eventRoutes
  if (configRoutes.length > 0) {
    return configRoutes as EventRoute[]
  }
  return DEFAULT_EVENT_ROUTES
}

export class RuntimeForgeBridge {
  public readonly vm: ForgeVM
  private runtime: Runtime
  private scene: SceneManager | null = null
  private _stateMappingsOverride?: StateMapping[]
  private _eventRoutesOverride?: EventRoute[]
  private forgeFilesLoaded = false

  // Track previous room for room change detection
  private previousRoomId: string | null = null

  // Track warning state to avoid duplicate emissions
  private lastWarningState: 'none' | 'warning' | 'critical' = 'none'

  // Getters that use config values with fallback to defaults
  private get stateMappings(): StateMapping[] {
    return this._stateMappingsOverride ?? getStateMappings()
  }

  private get eventRoutes(): EventRoute[] {
    return this._eventRoutesOverride ?? getEventRoutes()
  }

  constructor(runtime: Runtime, vm?: ForgeVM, options: RuntimeForgeBridgeOptions = {}) {
    this.runtime = runtime
    this.vm = vm ?? new ForgeVM()
    this._stateMappingsOverride = options.stateMappings
    this._eventRoutesOverride = options.eventRoutes

    this.setupEventRouting()
    this.setupVMCallbacks()
  }

  /**
   * Set the scene reference for animation/state callbacks.
   */
  setScene(scene: SceneManager): void {
    this.scene = scene
  }

  /**
   * Load shared .forge files (configs, assets, entities).
   * Uses ForgeLoader.loadDirectory() to discover files via manifest.json.
   */
  async loadForgeFiles(): Promise<void> {
    if (this.forgeFilesLoaded) return

    // Load shared resources (configs, assets, entities)
    // ForgeLoader auto-registers configs with ConfigRegistry
    const result = await forgeLoader.loadDirectory('/game/shared')
    if (result.errors.length > 0) {
      console.warn('[RuntimeForgeBridge] Shared load errors:', result.errors)
    }
    console.log(`[RuntimeForgeBridge] Loaded ${result.configs.length} configs, ${result.assets.length} assets`)

    this.forgeFilesLoaded = true
  }

  /**
   * Load game-specific scripts (rules, scenarios, conditions, behaviors).
   * Called after loadForgeFiles() to load game-specific content.
   *
   * @param gameRoot Path to game directory (e.g., "/game/starlang" or "/game/pong")
   */
  async loadGameScripts(gameRoot: string): Promise<void> {
    // Load game-specific resources via ForgeLoader (configs, assets)
    const result = await forgeLoader.loadDirectory(gameRoot)
    if (result.errors.length > 0) {
      console.warn('[RuntimeForgeBridge] Game load errors:', result.errors)
    }
    console.log(`[RuntimeForgeBridge] Loaded ${result.configs.length} game configs`)

    // Load game scripts into VM for rule/scenario/condition execution
    // The ForgeLoader handles configs, but scripts need to be loaded into VM
    const manifestUrl = `${gameRoot}/manifest.json`
    try {
      const response = await fetch(manifestUrl)
      if (response.ok) {
        const files: string[] = await response.json()
        // Load scripts (rules, scenarios, conditions, behaviors) into VM
        const scriptFiles = files.filter(f =>
          f.endsWith('.rules.forge') ||
          f.endsWith('.scenario.forge') ||
          f.endsWith('.conditions.forge') ||
          f.endsWith('.behavior.forge') ||
          f.endsWith('.interactions.forge') ||
          f.includes('scripts/')
        )

        for (const file of scriptFiles) {
          try {
            const scriptResponse = await fetch(`${gameRoot}/${file}`)
            if (scriptResponse.ok) {
              const source = await scriptResponse.text()
              this.vm.loadSource(source)
              console.log(`[RuntimeForgeBridge] Loaded script: ${file}`)
            }
          } catch (e) {
            console.warn(`[RuntimeForgeBridge] Failed to load ${file}:`, e)
          }
        }
      }
    } catch (e) {
      console.warn(`[RuntimeForgeBridge] Failed to load game scripts from ${gameRoot}:`, e)
    }

    // Also load shared helpers into VM
    try {
      const helperResponse = await fetch('/game/shared/scripts/helpers.forge')
      if (helperResponse.ok) {
        const source = await helperResponse.text()
        this.vm.loadSource(source)
        console.log('[RuntimeForgeBridge] Loaded shared helpers')
      }
    } catch (e) {
      // Helpers are optional
    }
  }

  /**
   * Start a scenario by name.
   */
  startScenario(name: string): boolean {
    const started = this.vm.startScenario(name)
    if (started) {
      // Sync initial scenario state to Runtime
      this.syncStateFromForge()
      console.log(`[RuntimeForgeBridge] Started scenario: ${name}`)
    }
    return started
  }

  /**
   * Main tick method - synchronizes state and executes ForgeVM.
   *
   * Call this instead of runtime.tick() to have ForgeVM handle simulation.
   */
  tick(deltaTime: number): void {
    // Check for room changes
    const currentRoom = this.runtime.getPlayerRoom()
    if (currentRoom !== this.previousRoomId) {
      // Emit room change event
      this.vm.setStateValue('previous_room', this.previousRoomId ?? '')
      this.vm.emit('room_change', {
        room: currentRoom,
        previous_room: this.previousRoomId,
      })
      this.previousRoomId = currentRoom
    }

    // Sync Runtime state to ForgeVM
    this.syncStateToForge()

    // Set delta time for rules
    this.vm.setStateValue('delta', deltaTime)

    // Execute ForgeVM tick (runs all tick-triggered rules)
    this.vm.tick(deltaTime)

    // Sync ForgeVM state changes back to Runtime
    this.syncStateFromForge()

    // Check for warning thresholds and emit events
    this.checkWarningThresholds()
  }

  /**
   * Sync state from Runtime to ForgeVM.
   */
  syncStateToForge(): void {
    const playerRoom = this.runtime.getPlayerRoom()

    // Sync player room
    this.vm.setStateValue('player_room', playerRoom ?? '')

    // Sync room states
    const structure = this.runtime.getStructure()
    if (structure) {
      for (const [roomId] of structure.rooms) {
        const o2 = this.runtime.getProperty(`${roomId}.o2_level`)
        const temp = this.runtime.getProperty(`${roomId}.temperature`)
        const powered = this.runtime.getProperty(`${roomId}.powered`)

        if (o2 !== undefined) this.vm.setStateValue(`${roomId}_o2`, o2)
        if (temp !== undefined) this.vm.setStateValue(`${roomId}_temp`, temp)
        if (powered !== undefined) this.vm.setStateValue(`${roomId}_powered`, powered)
      }

      // Set player room derived values
      if (playerRoom) {
        const roomO2 = this.runtime.getProperty(`${playerRoom}.o2_level`)
        const roomTemp = this.runtime.getProperty(`${playerRoom}.temperature`)
        const roomPowered = this.runtime.getProperty(`${playerRoom}.powered`)

        this.vm.setStateValue('player_room_o2', roomO2 ?? Config.gameRules.defaults.room.o2Level)
        this.vm.setStateValue('player_room_temp', roomTemp ?? Config.gameRules.defaults.room.temperature)
        this.vm.setStateValue('player_room_powered', roomPowered ?? Config.gameRules.defaults.room.powered)
      }
    }
  }

  /**
   * Sync state from ForgeVM back to Runtime.
   */
  syncStateFromForge(): void {
    const playerRoom = this.runtime.getPlayerRoom()
    if (!playerRoom) return

    // Sync O2 level back to Runtime
    const forgeO2 = this.vm.getStateValue('player_room_o2')
    if (typeof forgeO2 === 'number') {
      const currentO2 = this.runtime.getProperty(`${playerRoom}.o2_level`)
      if (currentO2 !== forgeO2) {
        this.runtime.setProperty(`${playerRoom}.o2_level`, forgeO2, 'FORGE')
      }
    }

    // Sync room-specific values
    const structure = this.runtime.getStructure()
    if (structure) {
      for (const [roomId] of structure.rooms) {
        const forgeRoomO2 = this.vm.getStateValue(`${roomId}_o2`)
        if (typeof forgeRoomO2 === 'number') {
          const currentRoomO2 = this.runtime.getProperty(`${roomId}.o2_level`)
          if (currentRoomO2 !== forgeRoomO2) {
            this.runtime.setProperty(`${roomId}.o2_level`, forgeRoomO2, 'FORGE')
          }
        }
      }
    }

    // Check for victory state
    const victory = this.vm.getStateValue('victory')
    if (victory === true) {
      // Victory event will be handled by the Game class listener
    }
  }

  /**
   * Check O2 thresholds and emit warning events.
   */
  private checkWarningThresholds(): void {
    const playerRoom = this.runtime.getPlayerRoom()
    if (!playerRoom) return

    const o2 = this.runtime.getProperty(`${playerRoom}.o2_level`) as number
    if (typeof o2 !== 'number') return

    if (o2 <= 12 && !this.runtime.isGameOver()) {
      this.runtime.emit('game:over', { o2Level: o2, roomId: playerRoom })
    } else if (o2 <= 16 && this.lastWarningState !== 'critical') {
      this.lastWarningState = 'critical'
      this.runtime.emit('atmosphere:critical', { o2Level: o2, roomId: playerRoom })
    } else if (o2 <= 19 && o2 > 16 && this.lastWarningState === 'none') {
      this.lastWarningState = 'warning'
      this.runtime.emit('atmosphere:warning', { o2Level: o2, roomId: playerRoom })
    } else if (o2 > 19) {
      this.lastWarningState = 'none'
    }
  }

  /**
   * Set up event routing between Runtime and ForgeVM.
   */
  private setupEventRouting(): void {
    // Route Runtime events to ForgeVM
    const runtimeEvents: EventType[] = [
      'door:open', 'door:close', 'state:change',
      'atmosphere:warning', 'atmosphere:critical', 'game:over'
    ]

    for (const eventType of runtimeEvents) {
      this.runtime.on(eventType, (data) => {
        const route = this.eventRoutes.find(
          r => r.from === 'runtime' && r.sourceName === eventType
        )
        if (route) {
          this.vm.emit(route.targetName, data)
        }
      })
    }

    // Route ForgeVM events to Runtime
    this.vm.on('*', (event) => {
      const route = this.eventRoutes.find(
        r => r.from === 'forge' && r.sourceName === event.name
      )
      if (route) {
        this.runtime.emit(route.targetName as EventType, event.data ?? {})
      }
    })
  }

  /**
   * Set up VM callbacks for visual effects.
   */
  private setupVMCallbacks(): void {
    this.vm.setCallbacks({
      onSet: (property, value) => {
        // Handle specific property changes that need immediate visual updates
        if (property.endsWith('_state') && this.scene) {
          // Door state change - find and update the door
          const entityId = property.replace('_state', '')
          const instance = this.scene.animatedAssets.get(`door_${entityId}`)
          if (instance) {
            instance.setParam('state', value as string)
          }
        }
      },
      onEmit: (event) => {
        // Log events for debugging
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[ForgeVM] Event: ${event}`)
        }
      },
      onSetState: (stateName) => {
        // Visual state changes handled via entity context
        const entityId = this.vm.getStateValue('$entity')
        if (entityId && this.scene) {
          const instance = this.scene.animatedAssets.get(entityId as string)
          if (instance) {
            instance.setState(stateName)
          }
        }
      },
      onPlayAnimation: (animationName) => {
        // Animation playback via entity context
        const entityId = this.vm.getStateValue('$entity')
        if (entityId && this.scene) {
          const instance = this.scene.animatedAssets.get(entityId as string)
          if (instance) {
            instance.playAnimation(animationName)
          }
        }
      },
    })
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.vm.clear()
    this.scene = null
  }
}
