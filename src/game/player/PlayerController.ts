// First-Person Player Controller with WASD + Mouse Look
console.log('PlayerController module loaded - v2')

import * as THREE from 'three'
import type { VoxelWorld } from '../../voxel/VoxelWorld'
import { VoxelRaycast } from '../../voxel/VoxelRaycast'
import { VoxelType, getVoxelType, worldToVoxel } from '../../voxel/VoxelTypes'
import { Config } from '../../forge/ConfigRegistry'

export interface PlayerState {
  position: THREE.Vector3
  rotation: THREE.Euler
  velocity: THREE.Vector3
  onGround: boolean
  currentRoom: string | null
}

export class PlayerController {
  public camera: THREE.PerspectiveCamera
  public state: PlayerState

  private get moveSpeed() { return Config.player.movement.walkSpeed }
  private get lookSpeed() { return Config.player.movement.lookSensitivity }
  private get playerHeight() { return Config.player.collision.height }
  private get playerRadius() { return Config.player.collision.radius }

  private keys = new Map<string, boolean>()
  private mouseLocked = false
  private enabled = true

  private pitch = 0
  private yaw = 0
  private maxPitch = Math.PI / 2 - 0.1

  // Collision
  private raycaster = new THREE.Raycaster()
  private collisionObjects: THREE.Object3D[] = []

  // Voxel collision
  private voxelWorld: VoxelWorld | null = null
  private voxelRaycast: VoxelRaycast | null = null

  constructor() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

    this.state = {
      position: new THREE.Vector3(0, this.playerHeight, 0),
      rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
      velocity: new THREE.Vector3(),
      onGround: true,
      currentRoom: null
    }

