/**
 * Forge 2.0 Engine Bridge
 *
 * Unified bridge connecting Forge scripts to the game engine.
 * Combines render, voxel, and asset namespaces into a cohesive system.
 *
 * Usage:
 * ```typescript
 * import { ForgeVM } from './forge2'
 * import { EngineBridge } from './forge2/engine-bridge'
 *
 * const vm = new ForgeVM()
 * const bridge = new EngineBridge({
 *   scene: myThreeScene,
 *   voxelWorld: myVoxelWorld,
 *   voxelRenderer: myVoxelRenderer,
 *   assetLoader: myAnimatedAssetLoader,
 * })
 *
 * // Add engine bindings to VM
 * bridge.attachTo(vm)
 *
 * // In game loop
 * bridge.update(deltaTime)
 * vm.tick(deltaTime)
 * ```
 */

import * as THREE from 'three'
import type { ForgeValue, ForgeMap } from './types'
import { Runtime } from './runtime'
import { RenderBridge, type RenderBridgeConfig } from './render-bridge'
import { VoxelBridge, type VoxelBridgeConfig, type VoxelWorldLike, type VoxelRendererLike, type VoxelTypeRegistryLike } from './voxel-bridge'
import { AssetBridge, type AssetBridgeConfig, type AnimatedAssetLoaderLike } from './asset-bridge'
import { UIBridge, type UIBridgeConfig } from './ui-bridge'

// Re-export for convenience
export type {
  VoxelWorldLike,
  VoxelRendererLike,
  VoxelTypeRegistryLike,
  AnimatedAssetLoaderLike,
}

// ============================================================================
// Types
// ============================================================================

export interface EngineBridgeConfig {
  /** THREE.js scene (required for render and asset bridges) */
  scene: THREE.Scene

  /** Voxel size in world units (default: 0.025) */
  voxelSize?: number

  /** Chunk size in voxels (default: 16) */
  chunkSize?: number

  // Optional voxel system
  voxelWorld?: VoxelWorldLike
  voxelRenderer?: VoxelRendererLike
  voxelTypeRegistry?: VoxelTypeRegistryLike

  // Optional asset system
  assetLoader?: AnimatedAssetLoaderLike

  // Optional input system (for keyboard/mouse events)
  inputEnabled?: boolean

  // Optional UI system
  uiContainer?: HTMLElement
}

export interface InputState {
  keysDown: Set<string>
  keysPressed: Set<string>
  keysReleased: Set<string>
  mousePosition: { x: number; y: number }
  mouseButtons: Set<number>
  mouseClicked: Set<number>
}

// ============================================================================
// Engine Bridge Class
// ============================================================================

export class EngineBridge {
  private scene: THREE.Scene
  private voxelSize: number
  private chunkSize: number

  // Sub-bridges
  private renderBridge: RenderBridge
  private voxelBridge: VoxelBridge | null = null
  private assetBridge: AssetBridge | null = null
  private uiBridge: UIBridge | null = null

  // Input state
  private inputEnabled: boolean
  private inputState: InputState

  // Attached runtime
  private runtime: Runtime | null = null

  constructor(config: EngineBridgeConfig) {
    this.scene = config.scene
    this.voxelSize = config.voxelSize ?? 0.025
    this.chunkSize = config.chunkSize ?? 16

    // Create render bridge
    this.renderBridge = new RenderBridge({
      scene: this.scene,
      voxelSize: this.voxelSize,
    })

    // Create voxel bridge if world is provided
    if (config.voxelWorld) {
      this.voxelBridge = new VoxelBridge({
        world: config.voxelWorld,
        renderer: config.voxelRenderer,
        registry: config.voxelTypeRegistry,
        voxelSize: this.voxelSize,
        chunkSize: this.chunkSize,
      })
    }

    // Create asset bridge if loader is provided
    if (config.assetLoader) {
      this.assetBridge = new AssetBridge({
        scene: this.scene,
        loader: config.assetLoader,
      })
    }

    // Create UI bridge if container is provided
    if (config.uiContainer) {
      this.uiBridge = new UIBridge({
        container: config.uiContainer,
      })
    }

    // Input handling
    this.inputEnabled = config.inputEnabled ?? false
    this.inputState = {
      keysDown: new Set(),
      keysPressed: new Set(),
      keysReleased: new Set(),
      mousePosition: { x: 0, y: 0 },
      mouseButtons: new Set(),
      mouseClicked: new Set(),
    }

    if (this.inputEnabled) {
      this.setupInputHandlers()
    }
  }

  // ==========================================================================
  // Runtime Integration
  // ==========================================================================

