// Generic Interaction System - Forge-driven player interactions
// Handles raycasting, target detection, and executes Forge interaction handlers

import * as THREE from 'three'
import { ForgeVM, type VMInteraction } from '../forge/vm'

/**
 * Entity data for interaction matching.
 * This is passed to ForgeVM to find matching interactions.
 */
export interface InteractableEntity {
  type: string
  id: string
  name?: string
  status?: string
  voxel_type?: string
  [key: string]: unknown  // Additional properties
}

/**
 * Raycast result with entity data.
 */
export interface InteractionTarget {
  entity: InteractableEntity
  object: THREE.Object3D
  distance: number
  worldPosition: THREE.Vector3
}

/**
 * Callbacks for interaction events.
 */
export interface InteractionCallbacks {
  onInteract?: (interactionName: string, target: InteractableEntity) => void
  onTargetChanged?: (target: InteractionTarget | null) => void
}

/**
 * Generic interaction system that uses Forge-defined interactions.
 *
 * Responsibilities:
 * - Raycasting to find interactable targets
 * - Querying ForgeVM for matching interactions
 * - Displaying interaction prompts
 * - Executing Forge interaction handlers
 */
export class InteractionSystem {
  private vm: ForgeVM
  private callbacks: InteractionCallbacks

  private currentTarget: InteractionTarget | null = null
  private currentInteraction: VMInteraction | null = null

  // Configuration
  private interactionRange: number
  private interactionKey: string

  // UI elements (optional - can be null if UI is handled externally)
  private promptElement: HTMLElement | null = null
  private crosshairElement: HTMLElement | null = null

  // Raycast setup
  private raycaster = new THREE.Raycaster()
  private rayOrigin = new THREE.Vector3()
  private rayDirection = new THREE.Vector3()

  constructor(
    vm: ForgeVM,
    options: {
      interactionRange?: number
      interactionKey?: string
      promptElement?: HTMLElement | null
      crosshairElement?: HTMLElement | null
      callbacks?: InteractionCallbacks
    } = {}
  ) {
    this.vm = vm
    this.interactionRange = options.interactionRange ?? 3.0
    this.interactionKey = options.interactionKey ?? 'KeyE'
    this.promptElement = options.promptElement ?? null
    this.crosshairElement = options.crosshairElement ?? null
    this.callbacks = options.callbacks ?? {}

    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Only setup if document exists and has addEventListener (not in test environment)
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return

    document.addEventListener('keydown', (e) => {
      if (e.code === this.interactionKey) {
        this.executeInteraction()
      }
    })
  }

  /**
   * Update interaction targeting. Call this every frame.
   * @param rayOrigin World position to cast ray from (usually camera position)
   * @param rayDirection Direction to cast ray (usually camera look direction)
   * @param interactableObjects Objects that can be interacted with
   */
  update(
    rayOrigin: THREE.Vector3,
    rayDirection: THREE.Vector3,
    interactableObjects: THREE.Object3D[]
  ) {
    this.rayOrigin.copy(rayOrigin)
    this.rayDirection.copy(rayDirection).normalize()

    // Setup raycaster
    this.raycaster.set(this.rayOrigin, this.rayDirection)
    this.raycaster.far = this.interactionRange

    // Raycast to find targets
    const intersections = this.raycaster.intersectObjects(interactableObjects, true)

    if (intersections.length === 0) {
      this.clearTarget()
      return
    }

    // Find first intersection with valid entity data
    for (const intersection of intersections) {
      const target = this.extractEntityData(intersection)
      if (target) {
        this.setTarget(target)
        return
      }
    }

    this.clearTarget()
  }

  /**
   * Extract entity data from a raycast intersection.
   * Traverses up the parent chain to find userData with entity info.
   */
  private extractEntityData(intersection: THREE.Intersection): InteractionTarget | null {
    let obj: THREE.Object3D | null = intersection.object

    // Traverse up to find userData with type and id
    while (obj) {
      const userData = obj.userData as Partial<InteractableEntity>
      if (userData.type && userData.id) {
        return {
          entity: {
            type: userData.type,
            id: userData.id,
            name: userData.name,
            status: userData.status,
            voxel_type: userData.voxel_type,
            ...userData
          },
          object: intersection.object,
          distance: intersection.distance,
          worldPosition: intersection.point.clone()
        }
      }
      obj = obj.parent
    }

    return null
  }

  /**
   * Set the current interaction target.
   */
  private setTarget(target: InteractionTarget) {
    // Check if target changed
    const targetChanged = !this.currentTarget ||
                         this.currentTarget.entity.id !== target.entity.id

    this.currentTarget = target

    if (targetChanged) {
      // Find matching interaction from Forge
      const interactions = this.vm.findMatchingInteractions(target.entity)
      this.currentInteraction = interactions[0] ?? null  // Use first matching interaction

      // Update UI
      this.updatePrompt()
      this.setCrosshairInteractive(true)

      // Notify callback
      this.callbacks.onTargetChanged?.(target)
    }
  }

  /**
   * Clear the current target.
   */
  private clearTarget() {
    if (!this.currentTarget) return

    this.currentTarget = null
    this.currentInteraction = null

    this.hidePrompt()
    this.setCrosshairInteractive(false)

    this.callbacks.onTargetChanged?.(null)
  }

  /**
   * Execute the current interaction.
   */
  private executeInteraction() {
    if (!this.currentTarget || !this.currentInteraction) return

    // Execute Forge interaction handler
    this.vm.executeInteraction(this.currentInteraction.name, this.currentTarget.entity)

    // Notify callback
    this.callbacks.onInteract?.(this.currentInteraction.name, this.currentTarget.entity)
  }

  /**
   * Update the interaction prompt based on current target.
   */
  private updatePrompt() {
    if (!this.promptElement || !this.currentTarget || !this.currentInteraction) {
      this.hidePrompt()
      return
    }

    // Get prompt from Forge (supports {name} template substitution)
    const isBroken = this.currentTarget.entity.status === 'FAULT'
    const prompt = this.vm.getInteractionPrompt(
      this.currentInteraction.name,
      this.currentTarget.entity,
      isBroken
    )

    if (!prompt) {
      this.hidePrompt()
      return
    }

    // Format prompt - replace [E] with <kbd>E</kbd> for styling
    const formattedPrompt = prompt.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>')

    // Apply color for broken items
    if (isBroken) {
      this.promptElement.innerHTML = `<span style="color: #ff4444;">${formattedPrompt}</span>`
    } else {
      this.promptElement.innerHTML = formattedPrompt
    }

    this.promptElement.classList.add('visible')
  }

  /**
   * Hide the interaction prompt.
   */
  private hidePrompt() {
    if (this.promptElement) {
      this.promptElement.classList.remove('visible')
    }
  }

  /**
   * Set crosshair interactive state.
   */
  private setCrosshairInteractive(interactive: boolean) {
    if (!this.crosshairElement) return

    if (interactive) {
      this.crosshairElement.classList.add('interactive')
    } else {
      this.crosshairElement.classList.remove('interactive')
    }
  }

  /**
   * Get the current interaction target.
   */
  getCurrentTarget(): InteractionTarget | null {
    return this.currentTarget
  }

  /**
   * Get the current interaction definition.
   */
  getCurrentInteraction(): VMInteraction | null {
    return this.currentInteraction
  }

  /**
   * Set the interaction range.
   */
  setInteractionRange(range: number) {
    this.interactionRange = range
  }

  /**
   * Dispose of the interaction system.
   */
  dispose() {
    // Clean up event listeners if needed
  }
}
