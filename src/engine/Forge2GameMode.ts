/**
 * Forge 2.0 Game Mode
 *
 * Runs Forge 2.0 games (.f2 files) independently of the StarLang runtime.
 * Provides a complete game execution environment with:
 * - ForgeVM for script execution
 * - EngineBridge for render/input/time namespaces
 * - Scene integration for THREE.js rendering
 *
 * Usage:
 * ```typescript
 * const mode = new Forge2GameMode(scene)
 * mode.setupInputListeners(container)
 * await mode.loadGame('/game/pong2/pong.f2')
 *
 * // In game loop:
 * mode.tick(deltaTime)
 * ```
 */

import * as THREE from 'three'
import { ForgeVM, EngineBridge, RenderBridge } from '../forge2'
import type { ForgeMap } from '../forge2/types'

export interface Forge2GameModeConfig {
  /** Camera setup for the game */
  camera?: {
    type: 'orthographic' | 'perspective'
    position: { x: number; y: number; z: number }
    lookAt: { x: number; y: number; z: number }
    fov?: number
    viewSize?: number
  }
}

export class Forge2GameMode {
  private vm: ForgeVM
  private engineBridge: EngineBridge
  private scene: THREE.Scene
  private container: HTMLElement | null = null
  private eventListeners: Array<{ type: string; listener: EventListener }> = []
  private isInitialized: boolean = false

  constructor(scene: THREE.Scene, container?: HTMLElement) {
    this.scene = scene
    this.container = container ?? null
    this.vm = new ForgeVM()

    // Create render bridge with the scene
    const renderBridge = new RenderBridge({ scene })

    // Create engine bridge with input and UI enabled
    this.engineBridge = new EngineBridge({
      scene,
      inputEnabled: true,
      uiContainer: container,
    })

    // Attach engine bindings to VM
    this.engineBridge.attachTo(this.vm)
  }

  /**
   * Set up input event listeners on the container element.
   * This enables keyboard and mouse input for the game.
   */
  setupInputListeners(container: HTMLElement): void {
    // Input listeners are already set up by EngineBridge when inputEnabled: true
    // The EngineBridge attaches to window, which is sufficient for most games

    // Focus the container to receive keyboard events
    container.tabIndex = 0
    container.focus()
  }

  /**
   * Load and initialize a Forge 2.0 game from a file path.
   */
  async loadGame(gamePath: string): Promise<void> {
    try {
      const response = await fetch(gamePath)
      if (!response.ok) {
        throw new Error(`Failed to load game: ${gamePath} (${response.status})`)
      }

      const source = await response.text()
      this.vm.load(source, gamePath)

      // Emit init event to start the game
      this.vm.emit('init')
      this.isInitialized = true

      console.log(`[Forge2GameMode] Loaded game: ${gamePath}`)
    } catch (error) {
      console.error(`[Forge2GameMode] Error loading game:`, error)
      throw error
    }
  }

  /**
   * Load source code directly (for testing or inline games).
   */
  loadSource(source: string, filename: string = '<inline>'): void {
    this.vm.load(source, filename)
    this.vm.emit('init')
    this.isInitialized = true
  }

  /**
   * Update the game. Call this each frame with delta time.
   */
  tick(deltaTime: number): void {
    if (!this.isInitialized) return

    // Update engine bridge (handles input state clearing, asset updates)
    this.engineBridge.update(deltaTime)

    // Emit tick event to VM (runs all tick handlers)
    this.vm.tick(deltaTime)
  }

  /**
   * Subscribe to events emitted by the game.
   * Returns an unsubscribe function.
   */
  on(event: string, handler: (data: ForgeMap) => void): () => void {
    return this.vm.on(event, handler)
  }

  /**
   * Emit an event to the game.
   */
  emit(event: string, data?: ForgeMap): void {
    this.vm.emit(event, data ?? {})
  }

  /**
   * Get a global value from the game state.
   */
  get(name: string): unknown {
    return this.vm.get(name)
  }

  /**
   * Set a global value in the game state.
   */
  set(name: string, value: unknown): void {
    this.vm.set(name, value as any)
  }

  /**
   * Hot-reload a game file.
   * Preserves runtime state while updating definitions.
   */
  reload(source: string, filename: string): void {
    this.vm.reload(source, filename)
  }

  /**
   * Get the underlying ForgeVM instance.
   */
  getVM(): ForgeVM {
    return this.vm
  }

  /**
   * Get the engine bridge.
   */
  getEngineBridge(): EngineBridge {
    return this.engineBridge
  }

  /**
   * Get the THREE.js scene.
   */
  getScene(): THREE.Scene {
    return this.scene
  }

  /**
   * Check if the game is initialized.
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    // Remove event listeners
    for (const { type, listener } of this.eventListeners) {
      window.removeEventListener(type, listener)
    }
    this.eventListeners = []

    // Dispose engine bridge (cleans up render objects)
    this.engineBridge.dispose()

    this.isInitialized = false
  }
}

/**
 * Create a Forge 2.0 game mode instance.
 */
export function createForge2GameMode(scene: THREE.Scene, container?: HTMLElement): Forge2GameMode {
  return new Forge2GameMode(scene, container)
}