  /**
   * Attach engine bindings to a ForgeVM instance.
   */
  attachTo(vm: { getRuntime(): Runtime; set(name: string, value: ForgeValue): void }): void {
    this.runtime = vm.getRuntime()

    // Add render namespace
    vm.set('render', this.renderBridge.createNamespace())

    // Add voxel namespace if available
    if (this.voxelBridge) {
      vm.set('voxel', this.voxelBridge.createNamespace())
    }

    // Add asset namespace if available
    if (this.assetBridge) {
      vm.set('asset', this.assetBridge.createNamespace())
    }

    // Add UI namespace if available
    if (this.uiBridge) {
      vm.set('ui', this.uiBridge.createNamespace())
      this.uiBridge.attachRuntime(this.runtime)
    }

    // Add input namespace
    vm.set('input', this.createInputNamespace())

    // Add time namespace
    vm.set('time', this.createTimeNamespace())

    // Add engine namespace (meta functions)
    vm.set('engine', this.createEngineNamespace())
  }

  /**
   * Create all engine bindings as a Map (for direct runtime use).
   */
  createBindings(): Map<string, ForgeValue> {
    const bindings = new Map<string, ForgeValue>()

    bindings.set('render', this.renderBridge.createNamespace())

    if (this.voxelBridge) {
      bindings.set('voxel', this.voxelBridge.createNamespace())
    }

    if (this.assetBridge) {
      bindings.set('asset', this.assetBridge.createNamespace())
    }

    if (this.uiBridge) {
      bindings.set('ui', this.uiBridge.createNamespace())
    }

    bindings.set('input', this.createInputNamespace())
    bindings.set('time', this.createTimeNamespace())
    bindings.set('engine', this.createEngineNamespace())

    return bindings
  }

  // ==========================================================================
  // Update Loop
  // ==========================================================================

  /**
   * Update all engine systems. Call this each frame BEFORE vm.tick().
   */
  update(deltaTime: number): void {
    // Update animated assets
    if (this.assetBridge) {
      this.assetBridge.update(deltaTime)
    }

    // Process input events and emit to runtime
    if (this.inputEnabled && this.runtime) {
      this.processInputEvents()
    }

    // Clear per-frame input state
    this.inputState.keysPressed.clear()
    this.inputState.keysReleased.clear()
    this.inputState.mouseClicked.clear()
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  private setupInputHandlers(): void {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      const key = this.normalizeKey(e.key)
      if (!this.inputState.keysDown.has(key)) {
        this.inputState.keysPressed.add(key)
      }
      this.inputState.keysDown.add(key)

      if (this.runtime) {
        this.runtime.emit('keydown', { key, code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey })
        this.runtime.emit(`keydown:${key}`, { key, code: e.code })
      }
    })

    window.addEventListener('keyup', (e) => {
      const key = this.normalizeKey(e.key)
      this.inputState.keysDown.delete(key)
      this.inputState.keysReleased.add(key)

      if (this.runtime) {
        this.runtime.emit('keyup', { key, code: e.code })
        this.runtime.emit(`keyup:${key}`, { key, code: e.code })
      }
    })

    // Mouse
    window.addEventListener('mousemove', (e) => {
      this.inputState.mousePosition = { x: e.clientX, y: e.clientY }

      if (this.runtime) {
        this.runtime.emit('mousemove', {
          x: e.clientX,
          y: e.clientY,
          movementX: e.movementX,
          movementY: e.movementY,
        })
      }
    })

    window.addEventListener('mousedown', (e) => {
      this.inputState.mouseButtons.add(e.button)
      this.inputState.mouseClicked.add(e.button)

      if (this.runtime) {
        this.runtime.emit('mousedown', {
          button: e.button,
          x: e.clientX,
          y: e.clientY,
        })
      }
    })

    window.addEventListener('mouseup', (e) => {
      this.inputState.mouseButtons.delete(e.button)

      if (this.runtime) {
        this.runtime.emit('mouseup', {
          button: e.button,
          x: e.clientX,
          y: e.clientY,
        })
      }
    })

