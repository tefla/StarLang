// Ship Scene - Main 3D scene management

import * as THREE from 'three'
import { RoomMesh } from './RoomMesh'
import type { DoorOpening } from './RoomMesh'
import { DoorMesh } from './DoorMesh'
import { SwitchMesh } from './SwitchMesh'
import { WallLightMesh } from './WallLightMesh'
import { TerminalMesh } from '../terminals/TerminalMesh'
import { Runtime } from '../../runtime/Runtime'
import type { ShipStructure } from '../../types/nodes'
import { SparkEffect } from '../effects/ParticleSystem'

export class ShipScene {
  public scene: THREE.Scene
  public roomMeshes = new Map<string, RoomMesh>()
  public doorMeshes = new Map<string, DoorMesh>()
  public switchMeshes = new Map<string, SwitchMesh>()
  public terminalMeshes = new Map<string, TerminalMesh>()
  public wallLightMeshes = new Map<string, WallLightMesh>()
  public sparkEffect: SparkEffect

  private runtime: Runtime

  constructor(runtime: Runtime) {
    this.runtime = runtime
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x101520)
    // Reduce fog - was hiding the room
    this.scene.fog = new THREE.Fog(0x101520, 20, 80)

    this.setupLighting()

    // Initialize particle effects
    this.sparkEffect = new SparkEffect(this.scene)
  }

  private setupLighting() {
    // Minimal ambient - room lights should be primary source
    const ambientLight = new THREE.AmbientLight(0x101015, 0.1)
    this.scene.add(ambientLight)
  }

  buildFromStructure(structure: ShipStructure) {
    // Clear existing meshes
    this.clear()

    // Collect door openings for each room
    const roomDoorOpenings = new Map<string, DoorOpening[]>()
    for (const [doorId, doorDef] of structure.doors) {
      const [room1, room2] = doorDef.properties.connects
      const opening: DoorOpening = {
        position: { x: doorDef.properties.position.x, z: doorDef.properties.position.z },
        rotation: doorDef.properties.rotation
      }

      // Add opening to both connected rooms
      if (!roomDoorOpenings.has(room1)) roomDoorOpenings.set(room1, [])
      if (!roomDoorOpenings.has(room2)) roomDoorOpenings.set(room2, [])
      roomDoorOpenings.get(room1)!.push(opening)
      roomDoorOpenings.get(room2)!.push(opening)
    }

    // Build rooms with door openings
    for (const [id, roomDef] of structure.rooms) {
      const doorOpenings = roomDoorOpenings.get(id) ?? []
      const roomMesh = new RoomMesh(roomDef, doorOpenings)
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

    // Build switches
    for (const [id, switchDef] of structure.switches) {
      const switchMesh = new SwitchMesh(switchDef)
      this.switchMeshes.set(id, switchMesh)
      this.scene.add(switchMesh.group)
    }

    // Build wall lights
    for (const [id, lightDef] of structure.wallLights) {
      const lightMesh = new WallLightMesh(lightDef)
      this.wallLightMeshes.set(id, lightMesh)
      this.scene.add(lightMesh.group)
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
    // Update room lighting effects (alert pulsing)
    for (const room of this.roomMeshes.values()) {
      room.update(deltaTime)
    }

    // Update door animations
    for (const door of this.doorMeshes.values()) {
      door.update(deltaTime)
    }

    // Update terminal screens
    for (const terminal of this.terminalMeshes.values()) {
      terminal.update(deltaTime)
    }

    // Update particle effects
    this.sparkEffect.update(deltaTime)
  }

  // Get all interactable objects for raycasting
  getInteractables(): THREE.Object3D[] {
    const interactables: THREE.Object3D[] = []

    for (const door of this.doorMeshes.values()) {
      interactables.push(door.group)
    }

    for (const sw of this.switchMeshes.values()) {
      interactables.push(sw.group)
    }

    for (const terminal of this.terminalMeshes.values()) {
      interactables.push(terminal.group)
    }

    return interactables
  }

  // Get collision geometry for player movement
  getCollisionObjects(): THREE.Object3D[] {
    const colliders: THREE.Object3D[] = []

    // Room walls (now have proper door openings)
    for (const room of this.roomMeshes.values()) {
      room.group.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj !== room.group.children[0]) { // Exclude floor
          colliders.push(obj)
        }
      })
    }

    // Closed/locked doors block passage
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

    for (const sw of this.switchMeshes.values()) {
      this.scene.remove(sw.group)
      sw.dispose()
    }
    this.switchMeshes.clear()

    for (const terminal of this.terminalMeshes.values()) {
      this.scene.remove(terminal.group)
      terminal.dispose()
    }
    this.terminalMeshes.clear()

    for (const light of this.wallLightMeshes.values()) {
      this.scene.remove(light.group)
      light.dispose()
    }
    this.wallLightMeshes.clear()
  }

  dispose() {
    this.clear()
    this.sparkEffect.dispose()
  }
}
