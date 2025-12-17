/**
 * JSON Asset Bridge
 *
 * Loads voxel assets from JSON files and creates voxel objects.
 * Designed for easy asset creation by Claude and viewing in the asset viewer.
 *
 * Usage in Forge2 scripts:
 * ```forge
 * let assetId = jsonAsset.load("/game/assets/spaceship.asset.json")
 * ```
 */

import * as THREE from 'three'
import type { ForgeValue, ForgeMap } from './types'
import type { Runtime } from './runtime'

// ============================================================================
// Types
// ============================================================================

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface VoxelDef {
  x: number
  y: number
  z: number
  type: number
  color?: string
}

export interface ShapeDef {
  type: 'box' | 'sphere'
  from?: Vec3
  to?: Vec3
  center?: Vec3
  radius?: number
  voxelType: number
  color?: string
}

export interface JsonAssetDef {
  name: string
  description?: string
  version?: string
  anchor?: Vec3
  voxels?: VoxelDef[]
  shapes?: ShapeDef[]
  metadata?: Record<string, unknown>
}

export interface LoadedAsset {
  id: string
  def: JsonAssetDef
  mesh: THREE.Mesh
  geometry: THREE.BufferGeometry
}

export interface JsonAssetBridgeConfig {
  scene: THREE.Scene
  voxelSize?: number
  runtime?: Runtime
}

// ============================================================================
// JSON Asset Bridge Class
// ============================================================================

export class JsonAssetBridge {
  private scene: THREE.Scene
  private voxelSize: number
  private runtime: Runtime | null = null

  private assets: Map<string, LoadedAsset> = new Map()
  private nextAssetId: number = 1

  // Shared material for asset meshes
  private material: THREE.MeshStandardMaterial

  // Color cache for custom colors
  private colorCache: Map<string, THREE.Color> = new Map()

