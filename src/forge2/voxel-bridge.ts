/**
 * Forge 2.0 Voxel Bridge
 *
 * Connects Forge scripts to the voxel rendering system.
 * Provides a `voxel` namespace for voxel manipulation.
 *
 * Also provides dynamic voxel objects - voxel shapes compiled to meshes
 * that can be moved around without rebuilding.
 */

import * as THREE from 'three'
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
  scene?: THREE.Scene  // Required for dynamic voxel objects
  voxelSize?: number
  chunkSize?: number
}

/**
 * A dynamic voxel object - voxels compiled to a mesh that can be moved.
 */
interface VoxelObject {
  id: string
  mesh: THREE.Mesh
  geometry: THREE.BufferGeometry
  voxelData: Map<string, number>  // voxel positions and types
}

// ============================================================================
// Voxel Bridge Class
// ============================================================================

export class VoxelBridge {
  private world: VoxelWorldLike
  private renderer: VoxelRendererLike | null
  private registry: VoxelTypeRegistryLike | null
  private scene: THREE.Scene | null
  private voxelSize: number
  private chunkSize: number

  // Dynamic voxel objects
  private objects: Map<string, VoxelObject> = new Map()
  private nextObjectId: number = 1

  // Shared material for voxel objects
  private objectMaterial: THREE.MeshStandardMaterial

