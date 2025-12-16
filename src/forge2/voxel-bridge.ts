/**
 * Forge 2.0 Voxel Bridge
 *
 * Connects Forge scripts to the voxel rendering system.
 * Provides a `voxel` namespace for voxel manipulation.
 */

import type { ForgeValue, ForgeMap } from './types'

// Types that will be imported from the voxel system when integrated
// For now, define minimal interfaces for type safety
export interface VoxelWorldLike {
  get(x: number, y: number, z: number): number
  set(x: number, y: number, z: number, value: number): void
  fill(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    voxel: number
  ): void
  getDirtyChunks(): Set<string>
  clearDirtyChunks(): void
}

export interface VoxelRendererLike {
  rebuildChunk(cx: number, cy: number, cz: number): void
  rebuildDirty(): void
  rebuildAll(): void
}

export interface VoxelTypeRegistryLike {
  getId(name: string): number | undefined
  getName(id: number): string | undefined
  getColor(id: number): number
  isSolid(id: number): boolean
  isTransparent(id: number): boolean
  isPassable(id: number): boolean
  getTypeGroup(groupName: string): number[]
  getAllTypeNames(): string[]
}

// ============================================================================
// Types
// ============================================================================

export interface VoxelBridgeConfig {
  world: VoxelWorldLike
  renderer?: VoxelRendererLike
  registry?: VoxelTypeRegistryLike
  voxelSize?: number
  chunkSize?: number
}

// ============================================================================
// Voxel Bridge Class
// ============================================================================

export class VoxelBridge {
  private world: VoxelWorldLike
  private renderer: VoxelRendererLike | null
  private registry: VoxelTypeRegistryLike | null
  private voxelSize: number
  private chunkSize: number

  constructor(config: VoxelBridgeConfig) {
    this.world = config.world
    this.renderer = config.renderer ?? null
    this.registry = config.registry ?? null
    this.voxelSize = config.voxelSize ?? 0.025
    this.chunkSize = config.chunkSize ?? 16
  }

  // ==========================================================================
  // Public API - Returns functions for Forge runtime
  // ==========================================================================

  /**
   * Create the voxel namespace for Forge scripts.
   */
  createNamespace(): ForgeMap {
    return {
      // Voxel access
      get: this.getVoxel.bind(this),
      set: this.setVoxel.bind(this),
      fill: this.fillVoxels.bind(this),
      clear: this.clearVoxel.bind(this),

      // Voxel type utilities
      type: this.getVoxelType.bind(this),
      variant: this.getVoxelVariant.bind(this),
      make: this.makeVoxel.bind(this),
      typeId: this.typeNameToId.bind(this),
      typeName: this.typeIdToName.bind(this),

      // Coordinate conversion
      worldToVoxel: this.worldToVoxel.bind(this),
      voxelToWorld: this.voxelToWorld.bind(this),
      voxelToChunk: this.voxelToChunk.bind(this),

      // Queries
      isSolid: this.isSolid.bind(this),
      isTransparent: this.isTransparent.bind(this),
      isPassable: this.isPassable.bind(this),
      isEmpty: this.isEmpty.bind(this),
      getColor: this.getVoxelColor.bind(this),

      // Rendering
      rebuild: this.rebuildDirty.bind(this),
      rebuildAll: this.rebuildAll.bind(this),
      rebuildChunk: this.rebuildChunk.bind(this),

      // Batch operations
      box: this.createBox.bind(this),
      sphere: this.createSphere.bind(this),
      line: this.createLine.bind(this),
      replace: this.replaceVoxels.bind(this),

      // Type groups
      getTypeGroup: this.getTypeGroup.bind(this),
      getAllTypes: this.getAllTypes.bind(this),

      // Constants
      VOXEL_SIZE: this.voxelSize,
      CHUNK_SIZE: this.chunkSize,
      AIR: 0,
    }
  }

  // ==========================================================================
  // Voxel Access
  // ==========================================================================

  private getVoxel(x: number, y: number, z: number): number {
    return this.world.get(Math.floor(x), Math.floor(y), Math.floor(z))
  }

