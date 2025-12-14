/**
 * Door placement tool.
 *
 * Handles placing doors in walls, automatically:
 * - Removing voxels for the door opening
 * - Creating the door entity
 * - Detecting which rooms the door connects
 */

import { VoxelWorld } from '../../voxel/VoxelWorld'
import { VoxelType, Face, type VoxelCoord } from '../../voxel/VoxelTypes'
import type { DoorPlacement, RoomVolume } from '../../types/layout'
import { findRoomAt } from './RoomDetector'

/**
 * Door configuration options.
 */
export interface DoorConfig {
  /** Door width in voxels (default 10 = 1 meter) */
  width?: number
  /** Door height in voxels (default 20 = 2 meters) */
  height?: number
  /** Door thickness in voxels (default 1) */
  thickness?: number
}

/**
 * Result of analyzing a potential door placement.
 */
export interface DoorAnalysis {
  /** Is this a valid door location? */
  isValid: boolean
  /** Reason if invalid */
  invalidReason?: string
  /** Voxels that would be removed for the opening */
  openingVoxels: VoxelCoord[]
  /** The two rooms this door would connect */
  connectsRooms: [string | null, string | null]
  /** Door facing direction */
  facingAxis: 'x' | 'z'
  facingDir: -1 | 1
  /** Door anchor position (bottom-left of opening) */
  anchorPosition: VoxelCoord
}

/**
 * Analyze a potential door placement.
 */
export function analyzeDoorPlacement(
  world: VoxelWorld,
  wallHit: { voxelCoord: VoxelCoord; face: Face },
  rooms: Record<string, RoomVolume>,
  config: DoorConfig = {}
): DoorAnalysis {
  const { voxelCoord, face } = wallHit
  const width = config.width ?? 10
  const height = config.height ?? 20
  const thickness = config.thickness ?? 1

  // Determine door orientation based on hit face
  let facingAxis: 'x' | 'z'
  let facingDir: -1 | 1
  let horizontalAxis: 'x' | 'z'

  if (face === Face.POS_X || face === Face.NEG_X) {
    facingAxis = 'x'
    facingDir = face === Face.POS_X ? 1 : -1
    horizontalAxis = 'z'
  } else if (face === Face.POS_Z || face === Face.NEG_Z) {
    facingAxis = 'z'
    facingDir = face === Face.POS_Z ? 1 : -1
    horizontalAxis = 'x'
  } else {
    // Top/bottom faces - not valid for doors
    return {
      isValid: false,
      invalidReason: 'Cannot place door on floor or ceiling',
      openingVoxels: [],
      connectsRooms: [null, null],
      facingAxis: 'x',
      facingDir: 1,
      anchorPosition: voxelCoord
    }
  }

  // Calculate door anchor (bottom-left corner)
  const anchor: VoxelCoord = {
    x: voxelCoord.x,
    y: voxelCoord.y,
    z: voxelCoord.z
  }

  // Adjust to find wall base (go down to floor level)
  while (anchor.y > 0) {
    const below = world.getVoxel(anchor.x, anchor.y - 1, anchor.z)
    if (below !== VoxelType.AIR && below !== VoxelType.FLOOR) {
      break
    }
    anchor.y--
  }

  // Center the door horizontally
  if (horizontalAxis === 'x') {
    anchor.x = anchor.x - Math.floor(width / 2)
  } else {
    anchor.z = anchor.z - Math.floor(width / 2)
  }

  // Collect voxels for the opening
  const openingVoxels: VoxelCoord[] = []
  let hasWall = false

  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      for (let t = 0; t < thickness; t++) {
        const vx = horizontalAxis === 'x'
          ? anchor.x + w
          : facingAxis === 'x' ? anchor.x + t * facingDir : anchor.x
        const vy = anchor.y + h
        const vz = horizontalAxis === 'z'
          ? anchor.z + w
          : facingAxis === 'z' ? anchor.z + t * facingDir : anchor.z

        const voxel = world.getVoxel(vx, vy, vz)
        if (voxel !== VoxelType.AIR) {
          hasWall = true
          openingVoxels.push({ x: vx, y: vy, z: vz })
        }
      }
    }
  }

  if (!hasWall) {
    return {
      isValid: false,
      invalidReason: 'No wall at this location',
      openingVoxels: [],
      connectsRooms: [null, null],
      facingAxis,
      facingDir,
      anchorPosition: anchor
    }
  }

  // Detect which rooms the door connects
  const room1Coord: VoxelCoord = {
    x: anchor.x + (facingAxis === 'x' ? -1 : Math.floor(width / 2)),
    y: anchor.y + Math.floor(height / 2),
    z: anchor.z + (facingAxis === 'z' ? -1 : Math.floor(width / 2))
  }
  const room2Coord: VoxelCoord = {
    x: anchor.x + (facingAxis === 'x' ? thickness + 1 : Math.floor(width / 2)),
    y: anchor.y + Math.floor(height / 2),
    z: anchor.z + (facingAxis === 'z' ? thickness + 1 : Math.floor(width / 2))
  }

  const room1 = findRoomAt(room1Coord, rooms)
  const room2 = findRoomAt(room2Coord, rooms)

  return {
    isValid: true,
    openingVoxels,
    connectsRooms: [room1?.id ?? null, room2?.id ?? null],
    facingAxis,
    facingDir,
    anchorPosition: anchor
  }
}

/**
 * Place a door in the world.
 */
export function placeDoor(
  world: VoxelWorld,
  analysis: DoorAnalysis,
  doorId: string,
  config: DoorConfig = {}
): DoorPlacement | null {
  if (!analysis.isValid) {
    return null
  }

  const width = config.width ?? 10
  const height = config.height ?? 20

  // Remove wall voxels to create opening
  for (const voxel of analysis.openingVoxels) {
    world.setVoxel(voxel.x, voxel.y, voxel.z, VoxelType.AIR)
  }

  // Create door entity
  const door: DoorPlacement = {
    id: doorId,
    type: 'door',
    voxelPos: analysis.anchorPosition,
    rotation: analysis.facingAxis === 'x' ? (analysis.facingDir > 0 ? 90 : 270) : (analysis.facingDir > 0 ? 0 : 180),
    facingAxis: analysis.facingAxis,
    facingDir: analysis.facingDir,
    connectsRooms: analysis.connectsRooms as [string, string],
    width,
    height,
    status: 'OK'
  }

  return door
}

/**
 * Preview door placement without modifying world.
 */
export function previewDoor(
  analysis: DoorAnalysis
): { position: VoxelCoord; width: number; height: number; rotation: number } | null {
  if (!analysis.isValid) {
    return null
  }

  return {
    position: analysis.anchorPosition,
    width: 10,  // Default width
    height: 20, // Default height
    rotation: analysis.facingAxis === 'x'
      ? (analysis.facingDir > 0 ? 90 : 270)
      : (analysis.facingDir > 0 ? 0 : 180)
  }
}

/**
 * Undo door placement by filling back the opening.
 */
export function undoDoor(
  world: VoxelWorld,
  openingVoxels: VoxelCoord[],
  wallType: VoxelType = VoxelType.WALL
): void {
  for (const voxel of openingVoxels) {
    world.setVoxel(voxel.x, voxel.y, voxel.z, wallType)
  }
}
