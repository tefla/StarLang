/**
 * Creates THREE.js meshes for dynamic asset parts.
 *
 * Similar to the voxel rendering in GreedyMesher but:
 * - Creates independent meshes that can be transformed
 * - Supports material property updates for animations
 * - Uses MeshStandardMaterial with emissive for glowing effects
 */

import * as THREE from 'three'
import type { VoxelPlacement } from './VoxelAsset'
import type { PartState, DynamicPartDef, BoxDef } from './AnimatedAsset'
import { VoxelType, VOXEL_SIZE } from './VoxelTypes'

// Color palette (matching GreedyMesher)
const VOXEL_COLORS: Record<number, number> = {
  [VoxelType.AIR]: 0x000000,
  [VoxelType.HULL]: 0x8888aa,
  [VoxelType.WALL]: 0x4488ff,
  [VoxelType.FLOOR]: 0x44aa44,
  [VoxelType.CEILING]: 0xcccccc,
  [VoxelType.GLASS]: 0x88ddff,
  [VoxelType.METAL_GRATE]: 0xaaaaaa,
  [VoxelType.PANEL]: 0x8899cc,
  [VoxelType.CONDUIT]: 0x999999,
  [VoxelType.TRIM]: 0xbbbbbb,
  [VoxelType.LIGHT_FIXTURE]: 0xffffaa,
  [VoxelType.SWITCH]: 0x6080a0,
  [VoxelType.SWITCH_BUTTON]: 0x888888,
  [VoxelType.LED_GREEN]: 0x00ff00,
  [VoxelType.LED_RED]: 0xff0000,
  [VoxelType.DOOR_FRAME]: 0x3a4a5a,
  [VoxelType.DOOR_PANEL]: 0x4a5a6a,
  [VoxelType.SCREEN]: 0x1a2744,
  [VoxelType.DESK]: 0x2a3a4a,
  [VoxelType.KEYBOARD]: 0x1a2a3a,
}

export interface DynamicPartMeshOptions {
  castShadow?: boolean
  receiveShadow?: boolean
}

/**
 * A THREE.js mesh representing a dynamic part of an animated asset.
 */
export class DynamicPartMesh {
  public group: THREE.Group
  public mesh: THREE.Mesh
  public material: THREE.MeshStandardMaterial

  private def: DynamicPartDef
  private baseColor: THREE.Color

  constructor(def: DynamicPartDef, options: DynamicPartMeshOptions = {}) {
    this.def = def
    this.group = new THREE.Group()
    this.group.name = `DynamicPart_${def.id}`

    // Build mesh from box or voxels
    let geometry: THREE.BufferGeometry
    let color: THREE.Color

    if (def.box) {
      // Use efficient box geometry
      const result = this.buildBoxGeometry(def.box)
      geometry = result.geometry
      color = result.color
    } else {
      // Use voxel-based geometry
      const result = this.buildGeometry(def.voxels ?? [])
      geometry = result.geometry
      color = result.color
    }

    this.baseColor = color

    this.material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.5,
      metalness: 0.4,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.castShadow = options.castShadow ?? true
    this.mesh.receiveShadow = options.receiveShadow ?? true

    // Apply anchor offset to mesh (so group position is the part's origin)
    const anchor = def.anchor ?? { x: 0, y: 0, z: 0 }
    this.mesh.position.set(
      -anchor.x * VOXEL_SIZE,
      -anchor.y * VOXEL_SIZE,
      -anchor.z * VOXEL_SIZE
    )

    this.group.add(this.mesh)

    // Apply initial transform
    if (def.transform?.position) {
      const [x, y, z] = def.transform.position
      this.group.position.set(x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE)
    }

    if (def.transform?.rotation) {
      this.group.rotation.y = (def.transform.rotation * Math.PI) / 180
    }

    if (def.transform?.scale) {
      const [sx, sy, sz] = def.transform.scale
      this.group.scale.set(sx, sy, sz)
    }
  }

  /**
   * Build efficient geometry for a solid box (6 faces).
   */
  private buildBoxGeometry(box: BoxDef): {
    geometry: THREE.BufferGeometry
    color: THREE.Color
  } {
    const w = box.width * VOXEL_SIZE
    const h = box.height * VOXEL_SIZE
    const d = box.depth * VOXEL_SIZE

    const type = VoxelType[box.type as keyof typeof VoxelType]
    const color = new THREE.Color(VOXEL_COLORS[type] ?? 0x888888)

    // Use THREE.js BoxGeometry for efficient rendering
    const geometry = new THREE.BoxGeometry(w, h, d)
    // Shift geometry so origin is at corner (0,0,0) instead of center
    geometry.translate(w / 2, h / 2, d / 2)

    return { geometry, color }
  }