  private setVoxel(x: number, y: number, z: number, voxel: number): void {
    this.world.set(Math.floor(x), Math.floor(y), Math.floor(z), voxel)
  }

  private fillVoxels(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    voxel: number
  ): void {
    this.world.fill(
      Math.floor(x1), Math.floor(y1), Math.floor(z1),
      Math.floor(x2), Math.floor(y2), Math.floor(z2),
      voxel
    )
  }

  private clearVoxel(x: number, y: number, z: number): void {
    this.world.set(Math.floor(x), Math.floor(y), Math.floor(z), 0) // AIR
  }

  // ==========================================================================
  // Voxel Type Utilities
  // ==========================================================================

  private getVoxelType(voxel: number): number {
    return voxel & 0xFF
  }

  private getVoxelVariant(voxel: number): number {
    return (voxel >> 8) & 0xFF
  }

  private makeVoxel(type: number | string, variant: number = 0): number {
    let typeId: number
    if (typeof type === 'string') {
      typeId = this.typeNameToId(type) ?? 0
    } else {
      typeId = type
    }
    return (typeId & 0xFF) | ((variant & 0xFF) << 8)
  }

  private typeNameToId(name: string): number | null {
    if (!this.registry) return null
    return this.registry.getId(name) ?? null
  }

  private typeIdToName(id: number): string | null {
    if (!this.registry) return null
    return this.registry.getName(id) ?? null
  }

  // ==========================================================================
  // Coordinate Conversion
  // ==========================================================================

  private worldToVoxel(wx: number, wy: number, wz: number): number[] {
    return [
      Math.floor(wx / this.voxelSize),
      Math.floor(wy / this.voxelSize),
      Math.floor(wz / this.voxelSize),
    ]
  }

  private voxelToWorld(vx: number, vy: number, vz: number): number[] {
    return [
      vx * this.voxelSize + this.voxelSize / 2,
      vy * this.voxelSize + this.voxelSize / 2,
      vz * this.voxelSize + this.voxelSize / 2,
    ]
  }

  private voxelToChunk(vx: number, vy: number, vz: number): number[] {
    return [
      Math.floor(vx / this.chunkSize),
      Math.floor(vy / this.chunkSize),
      Math.floor(vz / this.chunkSize),
    ]
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  private isSolid(x: number, y: number, z: number): boolean {
    const voxel = this.world.get(Math.floor(x), Math.floor(y), Math.floor(z))
    const typeId = voxel & 0xFF
    if (this.registry) {
      return this.registry.isSolid(typeId)
    }
    // Default: non-zero types are solid
    return typeId !== 0
  }

  private isTransparent(x: number, y: number, z: number): boolean {
    const voxel = this.world.get(Math.floor(x), Math.floor(y), Math.floor(z))
    const typeId = voxel & 0xFF
    if (this.registry) {
      return this.registry.isTransparent(typeId)
    }
    // Default: AIR is transparent
    return typeId === 0
  }

  private isPassable(x: number, y: number, z: number): boolean {
    const voxel = this.world.get(Math.floor(x), Math.floor(y), Math.floor(z))
    const typeId = voxel & 0xFF
    if (this.registry) {
      return this.registry.isPassable(typeId)
    }
    // Default: AIR is passable
    return typeId === 0
  }

  private isEmpty(x: number, y: number, z: number): boolean {
    const voxel = this.world.get(Math.floor(x), Math.floor(y), Math.floor(z))
    return (voxel & 0xFF) === 0
  }

  private getVoxelColor(x: number, y: number, z: number): number {
    const voxel = this.world.get(Math.floor(x), Math.floor(y), Math.floor(z))
    const typeId = voxel & 0xFF
    if (this.registry) {
      return this.registry.getColor(typeId)
    }
    return 0xFFFFFF
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================

  private rebuildDirty(): void {
    if (this.renderer) {
      this.renderer.rebuildDirty()
    }
  }

  private rebuildAll(): void {
    if (this.renderer) {
      this.renderer.rebuildAll()
    }
  }

  private rebuildChunk(cx: number, cy: number, cz: number): void {
    if (this.renderer) {
      this.renderer.rebuildChunk(cx, cy, cz)
    }
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  private createBox(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    voxel: number,
    hollow: boolean = false
  ): void {
    const minX = Math.min(Math.floor(x1), Math.floor(x2))
    const maxX = Math.max(Math.floor(x1), Math.floor(x2))
    const minY = Math.min(Math.floor(y1), Math.floor(y2))
    const maxY = Math.max(Math.floor(y1), Math.floor(y2))
    const minZ = Math.min(Math.floor(z1), Math.floor(z2))
    const maxZ = Math.max(Math.floor(z1), Math.floor(z2))

    if (hollow) {
      // Only fill the shell
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            const isEdge =
              x === minX || x === maxX ||
              y === minY || y === maxY ||
              z === minZ || z === maxZ
            if (isEdge) {
              this.world.set(x, y, z, voxel)
            }
          }
        }
      }
    } else {
      this.world.fill(minX, minY, minZ, maxX, maxY, maxZ, voxel)
    }
  }

