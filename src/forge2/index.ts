/**
 * Forge 2.0 - A minimal, extensible scripting language
 *
 * Core concepts:
 * - ~12 keywords, everything else is data
 * - Events are the only "magic" (on, emit)
 * - Optional schemas for validation
 * - First-class functions with closures
 * - Convention-based extensibility
 */

export * from './types'
export { Lexer, tokenize } from './lexer'
export { Parser, parse } from './parser'
export { Runtime } from './runtime'

// Engine bridges
export { RenderBridge, createRenderBindings } from './render-bridge'
export { VoxelBridge, createVoxelBindings } from './voxel-bridge'
export { AssetBridge, createAssetBindings } from './asset-bridge'
export { EngineBridge, createEngineBridge } from './engine-bridge'
export type {
  VoxelWorldLike,
  VoxelRendererLike,
  VoxelTypeRegistryLike,
  AnimatedAssetLoaderLike,
} from './engine-bridge'

import { tokenize } from './lexer'
import { parse } from './parser'
import { Runtime } from './runtime'
import type { Program, ForgeValue, ForgeMap } from './types'

/**
 * Compile source code to AST.
 */
export function compile(source: string, filename?: string): Program {
  const tokens = tokenize(source, filename)
  return parse(tokens)
}

/**
 * Create a new Forge runtime and execute source code.
 */
export function run(source: string, filename?: string): Runtime {
  const program = compile(source, filename)
  const runtime = new Runtime()
  runtime.execute(program)
  return runtime
}

/**
 * Forge VM - High-level interface for running Forge programs.
 *
 * Usage:
 * ```typescript
 * const vm = new ForgeVM()
 * vm.load(source)
 * vm.emit('init')
 *
 * // Game loop
 * vm.tick(deltaTime)
 *
 * // Listen for events
 * vm.on('sound:hit', (data) => playSound('hit'))
 * ```
 */
export class ForgeVM {
  private runtime: Runtime
  private sources: Map<string, string> = new Map()

  constructor() {
    this.runtime = new Runtime()
  }

  /**
   * Load and execute source code.
   */
  load(source: string, filename: string = '<input>'): void {
    this.sources.set(filename, source)
    const program = compile(source, filename)
    this.runtime.execute(program, filename)
  }

  /**
   * Load and execute multiple source files.
   */
  loadAll(sources: Array<{ source: string; filename: string }>): void {
    for (const { source, filename } of sources) {
      this.load(source, filename)
    }
  }

  /**
   * Hot-reload a file. Preserves instance state while updating definitions.
   * Use this when a player edits a file in-game.
   */
  reload(source: string, filename: string): void {
    this.sources.set(filename, source)
    const program = compile(source, filename)
    this.runtime.reload(program, filename)
  }

  /**
   * Check if a file has been loaded.
   */
  hasFile(filename: string): boolean {
    return this.sources.has(filename)
  }

  /**
   * Get the source of a loaded file.
   */
  getSource(filename: string): string | undefined {
    return this.sources.get(filename)
  }

  /**
   * Emit an event.
   */
  emit(event: string, data: ForgeMap = {}): void {
    this.runtime.emit(event, data)
  }

  /**
   * Subscribe to events.
   */
  on(event: string, listener: (data: ForgeMap) => void): () => void {
    return this.runtime.onEvent(event, listener)
  }

  /**
   * Update (call each frame).
   */
  tick(dt: number): void {
    this.runtime.tick(dt)
  }

  /**
   * Get a global value.
   */
  get(name: string): ForgeValue {
    return this.runtime.get(name)
  }

  /**
   * Set a global value.
   */
  set(name: string, value: ForgeValue): void {
    this.runtime.set(name, value)
  }

  /**
   * Get all global bindings.
   */
  getGlobals(): Map<string, ForgeValue> {
    return this.runtime.getGlobals()
  }

  /**
   * Get the underlying runtime.
   */
  getRuntime(): Runtime {
    return this.runtime
  }
}

/**
 * Example usage:
 *
 * ```forge
 * # Define game state as plain data
 * let player = {
 *   position: (0, 0, 0),
 *   health: 100,
 *   velocity: (0, 0, 0)
 * }
 *
 * # Define a schema for validation (optional)
 * schema door:
 *   required:
 *     position: vec3
 *     state: enum("open", "closed", "locked")
 *
 *   open: fn():
 *     if self.state == "locked":
 *       emit "door:locked"
 *     else:
 *       set self.state: "open"
 *       emit "door:opened"
 *
 * # Create instances
 * door main_entrance:
 *   position: (10, 0, 0)
 *   state: "closed"
 *
 * # React to events
 * on "tick":
 *   let dt = event.dt
 *   set player.position.x: player.position.x + player.velocity.x * dt
 *
 * on "keydown:W":
 *   set player.velocity.z: -5
 *
 * on "collision" when event.other.type == "door":
 *   event.other.open()
 *
 * # Emit your own events
 * emit "game:started"
 * ```
 */
