// 3D Door Geometry with animation
// Frame is now handled by voxels in the pre-built mesh.
// Only the animated panels and status light are created here.

import * as THREE from 'three'
import type { DoorDefinition } from '../../types/nodes'
import { audioSystem } from '../audio/AudioSystem'
import { VOXEL_SIZE } from '../../voxel/VoxelTypes'
import { createVoxelPanelMesh } from '../../voxel/VoxelPanelMesh'

export type DoorStateType = 'OPEN' | 'CLOSED' | 'LOCKED' | 'SEALED'

// Door dimensions in voxels (at 2.5cm per voxel)
const DOOR_WIDTH_VOXELS = 48      // 1.2m
const DOOR_HEIGHT_VOXELS = 86     // 2.15m (slightly shorter than opening to prevent Z-fighting with frame)
const PANEL_DEPTH_VOXELS = 10     // 0.25m panel thickness (thinner than frame depth to prevent overlap)

export class DoorMesh {
  public group: THREE.Group
  public definition: DoorDefinition
  public isInteractable = true

  private leftPanel: THREE.Mesh
  private rightPanel: THREE.Mesh
  private statusLight: THREE.Mesh

  // Dimensions in world units (meters)
  private doorWidth = DOOR_WIDTH_VOXELS * VOXEL_SIZE
  private doorHeight = DOOR_HEIGHT_VOXELS * VOXEL_SIZE
  private panelDepth = PANEL_DEPTH_VOXELS * VOXEL_SIZE
  private openAmount = 0
  private targetOpenAmount = 0
  private animationSpeed = 3

  private currentState: DoorStateType = 'CLOSED'

  constructor(definition: DoorDefinition) {
    this.definition = definition
    this.group = new THREE.Group()
    this.group.name = `door_${definition.id}`
    this.group.userData = { type: 'door', id: definition.id, interactable: true }

    // Door panels using voxel mesh (slide up into ceiling)
    // Voxel mesh origin is at corner (0,0,0), extends to (width, height, depth)
    const halfWidthVoxels = Math.floor(DOOR_WIDTH_VOXELS / 2)

    // Small gaps to prevent Z-fighting with frame and between panels
    const panelGap = 0.01    // 1cm gap between panels
    const floorGap = 0.025   // 2.5cm (1 voxel) gap from floor

    this.leftPanel = createVoxelPanelMesh(halfWidthVoxels, DOOR_HEIGHT_VOXELS, PANEL_DEPTH_VOXELS)
    // Position left panel: origin at left edge of doorway
    this.leftPanel.position.set(
      -this.doorWidth / 2 - panelGap,   // X: left edge with gap
      floorGap,                         // Y: slightly above floor
      -this.panelDepth / 2              // Z: center depth-wise in frame
    )
    this.group.add(this.leftPanel)

    this.rightPanel = createVoxelPanelMesh(halfWidthVoxels, DOOR_HEIGHT_VOXELS, PANEL_DEPTH_VOXELS)
    // Position right panel: origin at center of doorway
    this.rightPanel.position.set(
      panelGap,                         // X: center with gap
      floorGap,                         // Y: slightly above floor
      -this.panelDepth / 2              // Z: center depth-wise in frame
    )
    this.group.add(this.rightPanel)

    // Status light strip
    this.statusLight = this.createStatusLight()
    this.group.add(this.statusLight)

    // Position and rotate (convert voxel coords to world coords)
    const { position, rotation } = definition.properties
    this.group.position.set(
      position.x * VOXEL_SIZE,
      position.y * VOXEL_SIZE,
      position.z * VOXEL_SIZE
    )
    this.group.rotation.y = (rotation * Math.PI) / 180

    // Doors start closed - state managed by runtime based on control switch
  }

  private createStatusLight(): THREE.Mesh {
    const lightGeometry = new THREE.BoxGeometry(this.doorWidth - 0.2, 0.05, 0.02)
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      emissive: 0x888888,
      emissiveIntensity: 0.5
    })

    const light = new THREE.Mesh(lightGeometry, lightMaterial)
    // Position above the door opening, centered on the frame
    light.position.set(0, this.doorHeight + 0.1, 0)

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
      // Panels start slightly above floor, slide up by doorHeight when fully open
      const floorGap = 0.025  // Match constructor value
      const slideAmount = this.openAmount * this.doorHeight
      this.leftPanel.position.y = floorGap + slideAmount
      this.rightPanel.position.y = floorGap + slideAmount
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
