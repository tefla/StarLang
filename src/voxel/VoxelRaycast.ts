/**
 * Voxel raycasting using the DDA (Digital Differential Analyzer) algorithm.
 *
 * This is a 3D extension of Bresenham's line algorithm optimized for
 * stepping through voxels along a ray.
 *
 * Reference: "A Fast Voxel Traversal Algorithm for Ray Tracing"
 * by John Amanatides and Andrew Woo
 */

import * as THREE from 'three'
import {
  VOXEL_SIZE,
  VoxelType,
  type VoxelCoord,
  type Face,
  worldToVoxel,
  getVoxelType
} from './VoxelTypes'
import type { VoxelWorld } from './VoxelWorld'

/**
 * Result of a voxel raycast hit.
 */
export interface VoxelHit {
  /** The voxel coordinate that was hit */
  voxelCoord: VoxelCoord
  /** Which face of the voxel was hit (0-5) */
  face: Face
  /** Distance from ray origin to hit point */
  distance: number
  /** World position of the hit point */
  point: THREE.Vector3
  /** Normal vector of the hit face */
  normal: THREE.Vector3
  /** The voxel type that was hit */
  voxelType: VoxelType
}

/**
 * Voxel raycaster using DDA algorithm.
 */
export class VoxelRaycast {
  private world: VoxelWorld

  constructor(world: VoxelWorld) {
    this.world = world
  }

  /**
   * Cast a ray through the voxel world.
   *
   * @param origin Ray origin in world coordinates
   * @param direction Normalized ray direction
   * @param maxDistance Maximum ray travel distance
   * @returns Hit result or null if no hit
   */
  cast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number = 100
  ): VoxelHit | null {
    // Normalize direction just in case
    const dir = direction.clone().normalize()

    // Convert origin to voxel coordinates
    const voxelPos = worldToVoxel(origin.x, origin.y, origin.z)
    let x = voxelPos.x
    let y = voxelPos.y
    let z = voxelPos.z

    // Step direction for each axis
    const stepX = dir.x > 0 ? 1 : -1
    const stepY = dir.y > 0 ? 1 : -1
    const stepZ = dir.z > 0 ? 1 : -1

    // Calculate tDelta - how far along the ray to move to cross one voxel
    const tDeltaX = dir.x !== 0 ? Math.abs(VOXEL_SIZE / dir.x) : Infinity
    const tDeltaY = dir.y !== 0 ? Math.abs(VOXEL_SIZE / dir.y) : Infinity
    const tDeltaZ = dir.z !== 0 ? Math.abs(VOXEL_SIZE / dir.z) : Infinity

    // Calculate tMax - distance to next voxel boundary for each axis
    let tMaxX = this.calcTMax(origin.x, dir.x, stepX)
    let tMaxY = this.calcTMax(origin.y, dir.y, stepY)
    let tMaxZ = this.calcTMax(origin.z, dir.z, stepZ)

    // Track which face we entered from
    let lastFace: Face = 0

    // Step through voxels
    let t = 0
    while (t < maxDistance) {
      // Check current voxel
      const voxel = this.world.getVoxel(x, y, z)
      const voxelType = getVoxelType(voxel)

      if (voxelType !== VoxelType.AIR) {
        // Hit a solid voxel
        const point = origin.clone().addScaledVector(dir, t)
        const normal = this.getFaceNormal(lastFace)

        return {
          voxelCoord: { x, y, z },
          face: lastFace,
          distance: t,
          point,
          normal,
          voxelType
        }
      }

      // Step to next voxel
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        t = tMaxX
        tMaxX += tDeltaX
        x += stepX
        lastFace = stepX > 0 ? 0 : 1  // NEG_X or POS_X
      } else if (tMaxY < tMaxZ) {
        t = tMaxY
        tMaxY += tDeltaY
        y += stepY
        lastFace = stepY > 0 ? 2 : 3  // NEG_Y or POS_Y
      } else {
        t = tMaxZ
        tMaxZ += tDeltaZ
        z += stepZ
        lastFace = stepZ > 0 ? 4 : 5  // NEG_Z or POS_Z
      }
    }

    return null
  }

  /**
   * Cast a ray from a Three.js camera through a screen point.
   */
  castFromCamera(
    camera: THREE.Camera,
    screenX: number,
    screenY: number,
    maxDistance: number = 100
  ): VoxelHit | null {
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2(screenX, screenY)
    raycaster.setFromCamera(ndc, camera)

    return this.cast(raycaster.ray.origin, raycaster.ray.direction, maxDistance)
  }

  /**
   * Get the voxel coordinate adjacent to a hit face.
   * Used for placing voxels next to existing ones.
   */
  getAdjacentVoxel(hit: VoxelHit): VoxelCoord {
    const { x, y, z } = hit.voxelCoord
    const offsets: [number, number, number][] = [
      [-1, 0, 0],  // NEG_X
      [1, 0, 0],   // POS_X
      [0, -1, 0],  // NEG_Y
      [0, 1, 0],   // POS_Y
      [0, 0, -1],  // NEG_Z
      [0, 0, 1]    // POS_Z
    ]
    const offset = offsets[hit.face] ?? [0, 0, 0]
    return {
      x: x + offset[0],
      y: y + offset[1],
      z: z + offset[2]
    }
  }

  /**
   * Calculate initial tMax value for an axis.
   */
  private calcTMax(origin: number, dir: number, step: number): number {
    if (dir === 0) return Infinity

    // Find distance to next voxel boundary
    const voxelOrigin = Math.floor(origin / VOXEL_SIZE) * VOXEL_SIZE
    let boundary: number

    if (step > 0) {
      boundary = voxelOrigin + VOXEL_SIZE
    } else {
      boundary = voxelOrigin
    }

    return (boundary - origin) / dir
  }

  /**
   * Get normal vector for a face.
   */
  private getFaceNormal(face: Face): THREE.Vector3 {
    const normals: THREE.Vector3[] = [
      new THREE.Vector3(-1, 0, 0),  // NEG_X
      new THREE.Vector3(1, 0, 0),   // POS_X
      new THREE.Vector3(0, -1, 0),  // NEG_Y
      new THREE.Vector3(0, 1, 0),   // POS_Y
      new THREE.Vector3(0, 0, -1),  // NEG_Z
      new THREE.Vector3(0, 0, 1)    // POS_Z
    ]
    const normal = normals[face]
    return normal ? normal.clone() : new THREE.Vector3(-1, 0, 0)
  }
}

