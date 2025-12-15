/**
 * Simple voxel asset editor for creating/modifying small assets like switches.
 *
 * Features:
 * - 3D view with orbit controls
 * - Click to add/remove voxels
 * - Voxel type picker
 * - Load/save asset JSON
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VoxelType, VOXEL_SIZE } from '../voxel/VoxelTypes'
import { isAnimatedAsset, type AnimatedAssetDef } from '../voxel/AnimatedAsset'
import { AnimatedAssetInstance } from '../voxel/AnimatedAssetInstance'
import { AnimationPreview } from './AnimationPreview'

// Voxel colors for rendering
const VOXEL_COLORS: Record<number, number> = {
  [VoxelType.SWITCH]: 0x6080a0,
  [VoxelType.SWITCH_BUTTON]: 0x888888,
  [VoxelType.LED_GREEN]: 0x00ff00,
  [VoxelType.LED_RED]: 0xff0000,
  [VoxelType.WALL]: 0x4488ff,
  [VoxelType.PANEL]: 0x8899cc,
  [VoxelType.DESK]: 0x2a3a4a,
  [VoxelType.KEYBOARD]: 0x1a2a3a,
  [VoxelType.DOOR_FRAME]: 0x3a4a5a,
  [VoxelType.DOOR_PANEL]: 0x5a6a7a,
  [VoxelType.LIGHT_FIXTURE]: 0xffffaa,
  [VoxelType.DUCT]: 0x5a5a5a,
  [VoxelType.FAN_HUB]: 0x3a3a3a,
  [VoxelType.FAN_BLADE]: 0x7a7a7a,
}

// Asset voxel definition
interface AssetVoxel {
  offset: [number, number, number]
  type: string  // VoxelType name
}

// Asset definition matching our JSON format
interface AssetDefinition {
  id: string
  name: string
  description?: string
  anchor: { x: number; y: number; z: number }
  voxels: AssetVoxel[]
  children?: Array<{
    asset: string
    offset: [number, number, number]
    rotation?: number
    condition?: string
  }>
  parameters?: Record<string, unknown>
}

// Grid size for the editor (in voxels) - small for asset editing
const GRID_SIZE = 16

export class AssetEditor {
  private container: HTMLElement
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls

  // Voxel storage: Map<"x,y,z", VoxelType>
  private voxels = new Map<string, VoxelType>()
  private voxelMeshes = new Map<string, THREE.Mesh>()

  // Current tool state
  private currentVoxelType: VoxelType = VoxelType.SWITCH
  private isEraseMode = false

  // Grid helper
  private gridHelper: THREE.GridHelper

  // Raycasting
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()

  // Ghost voxel (preview)
  private ghostMesh: THREE.Mesh | null = null

  // Current asset
  private currentAsset: AssetDefinition | null = null
  private assetAnchor = { x: 0, y: 0, z: 0 }

  // UI elements
  private statusEl: HTMLElement | null = null
  private typePickerEl: HTMLElement | null = null
  private galleryEl: HTMLElement | null = null

  // Camera rotation (degrees)
  private cameraRotX = 30
  private cameraRotY = 45
  private cameraDistance = 0.8

  // Animation preview
  private animationPreview: AnimationPreview | null = null
  private previewInstance: AnimatedAssetInstance | null = null
  private lastFrameTime = 0

  constructor(container: HTMLElement) {
    this.container = container

    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      100
    )

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(this.renderer.domElement)

    // Orbit controls - disabled, using sliders instead
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableRotate = false  // Disable mouse rotation
    this.controls.enablePan = false     // Disable mouse pan
    this.controls.enableZoom = true     // Keep scroll zoom
    this.controls.target.set(0.1, 0.1, 0)

    // Set initial camera position
    this.updateCameraFromRotation()

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(5, 10, 5)
    this.scene.add(directional)

    // Grid
    this.gridHelper = new THREE.GridHelper(
      GRID_SIZE * VOXEL_SIZE,
      GRID_SIZE,
      0x444466,
      0x333355
    )
    this.gridHelper.position.y = 0
    this.scene.add(this.gridHelper)

    // Axis helper
    const axisHelper = new THREE.AxesHelper(0.5)
    this.scene.add(axisHelper)

    // Event listeners
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this))
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this))
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener('resize', this.onResize.bind(this))
    window.addEventListener('keydown', this.onKeyDown.bind(this))

    // Create UI
    this.createUI()

    // Start render loop
    this.animate()
  }

  private createUI(): void {
    // Status bar
    this.statusEl = document.createElement('div')
    this.statusEl.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      color: #aaa;
      font-family: monospace;
      font-size: 12px;
      background: rgba(0,0,0,0.7);
      padding: 8px 12px;
      border-radius: 4px;
    `
    this.container.appendChild(this.statusEl)
    this.updateStatus()

    // Type picker
    this.typePickerEl = document.createElement('div')
    this.typePickerEl.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0,0,0,0.8);
      padding: 10px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `

    const title = document.createElement('div')
    title.textContent = 'Voxel Type'
    title.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 12px; margin-bottom: 4px;'
    this.typePickerEl.appendChild(title)

    // Add type buttons
    const types: [string, VoxelType][] = [
      ['Switch', VoxelType.SWITCH],
      ['Button', VoxelType.SWITCH_BUTTON],
      ['LED Green', VoxelType.LED_GREEN],
      ['LED Red', VoxelType.LED_RED],
      ['Panel', VoxelType.PANEL],
      ['Wall', VoxelType.WALL],
      ['Desk', VoxelType.DESK],
      ['Keyboard', VoxelType.KEYBOARD],
      ['Light', VoxelType.LIGHT_FIXTURE],
      ['Door Frame', VoxelType.DOOR_FRAME],
      ['Door Panel', VoxelType.DOOR_PANEL],
    ]

    for (const [name, type] of types) {
      const btn = document.createElement('button')
      btn.textContent = name
      btn.dataset.type = String(type)
      btn.style.cssText = `
        padding: 4px 8px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        background: ${type === this.currentVoxelType ? '#4a6' : '#444'};
        color: #fff;
      `
      btn.addEventListener('click', () => {
        this.currentVoxelType = type
        this.isEraseMode = false
        this.updateTypePicker()
        this.updateStatus()
      })
      this.typePickerEl.appendChild(btn)
    }

    // Erase button
    const eraseBtn = document.createElement('button')
    eraseBtn.textContent = 'Erase (X)'
    eraseBtn.style.cssText = `
      padding: 4px 8px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      background: ${this.isEraseMode ? '#a44' : '#444'};
      color: #fff;
      margin-top: 8px;
    `
    eraseBtn.addEventListener('click', () => {
      this.isEraseMode = !this.isEraseMode
      this.updateTypePicker()
      this.updateStatus()
    })
    this.typePickerEl.appendChild(eraseBtn)

    this.container.appendChild(this.typePickerEl)

    // Actions panel
    const actionsEl = document.createElement('div')
    actionsEl.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      padding: 10px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `

    const actionsTitle = document.createElement('div')
    actionsTitle.textContent = 'Actions'
    actionsTitle.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 12px; margin-bottom: 4px;'
    actionsEl.appendChild(actionsTitle)

    const actions = [
      ['New', () => { this.hideGallery(); this.newAsset() }],
      ['Gallery', () => this.showGallery()],
      ['Save', () => this.saveAsset()],
      ['Export JSON', () => this.exportJSON()],
      ['Clear All', () => this.clearAll()],
    ]

    for (const [name, handler] of actions) {
      const btn = document.createElement('button')
      btn.textContent = name as string
      btn.style.cssText = `
        padding: 4px 8px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        background: #446;
        color: #fff;
      `
      btn.addEventListener('click', handler as () => void)
      actionsEl.appendChild(btn)
    }

    this.container.appendChild(actionsEl)

    // Rotation sliders panel
    const rotationPanel = document.createElement('div')
    rotationPanel.style.cssText = `
      position: absolute;
      bottom: 50px;
      left: 10px;
      background: rgba(0,0,0,0.8);
      padding: 10px;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 180px;
    `

    const rotTitle = document.createElement('div')
    rotTitle.textContent = 'Camera'
    rotTitle.style.cssText = 'color: #fff; font-family: sans-serif; font-size: 12px;'
    rotationPanel.appendChild(rotTitle)

    // X rotation (pitch)
    const createSlider = (label: string, min: number, max: number, value: number, onChange: (v: number) => void) => {
      const row = document.createElement('div')
      row.style.cssText = 'display: flex; align-items: center; gap: 8px;'

      const labelEl = document.createElement('span')
      labelEl.textContent = label
      labelEl.style.cssText = 'color: #888; font-family: monospace; font-size: 11px; width: 40px;'
      row.appendChild(labelEl)

      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = String(min)
      slider.max = String(max)
      slider.value = String(value)
      slider.style.cssText = 'flex: 1; height: 4px; cursor: pointer;'
      slider.addEventListener('input', () => onChange(Number(slider.value)))
      row.appendChild(slider)

      const valueEl = document.createElement('span')
      valueEl.textContent = String(value)
      valueEl.style.cssText = 'color: #666; font-family: monospace; font-size: 10px; width: 30px; text-align: right;'
      slider.addEventListener('input', () => {
        valueEl.textContent = slider.value
      })
      row.appendChild(valueEl)

      return row
    }

    rotationPanel.appendChild(createSlider('Pitch', -89, 89, this.cameraRotX, (v) => {
      this.cameraRotX = v
      this.updateCameraFromRotation()
    }))

    rotationPanel.appendChild(createSlider('Yaw', 0, 360, this.cameraRotY, (v) => {
      this.cameraRotY = v
      this.updateCameraFromRotation()
    }))

    rotationPanel.appendChild(createSlider('Zoom', 20, 200, this.cameraDistance * 100, (v) => {
      this.cameraDistance = v / 100
      this.updateCameraFromRotation()
    }))

    // Reset button
    const resetBtn = document.createElement('button')
    resetBtn.textContent = 'Reset View'
    resetBtn.style.cssText = `
      padding: 4px 8px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      background: #335;
      color: #aaa;
      margin-top: 4px;
    `
    resetBtn.addEventListener('click', () => {
      this.cameraRotX = 30
      this.cameraRotY = 45
      this.cameraDistance = 0.8
      this.controls.target.set(0.1, 0.1, 0)
      this.updateCameraFromRotation()
      // Update sliders
      const sliders = rotationPanel.querySelectorAll('input[type="range"]')
      if (sliders[0]) (sliders[0] as HTMLInputElement).value = '30'
      if (sliders[1]) (sliders[1] as HTMLInputElement).value = '45'
      if (sliders[2]) (sliders[2] as HTMLInputElement).value = '80'
    })
    rotationPanel.appendChild(resetBtn)

    this.container.appendChild(rotationPanel)

    // Help text
    const helpEl = document.createElement('div')
    helpEl.style.cssText = `
      position: absolute;
      bottom: 10px;
      right: 10px;
      color: #666;
      font-family: monospace;
      font-size: 11px;
      text-align: right;
    `
    helpEl.innerHTML = `
      Click: Place voxel<br>
      Shift+Click: Remove voxel<br>
      WASD: Pan | Q/Z: Up/Down<br>
      X: Erase | G: Gallery
    `
    this.container.appendChild(helpEl)

    // Asset gallery
    this.createGallery()

    // Animation preview panel
    this.animationPreview = new AnimationPreview(this.container)
    this.animationPreview.createUI()
  }

  private async createGallery(): Promise<void> {
    this.galleryEl = document.createElement('div')
    this.galleryEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(20, 20, 40, 0.95);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #446;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      z-index: 100;
    `

    const title = document.createElement('h2')
    title.textContent = 'Asset Gallery'
    title.style.cssText = 'color: #fff; font-family: sans-serif; margin: 0 0 15px 0; font-size: 18px;'
    this.galleryEl.appendChild(title)

    const subtitle = document.createElement('p')
    subtitle.textContent = 'Click an asset to edit, or create a new one'
    subtitle.style.cssText = 'color: #888; font-family: sans-serif; margin: 0 0 15px 0; font-size: 12px;'
    this.galleryEl.appendChild(subtitle)

    // New asset button
    const newBtn = document.createElement('button')
    newBtn.textContent = '+ New Asset'
    newBtn.style.cssText = `
      width: 100%;
      padding: 10px;
      margin-bottom: 15px;
      border: 2px dashed #446;
      border-radius: 6px;
      background: transparent;
      color: #88a;
      font-size: 14px;
      cursor: pointer;
    `
    newBtn.addEventListener('click', () => {
      this.hideGallery()
      this.newAsset()
    })
    this.galleryEl.appendChild(newBtn)

    // Loading indicator
    const loading = document.createElement('div')
    loading.textContent = 'Loading assets...'
    loading.style.cssText = 'color: #666; text-align: center; padding: 20px;'
    this.galleryEl.appendChild(loading)

    this.container.appendChild(this.galleryEl)

    // Fetch and display assets
    try {
      const response = await fetch('/api/assets')
      if (!response.ok) throw new Error('Failed to fetch assets')

      const assets = await response.json() as string[]

      // Remove loading
      loading.remove()

      // Group assets by folder
      const grouped = new Map<string, string[]>()
      for (const asset of assets) {
        const parts = asset.split('/')
        const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root'
        const name = parts[parts.length - 1]!
        if (!grouped.has(folder)) grouped.set(folder, [])
        grouped.get(folder)!.push(asset)
      }

      // Create asset cards
      for (const [folder, folderAssets] of grouped) {
        const folderTitle = document.createElement('div')
        folderTitle.textContent = folder.toUpperCase()
        folderTitle.style.cssText = `
          color: #668;
          font-family: monospace;
          font-size: 11px;
          margin: 15px 0 8px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid #334;
        `
        this.galleryEl.appendChild(folderTitle)

        const grid = document.createElement('div')
        grid.style.cssText = `
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
        `

        for (const assetPath of folderAssets) {
          const card = document.createElement('button')
          const name = assetPath.split('/').pop()!
          card.textContent = name
          card.style.cssText = `
            padding: 12px 8px;
            border: 1px solid #446;
            border-radius: 6px;
            background: #223;
            color: #aac;
            font-size: 12px;
            cursor: pointer;
            text-align: center;
            transition: all 0.15s;
          `
          card.addEventListener('mouseenter', () => {
            card.style.background = '#335'
            card.style.borderColor = '#668'
          })
          card.addEventListener('mouseleave', () => {
            card.style.background = '#223'
            card.style.borderColor = '#446'
          })
          card.addEventListener('click', () => {
            this.hideGallery()
            this.loadAssetByPath(assetPath)
          })
          grid.appendChild(card)
        }

        this.galleryEl.appendChild(grid)
      }

    } catch (err) {
      loading.textContent = `Error: ${err}`
      loading.style.color = '#a44'
    }
  }

  private hideGallery(): void {
    if (this.galleryEl) {
      this.galleryEl.style.display = 'none'
    }
  }

  private showGallery(): void {
    if (this.galleryEl) {
      this.galleryEl.style.display = 'block'
    }
  }

  private async loadAssetByPath(path: string): Promise<void> {
    try {
      const response = await fetch(`/api/asset/${path}`)
      if (!response.ok) throw new Error(`Failed to load: ${response.status}`)

      const asset = await response.json() as AssetDefinition
      this.loadAssetData(asset)
    } catch (err) {
      alert(`Failed to load asset: ${err}`)
    }
  }

  private updateTypePicker(): void {
    if (!this.typePickerEl) return

    const buttons = this.typePickerEl.querySelectorAll('button')
    buttons.forEach(btn => {
      const type = btn.dataset.type
      if (type) {
        const isSelected = Number(type) === this.currentVoxelType && !this.isEraseMode
        btn.style.background = isSelected ? '#4a6' : '#444'
      } else if (btn.textContent?.includes('Erase')) {
        btn.style.background = this.isEraseMode ? '#a44' : '#444'
      }
    })
  }

  private updateStatus(): void {
    if (!this.statusEl) return

    const typeName = VoxelType[this.currentVoxelType] || 'Unknown'
    const mode = this.isEraseMode ? 'ERASE' : `PLACE: ${typeName}`
    const voxelCount = this.voxels.size
    const assetName = this.currentAsset?.name || 'Untitled'

    this.statusEl.textContent = `${assetName} | ${voxelCount} voxels | ${mode}`
  }

  private onClick(event: MouseEvent): void {
    // Don't handle if clicking on UI
    if (event.target !== this.renderer.domElement) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)

    // Check for voxel hits first (for removal)
    if (this.isEraseMode || event.shiftKey) {
      const voxelMeshArray = Array.from(this.voxelMeshes.values())
      const hits = this.raycaster.intersectObjects(voxelMeshArray)

      if (hits.length > 0) {
        const hit = hits[0]!
        const mesh = hit.object as THREE.Mesh
        const key = mesh.userData.voxelKey as string
        if (key) {
          this.removeVoxel(key)
          return
        }
      }
    }

    // Check for placement (on grid or adjacent to existing voxel)
    if (!this.isEraseMode) {
      // First try to place adjacent to existing voxel
      const voxelMeshArray = Array.from(this.voxelMeshes.values())
      const voxelHits = this.raycaster.intersectObjects(voxelMeshArray)

      if (voxelHits.length > 0) {
        const hit = voxelHits[0]!
        const normal = hit.face?.normal
        if (normal) {
          // Get voxel position and add in normal direction
          const voxelPos = hit.object.position.clone()
          const newPos = voxelPos.add(normal.multiplyScalar(VOXEL_SIZE))

          const vx = Math.round(newPos.x / VOXEL_SIZE)
          const vy = Math.round(newPos.y / VOXEL_SIZE)
          const vz = Math.round(newPos.z / VOXEL_SIZE)

          this.addVoxel(vx, vy, vz, this.currentVoxelType)
          return
        }
      }

      // Try to place on grid
      const gridPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const intersection = new THREE.Vector3()

      if (this.raycaster.ray.intersectPlane(gridPlane, intersection)) {
        const vx = Math.round(intersection.x / VOXEL_SIZE)
        const vy = 0
        const vz = Math.round(intersection.z / VOXEL_SIZE)

        this.addVoxel(vx, vy, vz, this.currentVoxelType)
      }
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // Update ghost preview
    this.updateGhost()
  }

  private updateGhost(): void {
    if (this.isEraseMode) {
      if (this.ghostMesh) {
        this.scene.remove(this.ghostMesh)
        this.ghostMesh = null
      }
      return
    }

    this.raycaster.setFromCamera(this.mouse, this.camera)

    // Try voxel adjacency first
    const voxelMeshArray = Array.from(this.voxelMeshes.values())
    const voxelHits = this.raycaster.intersectObjects(voxelMeshArray)

    let ghostPos: THREE.Vector3 | null = null

    if (voxelHits.length > 0) {
      const hit = voxelHits[0]!
      const normal = hit.face?.normal
      if (normal) {
        const voxelPos = hit.object.position.clone()
        ghostPos = voxelPos.add(normal.multiplyScalar(VOXEL_SIZE))
      }
    } else {
      // Try grid
      const gridPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const intersection = new THREE.Vector3()

      if (this.raycaster.ray.intersectPlane(gridPlane, intersection)) {
        const vx = Math.round(intersection.x / VOXEL_SIZE)
        const vz = Math.round(intersection.z / VOXEL_SIZE)
        ghostPos = new THREE.Vector3(vx * VOXEL_SIZE, 0, vz * VOXEL_SIZE)
      }
    }

    if (ghostPos) {
      if (!this.ghostMesh) {
        const geo = new THREE.BoxGeometry(VOXEL_SIZE * 0.95, VOXEL_SIZE * 0.95, VOXEL_SIZE * 0.95)
        const mat = new THREE.MeshBasicMaterial({
          color: VOXEL_COLORS[this.currentVoxelType] || 0xffffff,
          transparent: true,
          opacity: 0.5,
          wireframe: false,
        })
        this.ghostMesh = new THREE.Mesh(geo, mat)
        this.scene.add(this.ghostMesh)
      }

      // Update ghost color
      const mat = this.ghostMesh.material as THREE.MeshBasicMaterial
      mat.color.setHex(VOXEL_COLORS[this.currentVoxelType] || 0xffffff)

      this.ghostMesh.position.copy(ghostPos)
    } else if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh)
      this.ghostMesh = null
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Don't handle if typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Number keys to select voxel type
    const typeMap: Record<string, VoxelType> = {
      '1': VoxelType.SWITCH,
      '2': VoxelType.SWITCH_BUTTON,
      '3': VoxelType.LED_GREEN,
      '4': VoxelType.LED_RED,
      '5': VoxelType.PANEL,
      '6': VoxelType.WALL,
      '7': VoxelType.DESK,
      '8': VoxelType.KEYBOARD,
      '9': VoxelType.LIGHT_FIXTURE,
    }

    if (typeMap[event.key]) {
      this.currentVoxelType = typeMap[event.key]!
      this.isEraseMode = false
      this.updateTypePicker()
      this.updateStatus()
      return
    }

    // Camera controls
    const panSpeed = 0.05
    const rotateSpeed = 0.1

    switch (event.key.toLowerCase()) {
      // WASD for panning
      case 'w':
        this.controls.target.z -= panSpeed
        this.camera.position.z -= panSpeed
        break
      case 's':
        if (!event.metaKey && !event.ctrlKey) {
          this.controls.target.z += panSpeed
          this.camera.position.z += panSpeed
        }
        break
      case 'a':
        this.controls.target.x -= panSpeed
        this.camera.position.x -= panSpeed
        break
      case 'd':
        this.controls.target.x += panSpeed
        this.camera.position.x += panSpeed
        break

      // Q/E for vertical movement
      case 'q':
        this.controls.target.y -= panSpeed
        this.camera.position.y -= panSpeed
        break
      case 'z':
        this.controls.target.y += panSpeed
        this.camera.position.y += panSpeed
        break

      // R/F for zoom
      case 'r':
        this.camera.position.sub(this.controls.target).multiplyScalar(0.9).add(this.controls.target)
        break
      case 'f':
        this.camera.position.sub(this.controls.target).multiplyScalar(1.1).add(this.controls.target)
        break

      // X for erase mode toggle
      case 'x':
        this.isEraseMode = !this.isEraseMode
        this.updateTypePicker()
        this.updateStatus()
        break

      // G for gallery
      case 'g':
        this.showGallery()
        break

      // Escape to close gallery
      case 'escape':
        this.hideGallery()
        break

      // Home to reset view
      case 'home':
        this.resetCamera()
        break
    }

    // Ctrl+S to save
    if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      this.saveAsset()
    }
  }

  private resetCamera(): void {
    this.camera.position.set(0.5, 0.5, 1)
    this.controls.target.set(0.2, 0.2, 0)
  }

  private onResize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private addVoxel(x: number, y: number, z: number, type: VoxelType): void {
    const key = `${x},${y},${z}`

    // Remove existing if any
    if (this.voxelMeshes.has(key)) {
      this.removeVoxel(key)
    }

    this.voxels.set(key, type)

    // Create mesh
    const geo = new THREE.BoxGeometry(VOXEL_SIZE * 0.98, VOXEL_SIZE * 0.98, VOXEL_SIZE * 0.98)
    const mat = new THREE.MeshStandardMaterial({
      color: VOXEL_COLORS[type] || 0xff00ff,
      roughness: 0.7,
      metalness: 0.3,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE)
    mesh.userData.voxelKey = key

    this.scene.add(mesh)
    this.voxelMeshes.set(key, mesh)

    this.updateStatus()
  }

  private removeVoxel(key: string): void {
    const mesh = this.voxelMeshes.get(key)
    if (mesh) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }

    this.voxels.delete(key)
    this.voxelMeshes.delete(key)

    this.updateStatus()
  }

  private clearAll(): void {
    if (this.voxels.size > 0 && !confirm('Clear all voxels?')) return

    for (const key of this.voxelMeshes.keys()) {
      this.removeVoxel(key)
    }

    this.currentAsset = null
    this.updateStatus()
  }

  private newAsset(): void {
    const name = prompt('Asset name:', 'new-asset')
    if (!name) return

    this.clearAll()

    this.currentAsset = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      anchor: { x: 0, y: 0, z: 0 },
      voxels: [],
    }

    this.updateStatus()
  }

  private async loadAsset(): Promise<void> {
    // First, get list of available assets
    try {
      const listResponse = await fetch('/api/assets')
      if (!listResponse.ok) throw new Error('Failed to list assets')

      const assets = await listResponse.json() as string[]

      // Show picker
      const assetList = assets.map((a, i) => `${i + 1}. ${a}`).join('\n')
      const choice = prompt(`Available assets:\n${assetList}\n\nEnter asset path:`, assets[0] || 'controls/switch')
      if (!choice) return

      const response = await fetch(`/api/assets/${choice}`)
      if (!response.ok) throw new Error(`Failed to load: ${response.status}`)

      const asset = await response.json() as AssetDefinition
      this.loadAssetData(asset)
    } catch (err) {
      alert(`Failed to load asset: ${err}`)
    }
  }

  loadAssetData(asset: AssetDefinition): void {
    this.clearAll()

    // Clean up previous preview instance
    if (this.previewInstance) {
      this.scene.remove(this.previewInstance.group)
      this.previewInstance.dispose()
      this.previewInstance = null
    }

    this.currentAsset = asset
    this.assetAnchor = asset.anchor || { x: 0, y: 0, z: 0 }

    // Load voxels
    for (const v of asset.voxels) {
      const type = VoxelType[v.type as keyof typeof VoxelType]
      if (type !== undefined) {
        this.addVoxel(v.offset[0], v.offset[1], v.offset[2], type)
      }
    }

    this.updateStatus()

    // Center camera on asset
    if (asset.voxels.length > 0) {
      let sumX = 0, sumY = 0, sumZ = 0
      for (const v of asset.voxels) {
        sumX += v.offset[0]
        sumY += v.offset[1]
        sumZ += v.offset[2]
      }
      const n = asset.voxels.length
      this.controls.target.set(
        (sumX / n) * VOXEL_SIZE,
        (sumY / n) * VOXEL_SIZE,
        (sumZ / n) * VOXEL_SIZE
      )
    }

    // Check if asset has animation capabilities
    if (isAnimatedAsset(asset)) {
      const animatedAsset = asset as unknown as AnimatedAssetDef
      this.previewInstance = new AnimatedAssetInstance(
        animatedAsset,
        { x: 0, y: 0, z: 0 },
        0,
        {}
      )
      this.scene.add(this.previewInstance.group)

      // Set up animation preview panel
      if (this.animationPreview) {
        this.animationPreview.setAsset(animatedAsset)
        this.animationPreview.setPreviewInstance(this.previewInstance)
      }
    } else {
      // Hide animation preview for non-animated assets
      if (this.animationPreview) {
        this.animationPreview.setAsset(null)
        this.animationPreview.setPreviewInstance(null)
      }
    }
  }

  private saveAsset(): void {
    if (!this.currentAsset) {
      this.newAsset()
      if (!this.currentAsset) return
    }

    // Convert voxels to asset format
    const voxels: AssetVoxel[] = []
    for (const [key, type] of this.voxels) {
      const [x, y, z] = key.split(',').map(Number)
      voxels.push({
        offset: [x!, y!, z!],
        type: VoxelType[type]!,
      })
    }

    this.currentAsset.voxels = voxels

    console.log('Saved asset:', this.currentAsset)
    this.exportJSON()
  }

  private exportJSON(): void {
    if (!this.currentAsset) {
      alert('No asset to export')
      return
    }

    // Update voxels
    const voxels: AssetVoxel[] = []
    for (const [key, type] of this.voxels) {
      const [x, y, z] = key.split(',').map(Number)
      voxels.push({
        offset: [x!, y!, z!],
        type: VoxelType[type]!,
      })
    }
    this.currentAsset.voxels = voxels

    const json = JSON.stringify(this.currentAsset, null, 2)

    // Copy to clipboard
    navigator.clipboard.writeText(json).then(() => {
      alert('JSON copied to clipboard!')
    }).catch(() => {
      // Fallback: show in console
      console.log('Asset JSON:')
      console.log(json)
      alert('JSON logged to console (clipboard failed)')
    })
  }

  private updateCameraFromRotation(): void {
    // Convert rotation angles to camera position
    const rotX = THREE.MathUtils.degToRad(this.cameraRotX)
    const rotY = THREE.MathUtils.degToRad(this.cameraRotY)

    // Spherical coordinates around target
    const x = this.cameraDistance * Math.cos(rotX) * Math.sin(rotY)
    const y = this.cameraDistance * Math.sin(rotX)
    const z = this.cameraDistance * Math.cos(rotX) * Math.cos(rotY)

    this.camera.position.set(
      this.controls.target.x + x,
      this.controls.target.y + y,
      this.controls.target.z + z
    )
    this.camera.lookAt(this.controls.target)
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate)

    // Calculate delta time for animations
    const now = performance.now()
    const deltaTime = (now - this.lastFrameTime) / 1000
    this.lastFrameTime = now

    // Update animation preview instance
    if (this.previewInstance) {
      this.previewInstance.update(deltaTime)
    }

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.renderer.dispose()
    this.controls.dispose()

    for (const mesh of this.voxelMeshes.values()) {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }

    // Clean up animation preview
    if (this.previewInstance) {
      this.previewInstance.dispose()
      this.previewInstance = null
    }
  }
}