    this.camera.position.copy(this.state.position)
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true)

      // Debug: press P to print collision state
      if (e.code === 'KeyP') {
        this.debugCollision('KEY_P')
      }
    })

    document.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false)
    })

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
      if (!this.mouseLocked || !this.enabled) return

      this.yaw -= e.movementX * this.lookSpeed
      this.pitch -= e.movementY * this.lookSpeed

      // Clamp pitch
      this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch))

      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
    })

    // Pointer lock
    document.addEventListener('click', () => {
      if (!this.mouseLocked && this.enabled) {
        document.body.requestPointerLock().catch(() => {
          // Ignore pointer lock errors - can happen if user clicked during transition
        })
      }
    })

    document.addEventListener('pointerlockchange', () => {
      this.mouseLocked = document.pointerLockElement === document.body
      this.updateCrosshair()
    })
  }

  private updateCrosshair() {
    const crosshair = document.getElementById('crosshair')
    if (crosshair) {
      crosshair.style.display = this.mouseLocked ? 'block' : 'none'
    }
  }

  setCollisionObjects(objects: THREE.Object3D[]) {
    this.collisionObjects = objects
  }

  setVoxelWorld(world: VoxelWorld | null) {
    this.voxelWorld = world
    this.voxelRaycast = world ? new VoxelRaycast(world) : null
    console.log('Player voxel world set:', world ? 'yes' : 'no')
  }

  setPosition(x: number, y: number, z: number) {
    this.state.position.set(x, y + this.playerHeight, z)
    this.camera.position.copy(this.state.position)

    // Debug: check if spawn position is valid
    if (this.voxelWorld) {
      const collision = this.checkVoxelCollision(this.state.position)
      console.log(`Player spawn at (${x}, ${y}, ${z}) -> eye at (${this.state.position.x.toFixed(2)}, ${this.state.position.y.toFixed(2)}, ${this.state.position.z.toFixed(2)}), collision: ${collision}`)
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled && this.mouseLocked) {
      document.exitPointerLock()
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  isLocked(): boolean {
    return this.mouseLocked
  }

  unlock() {
    if (this.mouseLocked) {
      document.exitPointerLock()
    }
  }

  lock() {
    if (!this.mouseLocked && this.enabled) {
      // Small delay to let browser finish any pending unlock
      setTimeout(() => {
        if (!this.mouseLocked && this.enabled) {
          document.body.requestPointerLock().catch(() => {
            // Ignore pointer lock errors - user may have clicked elsewhere
          })
        }
      }, 100)
    }
  }

  update(deltaTime: number) {
    if (!this.enabled) return

    // Get movement direction
    const moveDirection = new THREE.Vector3()

    if (this.keys.get('KeyW') || this.keys.get('ArrowUp')) {
      moveDirection.z -= 1
    }
    if (this.keys.get('KeyS') || this.keys.get('ArrowDown')) {
      moveDirection.z += 1
    }
    if (this.keys.get('KeyA') || this.keys.get('ArrowLeft')) {
      moveDirection.x -= 1
    }
    if (this.keys.get('KeyD') || this.keys.get('ArrowRight')) {
      moveDirection.x += 1
    }

    // Normalize and apply camera rotation (only yaw for movement)
    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize()

      // Rotate movement direction by camera yaw
      const yawRotation = new THREE.Euler(0, this.yaw, 0)
      moveDirection.applyEuler(yawRotation)

      // Calculate desired position
      const moveAmount = moveDirection.multiplyScalar(this.moveSpeed * deltaTime)
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

  private checkCollision(position: THREE.Vector3): boolean {
    // Check voxel collision first
    if (this.voxelWorld) {
      const voxelCollision = this.checkVoxelCollision(position)
      if (voxelCollision) {
        return true
      }
    }

    // Fall back to object collision (doors, etc.)
    const playerSphere = new THREE.Sphere(position, this.playerRadius)

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
    const feetY = position.y - this.playerHeight + 0.1  // Small margin above floor

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
        const checkX = position.x + Math.cos(angle) * this.playerRadius
        const checkZ = position.z + Math.sin(angle) * this.playerRadius

        if (this.isVoxelSolid(checkX, y, checkZ)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a world position contains a solid voxel.
   */
  private isVoxelSolid(worldX: number, worldY: number, worldZ: number): boolean {
    if (!this.voxelWorld) return false

    const voxelCoord = worldToVoxel(worldX, worldY, worldZ)
    const voxel = this.voxelWorld.getVoxel(voxelCoord.x, voxelCoord.y, voxelCoord.z)
    const voxelType = getVoxelType(voxel)

    // AIR, GLASS, and METAL_GRATE are passable
    const isSolid = voxelType !== VoxelType.AIR &&
           voxelType !== VoxelType.GLASS &&
           voxelType !== VoxelType.METAL_GRATE

    return isSolid
  }

  /**
   * Debug: log collision state once at spawn
   */
  debugCollision(label: string) {
    if (!this.voxelWorld) {
      console.log(`[${label}] No voxel world`)
      return
    }

    const pos = this.state.position
    const feetY = pos.y - this.playerHeight + 0.1
    const voxelAtFeet = worldToVoxel(pos.x, feetY, pos.z)
    const voxelAtEye = worldToVoxel(pos.x, pos.y, pos.z)

    const feetVoxel = this.voxelWorld.getVoxel(voxelAtFeet.x, voxelAtFeet.y, voxelAtFeet.z)
    const eyeVoxel = this.voxelWorld.getVoxel(voxelAtEye.x, voxelAtEye.y, voxelAtEye.z)

    console.log(`[${label}] Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`)
    console.log(`[${label}] Feet voxel at (${voxelAtFeet.x}, ${voxelAtFeet.y}, ${voxelAtFeet.z}) = type ${getVoxelType(feetVoxel)}`)
    console.log(`[${label}] Eye voxel at (${voxelAtEye.x}, ${voxelAtEye.y}, ${voxelAtEye.z}) = type ${getVoxelType(eyeVoxel)}`)
    console.log(`[${label}] Collision check: ${this.checkVoxelCollision(pos)}`)
  }

  // Get the direction the player is looking
  getLookDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(this.camera.quaternion)
    return direction
  }

  // Raycast from camera center for interaction
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

  resize(width: number, height: number) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    // Clean up event listeners if needed
  }
}
