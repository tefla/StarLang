/**
 * GameRunner - Loads and orchestrates games from Forge definitions
 *
 * The GameRunner is the bridge between Forge game definitions and the
 * engine's runtime systems. It reads game.forge files and provides
 * configuration to initialize player, scene, and other systems.
 *
 * This enables data-driven game configuration instead of hardcoded TypeScript.
 */

import { ForgeVM, type VMGame } from '../forge/vm'
import { parse } from '../forge/parser'

// ============================================================================
// Types
// ============================================================================

/**
 * Player configuration extracted from game definition.
 */
export interface PlayerConfig {
  controller: 'first_person' | 'third_person' | 'fixed_camera'
  spawnRoom: string
  spawnPosition: { x: number; y: number; z: number }
  collision: {
    type: 'cylinder' | 'box' | 'none'
    height?: number
    radius?: number
    width?: number
    depth?: number
  }
}

/**
 * Camera configuration extracted from game definition.
 */
export interface CameraConfig {
  type: 'perspective' | 'orthographic'
  position?: { x: number; y: number; z: number }
  lookAt?: { x: number; y: number; z: number }
  fov?: number
  viewSize?: number
}

/**
 * Entity position sync configuration.
 */
export interface SyncConfig {
  entries: Record<string, string> // entity name -> state path
}

/**
 * Game configuration extracted from game definition.
 */
export interface GameConfig {
  name: string
  ship: string
  layout: string
  scenario: string
  player: PlayerConfig
  camera?: CameraConfig
  sync?: SyncConfig
}

/**
 * Lifecycle event handlers that the game can register.
 */
export interface GameLifecycleHandlers {
  onStart?: () => void
  onVictory?: () => void
  onGameover?: () => void
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  controller: 'first_person',
  spawnRoom: 'start',
  spawnPosition: { x: 0, y: 0.1, z: 0 },
  collision: {
    type: 'cylinder',
    height: 1.6,
    radius: 0.35,
  },
}

// ============================================================================
// GameRunner Class
// ============================================================================

export class GameRunner {
  private vm: ForgeVM
  private activeGame: VMGame | null = null
  private handlers: GameLifecycleHandlers = {}

  constructor(vm?: ForgeVM) {
    this.vm = vm || new ForgeVM()
  }

  /**
   * Get the ForgeVM instance.
   */
  getVM(): ForgeVM {
    return this.vm
  }

  /**
   * Load a game definition from Forge source.
   */
  loadGameSource(source: string): void {
    this.vm.loadSource(source)
  }

  /**
   * Load a game definition from a file path (browser fetch).
   */
  async loadGameFile(path: string): Promise<void> {
    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(`Failed to load game file: ${path}`)
    }
    const source = await response.text()
    this.loadGameSource(source)
  }

  /**
   * Get available game names.
   */
  getGameNames(): string[] {
    return this.vm.getGames().map(g => g.name)
  }

  /**
   * Get a game definition by name.
   */
  getGame(name: string): VMGame | undefined {
    return this.vm.getGame(name)
  }

  /**
   * Get the configuration for a game, with defaults applied.
   */
  getGameConfig(name: string): GameConfig | null {
    const game = this.vm.getGame(name)
    if (!game) return null

    // Build player config with defaults
    const playerConfig: PlayerConfig = {
      controller: (game.player?.controller as PlayerConfig['controller']) || DEFAULT_PLAYER_CONFIG.controller,
      spawnRoom: game.player?.spawnRoom || DEFAULT_PLAYER_CONFIG.spawnRoom,
      spawnPosition: game.player?.spawnPosition || DEFAULT_PLAYER_CONFIG.spawnPosition,
      collision: DEFAULT_PLAYER_CONFIG.collision,
    }

    // Apply collision config if provided
    if (game.player?.collision) {
      const { type, params } = game.player.collision
      playerConfig.collision = {
        type,
        height: params.height,
        radius: params.radius,
        width: params.width,
        depth: params.depth,
      }
    }

    // Build camera config if present
    let cameraConfig: CameraConfig | undefined
    if (game.camera) {
      cameraConfig = {
        type: game.camera.type,
        position: game.camera.position,
        lookAt: game.camera.lookAt,
        fov: game.camera.fov,
        viewSize: game.camera.viewSize,
      }
    }

    // Build sync config if present
    let syncConfig: SyncConfig | undefined
    if (game.sync) {
      syncConfig = {
        entries: game.sync,
      }
    }

    return {
      name: game.name,
      ship: game.ship || 'unknown',
      layout: game.layout || '',
      scenario: game.scenario || '',
      player: playerConfig,
      camera: cameraConfig,
      sync: syncConfig,
    }
  }

  /**
   * Register lifecycle event handlers.
   */
  setHandlers(handlers: GameLifecycleHandlers): void {
    this.handlers = handlers
  }

  /**
   * Start a game by name.
   * Returns the game configuration for initializing systems.
   */
  startGame(name: string): GameConfig | null {
    const config = this.getGameConfig(name)
    if (!config) return null

    // Start the game in the VM (executes on_start handlers)
    const started = this.vm.startGame(name)
    if (!started) return null

    this.activeGame = this.vm.getGame(name) || null

    // Subscribe to VM lifecycle events
    this.vm.on('game:victory', () => {
      this.handlers.onVictory?.()
    })

    this.vm.on('game:gameover', () => {
      this.handlers.onGameover?.()
    })

    // Call start handler
    this.handlers.onStart?.()

    return config
  }

  /**
   * Get the active game configuration.
   */
  getActiveGameConfig(): GameConfig | null {
    if (!this.activeGame) return null
    return this.getGameConfig(this.activeGame.name)
  }

  /**
   * Trigger victory for the active game.
   */
  triggerVictory(): void {
    this.vm.triggerVictory()
  }

  /**
   * Trigger game over for the active game.
   */
  triggerGameover(): void {
    this.vm.triggerGameover()
  }

  /**
   * Check if a game is currently active.
   */
  isGameActive(): boolean {
    return this.activeGame !== null
  }

  /**
   * Stop the current game.
   */
  stopGame(): void {
    this.activeGame = null
    this.handlers = {}
  }

  /**
   * Clear all loaded games and reset state.
   */
  clear(): void {
    this.vm.clear()
    this.activeGame = null
    this.handlers = {}
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a GameRunner and load a game file.
 */
export async function createGameRunner(gamePath: string): Promise<GameRunner> {
  const runner = new GameRunner()
  await runner.loadGameFile(gamePath)
  return runner
}

/**
 * Create a GameRunner from inline source.
 */
export function createGameRunnerFromSource(source: string): GameRunner {
  const runner = new GameRunner()
  runner.loadGameSource(source)
  return runner
}
