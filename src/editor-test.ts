/**
 * Test page for the voxel editor.
 */

import * as THREE from 'three'
import { Editor } from './editor/Editor'
import { EditorMode, BrushMode } from './editor/EditorState'
import { VoxelType } from './voxel/VoxelTypes'

// Get canvas element
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const container = document.getElementById('canvas-container') as HTMLElement

// Set canvas size
function resizeCanvas() {
  const rect = container.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

// Create Three.js renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
})
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// Create scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a2e)

// Add ambient light - brighter for better visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

// Add directional light
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
dirLight.position.set(20, 30, 20)
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 2048
dirLight.shadow.mapSize.height = 2048
dirLight.shadow.camera.near = 0.5
dirLight.shadow.camera.far = 100
dirLight.shadow.camera.left = -20
dirLight.shadow.camera.right = 20
dirLight.shadow.camera.top = 20
dirLight.shadow.camera.bottom = -20
scene.add(dirLight)

// Create editor
const editor = new Editor({
  canvas,
  scene,
  renderer,
})

// Enable editor mode
editor.enable()

// Create test world with a simple room
editor.createTestWorld()

// UI Elements
const statsEl = document.getElementById('stats')!
const infoMode = document.getElementById('info-mode')!
const infoBrush = document.getElementById('info-brush')!
const infoVoxel = document.getElementById('info-voxel')!
const infoChunks = document.getElementById('info-chunks')!
const infoVoxels = document.getElementById('info-voxels')!

// Voxel type names
const VOXEL_NAMES: Record<number, string> = {
  [VoxelType.AIR]: 'Air',
  [VoxelType.HULL]: 'Hull',
  [VoxelType.WALL]: 'Wall',
  [VoxelType.FLOOR]: 'Floor',
  [VoxelType.CEILING]: 'Ceiling',
  [VoxelType.GLASS]: 'Glass',
  [VoxelType.METAL_GRATE]: 'Grate',
  [VoxelType.PANEL]: 'Panel',
}

// Brush mode names
const BRUSH_NAMES: Record<string, string> = {
  [BrushMode.SINGLE]: 'Single',
  [BrushMode.LINE]: 'Line',
  [BrushMode.BOX]: 'Box',
  [BrushMode.FILL]: 'Fill',
}

// Update UI from editor state
function updateUI() {
  const state = editor.store.getState()
  const stats = editor.voxelRenderer.getStats()

  infoMode.textContent = state.mode === EditorMode.DISABLED ? 'Disabled' : 'Voxel'
  infoBrush.textContent = BRUSH_NAMES[state.brushMode] ?? 'Unknown'
  infoVoxel.textContent = VOXEL_NAMES[state.selectedVoxelType] ?? 'Unknown'
  infoChunks.textContent = stats.renderedChunks.toString()
  infoVoxels.textContent = stats.totalVoxels.toString()

  statsEl.textContent = `${stats.totalVoxels} voxels | ${stats.renderedChunks} chunks | ${stats.totalVertices} vertices`
}

// Subscribe to state changes
editor.store.subscribe(updateUI)

// Toolbar button handlers
document.querySelectorAll('.tool-btn[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = parseInt((btn as HTMLElement).dataset.type ?? '2')
    editor.store.dispatch({ type: 'SET_VOXEL_TYPE', voxelType: type })

    // Update active state
    document.querySelectorAll('.tool-btn[data-type]').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
})

document.querySelectorAll('.tool-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = (btn as HTMLElement).dataset.mode as string
    const brushMode = mode === 'line' ? BrushMode.LINE
      : mode === 'box' ? BrushMode.BOX
      : BrushMode.SINGLE
    editor.store.dispatch({ type: 'SET_BRUSH_MODE', brushMode })

    // Update active state
    document.querySelectorAll('.tool-btn[data-mode]').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
})

// Handle resize
window.addEventListener('resize', () => {
  resizeCanvas()
  renderer.setSize(canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio)
  editor.onResize(canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio)
})

// Animation loop
let lastTime = performance.now()

function animate() {
  requestAnimationFrame(animate)

  const now = performance.now()
  const deltaTime = (now - lastTime) / 1000
  lastTime = now

  // Update editor
  editor.update(deltaTime)

  // Render
  editor.render()

  // Update UI occasionally
  if (Math.random() < 0.1) {
    updateUI()
  }
}

// Initial UI update
updateUI()

// Start animation
animate()

console.log('Voxel Editor Test loaded!')
console.log('Controls:')
console.log('  Left Click: Place voxel')
console.log('  Shift + Click: Remove voxel')
console.log('  Right Drag: Orbit camera')
console.log('  Middle Drag: Pan camera')
console.log('  Scroll: Zoom')
console.log('  1-5: Select voxel type')
console.log('  Ctrl+Z: Undo')
console.log('  Ctrl+Y: Redo')
