// Layout types - Physical 3D positioning separate from logical StarLang
// Players see/edit StarLang only; layout data is hidden

import type { Position3D } from './nodes'
import type { VoxelType } from '../voxel/VoxelTypes'
import type { ChunkData as VoxelChunkData } from '../voxel/VoxelChunk'

// =============================================================================
// Voxel Layout V2 - Voxel-based world representation
// =============================================================================

/**
 * Coordinate in voxel space.
 */
export interface VoxelCoord {
  x: number
  y: number
  z: number
}

/**
 * Bounding box in voxel space.
 */
export interface VoxelBounds {
  min: VoxelCoord
  max: VoxelCoord
}

/**
 * Chunk data re-exported from VoxelChunk for convenience.
 * Supports both sparse and RLE formats.
 */
export type ChunkData = VoxelChunkData

/**
 * Axis-aligned room volume defined by voxel coordinates.
 */
export interface RoomVolume {
  id: string
  name: string
  minVoxel: VoxelCoord
  maxVoxel: VoxelCoord
  regions?: VoxelRegion[]  // For non-rectangular rooms (L-shapes, etc)
  atmosphere?: {
    hasO2: boolean
    pressure: number  // 0.0 - 1.0
  }
}

/**
 * Sub-region within a room for non-rectangular shapes.
 */
export interface VoxelRegion {
  minVoxel: VoxelCoord
  maxVoxel: VoxelCoord
}

/**
 * Entity placement in voxel space.
 * Entity types and statuses are config-driven strings.
 */
export interface EntityPlacement {
  id: string
  type: string  // Validated against interactions.interactable_types config
  voxelPos: VoxelCoord
  rotation: 0 | 90 | 180 | 270  // Rotation in 90-degree increments
  facingAxis: 'x' | 'y' | 'z'   // Which axis the entity faces
  facingDir: -1 | 1             // Positive or negative along facing axis
  status?: string  // Validated against interactions.entity_statuses config
  properties?: Record<string, unknown>  // Type-specific properties
}

/**
 * Door-specific placement with room connections.
 */
export interface DoorPlacement extends EntityPlacement {
  type: 'door'
  connectsRooms: [string, string]  // IDs of rooms this door connects
  width: number   // Width in voxels (default 1)
  height: number  // Height in voxels (default 2)
}

/**
 * Prefab instance placement.
 */
export interface PrefabInstance {
  prefabId: string
  position: VoxelCoord  // Anchor position
  rotation: 0 | 90 | 180 | 270  // Y-axis rotation
}

/**
 * Voxel-based layout format V2.
 */
export interface VoxelLayoutV2 {
  version: 2
  name: string
  bounds: VoxelBounds
  chunks: ChunkData[]
  rooms: Record<string, RoomVolume>
  entities: Record<string, EntityPlacement | DoorPlacement>
  prefabInstances: PrefabInstance[]
  metadata?: {
    createdAt: string
    modifiedAt: string
    author?: string
  }
}

// =============================================================================
// Legacy Layout V1 - Continuous coordinate system (for backward compatibility)
// =============================================================================

export interface RoomLayout {
  position: Position3D
  size: { width: number; height: number; depth: number }
}

export interface DoorLayout {
  position: Position3D
  rotation: number
}

export interface TerminalLayout {
  position: Position3D
  rotation: number
}

export interface SensorLayout {
  position: Position3D
}

export interface SwitchLayout {
  position: Position3D
  rotation: number
  status: string  // Physical state - validated against node-types.SWITCH.statuses config
}

export interface WallLightLayout {
  position: Position3D
  rotation: number
  color: string      // Hex color like '#ffffee'
  intensity: number  // 0-5, default 1
}

/**
 * Generic asset instance placement.
 * Used for furniture, fixtures, and other data-driven objects.
 */
export interface AssetInstance {
  /** Asset ID to place (must be registered in asset loader) */
  asset: string
  /** Position in voxel coordinates */
  position: Position3D
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270
  /** Optional parameters for conditional children */
  params?: Record<string, string | number | boolean>
  /** Height offset in voxels (for wall-mounted items) */
  heightOffset?: number
}

export interface ShipLayout {
  /** Layout version (defaults to 1 for backward compatibility) */
  version?: 1 | 2
  rooms: Record<string, RoomLayout>
  /** Doors - optional, can be inferred from door-frame assetInstances */
  doors?: Record<string, DoorLayout>
  /** Terminals - optional, can be inferred from wall-terminal/workstation assetInstances */
  terminals?: Record<string, TerminalLayout>
  sensors?: Record<string, SensorLayout>
  /** Switches - optional, can be inferred from switch assetInstances */
  switches?: Record<string, SwitchLayout>
  /** Wall lights - optional, can be inferred from wall-light assetInstances */
  wallLights?: Record<string, WallLightLayout>
  /** Asset instances - primary way to place objects in V2 layouts */
  assetInstances?: Record<string, AssetInstance>
}
