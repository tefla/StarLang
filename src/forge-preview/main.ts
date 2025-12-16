// Forge Preview - Live preview tool for .forge files
// Features: 3D rendering, hot reload, state/param manipulation

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { parse, compileModule, enableClientHotReload, type ForgeHotReloadEvent } from '../forge'
import { VoxelType, VOXEL_SIZE, getVoxelColor } from '../voxel/VoxelTypes'
import type { AnimatedAssetDef, VoxelPlacement, VoxelBox } from '../voxel/AnimatedAsset'
import type { CompiledEntityDef } from '../types/entity'
import type { ShipLayout } from '../types/layout'

// Preview state
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let currentMesh: THREE.Group | null = null
let compiledResult: { assets: AnimatedAssetDef[]; layouts: ShipLayout[]; entities: CompiledEntityDef[] } | null = null

// DOM elements
let editorEl: HTMLTextAreaElement
let statusDot: HTMLElement
let statusText: HTMLElement
let cursorPosition: HTMLElement
let errorPanel: HTMLElement
let errorText: HTMLElement
let jsonOutput: HTMLElement
let stateSelect: HTMLSelectElement
let paramSelect: HTMLSelectElement
let paramValue: HTMLInputElement
let fileSelect: HTMLSelectElement

// Debounce timer
let compileTimer: ReturnType<typeof setTimeout> | null = null

function init() {
  // Get DOM elements
  editorEl = document.getElementById('editor') as HTMLTextAreaElement
  statusDot = document.getElementById('status-dot') as HTMLElement
  statusText = document.getElementById('status-text') as HTMLElement
  cursorPosition = document.getElementById('cursor-position') as HTMLElement
  errorPanel = document.getElementById('error-panel') as HTMLElement
  errorText = document.getElementById('error-text') as HTMLElement
  jsonOutput = document.getElementById('json-output') as HTMLElement
  stateSelect = document.getElementById('state-select') as HTMLSelectElement
  paramSelect = document.getElementById('param-select') as HTMLSelectElement
  paramValue = document.getElementById('param-value') as HTMLInputElement
  fileSelect = document.getElementById('file-select') as HTMLSelectElement

  // Initialize Three.js
  initThree()

  // Setup event listeners
  setupEventListeners()

  // Enable hot reload
  enableClientHotReload((event: ForgeHotReloadEvent) => {
    handleHotReload(event)
  })

  // Initial compile
  compile()
}

function initThree() {
  const container = document.getElementById('canvas-container')!

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  // Camera
  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100)
  camera.position.set(2, 2, 2)
  camera.lookAt(0, 0, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404060, 0.6)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)

  // Grid
  const gridHelper = new THREE.GridHelper(4, 40, 0x444444, 0x333333)
  scene.add(gridHelper)

  // Axes
  const axesHelper = new THREE.AxesHelper(1)
  scene.add(axesHelper)

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  })

  // Animation loop
  function animate() {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()
}

function setupEventListeners() {
  // Editor input
  editorEl.addEventListener('input', () => {
    if (compileTimer) clearTimeout(compileTimer)
    compileTimer = setTimeout(compile, 300)
  })

  // Cursor position tracking
  editorEl.addEventListener('keyup', updateCursorPosition)
  editorEl.addEventListener('click', updateCursorPosition)

  // Tab handling
  editorEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = editorEl.selectionStart
      const end = editorEl.selectionEnd
      editorEl.value = editorEl.value.substring(0, start) + '  ' + editorEl.value.substring(end)
      editorEl.selectionStart = editorEl.selectionEnd = start + 2
    }
  })

  // Tab switching
  document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab')
      document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')

      const canvasContainer = document.getElementById('canvas-container')!
      if (tabName === '3d') {
        canvasContainer.style.display = 'block'
        jsonOutput.style.display = 'none'
      } else {
        canvasContainer.style.display = 'none'
        jsonOutput.style.display = 'block'
      }
    })
  })

  // File select
  fileSelect.addEventListener('change', async () => {
    const filename = fileSelect.value
    if (!filename) return

    setStatus('loading', `Loading ${filename}...`)
    try {
      const response = await fetch(`/game/forge/${filename}`)
      if (response.ok) {
        editorEl.value = await response.text()
        compile()
      } else {
        setStatus('error', `Failed to load ${filename}`)
      }
    } catch (e) {
      setStatus('error', `Error: ${e}`)
    }
  })

  // Set param button
  document.getElementById('set-param')!.addEventListener('click', () => {
    // This would update the preview with new param values
    // For now, just log it
    console.log(`Set ${paramSelect.value} = ${paramValue.value}`)
  })
}

function updateCursorPosition() {
  const text = editorEl.value.substring(0, editorEl.selectionStart)
  const lines = text.split('\n')
  const line = lines.length
  const column = lines[lines.length - 1]!.length + 1
  cursorPosition.textContent = `Line ${line}, Column ${column}`
}

function setStatus(status: 'ok' | 'error' | 'loading', message: string) {
  statusDot.className = 'status-dot'
  if (status === 'error') statusDot.classList.add('error')
  if (status === 'loading') statusDot.classList.add('loading')
  statusText.textContent = message
}

