/**
 * ForgeAssetLoader - Loads and compiles .forge assets at runtime.
 *
 * Loads all .forge files and extracts asset blocks from the parsed AST.
 * Filename conventions like .asset.forge are purely organizational -
 * any .forge file can contain asset definitions.
 */

import { compileAssets } from './index'
import type { AnimatedAssetDef } from '../voxel/AnimatedAsset'

// Static list of forge files to load in browser (all .forge files in assets dir)
// This list is needed because browsers can't read directories
const FORGE_FILES = [
  'assets/button.asset.forge',
  'assets/ceiling-light.asset.forge',
  'assets/desk.asset.forge',
  'assets/door-frame.asset.forge',
  'assets/door-panel.asset.forge',
  'assets/door-sliding.asset.forge',
  'assets/fan-blades.asset.forge',
  'assets/keyboard.asset.forge',
  'assets/led-green.asset.forge',
  'assets/led-red.asset.forge',
  'assets/monitor-frame.asset.forge',
  'assets/monitor-stand.asset.forge',
  'assets/switch-animated.asset.forge',
  'assets/switch.asset.forge',
  'assets/wall-fan.asset.forge',
  'assets/wall-light.asset.forge',
  'assets/wall-terminal.asset.forge',
  'assets/warning-light.asset.forge',
  'assets/workstation.asset.forge',
]

// Detect if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

/**
 * Recursively find all .forge files in a directory.
 */
function findForgeFiles(dir: string): string[] {
  const fs = require('fs')
  const path = require('path')
  const files: string[] = []

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        scan(fullPath)
      } else if (entry.name.endsWith('.forge')) {
        files.push(fullPath)
      }
    }
  }

  scan(dir)
  return files
}

/**
 * Load all assets from .forge files in a directory (server-side only).
 * Parses each file and extracts any asset blocks found.
 * @param dir Directory containing .forge files
 * @returns Array of compiled AnimatedAssetDef
 */
export function loadForgeAssetsFromDir(dir: string): AnimatedAssetDef[] {
  if (isBrowser) {
    console.warn('ForgeAssetLoader: loadForgeAssetsFromDir not available in browser. Use loadForgeAssetsAsync instead.')
    return []
  }

  const fs = require('fs')
  const assets: AnimatedAssetDef[] = []
  const files = findForgeFiles(dir)

  for (const filePath of files) {
    try {
      const source = fs.readFileSync(filePath, 'utf-8')
      // compileAssets extracts all asset blocks from the parsed AST
      const fileAssets = compileAssets(source, filePath)
      assets.push(...fileAssets)
    } catch (e) {
      // File might not contain assets - that's fine, just skip
      // Only log actual parse errors
      if (e instanceof Error && !e.message.includes('No asset')) {
        console.error(`ForgeAssetLoader: Failed to compile ${filePath}:`, e)
      }
    }
  }

  return assets
}

/**
 * Load forge assets from the default game directory (server-side only).
 * @returns Array of compiled AnimatedAssetDef
 */
export function loadForgeAssets(): AnimatedAssetDef[] {
  if (isBrowser) {
    console.warn('ForgeAssetLoader: loadForgeAssets not available in browser. Use loadForgeAssetsAsync instead.')
    return []
  }

  const path = require('path')
  const gameDir = path.join(__dirname, '../../game/forge')
  return loadForgeAssetsFromDir(gameDir)
}

/**
 * Load assets from a single .forge file via HTTP (browser) or fs (server).
 * @param filename The forge filename relative to game/forge/
 * @returns Array of compiled AnimatedAssetDef (a file can contain multiple assets)
 */
export async function loadForgeFileAsync(filename: string): Promise<AnimatedAssetDef[]> {
  try {
    let source: string

    if (isBrowser) {
      // Fetch via HTTP in browser
      const response = await fetch(`/game/forge/${filename}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      source = await response.text()
    } else {
      // Read from filesystem on server
      const fs = require('fs')
      const path = require('path')
      const filePath = path.join(__dirname, '../../game/forge', filename)
      source = fs.readFileSync(filePath, 'utf-8')
    }

    return compileAssets(source, filename)
  } catch (e) {
    // File might not contain assets - return empty array
    return []
  }
}

/**
 * Load all forge assets asynchronously (works in both browser and server).
 * @returns Array of compiled AnimatedAssetDef
 */
export async function loadForgeAssetsAsync(): Promise<AnimatedAssetDef[]> {
  const results = await Promise.all(
    FORGE_FILES.map(file => loadForgeFileAsync(file))
  )

  // Flatten arrays - each file can contain multiple assets
  return results.flat()
}

/**
 * Get all forge asset IDs.
 */
export function getForgeAssetIds(dir?: string): string[] {
  if (isBrowser || !dir) {
    // In browser, load assets and return their IDs
    const assets = getAllForgeAssets()
    return assets.map(a => a.id)
  }

  // On server, load and extract IDs
  const assets = loadForgeAssetsFromDir(dir)
  return assets.map(a => a.id)
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
