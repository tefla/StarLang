// Ship Scene - Main 3D scene management

import * as THREE from 'three'
import { Runtime } from '../../runtime/Runtime'
import type { ShipStructure, SwitchDefinition, WallLightDefinition } from '../../types/nodes'
import { SparkEffect } from '../../engine/ParticleSystem'
import { VoxelWorld } from '../../voxel/VoxelWorld'
import { VoxelRenderer } from '../../voxel/VoxelRenderer'
import { VoxelMapBuilder } from '../../voxel/VoxelMapBuilder'
import { VOXEL_SIZE } from '../../voxel/VoxelTypes'
import { loadVoxelMesh } from '../../voxel/VoxelMeshLoader'
import type { ShipLayout } from '../../types/layout'
import { animatedAssetLoader, loadAnimatedAssetsAsync } from '../../voxel/AnimatedAssetLoader'
import type { AnimatedAssetInstance } from '../../voxel/AnimatedAssetInstance'
import type { AnimatedChildInfo } from '../../voxel/VoxelAssetLoader'
import { EntitySystem, ScreenEntity, type Entity } from '../../engine/EntitySystem'
import { ForgeLoader } from '../../engine/ForgeLoader'
import { enableClientHotReload, type ForgeHotReloadEvent } from '../../forge'
import { Config } from '../../forge/ConfigRegistry'

export class ShipScene {
  public scene: THREE.Scene
  public switchDefs = new Map<string, SwitchDefinition>()  // Switch definitions for interaction
  public terminals = new Map<string, ScreenEntity>()  // Terminal entities
  public wallLights = new Map<string, { light: THREE.PointLight; def: WallLightDefinition; isOn: boolean }>()
  public ceilingLights = new Map<string, THREE.PointLight>()
  public ceilingLightsOn = true
  public sparkEffect: SparkEffect

  // Animated assets (doors, switches, warning lights, fans, etc.)
  public animatedAssets = new Map<string, AnimatedAssetInstance>()

  // Voxel rendering
  public voxelWorld: VoxelWorld | null = null
  public voxelRenderer: VoxelRenderer | null = null
  private prebuiltMesh: THREE.Mesh | null = null

  // Forge entity system
  public entitySystem: EntitySystem
  private forgeLoader: ForgeLoader
  private forgeEntitiesLoaded = false
  private hotReloadCleanup?: () => void

  private runtime: Runtime

  constructor(runtime: Runtime) {
    this.runtime = runtime
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(Config.lighting.scene.backgroundColor)
    // Minimal fog for atmosphere
    this.scene.fog = new THREE.Fog(
      Config.lighting.scene.fogColor,
      Config.lighting.scene.fogNear,
      Config.lighting.scene.fogFar
    )

    this.setupLighting()

    // Initialize particle effects
    this.sparkEffect = new SparkEffect(this.scene)

    // Animated asset definitions are loaded asynchronously
    // Call loadForgeEntities() before buildFromStructure()

    // Initialize Forge entity system
    this.entitySystem = new EntitySystem()
    this.forgeLoader = new ForgeLoader()
  }

  /**
   * Load Forge entity definitions and animated assets.
   * Call this before buildFromStructure to enable Forge-based entities.
   */
  async loadForgeEntities(): Promise<void> {
    if (this.forgeEntitiesLoaded) return

    try {
      // Load animated asset definitions (async for browser support)
      await loadAnimatedAssetsAsync()

      // Load terminal entity definition
      const terminalSource = await fetch('/content/forge/entities/terminal.entity.forge')
        .then(r => r.ok ? r.text() : Promise.reject(r.statusText))
        .catch(() => null)

      if (terminalSource) {
        const result = this.forgeLoader.loadSource(terminalSource)
        for (const entity of result.entities) {
          this.entitySystem.registerDefinition(entity)
          console.log(`[ShipScene] Loaded Forge entity: ${entity.id}`)
        }
        if (result.errors.length > 0) {
          console.warn('[ShipScene] Forge entity errors:', result.errors)
        }
      }

      // Enable hot reloading in development
      this.hotReloadCleanup = enableClientHotReload((event: ForgeHotReloadEvent) => {
        this.handleForgeHotReload(event)
      })

      this.forgeEntitiesLoaded = true
    } catch (e) {
      console.warn('[ShipScene] Failed to load Forge entities:', e)
    }
  }

