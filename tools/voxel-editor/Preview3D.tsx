import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { VoxelProject } from './types'

interface Props {
  project: VoxelProject
}

// Check if a voxel face is visible (not occluded by neighbor)
function isFaceVisible(
  voxels: number[][][],
  x: number, y: number, z: number,
  dx: number, dy: number, dz: number,
  width: number, height: number, depth: number
): boolean {
  const nx = x + dx
  const ny = y + dy
  const nz = z + dz

  // Face is visible if neighbor is out of bounds or empty
  if (nx < 0 || nx >= width || ny < 0 || ny >= height || nz < 0 || nz >= depth) {
    return true
  }
  return voxels[ny]?.[nz]?.[nx] < 0
}

// Build optimized mesh with only visible faces
function buildOptimizedMesh(project: VoxelProject): THREE.Group {
  const group = new THREE.Group()
  const { width, height, depth, voxels, palette } = project
  const offsetX = width / 2
  const offsetZ = depth / 2

  // Group vertices by color
  const colorData = new Map<number, {
    positions: number[]
    normals: number[]
    indices: number[]
  }>()

  // Face definitions: [dx, dy, dz, normal, vertices]
  const faces = [
    { dir: [1, 0, 0], normal: [1, 0, 0], verts: [[1,0,0], [1,1,0], [1,1,1], [1,0,1]] },  // +X
    { dir: [-1, 0, 0], normal: [-1, 0, 0], verts: [[0,0,1], [0,1,1], [0,1,0], [0,0,0]] }, // -X
    { dir: [0, 1, 0], normal: [0, 1, 0], verts: [[0,1,0], [0,1,1], [1,1,1], [1,1,0]] },  // +Y
    { dir: [0, -1, 0], normal: [0, -1, 0], verts: [[0,0,1], [0,0,0], [1,0,0], [1,0,1]] }, // -Y
    { dir: [0, 0, 1], normal: [0, 0, 1], verts: [[0,0,1], [1,0,1], [1,1,1], [0,1,1]] },  // +Z
    { dir: [0, 0, -1], normal: [0, 0, -1], verts: [[1,0,0], [0,0,0], [0,1,0], [1,1,0]] }, // -Z
  ]

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = voxels[y]?.[z]?.[x]
        if (colorIndex == null || colorIndex < 0) continue

        if (!colorData.has(colorIndex)) {
          colorData.set(colorIndex, { positions: [], normals: [], indices: [] })
        }
        const data = colorData.get(colorIndex)!

        // Check each face
        for (const face of faces) {
          const [dx, dy, dz] = face.dir
          if (!isFaceVisible(voxels, x, y, z, dx, dy, dz, width, height, depth)) continue

          const baseIndex = data.positions.length / 3

          // Add 4 vertices for this face
          for (const vert of face.verts) {
            data.positions.push(
              x + vert[0] - offsetX,
              y + vert[1],
              z + vert[2] - offsetZ
            )
            data.normals.push(...face.normal)
          }

          // Add 2 triangles (6 indices)
          data.indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex, baseIndex + 2, baseIndex + 3
          )
        }
      }
    }
  }

  // Create meshes for each color
  for (const [colorIndex, data] of colorData) {
    if (data.positions.length === 0) continue

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3))
    geometry.setIndex(data.indices)

    const color = new THREE.Color(palette[colorIndex])

    // Check if this is a "screen" material (index 16 or has "screen" in name)
    const isScreen = colorIndex === 16

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: isScreen ? 0.1 : 0.8,
      metalness: isScreen ? 0.3 : 0.1,
      emissive: isScreen ? color : new THREE.Color(0x000000),
      emissiveIntensity: isScreen ? 0.3 : 0,
    })

    const mesh = new THREE.Mesh(geometry, material)
    group.add(mesh)
  }

  return group
}

export function Preview3D({ project }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    modelGroup: THREE.Group
  } | null>(null)

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let width = container.clientWidth || 400
    let height = container.clientHeight || 400

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a14)

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(20, 15, 20)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = true
    controls.autoRotateSpeed = 1.0

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 0.9)
    directional.position.set(10, 20, 10)
    scene.add(directional)

    const backLight = new THREE.DirectionalLight(0x4488ff, 0.3)
    backLight.position.set(-10, 10, -10)
    scene.add(backLight)

    // Model group placeholder
    const modelGroup = new THREE.Group()
    scene.add(modelGroup)

    sceneRef.current = { scene, camera, renderer, controls, modelGroup }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth || 400
      const h = container.clientHeight || 400
      if (w > 0 && h > 0) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    }
    window.addEventListener('resize', handleResize)
    setTimeout(handleResize, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  // Update model when project changes
  useEffect(() => {
    if (!sceneRef.current) return

    const { scene, modelGroup, controls } = sceneRef.current

    // Remove old model
    scene.remove(modelGroup)
    modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
    })

    // Build new optimized model
    const newModel = buildOptimizedMesh(project)
    sceneRef.current.modelGroup = newModel
    scene.add(newModel)

    // Center the orbit target on the model
    const centerY = project.height / 2
    controls.target.set(0, centerY, 0)

  }, [project])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 300,
      }}
    />
  )
}