  constructor(config: JsonAssetBridgeConfig) {
    this.scene = config.scene
    this.voxelSize = config.voxelSize ?? 0.025
    this.runtime = config.runtime ?? null

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true,
    })
  }

  /**
   * Attach runtime for event emission.
   */
  attachRuntime(runtime: Runtime): void {
    this.runtime = runtime
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Create namespace for Forge2 scripts.
   */
  createNamespace(): ForgeMap {
    return {
      // Load asset from JSON file
      load: this.loadAsset.bind(this),

      // Create asset from inline definition
      create: this.createAsset.bind(this),

      // Asset management
      destroy: this.destroyAsset.bind(this),
      exists: this.assetExists.bind(this),
      getInfo: this.getAssetInfo.bind(this),

      // Transform
      setPosition: this.setAssetPosition.bind(this),
      setRotation: this.setAssetRotation.bind(this),
      setScale: this.setAssetScale.bind(this),

      // List assets
      list: this.listAssets.bind(this),
    }
  }

  // ==========================================================================
  // Asset Loading
  // ==========================================================================

  /**
   * Load asset from JSON file path.
   * Returns the asset ID synchronously (or null on error).
   * Emits 'asset:loaded' or 'asset:error' events when complete.
   */
  private loadAsset(path: string): string | null {
    // Start async load but return synchronously
    fetch(path)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then((def: JsonAssetDef) => {
        const id = this.createAssetFromDef(def)

        if (id && this.runtime) {
          this.runtime.emit('asset:loaded', {
            id,
            name: def.name,
            path,
          })
        }
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[JsonAssetBridge] Failed to load ${path}:`, message)

        if (this.runtime) {
          this.runtime.emit('asset:error', {
            path,
            message,
          })
        }
      })

    // Return null synchronously - the actual ID comes via event
    return null
  }

  /**
   * Create asset from inline definition.
   */
  private createAsset(def: JsonAssetDef): string | null {
    return this.createAssetFromDef(def)
  }

  /**
   * Create asset mesh from definition.
   */
  private createAssetFromDef(def: JsonAssetDef): string | null {
    // Build voxel data from shapes and individual voxels
    const voxelData = new Map<string, { type: number; color?: string }>()

    // Process shapes first (boxes, spheres)
    if (def.shapes) {
      for (const shape of def.shapes) {
        this.addShapeToVoxelData(shape, voxelData)
      }
    }

    // Process individual voxels (can override shapes)
    if (def.voxels) {
      for (const voxel of def.voxels) {
        const key = `${voxel.x},${voxel.y},${voxel.z}`
        voxelData.set(key, { type: voxel.type, color: voxel.color })
      }
    }

    if (voxelData.size === 0) {
      console.warn('[JsonAssetBridge] Asset has no voxels:', def.name)
      return null
    }

    // Calculate anchor offset
    const anchor = def.anchor ?? { x: 0, y: 0, z: 0 }

    // Generate geometry
    const geometry = this.meshVoxelData(voxelData, anchor)

    // Create mesh
    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.castShadow = false
    mesh.receiveShadow = false

    // Generate ID
    const id = `jasset_${this.nextAssetId++}`
    mesh.name = id

    // Store asset
    this.assets.set(id, {
      id,
      def,
      mesh,
      geometry,
    })

    // Add to scene
    this.scene.add(mesh)

    return id
  }

  // ==========================================================================
  // Shape Processing
  // ==========================================================================

  /**
   * Add shape voxels to data map.
   */
  private addShapeToVoxelData(
    shape: ShapeDef,
    voxelData: Map<string, { type: number; color?: string }>
  ): void {
    if (shape.type === 'box' && shape.from && shape.to) {
      const minX = Math.min(shape.from.x, shape.to.x)
      const maxX = Math.max(shape.from.x, shape.to.x)
      const minY = Math.min(shape.from.y, shape.to.y)
      const maxY = Math.max(shape.from.y, shape.to.y)
      const minZ = Math.min(shape.from.z, shape.to.z)
      const maxZ = Math.max(shape.from.z, shape.to.z)

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            const key = `${x},${y},${z}`
            voxelData.set(key, { type: shape.voxelType, color: shape.color })
          }
        }
      }
    } else if (shape.type === 'sphere' && shape.center && shape.radius) {
      const cx = shape.center.x
      const cy = shape.center.y
      const cz = shape.center.z
      const r = Math.floor(shape.radius)
      const r2 = r * r

      for (let x = cx - r; x <= cx + r; x++) {
        for (let y = cy - r; y <= cy + r; y++) {
          for (let z = cz - r; z <= cz + r; z++) {
            const dx = x - cx
            const dy = y - cy
            const dz = z - cz
            const dist2 = dx * dx + dy * dy + dz * dz

            if (dist2 <= r2) {
              const key = `${x},${y},${z}`
              voxelData.set(key, { type: shape.voxelType, color: shape.color })
            }
          }
        }
      }
    }
  }

  // ==========================================================================
  // Mesh Generation
  // ==========================================================================

  /**
   * Generate mesh geometry from voxel data.
   */
  private meshVoxelData(
    voxelData: Map<string, { type: number; color?: string }>,
    anchor: Vec3
  ): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    let vertexIndex = 0

    // Face directions: [dx, dy, dz, nx, ny, nz]
    const faces: [number, number, number, number, number, number][] = [
      [-1, 0, 0, -1, 0, 0],  // -X
      [1, 0, 0, 1, 0, 0],    // +X
      [0, -1, 0, 0, -1, 0],  // -Y
      [0, 1, 0, 0, 1, 0],    // +Y
      [0, 0, -1, 0, 0, -1],  // -Z
      [0, 0, 1, 0, 0, 1],    // +Z
    ]

    // Default colors for voxel types (matches VoxelTypeRegistry fallbacks)
    const defaultColors: Record<number, number> = {
      0: 0x000000,    // AIR
      1: 0x2a2a4e,    // floor
      2: 0x5a5a8e,    // wall
      3: 0xffffff,    // white
      4: 0x00ff88,    // green
      5: 0xff4466,    // red
      6: 0x444488,    // purple
      7: 0x4488ff,    // blue
      8: 0x888888,    // grey
      9: 0xcccccc,    // light grey
    }

    for (const [key, voxel] of voxelData) {
      const [x, y, z] = key.split(',').map(Number)

      // Apply anchor offset (center the asset)
      const vx = x - anchor.x
      const vy = y - anchor.y
      const vz = z - anchor.z

      // Get color (custom or default)
      let color: THREE.Color
      if (voxel.color) {
        color = this.getColor(voxel.color)
      } else {
        const colorHex = defaultColors[voxel.type] ?? 0x888888
        color = new THREE.Color(colorHex)
      }

      // Check each face
      for (const [dx, dy, dz, nx, ny, nz] of faces) {
        const neighborKey = `${x + dx},${y + dy},${z + dz}`

        // Only add face if neighbor is empty
        if (!voxelData.has(neighborKey)) {
          this.addFace(
            positions, normals, colors, indices,
            vx, vy, vz,
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
    let u1: [number, number, number]
    let u2: [number, number, number]

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
      [cx - u1[0] * s * 0.5 - u2[0] * s * 0.5,
       cy - u1[1] * s * 0.5 - u2[1] * s * 0.5,
       cz - u1[2] * s * 0.5 - u2[2] * s * 0.5],
      [cx + u1[0] * s * 0.5 - u2[0] * s * 0.5,
       cy + u1[1] * s * 0.5 - u2[1] * s * 0.5,
       cz + u1[2] * s * 0.5 - u2[2] * s * 0.5],
      [cx + u1[0] * s * 0.5 + u2[0] * s * 0.5,
       cy + u1[1] * s * 0.5 + u2[1] * s * 0.5,
       cz + u1[2] * s * 0.5 + u2[2] * s * 0.5],
      [cx - u1[0] * s * 0.5 + u2[0] * s * 0.5,
       cy - u1[1] * s * 0.5 + u2[1] * s * 0.5,
       cz - u1[2] * s * 0.5 + u2[2] * s * 0.5],
    ]

    // Add vertices
    for (const corner of corners) {
      positions.push(corner[0], corner[1], corner[2])
      normals.push(nx, ny, nz)
      colors.push(color.r, color.g, color.b)
    }

    // Add indices (two triangles)
    // Winding depends on normal direction
    // Y faces have inverted winding due to how u1/u2 cross product works
    const isPositive = ny !== 0 ? (ny < 0) : (nx + nz > 0)

    if (isPositive) {
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
   * Get or create cached color.
   */
  private getColor(hex: string): THREE.Color {
    let color = this.colorCache.get(hex)
    if (!color) {
      color = new THREE.Color(hex)
      this.colorCache.set(hex, color)
    }
    return color
  }

  // ==========================================================================
  // Asset Management
  // ==========================================================================

  /**
   * Destroy asset and remove from scene.
   */
  private destroyAsset(id: string): boolean {
    const asset = this.assets.get(id)
    if (!asset) return false

    this.scene.remove(asset.mesh)
    asset.geometry.dispose()
    this.assets.delete(id)

    return true
  }

  /**
   * Check if asset exists.
   */
  private assetExists(id: string): boolean {
    return this.assets.has(id)
  }

  /**
   * Get asset info.
   */
  private getAssetInfo(id: string): JsonAssetDef | null {
    const asset = this.assets.get(id)
    return asset?.def ?? null
  }

  /**
   * List all asset IDs.
   */
  private listAssets(): string[] {
    return Array.from(this.assets.keys())
  }

  // ==========================================================================
  // Transform
  // ==========================================================================

  /**
   * Set asset position.
   */
  private setAssetPosition(id: string, x: number, y: number, z: number): boolean {
    const asset = this.assets.get(id)
    if (!asset) return false

    asset.mesh.position.set(x, y, z)
    return true
  }

  /**
   * Set asset rotation (in radians).
   */
  private setAssetRotation(id: string, x: number, y: number, z: number): boolean {
    const asset = this.assets.get(id)
    if (!asset) return false

    asset.mesh.rotation.set(x, y, z)
    return true
  }

  /**
   * Set asset scale.
   */
  private setAssetScale(id: string, x: number, y: number, z: number): boolean {
    const asset = this.assets.get(id)
    if (!asset) return false

    asset.mesh.scale.set(x, y, z)
    return true
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    for (const asset of this.assets.values()) {
      this.scene.remove(asset.mesh)
      asset.geometry.dispose()
    }
    this.assets.clear()
    this.material.dispose()
    this.colorCache.clear()
  }
}
