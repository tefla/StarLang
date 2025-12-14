import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { VoxelProject } from './types'

export async function exportToGLTF(project: VoxelProject): Promise<Blob> {
  const scene = new THREE.Scene()

  const { width, height, depth, voxels, palette } = project
  const offsetX = width / 2
  const offsetZ = depth / 2

  // Group voxels by color for efficient geometry
  const colorGroups = new Map<number, THREE.Vector3[]>()

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = voxels[y][z][x]
        if (colorIndex < 0) continue

        const pos = new THREE.Vector3(
          x - offsetX + 0.5,
          y + 0.5,
          z - offsetZ + 0.5
        )

        if (!colorGroups.has(colorIndex)) {
          colorGroups.set(colorIndex, [])
        }
        colorGroups.get(colorIndex)!.push(pos)
      }
    }
  }

  // Create merged geometry for each color
  for (const [colorIndex, positions] of colorGroups) {
    const color = new THREE.Color(palette[colorIndex])
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.1,
    })

    // Merge all boxes into one geometry
    const vertices: number[] = []
    const normals: number[] = []
    const indices: number[] = []

    const voxelSize = 0.95
    const tempBox = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize)
    const positionAttr = tempBox.getAttribute('position')
    const normalAttr = tempBox.getAttribute('normal')
    const indexAttr = tempBox.getIndex()!

    for (const pos of positions) {
      const vertexOffset = vertices.length / 3

      for (let i = 0; i < positionAttr.count; i++) {
        vertices.push(
          positionAttr.getX(i) + pos.x,
          positionAttr.getY(i) + pos.y,
          positionAttr.getZ(i) + pos.z
        )
        normals.push(
          normalAttr.getX(i),
          normalAttr.getY(i),
          normalAttr.getZ(i)
        )
      }

      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.getX(i) + vertexOffset)
      }
    }

    const mergedGeometry = new THREE.BufferGeometry()
    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    mergedGeometry.setIndex(indices)

    const mesh = new THREE.Mesh(mergedGeometry, material)
    mesh.name = `voxels_color_${colorIndex}`
    scene.add(mesh)

    tempBox.dispose()
  }

  // Export to glTF
  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => {
        if (gltf instanceof ArrayBuffer) {
          resolve(new Blob([gltf], { type: 'model/gltf-binary' }))
        } else {
          const json = JSON.stringify(gltf)
          resolve(new Blob([json], { type: 'model/gltf+json' }))
        }
      },
      (error) => reject(error),
      { binary: true }
    )
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
