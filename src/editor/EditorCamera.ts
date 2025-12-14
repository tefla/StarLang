/**
 * Editor camera with orbit, pan, and fly controls.
 *
 * Supports:
 * - Orbit: Right mouse drag to rotate around target
 * - Pan: Middle mouse drag to pan the view
 * - Zoom: Scroll wheel to zoom in/out
 * - Fly: WASD when in first-person mode
 */

import * as THREE from 'three'
import { VOXEL_SIZE } from '../voxel/VoxelTypes'

/**
 * Camera mode.
 */
export enum CameraMode {
  /** Orbit around a target point */
  ORBIT = 'ORBIT',
  /** First-person fly camera */
  FLY = 'FLY',
  /** Orthographic top-down */
  ORTHO_TOP = 'ORTHO_TOP',
  /** Orthographic front view */
  ORTHO_FRONT = 'ORTHO_FRONT',
  /** Orthographic side view */
  ORTHO_SIDE = 'ORTHO_SIDE'
}

/**
 * Editor camera configuration.
 */
export interface EditorCameraConfig {
  /** Initial target point */
  target?: THREE.Vector3
  /** Initial distance from target */
  distance?: number
  /** Minimum zoom distance */
  minDistance?: number
  /** Maximum zoom distance */
  maxDistance?: number
  /** Orbit speed (radians per pixel) */
  orbitSpeed?: number
  /** Pan speed (world units per pixel) */
  panSpeed?: number
  /** Fly speed (world units per second) */
  flySpeed?: number
  /** Zoom speed (multiplier per scroll tick) */
  zoomSpeed?: number
}

/**
 * Editor camera controller.
 */
export class EditorCamera {
  /** The Three.js camera */
  public camera: THREE.PerspectiveCamera
  /** Orthographic camera (for ortho views) */
  public orthoCamera: THREE.OrthographicCamera

  /** Current camera mode */
  public mode: CameraMode = CameraMode.ORBIT

  /** Target point for orbit mode */
  public target: THREE.Vector3

  /** Distance from target (for orbit) */
  private distance: number

  /** Spherical angles (for orbit) */
  private theta: number = Math.PI / 4  // Horizontal angle
  private phi: number = Math.PI / 3    // Vertical angle (from top)

  /** Configuration */
  private config: Required<EditorCameraConfig>

  /** Input state */
  private keys: Set<string> = new Set()
  private isOrbiting = false
  private isPanning = false
  private lastMouseX = 0
  private lastMouseY = 0

  /** DOM element for input capture */
  private element: HTMLElement | null = null

  constructor(
    aspect: number,
    config: EditorCameraConfig = {}
  ) {
    this.config = {
      target: config.target ?? new THREE.Vector3(0, 0, 0),
      distance: config.distance ?? 10,
      minDistance: config.minDistance ?? 1,
      maxDistance: config.maxDistance ?? 100,
      orbitSpeed: config.orbitSpeed ?? 0.005,
      panSpeed: config.panSpeed ?? 0.01,
      flySpeed: config.flySpeed ?? 5,
      zoomSpeed: config.zoomSpeed ?? 1.1
    }

    this.target = this.config.target.clone()
    this.distance = this.config.distance

    // Create perspective camera
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000)

    // Create orthographic camera
    const orthoSize = 10
    this.orthoCamera = new THREE.OrthographicCamera(
      -orthoSize * aspect, orthoSize * aspect,
      orthoSize, -orthoSize,
      0.1, 1000
    )

