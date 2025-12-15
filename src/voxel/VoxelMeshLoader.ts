/**
 * Loads pre-built voxel meshes from binary format.
 *
 * This allows skipping the expensive voxel world building and
 * greedy meshing at runtime.
 */

import * as THREE from 'three'

/**
 * Load a pre-built voxel mesh from a .mesh.bin file.
 */
export async function loadVoxelMesh(url: string): Promise<THREE.Mesh> {
  console.time('loadVoxelMesh')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load voxel mesh: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const mesh = parseVoxelMesh(buffer)

  console.timeEnd('loadVoxelMesh')
  return mesh
}

/**
 * Parse the binary mesh format.
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
function parseVoxelMesh(buffer: ArrayBuffer): THREE.Mesh {
  const view = new DataView(buffer)

  // Check magic
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  )
  if (magic !== 'VMSH') {
    throw new Error(`Invalid voxel mesh file: bad magic "${magic}"`)
  }

  // Read header
  const version = view.getUint32(4, true)
  if (version !== 1) {
    throw new Error(`Unsupported voxel mesh version: ${version}`)
  }

  const vertexCount = view.getUint32(8, true)
  const indexCount = view.getUint32(12, true)

  console.log(`Loading mesh: ${vertexCount} vertices, ${indexCount / 3} triangles`)

  // Calculate offsets
  const headerSize = 16
  const positionsOffset = headerSize
  const normalsOffset = positionsOffset + vertexCount * 3 * 4
  const colorsOffset = normalsOffset + vertexCount * 3 * 4
  const indicesOffset = colorsOffset + vertexCount * 3 * 4

  // Create typed arrays from buffer
  const positions = new Float32Array(buffer, positionsOffset, vertexCount * 3)
  const normals = new Float32Array(buffer, normalsOffset, vertexCount * 3)
  const colors = new Float32Array(buffer, colorsOffset, vertexCount * 3)
  const indices = new Uint32Array(buffer, indicesOffset, indexCount)

  // Create geometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  // Compute bounding box/sphere for frustum culling
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  // Create material
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.FrontSide
  })

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'VoxelWorld'
  mesh.castShadow = true
  mesh.receiveShadow = true

  return mesh
}

/**
 * Check if a pre-built mesh exists for the given layout.
 */
export async function hasPrebuiltMesh(name: string): Promise<boolean> {
  try {
    const response = await fetch(`/${name}.mesh.bin`, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}
