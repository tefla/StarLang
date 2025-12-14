/**
 * Sparse storage for a 16x16x16 voxel chunk.
 *
 * Uses a Map for sparse storage - only non-air voxels are stored.
 * This is efficient for spaceship interiors which are mostly air.
 */

import {
  CHUNK_SIZE,
  VoxelType,
  type Voxel,
  type VoxelCoord,
  getVoxelType
} from './VoxelTypes'

/**
 * Serialized chunk data for saving to JSON.
 */
export interface ChunkData {
  cx: number
  cy: number
  cz: number
  // Run-length encoded: [voxel, count, voxel, count, ...]
  // For sparse data, we use coordinate-value pairs instead
  voxels: Array<[number, number]>  // [packedIndex, voxelValue]
}

/**
 * A 16x16x16 chunk of voxels with sparse storage.
 */
export class VoxelChunk {
  /** Sparse voxel storage: packedIndex -> Voxel */
  private voxels: Map<number, Voxel> = new Map()

  /** Chunk position in chunk coordinates */
  public readonly cx: number
  public readonly cy: number
  public readonly cz: number

  /** Dirty flag - set when chunk needs remeshing */
  public dirty = true

  /** Cached mesh (managed by renderer) */
  public mesh: THREE.Mesh | null = null

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx
    this.cy = cy
    this.cz = cz
  }

  /**
   * Pack local coordinates (0-15) into a single number.
   */
  private pack(lx: number, ly: number, lz: number): number {
    return lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE
  }

  /**
   * Unpack a packed index back to local coordinates.
   */
  private unpack(index: number): VoxelCoord {
    const x = index % CHUNK_SIZE
    const y = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE
    const z = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE))
    return { x, y, z }
  }

  /**
   * Get voxel at local coordinates (0-15 for each axis).
   * Returns AIR if no voxel is stored.
   */
  get(lx: number, ly: number, lz: number): Voxel {
    return this.voxels.get(this.pack(lx, ly, lz)) ?? VoxelType.AIR
  }

  /**
   * Set voxel at local coordinates.
   * Setting to AIR removes the voxel from storage.
   */
  set(lx: number, ly: number, lz: number, voxel: Voxel): void {
    const key = this.pack(lx, ly, lz)
    const type = getVoxelType(voxel)

    if (type === VoxelType.AIR) {
      this.voxels.delete(key)
    } else {
      this.voxels.set(key, voxel)
    }

    this.dirty = true
  }

  /**
   * Check if chunk has any non-air voxels.
   */
  isEmpty(): boolean {
    return this.voxels.size === 0
  }

  /**
   * Get the number of non-air voxels.
   */
  getVoxelCount(): number {
    return this.voxels.size
  }

  /**
   * Iterate over all non-air voxels.
   */
  *entries(): IterableIterator<[VoxelCoord, Voxel]> {
    for (const [packed, voxel] of this.voxels) {
      yield [this.unpack(packed), voxel]
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
          if (x >= 0 && x < CHUNK_SIZE &&
              y >= 0 && y < CHUNK_SIZE &&
              z >= 0 && z < CHUNK_SIZE) {
            this.set(x, y, z, voxel)
          }
        }
      }
    }
  }

  /**
   * Clear all voxels in the chunk.
   */
  clear(): void {
    this.voxels.clear()
    this.dirty = true
  }

  /**
   * Convert to world coordinates for the minimum corner.
   */
  getWorldPosition(): [number, number, number] {
    const VOXEL_SIZE = 0.1
    return [
      this.cx * CHUNK_SIZE * VOXEL_SIZE,
      this.cy * CHUNK_SIZE * VOXEL_SIZE,
      this.cz * CHUNK_SIZE * VOXEL_SIZE
    ]
  }

  /**
   * Serialize chunk to JSON-compatible format.
   */
  toJSON(): ChunkData {
    const voxels: Array<[number, number]> = []
    for (const [packed, voxel] of this.voxels) {
      voxels.push([packed, voxel])
    }
    return {
      cx: this.cx,
      cy: this.cy,
      cz: this.cz,
      voxels
    }
  }

  /**
   * Load chunk data from JSON format.
   */
  static fromJSON(data: ChunkData): VoxelChunk {
    const chunk = new VoxelChunk(data.cx, data.cy, data.cz)
    for (const [packed, voxel] of data.voxels) {
      chunk.voxels.set(packed, voxel)
    }
    chunk.dirty = true
    return chunk
  }

  /**
   * Create a copy of this chunk.
   */
  clone(): VoxelChunk {
    const copy = new VoxelChunk(this.cx, this.cy, this.cz)
    for (const [key, value] of this.voxels) {
      copy.voxels.set(key, value)
    }
    copy.dirty = true
    return copy
  }
}

// TypeScript needs this declaration for THREE.Mesh type
declare global {
  namespace THREE {
    interface Mesh {}
  }
}
