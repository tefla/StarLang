/**
 * Type definitions for voxel assets.
 *
 * Voxel assets are reusable voxel structures defined in JSON files.
 * They can reference other assets for composition.
 */

import type { VoxelType } from './VoxelTypes'

/**
 * Rotation in 90-degree increments.
 */
export type Rotation90 = 0 | 90 | 180 | 270

/**
 * A single voxel placement within an asset.
 */
export interface VoxelPlacement {
  /** Offset from asset anchor in voxel units [x, y, z] */
  offset: [number, number, number]
  /** Voxel type name (key of VoxelType enum) */
  type: keyof typeof VoxelType
}

/**
 * A child asset embedded within a parent asset.
 */
export interface AssetChild {
  /** Asset ID to embed */
  asset: string
  /** Offset from parent anchor in voxel units [x, y, z] */
  offset: [number, number, number]
  /** Rotation applied to child (default 0) */
  rotation?: Rotation90
  /** Conditional expression, e.g., "status=FAULT" */
  condition?: string
}

/**
 * Parameter definition for configurable assets.
 */
export interface ParameterDef {
  type: 'enum' | 'number' | 'boolean'
  /** For enum type: list of valid values */
  values?: string[]
  /** Default value if not provided */
  default: string | number | boolean
}

/**
 * A voxel asset definition (as stored in JSON files).
 */
export interface VoxelAssetDef {
  /** Unique asset ID */
  id: string
  /** Human-readable name */
  name: string
  /** Anchor point (voxel offsets are relative to this) */
  anchor: { x: number; y: number; z: number }
  /** Direct voxel placements */
  voxels: VoxelPlacement[]
  /** Child assets to embed */
  children?: AssetChild[]
  /** Configurable parameters */
  parameters?: Record<string, ParameterDef>
}

/**
 * A resolved voxel with absolute world coordinates.
 */
export interface ResolvedVoxel {
  x: number
  y: number
  z: number
  type: VoxelType
}

/**
 * Asset reference in layout files.
 */
export interface AssetReference {
  /** Asset ID to place */
  asset: string
  /** Position in world coordinates (meters) */
  position: { x: number; y: number; z: number }
  /** Rotation (0, 90, 180, 270 degrees) */
  rotation: Rotation90
  /** Parameter values for this instance */
  params?: Record<string, string | number | boolean>
}

/**
 * Apply rotation to an offset [x, y, z].
 * Rotation is around the Y axis (vertical).
 */
export function rotateOffset(
  offset: [number, number, number],
  rotation: Rotation90
): [number, number, number] {
  const [x, y, z] = offset
  switch (rotation) {
    case 0:
      return [x, y, z]
    case 90:
      return [z, y, -x]
    case 180:
      return [-x, y, -z]
    case 270:
      return [-z, y, x]
  }
}

/**
 * Combine two rotations.
 */
export function combineRotations(a: Rotation90, b: Rotation90): Rotation90 {
  return ((a + b) % 360) as Rotation90
}

/**
 * Parse a condition string like "status=FAULT".
 * Returns [param, value] or null if invalid.
 */
export function parseCondition(condition: string): [string, string] | null {
  const match = condition.match(/^(\w+)=(.+)$/)
  if (!match) return null
  return [match[1]!, match[2]!]
}

/**
 * Check if a condition is satisfied given parameter values.
 */
export function evaluateCondition(
  condition: string,
  params: Record<string, string | number | boolean>
): boolean {
  const parsed = parseCondition(condition)
  if (!parsed) return false
  const [param, value] = parsed
  const actualValue = params[param]
  if (actualValue === undefined) return false
  return String(actualValue) === value
}
