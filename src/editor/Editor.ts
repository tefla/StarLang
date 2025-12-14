/**
 * Main editor controller.
 *
 * Orchestrates the voxel editor, managing tools, camera,
 * input handling, and integration with the game.
 */

import * as THREE from 'three'
import { VoxelWorld } from '../voxel/VoxelWorld'
import { VoxelRenderer } from '../voxel/VoxelRenderer'
import { VoxelRaycast, type VoxelHit } from '../voxel/VoxelRaycast'
import { EditorStore, EditorMode, type EditorAction } from './EditorState'
import { EditorCamera, CameraMode } from './EditorCamera'
import { VoxelBrush } from './tools/VoxelBrush'

/**
 * Editor configuration.
 */
export interface EditorConfig {
  /** DOM element for rendering */
  canvas: HTMLCanvasElement
  /** THREE.js scene */
  scene: THREE.Scene
  /** THREE.js renderer */
  renderer: THREE.WebGLRenderer
}

/**
 * Main editor class.
 */
export class Editor {
  /** Editor state store */
  public store: EditorStore

  /** Voxel world */
  public world: VoxelWorld

  /** Voxel renderer */
  public voxelRenderer: VoxelRenderer

  /** Voxel raycast */
  private raycast: VoxelRaycast

  /** Editor camera */
  public camera: EditorCamera

  /** Voxel brush tool */
  public brush: VoxelBrush

  /** THREE.js scene */
  private scene: THREE.Scene

  /** THREE.js renderer */
  private renderer: THREE.WebGLRenderer

  /** Canvas element */
  private canvas: HTMLCanvasElement

  /** Is mouse button pressed */
  private isMouseDown = false

  /** Which mouse button is pressed */
  private mouseButton = 0

  /** Last raycast hit */
  private lastHit: VoxelHit | null = null

  /** Grid helper for visual reference */
  private gridHelper: THREE.GridHelper | null = null

  /** Axis helper */
  private axisHelper: THREE.AxesHelper | null = null

  constructor(config: EditorConfig) {
    this.canvas = config.canvas
    this.scene = config.scene
    this.renderer = config.renderer

    // Initialize state
    this.store = new EditorStore()

    // Initialize voxel world
    this.world = new VoxelWorld()

    // Initialize voxel renderer
    this.voxelRenderer = new VoxelRenderer(this.scene, this.world)

    // Initialize raycast
    this.raycast = new VoxelRaycast(this.world)

    // Initialize camera
    const aspect = this.canvas.width / this.canvas.height
    this.camera = new EditorCamera(aspect, {
      target: new THREE.Vector3(3, 1.5, 3),
      distance: 15
    })

    // Initialize brush tool
    this.brush = new VoxelBrush(this.world, this.store)

    // Add ghost mesh to scene
    if (this.brush.ghostMesh) {
      this.scene.add(this.brush.ghostMesh)
    }

    // Setup helpers
    this.setupHelpers()

    // Setup input handlers
    this.setupInput()

    // Subscribe to state changes
    this.store.subscribe(state => {
      this.onStateChange(state)
    })
  }

  /**
   * Setup visual helpers (grid, axes).
   */
  private setupHelpers(): void {
    // Grid helper (10m x 10m, 0.1m divisions)
    this.gridHelper = new THREE.GridHelper(10, 100, 0x444444, 0x222222)
    this.gridHelper.position.y = 0.001 // Slight offset to prevent z-fighting
    this.scene.add(this.gridHelper)

    // Axis helper
    this.axisHelper = new THREE.AxesHelper(2)
    this.scene.add(this.axisHelper)
  }

  /**
   * Setup input event handlers.
   */
  private setupInput(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('contextmenu', e => e.preventDefault())
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    // Attach camera controls
    this.camera.attach(this.canvas)
  }

