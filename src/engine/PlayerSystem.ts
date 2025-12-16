// Generic First-Person Player Controller
// Config-driven WASD + Mouse Look with collision detection

import * as THREE from 'three'
import type { VoxelWorld } from '../voxel/VoxelWorld'
import { VoxelRaycast } from '../voxel/VoxelRaycast'
import { getVoxelType, worldToVoxel } from '../voxel/VoxelTypes'

export interface PlayerConfig {
  // Movement
  moveSpeed: number
  lookSensitivity: number

  // Camera
  fov: number
  near: number
  far: number
  maxPitch: number

  // Collision
  height: number
  radius: number

  // Input
  keys: {
    forward: string[]
    backward: string[]
    left: string[]
    right: string[]
  }

  // Voxel collision - which voxel types are passable
  passableVoxelTypes?: Set<number>
}

export interface PlayerState {
  position: THREE.Vector3
  rotation: THREE.Euler
  velocity: THREE.Vector3
  onGround: boolean
  currentRoom: string | null
}

/**
 * Generic first-person player controller.
 * Handles WASD movement, mouse look, and collision detection.
 */
export class PlayerSystem {
  public camera: THREE.PerspectiveCamera
  public state: PlayerState

  private config: PlayerConfig
  private keys = new Map<string, boolean>()
  private mouseLocked = false
  private enabled = true

  private pitch = 0
  private yaw = 0

  // Collision
  private raycaster = new THREE.Raycaster()
  private collisionObjects: THREE.Object3D[] = []

  // Voxel collision
  private voxelWorld: VoxelWorld | null = null
  private voxelRaycast: VoxelRaycast | null = null

  // Callbacks
  private onRoomChange?: (roomId: string) => void

