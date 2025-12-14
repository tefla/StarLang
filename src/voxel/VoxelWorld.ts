/**
 * Container for the entire voxel world.
 *
 * Manages chunks and provides world-coordinate access to voxels.
 */

import {
  CHUNK_SIZE,
  VoxelType,
  type Voxel,
  type VoxelCoord,
  coordKey,
  voxelToChunk,
  voxelToLocal
} from './VoxelTypes'
import { VoxelChunk, type ChunkData } from './VoxelChunk'

/**
 * Serialized world data for saving to JSON.
 */
export interface WorldData {
  version: 2
  bounds: {
    minX: number
    minY: number
    minZ: number
    maxX: number
    maxY: number
    maxZ: number
  }
  chunks: ChunkData[]
}

/**
 * Event fired when a chunk is modified.
 */
export interface ChunkModifiedEvent {
  chunk: VoxelChunk
  cx: number
  cy: number
  cz: number
}

/**
 * The voxel world container.
 */
export class VoxelWorld {
  /** All chunks indexed by "cx,cy,cz" */
  private chunks: Map<string, VoxelChunk> = new Map()

  /** Listeners for chunk modifications */
  private listeners: Array<(event: ChunkModifiedEvent) => void> = []

  /**
   * Create a chunk key from chunk coordinates.
   */
  private chunkKey(cx: number, cy: number, cz: number): string {
    return coordKey(cx, cy, cz)
  }

  /**
   * Get chunk at chunk coordinates.
   * Returns undefined if chunk doesn't exist.
   */
  getChunk(cx: number, cy: number, cz: number): VoxelChunk | undefined {
    return this.chunks.get(this.chunkKey(cx, cy, cz))
  }

  /**
   * Get or create chunk at chunk coordinates.
   */
  getOrCreateChunk(cx: number, cy: number, cz: number): VoxelChunk {
    const key = this.chunkKey(cx, cy, cz)
    let chunk = this.chunks.get(key)
    if (!chunk) {
      chunk = new VoxelChunk(cx, cy, cz)
      this.chunks.set(key, chunk)
    }
    return chunk
  }

  /**
   * Get voxel at world voxel coordinates.
   * Returns AIR if no chunk exists at that position.
   */
  getVoxel(vx: number, vy: number, vz: number): Voxel {
    const { x: cx, y: cy, z: cz } = voxelToChunk(vx, vy, vz)
    const chunk = this.chunks.get(this.chunkKey(cx, cy, cz))
    if (!chunk) return VoxelType.AIR

    const { x: lx, y: ly, z: lz } = voxelToLocal(vx, vy, vz)
    return chunk.get(lx, ly, lz)
  }

  /**
   * Set voxel at world voxel coordinates.
   * Creates chunk if it doesn't exist.
   */
  setVoxel(vx: number, vy: number, vz: number, voxel: Voxel): void {
    const { x: cx, y: cy, z: cz } = voxelToChunk(vx, vy, vz)
    const chunk = this.getOrCreateChunk(cx, cy, cz)

    const { x: lx, y: ly, z: lz } = voxelToLocal(vx, vy, vz)
    chunk.set(lx, ly, lz, voxel)

    // Notify listeners
    this.notifyChunkModified(chunk)

    // Mark neighboring chunks as dirty if we're on the edge
    this.markNeighborsDirtyIfEdge(lx, ly, lz, cx, cy, cz)
  }

