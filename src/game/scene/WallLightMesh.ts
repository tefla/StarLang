// 3D Wall Light - Wall-mounted light fixture with point light

import * as THREE from 'three'
import type { WallLightDefinition } from '../../types/nodes'

export class WallLightMesh {
  public group: THREE.Group
  public definition: WallLightDefinition
  public light: THREE.PointLight

  private fixture: THREE.Mesh
  private bulb: THREE.Mesh
  private isOn = true
  private baseIntensity: number
  private baseColor: THREE.Color

  constructor(definition: WallLightDefinition) {
    this.definition = definition
    this.group = new THREE.Group()
    this.group.name = `wall_light_${definition.id}`
    this.group.userData = { type: 'wallLight', id: definition.id }

    // Parse color from hex string
    this.baseColor = new THREE.Color(definition.properties.color)
    this.baseIntensity = definition.properties.intensity

    // Create fixture (small box mounted to wall)
    const fixtureGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.06)
    const fixtureMaterial = new THREE.MeshStandardMaterial({
      color: 0x444455,
      roughness: 0.6,
      metalness: 0.4,
    })
    this.fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial)
    this.group.add(this.fixture)

    // Create bulb/lens (glowing part)
    const bulbGeometry = new THREE.SphereGeometry(0.04, 16, 8)
    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: this.baseColor,
      emissive: this.baseColor,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    })
    this.bulb = new THREE.Mesh(bulbGeometry, bulbMaterial)
    this.bulb.position.z = 0.04
    this.group.add(this.bulb)

    // Create point light
    this.light = new THREE.PointLight(
      this.baseColor,
      this.baseIntensity * 2,
      8,  // distance
      1.5 // decay
    )
    this.light.position.z = 0.06
    this.light.castShadow = false
    this.group.add(this.light)

    // Position and rotate
    const { position, rotation } = definition.properties
    const rotationRad = (rotation * Math.PI) / 180

    // Offset into room (forward from wall) so light appears on inner wall surface
    // Wall thickness is ~0.2, offset just enough to touch inner surface
    const wallOffset = 0.12
    const offsetX = Math.sin(rotationRad) * wallOffset
    const offsetZ = Math.cos(rotationRad) * wallOffset

    this.group.position.set(position.x + offsetX, position.y, position.z + offsetZ)
    this.group.rotation.y = rotationRad
  }

  // Turn light on
  turnOn() {
    if (this.isOn) return
    this.isOn = true

    this.light.intensity = this.baseIntensity * 2
    const bulbMaterial = this.bulb.material as THREE.MeshStandardMaterial
    bulbMaterial.emissiveIntensity = 0.8
  }

  // Turn light off
  turnOff() {
    if (!this.isOn) return
    this.isOn = false

    this.light.intensity = 0
    const bulbMaterial = this.bulb.material as THREE.MeshStandardMaterial
    bulbMaterial.emissiveIntensity = 0.05
  }

  // Set intensity (0-5 scale)
  setIntensity(intensity: number) {
    this.baseIntensity = intensity
    if (this.isOn) {
      this.light.intensity = this.baseIntensity * 2
    }
  }

  // Set color
  setColor(color: string | number) {
    this.baseColor.set(color)
    this.light.color.copy(this.baseColor)
    const bulbMaterial = this.bulb.material as THREE.MeshStandardMaterial
    bulbMaterial.color.copy(this.baseColor)
    bulbMaterial.emissive.copy(this.baseColor)
  }

  // Flicker effect (for dramatic moments)
  flicker(duration = 500) {
    const startTime = Date.now()
    const originalIntensity = this.light.intensity
    const bulbMaterial = this.bulb.material as THREE.MeshStandardMaterial
    const originalEmissive = bulbMaterial.emissiveIntensity

    const doFlicker = () => {
      const elapsed = Date.now() - startTime
      if (elapsed >= duration) {
        this.light.intensity = this.isOn ? this.baseIntensity * 2 : 0
        bulbMaterial.emissiveIntensity = this.isOn ? 0.8 : 0.05
        return
      }

      const flickerValue = Math.random() * 0.8 + 0.2
      this.light.intensity = this.baseIntensity * 2 * flickerValue
      bulbMaterial.emissiveIntensity = 0.8 * flickerValue

      requestAnimationFrame(doFlicker)
    }

    doFlicker()
  }

  getIsOn(): boolean {
    return this.isOn
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
