#!/usr/bin/env bun
/**
 * Pre-generates voxel mesh from layout file.
 *
 * Usage: bun tools/build-voxel-mesh.ts
 *
 * Outputs: public/galley.mesh.bin
 */

import { VoxelMapBuilder } from '../src/voxel/VoxelMapBuilder'
import { GreedyMesher } from '../src/voxel/GreedyMesher'
import { CHUNK_SIZE, VOXEL_SIZE } from '../src/voxel/VoxelTypes'
import type { ShipLayout } from '../src/types/layout'
import GALLEY_LAYOUT from '../src/content/ship/galley.layout.json'

interface MeshData {
  positions: Float32Array
  normals: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

/**
 * Build voxel world and generate merged mesh.
 */
function buildMesh(layout: ShipLayout): MeshData {
  console.log('Building voxel world...')
  console.time('buildWorld')

  const builder = new VoxelMapBuilder({
    wallThickness: 8,      // 20cm at 2.5cm voxels
    floorThickness: 8,
    ceilingThickness: 8,
    doorWidth: 48,         // 1.2m at 2.5cm voxels
    doorHeight: 88         // 2.2m at 2.5cm voxels
  })

  const result = builder.buildFromLayout(layout)
  console.timeEnd('buildWorld')

  const world = result.world
  const chunks = world.getAllChunks()
  console.log(`Created ${chunks.length} chunks`)

  // Debug: check for switch voxels and their positions
  const switchTypes = [11, 12, 13, 14] // SWITCH, SWITCH_BUTTON, LED_GREEN, LED_RED
  let switchVoxelCount = 0
  const switchPositions: string[] = []
  for (const chunk of chunks) {
    for (let lx = 0; lx < 16; lx++) {
      for (let ly = 0; ly < 16; ly++) {
        for (let lz = 0; lz < 16; lz++) {
          const voxel = chunk.get(lx, ly, lz)
          const vtype = voxel & 0xFF
          if (switchTypes.includes(vtype)) {
            switchVoxelCount++
            const wx = chunk.cx * 16 + lx
            const wy = chunk.cy * 16 + ly
            const wz = chunk.cz * 16 + lz
            if (switchPositions.length < 20) {
              switchPositions.push(`(${wx},${wy},${wz}) type=${vtype}`)
            }
          }
        }
      }
    }
  }
  console.log(`Switch voxels found: ${switchVoxelCount}`)
  console.log('Sample positions:', switchPositions.slice(0, 10).join(', '))

  // Check for specific chunks that should have switches
  const doorSwitchChunk = world.getChunk(1, 0, -1)
  const lightSwitchChunk = world.getChunk(0, 0, -2)
  console.log(`door_switch chunk (1,0,-1) exists: ${!!doorSwitchChunk}`)
  console.log(`light_switch chunk (0,0,-2) exists: ${!!lightSwitchChunk}`)

  // Check what's at the door_switch position and neighbors
  const doorSwitchVoxel = world.getVoxel(29, 13, -10) // Should be SWITCH_BUTTON
  console.log(`Voxel at door_switch button (29,13,-10): type=${doorSwitchVoxel & 0xFF}`)

  // Check neighbors of door_switch
  console.log('Door switch neighbors:')
  console.log(`  x-1 (28,13,-10): type=${world.getVoxel(28, 13, -10) & 0xFF}`)
  console.log(`  x+1 (30,13,-10): type=${world.getVoxel(30, 13, -10) & 0xFF}`)
  console.log(`  y-1 (29,12,-10): type=${world.getVoxel(29, 12, -10) & 0xFF}`)
  console.log(`  y+1 (29,14,-10): type=${world.getVoxel(29, 14, -10) & 0xFF}`)
  console.log(`  z-1 (29,13,-11): type=${world.getVoxel(29, 13, -11) & 0xFF}`)
  console.log(`  z+1 (29,13,-9): type=${world.getVoxel(29, 13, -9) & 0xFF}`)

  // Generate mesh for each chunk and merge
  console.log('Generating meshes...')
  console.time('meshGeneration')

  const mesher = new GreedyMesher(world)

  const allPositions: number[] = []
  const allNormals: number[] = []
  const allColors: number[] = []
  const allIndices: number[] = []
  let vertexOffset = 0

  for (const chunk of chunks) {
    if (chunk.isEmpty()) continue

    // Get chunk world position
    const chunkWorldX = chunk.cx * CHUNK_SIZE * VOXEL_SIZE
    const chunkWorldY = chunk.cy * CHUNK_SIZE * VOXEL_SIZE
    const chunkWorldZ = chunk.cz * CHUNK_SIZE * VOXEL_SIZE

    // Generate geometry for this chunk
    const geometry = mesher.mesh(chunk)

    // Get attributes
    const posAttr = geometry.getAttribute('position')
    const normAttr = geometry.getAttribute('normal')
    const colorAttr = geometry.getAttribute('color')
    const indexAttr = geometry.getIndex()

    if (!posAttr || !normAttr || !colorAttr || !indexAttr) continue

    // Copy positions (offset by chunk world position)
    for (let i = 0; i < posAttr.count; i++) {
      allPositions.push(
        posAttr.getX(i) + chunkWorldX,
        posAttr.getY(i) + chunkWorldY,
        posAttr.getZ(i) + chunkWorldZ
      )
    }

    // Copy normals
    for (let i = 0; i < normAttr.count; i++) {
      allNormals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i))
    }