/**
 * Cast multiple rays in a pattern (useful for brush tools).
 */
export function castRayPattern(
  raycast: VoxelRaycast,
  center: THREE.Vector3,
  direction: THREE.Vector3,
  radius: number,
  spacing: number = VOXEL_SIZE
): VoxelHit[] {
  const hits: VoxelHit[] = []

  // Create orthonormal basis from direction
  const up = Math.abs(direction.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0)

  const right = new THREE.Vector3().crossVectors(direction, up).normalize()
  const actualUp = new THREE.Vector3().crossVectors(right, direction).normalize()

  // Cast rays in a grid pattern
  const steps = Math.ceil(radius / spacing)
  for (let u = -steps; u <= steps; u++) {
    for (let v = -steps; v <= steps; v++) {
      const offset = new THREE.Vector3()
        .addScaledVector(right, u * spacing)
        .addScaledVector(actualUp, v * spacing)

      if (offset.length() <= radius) {
        const origin = center.clone().add(offset)
        const hit = raycast.cast(origin, direction)
        if (hit) {
          hits.push(hit)
        }
      }
    }
  }

  return hits
}

/**
 * 3D Bresenham line algorithm for drawing voxel lines.
 */
export function bresenhamLine3D(
  start: VoxelCoord,
  end: VoxelCoord
): VoxelCoord[] {
  const points: VoxelCoord[] = []

  let x = start.x
  let y = start.y
  let z = start.z

  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  const dz = Math.abs(end.z - start.z)

  const sx = start.x < end.x ? 1 : -1
  const sy = start.y < end.y ? 1 : -1
  const sz = start.z < end.z ? 1 : -1

  // Determine dominant axis
  const maxD = Math.max(dx, dy, dz)

  if (maxD === 0) {
    points.push({ x, y, z })
    return points
  }

  // Error accumulators
  let errX = maxD / 2
  let errY = maxD / 2
  let errZ = maxD / 2

  for (let i = 0; i <= maxD; i++) {
    points.push({ x, y, z })

    errX -= dx
    errY -= dy
    errZ -= dz

    if (errX < 0) {
      errX += maxD
      x += sx
    }
    if (errY < 0) {
      errY += maxD
      y += sy
    }
    if (errZ < 0) {
      errZ += maxD
      z += sz
    }
  }

  return points
}
