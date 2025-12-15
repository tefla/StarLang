/**
 * FanMesh - Animated spinning mesh from resolved voxels.
 *
 * Creates a Three.js mesh from pre-resolved voxels (from asset loader)
 * and spins it according to animation config.
 */

import * as THREE from 'three'
import { VoxelType, VOXEL_SIZE } from '../../voxel/VoxelTypes'
import type { AnimatedChildInfo } from '../../voxel/VoxelAssetLoader'
import type { ResolvedVoxel } from '../../voxel/VoxelAsset'

// Voxel colors (matching GreedyMesher)
const VOXEL_COLORS: Record<number, number> = {
  [VoxelType.FAN_HUB]: 0x3a3a3a,
  [VoxelType.FAN_BLADE]: 0x7a7a7a,
}

export class FanMesh {
  public group: THREE.Group
  public pivot: THREE.Group
  private spinSpeed: number
  private spinAxis: 'x' | 'y' | 'z'

  constructor(info: AnimatedChildInfo) {
    this.group = new THREE.Group()
    this.group.name = `fan_${info.assetId}`
    this.pivot = new THREE.Group()

    // Animation config
    this.spinSpeed = info.animate.speed ?? Math.PI * 2  // Default 1 rotation/sec
    this.spinAxis = info.animate.axis

    // Build mesh from resolved voxels
    this.buildMesh(info.voxels, info.position)

    this.group.add(this.pivot)
  }

  /**
   * Build mesh from resolved voxels.
   */
  private buildMesh(voxels: ResolvedVoxel[], position: { x: number; y: number; z: number }): void {
    if (voxels.length === 0) {
      console.warn('[FanMesh] No voxels provided')
      return
    }

    // Calculate center of all voxels (pivot point)
    let sumX = 0, sumY = 0, sumZ = 0
    for (const v of voxels) {
      sumX += v.x
      sumY += v.y
      sumZ += v.z
    }
    const centerX = sumX / voxels.length
    const centerY = sumY / voxels.length
    const centerZ = sumZ / voxels.length

    // Create geometry
    const geometry = new THREE.BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    for (const v of voxels) {
      // Position relative to center (for pivot)
      const localX = (v.x - centerX) * VOXEL_SIZE
      const localY = (v.y - centerY) * VOXEL_SIZE
      const localZ = (v.z - centerZ) * VOXEL_SIZE

      const color = new THREE.Color(VOXEL_COLORS[v.type] ?? 0x888888)

      // Add a cube for each voxel
      const baseIndex = positions.length / 3
      const s = VOXEL_SIZE

      // 8 corners
      positions.push(
        localX, localY, localZ,
        localX + s, localY, localZ,
        localX + s, localY + s, localZ,
        localX, localY + s, localZ,
        localX, localY, localZ + s,
        localX + s, localY, localZ + s,
        localX + s, localY + s, localZ + s,
        localX, localY + s, localZ + s
      )

      for (let i = 0; i < 8; i++) {
        colors.push(color.r, color.g, color.b)
      }

      // 6 faces
      indices.push(
        baseIndex + 0, baseIndex + 1, baseIndex + 2,
        baseIndex + 0, baseIndex + 2, baseIndex + 3,
        baseIndex + 5, baseIndex + 4, baseIndex + 7,
        baseIndex + 5, baseIndex + 7, baseIndex + 6,
        baseIndex + 3, baseIndex + 2, baseIndex + 6,
        baseIndex + 3, baseIndex + 6, baseIndex + 7,
        baseIndex + 4, baseIndex + 5, baseIndex + 1,
        baseIndex + 4, baseIndex + 1, baseIndex + 0,
        baseIndex + 1, baseIndex + 5, baseIndex + 6,
        baseIndex + 1, baseIndex + 6, baseIndex + 2,
        baseIndex + 4, baseIndex + 0, baseIndex + 3,
        baseIndex + 4, baseIndex + 3, baseIndex + 7
      )
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.3,
      roughness: 0.7
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    this.pivot.add(mesh)

    // Position pivot at voxel center in world space
    this.pivot.position.set(
      centerX * VOXEL_SIZE,
      centerY * VOXEL_SIZE,
      centerZ * VOXEL_SIZE
    )

    console.log(`[FanMesh] Created with ${voxels.length} voxels, pivot at (${centerX.toFixed(1)}, ${centerY.toFixed(1)}, ${centerZ.toFixed(1)})`)
  }

  /**
   * Update fan animation.
   */
  update(deltaTime: number): void {
    switch (this.spinAxis) {
      case 'x':
        this.pivot.rotation.x += this.spinSpeed * deltaTime
        break
      case 'y':
        this.pivot.rotation.y += this.spinSpeed * deltaTime
        break
      case 'z':
        this.pivot.rotation.z += this.spinSpeed * deltaTime
        break
    }
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    this.pivot.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose()
        }
      }
    })
  }
}
