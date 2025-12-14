/**
 * Greedy meshing algorithm for converting voxel chunks to optimized geometry.
 *
 * Based on the algorithm described at:
 * https://0fps.net/2012/06/30/meshing-in-a-block-world/
 *
 * The algorithm sweeps through the chunk in slices, building a 2D mask of
 * visible faces, then greedily merges adjacent faces of the same type into
 * larger quads.
 */

import * as THREE from 'three'
import {
  CHUNK_SIZE,
  VOXEL_SIZE,
  VoxelType,
  type Voxel,
  getVoxelType,
  isTransparent
} from './VoxelTypes'
import type { VoxelChunk } from './VoxelChunk'
import type { VoxelWorld } from './VoxelWorld'

/**
 * A quad to be rendered.
 */
interface Quad {
  // Position in voxel coords (corner)
  x: number
  y: number
  z: number
  // Width and height in voxels
  w: number
  h: number
  // Which axis this face is perpendicular to (0=X, 1=Y, 2=Z)
  axis: number
  // Direction along axis (-1 or +1)
  dir: number
  // Voxel type for material
  voxelType: VoxelType
}

/**
 * Color palette for voxel types - bright distinct colors for testing.
 */
const VOXEL_COLORS: Record<number, number> = {
  [VoxelType.AIR]: 0x000000,
  [VoxelType.HULL]: 0x8888aa,      // Light blue-gray
  [VoxelType.WALL]: 0x4488ff,      // Bright blue
  [VoxelType.FLOOR]: 0x44aa44,     // Bright green
  [VoxelType.CEILING]: 0xcccccc,   // Light gray
  [VoxelType.GLASS]: 0x88ddff,     // Cyan
  [VoxelType.METAL_GRATE]: 0xaaaaaa,
  [VoxelType.PANEL]: 0x8899cc,     // Blue-ish
  [VoxelType.CONDUIT]: 0x999999,
  [VoxelType.TRIM]: 0xbbbbbb,
  [VoxelType.LIGHT_FIXTURE]: 0xffffaa,
}

/**
 * Helper to get coordinate by axis index.
 */
function setCoord(arr: number[], axis: number, value: number): void {
  if (axis === 0) arr[0] = value
  else if (axis === 1) arr[1] = value
  else arr[2] = value
}

function getCoord(arr: number[], axis: number): number {
  if (axis === 0) return arr[0] ?? 0
  if (axis === 1) return arr[1] ?? 0
  return arr[2] ?? 0
}

/**
 * Generate optimized mesh geometry for a voxel chunk.
 */
export class GreedyMesher {
  private world: VoxelWorld

  constructor(world: VoxelWorld) {
    this.world = world
  }

  /**
   * Generate mesh for a chunk.
   */
  mesh(chunk: VoxelChunk, debug = false): THREE.BufferGeometry {
    const quads: Quad[] = []

    // Process each of the 3 axes
    for (let axis = 0; axis < 3; axis++) {
      // Process each direction along the axis
      for (let dir = -1; dir <= 1; dir += 2) {
        this.processAxis(chunk, axis, dir, quads)
      }
    }

    if (debug) {
      const axisNames = ['X', 'Y', 'Z']
      console.log(`Chunk ${chunk.cx},${chunk.cy},${chunk.cz}: ${quads.length} quads`)
      for (const q of quads) {
        console.log(`  ${axisNames[q.axis]}${q.dir > 0 ? '+' : '-'} at (${q.x},${q.y},${q.z}) size ${q.w}x${q.h} type=${q.voxelType}`)
      }
    }

    return this.quadsToGeometry(quads)
  }

  /**
   * Process one axis direction to find visible faces.
   */
  private processAxis(
    chunk: VoxelChunk,
    axis: number,
    dir: number,
    quads: Quad[]
  ): void {
    // Determine the two axes perpendicular to this one
    const u = (axis + 1) % 3
    const v = (axis + 2) % 3

    // Sweep through slices perpendicular to the axis
    for (let slice = 0; slice < CHUNK_SIZE; slice++) {
      // Build face mask for this slice
      const mask = this.buildFaceMask(chunk, axis, dir, slice, u, v)

      // Greedily merge faces
      this.greedyMerge(mask, quads, axis, dir, slice, u, v)
    }
  }

  /**
   * Build a 2D mask of visible faces for a slice.
   * Returns null for no face, voxel type for visible face.
   */
  private buildFaceMask(
    chunk: VoxelChunk,
    axis: number,
    dir: number,
    slice: number,
    u: number,
    v: number
  ): (VoxelType | null)[][] {
    const mask: (VoxelType | null)[][] = []

    for (let j = 0; j < CHUNK_SIZE; j++) {
      const row: (VoxelType | null)[] = []
      for (let i = 0; i < CHUNK_SIZE; i++) {
        // Get coords based on which axis we're processing
        const coords = [0, 0, 0]
        setCoord(coords, axis, slice)
        setCoord(coords, u, i)
        setCoord(coords, v, j)

        // Get voxel at this position
        const voxel = chunk.get(coords[0] ?? 0, coords[1] ?? 0, coords[2] ?? 0)
        const type = getVoxelType(voxel)

        // Get neighbor voxel in the direction we're checking
        const neighborCoords = [coords[0] ?? 0, coords[1] ?? 0, coords[2] ?? 0]
        setCoord(neighborCoords, axis, getCoord(neighborCoords, axis) + dir)

        // Get neighbor (may be in adjacent chunk)
        const neighbor = this.world.getVoxelForMeshing(
          chunk,
          neighborCoords[0] ?? 0,
          neighborCoords[1] ?? 0,
          neighborCoords[2] ?? 0
        )

        // Determine if we need a face here
        let faceType: VoxelType | null = null

        // Face is needed if current voxel is solid and neighbor is transparent
        if (!isTransparent(voxel) && isTransparent(neighbor)) {
          faceType = type
        }

        row.push(faceType)
      }
      mask.push(row)
    }

    return mask
  }

