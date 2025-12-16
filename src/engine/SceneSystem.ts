// SceneSystem - Generic 3D scene management for voxel-based games
// Handles scene setup, lighting, entity management, and voxel world integration

import * as THREE from 'three'
import type { VoxelWorld } from '../voxel/VoxelWorld'
import { VoxelRenderer } from '../voxel/VoxelRenderer'
import { Config } from '../forge/ConfigRegistry'
import { EntitySystem, type Entity } from './EntitySystem'
import { SparkEffect } from './ParticleSystem'

/**
 * Configuration for scene setup.
 */
export interface SceneConfig {
  // Background
  backgroundColor?: number | string

  // Fog
  fog?: {
    color: number | string
    near: number
    far: number
  }

  // Ambient lighting
  ambient?: {
    color: number | string
    intensity: number
  }

  // Directional lighting
  directional?: {
    color: number | string
    intensity: number
    position?: { x: number; y: number; z: number }
    castShadow?: boolean
    shadowMapSize?: number
    shadowBounds?: number
  }

  // Optional features
  enableParticles?: boolean
}

/**
 * Point light configuration.
 */
export interface PointLightConfig {
  id: string
  position: THREE.Vector3
  color: number | string
  intensity: number
  distance?: number
  decay?: number
}

/**
 * Generic 3D scene system.
 * Manages the THREE.js scene, lighting, entities, and optional voxel world.
 */
export class SceneSystem {
  public scene: THREE.Scene
  public entitySystem: EntitySystem
  public sparkEffect: SparkEffect | null = null

  // Voxel world (optional)
  public voxelWorld: VoxelWorld | null = null
  public voxelRenderer: VoxelRenderer | null = null

  // Lighting
  private ambientLight: THREE.AmbientLight | null = null
  private directionalLight: THREE.DirectionalLight | null = null
  private pointLights = new Map<string, THREE.PointLight>()

  // Scene objects
  private objects = new Map<string, THREE.Object3D>()
  private interactables: THREE.Object3D[] = []
  private collisionObjects: THREE.Object3D[] = []

  private config: SceneConfig

  constructor(config?: SceneConfig) {
    this.config = config ?? {}

    // Create scene
    this.scene = new THREE.Scene()

    // Apply config or use defaults from Config registry
    const bgColor = this.config.backgroundColor ?? Config.lighting?.scene?.backgroundColor ?? 0x0a0a0a
    this.scene.background = new THREE.Color(bgColor)

    // Setup fog if configured
    if (this.config.fog) {
      this.scene.fog = new THREE.Fog(
        this.config.fog.color,
        this.config.fog.near,
        this.config.fog.far
      )
    } else if (Config.lighting?.scene?.fogColor !== undefined) {
      this.scene.fog = new THREE.Fog(
        Config.lighting.scene.fogColor,
        Config.lighting.scene.fogNear ?? 10,
        Config.lighting.scene.fogFar ?? 50
      )
    }

    // Setup lighting
    this.setupLighting()

    // Initialize entity system
    this.entitySystem = new EntitySystem()

    // Initialize particle effects if enabled
    if (this.config.enableParticles !== false) {
      this.sparkEffect = new SparkEffect(this.scene)
    }
  }