    // Copy colors
    for (let i = 0; i < colorAttr.count; i++) {
      allColors.push(colorAttr.getX(i), colorAttr.getY(i), colorAttr.getZ(i))
    }

    // Copy indices (offset by vertex count)
    for (let i = 0; i < indexAttr.count; i++) {
      allIndices.push(indexAttr.getX(i) + vertexOffset)
    }

    vertexOffset += posAttr.count

    // Dispose geometry to free memory
    geometry.dispose()
  }

  console.timeEnd('meshGeneration')
  console.log(`Merged mesh: ${vertexOffset} vertices, ${allIndices.length / 3} triangles`)

  return {
    positions: new Float32Array(allPositions),
    normals: new Float32Array(allNormals),
    colors: new Float32Array(allColors),
    indices: new Uint32Array(allIndices)
  }
}

/**
 * Serialize mesh to binary format.
 *
 * Format:
 * - 4 bytes: magic "VMSH"
 * - 4 bytes: version (1)
 * - 4 bytes: vertex count
 * - 4 bytes: index count
 * - positions: vertexCount * 3 * 4 bytes (Float32)
 * - normals: vertexCount * 3 * 4 bytes (Float32)
 * - colors: vertexCount * 3 * 4 bytes (Float32)
 * - indices: indexCount * 4 bytes (Uint32)
 */
function serializeMesh(mesh: MeshData): ArrayBuffer {
  const vertexCount = mesh.positions.length / 3
  const indexCount = mesh.indices.length

  const headerSize = 16 // magic + version + vertexCount + indexCount
  const positionsSize = mesh.positions.byteLength
  const normalsSize = mesh.normals.byteLength
  const colorsSize = mesh.colors.byteLength
  const indicesSize = mesh.indices.byteLength

  const totalSize = headerSize + positionsSize + normalsSize + colorsSize + indicesSize
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  // Write header
  view.setUint8(0, 'V'.charCodeAt(0))
  view.setUint8(1, 'M'.charCodeAt(0))
  view.setUint8(2, 'S'.charCodeAt(0))
  view.setUint8(3, 'H'.charCodeAt(0))
  view.setUint32(4, 1, true) // version
  view.setUint32(8, vertexCount, true)
  view.setUint32(12, indexCount, true)

  // Write data
  let offset = headerSize

  new Float32Array(buffer, offset, mesh.positions.length).set(mesh.positions)
  offset += positionsSize

  new Float32Array(buffer, offset, mesh.normals.length).set(mesh.normals)
  offset += normalsSize

  new Float32Array(buffer, offset, mesh.colors.length).set(mesh.colors)
  offset += colorsSize

  new Uint32Array(buffer, offset, mesh.indices.length).set(mesh.indices)

  return buffer
}

// Main
async function main() {
  console.log('=== Voxel Mesh Builder ===\n')

  const mesh = buildMesh(GALLEY_LAYOUT as ShipLayout)

  console.log('\nSerializing...')
  const buffer = serializeMesh(mesh)

  const outputPath = './public/galley.mesh.bin'
  console.log(`Writing to ${outputPath}...`)

  await Bun.write(outputPath, buffer)

  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2)
  console.log(`Done! Output size: ${sizeMB} MB`)
}

main().catch(console.error)