  constructor(config: PlayerConfig) {
    this.config = config

    this.camera = new THREE.PerspectiveCamera(
      config.fov,
      typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1,
      config.near,
      config.far
    )

    this.state = {
      position: new THREE.Vector3(0, config.height, 0),
      rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
      velocity: new THREE.Vector3(),
      onGround: true,
      currentRoom: null
    }

    this.camera.position.copy(this.state.position)
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Only setup if document exists and has addEventListener
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return

    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true)
    })

    document.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false)
    })

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
      if (!this.mouseLocked || !this.enabled) return

      this.yaw -= e.movementX * this.config.lookSensitivity
      this.pitch -= e.movementY * this.config.lookSensitivity

      // Clamp pitch
      this.pitch = Math.max(-this.config.maxPitch, Math.min(this.config.maxPitch, this.pitch))

      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    })

    // Pointer lock
    document.addEventListener('click', () => {
      if (!this.mouseLocked && this.enabled) {
        document.body.requestPointerLock().catch(() => {
          // Ignore pointer lock errors
        })
      }
    })

    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === document.body
      this.updateCrosshair()
    })
  }

  private updateCrosshair() {
    if (typeof document === 'undefined') return

    const crosshair = document.getElementById('crosshair')
    if (crosshair) {
      crosshair.style.display = this.mouseLocked ? 'block' : 'none'
    }
  }

  /**
   * Set objects to check for collision.
   */
  setCollisionObjects(objects: THREE.Object3D[]) {
    this.collisionObjects = objects
  }

  /**
   * Set voxel world for voxel-based collision.
   */
  setVoxelWorld(world: VoxelWorld | null) {
    this.voxelWorld = world
    this.voxelRaycast = world ? new VoxelRaycast(world) : null
  }

  /**
   * Set player position (y is ground level, height is added automatically).
   */
  setPosition(x: number, y: number, z: number) {
    this.state.position.set(x, y + this.config.height, z)
    this.camera.position.copy(this.state.position)
  }

  /**
   * Get player position (eye level).
   */
  getPosition(): THREE.Vector3 {
    return this.state.position.clone()
  }

  /**
   * Get player ground position (feet level).
   */
  getGroundPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.state.position.x,
      this.state.position.y - this.config.height,
      this.state.position.z
    )
  }

  /**
   * Set room change callback.
   */
  setRoomChangeCallback(callback: (roomId: string) => void) {
    this.onRoomChange = callback
  }

  /**
   * Set player enabled state.
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled && this.mouseLocked) {
      if (typeof document !== 'undefined') {
        document.exitPointerLock()
      }
    }
  }

  /**
   * Check if player is enabled.
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Check if mouse is locked.
   */
  isLocked(): boolean {
    return this.mouseLocked
  }

  /**
   * Unlock mouse pointer.
   */
  unlock() {
    if (this.mouseLocked && typeof document !== 'undefined') {
      document.exitPointerLock()
    }
  }

  /**
   * Lock mouse pointer.
   */
  lock() {
    if (!this.mouseLocked && this.enabled && typeof document !== 'undefined') {
      setTimeout(() => {
        if (!this.mouseLocked && this.enabled) {
          document.body.requestPointerLock().catch(() => {
            // Ignore pointer lock errors
          })
        }
      }, 100)
    }
  }

  /**
   * Check if any of the given keys are pressed.
   */
  private isKeyPressed(keys: string[]): boolean {
    return keys.some(key => this.keys.get(key))
  }

  /**
   * Update player movement and camera.
   */
  update(deltaTime: number) {
    if (!this.enabled) return

    // Get movement direction
    const moveDirection = new THREE.Vector3()

    if (this.isKeyPressed(this.config.keys.forward)) {
      moveDirection.z -= 1
    }
    if (this.isKeyPressed(this.config.keys.backward)) {
      moveDirection.z += 1
    }
    if (this.isKeyPressed(this.config.keys.left)) {
      moveDirection.x -= 1
    }
    if (this.isKeyPressed(this.config.keys.right)) {
      moveDirection.x += 1
    }

    // Normalize and apply camera rotation (only yaw for movement)
    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize()

      // Rotate movement direction by camera yaw
      const yawRotation = new THREE.Euler(0, this.yaw, 0)
      moveDirection.applyEuler(yawRotation)

      // Calculate desired position
      const moveAmount = moveDirection.multiplyScalar(this.config.moveSpeed * deltaTime)
      const newPosition = this.state.position.clone().add(moveAmount)

      // Collision detection
      if (!this.checkCollision(newPosition)) {
        this.state.position.copy(newPosition)
      } else {
        // Try sliding along walls
        const slideX = this.state.position.clone()
        slideX.x = newPosition.x
        if (!this.checkCollision(slideX)) {
          this.state.position.x = newPosition.x
        }

        const slideZ = this.state.position.clone()
        slideZ.z = newPosition.z
        if (!this.checkCollision(slideZ)) {
          this.state.position.z = newPosition.z
        }
      }
    }

    // Update camera position
    this.camera.position.copy(this.state.position)
  }

  /**
   * Check if position collides with any objects or voxels.
   */
  private checkCollision(position: THREE.Vector3): boolean {
    // Check voxel collision first
    if (this.voxelWorld) {
      const voxelCollision = this.checkVoxelCollision(position)
      if (voxelCollision) {
        return true
      }
    }

    // Check object collision (doors, props, etc.)
    const playerSphere = new THREE.Sphere(position, this.config.radius)

    for (const obj of this.collisionObjects) {
      const box = new THREE.Box3().setFromObject(obj)
      if (box.intersectsSphere(playerSphere)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if player position collides with solid voxels.
   * Checks a cylinder approximation around the player.
   */
  private checkVoxelCollision(position: THREE.Vector3): boolean {
    if (!this.voxelWorld) {
      return false
    }

    // Player's feet position (position is at eye level)
    const feetY = position.y - this.config.height + 0.1  // Small margin above floor

    // Check points around the player cylinder at different heights
    const checkHeights = [
      feetY,                           // Feet
      feetY + 0.5,                     // Lower body
      feetY + 1.0,                     // Mid body
      position.y - 0.2                  // Head level (slightly below eye)
    ]

    // Check points around the player radius
    const checkAngles = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2]  // 4 directions

    for (const y of checkHeights) {
      // Check center
      if (this.isVoxelSolid(position.x, y, position.z)) {
        return true
      }

      // Check around perimeter
      for (const angle of checkAngles) {
        const checkX = position.x + Math.cos(angle) * this.config.radius
        const checkZ = position.z + Math.sin(angle) * this.config.radius

        if (this.isVoxelSolid(checkX, y, checkZ)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a world position contains a solid voxel.
   * Uses passableVoxelTypes config to determine what's solid.
   */
  private isVoxelSolid(worldX: number, worldY: number, worldZ: number): boolean {
    if (!this.voxelWorld) return false

    const voxelCoord = worldToVoxel(worldX, worldY, worldZ)
    const voxel = this.voxelWorld.getVoxel(voxelCoord.x, voxelCoord.y, voxelCoord.z)
    const voxelType = getVoxelType(voxel)

    // If passableVoxelTypes is configured, use it
    if (this.config.passableVoxelTypes) {
      return !this.config.passableVoxelTypes.has(voxelType)
    }

    // Default: only AIR is passable (most conservative)
    return voxelType !== 0  // VoxelType.AIR = 0
  }

  /**
   * Get the direction the player is looking.
   */
  getLookDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(this.camera.quaternion)
    return direction
  }

  /**
   * Debug: log collision state (useful for debugging spawn positions).
   */
  debugCollision(label: string) {
    if (!this.voxelWorld) {
      console.log(`[${label}] No voxel world`)
      return
    }

    const pos = this.state.position
    const feetY = pos.y - this.config.height + 0.1
    const voxelAtFeet = worldToVoxel(pos.x, feetY, pos.z)
    const voxelAtEye = worldToVoxel(pos.x, pos.y, pos.z)

    const feetVoxel = this.voxelWorld.getVoxel(voxelAtFeet.x, voxelAtFeet.y, voxelAtFeet.z)
    const eyeVoxel = this.voxelWorld.getVoxel(voxelAtEye.x, voxelAtEye.y, voxelAtEye.z)

    console.log(`[${label}] Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`)
    console.log(`[${label}] Feet voxel at (${voxelAtFeet.x}, ${voxelAtFeet.y}, ${voxelAtFeet.z}) = type ${getVoxelType(feetVoxel)}`)
    console.log(`[${label}] Eye voxel at (${voxelAtEye.x}, ${voxelAtEye.y}, ${voxelAtEye.z}) = type ${getVoxelType(eyeVoxel)}`)
    console.log(`[${label}] Collision check: ${this.checkVoxelCollision(pos)}`)
  }

  /**
   * Raycast from camera center for interaction/targeting.
   */
  raycast(objects: THREE.Object3D[]): THREE.Intersection | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    const intersects = this.raycaster.intersectObjects(objects, true)

    // Find first interactable object
    for (const intersect of intersects) {
      let obj: THREE.Object3D | null = intersect.object
      while (obj) {
        if (obj.userData['interactable']) {
          return { ...intersect, object: obj }
        }
        obj = obj.parent
      }
    }

    return intersects.length > 0 ? intersects[0]! : null
  }

  /**
   * Handle window resize.
   */
  resize(width: number, height: number) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  /**
   * Clean up resources.
   */
  dispose() {
    // Event listeners are cleaned up by garbage collection
  }
}
