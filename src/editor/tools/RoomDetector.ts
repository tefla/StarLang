/**
 * Room detection and volume definition.
 *
 * Provides tools for detecting enclosed spaces (rooms) in the voxel world
 * and defining room volumes for game logic (atmosphere, lighting, etc.).
 */

import { VoxelWorld } from '../../voxel/VoxelWorld'
import { VoxelType, type VoxelCoord } from '../../voxel/VoxelTypes'
import type { RoomVolume, VoxelRegion } from '../../types/layout'

/**
 * Room detection result.
 */
export interface DetectedRoom {
  /** All air voxels that are part of the room */
  voxels: VoxelCoord[]
  /** Bounding box */
  bounds: {
    min: VoxelCoord
    max: VoxelCoord
  }
  /** Voxel count */
  volume: number
  /** Is the room fully enclosed? */
  isEnclosed: boolean
}

/**
 * Detect room using flood-fill from a seed point.
 * Returns all connected air voxels within the search bounds.
 */
export function detectRoomFloodFill(
  world: VoxelWorld,
  seedX: number,
  seedY: number,
  seedZ: number,
  options: {
    /** Maximum voxels to search (prevents infinite loops) */
    maxVoxels?: number
    /** Search bounds (optional) */
    bounds?: {
      min: VoxelCoord
      max: VoxelCoord
    }
  } = {}
): DetectedRoom {
  const maxVoxels = options.maxVoxels ?? 100000
  const bounds = options.bounds ?? {
    min: { x: seedX - 100, y: seedY - 50, z: seedZ - 100 },
    max: { x: seedX + 100, y: seedY + 50, z: seedZ + 100 }
  }

  const visited = new Set<string>()
  const roomVoxels: VoxelCoord[] = []
  const queue: VoxelCoord[] = [{ x: seedX, y: seedY, z: seedZ }]
  let isEnclosed = true

  // Track bounds of actual room
  let minX = seedX, minY = seedY, minZ = seedZ
  let maxX = seedX, maxY = seedY, maxZ = seedZ

  while (queue.length > 0 && roomVoxels.length < maxVoxels) {
    const current = queue.shift()!
    const key = `${current.x},${current.y},${current.z}`

    if (visited.has(key)) continue
    visited.add(key)

    // Check bounds
    if (current.x < bounds.min.x || current.x > bounds.max.x ||
        current.y < bounds.min.y || current.y > bounds.max.y ||
        current.z < bounds.min.z || current.z > bounds.max.z) {
      isEnclosed = false
      continue
    }

    // Check if this is air
    const voxel = world.getVoxel(current.x, current.y, current.z)
    if (voxel !== VoxelType.AIR) continue

    // Add to room
    roomVoxels.push(current)

    // Update bounds
    minX = Math.min(minX, current.x)
    minY = Math.min(minY, current.y)
    minZ = Math.min(minZ, current.z)
    maxX = Math.max(maxX, current.x)
    maxY = Math.max(maxY, current.y)
    maxZ = Math.max(maxZ, current.z)

    // Add neighbors to queue
    const neighbors: VoxelCoord[] = [
      { x: current.x - 1, y: current.y, z: current.z },
      { x: current.x + 1, y: current.y, z: current.z },
      { x: current.x, y: current.y - 1, z: current.z },
      { x: current.x, y: current.y + 1, z: current.z },
      { x: current.x, y: current.y, z: current.z - 1 },
      { x: current.x, y: current.y, z: current.z + 1 }
    ]

    for (const neighbor of neighbors) {
      const nkey = `${neighbor.x},${neighbor.y},${neighbor.z}`
      if (!visited.has(nkey)) {
        queue.push(neighbor)
      }
    }
  }

  // If we hit max voxels, mark as not enclosed
  if (roomVoxels.length >= maxVoxels) {
    isEnclosed = false
  }

  return {
    voxels: roomVoxels,
    bounds: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    },
    volume: roomVoxels.length,
    isEnclosed
  }
}

/**
 * Convert a detected room to a RoomVolume definition.
 */
export function createRoomVolume(
  id: string,
  name: string,
  detected: DetectedRoom,
  hasO2 = true
): RoomVolume {
  return {
    id,
    name,
    minVoxel: detected.bounds.min,
    maxVoxel: detected.bounds.max,
    atmosphere: {
      hasO2,
      pressure: hasO2 ? 1.0 : 0.0
    }
  }
}

/**
 * Check if a voxel coordinate is inside a room volume.
 */
export function isInsideRoom(
  coord: VoxelCoord,
  room: RoomVolume
): boolean {
  // Check main bounds
  if (coord.x >= room.minVoxel.x && coord.x <= room.maxVoxel.x &&
      coord.y >= room.minVoxel.y && coord.y <= room.maxVoxel.y &&
      coord.z >= room.minVoxel.z && coord.z <= room.maxVoxel.z) {
    // If no regions, the main bounds are the room
    if (!room.regions || room.regions.length === 0) {
      return true
    }
    // Check if inside any region
    for (const region of room.regions) {
      if (coord.x >= region.minVoxel.x && coord.x <= region.maxVoxel.x &&
          coord.y >= region.minVoxel.y && coord.y <= region.maxVoxel.y &&
          coord.z >= region.minVoxel.z && coord.z <= region.maxVoxel.z) {
        return true
      }
    }
  }
  return false
}

/**
 * Find which room a coordinate is in.
 */
export function findRoomAt(
  coord: VoxelCoord,
  rooms: Record<string, RoomVolume>
): RoomVolume | null {
  for (const room of Object.values(rooms)) {
    if (isInsideRoom(coord, room)) {
      return room
    }
  }
  return null
}

/**
 * Calculate the overlap between two room volumes.
 */
export function getRoomOverlap(
  room1: RoomVolume,
  room2: RoomVolume
): VoxelRegion | null {
  const minX = Math.max(room1.minVoxel.x, room2.minVoxel.x)
  const minY = Math.max(room1.minVoxel.y, room2.minVoxel.y)
  const minZ = Math.max(room1.minVoxel.z, room2.minVoxel.z)
  const maxX = Math.min(room1.maxVoxel.x, room2.maxVoxel.x)
  const maxY = Math.min(room1.maxVoxel.y, room2.maxVoxel.y)
  const maxZ = Math.min(room1.maxVoxel.z, room2.maxVoxel.z)

  if (minX > maxX || minY > maxY || minZ > maxZ) {
    return null
  }

  return {
    minVoxel: { x: minX, y: minY, z: minZ },
    maxVoxel: { x: maxX, y: maxY, z: maxZ }
  }
}
