import React, { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { VoxelProject, Tool } from './types'

interface Props {
  project: VoxelProject
  selectedColor: number
  tool: Tool
  currentLayer: number
  showAllLayers: boolean
  showGrid: boolean
  onionSkinning: boolean
  onionLayers: number  // how many layers below to show
  onVoxelChange: (x: number, y: number, z: number, color: number) => void
  onColorPick: (color: number) => void
}

export function VoxelEditor3D({
  project,
  selectedColor,
  tool,
  currentLayer,
  showAllLayers,
  showGrid,
  onionSkinning,
  onionLayers,
  onVoxelChange,
  onColorPick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    voxelGroup: THREE.Group
    gridGroup: THREE.Group
    ghostVoxel: THREE.Mesh
    raycaster: THREE.Raycaster
    mouse: THREE.Vector2
  } | null>(null)

  const projectRef = useRef(project)
  const toolRef = useRef(tool)
  const selectedColorRef = useRef(selectedColor)
  const currentLayerRef = useRef(currentLayer)
  const showAllLayersRef = useRef(showAllLayers)

  // Keep refs in sync
  useEffect(() => { projectRef.current = project }, [project])
  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { selectedColorRef.current = selectedColor }, [selectedColor])
  useEffect(() => { currentLayerRef.current = currentLayer }, [currentLayer])
  useEffect(() => { showAllLayersRef.current = showAllLayers }, [showAllLayers])

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let width = container.clientWidth || 800
    let height = container.clientHeight || 600

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d0d1a)

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(25, 20, 25)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 8, 0)

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(10, 20, 10)
    scene.add(directional)

    const backLight = new THREE.DirectionalLight(0x4488ff, 0.3)
    backLight.position.set(-10, 10, -10)
    scene.add(backLight)

    // Voxel group
    const voxelGroup = new THREE.Group()
    scene.add(voxelGroup)

    // Grid group
    const gridGroup = new THREE.Group()
    scene.add(gridGroup)

    // Ghost voxel (preview of where voxel will be placed)
    const ghostGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.98)
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      wireframe: false,
    })
    const ghostVoxel = new THREE.Mesh(ghostGeometry, ghostMaterial)
    ghostVoxel.visible = false
    scene.add(ghostVoxel)

    // Raycaster
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    sceneRef.current = {
      scene, camera, renderer, controls,
      voxelGroup, gridGroup, ghostVoxel,
      raycaster, mouse
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth || 800
      const h = container.clientHeight || 600
      if (w > 0 && h > 0) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    }
    window.addEventListener('resize', handleResize)

    // Initial resize after a short delay to ensure layout is computed
    setTimeout(handleResize, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  // Update grid
  useEffect(() => {
    if (!sceneRef.current) return
    const { gridGroup } = sceneRef.current

    // Clear existing grid
    while (gridGroup.children.length > 0) {
      const child = gridGroup.children[0]
      gridGroup.remove(child)
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
      }
    }

    if (!showGrid) return

    const { width, depth } = project
    const offsetX = width / 2
    const offsetZ = depth / 2
    const y = currentLayer

    // Create grid lines for current layer
    const material = new THREE.LineBasicMaterial({ color: 0x333333 })

    // X lines
    for (let z = 0; z <= depth; z++) {
      const points = [
        new THREE.Vector3(-offsetX, y, z - offsetZ),
        new THREE.Vector3(width - offsetX, y, z - offsetZ),
      ]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, material)
      gridGroup.add(line)
    }

    // Z lines
    for (let x = 0; x <= width; x++) {
      const points = [
        new THREE.Vector3(x - offsetX, y, -offsetZ),
        new THREE.Vector3(x - offsetX, y, depth - offsetZ),
      ]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, material)
      gridGroup.add(line)
    }

    // Highlight current layer plane
    const planeGeometry = new THREE.PlaneGeometry(width, depth)
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    })
    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.rotation.x = -Math.PI / 2
    plane.position.set(0, y, 0)
    gridGroup.add(plane)

  }, [project.width, project.depth, currentLayer, showGrid])

  // Update voxels
  useEffect(() => {
    if (!sceneRef.current) return
    const { voxelGroup } = sceneRef.current

    // Clear existing voxels
    while (voxelGroup.children.length > 0) {
      const child = voxelGroup.children[0]
      voxelGroup.remove(child)
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (child.material instanceof THREE.Material) {
          child.material.dispose()
        }
      }
    }

    const { width, height, depth, voxels, palette } = project
    const offsetX = width / 2
    const offsetZ = depth / 2

    for (let y = 0; y < height; y++) {
      // Determine if this layer should be shown and its opacity
      let layerOpacity = 1.0
      let shouldShow = false

      if (y === currentLayer) {
        // Current layer always shown at full opacity
        shouldShow = true
        layerOpacity = 1.0
      } else if (showAllLayers) {
        // Show all layers mode
        shouldShow = true
        layerOpacity = 0.3
      } else if (onionSkinning && y < currentLayer && y >= currentLayer - onionLayers) {
        // Onion skinning: show layers below with fading opacity
        shouldShow = true
        const distance = currentLayer - y
        layerOpacity = 0.5 - (distance - 1) * 0.15  // 0.5, 0.35, 0.2 for layers below
        layerOpacity = Math.max(0.1, layerOpacity)
      }

      if (!shouldShow) continue

      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const colorIndex = voxels[y][z][x]
          if (colorIndex < 0) continue

          const color = new THREE.Color(palette[colorIndex])
          const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95)
          const material = new THREE.MeshLambertMaterial({
            color,
            transparent: layerOpacity < 1,
            opacity: layerOpacity,
          })
          const voxel = new THREE.Mesh(geometry, material)

          voxel.position.set(
            x - offsetX + 0.5,
            y + 0.5,
            z - offsetZ + 0.5
          )

          // Store voxel coordinates for raycasting
          voxel.userData = { voxelX: x, voxelY: y, voxelZ: z, colorIndex }

          voxelGroup.add(voxel)
        }
      }
    }
  }, [project, currentLayer, showAllLayers, onionSkinning, onionLayers])

  // Mouse interaction
  const getIntersection = useCallback((e: React.MouseEvent) => {
    if (!sceneRef.current || !containerRef.current) return null

    const { raycaster, mouse, camera, voxelGroup, gridGroup } = sceneRef.current
    const rect = containerRef.current.getBoundingClientRect()

    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)

    // Check voxel intersections first
    const voxelIntersects = raycaster.intersectObjects(voxelGroup.children)
    if (voxelIntersects.length > 0) {
      const hit = voxelIntersects[0]
      const voxel = hit.object as THREE.Mesh
      const { voxelX, voxelY, voxelZ, colorIndex } = voxel.userData

      // Calculate which face was hit for placing adjacent voxel
      const normal = hit.face?.normal
      if (normal) {
        const worldNormal = normal.clone().transformDirection(voxel.matrixWorld)
        return {
          type: 'voxel' as const,
          x: voxelX,
          y: voxelY,
          z: voxelZ,
          colorIndex,
          adjacentX: voxelX + Math.round(worldNormal.x),
          adjacentY: voxelY + Math.round(worldNormal.y),
          adjacentZ: voxelZ + Math.round(worldNormal.z),
        }
      }
    }

    // Check grid plane intersection for placing on empty space
    const gridIntersects = raycaster.intersectObjects(gridGroup.children)
    for (const hit of gridIntersects) {
      if (hit.object instanceof THREE.Mesh) {
        const { width, depth } = projectRef.current
        const offsetX = width / 2
        const offsetZ = depth / 2

        const x = Math.floor(hit.point.x + offsetX)
        const z = Math.floor(hit.point.z + offsetZ)
        const y = currentLayerRef.current

        if (x >= 0 && x < width && z >= 0 && z < depth) {
          return {
            type: 'grid' as const,
            x,
            y,
            z,
            adjacentX: x,
            adjacentY: y,
            adjacentZ: z,
          }
        }
      }
    }

    return null
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!sceneRef.current) return
    const { ghostVoxel } = sceneRef.current

    const intersection = getIntersection(e)
    if (!intersection) {
      ghostVoxel.visible = false
      return
    }

    const { width, height, depth } = projectRef.current
    const offsetX = width / 2
    const offsetZ = depth / 2

    let targetX: number, targetY: number, targetZ: number

    if (toolRef.current === 'place') {
      if (intersection.type === 'voxel') {
        targetX = intersection.adjacentX
        targetY = intersection.adjacentY
        targetZ = intersection.adjacentZ
      } else {
        targetX = intersection.x
        targetY = intersection.y
        targetZ = intersection.z
      }

      // Bounds check
      if (targetX < 0 || targetX >= width ||
          targetY < 0 || targetY >= height ||
          targetZ < 0 || targetZ >= depth) {
        ghostVoxel.visible = false
        return
      }

      ghostVoxel.position.set(
        targetX - offsetX + 0.5,
        targetY + 0.5,
        targetZ - offsetZ + 0.5
      );
      (ghostVoxel.material as THREE.MeshBasicMaterial).color.set(
        projectRef.current.palette[selectedColorRef.current]
      )
      ghostVoxel.visible = true
    } else if (toolRef.current === 'erase' && intersection.type === 'voxel') {
      ghostVoxel.position.set(
        intersection.x - offsetX + 0.5,
        intersection.y + 0.5,
        intersection.z - offsetZ + 0.5
      );
      (ghostVoxel.material as THREE.MeshBasicMaterial).color.set(0xff0000)
      ghostVoxel.visible = true
    } else {
      ghostVoxel.visible = false
    }
  }, [getIntersection])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const intersection = getIntersection(e)
    if (!intersection) return

    const { width, height, depth } = projectRef.current

    if (toolRef.current === 'place') {
      let targetX: number, targetY: number, targetZ: number

      if (intersection.type === 'voxel') {
        targetX = intersection.adjacentX
        targetY = intersection.adjacentY
        targetZ = intersection.adjacentZ
      } else {
        targetX = intersection.x
        targetY = intersection.y
        targetZ = intersection.z
      }

      // Bounds check
      if (targetX >= 0 && targetX < width &&
          targetY >= 0 && targetY < height &&
          targetZ >= 0 && targetZ < depth) {
        onVoxelChange(targetX, targetY, targetZ, selectedColorRef.current)
      }
    } else if (toolRef.current === 'erase' && intersection.type === 'voxel') {
      onVoxelChange(intersection.x, intersection.y, intersection.z, -1)
    } else if (toolRef.current === 'pick' && intersection.type === 'voxel') {
      onColorPick(intersection.colorIndex)
    }
  }, [getIntersection, onVoxelChange, onColorPick])

  const handleMouseLeave = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.ghostVoxel.visible = false
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        minWidth: 400,
        minHeight: 400,
        cursor: tool === 'pick' ? 'crosshair' : 'pointer',
      }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
    />
  )
}
