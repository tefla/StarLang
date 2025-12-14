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
 */
export interface EntityPlacement {
  id: string
  type: 'door' | 'terminal' | 'switch' | 'sensor' | 'light'
  voxelPos: VoxelCoord
  rotation: 0 | 90 | 180 | 270  // Rotation in 90-degree increments
  facingAxis: 'x' | 'y' | 'z'   // Which axis the entity faces
  facingDir: -1 | 1             // Positive or negative along facing axis
  status?: 'OK' | 'FAULT' | 'DAMAGED' | 'STANDBY'
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
  status: 'OK' | 'FAULT'  // Physical state - broken switches don't respond
}

export interface WallLightLayout {
  position: Position3D
  rotation: number
  color: string      // Hex color like '#ffffee'
  intensity: number  // 0-5, default 1
}

export interface ShipLayout {
  rooms: Record<string, RoomLayout>
  doors: Record<string, DoorLayout>
  terminals: Record<string, TerminalLayout>
  sensors?: Record<string, SensorLayout>
  switches?: Record<string, SwitchLayout>
  wallLights?: Record<string, WallLightLayout>
}
