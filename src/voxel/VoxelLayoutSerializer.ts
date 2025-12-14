/**
 * Serializer for VoxelLayoutV2 format.
 *
 * Handles converting VoxelWorld to/from the VoxelLayoutV2 JSON format,
 * including chunk serialization, room volumes, and entity placements.
 */

import { VoxelWorld } from './VoxelWorld'
import { VoxelChunk, type ChunkData, type ChunkDataRLE, type ChunkDataSparse } from './VoxelChunk'
import { CHUNK_SIZE, VOXEL_SIZE, VoxelType } from './VoxelTypes'
import type {
  VoxelLayoutV2,
  VoxelBounds,
  VoxelCoord,
  RoomVolume,
  EntityPlacement,
  DoorPlacement,
  PrefabInstance
} from '../types/layout'

/**
 * Serialize a VoxelWorld to VoxelLayoutV2 format.
 */
export function serializeVoxelWorld(
  world: VoxelWorld,
  name: string,
  rooms: Record<string, RoomVolume> = {},
  entities: Record<string, EntityPlacement | DoorPlacement> = {},
  prefabInstances: PrefabInstance[] = []
): VoxelLayoutV2 {
  const chunks = world.getAllChunks()

  // Calculate bounds from chunks
  const bounds = calculateBounds(chunks)

  // Serialize all non-empty chunks
  const chunkData: ChunkData[] = []
  for (const chunk of chunks) {
    if (!chunk.isEmpty()) {
      chunkData.push(chunk.toJSON())
    }
  }

  return {
    version: 2,
    name,
    bounds,
    chunks: chunkData,
    rooms,
    entities,
    prefabInstances,
    metadata: {
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    }
  }
}

/**
 * Deserialize VoxelLayoutV2 to a VoxelWorld.
 */
export function deserializeVoxelWorld(layout: VoxelLayoutV2): {
  world: VoxelWorld
  rooms: Record<string, RoomVolume>
  entities: Record<string, EntityPlacement | DoorPlacement>
  prefabInstances: PrefabInstance[]
} {
  const world = new VoxelWorld()

  // Load all chunks
  for (const chunkData of layout.chunks) {
    const chunk = VoxelChunk.fromJSON(chunkData)
    world.setChunk(chunk)
  }

  return {
    world,
    rooms: layout.rooms,
    entities: layout.entities,
    prefabInstances: layout.prefabInstances
  }
}

/**
 * Calculate bounding box from chunks.
 */
function calculateBounds(chunks: VoxelChunk[]): VoxelBounds {
  if (chunks.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 }
    }
  }

  let minCx = Infinity, minCy = Infinity, minCz = Infinity
  let maxCx = -Infinity, maxCy = -Infinity, maxCz = -Infinity

  for (const chunk of chunks) {
    if (!chunk.isEmpty()) {
      minCx = Math.min(minCx, chunk.cx)
      minCy = Math.min(minCy, chunk.cy)
      minCz = Math.min(minCz, chunk.cz)
      maxCx = Math.max(maxCx, chunk.cx)
      maxCy = Math.max(maxCy, chunk.cy)
      maxCz = Math.max(maxCz, chunk.cz)
    }
  }

  // Convert chunk coords to voxel coords (max needs +CHUNK_SIZE for far edge)
  return {
    min: {
      x: minCx * CHUNK_SIZE,
      y: minCy * CHUNK_SIZE,
      z: minCz * CHUNK_SIZE
    },
    max: {
      x: (maxCx + 1) * CHUNK_SIZE - 1,
      y: (maxCy + 1) * CHUNK_SIZE - 1,
      z: (maxCz + 1) * CHUNK_SIZE - 1
    }
  }
}

/**
 * Convert world coordinates (meters) to voxel coordinates.
 */
export function worldToVoxelCoord(worldX: number, worldY: number, worldZ: number): VoxelCoord {
  return {
    x: Math.floor(worldX / VOXEL_SIZE),
    y: Math.floor(worldY / VOXEL_SIZE),
    z: Math.floor(worldZ / VOXEL_SIZE)
  }
}

/**
 * Convert voxel coordinates to world coordinates (meters).
 */
export function voxelToWorldCoord(voxel: VoxelCoord): { x: number; y: number; z: number } {
  return {
    x: voxel.x * VOXEL_SIZE,
    y: voxel.y * VOXEL_SIZE,
    z: voxel.z * VOXEL_SIZE
  }
}

/**
 * Save layout to JSON string.
 */
export function layoutToJSON(layout: VoxelLayoutV2): string {
  return JSON.stringify(layout, null, 2)
}

/**
 * Load layout from JSON string.
 */
export function layoutFromJSON(json: string): VoxelLayoutV2 {
  const data = JSON.parse(json)

  // Validate version
  if (data.version !== 2) {
    throw new Error(`Unsupported layout version: ${data.version}. Expected version 2.`)
  }

  return data as VoxelLayoutV2
}

/**
 * Calculate statistics about a layout.
 */
export function getLayoutStats(layout: VoxelLayoutV2): {
  totalVoxels: number
  chunkCount: number
  roomCount: number
  entityCount: number
  prefabCount: number
  boundsSize: VoxelCoord
} {
  let totalVoxels = 0

  for (const chunk of layout.chunks) {
    if (chunk.format === 'rle') {
      // RLE format - count non-air voxels
      const rleChunk = chunk as ChunkDataRLE
      for (let i = 0; i < rleChunk.rle.length; i += 2) {
        const type = rleChunk.rle[i]
        const count = rleChunk.rle[i + 1]
        if (type !== VoxelType.AIR && type !== undefined && count !== undefined) {
          totalVoxels += count
        }
      }
    } else if (chunk.format === 'sparse') {
      // Sparse format
      const sparseChunk = chunk as ChunkDataSparse
      totalVoxels += sparseChunk.voxels.length
    }
  }

  const boundsSize = {
    x: layout.bounds.max.x - layout.bounds.min.x + 1,
    y: layout.bounds.max.y - layout.bounds.min.y + 1,
    z: layout.bounds.max.z - layout.bounds.min.z + 1
  }

  return {
    totalVoxels,
    chunkCount: layout.chunks.length,
    roomCount: Object.keys(layout.rooms).length,
    entityCount: Object.keys(layout.entities).length,
    prefabCount: layout.prefabInstances.length,
    boundsSize
  }
}
