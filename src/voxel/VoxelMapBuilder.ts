/**
 * Builds voxel structures from V1 ShipLayout definitions.
 *
 * Converts room positions/sizes to actual voxel walls, floors, ceilings,
 * cuts doorways, and places entity markers.
 */

import { VoxelWorld } from './VoxelWorld'
import { VoxelType, VOXEL_SIZE, type VoxelCoord } from './VoxelTypes'
import { assetLoader, loadBuiltinAssets, loadBuiltinAssetsAsync, type AnimatedChildInfo } from './VoxelAssetLoader'
import type { Rotation90 } from './VoxelAsset'
import type { ShipLayout, RoomLayout, DoorLayout, AssetInstance } from '../types/layout'
import type { RoomVolume, EntityPlacement, DoorPlacement, VoxelLayoutV2 } from '../types/layout'

// Ensure assets are loaded
let assetsLoaded = false
function ensureAssetsLoaded() {
  if (!assetsLoaded) {
    loadBuiltinAssets()
    assetsLoaded = true
  }
}

/**
 * Ensure assets are loaded asynchronously (for browser support).
 */
export async function ensureAssetsLoadedAsync(): Promise<void> {
  if (!assetsLoaded) {
    await loadBuiltinAssetsAsync()
    assetsLoaded = true
  }
}

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
  /** Animated asset children (e.g., spinning fan blades) */
  animatedChildren: AnimatedChildInfo[]
}

/**
 * Builds voxel structures from layout definitions.
 */
export class VoxelMapBuilder {
  private world: VoxelWorld
  private config: Required<RoomBuildConfig>
  private rooms: Record<string, RoomVolume> = {}
  private entities: Record<string, EntityPlacement | DoorPlacement> = {}
  private animatedChildren: AnimatedChildInfo[] = []

  constructor(config: RoomBuildConfig = {}) {
    ensureAssetsLoaded()
    this.world = new VoxelWorld()
    this.config = {
      wallThickness: config.wallThickness ?? 8,       // 20cm at 2.5cm voxels
      floorThickness: config.floorThickness ?? 8,
      ceilingThickness: config.ceilingThickness ?? 8,
      doorWidth: config.doorWidth ?? 48,              // 1.2m at 2.5cm voxels
      doorHeight: config.doorHeight ?? 88             // 2.2m at 2.5cm voxels
    }
  }

  /**
   * Build from V1 ShipLayout.
   */
  buildFromLayout(layout: ShipLayout): BuildResult {
    console.time('buildRooms')
    // Use bulk mode to skip per-voxel notifications
    this.world.beginBulk()

    // Build each room
    for (const [id, room] of Object.entries(layout.rooms)) {
      this.buildRoom(id, room)
    }
    console.timeEnd('buildRooms')

    // Cut doorways
    if (layout.doors) {
      for (const [id, door] of Object.entries(layout.doors)) {
        this.cutDoorway(id, door, layout.rooms)
      }
    }

    // Place terminals (voxels handled by asset instances, this just creates entity metadata)
    if (layout.terminals) {
      for (const [id, terminal] of Object.entries(layout.terminals)) {
        this.placeEntity(id, 'terminal', terminal.position, terminal.rotation)
      }
    }

    // Place switches (entity metadata only - voxels handled by AnimatedAssetInstance)
    if (layout.switches) {
      for (const [id, sw] of Object.entries(layout.switches)) {
        this.placeEntity(id, 'switch', sw.position, sw.rotation, sw.status)
      }
    }

    // Place wall lights (using asset system) - legacy format
    if (layout.wallLights) {
      for (const [id, light] of Object.entries(layout.wallLights)) {
        this.placeEntity(id, 'light', light.position, light.rotation)
        this.placeWallLight(light.position, light.rotation)
      }
    }

    // Process asset instances (new data-driven format)
    if (layout.assetInstances) {
      for (const [id, instance] of Object.entries(layout.assetInstances)) {
        this.placeAssetInstance(id, instance)
      }
    }

    // End bulk mode - marks all chunks dirty
    this.world.endBulk()

    console.log(`[VoxelMapBuilder] Build complete: ${this.world.getAllChunks().length} chunks, ${this.animatedChildren.length} animated children`)

    return {
      world: this.world,
      rooms: this.rooms,
      entities: this.entities,
      animatedChildren: this.animatedChildren
    }
  }