  /**
   * Handle hot reload events for Forge files.
   */
  private handleForgeHotReload(event: ForgeHotReloadEvent): void {
    if (event.type === 'error') {
      console.error(`[Forge HMR] ${event.filePath}:\n${event.error}`)
      return
    }

    if (event.type === 'entity' && event.entity) {
      console.log(`[Forge HMR] Reloading entity: ${event.entity.id}`)
      this.entitySystem.registerDefinition(event.entity)
      // Note: Existing instances won't automatically update
      // A full rebuild would be needed for that
    }

    if (event.type === 'asset' && event.asset) {
      console.log(`[Forge HMR] Asset updated: ${event.asset.id}`)
      // Assets could be reloaded here if the AnimatedAssetLoader supports it
    }
  }

  private setupLighting() {
    // Ambient light for basic visibility
    const ambientLight = new THREE.AmbientLight(
      Config.lighting.ambient.color,
      Config.lighting.ambient.intensity
    )
    this.scene.add(ambientLight)

    // Directional light for shadows and depth
    const dirLight = new THREE.DirectionalLight(
      Config.lighting.directional.color,
      Config.lighting.directional.intensity
    )
    dirLight.position.set(10, 20, 10)
    dirLight.castShadow = true
    const shadowMapSize = Config.lighting.directional.shadowMapSize
    dirLight.shadow.mapSize.width = shadowMapSize
    dirLight.shadow.mapSize.height = shadowMapSize
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 100
    const shadowBounds = Config.lighting.directional.shadowBounds
    dirLight.shadow.camera.left = -shadowBounds
    dirLight.shadow.camera.right = shadowBounds
    dirLight.shadow.camera.top = shadowBounds
    dirLight.shadow.camera.bottom = -shadowBounds
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
      wallThickness: Config.voxelWorld.construction.wallThickness,
      floorThickness: Config.voxelWorld.construction.floorThickness,
      ceilingThickness: Config.voxelWorld.construction.ceilingThickness,
      doorWidth: Config.voxelWorld.door.width,
      doorHeight: Config.voxelWorld.door.height
    })
    const result = builder.buildFromLayout(layout)
    this.voxelWorld = result.world
    console.timeEnd('buildVoxelWorldOnly')
    console.log('Voxel world chunks:', this.voxelWorld.getAllChunks().length)
    // Don't create renderer - we're using pre-built mesh

    // Create animated children (e.g., spinning fans)
    this.createAnimatedChildren(result.animatedChildren)
  }

  /**
   * Build voxel world and mesh it at runtime.
   */
  private buildVoxelWorldAndMesh(layout: ShipLayout) {
    const builder = new VoxelMapBuilder({
      wallThickness: Config.voxelWorld.construction.wallThickness,
      floorThickness: Config.voxelWorld.construction.floorThickness,
      ceilingThickness: Config.voxelWorld.construction.ceilingThickness,
      doorWidth: Config.voxelWorld.door.width,
      doorHeight: Config.voxelWorld.door.height
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

    // Create animated children (e.g., spinning fans)
    this.createAnimatedChildren(result.animatedChildren)
  }

  /**
   * Create animated child meshes (e.g., spinning fan blades).
   * Uses AnimatedAssetInstance with continuous spin instead of hardcoded FanMesh.
   */
  private createAnimatedChildren(animatedChildren: AnimatedChildInfo[]) {
    let fanIndex = 0
    for (const info of animatedChildren) {
      if (info.animate.type === 'spin') {
        // Create AnimatedAssetInstance for the fan
        const instance = animatedAssetLoader.createInstance(
          info.assetId,
          info.position,
          info.rotation ?? 0,
          { powered: true }
        )

        if (instance) {
          // Enable continuous spin based on animation config
          instance.enableContinuousSpin(
            info.animate.axis,
            info.animate.speed ?? Math.PI * 2  // Default 1 rotation/sec
          )

          const fanId = `fan_${info.assetId}_${fanIndex++}`
          instance.group.userData = { type: 'fan', id: fanId }

          this.animatedAssets.set(fanId, instance)
          this.scene.add(instance.group)
          console.log(`[ShipScene] Created fan ${fanId} using AnimatedAssetInstance`)
        } else {
          console.warn(`[ShipScene] Failed to create AnimatedAssetInstance for ${info.assetId}`)
        }
      }
    }
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
      const ceilingLight = new THREE.PointLight(
        Config.lighting.ceiling.color,
        Config.lighting.ceiling.intensity,
        lightRange,
        Config.lighting.ceiling.decay
      )
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
      light.intensity = this.ceilingLightsOn ? Config.lighting.ceiling.intensity : 0
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

    // Build terminals using ScreenEntity
    for (const [id, terminalDef] of structure.terminals) {
      const { position, rotation, terminal_type, location, display_name, mounted_files } = terminalDef.properties

      // Get terminal entity definition from Forge
      const terminalEntityDef = this.entitySystem.getDefinition('terminal')

      if (terminalEntityDef) {
        // Create ScreenEntity from Forge definition
        const worldPos = new THREE.Vector3(
          position.x * VOXEL_SIZE,
          position.y * VOXEL_SIZE,
          position.z * VOXEL_SIZE
        )
        // Add 180° offset - terminal faces opposite direction from layout rotation
        const effectiveRotation = rotation + 180

        const entity = new ScreenEntity(id, terminalEntityDef, worldPos, effectiveRotation)
        entity.group.userData = { type: 'terminal', id, interactable: true }

        // Configure terminal with runtime and voxel world
        entity.setRuntime(this.runtime)
        if (this.voxelWorld) {
          entity.setVoxelWorld(this.voxelWorld)
        }
        entity.setTerminalConfig(
          terminal_type as 'STATUS' | 'ENGINEERING' | 'COMMAND',
          location,
          display_name
        )
        if (mounted_files) {
          entity.setMountedFiles(mounted_files)
        }

        // Register with entity system and scene
        this.terminals.set(id, entity)
        this.scene.add(entity.group)
      } else {
        console.warn(`[ShipScene] Terminal entity definition not loaded, skipping ${id}`)
      }
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
      const wallOffset = Config.lighting.wall.offset
      const offsetX = Math.sin(rotationRad) * wallOffset
      const offsetZ = Math.cos(rotationRad) * wallOffset

      const pointLight = new THREE.PointLight(
        new THREE.Color(color),
        intensity * 2,
        Config.lighting.wall.distance,
        Config.lighting.wall.decay
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
    // Update terminal screens (ScreenEntity)
    for (const terminal of this.terminals.values()) {
      terminal.update(deltaTime, {
        params: {},
        state: {}
      })
    }

    // Update other Forge entities
    this.entitySystem.update(deltaTime, {
      params: {},
      state: {}
    })

    // Update animated assets (doors, switches, warning lights, fans, etc.)
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

    // Terminals (ScreenEntity)
    for (const terminal of this.terminals.values()) {
      interactables.push(terminal.group)
    }

    // Forge entities
    for (const entity of this.entitySystem.getAllInstances()) {
      if (entity.isInteractable) {
        interactables.push(entity.group)
      }
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

    // Clear terminals (ScreenEntity)
    for (const terminal of this.terminals.values()) {
      this.scene.remove(terminal.group)
      terminal.dispose()
    }
    this.terminals.clear()

    for (const wallLight of this.wallLights.values()) {
      this.scene.remove(wallLight.light)
      wallLight.light.dispose()
    }
    this.wallLights.clear()

    // Clear Forge entities
    for (const entity of this.entitySystem.getAllInstances()) {
      this.scene.remove(entity.group)
    }
    this.entitySystem.dispose()
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

    // Clean up hot reload
    if (this.hotReloadCleanup) {
      this.hotReloadCleanup()
      this.hotReloadCleanup = undefined
    }
  }
}
