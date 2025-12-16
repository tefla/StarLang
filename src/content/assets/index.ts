/**
 * Voxel asset manifest.
 * Loads all assets from Forge DSL files.
 *
 * Supports both synchronous (server) and asynchronous (browser) loading.
 */

import type { VoxelAssetDef } from '../../voxel/VoxelAsset'
import type { AnimatedAssetDef } from '../../voxel/AnimatedAsset'
import { getAllForgeAssets, getAllForgeAssetsAsync } from '../../forge/ForgeAssetLoader'

// Detect browser environment
const isBrowser = typeof window !== 'undefined'

// Get all assets compiled from .forge files (sync - server only)
// In browser, this returns empty initially - use async functions
const allForgeAssets = getAllForgeAssets()

// Cache for async-loaded assets
let cachedBuiltinAssets: VoxelAssetDef[] | null = null
let cachedAnimatedAssets: AnimatedAssetDef[] | null = null

/**
 * Filter assets into builtin (static) and animated categories.
 */
function categorizeAssets(assets: AnimatedAssetDef[]): {
  builtin: VoxelAssetDef[]
  animated: AnimatedAssetDef[]
} {
  const builtin = assets.filter(
    asset => !asset.dynamicParts || asset.dynamicParts.length === 0
  ) as unknown as VoxelAssetDef[]

  const animated = assets.filter(
    asset => (asset.dynamicParts && asset.dynamicParts.length > 0) ||
             (asset.states && Object.keys(asset.states).length > 0) ||
             (asset.animations && Object.keys(asset.animations).length > 0)
  )

  return { builtin, animated }
}

/**
 * All built-in static assets.
 * These are assets without dynamicParts (simple voxel geometry).
 * In browser, returns cached assets or empty - use getBuiltinAssetsAsync.
 */
export const builtinAssets: VoxelAssetDef[] = isBrowser
  ? (cachedBuiltinAssets ?? [])
  : categorizeAssets(allForgeAssets).builtin

/**
 * All built-in animated assets.
 * These are assets with dynamicParts, states, or animations.
 * In browser, returns cached assets or empty - use getAnimatedAssetsAsync.
 */
export const animatedAssets: AnimatedAssetDef[] = isBrowser
  ? (cachedAnimatedAssets ?? [])
  : categorizeAssets(allForgeAssets).animated

/**
 * Load all assets asynchronously (works in browser).
 * Call this during game initialization.
 */
export async function loadAllAssetsAsync(): Promise<{
  builtin: VoxelAssetDef[]
  animated: AnimatedAssetDef[]
}> {
  const allAssets = await getAllForgeAssetsAsync()
  const { builtin, animated } = categorizeAssets(allAssets)

  // Cache the results
  cachedBuiltinAssets = builtin
  cachedAnimatedAssets = animated

  return { builtin, animated }
}

/**
 * Get builtin assets asynchronously.
 */
export async function getBuiltinAssetsAsync(): Promise<VoxelAssetDef[]> {
  if (cachedBuiltinAssets) return cachedBuiltinAssets
  const { builtin } = await loadAllAssetsAsync()
  return builtin
}

/**
 * Get animated assets asynchronously.
 */
export async function getAnimatedAssetsAsync(): Promise<AnimatedAssetDef[]> {
  if (cachedAnimatedAssets) return cachedAnimatedAssets
  const { animated } = await loadAllAssetsAsync()
  return animated
}
