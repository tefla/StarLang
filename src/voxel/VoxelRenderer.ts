/**
 * Manages voxel chunk mesh rendering.
 *
 * Handles creating, updating, and disposing of Three.js meshes for
 * voxel chunks in the world.
 */

import * as THREE from 'three'
import { VoxelWorld } from './VoxelWorld'
import { VoxelChunk } from './VoxelChunk'
import { GreedyMesher } from './GreedyMesher'
import { CHUNK_SIZE, VOXEL_SIZE } from './VoxelTypes'

/**
 * Material configuration for voxel rendering.
 */
export interface VoxelMaterialConfig {
  roughness?: number
  metalness?: number
  flatShading?: boolean
}

/**
 * Renders voxel world chunks to Three.js scene.
 */
export class VoxelRenderer {
  private scene: THREE.Scene
  private world: VoxelWorld
  private mesher: GreedyMesher
  private chunkMeshes: Map<string, THREE.Mesh> = new Map()
  private material: THREE.Material

  /** Maximum chunks to remesh per frame */
  private maxRemeshPerFrame = 4

  /** Parent group for all voxel meshes */
  public group: THREE.Group

  constructor(scene: THREE.Scene, world: VoxelWorld, config: VoxelMaterialConfig = {}) {
    this.scene = scene
    this.world = world
    this.mesher = new GreedyMesher(world)
    this.group = new THREE.Group()
    this.group.name = 'VoxelWorld'
    this.scene.add(this.group)

    // Create shared material
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: config.roughness ?? 0.8,
      metalness: config.metalness ?? 0.2,
      flatShading: config.flatShading ?? false,  // Smooth shading to avoid visible triangle edges
      side: THREE.FrontSide  // Single-sided to avoid z-fighting
    })

    // Subscribe to chunk modifications
    this.world.onChunkModified(event => {
      // Mark chunk dirty - will be remeshed on next update
      event.chunk.dirty = true
    })
  }

  /**
   * Get chunk key for mesh map.
   */
  private getChunkKey(chunk: VoxelChunk): string {
    return `${chunk.cx},${chunk.cy},${chunk.cz}`
  }

  /**
   * Create or update mesh for a chunk.
   */
  private updateChunkMesh(chunk: VoxelChunk, debug = false): void {
    const key = this.getChunkKey(chunk)
    let mesh = this.chunkMeshes.get(key)

    if (chunk.isEmpty()) {
      // Remove empty chunk mesh
      if (mesh) {
        this.group.remove(mesh)
        mesh.geometry.dispose()
        this.chunkMeshes.delete(key)
      }
      chunk.dirty = false
      return
    }

    // Generate new geometry
    const geometry = this.mesher.mesh(chunk, debug)

    if (mesh) {
      // Update existing mesh
      mesh.geometry.dispose()
      mesh.geometry = geometry
    } else {
      // Create new mesh
      mesh = new THREE.Mesh(geometry, this.material)
      mesh.name = `Chunk_${key}`

      // Position mesh at chunk world position
      const worldX = chunk.cx * CHUNK_SIZE * VOXEL_SIZE
      const worldY = chunk.cy * CHUNK_SIZE * VOXEL_SIZE
      const worldZ = chunk.cz * CHUNK_SIZE * VOXEL_SIZE
      mesh.position.set(worldX, worldY, worldZ)

      mesh.castShadow = true
      mesh.receiveShadow = true

      this.chunkMeshes.set(key, mesh)
      this.group.add(mesh)
    }

    chunk.dirty = false
    chunk.mesh = mesh
  }

  /**
   * Update dirty chunk meshes.
   * Call this each frame or when needed.
   */
  update(): void {
    const dirtyChunks = this.world.getDirtyChunks()

    // Limit remeshing per frame for performance
    const toProcess = dirtyChunks.slice(0, this.maxRemeshPerFrame)

    for (const chunk of toProcess) {
      this.updateChunkMesh(chunk)
    }
  }

  /**
   * Force rebuild all chunk meshes.
   */
  rebuildAll(debug = false): void {
    // Mark all chunks dirty
    for (const chunk of this.world.getAllChunks()) {
      chunk.dirty = true
    }

    // Process all at once
    let first = true
    for (const chunk of this.world.getAllChunks()) {
      this.updateChunkMesh(chunk, debug && first)
      first = false
    }
  }

  /**
   * Get mesh for a chunk (for raycasting).
   */
  getChunkMesh(cx: number, cy: number, cz: number): THREE.Mesh | undefined {
    return this.chunkMeshes.get(`${cx},${cy},${cz}`)
  }

  /**
   * Get all chunk meshes (for raycasting).
   */
  getAllMeshes(): THREE.Mesh[] {
    return Array.from(this.chunkMeshes.values())
  }

  /**
   * Set maximum chunks to remesh per frame.
   */
  setMaxRemeshPerFrame(count: number): void {
    this.maxRemeshPerFrame = count
  }

  /**
   * Get statistics about the renderer.
   */
  getStats(): {
    totalChunks: number
    renderedChunks: number
    dirtyChunks: number
    totalVoxels: number
    totalVertices: number
  } {
    let totalVoxels = 0
    let totalVertices = 0

    for (const chunk of this.world.getAllChunks()) {
      totalVoxels += chunk.getVoxelCount()
    }

    for (const mesh of this.chunkMeshes.values()) {
      const posAttr = mesh.geometry.getAttribute('position')
      if (posAttr) {
        totalVertices += posAttr.count
      }
    }

    return {
      totalChunks: this.world.getAllChunks().length,
      renderedChunks: this.chunkMeshes.size,
      dirtyChunks: this.world.getDirtyChunks().length,
      totalVoxels,
      totalVertices
    }
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    for (const mesh of this.chunkMeshes.values()) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
    }
    this.chunkMeshes.clear()

    this.scene.remove(this.group)

    if (this.material instanceof THREE.Material) {
      this.material.dispose()
    }
  }
}

/**
 * Create a simple test scene with some voxels.
 */
export function createTestVoxelScene(scene: THREE.Scene): {
  world: VoxelWorld
  renderer: VoxelRenderer
} {
  const world = new VoxelWorld()

  // Create a simple room: floor, walls, ceiling
  const roomWidth = 60   // 6 meters
  const roomHeight = 30  // 3 meters
  const roomDepth = 60   // 6 meters

  // Floor
  for (let x = 0; x < roomWidth; x++) {
    for (let z = 0; z < roomDepth; z++) {
      world.setVoxel(x, 0, z, 3)  // FLOOR
    }
  }

  // Ceiling
  for (let x = 0; x < roomWidth; x++) {
    for (let z = 0; z < roomDepth; z++) {
      world.setVoxel(x, roomHeight - 1, z, 4)  // CEILING
    }
  }

  // Walls
  for (let y = 0; y < roomHeight; y++) {
    // Front and back walls (Z axis)
    for (let x = 0; x < roomWidth; x++) {
      world.setVoxel(x, y, 0, 2)  // WALL
      world.setVoxel(x, y, roomDepth - 1, 2)  // WALL
    }
    // Left and right walls (X axis)
    for (let z = 0; z < roomDepth; z++) {
      world.setVoxel(0, y, z, 2)  // WALL
      world.setVoxel(roomWidth - 1, y, z, 2)  // WALL
    }
  }

  const renderer = new VoxelRenderer(scene, world)
  renderer.rebuildAll()

  return { world, renderer }
}
