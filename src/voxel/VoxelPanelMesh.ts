/**
 * Generates a voxel-based mesh for door panels that can be animated.
 *
 * Unlike the pre-built mesh, these are created at runtime and can be
 * transformed (moved, rotated) independently.
 */

import * as THREE from 'three'
import { VoxelType, VOXEL_SIZE, getVoxelColor } from './VoxelTypes'

/**
 * Generate a voxel mesh for a rectangular panel.
 *
 * @param widthVoxels Width in voxels
 * @param heightVoxels Height in voxels
 * @param depthVoxels Depth in voxels
 * @param voxelType Type of voxel to use for coloring
 * @returns THREE.Mesh with the voxel panel geometry
 */
export function createVoxelPanelMesh(
  widthVoxels: number,
  heightVoxels: number,
  depthVoxels: number,
  voxelType: VoxelType = VoxelType.DOOR_PANEL
): THREE.Mesh {
  // For a solid rectangular panel, we can use greedy meshing to create
  // just 6 faces (one per side) instead of individual voxel faces

  const width = widthVoxels * VOXEL_SIZE
  const height = heightVoxels * VOXEL_SIZE
  const depth = depthVoxels * VOXEL_SIZE

  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const color = new THREE.Color(getVoxelColor(voxelType))
  let vertexIndex = 0

  // Helper to add a quad face
  function addFace(
    corners: [number, number, number][],
    normal: [number, number, number],
    flip: boolean
  ) {
    // Add 4 vertices
    for (const corner of corners) {
      positions.push(corner[0], corner[1], corner[2])
      normals.push(normal[0], normal[1], normal[2])
      colors.push(color.r, color.g, color.b)
    }

    // Add 2 triangles (6 indices)
    if (flip) {
      indices.push(
        vertexIndex, vertexIndex + 2, vertexIndex + 1,
        vertexIndex, vertexIndex + 3, vertexIndex + 2
      )
    } else {
      indices.push(
        vertexIndex, vertexIndex + 1, vertexIndex + 2,
        vertexIndex, vertexIndex + 2, vertexIndex + 3
      )
    }

    vertexIndex += 4
  }

  // -X face (left)
  addFace([
    [0, 0, 0],
    [0, 0, depth],
    [0, height, depth],
    [0, height, 0]
  ], [-1, 0, 0], true)

  // +X face (right)
  addFace([
    [width, 0, 0],
    [width, height, 0],
    [width, height, depth],
    [width, 0, depth]
  ], [1, 0, 0], true)

  // -Y face (bottom)
  addFace([
    [0, 0, 0],
    [width, 0, 0],
    [width, 0, depth],
    [0, 0, depth]
  ], [0, -1, 0], true)

  // +Y face (top)
  addFace([
    [0, height, 0],
    [0, height, depth],
    [width, height, depth],
    [width, height, 0]
  ], [0, 1, 0], true)

  // -Z face (front)
  addFace([
    [0, 0, 0],
    [0, height, 0],
    [width, height, 0],
    [width, 0, 0]
  ], [0, 0, -1], true)

  // +Z face (back)
  addFace([
    [0, 0, depth],
    [width, 0, depth],
    [width, height, depth],
    [0, height, depth]
  ], [0, 0, 1], true)

  // Create geometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)

  // Create material
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.6,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true

  return mesh
}

/**
 * Create a door panel pair (left and right halves).
 *
 * @param doorWidthVoxels Total door width in voxels
 * @param doorHeightVoxels Door height in voxels
 * @param panelDepthVoxels Panel thickness in voxels
 * @returns Object with left and right panel meshes
 */
export function createDoorPanels(
  doorWidthVoxels: number,
  doorHeightVoxels: number,
  panelDepthVoxels: number
): { left: THREE.Mesh; right: THREE.Mesh } {
  const halfWidth = Math.floor(doorWidthVoxels / 2)

  const left = createVoxelPanelMesh(halfWidth, doorHeightVoxels, panelDepthVoxels)
  const right = createVoxelPanelMesh(halfWidth, doorHeightVoxels, panelDepthVoxels)

  return { left, right }
}
