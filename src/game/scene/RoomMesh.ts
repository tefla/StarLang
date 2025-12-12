// 3D Room Geometry with door openings

import * as THREE from 'three'
import type { RoomDefinition, DoorDefinition } from '../../types/nodes'

export interface DoorOpening {
  position: { x: number; z: number }
  rotation: number // 0 or 180 = Z wall, 90 or 270 = X wall
}

export class RoomMesh {
  public group: THREE.Group
  public definition: RoomDefinition

  private walls: THREE.Mesh[] = []
  private floor: THREE.Mesh
  private ceiling: THREE.Mesh
  private ambientLight: THREE.PointLight

  constructor(definition: RoomDefinition, doorOpenings: DoorOpening[] = []) {
    this.definition = definition
    this.group = new THREE.Group()
    this.group.name = `room_${definition.id}`

    const { position, size } = definition.properties
    const { width, height, depth } = size

    // Materials
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

    // Walls with door openings
    this.createWallsWithOpenings(width, height, depth, wallMaterial, doorOpenings, position)

    // Room lighting
    this.ambientLight = new THREE.PointLight(0xffffee, 2, width * 3)
    this.ambientLight.position.set(0, height - 0.5, 0)
    this.ambientLight.castShadow = true
    this.group.add(this.ambientLight)

    // Fill light
    const fillLight = new THREE.PointLight(0x8888ff, 0.5, width * 2)
    fillLight.position.set(0, 0.5, 0)
    this.group.add(fillLight)

    // Ceiling light fixture
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

    // Position the room
    this.group.position.set(position.x, position.y, position.z)
  }

  private createWallsWithOpenings(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    doorOpenings: DoorOpening[],
    roomPos: { x: number; y: number; z: number }
  ) {
    const wallThickness = 0.2
    const doorWidth = 1.5  // Match door frame outer width (1.2 + 0.15*2)
    const doorHeight = 2.55  // Match door frame total height (2.4 + 0.15 frame top)

    // Determine which walls have doors
    // Door positions are in world coords, convert to local
    const doorsOnWalls = {
      back: [] as number[],   // +Z wall, stores local X positions
      front: [] as number[],  // -Z wall
      left: [] as number[],   // -X wall, stores local Z positions
      right: [] as number[]   // +X wall
    }

    for (const door of doorOpenings) {
      // Convert world position to local position relative to room
      const localX = door.position.x - roomPos.x
      const localZ = door.position.z - roomPos.z

      // Determine which wall based on position and rotation
      // rotation 90 or 270 = door on X walls (left/right)
      // rotation 0 or 180 = door on Z walls (front/back)
      const isXWall = door.rotation === 90 || door.rotation === 270

      if (isXWall) {
        // Door is on left or right wall
        if (localX > 0) {
          doorsOnWalls.right.push(localZ)
        } else {
          doorsOnWalls.left.push(localZ)
        }
      } else {
        // Door is on front or back wall
        if (localZ > 0) {
          doorsOnWalls.back.push(localX)
        } else {
          doorsOnWalls.front.push(localX)
        }
      }
    }

    // Create walls with openings

    // Back wall (+Z)
    this.createWallWithOpenings(
      width, height, wallThickness,
      { x: 0, y: height / 2, z: depth / 2 },
      'horizontal', doorsOnWalls.back, doorWidth, doorHeight, material
    )

    // Front wall (-Z)
    this.createWallWithOpenings(
      width, height, wallThickness,
      { x: 0, y: height / 2, z: -depth / 2 },
      'horizontal', doorsOnWalls.front, doorWidth, doorHeight, material
    )

    // Left wall (-X)
    this.createWallWithOpenings(
      depth, height, wallThickness,
      { x: -width / 2, y: height / 2, z: 0 },
      'vertical', doorsOnWalls.left, doorWidth, doorHeight, material
    )

    // Right wall (+X)
    this.createWallWithOpenings(
      depth, height, wallThickness,
      { x: width / 2, y: height / 2, z: 0 },
      'vertical', doorsOnWalls.right, doorWidth, doorHeight, material
    )
  }

