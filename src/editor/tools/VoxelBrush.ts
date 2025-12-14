/**
 * Voxel brush tool for placing and removing voxels.
 *
 * Supports multiple brush modes:
 * - Single: Place/remove one voxel at a time
 * - Line: Draw a line of voxels
 * - Box: Fill a box region
 * - Fill: Flood fill enclosed areas
 */

import * as THREE from 'three'
import {
  type VoxelCoord,
  type Voxel,
  VoxelType,
  makeVoxel,
  getVoxelType
} from '../../voxel/VoxelTypes'
import type { VoxelWorld } from '../../voxel/VoxelWorld'
import { VoxelRaycast, type VoxelHit, bresenhamLine3D } from '../../voxel/VoxelRaycast'
import type { EditorStore, EditorAction } from '../EditorState'
import { BrushMode } from '../EditorState'

/**
 * Result of a brush stroke.
 */
export interface BrushStrokeResult {
  /** Voxels that were changed */
  changes: Array<{ coord: VoxelCoord, before: Voxel, after: Voxel }>
  /** Whether the stroke was successful */
  success: boolean
}

/**
 * Voxel brush tool.
 */
export class VoxelBrush {
  private world: VoxelWorld
  private raycast: VoxelRaycast
  private store: EditorStore

  /** Stroke start position (for line/box modes) */
  private strokeStart: VoxelCoord | null = null

  /** Current mouse position for preview */
  private currentHit: VoxelHit | null = null

  /** Accumulated changes during a stroke */
  private strokeChanges: Array<{ coord: VoxelCoord, before: Voxel, after: Voxel }> = []

  /** Ghost mesh for preview */
  public ghostMesh: THREE.Mesh | null = null

  constructor(world: VoxelWorld, store: EditorStore) {
    this.world = world
    this.raycast = new VoxelRaycast(world)
    this.store = store

    // Create ghost mesh for preview
    this.createGhostMesh()
  }

