/**
 * Builds voxel structures from V1 ShipLayout definitions.
 *
 * Converts room positions/sizes to actual voxel walls, floors, ceilings,
 * cuts doorways, and places entity markers.
 */

import { VoxelWorld } from './VoxelWorld'
import { VoxelType, VOXEL_SIZE, type VoxelCoord } from './VoxelTypes'
import type { ShipLayout, RoomLayout, DoorLayout } from '../types/layout'
import type { RoomVolume, EntityPlacement, DoorPlacement, VoxelLayoutV2 } from '../types/layout'

/**
 * Configuration for room building.
 */
export interface RoomBuildConfig {
  /** Wall thickness in voxels (default 1 = 10cm) */
  wallThickness?: number
  /** Floor thickness in voxels (default 1 = 10cm) */
  floorThickness?: number
  /** Ceiling thickness in voxels (default 1 = 10cm) */
  ceilingThickness?: number
  /** Default door width in voxels (default 10 = 1m) */
  doorWidth?: number
  /** Default door height in voxels (default 20 = 2m) */
  doorHeight?: number
}

/**
 * Result of building a voxel map.
 */
export interface BuildResult {
  world: VoxelWorld
  rooms: Record<string, RoomVolume>
  entities: Record<string, EntityPlacement | DoorPlacement>
}

/**
 * Builds voxel structures from layout definitions.
 */
export class VoxelMapBuilder {
  private world: VoxelWorld
  private config: Required<RoomBuildConfig>
  private rooms: Record<string, RoomVolume> = {}
  private entities: Record<string, EntityPlacement | DoorPlacement> = {}

  constructor(config: RoomBuildConfig = {}) {
    this.world = new VoxelWorld()
    this.config = {
      wallThickness: config.wallThickness ?? 1,
      floorThickness: config.floorThickness ?? 1,
      ceilingThickness: config.ceilingThickness ?? 1,
      doorWidth: config.doorWidth ?? 10,
      doorHeight: config.doorHeight ?? 20
    }
  }

  /**
   * Build from V1 ShipLayout.
   */
  buildFromLayout(layout: ShipLayout): BuildResult {
    // Build each room
    for (const [id, room] of Object.entries(layout.rooms)) {
      this.buildRoom(id, room)
    }

    // Cut doorways
    for (const [id, door] of Object.entries(layout.doors)) {
      this.cutDoorway(id, door, layout.rooms)
    }

    // Place terminals
    for (const [id, terminal] of Object.entries(layout.terminals)) {
      this.placeEntity(id, 'terminal', terminal.position, terminal.rotation)
    }

    // Place switches
    if (layout.switches) {
      for (const [id, sw] of Object.entries(layout.switches)) {
        this.placeEntity(id, 'switch', sw.position, sw.rotation, sw.status)
      }
    }

    // Place lights
    if (layout.wallLights) {
      for (const [id, light] of Object.entries(layout.wallLights)) {
        this.placeEntity(id, 'light', light.position, light.rotation)
      }
    }

    return {
      world: this.world,
      rooms: this.rooms,
      entities: this.entities
    }
  }