  /**
   * Build a room with walls, floor, and ceiling.
   * Room is CENTERED at its position. All coordinates are in voxels.
   */
  private buildRoom(id: string, room: RoomLayout): void {
    // Positions and sizes are already in voxel coordinates
    // Room is CENTERED at position, so offset by half size
    const width = room.size.width
    const height = room.size.height
    const depth = room.size.depth

    const baseX = room.position.x - Math.floor(width / 2)
    const baseY = room.position.y  // Y stays at floor level
    const baseZ = room.position.z - Math.floor(depth / 2)

    console.log(`[buildRoom] ${id}: size=${width}x${height}x${depth}, base=(${baseX},${baseY},${baseZ})`)

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

    // Ceiling light fixture - strip in the center of the room
    const lightY = baseY + height - 1  // Just below ceiling
    const centerX = baseX + Math.floor(width / 2)
    const centerZ = baseZ + Math.floor(depth / 2)
    const lightLength = Math.min(10, Math.floor(width / 2))  // Up to 1m long
    const lightWidth = 3  // 30cm wide

    for (let x = centerX - Math.floor(lightLength / 2); x <= centerX + Math.floor(lightLength / 2); x++) {
      for (let z = centerZ - Math.floor(lightWidth / 2); z <= centerZ + Math.floor(lightWidth / 2); z++) {
        this.world.setVoxel(x, lightY, z, VoxelType.LIGHT_FIXTURE)
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
   * Cut a doorway between rooms. All coordinates are in voxels.
   */
  private cutDoorway(
    id: string,
    door: DoorLayout,
    rooms: Record<string, RoomLayout>
  ): void {
    const doorX = door.position.x
    const doorY = door.position.y
    const doorZ = door.position.z

    const width = this.config.doorWidth
    const height = this.config.doorHeight

    // Determine orientation from rotation
    // 0/180 = Z-facing door, 90/270 = X-facing door
    const isXFacing = door.rotation === 90 || door.rotation === 270

    // Find which rooms this door connects
    const connectedRooms = this.findConnectedRooms(doorX, doorY, doorZ, isXFacing, rooms)

    // Cut the opening - need to cut through BOTH room walls
    // With wall thickness wt on each side, cut depth = 2*wt + 1
    const cutDepth = this.config.wallThickness * 2 + 1

    if (isXFacing) {
      // Door in X-axis wall - opening extends in Z, cuts through X
      const halfWidth = Math.floor(width / 2)
      for (let z = doorZ - halfWidth; z < doorZ + halfWidth; z++) {
        for (let y = doorY; y < doorY + height; y++) {
          // Cut through both walls
          for (let x = doorX - cutDepth; x <= doorX + cutDepth; x++) {
            this.world.setVoxel(x, y, z, VoxelType.AIR)
          }
        }
      }
    } else {
      // Door in Z-axis wall - opening extends in X, cuts through Z
      const halfWidth = Math.floor(width / 2)
      for (let x = doorX - halfWidth; x < doorX + halfWidth; x++) {
        for (let y = doorY; y < doorY + height; y++) {
          // Cut through both walls
          for (let z = doorZ - cutDepth; z <= doorZ + cutDepth; z++) {
            this.world.setVoxel(x, y, z, VoxelType.AIR)
          }
        }
      }
    }

    // Add door frame around the opening
    this.placeDoorFrame(doorX, doorY, doorZ, width, height, isXFacing)

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
   * Place door frame voxels around a doorway opening.
   */
  private placeDoorFrame(
    doorX: number,
    doorY: number,
    doorZ: number,
    width: number,
    height: number,
    isXFacing: boolean
  ): void {
    const frameThickness = 6  // 15cm at 2.5cm voxels
    const frameDepth = 14     // 35cm depth (panel thickness + clearance)
    const halfWidth = Math.floor(width / 2)

    if (isXFacing) {
      // Door in X-axis wall - frame extends in Z direction
      // Top frame
      for (let z = doorZ - halfWidth - frameThickness; z < doorZ + halfWidth + frameThickness; z++) {
        for (let y = doorY + height; y < doorY + height + frameThickness; y++) {
          for (let dx = -Math.floor(frameDepth / 2); dx < Math.ceil(frameDepth / 2); dx++) {
            this.world.setVoxel(doorX + dx, y, z, VoxelType.DOOR_FRAME)
          }
        }
      }
      // Left frame (negative Z)
      for (let z = doorZ - halfWidth - frameThickness; z < doorZ - halfWidth; z++) {
        for (let y = doorY; y < doorY + height; y++) {
          for (let dx = -Math.floor(frameDepth / 2); dx < Math.ceil(frameDepth / 2); dx++) {
            this.world.setVoxel(doorX + dx, y, z, VoxelType.DOOR_FRAME)
          }
        }
      }
      // Right frame (positive Z)
      for (let z = doorZ + halfWidth; z < doorZ + halfWidth + frameThickness; z++) {
        for (let y = doorY; y < doorY + height; y++) {
          for (let dx = -Math.floor(frameDepth / 2); dx < Math.ceil(frameDepth / 2); dx++) {
            this.world.setVoxel(doorX + dx, y, z, VoxelType.DOOR_FRAME)
          }
        }
      }
    } else {
      // Door in Z-axis wall - frame extends in X direction
      // Top frame
      for (let x = doorX - halfWidth - frameThickness; x < doorX + halfWidth + frameThickness; x++) {
        for (let y = doorY + height; y < doorY + height + frameThickness; y++) {
          for (let dz = -Math.floor(frameDepth / 2); dz < Math.ceil(frameDepth / 2); dz++) {
            this.world.setVoxel(x, y, doorZ + dz, VoxelType.DOOR_FRAME)
          }
        }
      }
      // Left frame (negative X)
      for (let x = doorX - halfWidth - frameThickness; x < doorX - halfWidth; x++) {
        for (let y = doorY; y < doorY + height; y++) {
          for (let dz = -Math.floor(frameDepth / 2); dz < Math.ceil(frameDepth / 2); dz++) {
            this.world.setVoxel(x, y, doorZ + dz, VoxelType.DOOR_FRAME)
          }
        }
      }
      // Right frame (positive X)
      for (let x = doorX + halfWidth; x < doorX + halfWidth + frameThickness; x++) {
        for (let y = doorY; y < doorY + height; y++) {
          for (let dz = -Math.floor(frameDepth / 2); dz < Math.ceil(frameDepth / 2); dz++) {
            this.world.setVoxel(x, y, doorZ + dz, VoxelType.DOOR_FRAME)
          }
        }
      }
    }
  }

  /**
   * Find which rooms a door connects. All coordinates are in voxels.
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
      // Room is centered at position
      const width = room.size.width
      const height = room.size.height
      const depth = room.size.depth
      const baseX = room.position.x - Math.floor(width / 2)
      const baseY = room.position.y
      const baseZ = room.position.z - Math.floor(depth / 2)

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
   * Place an entity marker. All coordinates are in voxels.
   */
  private placeEntity(
    id: string,
    type: 'terminal' | 'switch' | 'sensor' | 'light',
    position: { x: number; y: number; z: number },
    rotation: number,
    status?: string
  ): void {
    const voxelX = position.x
    const voxelY = position.y
    const voxelZ = position.z

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
   * Place a wall light at a world position (legacy format support).
   * For new layouts, use assetInstances instead.
   */
  private placeWallLight(
    position: { x: number; y: number; z: number },
    layoutRotation: number
  ): void {
    const assetRotation = this.layoutToAssetRotation(layoutRotation)
    const voxels = assetLoader.resolve('wall-light', position, assetRotation, {}, 0)

    console.log(`[placeWallLight] at (${position.x},${position.y},${position.z}) rot=${assetRotation} => ${voxels.length} voxels`)

    for (const v of voxels) {
      this.world.setVoxel(v.x, v.y, v.z, v.type)
    }
  }

  /**
   * Place an asset instance from the layout file.
   * Uses rotation directly (no layout-to-asset conversion).
   */
  private placeAssetInstance(id: string, instance: AssetInstance): void {
    const result = assetLoader.resolveWithAnimations(
      instance.asset,
      instance.position,
      instance.rotation as Rotation90,
      instance.params ?? {},
      instance.heightOffset ?? 0
    )

    console.log(`[placeAssetInstance] ${id}: ${instance.asset} at (${instance.position.x},${instance.position.y},${instance.position.z}) rot=${instance.rotation} => ${result.voxels.length} voxels, ${result.animatedChildren.length} animated`)

    // Create entity metadata for wall-lights
    if (instance.asset === 'wall-light') {
      const entityId = id.replace(/-/g, '_')
      this.placeEntity(entityId, 'light', instance.position, instance.rotation)
    }

    // Place static voxels
    for (const v of result.voxels) {
      this.world.setVoxel(v.x, v.y, v.z, v.type)
    }

    // Collect animated children for separate rendering
    this.animatedChildren.push(...result.animatedChildren)
  }

  /**
   * Cast layout rotation to Rotation90 type. Defaults to 0 for invalid values.
   */
  private layoutToAssetRotation(layoutRotation: number): Rotation90 {
    if (layoutRotation === 0 || layoutRotation === 90 || layoutRotation === 180 || layoutRotation === 270) {
      return layoutRotation
    }
    return 0
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
    wallThickness: 8,      // 20cm at 2.5cm voxels
    floorThickness: 8,     // 20cm at 2.5cm voxels
    ceilingThickness: 8,   // 20cm at 2.5cm voxels
    doorWidth: 48,         // 1.2m at 2.5cm voxels
    doorHeight: 88         // 2.2m at 2.5cm voxels
  })
  return builder.buildFromLayout(layout)
}