  private createSphere(
    cx: number, cy: number, cz: number,
    radius: number,
    voxel: number,
    hollow: boolean = false
  ): void {
    const r = Math.floor(radius)
    const r2 = r * r
    const innerR2 = hollow ? (r - 1) * (r - 1) : 0

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          const dist2 = dx * dx + dy * dy + dz * dz
          if (dist2 <= r2 && (!hollow || dist2 >= innerR2)) {
            this.world.set(
              Math.floor(cx) + dx,
              Math.floor(cy) + dy,
              Math.floor(cz) + dz,
              voxel
            )
          }
        }
      }
    }
  }

  private createLine(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    voxel: number
  ): void {
    // Bresenham's 3D line algorithm
    const dx = Math.abs(Math.floor(x2) - Math.floor(x1))
    const dy = Math.abs(Math.floor(y2) - Math.floor(y1))
    const dz = Math.abs(Math.floor(z2) - Math.floor(z1))
    const sx = x1 < x2 ? 1 : -1
    const sy = y1 < y2 ? 1 : -1
    const sz = z1 < z2 ? 1 : -1

    let x = Math.floor(x1)
    let y = Math.floor(y1)
    let z = Math.floor(z1)

    const dm = Math.max(dx, dy, dz)
    let i = dm

    // Initialize error terms
    let errX = dm / 2
    let errY = dm / 2
    let errZ = dm / 2

    while (i-- >= 0) {
      this.world.set(x, y, z, voxel)

      errX -= dx
      if (errX < 0) {
        errX += dm
        x += sx
      }

      errY -= dy
      if (errY < 0) {
        errY += dm
        y += sy
      }

      errZ -= dz
      if (errZ < 0) {
        errZ += dm
        z += sz
      }
    }
  }

  private replaceVoxels(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    fromVoxel: number,
    toVoxel: number
  ): number {
    const minX = Math.min(Math.floor(x1), Math.floor(x2))
    const maxX = Math.max(Math.floor(x1), Math.floor(x2))
    const minY = Math.min(Math.floor(y1), Math.floor(y2))
    const maxY = Math.max(Math.floor(y1), Math.floor(y2))
    const minZ = Math.min(Math.floor(z1), Math.floor(z2))
    const maxZ = Math.max(Math.floor(z1), Math.floor(z2))

    let count = 0
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.get(x, y, z) === fromVoxel) {
            this.world.set(x, y, z, toVoxel)
            count++
          }
        }
      }
    }
    return count
  }

  // ==========================================================================
  // Type Groups
  // ==========================================================================

  private getTypeGroup(groupName: string): number[] {
    if (this.registry) {
      return this.registry.getTypeGroup(groupName)
    }
    return []
  }

  private getAllTypes(): string[] {
    if (this.registry) {
      return this.registry.getAllTypeNames()
    }
    return []
  }
}

/**
 * Create voxel namespace bindings for Forge 2.0 runtime.
 */
export function createVoxelBindings(config: VoxelBridgeConfig): { voxel: ForgeMap, bridge: VoxelBridge } {
  const bridge = new VoxelBridge(config)
  return {
    voxel: bridge.createNamespace(),
    bridge,
  }
}