function compile() {
  const source = editorEl.value
  if (!source.trim()) {
    setStatus('ok', 'Ready')
    clearPreview()
    return
  }

  setStatus('loading', 'Compiling...')
  hideError()

  try {
    const module = parse(source)
    const result = compileModule(module)

    // Check for errors
    const allErrors: string[] = []
    for (const asset of result.assets) {
      if (!asset.success) {
        allErrors.push(...asset.errors.map(e => e.message))
      }
    }
    for (const layout of result.layouts) {
      if (!layout.success) {
        allErrors.push(...layout.errors.map(e => e.message))
      }
    }
    for (const entity of result.entities) {
      if (!entity.success) {
        allErrors.push(...entity.errors.map(e => e.message))
      }
    }

    if (allErrors.length > 0) {
      showError(allErrors.join('\n\n'))
      setStatus('error', `${allErrors.length} error(s)`)
      return
    }

    // Store compiled result
    compiledResult = {
      assets: result.assets.filter(a => a.success && a.result).map(a => a.result!),
      layouts: result.layouts.filter(l => l.success && l.result).map(l => l.result!),
      entities: result.entities.filter(e => e.success && e.result).map(e => e.result!)
    }

    // Update JSON output
    jsonOutput.textContent = JSON.stringify(compiledResult, null, 2)

    // Update 3D preview
    updatePreview()

    // Update controls
    updateControls()

    const count = compiledResult.assets.length + compiledResult.layouts.length + compiledResult.entities.length
    setStatus('ok', `Compiled: ${count} definition(s)`)

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    showError(message)
    setStatus('error', 'Parse error')
  }
}

function showError(message: string) {
  errorPanel.classList.add('visible')
  errorText.textContent = message
}

function hideError() {
  errorPanel.classList.remove('visible')
}

function clearPreview() {
  if (currentMesh) {
    scene.remove(currentMesh)
    currentMesh = null
  }
  jsonOutput.textContent = ''
}

function updatePreview() {
  clearPreview()

  if (!compiledResult) return

  currentMesh = new THREE.Group()

  // Render assets
  for (const asset of compiledResult.assets) {
    renderAsset(asset, currentMesh)
  }

  // Render entities (just show a placeholder box)
  for (const entity of compiledResult.entities) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1a2744, emissive: 0x1a2744, emissiveIntensity: 0.5 })
    )
    box.name = `entity_${entity.id}`
    currentMesh.add(box)
  }

  scene.add(currentMesh)
}

function renderAsset(asset: AnimatedAssetDef, parent: THREE.Group) {
  const group = new THREE.Group()
  group.name = asset.id

  // Render voxels
  if (asset.voxels) {
    for (const voxel of asset.voxels) {
      const mesh = createVoxelMesh(voxel)
      group.add(mesh)
    }
  }

  // Render boxes
  if (asset.boxes) {
    for (const box of asset.boxes) {
      const mesh = createBoxMesh(box)
      group.add(mesh)
    }
  }

  parent.add(group)
}

function createVoxelMesh(voxel: VoxelPlacement): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE)
  const color = getVoxelColor(voxel.type)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.2
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(
    voxel.offset[0] * VOXEL_SIZE,
    voxel.offset[1] * VOXEL_SIZE,
    voxel.offset[2] * VOXEL_SIZE
  )

  return mesh
}

function createBoxMesh(box: VoxelBox): THREE.Mesh {
  const width = (box.max[0] - box.min[0]) * VOXEL_SIZE
  const height = (box.max[1] - box.min[1]) * VOXEL_SIZE
  const depth = (box.max[2] - box.min[2]) * VOXEL_SIZE

  const geometry = new THREE.BoxGeometry(width, height, depth)
  const color = getVoxelColor(box.type)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.2
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(
    (box.min[0] + (box.max[0] - box.min[0]) / 2) * VOXEL_SIZE,
    (box.min[1] + (box.max[1] - box.min[1]) / 2) * VOXEL_SIZE,
    (box.min[2] + (box.max[2] - box.min[2]) / 2) * VOXEL_SIZE
  )

  return mesh
}

function updateControls() {
  // Update state select with available states
  stateSelect.innerHTML = '<option value="">default</option>'
  paramSelect.innerHTML = '<option value="">--</option>'

  if (!compiledResult) return

  // Add states from assets
  for (const asset of compiledResult.assets) {
    if (asset.states) {
      for (const stateName of Object.keys(asset.states)) {
        const option = document.createElement('option')
        option.value = stateName
        option.textContent = stateName
        stateSelect.appendChild(option)
      }
    }

    // Add parameters
    if (asset.parameters) {
      for (const paramName of Object.keys(asset.parameters)) {
        const option = document.createElement('option')
        option.value = paramName
        option.textContent = paramName
        paramSelect.appendChild(option)
      }
    }
  }

  // Add params from entities
  for (const entity of compiledResult.entities) {
    if (entity.params) {
      for (const paramName of Object.keys(entity.params)) {
        const option = document.createElement('option')
        option.value = paramName
        option.textContent = paramName
        paramSelect.appendChild(option)
      }
    }
  }
}

function handleHotReload(event: ForgeHotReloadEvent) {
  if (event.type === 'error') {
    console.log(`[HMR] Error in ${event.filePath}`)
    return
  }

  // If the currently selected file was updated, reload it
  const filename = fileSelect.value
  if (filename && event.filePath.endsWith(filename)) {
    console.log(`[HMR] Reloading ${filename}`)
    fileSelect.dispatchEvent(new Event('change'))
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
