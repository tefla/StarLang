/**
 * PositionSyncSystem - Syncs Forge state to THREE.js object positions
 *
 * This bridges the gap between Forge game logic (which manipulates state)
 * and the THREE.js scene (which needs transform updates).
 *
 * Register entities with a state path, and the system will automatically
 * sync position (and optionally rotation) from VM state to THREE.js objects.
 *
 * Example:
 *   positionSync.register("ball", ballGroup, "ball.position")
 *   // Now $ball.position.x/y/z in Forge updates ballGroup.position
 */

import * as THREE from 'three'
import type { ForgeVM, VMState } from '../forge/vm'

// ============================================================================
// Types
// ============================================================================

export interface SyncedEntity {
  id: string
  object: THREE.Object3D
  positionPath: string      // e.g., "ball.position"
  rotationPath?: string     // e.g., "ball.rotation" (optional)
  scalePath?: string        // e.g., "ball.scale" (optional)
}

interface Vector3State {
  x?: number
  y?: number
  z?: number
}

// ============================================================================
// PositionSyncSystem Class
// ============================================================================

export class PositionSyncSystem {
  private vm: ForgeVM
  private entities: Map<string, SyncedEntity> = new Map()

  constructor(vm: ForgeVM) {
    this.vm = vm
  }

  /**
   * Register an entity to sync position from VM state.
   *
   * @param id Unique identifier for this entity
   * @param object The THREE.js object to sync
   * @param positionPath State path for position (e.g., "ball.position")
   * @param options Optional rotation and scale paths
   */
  register(
    id: string,
    object: THREE.Object3D,
    positionPath: string,
    options?: { rotationPath?: string; scalePath?: string }
  ): void {
    this.entities.set(id, {
      id,
      object,
      positionPath,
      rotationPath: options?.rotationPath,
      scalePath: options?.scalePath,
    })

    // Initialize state from current object position
    const pos = object.position
    this.vm.setStateValue(`${positionPath}.x`, pos.x)
    this.vm.setStateValue(`${positionPath}.y`, pos.y)
    this.vm.setStateValue(`${positionPath}.z`, pos.z)

    if (options?.rotationPath) {
      const rot = object.rotation
      this.vm.setStateValue(`${options.rotationPath}.x`, rot.x)
      this.vm.setStateValue(`${options.rotationPath}.y`, rot.y)
      this.vm.setStateValue(`${options.rotationPath}.z`, rot.z)
    }

    if (options?.scalePath) {
      const scale = object.scale
      this.vm.setStateValue(`${options.scalePath}.x`, scale.x)
      this.vm.setStateValue(`${options.scalePath}.y`, scale.y)
      this.vm.setStateValue(`${options.scalePath}.z`, scale.z)
    }
  }

  /**
   * Unregister an entity.
   */
  unregister(id: string): void {
    this.entities.delete(id)
  }

  /**
   * Get a registered entity.
   */
  getEntity(id: string): SyncedEntity | undefined {
    return this.entities.get(id)
  }

  /**
   * Get all registered entity IDs.
   */
  getEntityIds(): string[] {
    return Array.from(this.entities.keys())
  }

  /**
   * Update all synced entities from VM state.
   * Call this every frame in the game loop.
   */
  update(): void {
    const state = this.vm.getState()

    for (const entity of this.entities.values()) {
      this.syncEntity(entity, state)
    }
  }

  private syncEntity(entity: SyncedEntity, state: VMState): void {
    // Sync position
    const posState = this.getVector3FromPath(state, entity.positionPath)
    if (posState) {
      if (posState.x !== undefined) entity.object.position.x = posState.x
      if (posState.y !== undefined) entity.object.position.y = posState.y
      if (posState.z !== undefined) entity.object.position.z = posState.z
    }

    // Sync rotation (if configured)
    if (entity.rotationPath) {
      const rotState = this.getVector3FromPath(state, entity.rotationPath)
      if (rotState) {
        if (rotState.x !== undefined) entity.object.rotation.x = rotState.x
        if (rotState.y !== undefined) entity.object.rotation.y = rotState.y
        if (rotState.z !== undefined) entity.object.rotation.z = rotState.z
      }
    }

    // Sync scale (if configured)
    if (entity.scalePath) {
      const scaleState = this.getVector3FromPath(state, entity.scalePath)
      if (scaleState) {
        if (scaleState.x !== undefined) entity.object.scale.x = scaleState.x
        if (scaleState.y !== undefined) entity.object.scale.y = scaleState.y
        if (scaleState.z !== undefined) entity.object.scale.z = scaleState.z
      }
    }
  }

  private getVector3FromPath(state: VMState, path: string): Vector3State | null {
    // First try flat naming convention (e.g., "ball_x", "ball_y", "ball_z")
    // This is used by pong and other simple games
    const prefix = path.replace(/\.position$/, '').replace(/\./g, '_')
    const flatX = state[`${prefix}_x`]
    const flatY = state[`${prefix}_y`]
    const flatZ = state[`${prefix}_z`]

    if (flatX !== undefined || flatY !== undefined || flatZ !== undefined) {
      return {
        x: typeof flatX === 'number' ? flatX : undefined,
        y: typeof flatY === 'number' ? flatY : undefined,
        z: typeof flatZ === 'number' ? flatZ : undefined,
      }
    }

    // Fall back to nested object paths (e.g., state.ball.position.x)
    const parts = path.split('.')
    let current: unknown = state

    for (const part of parts) {
      if (current === null || current === undefined) return null
      if (typeof current !== 'object') return null
      current = (current as Record<string, unknown>)[part]
    }

    if (typeof current !== 'object' || current === null) return null

    const obj = current as Record<string, unknown>
    return {
      x: typeof obj['x'] === 'number' ? obj['x'] : undefined,
      y: typeof obj['y'] === 'number' ? obj['y'] : undefined,
      z: typeof obj['z'] === 'number' ? obj['z'] : undefined,
    }
  }

  /**
   * Manually set an entity's position in both VM state and THREE.js.
   */
  setPosition(id: string, x: number, y: number, z: number): void {
    const entity = this.entities.get(id)
    if (!entity) return

    // Update VM state
    this.vm.setStateValue(`${entity.positionPath}.x`, x)
    this.vm.setStateValue(`${entity.positionPath}.y`, y)
    this.vm.setStateValue(`${entity.positionPath}.z`, z)

    // Update THREE.js object
    entity.object.position.set(x, y, z)
  }

  /**
   * Get an entity's current position from VM state.
   */
  getPosition(id: string): { x: number; y: number; z: number } | null {
    const entity = this.entities.get(id)
    if (!entity) return null

    const state = this.vm.getState()
    const posState = this.getVector3FromPath(state, entity.positionPath)
    if (!posState) return null

    return {
      x: posState.x ?? 0,
      y: posState.y ?? 0,
      z: posState.z ?? 0,
    }
  }

  /**
   * Clear all registered entities.
   */
  clear(): void {
    this.entities.clear()
  }
}