  /**
   * Build geometry from voxel placements.
   * Uses a simple box-per-voxel approach (no greedy meshing).
   */
  private buildGeometry(voxels: VoxelPlacement[]): {
    geometry: THREE.BufferGeometry
    color: THREE.Color
  } {
    const positions: number[] = []
    const normals: number[] = []
    const indices: number[] = []

    let vertexIndex = 0
    let primaryColor = new THREE.Color(0x888888)

    // Build a set of occupied voxels for neighbor checking
    const occupied = new Set<string>()
    for (const voxel of voxels) {
      const [ox, oy, oz] = voxel.offset
      occupied.add(`${ox},${oy},${oz}`)
    }

    for (const voxel of voxels) {
      const [ox, oy, oz] = voxel.offset
      const x = ox * VOXEL_SIZE
      const y = oy * VOXEL_SIZE
      const z = oz * VOXEL_SIZE
      const s = VOXEL_SIZE

      const type = VoxelType[voxel.type as keyof typeof VoxelType]
      if (type !== undefined) {
        primaryColor = new THREE.Color(VOXEL_COLORS[type] ?? 0x888888)
      }

      // Face definitions: [vertices (4 corners), normal]
      // Only add faces that aren't adjacent to another voxel
      const faces: Array<{
        corners: [number, number, number][]
        normal: [number, number, number]
        neighborOffset: [number, number, number]
      }> = [
        {
          corners: [
            [0, 0, 0],
            [0, 0, s],
            [0, s, s],
            [0, s, 0],
          ],
          normal: [-1, 0, 0],
          neighborOffset: [-1, 0, 0],
        },
        {
          corners: [
            [s, 0, 0],
            [s, s, 0],
            [s, s, s],
            [s, 0, s],
          ],
          normal: [1, 0, 0],
          neighborOffset: [1, 0, 0],
        },
        {
          corners: [
            [0, 0, 0],
            [s, 0, 0],
            [s, 0, s],
            [0, 0, s],
          ],
          normal: [0, -1, 0],
          neighborOffset: [0, -1, 0],
        },
        {
          corners: [
            [0, s, 0],
            [0, s, s],
            [s, s, s],
            [s, s, 0],
          ],
          normal: [0, 1, 0],
          neighborOffset: [0, 1, 0],
        },
        {
          corners: [
            [0, 0, 0],
            [0, s, 0],
            [s, s, 0],
            [s, 0, 0],
          ],
          normal: [0, 0, -1],
          neighborOffset: [0, 0, -1],
        },
        {
          corners: [
            [0, 0, s],
            [s, 0, s],
            [s, s, s],
            [0, s, s],
          ],
          normal: [0, 0, 1],
          neighborOffset: [0, 0, 1],
        },
      ]

      for (const face of faces) {
        // Check if neighbor exists (skip face if covered)
        const [nx, ny, nz] = face.neighborOffset
        const neighborKey = `${ox + nx},${oy + ny},${oz + nz}`
        if (occupied.has(neighborKey)) continue

        // Add face vertices
        for (const c of face.corners) {
          positions.push(x + c[0], y + c[1], z + c[2])
          normals.push(face.normal[0], face.normal[1], face.normal[2])
        }

        // Add face indices (two triangles)
        indices.push(
          vertexIndex,
          vertexIndex + 1,
          vertexIndex + 2,
          vertexIndex,
          vertexIndex + 2,
          vertexIndex + 3
        )

        vertexIndex += 4
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    )
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setIndex(indices)

    return { geometry, color: primaryColor }
  }

  /**
   * Apply a state to this part (instant, no interpolation).
   */
  applyState(state: PartState): void {
    // Position
    if (state.position) {
      const [x, y, z] = state.position
      this.group.position.set(x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE)
    }

    // Rotation
    if (state.rotation !== undefined) {
      this.group.rotation.y = (state.rotation * Math.PI) / 180
    }

    // Scale
    if (state.scale) {
      const [sx, sy, sz] = state.scale
      this.group.scale.set(sx, sy, sz)
    }

    // Emissive color
    if (state.emissive) {
      this.material.emissive.setStyle(state.emissive)
    }

    // Emissive intensity
    if (state.emissiveIntensity !== undefined) {
      this.material.emissiveIntensity = state.emissiveIntensity
    }

    // Base color override
    if (state.color) {
      this.material.color.setStyle(state.color)
    }

    // Visibility
    if (state.visible !== undefined) {
      this.group.visible = state.visible
    }

    // Opacity
    if (state.opacity !== undefined) {
      this.material.opacity = state.opacity
      this.material.transparent = state.opacity < 1
    }
  }

  /**
   * Interpolate between two states.
   */
  lerpState(from: PartState, to: PartState, t: number): void {
    // Position interpolation
    if (from.position && to.position) {
      const x = from.position[0] + (to.position[0] - from.position[0]) * t
      const y = from.position[1] + (to.position[1] - from.position[1]) * t
      const z = from.position[2] + (to.position[2] - from.position[2]) * t
      this.group.position.set(x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE)
    } else if (to.position) {
      // If only 'to' has position, just apply it (start from current)
      const [x, y, z] = to.position
      this.group.position.set(x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE)
    }

    // Emissive intensity interpolation
    if (from.emissiveIntensity !== undefined && to.emissiveIntensity !== undefined) {
      this.material.emissiveIntensity =
        from.emissiveIntensity + (to.emissiveIntensity - from.emissiveIntensity) * t
    } else if (to.emissiveIntensity !== undefined) {
      this.material.emissiveIntensity = to.emissiveIntensity
    }

    // Emissive color interpolation
    if (from.emissive && to.emissive) {
      const fromColor = new THREE.Color(from.emissive)
      const toColor = new THREE.Color(to.emissive)
      this.material.emissive.lerpColors(fromColor, toColor, t)
    } else if (to.emissive) {
      this.material.emissive.setStyle(to.emissive)
    }

    // Opacity interpolation
    if (from.opacity !== undefined && to.opacity !== undefined) {
      this.material.opacity = from.opacity + (to.opacity - from.opacity) * t
      this.material.transparent = this.material.opacity < 1
    } else if (to.opacity !== undefined) {
      this.material.opacity = to.opacity
      this.material.transparent = to.opacity < 1
    }

    // Visibility - instant switch at t=0.5
    if (to.visible !== undefined) {
      this.group.visible = t >= 0.5 ? to.visible : (from.visible ?? true)
    }
  }

  /**
   * Reset to base color (no emissive).
   */
  reset(): void {
    this.material.color.copy(this.baseColor)
    this.material.emissive.setHex(0x000000)
    this.material.emissiveIntensity = 0
    this.material.opacity = 1
    this.material.transparent = false
    this.group.visible = true
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
