// 3D Door Geometry with animation

import * as THREE from 'three'
import type { DoorDefinition } from '../../types/nodes'
import { audioSystem } from '../audio/AudioSystem'

export type DoorStateType = 'OPEN' | 'CLOSED' | 'LOCKED' | 'SEALED'

export class DoorMesh {
  public group: THREE.Group
  public definition: DoorDefinition
  public isInteractable = true

  private leftPanel: THREE.Mesh
  private rightPanel: THREE.Mesh
  private frame: THREE.Group
  private statusLight: THREE.Mesh

  private doorWidth = 1.2
  private doorHeight = 2.4
  private panelThickness = 0.1
  private openAmount = 0
  private targetOpenAmount = 0
  private animationSpeed = 3

  private currentState: DoorStateType = 'CLOSED'

  constructor(definition: DoorDefinition) {
    this.definition = definition
    this.group = new THREE.Group()
    this.group.name = `door_${definition.id}`
    this.group.userData = { type: 'door', id: definition.id, interactable: true }

    // Door frame
    this.frame = this.createFrame()
    this.group.add(this.frame)

    // Door panels (slide into walls)
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5a6a,
      roughness: 0.5,
      metalness: 0.6,
    })

    const panelGeometry = new THREE.BoxGeometry(
      this.doorWidth / 2,
      this.doorHeight - 0.1,
      this.panelThickness
    )

    this.leftPanel = new THREE.Mesh(panelGeometry, panelMaterial)
    this.leftPanel.position.set(-this.doorWidth / 4, this.doorHeight / 2, 0)
    this.leftPanel.castShadow = true
    this.group.add(this.leftPanel)

    this.rightPanel = new THREE.Mesh(panelGeometry, panelMaterial)
    this.rightPanel.position.set(this.doorWidth / 4, this.doorHeight / 2, 0)
    this.rightPanel.castShadow = true
    this.group.add(this.rightPanel)

    // Status light strip
    this.statusLight = this.createStatusLight()
    this.group.add(this.statusLight)

    // Position and rotate
    const { position, rotation } = definition.properties
    this.group.position.set(position.x, position.y, position.z)
    this.group.rotation.y = (rotation * Math.PI) / 180

    // Doors start closed - state managed by runtime based on control switch
  }

  private createFrame(): THREE.Group {
    const frame = new THREE.Group()
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4a5a,
      roughness: 0.6,
      metalness: 0.4,
    })

    const frameThickness = 0.15

    // Top frame
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(this.doorWidth + frameThickness * 2, frameThickness, this.panelThickness + 0.1),
      frameMaterial
    )
    topFrame.position.set(0, this.doorHeight + frameThickness / 2, 0)
    frame.add(topFrame)

    // Left frame
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameThickness, this.doorHeight, this.panelThickness + 0.1),
      frameMaterial
    )
    leftFrame.position.set(-this.doorWidth / 2 - frameThickness / 2, this.doorHeight / 2, 0)
    frame.add(leftFrame)

    // Right frame
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameThickness, this.doorHeight, this.panelThickness + 0.1),
      frameMaterial
    )
    rightFrame.position.set(this.doorWidth / 2 + frameThickness / 2, this.doorHeight / 2, 0)
    frame.add(rightFrame)

    return frame
  }

  private createStatusLight(): THREE.Mesh {
    const lightGeometry = new THREE.BoxGeometry(this.doorWidth - 0.2, 0.05, 0.02)
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      emissive: 0x888888,
      emissiveIntensity: 0.5
    })

    const light = new THREE.Mesh(lightGeometry, lightMaterial)
    light.position.set(0, this.doorHeight + 0.1, this.panelThickness / 2 + 0.02)

    return light
  }

  setState(state: DoorStateType) {
    const previousState = this.currentState
    this.currentState = state
    const lightMaterial = this.statusLight.material as THREE.MeshStandardMaterial

    // Play door sound when state changes
    if (previousState !== state) {
      if (state === 'OPEN') {
        audioSystem.playDoorSound(this.group.position, true)
      } else if (previousState === 'OPEN') {
        audioSystem.playDoorSound(this.group.position, false)
      }
    }

    switch (state) {
      case 'OPEN':
        this.targetOpenAmount = 1
        lightMaterial.color.setHex(0x77dd77)
        lightMaterial.emissive.setHex(0x77dd77)
        break
      case 'CLOSED':
        this.targetOpenAmount = 0
        lightMaterial.color.setHex(0x888888)
        lightMaterial.emissive.setHex(0x888888)
        break
      case 'LOCKED':
        this.targetOpenAmount = 0
        lightMaterial.color.setHex(0xffb347)
        lightMaterial.emissive.setHex(0xffb347)
        break
      case 'SEALED':
        this.targetOpenAmount = 0
        lightMaterial.color.setHex(0xff6b6b)
        lightMaterial.emissive.setHex(0xff6b6b)
        break
    }
  }

  getState(): DoorStateType {
    return this.currentState
  }

  update(deltaTime: number) {
    // Animate door opening/closing
    if (Math.abs(this.openAmount - this.targetOpenAmount) > 0.01) {
      const direction = this.targetOpenAmount > this.openAmount ? 1 : -1
      this.openAmount += direction * this.animationSpeed * deltaTime

      // Clamp
      if (direction > 0 && this.openAmount > this.targetOpenAmount) {
        this.openAmount = this.targetOpenAmount
      } else if (direction < 0 && this.openAmount < this.targetOpenAmount) {
        this.openAmount = this.targetOpenAmount
      }

      // Slide panels UP into ceiling (avoids clipping through walls)
      const slideAmount = this.openAmount * this.doorHeight
      this.leftPanel.position.y = this.doorHeight / 2 + slideAmount
      this.rightPanel.position.y = this.doorHeight / 2 + slideAmount
    }
  }

  // Check if player can pass through (based on target state, not animation)
  canPassThrough(): boolean {
    return this.currentState === 'OPEN'
  }

  // Get bounding box for collision
  getBoundingBox(): THREE.Box3 {
    if (this.canPassThrough()) {
      // Return empty box when door is open
      return new THREE.Box3()
    }
    return new THREE.Box3().setFromObject(this.group)
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose()
        }
      }
    })
  }
}
