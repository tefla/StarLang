/**
 * CameraSystem - Configurable camera primitive for the game engine
 *
 * Supports both perspective and orthographic cameras, configured from Forge.
 * Used by Game.ts based on controller type in the game definition.
 */

import * as THREE from 'three'

// ============================================================================
// Types
// ============================================================================

export interface CameraConfig {
  type: 'perspective' | 'orthographic'
  position: { x: number; y: number; z: number }
  lookAt?: { x: number; y: number; z: number }

  // Perspective options
  fov?: number
  near?: number
  far?: number

  // Orthographic options
  viewSize?: number
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_PERSPECTIVE: Partial<CameraConfig> = {
  fov: 75,
  near: 0.1,
  far: 1000,
}

const DEFAULT_ORTHOGRAPHIC: Partial<CameraConfig> = {
  viewSize: 10,
  near: 0.1,
  far: 100,
}

// ============================================================================
// CameraSystem Class
// ============================================================================

export class CameraSystem {
  public camera: THREE.Camera
  private config: CameraConfig
  private aspect: number = 1

  constructor(config: CameraConfig, aspect: number = 1) {
    this.config = config
    this.aspect = aspect

    if (config.type === 'orthographic') {
      this.camera = this.createOrthographicCamera()
    } else {
      this.camera = this.createPerspectiveCamera()
    }

    // Set position
    this.camera.position.set(
      config.position.x,
      config.position.y,
      config.position.z
    )

    // Set lookAt if specified
    if (config.lookAt) {
      this.camera.lookAt(
        config.lookAt.x,
        config.lookAt.y,
        config.lookAt.z
      )
    }
  }

  private createPerspectiveCamera(): THREE.PerspectiveCamera {
    const fov = this.config.fov ?? DEFAULT_PERSPECTIVE.fov!
    const near = this.config.near ?? DEFAULT_PERSPECTIVE.near!
    const far = this.config.far ?? DEFAULT_PERSPECTIVE.far!

    return new THREE.PerspectiveCamera(fov, this.aspect, near, far)
  }

  private createOrthographicCamera(): THREE.OrthographicCamera {
    const viewSize = this.config.viewSize ?? DEFAULT_ORTHOGRAPHIC.viewSize!
    const near = this.config.near ?? DEFAULT_ORTHOGRAPHIC.near!
    const far = this.config.far ?? DEFAULT_ORTHOGRAPHIC.far!

    const halfWidth = (viewSize * this.aspect) / 2
    const halfHeight = viewSize / 2

    return new THREE.OrthographicCamera(
      -halfWidth,  // left
      halfWidth,   // right
      halfHeight,  // top
      -halfHeight, // bottom
      near,
      far
    )
  }

  /**
   * Get the THREE.js camera.
   */
  getCamera(): THREE.Camera {
    return this.camera
  }

  /**
   * Check if camera is orthographic.
   */
  isOrthographic(): boolean {
    return this.config.type === 'orthographic'
  }

  /**
   * Check if camera is perspective.
   */
  isPerspective(): boolean {
    return this.config.type === 'perspective'
  }

  /**
   * Get the camera position.
   */
  getPosition(): THREE.Vector3 {
    return this.camera.position.clone()
  }

  /**
   * Set the camera position.
   */
  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z)
  }

  /**
   * Set where the camera looks at.
   */
  setLookAt(x: number, y: number, z: number): void {
    this.camera.lookAt(x, y, z)
  }

  /**
   * Handle window resize.
   */
  resize(width: number, height: number): void {
    this.aspect = width / height

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = this.aspect
      this.camera.updateProjectionMatrix()
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      const viewSize = this.config.viewSize ?? DEFAULT_ORTHOGRAPHIC.viewSize!
      const halfWidth = (viewSize * this.aspect) / 2
      const halfHeight = viewSize / 2

      this.camera.left = -halfWidth
      this.camera.right = halfWidth
      this.camera.top = halfHeight
      this.camera.bottom = -halfHeight
      this.camera.updateProjectionMatrix()
    }
  }

  /**
   * Create a default perspective camera (for backwards compatibility).
   */
  static createDefaultPerspective(aspect: number = 1): CameraSystem {
    return new CameraSystem({
      type: 'perspective',
      position: { x: 0, y: 1.6, z: 0 },
      fov: 75,
      near: 0.1,
      far: 1000,
    }, aspect)
  }

  /**
   * Create a top-down orthographic camera for games like Pong.
   */
  static createTopDown(viewSize: number = 14, height: number = 15, aspect: number = 1): CameraSystem {
    return new CameraSystem({
      type: 'orthographic',
      position: { x: 0, y: height, z: 0 },
      lookAt: { x: 0, y: 0, z: 0 },
      viewSize,
      near: 0.1,
      far: 100,
    }, aspect)
  }
}
