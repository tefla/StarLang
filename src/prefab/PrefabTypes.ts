/**
 * Prefab system types.
 *
 * Prefabs are reusable templates of voxel structures with optional
 * embedded entities. Instances can be placed throughout the world,
 * and changes to the template propagate to all instances.
 */

import type { Voxel, VoxelCoord } from '../voxel/VoxelTypes'
import type { EntityPlacement } from '../types/layout'

/**
 * Prefab categories for organization.
 * Validated against prefabs.categories config.
 */
export type PrefabCategory = string

/**
 * A connector point for snapping prefabs together.
 */
export interface PrefabConnector {
  /** Unique ID within the prefab */
  id: string
  /** Position relative to prefab anchor */
  position: VoxelCoord
  /** Direction the connector faces */
  direction: VoxelCoord  // Unit vector: {1,0,0}, {0,1,0}, etc.
  /** Connector type for matching (e.g., "wall", "floor", "pipe") */
  type: string
}

/**
 * An entity embedded in a prefab.
 */
export interface PrefabEntity {
  /** Entity type - validated against interactions.interactable_types config */
  type: string
  /** Position relative to prefab anchor */
  position: VoxelCoord
  /** Rotation relative to prefab */
  rotation: 0 | 90 | 180 | 270
  /** Additional properties */
  properties?: Record<string, unknown>
}

/**
 * Bounding box for a prefab.
 */
export interface PrefabBounds {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

/**
 * A prefab template definition.
 */
export interface Prefab {
  /** Unique identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Category for organization */
  category: PrefabCategory
  /** Voxels stored as coordinate key -> voxel value */
  voxels: Record<string, Voxel>  // Key format: "x,y,z"
  /** Bounding box in local coordinates */
  bounds: PrefabBounds
  /** Anchor point (origin for placement) */
  anchor: VoxelCoord
  /** Embedded entities */
  entities: PrefabEntity[]
  /** Connector points for snapping */
  connectors: PrefabConnector[]
  /** Optional thumbnail image (base64) */
  thumbnail?: string
  /** Creation metadata */
  metadata?: {
    createdAt: string
    modifiedAt: string
    author?: string
    description?: string
    tags?: string[]
  }
}

/**
 * A placed instance of a prefab in the world.
 */
export interface PrefabInstance {
  /** Unique instance ID */
  id: string
  /** Reference to prefab template */
  prefabId: string
  /** World position of anchor point */
  position: VoxelCoord
  /** Rotation around Y axis (0, 90, 180, 270 degrees) */
  rotation: 0 | 90 | 180 | 270
  /** Whether instance is locked (can't be moved/deleted) */
  locked?: boolean
  /** Per-instance property overrides */
  overrides?: {
    /** Entity state overrides */
    entities?: Record<string, Partial<PrefabEntity>>
    /** Custom properties */
    properties?: Record<string, unknown>
  }
}

/**
 * Convert voxel coordinate to string key.
 */
export function voxelKey(coord: VoxelCoord): string {
  return `${coord.x},${coord.y},${coord.z}`
}

/**
 * Parse string key to voxel coordinate.
 */
export function parseVoxelKey(key: string): VoxelCoord {
  const [x, y, z] = key.split(',').map(Number)
  return { x: x ?? 0, y: y ?? 0, z: z ?? 0 }
}

/**
 * Rotate a point around Y axis by given degrees.
 */
export function rotatePoint(
  point: VoxelCoord,
  rotation: 0 | 90 | 180 | 270
): VoxelCoord {
  switch (rotation) {
    case 0:
      return { ...point }
    case 90:
      return { x: -point.z, y: point.y, z: point.x }
    case 180:
      return { x: -point.x, y: point.y, z: -point.z }
    case 270:
      return { x: point.z, y: point.y, z: -point.x }
  }
}

/**
 * Calculate the bounds of rotated voxel positions.
 */
export function calculateRotatedBounds(
  bounds: PrefabBounds,
  rotation: 0 | 90 | 180 | 270
): PrefabBounds {
  const corners = [
    { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
    { x: bounds.maxX, y: bounds.minY, z: bounds.minZ },
    { x: bounds.minX, y: bounds.maxY, z: bounds.minZ },
    { x: bounds.maxX, y: bounds.maxY, z: bounds.minZ },
    { x: bounds.minX, y: bounds.minY, z: bounds.maxZ },
    { x: bounds.maxX, y: bounds.minY, z: bounds.maxZ },
    { x: bounds.minX, y: bounds.maxY, z: bounds.maxZ },
    { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ }
  ]

  const rotated = corners.map(c => rotatePoint(c, rotation))

  return {
    minX: Math.min(...rotated.map(c => c.x)),
    minY: Math.min(...rotated.map(c => c.y)),
    minZ: Math.min(...rotated.map(c => c.z)),
    maxX: Math.max(...rotated.map(c => c.x)),
    maxY: Math.max(...rotated.map(c => c.y)),
    maxZ: Math.max(...rotated.map(c => c.z))
  }
}
