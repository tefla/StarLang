/**
 * Runtime instance of an animated asset.
 *
 * Creates THREE.js objects for dynamic parts and manages
 * state/animation based on runtime property changes.
 *
 * This is the data-driven equivalent of DoorMesh - instead of
 * hardcoded behavior, it reads from the asset JSON definition.
 */

import * as THREE from 'three'
import type {
  AnimatedAssetDef,
  StateBindingAction,
} from './AnimatedAsset'
import { DynamicPartMesh } from './DynamicPartMesh'
import { AnimationController } from './AnimationController'
import type { Rotation90 } from './VoxelAsset'
import { VOXEL_SIZE } from './VoxelTypes'

export interface AnimatedAssetInstanceOptions {
  castShadow?: boolean
  receiveShadow?: boolean
}

/**
 * A runtime instance of an animated asset.
 */
export class AnimatedAssetInstance {
  /** The THREE.js group containing all parts */
  public group: THREE.Group
  /** The asset definition this instance was created from */
  public definition: AnimatedAssetDef
  /** User data for raycasting/interaction */
  public userData: Record<string, unknown> = {}

  private parts: Map<string, DynamicPartMesh> = new Map()
  private animationController: AnimationController
  private currentParams: Record<string, string | number | boolean> = {}
  private instanceId: string

  /** Continuous spin configuration for rotating parts (e.g., fans) */
  private continuousSpin: {
    axis: 'x' | 'y' | 'z'
    speed: number
    partIds?: string[]  // If specified, only spin these parts
  } | null = null

