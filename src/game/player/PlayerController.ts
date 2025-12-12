// First-Person Player Controller with WASD + Mouse Look

import * as THREE from 'three'

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

  private moveSpeed = 5
  private lookSpeed = 0.002
  private playerHeight = 1.7
  private playerRadius = 0.3

  private keys = new Map<string, boolean>()
  private mouseLocked = false
  private enabled = true

  private pitch = 0
  private yaw = 0
  private maxPitch = Math.PI / 2 - 0.1

  // Collision
  private raycaster = new THREE.Raycaster()
  private collisionObjects: THREE.Object3D[] = []

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
        document.body.requestPointerLock()
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

  setPosition(x: number, y: number, z: number) {
    this.state.position.set(x, y + this.playerHeight, z)
    this.camera.position.copy(this.state.position)
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
    // Simple sphere collision check
    const playerSphere = new THREE.Sphere(position, this.playerRadius)

    for (const obj of this.collisionObjects) {
      const box = new THREE.Box3().setFromObject(obj)
      if (box.intersectsSphere(playerSphere)) {
        return true
      }
    }

    return false
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
