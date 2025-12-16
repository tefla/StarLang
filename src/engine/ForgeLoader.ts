// ForgeLoader - Loads and compiles Forge definitions for the engine
// Bridges the Forge DSL with the runtime EntitySystem

import { parse } from '../forge/parser'
import { compileModule, type CompiledConfig } from '../forge/compiler'
import { configRegistry } from '../forge/ConfigRegistry'
import type { CompiledEntityDef } from '../types/entity'
import type { AnimatedAssetDef } from '../voxel/AnimatedAsset'
import type { ShipLayout } from '../types/layout'

/**
 * Result of loading a Forge file.
 */
export interface ForgeLoadResult {
  assets: AnimatedAssetDef[]
  layouts: ShipLayout[]
  entities: CompiledEntityDef[]
  configs: CompiledConfig[]
  errors: string[]
}

/**
 * ForgeLoader - Compiles Forge source files for runtime use.
 */
export class ForgeLoader {
  private assetCache: Map<string, AnimatedAssetDef> = new Map()
  private layoutCache: Map<string, ShipLayout> = new Map()
  private entityCache: Map<string, CompiledEntityDef> = new Map()

  /**
   * Load and compile a Forge source string.
   */
  loadSource(source: string): ForgeLoadResult {
    const result: ForgeLoadResult = {
      assets: [],
      layouts: [],
      entities: [],
      configs: [],
      errors: []
    }

    try {
      const module = parse(source)
      const compiled = compileModule(module)

      // Collect assets
      for (const assetResult of compiled.assets) {
        if (assetResult.success && assetResult.result) {
          result.assets.push(assetResult.result)
          this.assetCache.set(assetResult.result.id, assetResult.result)
        } else {
          for (const error of assetResult.errors) {
            result.errors.push(error.message)
          }
        }
      }

      // Collect layouts
      for (const layoutResult of compiled.layouts) {
        if (layoutResult.success && layoutResult.result) {
          result.layouts.push(layoutResult.result)
        } else {
          for (const error of layoutResult.errors) {
            result.errors.push(error.message)
          }
        }
      }

      // Collect entities
      for (const entityResult of compiled.entities) {
        if (entityResult.success && entityResult.result) {
          result.entities.push(entityResult.result)
          this.entityCache.set(entityResult.result.id, entityResult.result)
        } else {
          for (const error of entityResult.errors) {
            result.errors.push(error.message)
          }
        }
      }

      // Collect configs and register with ConfigRegistry
      for (const configResult of compiled.configs) {
        if (configResult.success && configResult.result) {
          result.configs.push(configResult.result)
          // Register config with global registry
          configRegistry.register(configResult.result.name, configResult.result.values)
        } else {
          for (const error of configResult.errors) {
            result.errors.push(error.message)
          }
        }
      }
    } catch (e) {
      result.errors.push(String(e))
    }

    return result
  }

  /**
   * Load a Forge file from a URL or file path.
   */
  async loadFile(url: string): Promise<ForgeLoadResult> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        return {
          assets: [],
          layouts: [],
          entities: [],
          configs: [],
          errors: [`Failed to load ${url}: ${response.statusText}`]
        }
      }
      const source = await response.text()
      return this.loadSource(source)
    } catch (e) {
      return {
        assets: [],
        layouts: [],
        entities: [],
        configs: [],
        errors: [`Failed to load ${url}: ${e}`]
      }
    }
  }

  /**
   * Load multiple Forge files.
   */
  async loadFiles(urls: string[]): Promise<ForgeLoadResult> {
    const combined: ForgeLoadResult = {
      assets: [],
      layouts: [],
      entities: [],
      configs: [],
      errors: []
    }

    const results = await Promise.all(urls.map(url => this.loadFile(url)))

    for (const result of results) {
      combined.assets.push(...result.assets)
      combined.layouts.push(...result.layouts)
      combined.entities.push(...result.entities)
      combined.configs.push(...result.configs)
      combined.errors.push(...result.errors)
    }

    return combined
  }

  /**
   * Get a cached asset definition.
   */
  getAsset(id: string): AnimatedAssetDef | undefined {
    return this.assetCache.get(id)
  }

  /**
   * Get a cached entity definition.
   */
  getEntity(id: string): CompiledEntityDef | undefined {
    return this.entityCache.get(id)
  }

  /**
   * Get all cached asset definitions.
   */
  getAllAssets(): AnimatedAssetDef[] {
    return Array.from(this.assetCache.values())
  }

  /**
   * Get all cached entity definitions.
   */
  getAllEntities(): CompiledEntityDef[] {
    return Array.from(this.entityCache.values())
  }

  /**
   * Clear all caches.
   */
  clearCache(): void {
    this.assetCache.clear()
    this.layoutCache.clear()
    this.entityCache.clear()
  }
}

// Singleton instance for convenience
export const forgeLoader = new ForgeLoader()
