// 3D Switch - Wall-mounted control switch

import * as THREE from 'three'
import type { SwitchDefinition } from '../../types/nodes'
import { audioSystem } from '../audio/AudioSystem'

export class SwitchMesh {
  public group: THREE.Group
  public definition: SwitchDefinition
  public isInteractable = true

  private plate: THREE.Mesh
  private button: THREE.Mesh
  private statusLight: THREE.Mesh

  private plateWidth = 0.15
  private plateHeight = 0.2
  private plateDepth = 0.03

  constructor(definition: SwitchDefinition) {
    this.definition = definition
    this.group = new THREE.Group()
    this.group.name = `switch_${definition.id}`
    this.group.userData = { type: 'switch', id: definition.id, interactable: true }

    // Wall plate
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4a5a,
      roughness: 0.7,
      metalness: 0.3,
    })

    const plateGeometry = new THREE.BoxGeometry(
      this.plateWidth,
      this.plateHeight,
      this.plateDepth
    )

    this.plate = new THREE.Mesh(plateGeometry, plateMaterial)
    this.plate.castShadow = true
    this.group.add(this.plate)

    // Button/switch
    const buttonGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16)
    const buttonMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.4,
      metalness: 0.6,
    })

    this.button = new THREE.Mesh(buttonGeometry, buttonMaterial)
    this.button.rotation.x = Math.PI / 2
    this.button.position.z = this.plateDepth / 2 + 0.01
    this.group.add(this.button)

    // Status light (small LED)
    const lightGeometry = new THREE.CircleGeometry(0.015, 16)
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: definition.properties.status === 'OK' ? 0x44ff44 : 0xff4444,
      emissive: definition.properties.status === 'OK' ? 0x44ff44 : 0xff4444,
      emissiveIntensity: 0.5,
    })

    this.statusLight = new THREE.Mesh(lightGeometry, lightMaterial)
    this.statusLight.position.set(0, this.plateHeight / 2 - 0.03, this.plateDepth / 2 + 0.001)
    this.group.add(this.statusLight)

    // Position and rotate
    const { position, rotation } = definition.properties
    this.group.position.set(position.x, position.y + 1.2, position.z) // Mount at ~1.2m height
    this.group.rotation.y = (rotation * Math.PI) / 180
  }

  getStatus(): 'OK' | 'FAULT' {
    return this.definition.properties.status
  }

  // Visual feedback when pressed
  press() {
    // Play click sound
    audioSystem.playSwitchClick(this.group.position, true)

    // Animate button press
    this.button.position.z = this.plateDepth / 2 - 0.005
    setTimeout(() => {
      this.button.position.z = this.plateDepth / 2 + 0.01
    }, 100)

    // Blink the LED
    const lightMaterial = this.statusLight.material as THREE.MeshStandardMaterial
    const originalColor = lightMaterial.color.getHex()

    // Flash bright
    lightMaterial.color.setHex(0xffffff)
    lightMaterial.emissive.setHex(0xffffff)
    lightMaterial.emissiveIntensity = 1.0

    // Return to normal after brief flash
    setTimeout(() => {
      lightMaterial.color.setHex(originalColor)
      lightMaterial.emissive.setHex(originalColor)
      lightMaterial.emissiveIntensity = 0.5
    }, 150)
  }

  // Called when broken switch is pressed - plays fault sounds
  pressBroken() {
    // Play broken click sound and sparks
    audioSystem.playSwitchClick(this.group.position, false)
    audioSystem.playSparks(this.group.position)

    // Slight button movement but no satisfying click
    this.button.position.z = this.plateDepth / 2 - 0.002
    setTimeout(() => {
      this.button.position.z = this.plateDepth / 2 + 0.01
    }, 50)

    // Flicker the red LED erratically
    const lightMaterial = this.statusLight.material as THREE.MeshStandardMaterial
    const flicker = () => {
      lightMaterial.emissiveIntensity = Math.random() * 0.8 + 0.2
    }
    const flickerInterval = setInterval(flicker, 50)
    setTimeout(() => {
      clearInterval(flickerInterval)
      lightMaterial.emissiveIntensity = 0.5
    }, 300)
  }

  updateStatus(status: 'OK' | 'FAULT') {
    this.definition.properties.status = status
    const lightMaterial = this.statusLight.material as THREE.MeshStandardMaterial
    if (status === 'OK') {
      lightMaterial.color.setHex(0x44ff44)
      lightMaterial.emissive.setHex(0x44ff44)
    } else {
      lightMaterial.color.setHex(0xff4444)
      lightMaterial.emissive.setHex(0xff4444)
    }
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
