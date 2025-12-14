/**
 * Prefab resolver for expanding instances to actual voxels.
 *
 * Takes prefab instances and resolves them to world voxels,
 * handling rotation and position offsets.
 */

import type {
  Prefab,
  PrefabInstance,
  PrefabEntity
} from './PrefabTypes'
import {
  parseVoxelKey,
  rotatePoint,
  calculateRotatedBounds
} from './PrefabTypes'
import { PrefabLibrary } from './PrefabLibrary'
import { VoxelWorld } from '../voxel/VoxelWorld'
import type { Voxel, VoxelCoord } from '../voxel/VoxelTypes'

/**
 * Result of resolving a prefab instance.
 */
export interface ResolvedPrefab {
  /** World positions and voxels */
  voxels: Array<{ position: VoxelCoord; voxel: Voxel }>
  /** Resolved entities with world positions */
  entities: Array<{
    type: PrefabEntity['type']
    position: VoxelCoord
    rotation: number
    properties?: Record<string, unknown>
  }>
}

/**
 * Resolves prefab instances to world voxels.
 */
export class PrefabResolver {
  private library: PrefabLibrary

  constructor(library: PrefabLibrary) {
    this.library = library
  }

  /**
   * Resolve a single prefab instance to voxels.
   */
  resolve(instance: PrefabInstance): ResolvedPrefab | null {
    const prefab = this.library.get(instance.prefabId)
    if (!prefab) {
      console.warn(`Prefab not found: ${instance.prefabId}`)
      return null
    }

    const voxels: ResolvedPrefab['voxels'] = []
    const entities: ResolvedPrefab['entities'] = []

    // Resolve voxels
    for (const [key, voxel] of Object.entries(prefab.voxels)) {
      const localPos = parseVoxelKey(key)

      // Rotate around prefab anchor
      const rotated = rotatePoint(localPos, instance.rotation)

      // Translate to world position
      const worldPos: VoxelCoord = {
        x: instance.position.x + rotated.x,
        y: instance.position.y + rotated.y,
        z: instance.position.z + rotated.z
      }

      voxels.push({ position: worldPos, voxel })
    }

    // Resolve entities
    for (const entity of prefab.entities) {
      // Rotate entity position
      const rotated = rotatePoint(entity.position, instance.rotation)

      // Translate to world position
      const worldPos: VoxelCoord = {
        x: instance.position.x + rotated.x,
        y: instance.position.y + rotated.y,
        z: instance.position.z + rotated.z
      }

      // Combine rotations
      const entityRotation = ((entity.rotation + instance.rotation) % 360) as 0 | 90 | 180 | 270

      // Apply any per-instance overrides
      const overrides = instance.overrides?.entities?.[entity.type]

      entities.push({
        type: entity.type,
        position: worldPos,
        rotation: overrides?.rotation ?? entityRotation,
        properties: {
          ...entity.properties,
          ...overrides?.properties
        }
      })
    }

    return { voxels, entities }
  }

  /**
   * Resolve multiple instances.
   */
  resolveAll(instances: PrefabInstance[]): ResolvedPrefab[] {
    const results: ResolvedPrefab[] = []
    for (const instance of instances) {
      const resolved = this.resolve(instance)
      if (resolved) {
        results.push(resolved)
      }
    }
    return results
  }

  /**
   * Apply resolved prefabs to a voxel world.
   */
  applyToWorld(world: VoxelWorld, instances: PrefabInstance[]): void {
    const resolved = this.resolveAll(instances)
    for (const result of resolved) {
      for (const { position, voxel } of result.voxels) {
        world.setVoxel(position.x, position.y, position.z, voxel)
      }
    }
  }

  /**
   * Check if an instance would collide with existing voxels.
   */
  checkCollision(
    world: VoxelWorld,
    instance: PrefabInstance,
    ignoreAir = true
  ): VoxelCoord[] {
    const resolved = this.resolve(instance)
    if (!resolved) return []

    const collisions: VoxelCoord[] = []

    for (const { position, voxel } of resolved.voxels) {
      const existing = world.getVoxel(position.x, position.y, position.z)
      if (existing !== 0) {  // Not air
        if (!ignoreAir || voxel !== 0) {
          collisions.push(position)
        }
      }
    }

    return collisions
  }

  /**
   * Get the world-space bounding box of an instance.
   */
  getInstanceBounds(instance: PrefabInstance): {
    min: VoxelCoord
    max: VoxelCoord
  } | null {
    const prefab = this.library.get(instance.prefabId)
    if (!prefab) return null

    const rotatedBounds = calculateRotatedBounds(prefab.bounds, instance.rotation)

    return {
      min: {
        x: instance.position.x + rotatedBounds.minX,
        y: instance.position.y + rotatedBounds.minY,
        z: instance.position.z + rotatedBounds.minZ
      },
      max: {
        x: instance.position.x + rotatedBounds.maxX,
        y: instance.position.y + rotatedBounds.maxY,
        z: instance.position.z + rotatedBounds.maxZ
      }
    }
  }

  /**
   * Preview an instance without applying to world.
   * Returns voxel positions for ghost rendering.
   */
  preview(instance: PrefabInstance): Array<{ position: VoxelCoord; voxel: Voxel }> {
    const resolved = this.resolve(instance)
    return resolved?.voxels ?? []
  }
}