  /**
   * Setup scene lighting based on config.
   */
  private setupLighting(): void {
    // Ambient light
    const ambientConfig = this.config.ambient ?? {
      color: Config.lighting?.ambient?.color ?? 0x404040,
      intensity: Config.lighting?.ambient?.intensity ?? 0.4
    }

    this.ambientLight = new THREE.AmbientLight(
      ambientConfig.color,
      ambientConfig.intensity
    )
    this.scene.add(this.ambientLight)

    // Directional light
    const dirConfig = this.config.directional ?? {
      color: Config.lighting?.directional?.color ?? 0xffffff,
      intensity: Config.lighting?.directional?.intensity ?? 0.6,
      position: { x: 10, y: 20, z: 10 },
      castShadow: true,
      shadowMapSize: Config.lighting?.directional?.shadowMapSize ?? 2048,
      shadowBounds: Config.lighting?.directional?.shadowBounds ?? 30
    }

    this.directionalLight = new THREE.DirectionalLight(
      dirConfig.color,
      dirConfig.intensity
    )

    const pos = dirConfig.position ?? { x: 10, y: 20, z: 10 }
    this.directionalLight.position.set(pos.x, pos.y, pos.z)

    if (dirConfig.castShadow !== false) {
      this.directionalLight.castShadow = true
      const shadowMapSize = dirConfig.shadowMapSize ?? 2048
      this.directionalLight.shadow.mapSize.width = shadowMapSize
      this.directionalLight.shadow.mapSize.height = shadowMapSize
      this.directionalLight.shadow.camera.near = 0.5
      this.directionalLight.shadow.camera.far = 100

      const shadowBounds = dirConfig.shadowBounds ?? 30
      this.directionalLight.shadow.camera.left = -shadowBounds
      this.directionalLight.shadow.camera.right = shadowBounds
      this.directionalLight.shadow.camera.top = shadowBounds
      this.directionalLight.shadow.camera.bottom = -shadowBounds
    }

    this.scene.add(this.directionalLight)
  }

  /**
   * Set voxel world for collision and rendering.
   */
  setVoxelWorld(world: VoxelWorld): void {
    this.voxelWorld = world
  }

  /**
   * Create voxel renderer for the current world.
   * Call this after setVoxelWorld if you want runtime meshing.
   */
  createVoxelRenderer(): void {
    if (!this.voxelWorld) {
      console.warn('[SceneSystem] Cannot create voxel renderer without voxel world')
      return
    }

    if (this.voxelRenderer) {
      this.voxelRenderer.dispose()
    }

    this.voxelRenderer = new VoxelRenderer(this.scene, this.voxelWorld)
    this.voxelRenderer.rebuildAll()
  }

  /**
   * Add a pre-built mesh to the scene (e.g., from loadVoxelMesh).
   */
  addMesh(id: string, mesh: THREE.Mesh): void {
    this.objects.set(id, mesh)
    this.scene.add(mesh)
  }

  /**
   * Remove a mesh from the scene.
   */
  removeMesh(id: string): void {
    const mesh = this.objects.get(id)
    if (mesh) {
      this.scene.remove(mesh)
      this.objects.delete(id)
    }
  }

  /**
   * Add a point light to the scene.
   */
  addPointLight(config: PointLightConfig): THREE.PointLight {
    const light = new THREE.PointLight(
      new THREE.Color(config.color),
      config.intensity,
      config.distance ?? 10,
      config.decay ?? 2
    )
    light.position.copy(config.position)
    light.name = `point_light_${config.id}`

    this.pointLights.set(config.id, light)
    this.scene.add(light)

    return light
  }

  /**
   * Remove a point light from the scene.
   */
  removePointLight(id: string): void {
    const light = this.pointLights.get(id)
    if (light) {
      this.scene.remove(light)
      light.dispose()
      this.pointLights.delete(id)
    }
  }

  /**
   * Get a point light by ID.
   */
  getPointLight(id: string): THREE.PointLight | undefined {
    return this.pointLights.get(id)
  }

  /**
   * Set point light intensity.
   */
  setPointLightIntensity(id: string, intensity: number): void {
    const light = this.pointLights.get(id)
    if (light) {
      light.intensity = intensity
    }
  }

  /**
   * Toggle all point lights on/off.
   */
  toggleAllLights(on: boolean, intensity?: number): void {
    for (const light of this.pointLights.values()) {
      light.intensity = on ? (intensity ?? 1) : 0
    }
  }

  /**
   * Add an object to the scene.
   */
  addObject(id: string, object: THREE.Object3D): void {
    this.objects.set(id, object)
    this.scene.add(object)
  }

  /**
   * Remove an object from the scene.
   */
  removeObject(id: string): void {
    const object = this.objects.get(id)
    if (object) {
      this.scene.remove(object)
      this.objects.delete(id)
    }
  }