  private createWallWithOpenings(
    wallLength: number,
    wallHeight: number,
    wallThickness: number,
    position: { x: number; y: number; z: number },
    orientation: 'horizontal' | 'vertical',
    doorPositions: number[], // positions along the wall where doors are
    doorWidth: number,
    doorHeight: number,
    material: THREE.Material
  ) {
    if (doorPositions.length === 0) {
      // No doors - create solid wall
      const isHorizontal = orientation === 'horizontal'
      const geometry = isHorizontal
        ? new THREE.BoxGeometry(wallLength, wallHeight, wallThickness)
        : new THREE.BoxGeometry(wallThickness, wallHeight, wallLength)

      const wall = new THREE.Mesh(geometry, material)
      wall.position.set(position.x, position.y, position.z)
      wall.receiveShadow = true
      wall.castShadow = true
      this.walls.push(wall)
      this.group.add(wall)
      return
    }

    // Sort door positions
    const sortedDoors = [...doorPositions].sort((a, b) => a - b)
    const halfLength = wallLength / 2
    const isHorizontal = orientation === 'horizontal'

    // Create wall segments around doors
    let currentPos = -halfLength

    for (const doorPos of sortedDoors) {
      const doorStart = doorPos - doorWidth / 2
      const doorEnd = doorPos + doorWidth / 2

      // Wall segment before door
      if (doorStart > currentPos) {
        const segmentLength = doorStart - currentPos
        const segmentCenter = currentPos + segmentLength / 2

        const geometry = isHorizontal
          ? new THREE.BoxGeometry(segmentLength, wallHeight, wallThickness)
          : new THREE.BoxGeometry(wallThickness, wallHeight, segmentLength)

        const wall = new THREE.Mesh(geometry, material)
        if (isHorizontal) {
          wall.position.set(position.x + segmentCenter, position.y, position.z)
        } else {
          wall.position.set(position.x, position.y, position.z + segmentCenter)
        }
        wall.receiveShadow = true
        wall.castShadow = true
        this.walls.push(wall)
        this.group.add(wall)
      }

      // Wall segment above door
      const aboveDoorHeight = wallHeight - doorHeight
      if (aboveDoorHeight > 0) {
        const geometry = isHorizontal
          ? new THREE.BoxGeometry(doorWidth, aboveDoorHeight, wallThickness)
          : new THREE.BoxGeometry(wallThickness, aboveDoorHeight, doorWidth)

        const wall = new THREE.Mesh(geometry, material)
        if (isHorizontal) {
          wall.position.set(
            position.x + doorPos,
            doorHeight + aboveDoorHeight / 2,
            position.z
          )
        } else {
          wall.position.set(
            position.x,
            doorHeight + aboveDoorHeight / 2,
            position.z + doorPos
          )
        }
        wall.receiveShadow = true
        wall.castShadow = true
        this.walls.push(wall)
        this.group.add(wall)
      }

      currentPos = doorEnd
    }

    // Wall segment after last door
    if (currentPos < halfLength) {
      const segmentLength = halfLength - currentPos
      const segmentCenter = currentPos + segmentLength / 2

      const geometry = isHorizontal
        ? new THREE.BoxGeometry(segmentLength, wallHeight, wallThickness)
        : new THREE.BoxGeometry(wallThickness, wallHeight, segmentLength)

      const wall = new THREE.Mesh(geometry, material)
      if (isHorizontal) {
        wall.position.set(position.x + segmentCenter, position.y, position.z)
      } else {
        wall.position.set(position.x, position.y, position.z + segmentCenter)
      }
      wall.receiveShadow = true
      wall.castShadow = true
      this.walls.push(wall)
      this.group.add(wall)
    }
  }

  updateLighting(o2Level: number, powered: boolean) {
    if (!powered) {
      this.ambientLight.intensity = 0.1
      this.ambientLight.color.setHex(0xff4444)
    } else if (o2Level < 16) {
      this.ambientLight.intensity = 0.5
      this.ambientLight.color.setHex(0xff6666)
    } else if (o2Level < 19) {
      this.ambientLight.intensity = 0.8
      this.ambientLight.color.setHex(0xffaa66)
    } else {
      this.ambientLight.intensity = 1.0
      this.ambientLight.color.setHex(0xffffee)
    }
  }

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
