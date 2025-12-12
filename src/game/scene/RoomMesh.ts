// 3D Room Geometry

import * as THREE from 'three'
import type { RoomDefinition } from '../../types/nodes'

export class RoomMesh {
  public group: THREE.Group
  public definition: RoomDefinition

  private walls: THREE.Mesh[] = []
  private floor: THREE.Mesh
  private ceiling: THREE.Mesh
  private ambientLight: THREE.PointLight

  constructor(definition: RoomDefinition) {
    this.definition = definition
    this.group = new THREE.Group()
    this.group.name = `room_${definition.id}`

    const { position, size } = definition.properties
    const { width, height, depth } = size

    // Materials - using brighter colors and side:DoubleSide so they're visible from inside
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a6a7a,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    })

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4a5a,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })

    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5a6a,
      roughness: 0.7,
      metalness: 0.3,
      side: THREE.DoubleSide,
    })

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(width, depth)
    this.floor = new THREE.Mesh(floorGeometry, floorMaterial)
    this.floor.rotation.x = -Math.PI / 2
    this.floor.position.set(0, 0, 0)
    this.floor.receiveShadow = true
    this.group.add(this.floor)

    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(width, depth)
    this.ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial)
    this.ceiling.rotation.x = Math.PI / 2
    this.ceiling.position.set(0, height, 0)
    this.ceiling.receiveShadow = true
    this.group.add(this.ceiling)

    // Walls (4 walls with potential door cutouts)
    this.createWalls(width, height, depth, wallMaterial)

    // Room lighting - increased intensity and distance
    this.ambientLight = new THREE.PointLight(0xffffee, 2, width * 3)
    this.ambientLight.position.set(0, height - 0.5, 0)
    this.ambientLight.castShadow = true
    this.group.add(this.ambientLight)

    // Add a secondary fill light for better visibility
    const fillLight = new THREE.PointLight(0x8888ff, 0.5, width * 2)
    fillLight.position.set(0, 0.5, 0)
    this.group.add(fillLight)

    // Ceiling light fixture (visual)
    const lightFixture = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.1, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffee,
        emissiveIntensity: 0.5
      })
    )
    lightFixture.position.set(0, height - 0.05, 0)
    this.group.add(lightFixture)

    // Position the entire room
    this.group.position.set(position.x, position.y, position.z)
  }

  private createWalls(width: number, height: number, depth: number, material: THREE.Material) {
    const wallThickness = 0.2

    // Back wall (positive Z)
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      material
    )
    backWall.position.set(0, height / 2, depth / 2)
    backWall.receiveShadow = true
    backWall.castShadow = true
    this.walls.push(backWall)
    this.group.add(backWall)

    // Front wall (negative Z)
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      material
    )
    frontWall.position.set(0, height / 2, -depth / 2)
    frontWall.receiveShadow = true
    frontWall.castShadow = true
    this.walls.push(frontWall)
    this.group.add(frontWall)

    // Left wall (negative X)
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      material
    )
    leftWall.position.set(-width / 2, height / 2, 0)
    leftWall.receiveShadow = true
    leftWall.castShadow = true
    this.walls.push(leftWall)
    this.group.add(leftWall)

    // Right wall (positive X)
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      material
    )
    rightWall.position.set(width / 2, height / 2, 0)
    rightWall.receiveShadow = true
    rightWall.castShadow = true
    this.walls.push(rightWall)
    this.group.add(rightWall)
  }

  // Update lighting based on room state (O2, power, etc.)
  updateLighting(o2Level: number, powered: boolean) {
    if (!powered) {
      this.ambientLight.intensity = 0.1
      this.ambientLight.color.setHex(0xff4444) // Emergency red
    } else if (o2Level < 16) {
      this.ambientLight.intensity = 0.5
      this.ambientLight.color.setHex(0xff6666) // Critical red
    } else if (o2Level < 19) {
      this.ambientLight.intensity = 0.8
      this.ambientLight.color.setHex(0xffaa66) // Warning amber
    } else {
      this.ambientLight.intensity = 1.0
      this.ambientLight.color.setHex(0xffffee) // Normal warm white
    }
  }

  // Get collision boxes for the room
  getCollisionBoxes(): THREE.Box3[] {
    return this.walls.map(wall => new THREE.Box3().setFromObject(wall))
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