  /**
   * Build a room with walls, floor, and ceiling.
   */
  private buildRoom(id: string, room: RoomLayout): void {
    // Convert world coordinates (meters) to voxel coordinates
    const baseX = Math.round(room.position.x / VOXEL_SIZE)
    const baseY = Math.round(room.position.y / VOXEL_SIZE)
    const baseZ = Math.round(room.position.z / VOXEL_SIZE)

    const width = Math.round(room.size.width / VOXEL_SIZE)
    const height = Math.round(room.size.height / VOXEL_SIZE)
    const depth = Math.round(room.size.depth / VOXEL_SIZE)

    const wt = this.config.wallThickness
    const ft = this.config.floorThickness
    const ct = this.config.ceilingThickness

    // Floor (at base level, extends under walls)
    for (let x = baseX - wt; x < baseX + width + wt; x++) {
      for (let z = baseZ - wt; z < baseZ + depth + wt; z++) {
        for (let y = baseY - ft; y < baseY; y++) {
          this.world.setVoxel(x, y, z, VoxelType.FLOOR)
        }
      }
    }

    // Ceiling (at top, extends over walls)
    for (let x = baseX - wt; x < baseX + width + wt; x++) {
      for (let z = baseZ - wt; z < baseZ + depth + wt; z++) {
        for (let y = baseY + height; y < baseY + height + ct; y++) {
          this.world.setVoxel(x, y, z, VoxelType.CEILING)
        }
      }
    }

    // Walls - all four sides
    // -X wall (left)
    for (let x = baseX - wt; x < baseX; x++) {
      for (let z = baseZ - wt; z < baseZ + depth + wt; z++) {
        for (let y = baseY; y < baseY + height; y++) {
          this.world.setVoxel(x, y, z, VoxelType.WALL)
        }
      }
    }

    // +X wall (right)
    for (let x = baseX + width; x < baseX + width + wt; x++) {
      for (let z = baseZ - wt; z < baseZ + depth + wt; z++) {
        for (let y = baseY; y < baseY + height; y++) {
          this.world.setVoxel(x, y, z, VoxelType.WALL)
        }
      }
    }

    // -Z wall (front)
    for (let z = baseZ - wt; z < baseZ; z++) {
      for (let x = baseX; x < baseX + width; x++) {
        for (let y = baseY; y < baseY + height; y++) {
          this.world.setVoxel(x, y, z, VoxelType.WALL)
        }
      }
    }

    // +Z wall (back)
    for (let z = baseZ + depth; z < baseZ + depth + wt; z++) {
      for (let x = baseX; x < baseX + width; x++) {
        for (let y = baseY; y < baseY + height; y++) {
          this.world.setVoxel(x, y, z, VoxelType.WALL)
        }
      }
    }

    // Store room volume (interior space)
    this.rooms[id] = {
      id,
      name: id,
      minVoxel: { x: baseX, y: baseY, z: baseZ },
      maxVoxel: { x: baseX + width - 1, y: baseY + height - 1, z: baseZ + depth - 1 },
      atmosphere: { hasO2: true, pressure: 1.0 }
    }
  }

  /**
   * Cut a doorway between rooms.
   */
  private cutDoorway(
    id: string,
    door: DoorLayout,
    rooms: Record<string, RoomLayout>
  ): void {
    const doorX = Math.round(door.position.x / VOXEL_SIZE)
    const doorY = Math.round(door.position.y / VOXEL_SIZE)
    const doorZ = Math.round(door.position.z / VOXEL_SIZE)

    const width = this.config.doorWidth
    const height = this.config.doorHeight

    // Determine orientation from rotation
    // 0/180 = Z-facing door, 90/270 = X-facing door
    const isXFacing = door.rotation === 90 || door.rotation === 270

    // Find which rooms this door connects
    const connectedRooms = this.findConnectedRooms(doorX, doorY, doorZ, isXFacing, rooms)

    // Cut the opening
    if (isXFacing) {
      // Door in X-axis wall - cut through Z
      const halfWidth = Math.floor(width / 2)
      for (let z = doorZ - halfWidth; z < doorZ + halfWidth; z++) {
        for (let y = doorY; y < doorY + height; y++) {
          // Cut through wall thickness
          for (let x = doorX - 1; x <= doorX + 1; x++) {
            this.world.setVoxel(x, y, z, VoxelType.AIR)
          }
        }
      }
    } else {
      // Door in Z-axis wall - cut through X
      const halfWidth = Math.floor(width / 2)
      for (let x = doorX - halfWidth; x < doorX + halfWidth; x++) {
        for (let y = doorY; y < doorY + height; y++) {
          // Cut through wall thickness
          for (let z = doorZ - 1; z <= doorZ + 1; z++) {
            this.world.setVoxel(x, y, z, VoxelType.AIR)
          }
        }
      }
    }

    // Store door entity
    const doorPlacement: DoorPlacement = {
      id,
      type: 'door',
      voxelPos: { x: doorX, y: doorY, z: doorZ },
      rotation: door.rotation as 0 | 90 | 180 | 270,
      facingAxis: isXFacing ? 'x' : 'z',
      facingDir: (door.rotation === 90 || door.rotation === 0) ? 1 : -1,
      connectsRooms: connectedRooms,
      width,
      height,
      status: 'OK'
    }
    this.entities[id] = doorPlacement
  }