  constructor(
    definition: AnimatedAssetDef,
    position: { x: number; y: number; z: number },
    rotation: Rotation90 = 0,
    initialParams: Record<string, string | number | boolean> = {},
    options: AnimatedAssetInstanceOptions = {}
  ) {
    this.definition = definition
    this.instanceId = `${definition.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.group = new THREE.Group()
    this.group.name = `AnimatedAsset_${definition.id}`
    this.group.userData = {
      type: 'animatedAsset',
      assetId: definition.id,
      instanceId: this.instanceId,
    }

    // Create dynamic part meshes
    if (definition.dynamicParts) {
      for (const partDef of definition.dynamicParts) {
        const partMesh = new DynamicPartMesh(partDef, {
          castShadow: options.castShadow,
          receiveShadow: options.receiveShadow,
        })
        this.parts.set(partDef.id, partMesh)
        this.group.add(partMesh.group)
      }
    }

    // Create animation controller
    this.animationController = new AnimationController(
      this.parts,
      definition.states ?? {},
      definition.animations ?? {}
    )

    // Position and rotate the instance
    this.group.position.set(
      position.x * VOXEL_SIZE,
      position.y * VOXEL_SIZE,
      position.z * VOXEL_SIZE
    )
    this.group.rotation.y = (rotation * Math.PI) / 180

    // Initialize with default parameters from definition
    if (definition.parameters) {
      for (const [name, paramDef] of Object.entries(definition.parameters)) {
        this.currentParams[name] = paramDef.default
      }
    }

    // Override with provided initial params
    for (const [name, value] of Object.entries(initialParams)) {
      this.currentParams[name] = value
    }

    // Apply initial state bindings
    this.applyAllBindings()

    // Apply default state if it exists (for emissive, colors, etc.)
    if (definition.states?.['default']) {
      this.animationController.setState('default')
    }
  }

  /**
   * Get the instance ID.
   */
  getId(): string {
    return this.instanceId
  }

  /**
   * Get current parameter value.
   */
  getParam(name: string): string | number | boolean | undefined {
    return this.currentParams[name]
  }

  /**
   * Get all current parameters.
   */
  getParams(): Record<string, string | number | boolean> {
    return { ...this.currentParams }
  }

  /**
   * Update a parameter value (triggers state bindings).
   */
  setParam(name: string, value: string | number | boolean): void {
    const oldValue = this.currentParams[name]
    if (oldValue === value) return

    this.currentParams[name] = value
    this.applyParamBinding(name, value)
  }

  /**
   * Update multiple parameters at once.
   */
  setParams(params: Record<string, string | number | boolean>): void {
    for (const [name, value] of Object.entries(params)) {
      this.setParam(name, value)
    }
  }

  /**
   * Apply state bindings for all current parameters.
   */
  private applyAllBindings(): void {
    for (const [name, value] of Object.entries(this.currentParams)) {
      this.applyParamBinding(name, value)
    }
  }

  /**
   * Apply state binding for a parameter change.
   */
  private applyParamBinding(
    paramName: string,
    value: string | number | boolean
  ): void {
    const bindings = this.definition.stateBindings?.[paramName]
    if (!bindings) return

    const action = bindings[String(value)]
    if (!action) return

    this.executeAction(action)
  }

  /**
   * Execute a state binding action.
   */
  private executeAction(action: StateBindingAction): void {
    // Stop animation first (if specified)
    if (action.stopAnimation) {
      this.animationController.stopAnimation(action.stopAnimation)
    }

    // Set state (instant transition)
    if (action.setState) {
      this.animationController.setState(action.setState)
    }

    // Play animation (after state is set)
    if (action.playAnimation) {
      this.animationController.playAnimation(action.playAnimation)
    }
  }

  /**
   * Update animations and continuous effects (call each frame).
   */
  update(deltaTime: number): void {
    this.animationController.update(deltaTime)

    // Apply continuous spin if enabled
    if (this.continuousSpin) {
      const { axis, speed, partIds } = this.continuousSpin
      const rotation = speed * deltaTime

      for (const [partId, part] of this.parts) {
        // If partIds specified, only spin those parts
        if (partIds && !partIds.includes(partId)) continue
        part.group.rotation[axis] += rotation
      }
    }
  }

  /**
   * Enable continuous rotation for the asset (e.g., fan blades).
   * @param axis The axis to rotate around ('x', 'y', or 'z')
   * @param speed Rotation speed in radians per second
   * @param partIds Optional array of part IDs to spin (default: all parts)
   */
  enableContinuousSpin(
    axis: 'x' | 'y' | 'z',
    speed: number,
    partIds?: string[]
  ): void {
    this.continuousSpin = { axis, speed, partIds }
  }

  /**
   * Disable continuous rotation.
   */
  disableContinuousSpin(): void {
    this.continuousSpin = null
  }

  /**
   * Check if continuous spin is enabled.
   */
  isContinuousSpinEnabled(): boolean {
    return this.continuousSpin !== null
  }

  /**
   * Get current spin configuration.
   */
  getContinuousSpin(): { axis: 'x' | 'y' | 'z'; speed: number; partIds?: string[] } | null {
    return this.continuousSpin ? { ...this.continuousSpin } : null
  }

  /**
   * Play an animation directly.
   */
  playAnimation(name: string): void {
    this.animationController.playAnimation(name)
  }

  /**
   * Stop an animation directly.
   */
  stopAnimation(name: string): void {
    this.animationController.stopAnimation(name)
  }

  /**
   * Stop all animations.
   */
  stopAllAnimations(): void {
    this.animationController.stopAllAnimations()
  }

  /**
   * Check if an animation is playing.
   */
  isAnimationPlaying(name: string): boolean {
    return this.animationController.isAnimationPlaying(name)
  }

  /**
   * Set state directly (bypassing bindings).
   */
  setState(name: string): void {
    this.animationController.setState(name)
  }

  /**
   * Get current state name.
   */
  getCurrentState(): string | null {
    return this.animationController.getCurrentState()
  }

  /**
   * Get available state names.
   */
  getStateNames(): string[] {
    return this.animationController.getStateNames()
  }

  /**
   * Get available animation names.
   */
  getAnimationNames(): string[] {
    return this.animationController.getAnimationNames()
  }

  /**
   * Seek to a specific time in an animation (for editor preview).
   */
  seekAnimation(animationName: string, normalizedTime: number): void {
    this.animationController.seekAnimation(animationName, normalizedTime)
  }

  /**
   * Set callback for animation completion events.
   */
  setAnimationCompleteCallback(callback: ((animationName: string) => void) | undefined): void {
    this.animationController.onAnimationComplete = callback
  }

  /**
   * Get world position.
   */
  getWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3()
    this.group.getWorldPosition(pos)
    return pos
  }

  /**
   * Get bounding box.
   */
  getBoundingBox(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.group)
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    for (const part of this.parts.values()) {
      part.dispose()
    }
    this.parts.clear()
  }
}
