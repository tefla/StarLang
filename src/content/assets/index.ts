/**
 * Voxel asset manifest.
 * Exports all built-in assets for loading.
 */

import type { VoxelAssetDef } from '../../voxel/VoxelAsset'
import type { AnimatedAssetDef } from '../../voxel/AnimatedAsset'

// Import static JSON assets
import ledGreen from './primitives/led-green.asset.json'
import ledRed from './primitives/led-red.asset.json'
import button from './primitives/button.asset.json'
import switchAsset from './controls/switch.asset.json'
import wallLight from './lights/wall-light.asset.json'

// Import animated JSON assets
import switchAnimated from './controls/switch-animated.asset.json'
import warningLight from './lights/warning-light.asset.json'
import doorSliding from './doors/door-sliding.asset.json'

/**
 * All built-in static assets.
 * Cast via unknown because JSON imports don't preserve tuple types.
 */
export const builtinAssets: VoxelAssetDef[] = [
  ledGreen as unknown as VoxelAssetDef,
  ledRed as unknown as VoxelAssetDef,
  button as unknown as VoxelAssetDef,
  switchAsset as unknown as VoxelAssetDef,
  wallLight as unknown as VoxelAssetDef
]

/**
 * All built-in animated assets.
 */
export const animatedAssets: AnimatedAssetDef[] = [
  switchAnimated as unknown as AnimatedAssetDef,
  warningLight as unknown as AnimatedAssetDef,
  doorSliding as unknown as AnimatedAssetDef
]