  /**
   * Greedily merge adjacent faces of the same type.
   */
  private greedyMerge(
    mask: (VoxelType | null)[][],
    quads: Quad[],
    axis: number,
    dir: number,
    slice: number,
    u: number,
    v: number
  ): void {
    for (let j = 0; j < CHUNK_SIZE; j++) {
      const row = mask[j]
      if (!row) continue

      for (let i = 0; i < CHUNK_SIZE;) {
        const faceType = row[i]

        if (faceType === null || faceType === undefined) {
          i++
          continue
        }

        // Find width - how far can we extend in the i direction?
        let w = 1
        while (i + w < CHUNK_SIZE && row[i + w] === faceType) {
          w++
        }

        // Find height - how far can we extend in the j direction?
        let h = 1
        let done = false
        while (j + h < CHUNK_SIZE && !done) {
          const nextRow = mask[j + h]
          if (!nextRow) {
            done = true
            break
          }
          // Check if entire row matches
          for (let k = 0; k < w; k++) {
            if (nextRow[i + k] !== faceType) {
              done = true
              break
            }
          }
          if (!done) h++
        }

        // Create quad
        const coords = [0, 0, 0]
        setCoord(coords, axis, slice + (dir > 0 ? 1 : 0))
        setCoord(coords, u, i)
        setCoord(coords, v, j)

        quads.push({
          x: coords[0] ?? 0,
          y: coords[1] ?? 0,
          z: coords[2] ?? 0,
          w,
          h,
          axis,
          dir,
          voxelType: faceType
        })

        // Clear merged cells from mask
        for (let dj = 0; dj < h; dj++) {
          const clearRow = mask[j + dj]
          if (clearRow) {
            for (let di = 0; di < w; di++) {
              clearRow[i + di] = null
            }
          }
        }

        i += w
      }
    }
  }

  /**
   * Convert quads to Three.js BufferGeometry.
   */
  private quadsToGeometry(quads: Quad[]): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const colors: number[] = []
    const indices: number[] = []

    let vertexIndex = 0

    for (const quad of quads) {
      const { x, y, z, w, h, axis, dir, voxelType } = quad

      // Determine the two perpendicular axes
      const u = (axis + 1) % 3
      const v = (axis + 2) % 3

      // Build corners
      const corners = this.getQuadCorners(x, y, z, w, h, axis, u, v)

      // Add vertices
      for (const corner of corners) {
        positions.push(corner[0], corner[1], corner[2])
      }

      // Normal - simple axis-aligned normal
      const nx = axis === 0 ? dir : 0
      const ny = axis === 1 ? dir : 0
      const nz = axis === 2 ? dir : 0
      for (let i = 0; i < 4; i++) {
        normals.push(nx, ny, nz)
      }

      // Color from voxel type
      const colorHex = VOXEL_COLORS[voxelType] ?? 0xff00ff
      const color = new THREE.Color(colorHex)
      for (let i = 0; i < 4; i++) {
        colors.push(color.r, color.g, color.b)
      }

      // Indices for two triangles
      if (dir > 0) {
        indices.push(
          vertexIndex, vertexIndex + 1, vertexIndex + 2,
          vertexIndex, vertexIndex + 2, vertexIndex + 3
        )
      } else {
        // Reverse winding for back faces
        indices.push(
          vertexIndex, vertexIndex + 2, vertexIndex + 1,
          vertexIndex, vertexIndex + 3, vertexIndex + 2
        )
      }

      vertexIndex += 4
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)

    return geometry
  }

  /**
   * Calculate the 4 corners of a quad.
   * x,y,z are the voxel coordinates of the quad origin
   * w,h are the width and height in voxels along u,v axes
   * axis is the face normal direction (0=X, 1=Y, 2=Z)
   * u,v are the two axes perpendicular to the face
   */
  private getQuadCorners(
    x: number, y: number, z: number,
    w: number, h: number,
    axis: number, u: number, v: number
  ): [number, number, number][] {
    const corners: [number, number, number][] = []

    // Generate 4 corners in order: (0,0), (1,0), (1,1), (0,1)
    const offsets: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]

    for (const [du, dv] of offsets) {
      // Start with the base position
      const corner: [number, number, number] = [
        x * VOXEL_SIZE,
        y * VOXEL_SIZE,
        z * VOXEL_SIZE
      ]

      // Add offset along u axis (width direction)
      // u is always 0, 1, or 2 - safe to access
      corner[u] = (corner[u] ?? 0) + du * w * VOXEL_SIZE

      // Add offset along v axis (height direction)
      // v is always 0, 1, or 2 - safe to access
      corner[v] = (corner[v] ?? 0) + dv * h * VOXEL_SIZE

      corners.push(corner)
    }

    return corners
  }
}

/**
 * Create a mesh from a chunk using greedy meshing.
 */
export function createChunkMesh(
  chunk: VoxelChunk,
  world: VoxelWorld
): THREE.Mesh {
  const mesher = new GreedyMesher(world)
  const geometry = mesher.mesh(chunk)

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geometry, material)

  // Position mesh at chunk world position
  const [wx, wy, wz] = chunk.getWorldPosition()
  mesh.position.set(wx, wy, wz)

  mesh.castShadow = true
  mesh.receiveShadow = true

  return mesh
}