  /**
   * Get normalized device coordinates from mouse event.
   */
  private getNDC(e: MouseEvent): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect()
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
  }

  /**
   * Perform raycast from mouse position.
   */
  private raycastFromMouse(e: MouseEvent): VoxelHit | null {
    const ndc = this.getNDC(e)
    return this.raycast.castFromCamera(
      this.camera.getActiveCamera(),
      ndc.x,
      ndc.y,
      100
    )
  }

  // Input handlers
  private onMouseDown = (e: MouseEvent): void => {
    const state = this.store.getState()
    if (state.mode === EditorMode.DISABLED) return
    if (e.button === 1 || e.button === 2) return // Middle/right for camera

    this.isMouseDown = true
    this.mouseButton = e.button

    if (state.mode === EditorMode.VOXEL) {
      const hit = this.raycastFromMouse(e)
      const isErasing = e.button === 2 || e.shiftKey
      this.brush.startStroke(hit, isErasing)
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    const state = this.store.getState()
    if (state.mode === EditorMode.DISABLED) return

    const hit = this.raycastFromMouse(e)
    this.lastHit = hit

    if (state.mode === EditorMode.VOXEL) {
      const isErasing = e.shiftKey
      this.brush.updateGhost(hit, isErasing)

      if (this.isMouseDown) {
        this.brush.continueStroke(hit, isErasing)
      }
    }
  }

  private onMouseUp = (e: MouseEvent): void => {
    const state = this.store.getState()
    if (state.mode === EditorMode.DISABLED) return
    if (!this.isMouseDown) return

    this.isMouseDown = false

    if (state.mode === EditorMode.VOXEL) {
      const hit = this.raycastFromMouse(e)
      const isErasing = e.button === 2 || e.shiftKey
      const action = this.brush.endStroke(hit, isErasing)

      if (action) {
        this.store.dispatch({ type: 'PUSH_ACTION', action })
      }
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const state = this.store.getState()

    // Tab to toggle editor
    if (e.key === 'Tab') {
      e.preventDefault()
      if (state.mode === EditorMode.DISABLED) {
        this.store.dispatch({ type: 'SET_MODE', mode: EditorMode.VOXEL })
      } else {
        this.store.dispatch({ type: 'SET_MODE', mode: EditorMode.DISABLED })
      }
      return
    }

    if (state.mode === EditorMode.DISABLED) return

    // Undo/Redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          this.redo()
        } else {
          this.undo()
        }
        return
      }
      if (e.key === 'y') {
        e.preventDefault()
        this.redo()
        return
      }
    }

    // Tool shortcuts
    switch (e.key) {
      case '1':
        this.store.dispatch({ type: 'SET_VOXEL_TYPE', voxelType: 1 }) // HULL
        break
      case '2':
        this.store.dispatch({ type: 'SET_VOXEL_TYPE', voxelType: 2 }) // WALL
        break
      case '3':
        this.store.dispatch({ type: 'SET_VOXEL_TYPE', voxelType: 3 }) // FLOOR
        break
      case '4':
        this.store.dispatch({ type: 'SET_VOXEL_TYPE', voxelType: 4 }) // CEILING
        break
      case '5':
        this.store.dispatch({ type: 'SET_VOXEL_TYPE', voxelType: 5 }) // GLASS
        break
      case 'Escape':
        this.brush.cancelStroke()
        this.store.dispatch({ type: 'CLEAR_SELECTION' })
        break
      case 'g':
        // Toggle grid
        if (this.gridHelper) {
          this.gridHelper.visible = !this.gridHelper.visible
        }
        break
      case 'h':
        // Toggle UI
        this.store.dispatch({ type: 'TOGGLE_UI' })
        break
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    // Handle key up if needed
  }

  /**
   * Handle state changes.
   */
  private onStateChange(state: any): void {
    // Update visual elements based on state
    if (this.gridHelper) {
      this.gridHelper.visible = state.mode !== EditorMode.DISABLED
    }
    if (this.axisHelper) {
      this.axisHelper.visible = state.mode !== EditorMode.DISABLED
    }
  }

  /**
   * Undo last action.
   */
  undo(): void {
    const state = this.store.getState()
    const action = state.undoStack[state.undoStack.length - 1]
    if (!action) return

    this.brush.applyUndo(action)
    this.store.dispatch({ type: 'UNDO' })
  }

  /**
   * Redo last undone action.
   */
  redo(): void {
    const state = this.store.getState()
    const action = state.redoStack[state.redoStack.length - 1]
    if (!action) return

    this.brush.applyRedo(action)
    this.store.dispatch({ type: 'REDO' })
  }

  /**
   * Enable editor mode.
   */
  enable(): void {
    this.store.dispatch({ type: 'SET_MODE', mode: EditorMode.VOXEL })
  }

  /**
   * Disable editor mode.
   */
  disable(): void {
    this.store.dispatch({ type: 'SET_MODE', mode: EditorMode.DISABLED })
  }

  /**
   * Check if editor is active.
   */
  isActive(): boolean {
    return this.store.getState().mode !== EditorMode.DISABLED
  }

  /**
   * Update editor each frame.
   */
  update(deltaTime: number): void {
    // Update camera
    this.camera.update(deltaTime)

    // Update voxel renderer
    this.voxelRenderer.update()
  }

  /**
   * Render editor view.
   */
  render(): void {
    this.renderer.render(this.scene, this.camera.getActiveCamera())
  }

  /**
   * Handle window resize.
   */
  onResize(width: number, height: number): void {
    this.camera.onResize(width, height)
  }

  /**
   * Create a test world with a simple room.
   */
  createTestWorld(): void {
    // Simple test: just a flat 20x20 floor
    const size = 20
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        this.world.setVoxel(x, 0, z, 3) // FLOOR
      }
    }

    // Add a small wall to test vertical merging
    for (let y = 0; y < 10; y++) {
      for (let z = 0; z < size; z++) {
        this.world.setVoxel(0, y, z, 2) // WALL
      }
    }

    // Rebuild meshes
    this.voxelRenderer.rebuildAll()
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)

    this.camera.detach()
    this.brush.dispose()
    this.voxelRenderer.dispose()

    if (this.gridHelper) {
      this.scene.remove(this.gridHelper)
    }
    if (this.axisHelper) {
      this.scene.remove(this.axisHelper)
    }
  }
}
