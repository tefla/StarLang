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
 * Serialized chunk data for saving to JSON (sparse format).
 */
export interface ChunkDataSparse {
  cx: number
  cy: number
  cz: number
  format: 'sparse'
  voxels: Array<[number, number]>  // [packedIndex, voxelValue]
}

/**
 * Serialized chunk data for saving to JSON (RLE format).
 * Better for chunks with large contiguous regions.
 */
export interface ChunkDataRLE {
  cx: number
  cy: number
  cz: number
  format: 'rle'
  rle: number[]  // [type, count, type, count, ...] in XZY order
}

/**
 * Union of chunk data formats.
 */
export type ChunkData = ChunkDataSparse | ChunkDataRLE

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
   * Uses sparse format for mostly-empty chunks, RLE for dense chunks.
   */
  toJSON(preferRLE = false): ChunkData {
    const totalVoxels = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE
    const density = this.voxels.size / totalVoxels

    // Use sparse format for low-density chunks (< 20%)
    if (!preferRLE && density < 0.2) {
      return this.toSparseJSON()
    }
    return this.toRLEJSON()
  }

  /**
   * Serialize to sparse format (coordinate-value pairs).
   */
  toSparseJSON(): ChunkDataSparse {
    const voxels: Array<[number, number]> = []
    for (const [packed, voxel] of this.voxels) {
      voxels.push([packed, voxel])
    }
    return {
      cx: this.cx,
      cy: this.cy,
      cz: this.cz,
      format: 'sparse',
      voxels
    }
  }

  /**
   * Serialize to RLE format (run-length encoded).
   * Iterates in XZY order for better locality.
   */
  toRLEJSON(): ChunkDataRLE {
    const rle: number[] = []
    let currentType = -1
    let runLength = 0

    // Iterate in XZY order (x fastest, then z, then y)
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const voxel = this.get(x, y, z)
          const type = getVoxelType(voxel)

          if (type === currentType) {
            runLength++
          } else {
            if (runLength > 0) {
              rle.push(currentType, runLength)
            }
            currentType = type
            runLength = 1
          }
        }
      }
    }
    // Push final run
    if (runLength > 0) {
      rle.push(currentType, runLength)
    }

    return {
      cx: this.cx,
      cy: this.cy,
      cz: this.cz,
      format: 'rle',
      rle
    }
  }

  /**
   * Load chunk data from JSON format.
   */
  static fromJSON(data: ChunkData): VoxelChunk {
    const chunk = new VoxelChunk(data.cx, data.cy, data.cz)

    if (data.format === 'rle') {
      chunk.loadFromRLE(data.rle)
    } else {
      // Sparse format (default for backward compatibility)
      const sparseData = data as ChunkDataSparse
      for (const [packed, voxel] of sparseData.voxels) {
        chunk.voxels.set(packed, voxel)
      }
    }

    chunk.dirty = true
    return chunk
  }

  /**
   * Load voxels from RLE-encoded data.
   */
  private loadFromRLE(rle: number[]): void {
    let index = 0
    for (let i = 0; i < rle.length; i += 2) {
      const type = rle[i]
      const count = rle[i + 1]

      if (type !== undefined && count !== undefined && type !== VoxelType.AIR) {
        for (let j = 0; j < count; j++) {
          const totalIndex = index + j
          const x = totalIndex % CHUNK_SIZE
          const z = Math.floor(totalIndex / CHUNK_SIZE) % CHUNK_SIZE
          const y = Math.floor(totalIndex / (CHUNK_SIZE * CHUNK_SIZE))
          if (x < CHUNK_SIZE && y < CHUNK_SIZE && z < CHUNK_SIZE) {
            this.voxels.set(this.pack(x, y, z), type as Voxel)
          }
        }
      }
      index += count ?? 0
    }
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
