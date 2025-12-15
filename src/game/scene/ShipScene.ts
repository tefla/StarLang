// Ship Scene - Main 3D scene management

import * as THREE from 'three'
import { TerminalMesh } from '../terminals/TerminalMesh'
import { Runtime } from '../../runtime/Runtime'
import type { ShipStructure, SwitchDefinition, WallLightDefinition } from '../../types/nodes'
import { SparkEffect } from '../effects/ParticleSystem'
import { VoxelWorld } from '../../voxel/VoxelWorld'
import { VoxelRenderer } from '../../voxel/VoxelRenderer'
import { VoxelMapBuilder } from '../../voxel/VoxelMapBuilder'
import { VOXEL_SIZE } from '../../voxel/VoxelTypes'
import { loadVoxelMesh } from '../../voxel/VoxelMeshLoader'
import type { ShipLayout } from '../../types/layout'
import { animatedAssetLoader, loadAnimatedAssets } from '../../voxel/AnimatedAssetLoader'
import type { AnimatedAssetInstance } from '../../voxel/AnimatedAssetInstance'

export class ShipScene {
  public scene: THREE.Scene
  public switchDefs = new Map<string, SwitchDefinition>()  // Switch definitions for interaction
  public terminalMeshes = new Map<string, TerminalMesh>()
  public wallLights = new Map<string, { light: THREE.PointLight; def: WallLightDefinition; isOn: boolean }>()
  public ceilingLights = new Map<string, THREE.PointLight>()
  public ceilingLightsOn = true
  public sparkEffect: SparkEffect

  // Animated assets (doors, switches, warning lights, etc.)
  public animatedAssets = new Map<string, AnimatedAssetInstance>()

  // Voxel rendering
  public voxelWorld: VoxelWorld | null = null
  public voxelRenderer: VoxelRenderer | null = null
  private prebuiltMesh: THREE.Mesh | null = null

  private runtime: Runtime

  constructor(runtime: Runtime) {
    this.runtime = runtime
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x101520)
    // Minimal fog for atmosphere
    this.scene.fog = new THREE.Fog(0x101520, 30, 100)

    this.setupLighting()

    // Initialize particle effects
    this.sparkEffect = new SparkEffect(this.scene)

