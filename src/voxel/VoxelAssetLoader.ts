/**
 * Loads and resolves voxel assets.
 *
 * Assets are defined in JSON files and can reference other assets
 * for composition. The loader resolves these references and applies
 * rotation and parameters to produce flat voxel lists.
 */

import { VoxelType } from './VoxelTypes'
import {
  type VoxelAssetDef,
  type ResolvedVoxel,
  type Rotation90,
  type AssetChild,
  rotateOffset,
  combineRotations,
  evaluateCondition
} from './VoxelAsset'

/**
 * Loads and resolves voxel assets from definitions.
 */
export class VoxelAssetLoader {
  private assets = new Map<string, VoxelAssetDef>()

  /**
   * Register an asset definition.
   */
  register(asset: VoxelAssetDef): void {
    this.assets.set(asset.id, asset)
  }

  /**
   * Register multiple assets at once.
   */
  registerAll(assets: VoxelAssetDef[]): void {
    for (const asset of assets) {
      this.register(asset)
    }
  }

  /**
   * Get an asset definition by ID.
   */
  getAsset(id: string): VoxelAssetDef | undefined {
    return this.assets.get(id)
  }

  /**
   * Check if an asset exists.
   */
  hasAsset(id: string): boolean {
    return this.assets.has(id)
  }

  /**
   * Get all registered asset IDs.
   */
  getAssetIds(): string[] {
    return Array.from(this.assets.keys())
  }

  /**
   * Resolve an asset to a flat list of voxels at voxel coordinates.
   *
   * @param id Asset ID to resolve
   * @param position Position in voxel coordinates
   * @param rotation Rotation in degrees (0, 90, 180, 270)
   * @param params Parameter values for conditional children
   * @param heightOffset Y offset in voxels (added to position.y)
   * @returns Array of resolved voxels with absolute coordinates
   */
  resolve(
    id: string,
    position: { x: number; y: number; z: number },
    rotation: Rotation90 = 0,
    params: Record<string, string | number | boolean> = {},
    heightOffset: number = 0
  ): ResolvedVoxel[] {
    const asset = this.assets.get(id)
    if (!asset) {
      console.warn(`VoxelAssetLoader: Unknown asset "${id}"`)
      return []
    }

    // Position is already in voxel coordinates
    const baseX = position.x
    const baseY = position.y + heightOffset
    const baseZ = position.z

    // Fill in default parameter values
    const resolvedParams = { ...params }
    if (asset.parameters) {
      for (const [key, def] of Object.entries(asset.parameters)) {
        if (resolvedParams[key] === undefined) {
          resolvedParams[key] = def.default
        }
      }
    }

    return this.resolveRecursive(
      asset,
      baseX,
      baseY,
      baseZ,
      rotation,
      resolvedParams
    )
  }

  /**
   * Recursively resolve an asset and its children.
   */
  private resolveRecursive(
    asset: VoxelAssetDef,
    baseX: number,
    baseY: number,
    baseZ: number,
    rotation: Rotation90,
    params: Record<string, string | number | boolean>
  ): ResolvedVoxel[] {
    const result: ResolvedVoxel[] = []

    // Apply anchor offset (negated, so anchor becomes origin)
    const anchorOffset: [number, number, number] = [
      -asset.anchor.x,
      -asset.anchor.y,
      -asset.anchor.z
    ]

    // Resolve direct voxel placements
    for (const placement of asset.voxels) {
      // Apply anchor offset to placement offset
      const adjusted: [number, number, number] = [
        placement.offset[0] + anchorOffset[0],
        placement.offset[1] + anchorOffset[1],
        placement.offset[2] + anchorOffset[2]
      ]

      // Rotate the offset
      const rotated = rotateOffset(adjusted, rotation)

      // Get voxel type from name
      const voxelType = VoxelType[placement.type]
      if (voxelType === undefined) {
        console.warn(`VoxelAssetLoader: Unknown voxel type "${placement.type}"`)
        continue
      }

      result.push({
        x: baseX + rotated[0],
        y: baseY + rotated[1],
        z: baseZ + rotated[2],
        type: voxelType
      })
    }

    // Resolve child assets
    if (asset.children) {
      for (const child of asset.children) {
        // Check condition
        if (child.condition && !evaluateCondition(child.condition, params)) {
          continue
        }

        // Get child asset
        const childAsset = this.assets.get(child.asset)
        if (!childAsset) {
          console.warn(`VoxelAssetLoader: Unknown child asset "${child.asset}"`)
          continue
        }

        // Apply anchor offset to child offset
        const adjusted: [number, number, number] = [
          child.offset[0] + anchorOffset[0],
          child.offset[1] + anchorOffset[1],
          child.offset[2] + anchorOffset[2]
        ]

        // Rotate the child position
        const rotatedOffset = rotateOffset(adjusted, rotation)

        // Combine rotations
        const childRotation = combineRotations(rotation, child.rotation ?? 0)

        // Recursively resolve child
        const childVoxels = this.resolveRecursive(
          childAsset,
          baseX + rotatedOffset[0],
          baseY + rotatedOffset[1],
          baseZ + rotatedOffset[2],
          childRotation,
          params
        )

        result.push(...childVoxels)
      }
    }

    return result
  }
}

/**
 * Global asset loader instance.
 */
export const assetLoader = new VoxelAssetLoader()

/**
 * Load built-in assets into the global loader.
 * Called once at startup.
 */
export function loadBuiltinAssets(): void {
  // Import assets from JSON files
  const { builtinAssets } = require('../content/assets')
  assetLoader.registerAll(builtinAssets)
}
