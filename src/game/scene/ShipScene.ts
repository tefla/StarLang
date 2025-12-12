// Ship Scene - Main 3D scene management

import * as THREE from 'three'
import { RoomMesh } from './RoomMesh'
import { DoorMesh } from './DoorMesh'
import { TerminalMesh } from '../terminals/TerminalMesh'
import { Runtime } from '../../runtime/Runtime'
import type { ShipStructure } from '../../types/nodes'

export class ShipScene {
  public scene: THREE.Scene
  public roomMeshes = new Map<string, RoomMesh>()
  public doorMeshes = new Map<string, DoorMesh>()
  public terminalMeshes = new Map<string, TerminalMesh>()

  private runtime: Runtime

  constructor(runtime: Runtime) {
    this.runtime = runtime
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x101520)
    // Reduce fog - was hiding the room
    this.scene.fog = new THREE.Fog(0x101520, 20, 80)

    this.setupLighting()
  }

  private setupLighting() {
    // Ambient light - brighter for better visibility
    const ambientLight = new THREE.AmbientLight(0x606070, 0.6)
    this.scene.add(ambientLight)

    // Hemisphere light for subtle environment
    const hemisphereLight = new THREE.HemisphereLight(0x8888aa, 0x444466, 0.5)
    this.scene.add(hemisphereLight)

    // Add a directional light for better shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3)
    directionalLight.position.set(5, 10, 5)
    this.scene.add(directionalLight)

  }

  buildFromStructure(structure: ShipStructure) {
    // Clear existing meshes
    this.clear()

    console.log('Building ship structure:', {
      rooms: structure.rooms.size,
      doors: structure.doors.size,
      terminals: structure.terminals.size
    })

    // Build rooms
    for (const [id, roomDef] of structure.rooms) {
      console.log('Building room:', id, roomDef.properties)
      const roomMesh = new RoomMesh(roomDef)
      this.roomMeshes.set(id, roomMesh)
      this.scene.add(roomMesh.group)
    }

    // Build doors
    for (const [id, doorDef] of structure.doors) {
      const doorMesh = new DoorMesh(doorDef)
      this.doorMeshes.set(id, doorMesh)
      this.scene.add(doorMesh.group)

      // Subscribe to door state changes
      this.runtime.subscribe(`${id}.state`, (path, value) => {
        doorMesh.setState(value)
      })
    }

    // Build terminals
    for (const [id, terminalDef] of structure.terminals) {
      const terminalMesh = new TerminalMesh(terminalDef, this.runtime)
      this.terminalMeshes.set(id, terminalMesh)
      this.scene.add(terminalMesh.group)
    }

    // Subscribe to room state changes for lighting
    for (const [id, roomMesh] of this.roomMeshes) {
      this.runtime.subscribe(`${id}.*`, (path, value) => {
        const state = this.runtime.getState(id)
        if (state) {
          roomMesh.updateLighting(
            state.values['o2_level'] ?? 21,
            state.values['powered'] ?? true
          )
        }
      })
    }
  }

  update(deltaTime: number) {
    // Update door animations
    for (const door of this.doorMeshes.values()) {
      door.update(deltaTime)
    }

    // Update terminal screens
    for (const terminal of this.terminalMeshes.values()) {
      terminal.update(deltaTime)
    }
  }

  // Get all interactable objects for raycasting
  getInteractables(): THREE.Object3D[] {
    const interactables: THREE.Object3D[] = []

    for (const door of this.doorMeshes.values()) {
      interactables.push(door.group)
    }

    for (const terminal of this.terminalMeshes.values()) {
      interactables.push(terminal.group)
    }

    return interactables
  }

  // Get collision geometry for player movement
  getCollisionObjects(): THREE.Object3D[] {
    const colliders: THREE.Object3D[] = []

    for (const room of this.roomMeshes.values()) {
      room.group.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj !== room.group.children[0]) { // Exclude floor
          colliders.push(obj)
        }
      })
    }

    for (const door of this.doorMeshes.values()) {
      if (!door.canPassThrough()) {
        colliders.push(door.group)
      }
    }

    return colliders
  }

  clear() {
    for (const room of this.roomMeshes.values()) {
      this.scene.remove(room.group)
      room.dispose()
    }
    this.roomMeshes.clear()

    for (const door of this.doorMeshes.values()) {
      this.scene.remove(door.group)
      door.dispose()
    }
    this.doorMeshes.clear()

    for (const terminal of this.terminalMeshes.values()) {
      this.scene.remove(terminal.group)
      terminal.dispose()
    }
    this.terminalMeshes.clear()
  }

  dispose() {
    this.clear()
  }
}