    // Load animated asset definitions
    loadAnimatedAssets()
  }

  private setupLighting() {
    // Ambient light for basic visibility
    const ambientLight = new THREE.AmbientLight(0x404050, 0.4)
    this.scene.add(ambientLight)

    // Directional light for shadows and depth
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dirLight.position.set(10, 20, 10)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 100
    dirLight.shadow.camera.left = -30
    dirLight.shadow.camera.right = 30
    dirLight.shadow.camera.top = 30
    dirLight.shadow.camera.bottom = -30
    this.scene.add(dirLight)
  }

  /**
   * Build voxel world from V1 layout.
   * Tries to load pre-built mesh first, falls back to runtime building.
   */
  async buildFromLayout(layout: ShipLayout, meshName = 'galley') {
    // Try to load pre-built mesh first
    try {
      console.log('Attempting to load pre-built mesh...')
      this.prebuiltMesh = await loadVoxelMesh(`/${meshName}.mesh.bin`)
      this.scene.add(this.prebuiltMesh)
      console.log('Pre-built mesh loaded successfully!')

      // Still need voxel world for collision detection
      this.buildVoxelWorldOnly(layout)
    } catch (e) {
      console.log('No pre-built mesh, building at runtime...')
      this.buildVoxelWorldAndMesh(layout)
    }

    // Add ceiling lights for each room
    this.addCeilingLights(layout)
  }

  /**
   * Build voxel world for collision, but don't mesh it.
   */
  private buildVoxelWorldOnly(layout: ShipLayout) {
    console.time('buildVoxelWorldOnly')
    const builder = new VoxelMapBuilder({
      wallThickness: 8,      // 20cm at 2.5cm voxels
      floorThickness: 8,
      ceilingThickness: 8,
      doorWidth: 48,         // 1.2m at 2.5cm voxels
      doorHeight: 88         // 2.2m at 2.5cm voxels
    })
    const result = builder.buildFromLayout(layout)
    this.voxelWorld = result.world
    console.timeEnd('buildVoxelWorldOnly')
    console.log('Voxel world chunks:', this.voxelWorld.getAllChunks().length)
    // Don't create renderer - we're using pre-built mesh
  }

  /**
   * Build voxel world and mesh it at runtime.
   */
  private buildVoxelWorldAndMesh(layout: ShipLayout) {
    const builder = new VoxelMapBuilder({
      wallThickness: 8,      // 20cm at 2.5cm voxels
      floorThickness: 8,
      ceilingThickness: 8,
      doorWidth: 48,         // 1.2m at 2.5cm voxels
      doorHeight: 88         // 2.2m at 2.5cm voxels
    })
    const result = builder.buildFromLayout(layout)

    this.voxelWorld = result.world

    console.time('voxelRenderer.create')
    this.voxelRenderer = new VoxelRenderer(this.scene, this.voxelWorld)
    console.timeEnd('voxelRenderer.create')
    console.log('Chunks to mesh:', this.voxelWorld.getAllChunks().length)
    console.time('voxelRenderer.rebuildAll')
    this.voxelRenderer.rebuildAll()
    console.timeEnd('voxelRenderer.rebuildAll')
  }

  /**
   * Add ceiling lights for all rooms.
   */
  private addCeilingLights(layout: ShipLayout) {
    for (const [roomId, room] of Object.entries(layout.rooms)) {
      const centerX = room.position.x * VOXEL_SIZE
      const centerZ = room.position.z * VOXEL_SIZE
      const lightY = (room.position.y + room.size.height) * VOXEL_SIZE - 0.3

      const lightRange = room.size.width * VOXEL_SIZE * 2
      const ceilingLight = new THREE.PointLight(0xffffee, 1.5, lightRange, 1)
      ceilingLight.position.set(centerX, lightY, centerZ)
      ceilingLight.name = `ceiling_light_${roomId}`
      this.scene.add(ceilingLight)
      this.ceilingLights.set(roomId, ceilingLight)
    }
  }

  /**
   * Toggle all lights (ceiling and wall) on/off.
   */
  toggleLights(): void {
    this.ceilingLightsOn = !this.ceilingLightsOn

    // Toggle ceiling lights
    for (const light of this.ceilingLights.values()) {
      light.intensity = this.ceilingLightsOn ? 1.5 : 0
    }

    // Toggle wall lights (voxel-based, just PointLight)
    for (const wallLight of this.wallLights.values()) {
      if (this.ceilingLightsOn) {
        wallLight.light.intensity = wallLight.def.properties.intensity * 2
        wallLight.isOn = true
      } else {
        wallLight.light.intensity = 0
        wallLight.isOn = false
      }
    }
  }

  buildFromStructure(structure: ShipStructure) {
    // Clear existing entity meshes (but NOT voxel world)
    this.clearEntities()

    // Note: Voxel world should be built separately via buildFromLayout()
    // This method now only handles entity overlays (doors, terminals, etc.)

    // Build doors using animated assets
    for (const [id, doorDef] of structure.doors) {
      const { position, rotation } = doorDef.properties

      // Create animated door instance
      const instance = animatedAssetLoader.createInstance(
        'door-sliding',
        position,
        rotation as 0 | 90 | 180 | 270,
        { state: 'CLOSED' }
      )

      if (instance) {
        // Set userData for interaction system
        instance.group.userData = { type: 'door', id }

        this.animatedAssets.set(`door_${id}`, instance)
        this.scene.add(instance.group)

        // Subscribe to door state changes
        this.runtime.subscribe(`${id}.state`, (_path, value) => {
          instance.setParam('state', value as string)
        })
      }
    }

    // Build terminals
    for (const [id, terminalDef] of structure.terminals) {
      const terminalMesh = new TerminalMesh(terminalDef, this.runtime)
      this.terminalMeshes.set(id, terminalMesh)
      this.scene.add(terminalMesh.group)
    }

    // Build animated switches
    for (const [id, switchDef] of structure.switches) {
      this.switchDefs.set(id, switchDef)

      // Create animated switch instance
      // Height offset: 48 voxels = 1.2m at 2.5cm per voxel
      const { position, rotation, status } = switchDef.properties
      const switchPosition = {
        x: position.x,
        y: position.y + 48,
        z: position.z
      }
      const instance = animatedAssetLoader.createInstance(
        'switch-animated',
        switchPosition,
        rotation as 0 | 90 | 180 | 270,
        { status: status || 'OK' }
      )

      if (instance) {
        // Set userData for interaction system
        instance.group.userData = { type: 'switch', id }

        this.animatedAssets.set(id, instance)
        this.scene.add(instance.group)

        // Subscribe to switch status changes
        this.runtime.subscribe(`${id}.status`, (_path, value) => {
          instance.setParam('status', value as string)
        })
      }
    }

    // Build wall lights (voxel geometry is pre-built, just add PointLight)
    for (const [id, lightDef] of structure.wallLights) {
      const { position, rotation, color, intensity } = lightDef.properties
      const rotationRad = (rotation * Math.PI) / 180

      // Offset light into room from wall surface
      const wallOffset = 0.12
      const offsetX = Math.sin(rotationRad) * wallOffset
      const offsetZ = Math.cos(rotationRad) * wallOffset

      const pointLight = new THREE.PointLight(
        new THREE.Color(color),
        intensity * 2,
        8,   // distance
        1.5  // decay
      )
      pointLight.position.set(
        position.x * VOXEL_SIZE + offsetX,
        position.y * VOXEL_SIZE,
        position.z * VOXEL_SIZE + offsetZ
      )
      pointLight.name = `wall_light_${id}`
      this.scene.add(pointLight)
      this.wallLights.set(id, { light: pointLight, def: lightDef, isOn: true })
    }
  }

  update(deltaTime: number) {
    // Update terminal screens
    for (const terminal of this.terminalMeshes.values()) {
      terminal.update(deltaTime)
    }

    // Update animated assets (doors, switches, warning lights, etc.)
    for (const instance of this.animatedAssets.values()) {
      instance.update(deltaTime)
    }

    // Update particle effects
    this.sparkEffect.update(deltaTime)
  }

  // Get all interactable objects for raycasting
  getInteractables(): THREE.Object3D[] {
    const interactables: THREE.Object3D[] = []

    // Doors are animated assets
    for (const [id, instance] of this.animatedAssets) {
      if (id.startsWith('door_')) {
        interactables.push(instance.group)
      }
    }

    // Switches are animated assets
    for (const [id, instance] of this.animatedAssets) {
      if (this.switchDefs.has(id)) {
        interactables.push(instance.group)
      }
    }

    // Terminals
    for (const terminal of this.terminalMeshes.values()) {
      interactables.push(terminal.group)
    }

    return interactables
  }

  // Get collision geometry for player movement
  getCollisionObjects(): THREE.Object3D[] {
    const colliders: THREE.Object3D[] = []

    // NOTE: Voxel meshes are NOT used for collision because bounding box
    // collision doesn't work with hollow structures. The bounding box
    // encompasses the entire chunk, blocking movement inside rooms.
    // TODO: Implement proper voxel raycast collision

    // Closed/locked doors block passage
    for (const [id, instance] of this.animatedAssets) {
      if (id.startsWith('door_')) {
        const doorState = instance.getParam('state')
        if (doorState !== 'OPEN') {
          colliders.push(instance.group)
        }
      }
    }

    return colliders
  }

  /**
   * Clear only entity meshes (doors, terminals, etc.), not voxel world.
   */
  clearEntities() {
    // Clear switch definitions
    this.switchDefs.clear()

    // Clear animated assets (doors, switches, etc.)
    for (const instance of this.animatedAssets.values()) {
      this.scene.remove(instance.group)
      instance.dispose()
    }
    this.animatedAssets.clear()

    for (const terminal of this.terminalMeshes.values()) {
      this.scene.remove(terminal.group)
      terminal.dispose()
    }
    this.terminalMeshes.clear()

    for (const wallLight of this.wallLights.values()) {
      this.scene.remove(wallLight.light)
      wallLight.light.dispose()
    }
    this.wallLights.clear()
  }

  /**
   * Clear everything including voxel world.
   */
  clear() {
    // Clear voxel renderer
    if (this.voxelRenderer) {
      this.voxelRenderer.dispose()
      this.voxelRenderer = null
    }
    this.voxelWorld = null

    // Clear ceiling lights
    for (const light of this.ceilingLights.values()) {
      this.scene.remove(light)
    }
    this.ceilingLights.clear()
    this.ceilingLightsOn = true

    // Clear entities
    this.clearEntities()
  }

  dispose() {
    this.clear()
    this.sparkEffect.dispose()
  }
}
