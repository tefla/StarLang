// Forge Hot Reload - Watch and reload .forge files during development
// Uses Bun's native file watching capabilities

import { watch } from 'fs'
import { parse } from './parser'
import { compileModule } from './compiler'
import { formatErrors } from './errors'
import type { AnimatedAssetDef } from '../voxel/AnimatedAsset'
import type { ShipLayout } from '../types/layout'
import type { CompiledEntityDef } from '../types/entity'

export type ForgeHotReloadEventType = 'asset' | 'layout' | 'entity' | 'error'

export interface ForgeHotReloadEvent {
  type: ForgeHotReloadEventType
  filePath: string
  asset?: AnimatedAssetDef
  layout?: ShipLayout
  entity?: CompiledEntityDef
  error?: string
}

export type ForgeHotReloadHandler = (event: ForgeHotReloadEvent) => void

/**
 * ForgeHotReload - Watches .forge files and emits events on changes.
 */
export class ForgeHotReload {
  private watchers: Map<string, ReturnType<typeof watch>> = new Map()
  private handlers: Set<ForgeHotReloadHandler> = new Set()
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private debounceMs: number

  constructor(options: { debounceMs?: number } = {}) {
    this.debounceMs = options.debounceMs ?? 100
  }

  /**
   * Watch a directory for .forge file changes.
   */
  watchDirectory(dirPath: string): void {
    if (this.watchers.has(dirPath)) return

    console.log(`[ForgeHotReload] Watching ${dirPath}`)

    const watcher = watch(dirPath, { recursive: true }, (event, filename) => {
      if (!filename || !filename.endsWith('.forge')) return
      if (event !== 'change' && event !== 'rename') return

      const fullPath = `${dirPath}/${filename}`
      this.handleFileChange(fullPath)
    })

    this.watchers.set(dirPath, watcher)
  }

  /**
   * Watch a specific .forge file.
   */
  watchFile(filePath: string): void {
    if (this.watchers.has(filePath)) return
    if (!filePath.endsWith('.forge')) return

    console.log(`[ForgeHotReload] Watching ${filePath}`)

    const watcher = watch(filePath, (event) => {
      if (event !== 'change') return
      this.handleFileChange(filePath)
    })

    this.watchers.set(filePath, watcher)
  }

  /**
   * Handle a file change with debouncing.
   */
  private handleFileChange(filePath: string): void {
    // Clear existing timer for this file
    const existing = this.debounceTimers.get(filePath)
    if (existing) clearTimeout(existing)

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath)
      this.reloadFile(filePath)
    }, this.debounceMs)

    this.debounceTimers.set(filePath, timer)
  }

  /**
   * Reload and compile a .forge file.
   */
  async reloadFile(filePath: string): Promise<void> {
    console.log(`[ForgeHotReload] Reloading ${filePath}`)

    try {
      const file = Bun.file(filePath)
      if (!await file.exists()) {
        this.emit({ type: 'error', filePath, error: `File not found: ${filePath}` })
        return
      }

      const source = await file.text()
      const module = parse(source)
      const compiled = compileModule(module)

      // Emit events for each compiled definition
      for (const result of compiled.assets) {
        if (result.success && result.result) {
          this.emit({ type: 'asset', filePath, asset: result.result })
        } else {
          const error = formatErrors(result.errors, source, filePath)
          this.emit({ type: 'error', filePath, error })
        }
      }

      for (const result of compiled.layouts) {
        if (result.success && result.result) {
          this.emit({ type: 'layout', filePath, layout: result.result })
        } else {
          const error = formatErrors(result.errors, source, filePath)
          this.emit({ type: 'error', filePath, error })
        }
      }

      for (const result of compiled.entities) {
        if (result.success && result.result) {
          this.emit({ type: 'entity', filePath, entity: result.result })
        } else {
          const error = formatErrors(result.errors, source, filePath)
          this.emit({ type: 'error', filePath, error })
        }
      }

    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      this.emit({ type: 'error', filePath, error })
    }
  }

  /**
   * Subscribe to hot reload events.
   */
  on(handler: ForgeHotReloadHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /**
   * Emit an event to all handlers.
   */
  private emit(event: ForgeHotReloadEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (e) {
        console.error('[ForgeHotReload] Handler error:', e)
      }
    }
  }

  /**
   * Stop watching all files.
   */
  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    this.handlers.clear()
  }
}

// Singleton instance for convenience
let hotReloadInstance: ForgeHotReload | null = null

/**
 * Get or create the global hot reload instance.
 */
export function getForgeHotReload(): ForgeHotReload {
  if (!hotReloadInstance) {
    hotReloadInstance = new ForgeHotReload()
  }
  return hotReloadInstance
}

/**
 * Enable hot reloading for the content directory.
 * Call this during development to automatically reload .forge files.
 */
export function enableForgeHotReload(contentDir = './src/content/forge'): ForgeHotReload {
  const hotReload = getForgeHotReload()
  hotReload.watchDirectory(contentDir)
  return hotReload
}
