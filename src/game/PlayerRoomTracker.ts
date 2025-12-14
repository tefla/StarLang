/**
 * Player room tracking for runtime gameplay.
 *
 * Determines which room the player is currently in based on their
 * world position and the voxel room volumes. Used for:
 * - Atmosphere simulation (O2, pressure)
 * - Lighting zones
 * - Room-based events and triggers
 */

import type { RoomVolume } from '../types/layout'
import { VOXEL_SIZE } from '../voxel/VoxelTypes'

/**
 * Room tracking result.
 */
export interface RoomTrackingResult {
  /** Current room ID (null if in void/outside) */
  roomId: string | null
  /** Room definition (if found) */
  room: RoomVolume | null
  /** Is player in a pressurized area? */
  hasPressure: boolean
  /** Is player in an oxygenated area? */
  hasO2: boolean
  /** Pressure level (0.0 - 1.0) */
  pressure: number
}

/**
 * Tracks which room a player is in.
 */
export class PlayerRoomTracker {
  private rooms: Record<string, RoomVolume>
  private lastRoomId: string | null = null
  private roomChangeCallbacks: Array<(oldRoom: string | null, newRoom: string | null) => void> = []

  constructor(rooms: Record<string, RoomVolume> = {}) {
    this.rooms = rooms
  }

  /**
   * Update room definitions.
   */
  setRooms(rooms: Record<string, RoomVolume>): void {
    this.rooms = rooms
  }

  /**
   * Get room info at a world position.
   */
  getRoomAt(worldX: number, worldY: number, worldZ: number): RoomTrackingResult {
    // Convert world position to voxel coordinates
    const vx = Math.floor(worldX / VOXEL_SIZE)
    const vy = Math.floor(worldY / VOXEL_SIZE)
    const vz = Math.floor(worldZ / VOXEL_SIZE)

    // Find which room contains this voxel
    for (const [id, room] of Object.entries(this.rooms)) {
      if (this.isInsideRoom(vx, vy, vz, room)) {
        return {
          roomId: id,
          room,
          hasPressure: (room.atmosphere?.pressure ?? 0) > 0,
          hasO2: room.atmosphere?.hasO2 ?? false,
          pressure: room.atmosphere?.pressure ?? 0
        }
      }
    }

    // Not in any room
    return {
      roomId: null,
      room: null,
      hasPressure: false,
      hasO2: false,
      pressure: 0
    }
  }

  /**
   * Update player position and check for room changes.
   */
  update(worldX: number, worldY: number, worldZ: number): RoomTrackingResult {
    const result = this.getRoomAt(worldX, worldY, worldZ)

    // Check for room change
    if (result.roomId !== this.lastRoomId) {
      const oldRoom = this.lastRoomId
      this.lastRoomId = result.roomId
      this.notifyRoomChange(oldRoom, result.roomId)
    }

    return result
  }

  /**
   * Get the last known room ID.
   */
  getCurrentRoomId(): string | null {
    return this.lastRoomId
  }

  /**
   * Check if a voxel coordinate is inside a room.
   */
  private isInsideRoom(vx: number, vy: number, vz: number, room: RoomVolume): boolean {
    // Check main bounds
    if (vx < room.minVoxel.x || vx > room.maxVoxel.x) return false
    if (vy < room.minVoxel.y || vy > room.maxVoxel.y) return false
    if (vz < room.minVoxel.z || vz > room.maxVoxel.z) return false

    // If no sub-regions, main bounds are the room
    if (!room.regions || room.regions.length === 0) {
      return true
    }

    // Check if inside any region
    for (const region of room.regions) {
      if (vx >= region.minVoxel.x && vx <= region.maxVoxel.x &&
          vy >= region.minVoxel.y && vy <= region.maxVoxel.y &&
          vz >= region.minVoxel.z && vz <= region.maxVoxel.z) {
        return true
      }
    }

    return false
  }

  /**
   * Subscribe to room change events.
   */
  onRoomChange(callback: (oldRoom: string | null, newRoom: string | null) => void): () => void {
    this.roomChangeCallbacks.push(callback)
    return () => {
      const index = this.roomChangeCallbacks.indexOf(callback)
      if (index !== -1) {
        this.roomChangeCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Notify listeners of room change.
   */
  private notifyRoomChange(oldRoom: string | null, newRoom: string | null): void {
    for (const callback of this.roomChangeCallbacks) {
      callback(oldRoom, newRoom)
    }
  }

  /**
   * Get all rooms.
   */
  getAllRooms(): Record<string, RoomVolume> {
    return this.rooms
  }

  /**
   * Get room by ID.
   */
  getRoom(id: string): RoomVolume | undefined {
    return this.rooms[id]
  }

  /**
   * Find rooms that share a boundary (potentially connected by door).
   */
  findAdjacentRooms(roomId: string): string[] {
    const room = this.rooms[roomId]
    if (!room) return []

    const adjacent: string[] = []

    for (const [otherId, other] of Object.entries(this.rooms)) {
      if (otherId === roomId) continue

      // Check if rooms share an edge (within 1 voxel tolerance for doors)
      if (this.roomsAreAdjacent(room, other)) {
        adjacent.push(otherId)
      }
    }

    return adjacent
  }

  /**
   * Check if two rooms share a boundary.
   */
  private roomsAreAdjacent(room1: RoomVolume, room2: RoomVolume): boolean {
    // Check X-axis adjacency
    const xAdjacent = (
      (room1.maxVoxel.x + 1 === room2.minVoxel.x || room2.maxVoxel.x + 1 === room1.minVoxel.x) &&
      room1.minVoxel.y <= room2.maxVoxel.y && room1.maxVoxel.y >= room2.minVoxel.y &&
      room1.minVoxel.z <= room2.maxVoxel.z && room1.maxVoxel.z >= room2.minVoxel.z
    )

    // Check Z-axis adjacency
    const zAdjacent = (
      (room1.maxVoxel.z + 1 === room2.minVoxel.z || room2.maxVoxel.z + 1 === room1.minVoxel.z) &&
      room1.minVoxel.x <= room2.maxVoxel.x && room1.maxVoxel.x >= room2.minVoxel.x &&
      room1.minVoxel.y <= room2.maxVoxel.y && room1.maxVoxel.y >= room2.minVoxel.y
    )

    return xAdjacent || zAdjacent
  }
}