  /**
   * Mark neighboring chunks dirty if the modified voxel is on a chunk edge.
   * This ensures seamless meshing between chunks.
   */
  private markNeighborsDirtyIfEdge(
    lx: number, ly: number, lz: number,
    cx: number, cy: number, cz: number
  ): void {
    if (lx === 0) this.markChunkDirty(cx - 1, cy, cz)
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cy, cz)
    if (ly === 0) this.markChunkDirty(cx, cy - 1, cz)
    if (ly === CHUNK_SIZE - 1) this.markChunkDirty(cx, cy + 1, cz)
    if (lz === 0) this.markChunkDirty(cx, cy, cz - 1)
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cy, cz + 1)
  }

  /**
   * Mark a chunk as dirty if it exists.
   */
  private markChunkDirty(cx: number, cy: number, cz: number): void {
    const chunk = this.chunks.get(this.chunkKey(cx, cy, cz))
    if (chunk) {
      chunk.dirty = true
      this.notifyChunkModified(chunk)
    }
  }

  /**
   * Fill a box region with a voxel type.
   */
  fillBox(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    voxel: Voxel
  ): void {
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          this.setVoxel(x, y, z, voxel)
        }
      }
    }
  }

  /**
   * Get all chunks.
   */
  getAllChunks(): VoxelChunk[] {
    return Array.from(this.chunks.values())
  }

  /**
   * Get all dirty chunks that need remeshing.
   */
  getDirtyChunks(): VoxelChunk[] {
    return Array.from(this.chunks.values()).filter(c => c.dirty)
  }

  /**
   * Get non-empty chunks.
   */
  getNonEmptyChunks(): VoxelChunk[] {
    return Array.from(this.chunks.values()).filter(c => !c.isEmpty())
  }

  /**
   * Calculate world bounds in voxel coordinates.
   */
  getBounds(): { minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number } | null {
    if (this.chunks.size === 0) return null

    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    for (const chunk of this.chunks.values()) {
      const baseX = chunk.cx * CHUNK_SIZE
      const baseY = chunk.cy * CHUNK_SIZE
      const baseZ = chunk.cz * CHUNK_SIZE

      minX = Math.min(minX, baseX)
      minY = Math.min(minY, baseY)
      minZ = Math.min(minZ, baseZ)
      maxX = Math.max(maxX, baseX + CHUNK_SIZE - 1)
      maxY = Math.max(maxY, baseY + CHUNK_SIZE - 1)
      maxZ = Math.max(maxZ, baseZ + CHUNK_SIZE - 1)
    }

    return { minX, minY, minZ, maxX, maxY, maxZ }
  }

  /**
   * Get voxel at position, including neighbor chunk lookup.
   * Used for seamless meshing across chunk boundaries.
   */
  getVoxelForMeshing(
    chunk: VoxelChunk,
    lx: number, ly: number, lz: number
  ): Voxel {
    // If within chunk bounds, get from chunk
    if (lx >= 0 && lx < CHUNK_SIZE &&
        ly >= 0 && ly < CHUNK_SIZE &&
        lz >= 0 && lz < CHUNK_SIZE) {
      return chunk.get(lx, ly, lz)
    }

    // Otherwise, calculate world coords and look up in world
    const vx = chunk.cx * CHUNK_SIZE + lx
    const vy = chunk.cy * CHUNK_SIZE + ly
    const vz = chunk.cz * CHUNK_SIZE + lz
    return this.getVoxel(vx, vy, vz)
  }

  /**
   * Subscribe to chunk modification events.
   */
  onChunkModified(listener: (event: ChunkModifiedEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify listeners of chunk modification.
   */
  private notifyChunkModified(chunk: VoxelChunk): void {
    const event: ChunkModifiedEvent = {
      chunk,
      cx: chunk.cx,
      cy: chunk.cy,
      cz: chunk.cz
    }
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  /**
   * Remove empty chunks to save memory.
   */
  pruneEmptyChunks(): number {
    let removed = 0
    for (const [key, chunk] of this.chunks) {
      if (chunk.isEmpty()) {
        if (chunk.mesh) {
          // Mesh cleanup should be handled by renderer
        }
        this.chunks.delete(key)
        removed++
      }
    }
    return removed
  }

  /**
   * Clear the entire world.
   */
  clear(): void {
    this.chunks.clear()
  }

  /**
   * Serialize world to JSON format.
   */
  toJSON(): WorldData {
    const bounds = this.getBounds() ?? {
      minX: 0, minY: 0, minZ: 0,
      maxX: 0, maxY: 0, maxZ: 0
    }

    const chunks: ChunkData[] = []
    for (const chunk of this.chunks.values()) {
      if (!chunk.isEmpty()) {
        chunks.push(chunk.toJSON())
      }
    }

    return {
      version: 2,
      bounds,
      chunks
    }
  }

  /**
   * Load world from JSON format.
   */
  static fromJSON(data: WorldData): VoxelWorld {
    const world = new VoxelWorld()
    for (const chunkData of data.chunks) {
      const chunk = VoxelChunk.fromJSON(chunkData)
      world.chunks.set(world.chunkKey(chunk.cx, chunk.cy, chunk.cz), chunk)
    }
    return world
  }
}
