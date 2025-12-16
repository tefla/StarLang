/**
 * ForgeAssetLoader - Loads and compiles .forge assets at runtime.
 *
 * Replaces JSON-based asset loading with Forge DSL compilation.
 * All assets are now defined in .forge files and compiled on load.
 *
 * Supports both server-side (Node/Bun) and browser-side loading.
 */

import { compileAsset } from './index'
import type { AnimatedAssetDef } from '../voxel/AnimatedAsset'

// Static list of all asset files (required for browser loading)
const ASSET_FILES = [
  'button.asset.forge',
  'ceiling-light.asset.forge',
  'desk.asset.forge',
  'door-frame.asset.forge',
  'door-panel.asset.forge',
  'door-sliding.asset.forge',
  'fan-blades.asset.forge',
  'keyboard.asset.forge',
  'led-green.asset.forge',
  'led-red.asset.forge',
  'monitor-frame.asset.forge',
  'monitor-stand.asset.forge',
  'switch-animated.asset.forge',
  'switch.asset.forge',
  'wall-fan.asset.forge',
  'wall-light.asset.forge',
  'wall-terminal.asset.forge',
  'warning-light.asset.forge',
  'workstation.asset.forge',
]

// Detect if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

/**
 * Load all .forge assets from a directory (server-side only).
 * @param dir Directory containing .asset.forge files
 * @returns Array of compiled AnimatedAssetDef
 */
export function loadForgeAssetsFromDir(dir: string): AnimatedAssetDef[] {
  if (isBrowser) {
    console.warn('ForgeAssetLoader: loadForgeAssetsFromDir not available in browser. Use loadForgeAssetsAsync instead.')
    return []
  }

  // Dynamic import for server-side only
  const fs = require('fs')
  const path = require('path')

  const assets: AnimatedAssetDef[] = []
  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.asset.forge'))

  for (const file of files) {
    const filePath = path.join(dir, file)
    try {
      const source = fs.readFileSync(filePath, 'utf-8')
      const asset = compileAsset(source, filePath)
      if (asset) {
        assets.push(asset)
      }
    } catch (e) {
      console.error(`ForgeAssetLoader: Failed to compile ${file}:`, e)
    }
  }

  return assets
}

/**
 * Load forge assets from the default content directory (server-side only).
 * @returns Array of compiled AnimatedAssetDef
 */
export function loadForgeAssets(): AnimatedAssetDef[] {
  if (isBrowser) {
    console.warn('ForgeAssetLoader: loadForgeAssets not available in browser. Use loadForgeAssetsAsync instead.')
    return []
  }

  const path = require('path')
  const contentDir = path.join(__dirname, '../content/forge/assets')
  return loadForgeAssetsFromDir(contentDir)
}

/**
 * Load a single .forge asset file via HTTP (browser) or fs (server).
 * @param filename The asset filename (e.g., 'door-sliding.asset.forge')
 * @returns Compiled AnimatedAssetDef or null
 */
export async function loadForgeAssetAsync(filename: string): Promise<AnimatedAssetDef | null> {
  try {
    let source: string

    if (isBrowser) {
      // Fetch via HTTP in browser
      const response = await fetch(`/content/forge/assets/${filename}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      source = await response.text()
    } else {
      // Read from filesystem on server
      const fs = require('fs')
      const path = require('path')
      const filePath = path.join(__dirname, '../content/forge/assets', filename)
      source = fs.readFileSync(filePath, 'utf-8')
    }

    return compileAsset(source, filename)
  } catch (e) {
    console.error(`ForgeAssetLoader: Failed to load ${filename}:`, e)
    return null
  }
}

/**
 * Load all forge assets asynchronously (works in both browser and server).
 * @returns Array of compiled AnimatedAssetDef
 */
export async function loadForgeAssetsAsync(): Promise<AnimatedAssetDef[]> {
  const results = await Promise.all(
    ASSET_FILES.map(file => loadForgeAssetAsync(file))
  )

  return results.filter((asset): asset is AnimatedAssetDef => asset !== null)
}

/**
 * Get all forge asset IDs from a directory without fully compiling.
 * Useful for listing available assets.
 */
export function getForgeAssetIds(dir?: string): string[] {
  if (isBrowser || !dir) {
    // Return static list in browser
    return ASSET_FILES.map(f => f.replace('.asset.forge', ''))
  }

  const fs = require('fs')
  const path = require('path')
  const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.asset.forge'))
  return files.map((f: string) => path.basename(f, '.asset.forge'))
}

// Cache for compiled assets
let cachedAssets: AnimatedAssetDef[] | null = null
let asyncAssetsPromise: Promise<AnimatedAssetDef[]> | null = null

/**
 * Get all forge assets (cached after first load).
 * In browser, returns empty array on first call - use getAllForgeAssetsAsync instead.
 */
export function getAllForgeAssets(): AnimatedAssetDef[] {
  if (isBrowser) {
    // In browser, return cached assets or empty array
    // Caller should use getAllForgeAssetsAsync for initial load
    return cachedAssets ?? []
  }

  if (!cachedAssets) {
    cachedAssets = loadForgeAssets()
    console.log(`ForgeAssetLoader: Compiled ${cachedAssets.length} assets from .forge files`)
  }
  return cachedAssets
}

/**
 * Get all forge assets asynchronously (works in browser).
 * Cached after first successful load.
 */
export async function getAllForgeAssetsAsync(): Promise<AnimatedAssetDef[]> {
  if (cachedAssets) {
    return cachedAssets
  }

  // Prevent concurrent loads
  if (!asyncAssetsPromise) {
    asyncAssetsPromise = loadForgeAssetsAsync().then(assets => {
      cachedAssets = assets
      console.log(`ForgeAssetLoader: Compiled ${assets.length} assets from .forge files`)
      return assets
    })
  }

  return asyncAssetsPromise
}

/**
 * Clear the asset cache (useful for hot reload).
 */
export function clearForgeAssetCache(): void {
  cachedAssets = null
  asyncAssetsPromise = null
}

/**
 * Reload all forge assets (clears cache and reloads).
 */
export function reloadForgeAssets(): AnimatedAssetDef[] {
  clearForgeAssetCache()
  return getAllForgeAssets()
}

/**
 * Reload all forge assets asynchronously.
 */
export async function reloadForgeAssetsAsync(): Promise<AnimatedAssetDef[]> {
  clearForgeAssetCache()
  return getAllForgeAssetsAsync()
}