    window.addEventListener('wheel', (e) => {
      if (this.runtime) {
        this.runtime.emit('wheel', {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
        })
      }
    })
  }

  private normalizeKey(key: string): string {
    // Normalize common key names
    if (key.length === 1) return key.toUpperCase()
    return key
  }

  private processInputEvents(): void {
    // Events are already emitted in the handlers above
    // This method is for any additional per-frame processing
  }

  // ==========================================================================
  // Input Namespace
  // ==========================================================================

  private createInputNamespace(): ForgeMap {
    return {
      // Key state
      isKeyDown: (key: string) => this.inputState.keysDown.has(key.toUpperCase()),
      isKeyPressed: (key: string) => this.inputState.keysPressed.has(key.toUpperCase()),
      isKeyReleased: (key: string) => this.inputState.keysReleased.has(key.toUpperCase()),
      getKeysDown: () => Array.from(this.inputState.keysDown),

      // Mouse state
      getMousePosition: () => [this.inputState.mousePosition.x, this.inputState.mousePosition.y],
      getMouseX: () => this.inputState.mousePosition.x,
      getMouseY: () => this.inputState.mousePosition.y,
      isMouseDown: (button: number = 0) => this.inputState.mouseButtons.has(button),
      isMouseClicked: (button: number = 0) => this.inputState.mouseClicked.has(button),

      // Common key aliases
      isUp: () => this.inputState.keysDown.has('W') || this.inputState.keysDown.has('ArrowUp'),
      isDown: () => this.inputState.keysDown.has('S') || this.inputState.keysDown.has('ArrowDown'),
      isLeft: () => this.inputState.keysDown.has('A') || this.inputState.keysDown.has('ArrowLeft'),
      isRight: () => this.inputState.keysDown.has('D') || this.inputState.keysDown.has('ArrowRight'),
      isSpace: () => this.inputState.keysDown.has(' '),
      isEscape: () => this.inputState.keysDown.has('Escape'),
      isEnter: () => this.inputState.keysDown.has('Enter'),
    }
  }

  // ==========================================================================
  // Time Namespace
  // ==========================================================================

  private startTime: number = performance.now()
  private frameCount: number = 0
  private lastFpsUpdate: number = 0
  private currentFps: number = 0

  private createTimeNamespace(): ForgeMap {
    return {
      // Current time in seconds since start
      now: () => (performance.now() - this.startTime) / 1000,

      // Milliseconds since start
      nowMs: () => performance.now() - this.startTime,

      // Frame counter
      frame: () => this.frameCount,

      // FPS tracking
      fps: () => this.currentFps,

      // Timestamps for profiling
      timestamp: () => performance.now(),
      elapsed: (start: number) => performance.now() - start,
    }
  }

  /**
   * Update time tracking. Called internally from update().
   */
  updateTime(deltaTime: number): void {
    this.frameCount++

    // Update FPS every second
    const now = performance.now()
    if (now - this.lastFpsUpdate > 1000) {
      this.currentFps = this.frameCount / ((now - this.lastFpsUpdate) / 1000)
      this.frameCount = 0
      this.lastFpsUpdate = now
    }
  }

  // ==========================================================================
  // Engine Namespace
  // ==========================================================================

  private createEngineNamespace(): ForgeMap {
    return {
      // Version info
      version: '2.0.0',
      name: 'Forge Engine Bridge',

      // Scene access
      getSceneChildren: () => this.scene.children.length,

      // Debug helpers
      log: (...args: ForgeValue[]) => {
        console.log('[Forge]', ...args)
        return null
      },
      warn: (...args: ForgeValue[]) => {
        console.warn('[Forge]', ...args)
        return null
      },
      error: (...args: ForgeValue[]) => {
        console.error('[Forge]', ...args)
        return null
      },

      // Performance
      getMemory: () => {
        if ('memory' in performance) {
          const mem = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
          if (mem) {
            return {
              used: mem.usedJSHeapSize,
              total: mem.totalJSHeapSize,
            }
          }
        }
        return null
      },
    }
  }

  // ==========================================================================
  // Bridge Access
  // ==========================================================================

  /**
   * Get the render bridge for direct manipulation.
   */
  getRenderBridge(): RenderBridge {
    return this.renderBridge
  }

  /**
   * Get the voxel bridge for direct manipulation.
   */
  getVoxelBridge(): VoxelBridge | null {
    return this.voxelBridge
  }

  /**
   * Get the asset bridge for direct manipulation.
   */
  getAssetBridge(): AssetBridge | null {
    return this.assetBridge
  }

  /**
   * Get the UI bridge for direct manipulation.
   */
  getUIBridge(): UIBridge | null {
    return this.uiBridge
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.renderBridge.dispose()

    if (this.assetBridge) {
      this.assetBridge.dispose()
    }

    if (this.uiBridge) {
      this.uiBridge.dispose()
    }

    // Remove input handlers (would need to track them to remove properly)
    this.runtime = null
  }
}

/**
 * Create an engine bridge with default configuration.
 */
export function createEngineBridge(scene: THREE.Scene, options?: Partial<EngineBridgeConfig>): EngineBridge {
  return new EngineBridge({
    scene,
    ...options,
  })
}
