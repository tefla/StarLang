/**
 * Core voxel type definitions and coordinate utilities.
 *
 * Voxel size is 0.1m (10cm) - small enough for detailed objects like
 * chairs, tables, buttons, screens.
 */

import { Config } from '../forge/ConfigRegistry'

// Voxel size in world units (meters)
// 2.5cm voxels for detailed objects
export const VOXEL_SIZE = 0.025

// Chunk size in voxels (16x16x16 = 4096 voxels per chunk)
// At 0.1m voxels, each chunk is 1.6m³
export const CHUNK_SIZE = 16

/**
 * Voxel material types.
 * Lower 8 bits of a Voxel value encode the type.
 */
export enum VoxelType {
  AIR = 0,           // Empty space
  HULL = 1,          // Ship exterior (thick, no light pass)
  WALL = 2,          // Interior wall
  FLOOR = 3,         // Floor surface
  CEILING = 4,       // Ceiling surface
  GLASS = 5,         // Transparent (windows, viewports)
  METAL_GRATE = 6,   // Semi-transparent floor grating
  PANEL = 7,         // Interactive panel surface
  CONDUIT = 8,       // Pipe/cable housing
  TRIM = 9,          // Decorative trim
  LIGHT_FIXTURE = 10, // Light emission source
  SWITCH = 11,       // Wall-mounted switch housing
  SWITCH_BUTTON = 12, // Switch button (clickable)
  LED_GREEN = 13,    // Green LED indicator (OK status)
  LED_RED = 14,      // Red LED indicator (FAULT status)
  DOOR_FRAME = 15,   // Door frame (static)
  DOOR_PANEL = 16,   // Door panel (animated, not in pre-built mesh)
  SCREEN = 17,       // Terminal/status screen surface (emissive)
  DESK = 18,         // Desk/table surface
  KEYBOARD = 19,     // Keyboard surface
  DUCT = 20,         // Ventilation duct housing
  FAN_HUB = 21,      // Fan center hub (static)
  FAN_BLADE = 22,    // Fan blade (animated, not in pre-built mesh)
}

/**
 * A voxel is a 16-bit value:
 * - Lower 8 bits: VoxelType
 * - Upper 8 bits: Variant/color index (0-255)
 */
export type Voxel = number

/**
 * Extract the type from a voxel value.
 */
export function getVoxelType(voxel: Voxel): VoxelType {
  return voxel & 0xFF
}

/**
 * Extract the variant/color index from a voxel value.
 */
export function getVoxelVariant(voxel: Voxel): number {
  return (voxel >> 8) & 0xFF
}

/**
 * Create a voxel value from type and variant.
 */
export function makeVoxel(type: VoxelType, variant: number = 0): Voxel {
  return (type & 0xFF) | ((variant & 0xFF) << 8)
}

/**
 * Check if a voxel type is solid (blocks movement and light).
 */
export function isSolid(voxel: Voxel): boolean {
  const type = getVoxelType(voxel)
  return type !== VoxelType.AIR &&
         type !== VoxelType.GLASS &&
         type !== VoxelType.METAL_GRATE
}

/**
 * Check if a voxel type is transparent (allows light through).
 * SCREEN and FAN_BLADE voxels are treated as transparent for meshing (rendered dynamically).
 */
export function isTransparent(voxel: Voxel): boolean {
  const type = getVoxelType(voxel)
  return type === VoxelType.AIR ||
         type === VoxelType.GLASS ||
         type === VoxelType.METAL_GRATE ||
         type === VoxelType.SCREEN ||
         type === VoxelType.FAN_BLADE
}

/**
 * Integer voxel coordinates.
 */
export interface VoxelCoord {
  x: number
  y: number
  z: number
}

/**
 * Convert world coordinates (meters) to voxel coordinates.
 */
export function worldToVoxel(wx: number, wy: number, wz: number): VoxelCoord {
  return {
    x: Math.floor(wx / VOXEL_SIZE),
    y: Math.floor(wy / VOXEL_SIZE),
    z: Math.floor(wz / VOXEL_SIZE)
  }
}

/**
 * Convert voxel coordinates to world coordinates.
 * Returns the corner (minimum x,y,z) of the voxel.
 */
export function voxelToWorld(vx: number, vy: number, vz: number): [number, number, number] {
  return [
    vx * VOXEL_SIZE,
    vy * VOXEL_SIZE,
    vz * VOXEL_SIZE
  ]
}