  /**
   * Create the ghost preview mesh.
   */
  private createGhostMesh(): void {
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)  // VOXEL_SIZE
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      opacity: 0.5,
      transparent: true,
      depthTest: true,
      depthWrite: false
    })
    this.ghostMesh = new THREE.Mesh(geometry, material)
    this.ghostMesh.visible = false
  }

  /**
   * Update ghost position based on raycast hit.
   */
  updateGhost(hit: VoxelHit | null, isErasing: boolean): void {
    this.currentHit = hit

    if (!hit || !this.ghostMesh) {
      if (this.ghostMesh) {
        this.ghostMesh.visible = false
      }
      this.store.dispatch({
        type: 'SET_GHOST',
        ghost: { visible: false, position: null, valid: false }
      })
      return
    }

    // For placing, show ghost adjacent to hit face
    // For erasing, show ghost at hit voxel
    const targetCoord = isErasing
      ? hit.voxelCoord
      : this.getAdjacentCoord(hit)

    // Position ghost at voxel center
    const VOXEL_SIZE = 0.1
    this.ghostMesh.position.set(
      targetCoord.x * VOXEL_SIZE + VOXEL_SIZE / 2,
      targetCoord.y * VOXEL_SIZE + VOXEL_SIZE / 2,
      targetCoord.z * VOXEL_SIZE + VOXEL_SIZE / 2
    )

    // Update ghost color based on action
    const material = this.ghostMesh.material as THREE.MeshBasicMaterial
    material.color.setHex(isErasing ? 0xff0000 : 0x00ff00)

    this.ghostMesh.visible = true

    this.store.dispatch({
      type: 'SET_GHOST',
      ghost: {
        visible: true,
        position: targetCoord,
        valid: true
      }
    })
  }

  /**
   * Get voxel coordinate adjacent to a hit face.
   */
  private getAdjacentCoord(hit: VoxelHit): VoxelCoord {
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
   * Start a brush stroke.
   */
  startStroke(hit: VoxelHit | null, isErasing: boolean): void {
    if (!hit) return

    const state = this.store.getState()
    this.strokeChanges = []

    if (isErasing) {
      this.strokeStart = hit.voxelCoord
    } else {
      this.strokeStart = this.getAdjacentCoord(hit)
    }

    // For single mode, apply immediately
    if (state.brushMode === BrushMode.SINGLE) {
      this.applyAtPosition(this.strokeStart, isErasing)
    }
  }

  /**
   * Continue a brush stroke (for drag operations).
   */
  continueStroke(hit: VoxelHit | null, isErasing: boolean): void {
    if (!hit || !this.strokeStart) return

    const state = this.store.getState()
    const currentPos = isErasing ? hit.voxelCoord : this.getAdjacentCoord(hit)

    if (state.brushMode === BrushMode.SINGLE) {
      // In single mode, apply at each position during drag
      this.applyAtPosition(currentPos, isErasing)
    }
    // For LINE and BOX modes, we just update the preview
    // Actual application happens in endStroke
  }

  /**
   * End a brush stroke.
   */
  endStroke(hit: VoxelHit | null, isErasing: boolean): EditorAction | null {
    if (!this.strokeStart) return null

    const state = this.store.getState()
    const endPos = hit
      ? (isErasing ? hit.voxelCoord : this.getAdjacentCoord(hit))
      : this.strokeStart

    if (state.brushMode === BrushMode.LINE) {
      // Apply along line from start to end
      const coords = bresenhamLine3D(this.strokeStart, endPos)
      for (const coord of coords) {
        this.applyAtPosition(coord, isErasing)
      }
    } else if (state.brushMode === BrushMode.BOX) {
      // Apply in box from start to end
      const minX = Math.min(this.strokeStart.x, endPos.x)
      const maxX = Math.max(this.strokeStart.x, endPos.x)
      const minY = Math.min(this.strokeStart.y, endPos.y)
      const maxY = Math.max(this.strokeStart.y, endPos.y)
      const minZ = Math.min(this.strokeStart.z, endPos.z)
      const maxZ = Math.max(this.strokeStart.z, endPos.z)

      for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            this.applyAtPosition({ x, y, z }, isErasing)
          }
        }
      }
    } else if (state.brushMode === BrushMode.FILL) {
      // Flood fill from start position
      this.floodFill(this.strokeStart, isErasing)
    }

    this.strokeStart = null

    // Create undo action if we made changes
    if (this.strokeChanges.length > 0) {
      const action: EditorAction = {
        type: 'SET_VOXELS',
        voxels: [...this.strokeChanges]
      }
      this.strokeChanges = []
      return action
    }

    return null
  }

  /**
   * Cancel current stroke.
   */
  cancelStroke(): void {
    // Revert any changes made during stroke
    for (const change of this.strokeChanges) {
      this.world.setVoxel(change.coord.x, change.coord.y, change.coord.z, change.before)
    }
    this.strokeChanges = []
    this.strokeStart = null
  }

  /**
   * Apply brush at a single position.
   */
  private applyAtPosition(coord: VoxelCoord, isErasing: boolean): void {
    const state = this.store.getState()
    const before = this.world.getVoxel(coord.x, coord.y, coord.z)

    let after: Voxel
    if (isErasing) {
      after = VoxelType.AIR
    } else {
      after = makeVoxel(state.selectedVoxelType, state.selectedVariant)
    }

    // Skip if no change
    if (before === after) return

    // Apply change
    this.world.setVoxel(coord.x, coord.y, coord.z, after)

    // Record change
    this.strokeChanges.push({ coord, before, after })
  }

  /**
   * Flood fill from a position.
   */
  private floodFill(start: VoxelCoord, isErasing: boolean): void {
    const state = this.store.getState()
    const targetVoxel = this.world.getVoxel(start.x, start.y, start.z)
    const targetType = getVoxelType(targetVoxel)

    // If erasing, fill air with selected type
    // If placing, replace target type with selected type
    const fillWith = isErasing
      ? VoxelType.AIR
      : makeVoxel(state.selectedVoxelType, state.selectedVariant)

    // Don't fill if already the target type
    if (targetVoxel === fillWith) return

    // BFS flood fill
    const queue: VoxelCoord[] = [start]
    const visited = new Set<string>()
    const key = (c: VoxelCoord) => `${c.x},${c.y},${c.z}`

    // Limit fill to prevent runaway
    const maxFill = 10000
    let filled = 0

    while (queue.length > 0 && filled < maxFill) {
      const coord = queue.shift()!
      const coordKey = key(coord)

      if (visited.has(coordKey)) continue
      visited.add(coordKey)

      const voxel = this.world.getVoxel(coord.x, coord.y, coord.z)
      const voxelType = getVoxelType(voxel)

      // Only fill matching voxels
      if (voxelType !== targetType) continue

      // Apply fill
      this.applyAtPosition(coord, isErasing)
      filled++

      // Add neighbors
      const neighbors = [
        { x: coord.x + 1, y: coord.y, z: coord.z },
        { x: coord.x - 1, y: coord.y, z: coord.z },
        { x: coord.x, y: coord.y + 1, z: coord.z },
        { x: coord.x, y: coord.y - 1, z: coord.z },
        { x: coord.x, y: coord.y, z: coord.z + 1 },
        { x: coord.x, y: coord.y, z: coord.z - 1 }
      ]

      for (const neighbor of neighbors) {
        if (!visited.has(key(neighbor))) {
          queue.push(neighbor)
        }
      }
    }
  }

  /**
   * Get preview coordinates for current brush mode.
   * Used for rendering preview geometry.
   */
  getPreviewCoords(): VoxelCoord[] {
    if (!this.strokeStart || !this.currentHit) return []

    const state = this.store.getState()
    const endPos = this.getAdjacentCoord(this.currentHit)

    if (state.brushMode === BrushMode.LINE) {
      return bresenhamLine3D(this.strokeStart, endPos)
    } else if (state.brushMode === BrushMode.BOX) {
      const coords: VoxelCoord[] = []
      const minX = Math.min(this.strokeStart.x, endPos.x)
      const maxX = Math.max(this.strokeStart.x, endPos.x)
      const minY = Math.min(this.strokeStart.y, endPos.y)
      const maxY = Math.max(this.strokeStart.y, endPos.y)
      const minZ = Math.min(this.strokeStart.z, endPos.z)
      const maxZ = Math.max(this.strokeStart.z, endPos.z)

      for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            coords.push({ x, y, z })
          }
        }
      }
      return coords
    }

    return [this.strokeStart]
  }

  /**
   * Apply an undo action (reverse the changes).
   */
  applyUndo(action: EditorAction): void {
    if (action.type !== 'SET_VOXELS') return

    for (const change of action.voxels) {
      this.world.setVoxel(
        change.coord.x,
        change.coord.y,
        change.coord.z,
        change.before
      )
    }
  }

  /**
   * Apply a redo action (reapply the changes).
   */
  applyRedo(action: EditorAction): void {
    if (action.type !== 'SET_VOXELS') return

    for (const change of action.voxels) {
      this.world.setVoxel(
        change.coord.x,
        change.coord.y,
        change.coord.z,
        change.after
      )
    }
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    if (this.ghostMesh) {
      this.ghostMesh.geometry.dispose()
      ;(this.ghostMesh.material as THREE.Material).dispose()
    }
  }
}