    this.updateCameraPosition()
  }

  /**
   * Get the active camera.
   */
  getActiveCamera(): THREE.Camera {
    if (this.mode === CameraMode.ORBIT || this.mode === CameraMode.FLY) {
      return this.camera
    }
    return this.orthoCamera
  }

  /**
   * Set the target point for orbit mode.
   */
  setTarget(target: THREE.Vector3): void {
    this.target.copy(target)
    this.updateCameraPosition()
  }

  /**
   * Set the distance from target.
   */
  setDistance(distance: number): void {
    this.distance = Math.max(this.config.minDistance, Math.min(this.config.maxDistance, distance))
    this.updateCameraPosition()
  }

  /**
   * Get current distance.
   */
  getDistance(): number {
    return this.distance
  }

  /**
   * Attach to a DOM element for input handling.
   */
  attach(element: HTMLElement): void {
    this.element = element

    element.addEventListener('mousedown', this.onMouseDown)
    element.addEventListener('mousemove', this.onMouseMove)
    element.addEventListener('mouseup', this.onMouseUp)
    element.addEventListener('wheel', this.onWheel, { passive: false })
    element.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  /**
   * Detach from DOM element.
   */
  detach(): void {
    if (!this.element) return

    this.element.removeEventListener('mousedown', this.onMouseDown)
    this.element.removeEventListener('mousemove', this.onMouseMove)
    this.element.removeEventListener('mouseup', this.onMouseUp)
    this.element.removeEventListener('wheel', this.onWheel)
    this.element.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)

    this.element = null
  }

  /**
   * Update camera each frame.
   */
  update(deltaTime: number): void {
    if (this.mode === CameraMode.FLY) {
      this.updateFlyMode(deltaTime)
    }
    this.updateCameraPosition()
  }

  /**
   * Set camera mode.
   */
  setMode(mode: CameraMode): void {
    this.mode = mode
    this.updateCameraPosition()
  }

  /**
   * Focus on a position.
   */
  focusOn(position: THREE.Vector3, distance?: number): void {
    this.target.copy(position)
    if (distance !== undefined) {
      this.distance = distance
    }
    this.updateCameraPosition()
  }

  /**
   * Handle window resize.
   */
  onResize(width: number, height: number): void {
    const aspect = width / height
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()

    const size = 10
    this.orthoCamera.left = -size * aspect
    this.orthoCamera.right = size * aspect
    this.orthoCamera.top = size
    this.orthoCamera.bottom = -size
    this.orthoCamera.updateProjectionMatrix()
  }

  /**
   * Update camera position from spherical coordinates.
   */
  private updateCameraPosition(): void {
    if (this.mode === CameraMode.ORBIT) {
      // Convert spherical to Cartesian
      const x = this.distance * Math.sin(this.phi) * Math.cos(this.theta)
      const y = this.distance * Math.cos(this.phi)
      const z = this.distance * Math.sin(this.phi) * Math.sin(this.theta)

      this.camera.position.set(
        this.target.x + x,
        this.target.y + y,
        this.target.z + z
      )
      this.camera.lookAt(this.target)
    } else if (this.mode === CameraMode.ORTHO_TOP) {
      this.orthoCamera.position.set(this.target.x, this.target.y + 50, this.target.z)
      this.orthoCamera.lookAt(this.target)
      this.orthoCamera.up.set(0, 0, -1)
    } else if (this.mode === CameraMode.ORTHO_FRONT) {
      this.orthoCamera.position.set(this.target.x, this.target.y, this.target.z + 50)
      this.orthoCamera.lookAt(this.target)
      this.orthoCamera.up.set(0, 1, 0)
    } else if (this.mode === CameraMode.ORTHO_SIDE) {
      this.orthoCamera.position.set(this.target.x + 50, this.target.y, this.target.z)
      this.orthoCamera.lookAt(this.target)
      this.orthoCamera.up.set(0, 1, 0)
    }
  }

  /**
   * Update fly mode movement.
   */
  private updateFlyMode(deltaTime: number): void {
    const speed = this.config.flySpeed * deltaTime

    // Get camera direction vectors
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)

    const right = new THREE.Vector3()
    right.crossVectors(forward, this.camera.up).normalize()

    const movement = new THREE.Vector3()

    if (this.keys.has('w') || this.keys.has('arrowup')) {
      movement.add(forward.clone().multiplyScalar(speed))
    }
    if (this.keys.has('s') || this.keys.has('arrowdown')) {
      movement.add(forward.clone().multiplyScalar(-speed))
    }
    if (this.keys.has('a') || this.keys.has('arrowleft')) {
      movement.add(right.clone().multiplyScalar(-speed))
    }
    if (this.keys.has('d') || this.keys.has('arrowright')) {
      movement.add(right.clone().multiplyScalar(speed))
    }
    if (this.keys.has('e') || this.keys.has(' ')) {
      movement.y += speed
    }
    if (this.keys.has('q') || this.keys.has('shift')) {
      movement.y -= speed
    }

    this.camera.position.add(movement)
    this.target.add(movement)
  }

  // Event handlers
  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 2) {
      // Right mouse - orbit
      this.isOrbiting = true
      this.lastMouseX = e.clientX
      this.lastMouseY = e.clientY
    } else if (e.button === 1) {
      // Middle mouse - pan
      this.isPanning = true
      this.lastMouseX = e.clientX
      this.lastMouseY = e.clientY
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    const deltaX = e.clientX - this.lastMouseX
    const deltaY = e.clientY - this.lastMouseY
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY

    if (this.isOrbiting && this.mode === CameraMode.ORBIT) {
      this.theta -= deltaX * this.config.orbitSpeed
      this.phi -= deltaY * this.config.orbitSpeed

      // Clamp phi to prevent flipping
      this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi))

      this.updateCameraPosition()
    } else if (this.isPanning) {
      // Pan in camera's local space
      const right = new THREE.Vector3()
      const up = new THREE.Vector3()
      this.camera.getWorldDirection(up)
      right.crossVectors(up, new THREE.Vector3(0, 1, 0)).normalize()
      up.set(0, 1, 0)

      const panAmount = this.distance * this.config.panSpeed
      this.target.addScaledVector(right, -deltaX * panAmount)
      this.target.addScaledVector(up, deltaY * panAmount)

      this.updateCameraPosition()
    }
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.isOrbiting = false
    } else if (e.button === 1) {
      this.isPanning = false
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()

    if (this.mode === CameraMode.ORBIT) {
      // Zoom by adjusting distance
      if (e.deltaY > 0) {
        this.distance *= this.config.zoomSpeed
      } else {
        this.distance /= this.config.zoomSpeed
      }

      this.distance = Math.max(
        this.config.minDistance,
        Math.min(this.config.maxDistance, this.distance)
      )

      this.updateCameraPosition()
    }
  }

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key.toLowerCase())
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase())
  }
}
