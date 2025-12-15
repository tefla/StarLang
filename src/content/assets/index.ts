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
import ceilingLight from './lights/ceiling-light.asset.json'

// Import furniture assets
import desk from './furniture/desk.asset.json'
import monitorStand from './furniture/monitor-stand.asset.json'
import monitorFrame from './furniture/monitor-frame.asset.json'
import keyboard from './furniture/keyboard.asset.json'
import workstation from './furniture/workstation.asset.json'

// Import terminal assets
import wallTerminal from './terminals/wall-terminal.asset.json'

// Import door assets
import doorFrame from './doors/door-frame.asset.json'

// Import mechanical assets
import fanBlades from './mechanical/fan-blades.asset.json'
import wallFan from './mechanical/wall-fan.asset.json'

// Import animated JSON assets
import switchAnimated from './controls/switch-animated.asset.json'
import warningLight from './lights/warning-light.asset.json'
import doorSliding from './doors/door-sliding.asset.json'

/**
 * All built-in static assets.
 * Cast via unknown because JSON imports don't preserve tuple types.
 */
export const builtinAssets: VoxelAssetDef[] = [
  // Primitives
  ledGreen as unknown as VoxelAssetDef,
  ledRed as unknown as VoxelAssetDef,
  button as unknown as VoxelAssetDef,
  // Controls
  switchAsset as unknown as VoxelAssetDef,
  // Lights
  wallLight as unknown as VoxelAssetDef,
  ceilingLight as unknown as VoxelAssetDef,
  // Furniture
  desk as unknown as VoxelAssetDef,
  monitorStand as unknown as VoxelAssetDef,
  monitorFrame as unknown as VoxelAssetDef,
  keyboard as unknown as VoxelAssetDef,
  workstation as unknown as VoxelAssetDef,
  // Terminals
  wallTerminal as unknown as VoxelAssetDef,
  // Doors
  doorFrame as unknown as VoxelAssetDef,
  // Mechanical
  fanBlades as unknown as VoxelAssetDef,
  wallFan as unknown as VoxelAssetDef
]

/**
 * All built-in animated assets.
 */
export const animatedAssets: AnimatedAssetDef[] = [
  switchAnimated as unknown as AnimatedAssetDef,
  warningLight as unknown as AnimatedAssetDef,
  doorSliding as unknown as AnimatedAssetDef
]
