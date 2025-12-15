/**
 * Builds voxel structures from V1 ShipLayout definitions.
 *
 * Converts room positions/sizes to actual voxel walls, floors, ceilings,
 * cuts doorways, and places entity markers.
 */

import { VoxelWorld } from './VoxelWorld'
import { VoxelType, VOXEL_SIZE, type VoxelCoord } from './VoxelTypes'
import { assetLoader, loadBuiltinAssets } from './VoxelAssetLoader'
import type { Rotation90 } from './VoxelAsset'
import type { ShipLayout, RoomLayout, DoorLayout } from '../types/layout'
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
    for (const [id, door] of Object.entries(layout.doors)) {
      this.cutDoorway(id, door, layout.rooms)
    }

    // Place terminals
    for (const [id, terminal] of Object.entries(layout.terminals)) {
      this.placeEntity(id, 'terminal', terminal.position, terminal.rotation)

      // Place workstation voxels for engineering terminals
      if (id.includes('engineering')) {
        this.placeWorkstation(terminal.position, terminal.rotation)
      }
    }

    // Place switches (entity metadata only - voxels handled by AnimatedAssetInstance)
    if (layout.switches) {
      for (const [id, sw] of Object.entries(layout.switches)) {
        this.placeEntity(id, 'switch', sw.position, sw.rotation, sw.status)
      }
    }

    // Place wall lights (using asset system)
    if (layout.wallLights) {
      for (const [id, light] of Object.entries(layout.wallLights)) {
        this.placeEntity(id, 'light', light.position, light.rotation)
        this.placeWallLight(light.position, light.rotation)
      }
    }

    // End bulk mode - marks all chunks dirty
    this.world.endBulk()

    console.log(`[VoxelMapBuilder] Build complete: ${this.world.getAllChunks().length} chunks`)

    return {
      world: this.world,
      rooms: this.rooms,
      entities: this.entities
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
   * Place a voxel asset at a world position.
   *
   * The asset is loaded from the asset library and placed with the given
   * rotation and parameters. Height offset puts the switch at 1.2m height.
   */
  private placeAsset(
    assetId: string,
    position: { x: number; y: number; z: number },
    layoutRotation: number,
    params: Record<string, string | number | boolean> = {}
  ): void {
    // Map layout rotation to asset rotation
    // Layout rotation indicates which direction the switch faces:
    // - 90/270: X-facing (panel perpendicular to X axis)
    // - 0/180: Z-facing (panel perpendicular to Z axis)
    //
    // The switch asset is defined with voxels on X=0 plane (X-facing).
    // So we need to rotate 90° to make it Z-facing.
    const assetRotation = this.layoutToAssetRotation(layoutRotation)

    // Resolve the asset to voxels
    const voxels = assetLoader.resolve(
      assetId,
      position,
      assetRotation,
      params,
      48  // Height offset: 1.2m = 48 voxels at 2.5cm
    )

    console.log(`[placeAsset] ${assetId} at (${position.x},${position.y},${position.z}) rot=${layoutRotation}->${assetRotation} => ${voxels.length} voxels`)
    if (voxels.length > 0) {
      const v = voxels[0]!
      console.log(`  First voxel: (${v.x}, ${v.y}, ${v.z}) type=${v.type}`)
    }

    // Place all resolved voxels
    for (const v of voxels) {
      this.world.setVoxel(v.x, v.y, v.z, v.type)
    }
  }

  /**
   * Place a wall light at a world position.
   * Wall lights are positioned on the wall surface and face outward.
   */
  private placeWallLight(
    position: { x: number; y: number; z: number },
    layoutRotation: number
  ): void {
    // Map layout rotation to asset rotation
    // Wall light asset is defined facing +X direction (bulb extends in +X)
    const assetRotation = this.layoutToAssetRotation(layoutRotation)

    // Resolve the asset to voxels
    // No height offset needed - wall lights use their Y position directly
    const voxels = assetLoader.resolve(
      'wall-light',
      position,
      assetRotation,
      {},
      0
    )

    console.log(`[placeWallLight] at (${position.x},${position.y},${position.z}) rot=${layoutRotation}->${assetRotation} => ${voxels.length} voxels`)

    // Place all resolved voxels
    for (const v of voxels) {
      this.world.setVoxel(v.x, v.y, v.z, v.type)
    }
  }

  /**
   * Place a workstation (engineering terminal) with desk, monitor, and keyboard.
   * Screen is NOT placed - it's rendered dynamically by TerminalMesh.
   */
  private placeWorkstation(
    position: { x: number; y: number; z: number },
    rotation: number
  ): void {
    const baseX = position.x
    const baseY = position.y
    const baseZ = position.z

    // Workstation dimensions in voxels (at 2.5cm per voxel)
    // Desk: 48×2×24 at y=30 (0.75m height)
    const deskWidth = 48   // 1.2m
    const deskHeight = 2   // 0.05m
    const deskDepth = 24   // 0.6m
    const deskY = 30       // 0.75m

    // Desk legs: 2×30×2
    const legSize = 2
    const legHeight = 30

    // Monitor stand: 4×16×4
    const standWidth = 4
    const standHeight = 16
    const standDepth = 4
    const standY = deskY + deskHeight  // On top of desk

    // Monitor frame: 36×28×4
    const monitorWidth = 36  // 0.9m
    const monitorHeight = 28 // 0.7m
    const monitorDepth = 4   // 0.1m
    const monitorY = standY + standHeight  // On top of stand

    // Keyboard: 20×1×6 at y=31 (on desk surface toward front)
    const keyboardWidth = 20
    const keyboardHeight = 1
    const keyboardDepth = 6
    const keyboardY = deskY + deskHeight

    // Helper to rotate offset based on layout rotation
    const rotateOffset = (dx: number, dz: number): [number, number] => {
      switch (rotation) {
        case 0:   return [dx, dz]           // Facing +Z
        case 90:  return [dz, -dx]          // Facing +X
        case 180: return [-dx, -dz]         // Facing -Z
        case 270: return [-dz, dx]          // Facing -X
        default:  return [dx, dz]
      }
    }

    // Helper to place a box of voxels
    const placeBox = (
      offsetX: number, offsetY: number, offsetZ: number,
      w: number, h: number, d: number,
      voxelType: VoxelType
    ) => {
      // Box is centered on X, positioned at offsetY, centered on Z
      for (let dy = 0; dy < h; dy++) {
        for (let localZ = 0; localZ < d; localZ++) {
          for (let localX = 0; localX < w; localX++) {
            // Offset from center
            const dx = localX - Math.floor(w / 2)
            const dz = localZ - Math.floor(d / 2)
            const [rotX, rotZ] = rotateOffset(dx + offsetX, dz + offsetZ)
            this.world.setVoxel(
              baseX + rotX,
              baseY + offsetY + dy,
              baseZ + rotZ,
              voxelType
            )
          }
        }
      }
    }

    // Place desk surface
    placeBox(0, deskY, 0, deskWidth, deskHeight, deskDepth, VoxelType.DESK)

    // Place desk legs (at corners)
    const legOffsetX = Math.floor(deskWidth / 2) - legSize
    const legOffsetZ = Math.floor(deskDepth / 2) - legSize
    placeBox(-legOffsetX, 0, -legOffsetZ, legSize, legHeight, legSize, VoxelType.DESK) // Front-left
    placeBox(legOffsetX, 0, -legOffsetZ, legSize, legHeight, legSize, VoxelType.DESK)  // Front-right
    placeBox(-legOffsetX, 0, legOffsetZ, legSize, legHeight, legSize, VoxelType.DESK)  // Back-left
    placeBox(legOffsetX, 0, legOffsetZ, legSize, legHeight, legSize, VoxelType.DESK)   // Back-right

    // Place monitor stand (at back of desk)
    const standOffsetZ = Math.floor(deskDepth / 2) - standDepth
    placeBox(0, standY, standOffsetZ, standWidth, standHeight, standDepth, VoxelType.DESK)

    // Place monitor frame (on top of stand, at back)
    const monitorOffsetZ = standOffsetZ
    // Place frame as 4 sides (top, bottom, left, right)
    const frameThickness = 2

    // Top frame
    placeBox(0, monitorY + monitorHeight - frameThickness, monitorOffsetZ,
      monitorWidth, frameThickness, monitorDepth, VoxelType.DESK)
    // Bottom frame
    placeBox(0, monitorY, monitorOffsetZ,
      monitorWidth, frameThickness, monitorDepth, VoxelType.DESK)
    // Left frame
    placeBox(-Math.floor(monitorWidth / 2) + Math.floor(frameThickness / 2), monitorY, monitorOffsetZ,
      frameThickness, monitorHeight, monitorDepth, VoxelType.DESK)
    // Right frame
    placeBox(Math.floor(monitorWidth / 2) - Math.floor(frameThickness / 2), monitorY, monitorOffsetZ,
      frameThickness, monitorHeight, monitorDepth, VoxelType.DESK)
    // Back panel (so screen can't be seen from behind)
    const backOffsetZ = monitorOffsetZ + Math.floor(monitorDepth / 2) - 1
    placeBox(0, monitorY, backOffsetZ,
      monitorWidth, monitorHeight, 1, VoxelType.DESK)

    // Fill monitor interior with SCREEN voxels (rendered dynamically by TerminalMesh)
    const screenWidth = monitorWidth - 2 * frameThickness   // 32 voxels
    const screenHeight = monitorHeight - 2 * frameThickness // 24 voxels
    const screenY = monitorY + frameThickness
    // Screen inside the monitor frame
    // monitorOffsetZ=8 is monitor center, monitor depth=4
    const screenOffsetZ = 6
    placeBox(0, screenY, screenOffsetZ, screenWidth, screenHeight, 1, VoxelType.SCREEN)

    // Place keyboard (at front of desk)
    const keyboardOffsetZ = -Math.floor(deskDepth / 2) + Math.floor(keyboardDepth / 2) + 2
    placeBox(0, keyboardY, keyboardOffsetZ, keyboardWidth, keyboardHeight, keyboardDepth, VoxelType.KEYBOARD)

    console.log(`[placeWorkstation] at (${baseX},${baseY},${baseZ}) rot=${rotation}`)
  }

  /**
   * Convert layout rotation to asset rotation.
   * Layout rotation describes wall orientation (which axis the panel is perpendicular to).
   * Asset rotation describes the rotation of the asset itself.
   */
  private layoutToAssetRotation(layoutRotation: number): Rotation90 {
    // The switch asset is defined on X=0 plane (perpendicular to X axis).
    // Layout rotation 90/270 means X-facing → no rotation needed
    // Layout rotation 0/180 means Z-facing → rotate 90°
    switch (layoutRotation) {
      case 90:
        return 0    // X-facing, +X direction
      case 270:
        return 180  // X-facing, -X direction
      case 0:
        return 90   // Z-facing, +Z direction
      case 180:
        return 270  // Z-facing, -Z direction
      default:
        return 0
    }
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
