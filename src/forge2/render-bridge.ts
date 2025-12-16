/**
 * Forge 2.0 Render Bridge
 *
 * Connects Forge scripts to the THREE.js rendering system.
 * Provides a `render` namespace for scene manipulation.
 */

import * as THREE from 'three'
import type { ForgeValue, ForgeMap } from './types'

// ============================================================================
// Types
// ============================================================================

export interface RenderBridgeConfig {
  scene: THREE.Scene
  voxelSize?: number
}

export interface ObjectHandle {
  id: string
  object: THREE.Object3D
  type: 'mesh' | 'group' | 'light' | 'sprite'
}

// ============================================================================
// Render Bridge Class
// ============================================================================

export class RenderBridge {
  private scene: THREE.Scene
  private voxelSize: number
  private objects: Map<string, ObjectHandle> = new Map()
  private nextId: number = 1

  // Material cache for reuse
  private materialCache: Map<string, THREE.Material> = new Map()

  // Geometry cache for primitives
  private boxGeometry: THREE.BoxGeometry
  private sphereGeometry: THREE.SphereGeometry
  private planeGeometry: THREE.PlaneGeometry

  constructor(config: RenderBridgeConfig) {
    this.scene = config.scene
    this.voxelSize = config.voxelSize ?? 0.025

    // Pre-create common geometries
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1)
    this.sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16)
    this.planeGeometry = new THREE.PlaneGeometry(1, 1)
  }

  // ==========================================================================
  // Public API - Returns functions for Forge runtime
  // ==========================================================================

  /**
   * Create the render namespace for Forge scripts.
   */
  createNamespace(): ForgeMap {
    return {
      // Object creation
      box: this.createBox.bind(this),
      sphere: this.createSphere.bind(this),
      plane: this.createPlane.bind(this),
      group: this.createGroup.bind(this),
      light: this.createLight.bind(this),

      // Object management
      spawn: this.spawn.bind(this),
      despawn: this.despawn.bind(this),
      get: this.getObject.bind(this),
      exists: this.exists.bind(this),

      // Transforms
      setPosition: this.setPosition.bind(this),
      setRotation: this.setRotation.bind(this),
      setScale: this.setScale.bind(this),
      move: this.move.bind(this),
      rotate: this.rotate.bind(this),
      lookAt: this.lookAt.bind(this),

      // Material/appearance
      setColor: this.setColor.bind(this),
      setEmissive: this.setEmissive.bind(this),
      setOpacity: this.setOpacity.bind(this),
      setVisible: this.setVisible.bind(this),

      // Hierarchy
      addChild: this.addChild.bind(this),
      removeChild: this.removeChild.bind(this),
      setParent: this.setParent.bind(this),

      // Queries
      getPosition: this.getPosition.bind(this),
      getRotation: this.getRotation.bind(this),
      getWorldPosition: this.getWorldPosition.bind(this),

      // Debug drawing
      drawLine: this.drawLine.bind(this),
      drawBox: this.drawBox.bind(this),
      clearDebug: this.clearDebug.bind(this),

      // Scene info
      objects: () => Array.from(this.objects.keys()),
      count: () => this.objects.size,

      // Constants
      VOXEL_SIZE: this.voxelSize,
    }
  }

  // ==========================================================================
  // Object Creation
  // ==========================================================================

  private createBox(
    width: number = 1,
    height: number = 1,
    depth: number = 1,
    color: string = '#ffffff'
  ): string {
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const material = this.getMaterial(color)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    return this.registerObject(mesh, 'mesh')
  }

  private createSphere(
    radius: number = 0.5,
    color: string = '#ffffff'
  ): string {
    const geometry = new THREE.SphereGeometry(radius, 16, 16)
    const material = this.getMaterial(color)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    return this.registerObject(mesh, 'mesh')
  }

  private createPlane(
    width: number = 1,
    height: number = 1,
    color: string = '#ffffff'
  ): string {
    const geometry = new THREE.PlaneGeometry(width, height)
    const material = this.getMaterial(color)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.receiveShadow = true

    return this.registerObject(mesh, 'mesh')
  }

  private createGroup(): string {
    const group = new THREE.Group()
    return this.registerObject(group, 'group')
  }

  private createLight(
    type: string = 'point',
    color: string = '#ffffff',
    intensity: number = 1
  ): string {
    let light: THREE.Light

    switch (type) {
      case 'point':
        light = new THREE.PointLight(new THREE.Color(color), intensity, 10)
        break
      case 'spot':
        light = new THREE.SpotLight(new THREE.Color(color), intensity)
        break
      case 'directional':
        light = new THREE.DirectionalLight(new THREE.Color(color), intensity)
        break
      default:
        light = new THREE.PointLight(new THREE.Color(color), intensity, 10)
    }

    return this.registerObject(light, 'light')
  }

  // ==========================================================================
  // Object Management
  // ==========================================================================

  private spawn(id: string): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    if (!handle.object.parent) {
      this.scene.add(handle.object)
    }
    return true
  }

  private despawn(id: string): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    if (handle.object.parent) {
      handle.object.parent.remove(handle.object)
    }
    return true
  }

  private getObject(id: string): ForgeMap | null {
    const handle = this.objects.get(id)
    if (!handle) return null

    return {
      id: handle.id,
      type: handle.type,
      position: this.vec3ToArray(handle.object.position),
      rotation: this.eulerToArray(handle.object.rotation),
      scale: this.vec3ToArray(handle.object.scale),
      visible: handle.object.visible,
    }
  }

  private exists(id: string): boolean {
    return this.objects.has(id)
  }

  // ==========================================================================
  // Transforms
  // ==========================================================================

  private setPosition(id: string, x: number, y: number, z: number): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    handle.object.position.set(x, y, z)
    return true
  }

  private setRotation(id: string, x: number, y: number, z: number): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    handle.object.rotation.set(x, y, z)
    return true
  }

  private setScale(id: string, x: number, y: number, z: number): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    handle.object.scale.set(x, y, z)
    return true
  }

  private move(id: string, dx: number, dy: number, dz: number): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    handle.object.position.x += dx
    handle.object.position.y += dy
    handle.object.position.z += dz
    return true
  }

  private rotate(id: string, dx: number, dy: number, dz: number): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    handle.object.rotation.x += dx
    handle.object.rotation.y += dy
    handle.object.rotation.z += dz
    return true
  }

  private lookAt(id: string, x: number, y: number, z: number): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    handle.object.lookAt(x, y, z)
    return true
  }

  // ==========================================================================
  // Material/Appearance
  // ==========================================================================

  private setColor(id: string, color: string): boolean {
    const handle = this.objects.get(id)
    if (!handle || handle.type !== 'mesh') return false

    const mesh = handle.object as THREE.Mesh
    const material = mesh.material as THREE.MeshStandardMaterial
    if (material.color) {
      material.color.set(color)
    }
    return true
  }

  private setEmissive(id: string, color: string, intensity: number = 1): boolean {
    const handle = this.objects.get(id)
    if (!handle || handle.type !== 'mesh') return false

    const mesh = handle.object as THREE.Mesh
    const material = mesh.material as THREE.MeshStandardMaterial
    if (material.emissive) {
      material.emissive.set(color)
      material.emissiveIntensity = intensity
    }
    return true
  }

  private setOpacity(id: string, opacity: number): boolean {
    const handle = this.objects.get(id)
    if (!handle || handle.type !== 'mesh') return false

    const mesh = handle.object as THREE.Mesh
    const material = mesh.material as THREE.MeshStandardMaterial
    material.transparent = opacity < 1
    material.opacity = opacity
    return true
  }

  private setVisible(id: string, visible: boolean): boolean {
    const handle = this.objects.get(id)
    if (!handle) return false

    handle.object.visible = visible
    return true
  }

  // ==========================================================================
  // Hierarchy
  // ==========================================================================

  private addChild(parentId: string, childId: string): boolean {
    const parent = this.objects.get(parentId)
    const child = this.objects.get(childId)
    if (!parent || !child) return false

    parent.object.add(child.object)
    return true
  }

  private removeChild(parentId: string, childId: string): boolean {
    const parent = this.objects.get(parentId)
    const child = this.objects.get(childId)
    if (!parent || !child) return false

    parent.object.remove(child.object)
    return true
  }

  private setParent(childId: string, parentId: string | null): boolean {
    const child = this.objects.get(childId)
    if (!child) return false

    // Remove from current parent
    if (child.object.parent) {
      child.object.parent.remove(child.object)
    }

    // Add to new parent or scene
    if (parentId) {
      const parent = this.objects.get(parentId)
      if (parent) {
        parent.object.add(child.object)
      }
    } else {
      this.scene.add(child.object)
    }

    return true
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  private getPosition(id: string): ForgeValue[] | null {
    const handle = this.objects.get(id)
    if (!handle) return null

    return this.vec3ToArray(handle.object.position)
  }

  private getRotation(id: string): ForgeValue[] | null {
    const handle = this.objects.get(id)
    if (!handle) return null

    return this.eulerToArray(handle.object.rotation)
  }

  private getWorldPosition(id: string): ForgeValue[] | null {
    const handle = this.objects.get(id)
    if (!handle) return null

    const worldPos = new THREE.Vector3()
    handle.object.getWorldPosition(worldPos)
    return this.vec3ToArray(worldPos)
  }

  // ==========================================================================
  // Debug Drawing
  // ==========================================================================

  private debugGroup: THREE.Group | null = null

  private getDebugGroup(): THREE.Group {
    if (!this.debugGroup) {
      this.debugGroup = new THREE.Group()
      this.debugGroup.name = 'ForgeDebug'
      this.scene.add(this.debugGroup)
    }
    return this.debugGroup
  }

  private drawLine(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    color: string = '#ff0000'
  ): void {
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) })
    const points = [
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x2, y2, z2),
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const line = new THREE.Line(geometry, material)
    this.getDebugGroup().add(line)
  }

  private drawBox(
    x: number, y: number, z: number,
    width: number, height: number, depth: number,
    color: string = '#ff0000'
  ): void {
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const edges = new THREE.EdgesGeometry(geometry)
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) })
    const wireframe = new THREE.LineSegments(edges, material)
    wireframe.position.set(x, y, z)
    this.getDebugGroup().add(wireframe)
  }

  private clearDebug(): void {
    if (this.debugGroup) {
      while (this.debugGroup.children.length > 0) {
        const child = this.debugGroup.children[0]
        this.debugGroup.remove(child)
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    }
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  private registerObject(object: THREE.Object3D, type: ObjectHandle['type']): string {
    const id = `obj_${this.nextId++}`
    object.name = id

    this.objects.set(id, { id, object, type })
    return id
  }

  private getMaterial(color: string): THREE.MeshStandardMaterial {
    const key = `standard_${color}`
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.7,
        metalness: 0.1,
      }))
    }
    // Clone to allow per-object modifications
    return (this.materialCache.get(key) as THREE.MeshStandardMaterial).clone()
  }

  private vec3ToArray(v: THREE.Vector3): number[] {
    return [v.x, v.y, v.z]
  }

  private eulerToArray(e: THREE.Euler): number[] {
    return [e.x, e.y, e.z]
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of all managed objects.
   */
  dispose(): void {
    for (const handle of this.objects.values()) {
      if (handle.object.parent) {
        handle.object.parent.remove(handle.object)
      }
      if (handle.object instanceof THREE.Mesh) {
        handle.object.geometry.dispose()
        if (Array.isArray(handle.object.material)) {
          handle.object.material.forEach(m => m.dispose())
        } else {
          handle.object.material.dispose()
        }
      }
    }
    this.objects.clear()

    for (const material of this.materialCache.values()) {
      material.dispose()
    }
    this.materialCache.clear()

    this.clearDebug()
    if (this.debugGroup) {
      this.scene.remove(this.debugGroup)
      this.debugGroup = null
    }

    this.boxGeometry.dispose()
    this.sphereGeometry.dispose()
    this.planeGeometry.dispose()
  }

  // ==========================================================================
  // External Object Registration (for integrating existing objects)
  // ==========================================================================

  /**
   * Register an externally-created object with the bridge.
   */
  registerExternal(id: string, object: THREE.Object3D, type: ObjectHandle['type'] = 'group'): void {
    this.objects.set(id, { id, object, type })
    object.name = id
  }

  /**
   * Unregister an object without disposing it.
   */
  unregister(id: string): boolean {
    return this.objects.delete(id)
  }
}

/**
 * Create render namespace bindings for Forge 2.0 runtime.
 */
export function createRenderBindings(scene: THREE.Scene, voxelSize?: number): { render: ForgeMap, bridge: RenderBridge } {
  const bridge = new RenderBridge({ scene, voxelSize })
  return {
    render: bridge.createNamespace(),
    bridge,
  }
}