  /**
   * Find which rooms a door connects.
   */
  private findConnectedRooms(
    doorX: number,
    doorY: number,
    doorZ: number,
    isXFacing: boolean,
    rooms: Record<string, RoomLayout>
  ): [string, string] {
    const connected: string[] = []

    for (const [id, room] of Object.entries(rooms)) {
      const baseX = Math.round(room.position.x / VOXEL_SIZE)
      const baseY = Math.round(room.position.y / VOXEL_SIZE)
      const baseZ = Math.round(room.position.z / VOXEL_SIZE)
      const width = Math.round(room.size.width / VOXEL_SIZE)
      const height = Math.round(room.size.height / VOXEL_SIZE)
      const depth = Math.round(room.size.depth / VOXEL_SIZE)

      // Check if door is on room boundary
      if (isXFacing) {
        // X-facing door - check left/right walls
        if ((doorX === baseX - 1 || doorX === baseX + width) &&
            doorZ >= baseZ && doorZ < baseZ + depth &&
            doorY >= baseY && doorY < baseY + height) {
          connected.push(id)
        }
      } else {
        // Z-facing door - check front/back walls
        if ((doorZ === baseZ - 1 || doorZ === baseZ + depth) &&
            doorX >= baseX && doorX < baseX + width &&
            doorY >= baseY && doorY < baseY + height) {
          connected.push(id)
        }
      }
    }

    return [connected[0] ?? '', connected[1] ?? ''] as [string, string]
  }

  /**
   * Place an entity marker.
   */
  private placeEntity(
    id: string,
    type: 'terminal' | 'switch' | 'sensor' | 'light',
    position: { x: number; y: number; z: number },
    rotation: number,
    status?: string
  ): void {
    const voxelX = Math.round(position.x / VOXEL_SIZE)
    const voxelY = Math.round(position.y / VOXEL_SIZE)
    const voxelZ = Math.round(position.z / VOXEL_SIZE)

    // Determine facing based on rotation
    let facingAxis: 'x' | 'z' = 'z'
    let facingDir: -1 | 1 = 1

    switch (rotation) {
      case 0: facingAxis = 'z'; facingDir = 1; break
      case 90: facingAxis = 'x'; facingDir = 1; break
      case 180: facingAxis = 'z'; facingDir = -1; break
      case 270: facingAxis = 'x'; facingDir = -1; break
    }

    const entity: EntityPlacement = {
      id,
      type,
      voxelPos: { x: voxelX, y: voxelY, z: voxelZ },
      rotation: rotation as 0 | 90 | 180 | 270,
      facingAxis,
      facingDir,
      status: status as 'OK' | 'FAULT' | undefined
    }
    this.entities[id] = entity
  }

  /**
   * Get the built world.
   */
  getWorld(): VoxelWorld {
    return this.world
  }

  /**
   * Get room volumes.
   */
  getRooms(): Record<string, RoomVolume> {
    return this.rooms
  }

  /**
   * Get entity placements.
   */
  getEntities(): Record<string, EntityPlacement | DoorPlacement> {
    return this.entities
  }

  /**
   * Export as VoxelLayoutV2.
   */
  toVoxelLayout(name: string): VoxelLayoutV2 {
    const chunks = this.world.getAllChunks()
      .filter(c => !c.isEmpty())
      .map(c => c.toJSON())

    const bounds = this.world.getBounds()

    return {
      version: 2,
      name,
      bounds: bounds ? {
        min: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
        max: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ }
      } : { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      chunks,
      rooms: this.rooms,
      entities: this.entities,
      prefabInstances: [],
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      }
    }
  }
}

/**
 * Build galley map from V1 layout.
 */
export function buildGalleyMap(layout: ShipLayout): BuildResult {
  const builder = new VoxelMapBuilder({
    wallThickness: 2,      // 20cm thick walls
    floorThickness: 2,     // 20cm thick floor
    ceilingThickness: 2,   // 20cm thick ceiling
    doorWidth: 12,         // 1.2m wide doors
    doorHeight: 22         // 2.2m tall doors
  })
  return builder.buildFromLayout(layout)
}