  constructor(config: VoxelBridgeConfig) {
    this.world = config.world
    this.renderer = config.renderer ?? null
    this.registry = config.registry ?? null
    this.scene = config.scene ?? null
    this.voxelSize = config.voxelSize ?? 0.025
    this.chunkSize = config.chunkSize ?? 16

    // Create shared material for dynamic objects
    this.objectMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true,
    })
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

      // Dynamic voxel objects (movable, compiled-once meshes)
      createBoxObject: this.createBoxObject.bind(this),
      createSphereObject: this.createSphereObject.bind(this),
      setObjectPosition: this.setObjectPosition.bind(this),
      setObjectRotation: this.setObjectRotation.bind(this),
      destroyObject: this.destroyObject.bind(this),
      objectExists: this.objectExists.bind(this),

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

  // ==========================================================================
  // Dynamic Voxel Objects
  // ==========================================================================

  /**
   * Create a box-shaped voxel object that can be moved without rebuilding.
   * @param width Width in voxels
   * @param height Height in voxels
   * @param depth Depth in voxels
   * @param voxelType Voxel type ID
   * @returns Object ID string, or null if scene not available
   */
  private createBoxObject(
    width: number,
    height: number,
    depth: number,
    voxelType: number
  ): string | null {
    if (!this.scene) {
      console.warn('VoxelBridge: Cannot create object without scene')
      return null
    }

    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    const d = Math.max(1, Math.floor(depth))

    // Build voxel data centered on origin
    const voxelData = new Map<string, number>()
    const halfW = Math.floor(w / 2)
    const halfH = Math.floor(h / 2)
    const halfD = Math.floor(d / 2)

    for (let x = -halfW; x < w - halfW; x++) {
      for (let y = -halfH; y < h - halfH; y++) {
        for (let z = -halfD; z < d - halfD; z++) {
          voxelData.set(`${x},${y},${z}`, voxelType)
        }
      }
    }

    return this.createObjectFromVoxels(voxelData)
  }

  /**
   * Create a sphere-shaped voxel object that can be moved without rebuilding.
   * @param radius Radius in voxels
   * @param voxelType Voxel type ID
   * @returns Object ID string, or null if scene not available
   */
  private createSphereObject(
    radius: number,
    voxelType: number
  ): string | null {
    if (!this.scene) {
      console.warn('VoxelBridge: Cannot create object without scene')
      return null
    }

    const r = Math.max(1, Math.floor(radius))
    const r2 = r * r

    // Build voxel data centered on origin
    const voxelData = new Map<string, number>()

    for (let x = -r; x <= r; x++) {
      for (let y = -r; y <= r; y++) {
        for (let z = -r; z <= r; z++) {
          const dist2 = x * x + y * y + z * z
          if (dist2 <= r2) {
            voxelData.set(`${x},${y},${z}`, voxelType)
          }
        }
      }
    }

    return this.createObjectFromVoxels(voxelData)
  }

  /**
   * Create a mesh from voxel data using greedy-style meshing.
   */
  private createObjectFromVoxels(voxelData: Map<string, number>): string | null {
    if (!this.scene || voxelData.size === 0) return null

    // Generate geometry from voxels
    const geometry = this.meshVoxelData(voxelData)

    // Create mesh
    const mesh = new THREE.Mesh(geometry, this.objectMaterial)
    mesh.castShadow = false
    mesh.receiveShadow = false

    // Generate ID and store object
    const id = `vobj_${this.nextObjectId++}`
    mesh.name = id

    this.objects.set(id, {
      id,
      mesh,
      geometry,
      voxelData,
    })

    // Add to scene
    this.scene.add(mesh)

    return id
  }

  /**
   * Simple greedy-style meshing for voxel object data.
   * Creates one quad per exposed face.
   */
  private meshVoxelData(voxelData: Map<string, number>): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    let vertexIndex = 0

    // Face directions: [dx, dy, dz, nx, ny, nz]
    const faces = [
      [-1, 0, 0, -1, 0, 0],  // -X
      [1, 0, 0, 1, 0, 0],    // +X
      [0, -1, 0, 0, -1, 0],  // -Y
      [0, 1, 0, 0, 1, 0],    // +Y
      [0, 0, -1, 0, 0, -1],  // -Z
      [0, 0, 1, 0, 0, 1],    // +Z
    ]

    for (const [key, voxelType] of voxelData) {
      const [x, y, z] = key.split(',').map(Number)

      // Get color for this voxel type
      const colorHex = this.registry?.getColor(voxelType) ?? 0x888888
      const color = new THREE.Color(colorHex)

      // Check each face
      for (const [dx, dy, dz, nx, ny, nz] of faces) {
        const neighborKey = `${x + dx},${y + dy},${z + dz}`

        // Only add face if neighbor is empty (not in voxelData)
        if (!voxelData.has(neighborKey)) {
          this.addFace(
            positions, normals, colors, indices,
            x, y, z,
            nx, ny, nz,
            color,
            vertexIndex
          )
          vertexIndex += 4
        }
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)

    return geometry
  }

  /**
   * Add a face (quad) to the geometry arrays.
   */
  private addFace(
    positions: number[],
    normals: number[],
    colors: number[],
    indices: number[],
    x: number, y: number, z: number,
    nx: number, ny: number, nz: number,
    color: THREE.Color,
    vertexIndex: number
  ): void {
    const s = this.voxelSize

    // Determine the two axes perpendicular to the normal
    let u1: [number, number, number], u2: [number, number, number]
    if (nx !== 0) {
      u1 = [0, 1, 0]
      u2 = [0, 0, 1]
    } else if (ny !== 0) {
      u1 = [1, 0, 0]
      u2 = [0, 0, 1]
    } else {
      u1 = [1, 0, 0]
      u2 = [0, 1, 0]
    }

    // Calculate face center position
    const cx = (x + 0.5 + nx * 0.5) * s
    const cy = (y + 0.5 + ny * 0.5) * s
    const cz = (z + 0.5 + nz * 0.5) * s

    // Generate 4 corners
    const corners: [number, number, number][] = [
      [cx - u1[0] * s / 2 - u2[0] * s / 2, cy - u1[1] * s / 2 - u2[1] * s / 2, cz - u1[2] * s / 2 - u2[2] * s / 2],
      [cx + u1[0] * s / 2 - u2[0] * s / 2, cy + u1[1] * s / 2 - u2[1] * s / 2, cz + u1[2] * s / 2 - u2[2] * s / 2],
      [cx + u1[0] * s / 2 + u2[0] * s / 2, cy + u1[1] * s / 2 + u2[1] * s / 2, cz + u1[2] * s / 2 + u2[2] * s / 2],
      [cx - u1[0] * s / 2 + u2[0] * s / 2, cy - u1[1] * s / 2 + u2[1] * s / 2, cz - u1[2] * s / 2 + u2[2] * s / 2],
    ]

    // Add vertices
    for (const corner of corners) {
      positions.push(corner[0], corner[1], corner[2])
      normals.push(nx, ny, nz)
      colors.push(color.r, color.g, color.b)
    }

    // Add indices (two triangles)
    // Flip winding based on normal direction for correct face culling
    const isPositiveNormal = nx > 0 || ny > 0 || nz > 0
    if (isPositiveNormal) {
      indices.push(
        vertexIndex, vertexIndex + 1, vertexIndex + 2,
        vertexIndex, vertexIndex + 2, vertexIndex + 3
      )
    } else {
      indices.push(
        vertexIndex + 2, vertexIndex + 1, vertexIndex,
        vertexIndex + 3, vertexIndex + 2, vertexIndex
      )
    }
  }

  /**
   * Set the position of a dynamic voxel object.
   */
  private setObjectPosition(id: string, x: number, y: number, z: number): boolean {
    const obj = this.objects.get(id)
    if (!obj) return false

    obj.mesh.position.set(x, y, z)
    return true
  }

  /**
   * Set the rotation of a dynamic voxel object.
   */
  private setObjectRotation(id: string, x: number, y: number, z: number): boolean {
    const obj = this.objects.get(id)
    if (!obj) return false

    obj.mesh.rotation.set(x, y, z)
    return true
  }

  /**
   * Check if a dynamic voxel object exists.
   */
  private objectExists(id: string): boolean {
    return this.objects.has(id)
  }

  /**
   * Destroy a dynamic voxel object.
   */
  private destroyObject(id: string): boolean {
    const obj = this.objects.get(id)
    if (!obj) return false

    // Remove from scene
    if (this.scene) {
      this.scene.remove(obj.mesh)
    }

    // Dispose geometry
    obj.geometry.dispose()

    // Remove from map
    this.objects.delete(id)

    return true
  }

  /**
   * Get the number of dynamic voxel objects.
   */
  getObjectCount(): number {
    return this.objects.size
  }

  /**
   * Dispose all dynamic voxel objects.
   */
  disposeObjects(): void {
    for (const obj of this.objects.values()) {
      if (this.scene) {
        this.scene.remove(obj.mesh)
      }
      obj.geometry.dispose()
    }
    this.objects.clear()
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