/**
 * Convert voxel coordinates to world coordinates (center of voxel).
 */
export function voxelToWorldCenter(vx: number, vy: number, vz: number): [number, number, number] {
  const half = VOXEL_SIZE / 2
  return [
    vx * VOXEL_SIZE + half,
    vy * VOXEL_SIZE + half,
    vz * VOXEL_SIZE + half
  ]
}

/**
 * Convert voxel coordinates to chunk coordinates.
 */
export function voxelToChunk(vx: number, vy: number, vz: number): VoxelCoord {
  return {
    x: Math.floor(vx / CHUNK_SIZE),
    y: Math.floor(vy / CHUNK_SIZE),
    z: Math.floor(vz / CHUNK_SIZE)
  }
}

/**
 * Get local coordinates within a chunk (0 to CHUNK_SIZE-1).
 */
export function voxelToLocal(vx: number, vy: number, vz: number): VoxelCoord {
  return {
    x: ((vx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    y: ((vy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    z: ((vz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  }
}

/**
 * Pack a coordinate string for use as a Map key.
 */
export function coordKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`
}

/**
 * Parse a coordinate string back to numbers.
 */
export function parseCoordKey(key: string): VoxelCoord {
  const parts = key.split(',').map(Number)
  return { x: parts[0] ?? 0, y: parts[1] ?? 0, z: parts[2] ?? 0 }
}

/**
 * Face directions for voxel faces.
 * Order: -X, +X, -Y, +Y, -Z, +Z
 */
export enum Face {
  NEG_X = 0,
  POS_X = 1,
  NEG_Y = 2,
  POS_Y = 3,
  NEG_Z = 4,
  POS_Z = 5
}

/**
 * Normal vectors for each face direction.
 */
export const FACE_NORMALS: readonly [number, number, number][] = [
  [-1, 0, 0],  // NEG_X
  [1, 0, 0],   // POS_X
  [0, -1, 0],  // NEG_Y
  [0, 1, 0],   // POS_Y
  [0, 0, -1],  // NEG_Z
  [0, 0, 1],   // POS_Z
]

/**
 * Offset to neighbor voxel for each face.
 */
export const FACE_OFFSETS: readonly [number, number, number][] = FACE_NORMALS

/**
 * Get the opposite face.
 */
export function oppositeFace(face: Face): Face {
  return face ^ 1  // XOR with 1 flips between pairs (0,1), (2,3), (4,5)
}

/**
 * VoxelType enum value to string name mapping for config lookups.
 */
const VOXEL_TYPE_NAMES: Record<VoxelType, string> = {
  [VoxelType.AIR]: 'AIR',
  [VoxelType.HULL]: 'HULL',
  [VoxelType.WALL]: 'WALL',
  [VoxelType.FLOOR]: 'FLOOR',
  [VoxelType.CEILING]: 'CEILING',
  [VoxelType.GLASS]: 'GLASS',
  [VoxelType.METAL_GRATE]: 'METAL_GRATE',
  [VoxelType.PANEL]: 'PANEL',
  [VoxelType.CONDUIT]: 'CONDUIT',
  [VoxelType.TRIM]: 'TRIM',
  [VoxelType.LIGHT_FIXTURE]: 'LIGHT_FIXTURE',
  [VoxelType.SWITCH]: 'SWITCH',
  [VoxelType.SWITCH_BUTTON]: 'SWITCH_BUTTON',
  [VoxelType.LED_GREEN]: 'LED_GREEN',
  [VoxelType.LED_RED]: 'LED_RED',
  [VoxelType.DOOR_FRAME]: 'DOOR_FRAME',
  [VoxelType.DOOR_PANEL]: 'DOOR_PANEL',
  [VoxelType.SCREEN]: 'SCREEN',
  [VoxelType.DESK]: 'DESK',
  [VoxelType.KEYBOARD]: 'KEYBOARD',
  [VoxelType.DUCT]: 'DUCT',
  [VoxelType.FAN_HUB]: 'FAN_HUB',
  [VoxelType.FAN_BLADE]: 'FAN_BLADE',
}

/**
 * Get the color for a voxel type from the configuration.
 * @param voxelType - The voxel type enum value
 * @returns The color as a hex number (e.g., 0x4488ff)
 */
export function getVoxelColor(voxelType: VoxelType): number {
  const typeName = VOXEL_TYPE_NAMES[voxelType]
  if (typeName) {
    return Config.voxelColors.get(typeName)
  }
  return 0x888888 // Default fallback
}