  /**
   * Get an object by ID.
   */
  getObject(id: string): THREE.Object3D | undefined {
    return this.objects.get(id)
  }

  /**
   * Register an object as interactable.
   */
  addInteractable(object: THREE.Object3D): void {
    if (!this.interactables.includes(object)) {
      this.interactables.push(object)
    }
  }

  /**
   * Unregister an object as interactable.
   */
  removeInteractable(object: THREE.Object3D): void {
    const index = this.interactables.indexOf(object)
    if (index !== -1) {
      this.interactables.splice(index, 1)
    }
  }

  /**
   * Get all interactable objects.
   */
  getInteractables(): THREE.Object3D[] {
    // Combine manually added interactables with entity interactables
    const entityInteractables: THREE.Object3D[] = []
    for (const entity of this.entitySystem.getAllInstances()) {
      if (entity.isInteractable) {
        entityInteractables.push(entity.group)
      }
    }
    return [...this.interactables, ...entityInteractables]
  }

  /**
   * Add an object to collision list.
   */
  addCollisionObject(object: THREE.Object3D): void {
    if (!this.collisionObjects.includes(object)) {
      this.collisionObjects.push(object)
    }
  }

  /**
   * Remove an object from collision list.
   */
  removeCollisionObject(object: THREE.Object3D): void {
    const index = this.collisionObjects.indexOf(object)
    if (index !== -1) {
      this.collisionObjects.splice(index, 1)
    }
  }

  /**
   * Get all collision objects.
   */
  getCollisionObjects(): THREE.Object3D[] {
    return [...this.collisionObjects]
  }

  /**
   * Add an entity to the scene.
   */
  addEntity(entity: Entity): void {
    this.scene.add(entity.group)

    // Auto-register as interactable if applicable
    if (entity.isInteractable) {
      this.addInteractable(entity.group)
    }
  }

  /**
   * Remove an entity from the scene.
   */
  removeEntity(entity: Entity): void {
    this.scene.remove(entity.group)
    this.removeInteractable(entity.group)
    this.removeCollisionObject(entity.group)
  }

  /**
   * Update the scene each frame.
   */
  update(deltaTime: number): void {
    // Update entity system
    this.entitySystem.update(deltaTime, {
      params: {},
      state: {}
    })

    // Update particle effects
    if (this.sparkEffect) {
      this.sparkEffect.update(deltaTime)
    }
  }

  /**
   * Emit spark particles at a position.
   */
  emitSparks(position: THREE.Vector3, count?: number): void {
    if (this.sparkEffect) {
      this.sparkEffect.emit(position, count)
    }
  }

  /**
   * Clear all dynamic content (entities, lights, objects) but keep voxel world.
   */
  clearDynamic(): void {
    // Clear objects
    for (const object of this.objects.values()) {
      this.scene.remove(object)
    }
    this.objects.clear()

    // Clear point lights
    for (const light of this.pointLights.values()) {
      this.scene.remove(light)
      light.dispose()
    }
    this.pointLights.clear()

    // Clear interactables and collision
    this.interactables = []
    this.collisionObjects = []

    // Clear entities
    for (const entity of this.entitySystem.getAllInstances()) {
      this.scene.remove(entity.group)
    }
    this.entitySystem.dispose()
  }

  /**
   * Clear everything including voxel world.
   */
  clear(): void {
    this.clearDynamic()

    // Clear voxel renderer
    if (this.voxelRenderer) {
      this.voxelRenderer.dispose()
      this.voxelRenderer = null
    }

    this.voxelWorld = null
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.clear()

    if (this.sparkEffect) {
      this.sparkEffect.dispose()
      this.sparkEffect = null
    }

    if (this.ambientLight) {
      this.scene.remove(this.ambientLight)
      this.ambientLight.dispose()
    }

    if (this.directionalLight) {
      this.scene.remove(this.directionalLight)
      this.directionalLight.dispose()
    }
  }
}
