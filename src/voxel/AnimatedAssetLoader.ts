/**
 * Extended asset loader that handles animated assets.
 *
 * Builds on VoxelAssetLoader to add:
 * - Registration of animated assets with dynamic parts
 * - Separation of static voxels (for world mesh) from dynamic parts
 * - Factory method for creating AnimatedAssetInstance
 */

import type { AnimatedAssetDef } from './AnimatedAsset'
import { isAnimatedAsset, hasDynamicParts } from './AnimatedAsset'
import type { VoxelAssetDef, ResolvedVoxel, Rotation90 } from './VoxelAsset'
import { VoxelAssetLoader } from './VoxelAssetLoader'
import { AnimatedAssetInstance, type AnimatedAssetInstanceOptions } from './AnimatedAssetInstance'

/**
 * Extended loader that handles both static and animated assets.
 */
export class AnimatedAssetLoader extends VoxelAssetLoader {
  private animatedAssets = new Map<string, AnimatedAssetDef>()

  /**
   * Register an asset (auto-detects if animated).
   */
  override register(asset: VoxelAssetDef | AnimatedAssetDef): void {
    if (isAnimatedAsset(asset)) {
      this.registerAnimated(asset)
    } else {
      super.register(asset)
    }
  }

  /**
   * Register an animated asset.
   */
  registerAnimated(asset: AnimatedAssetDef): void {
    this.animatedAssets.set(asset.id, asset)
    // Also register as regular asset for static voxels
    super.register(asset as unknown as VoxelAssetDef)
  }

  /**
   * Get animated asset definition.
   */
  getAnimatedAsset(id: string): AnimatedAssetDef | undefined {
    return this.animatedAssets.get(id)
  }

  /**
   * Check if an asset is animated.
   */
  isAnimated(id: string): boolean {
    return this.animatedAssets.has(id)
  }

  /**
   * Check if asset has dynamic parts that need runtime instances.
   */
  hasDynamicParts(id: string): boolean {
    const asset = this.animatedAssets.get(id)
    return asset ? hasDynamicParts(asset) : false
  }

  /**
   * Get all animated asset IDs.
   */
  getAnimatedAssetIds(): string[] {
    return Array.from(this.animatedAssets.keys())
  }

  /**
   * Resolve only static voxels (excluding dynamic parts).
   * Dynamic parts are handled separately by AnimatedAssetInstance.
   *
   * For animated assets, this returns only the voxels array
   * (not the dynamicParts, which become runtime THREE.js objects).
   */
  resolveStatic(
    id: string,
    position: { x: number; y: number; z: number },
    rotation: Rotation90 = 0,
    params: Record<string, string | number | boolean> = {},
    heightOffset: number = 0
  ): ResolvedVoxel[] {
    // Use parent resolve which only handles the static voxels array
    return super.resolve(id, position, rotation, params, heightOffset)
  }

  /**
   * Create an AnimatedAssetInstance for an animated asset.
   *
   * @param id Asset ID
   * @param position Position in voxel coordinates
   * @param rotation Rotation (0, 90, 180, 270)
   * @param params Initial parameter values
   * @param options Instance options (shadows, etc.)
   * @returns AnimatedAssetInstance or null if asset not found/not animated
   */
  createInstance(
    id: string,
    position: { x: number; y: number; z: number },
    rotation: Rotation90 = 0,
    params: Record<string, string | number | boolean> = {},
    options: AnimatedAssetInstanceOptions = {}
  ): AnimatedAssetInstance | null {
    const asset = this.animatedAssets.get(id)
    if (!asset) {
      // Try to get from regular assets in case it was registered there
      const regularAsset = this.getAsset(id)
      if (regularAsset && isAnimatedAsset(regularAsset)) {
        return new AnimatedAssetInstance(
          regularAsset as AnimatedAssetDef,
          position,
          rotation,
          params,
          options
        )
      }
      console.warn(`AnimatedAssetLoader: Asset "${id}" not found or not animated`)
      return null
    }

    return new AnimatedAssetInstance(asset, position, rotation, params, options)
  }
}

/**
 * Global animated asset loader instance.
 * Use this for game runtime.
 */
export const animatedAssetLoader = new AnimatedAssetLoader()

/**
 * Load animated assets into the global loader.
 * Call this at startup after loadBuiltinAssets().
 */
export function loadAnimatedAssets(): void {
  // Import animated assets from content synchronously
  // to ensure they're available when buildFromStructure runs
  const { animatedAssets } = require('../content/assets/index')
  for (const asset of animatedAssets) {
    animatedAssetLoader.registerAnimated(asset)
  }
  console.log(`AnimatedAssetLoader: Loaded ${animatedAssets.length} animated assets`)
}
