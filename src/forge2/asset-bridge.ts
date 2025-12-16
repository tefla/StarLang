/**
 * Forge 2.0 Asset Bridge
 *
 * Connects Forge scripts to the animated asset system.
 * Provides an `asset` namespace for asset manipulation.
 */

import * as THREE from 'three'
import type { ForgeValue, ForgeMap } from './types'

// Types that will be imported from the asset system when integrated
// For now, define minimal interfaces for type safety
export interface AnimatedAssetInstanceLike {
  group: THREE.Group
  getParam(name: string): unknown
  setParam(name: string, value: unknown): void
  setParams(params: Record<string, unknown>): void
  playAnimation(name: string): void
  stopAnimation(name: string): void
  stopAllAnimations(): void
  isAnimationPlaying(name: string): boolean
  setState(name: string): void
  getCurrentState(): string | null
  getStateNames(): string[]
  getAnimationNames(): string[]
  enableContinuousSpin(axis: 'x' | 'y' | 'z', speed: number, partIds?: string[]): void
  disableContinuousSpin(): void
  update(deltaTime: number): void
  getWorldPosition(): THREE.Vector3
  getBoundingBox(): THREE.Box3
  dispose(): void
}

export interface AnimatedAssetLoaderLike {
  createInstance(
    assetId: string,
    position: { x: number; y: number; z: number },
    rotation: number,
    params?: Record<string, unknown>,
    options?: { name?: string }
  ): AnimatedAssetInstanceLike | null
  hasAsset(assetId: string): boolean
  getAssetIds(): string[]
}

// ============================================================================
// Types
// ============================================================================

export interface AssetBridgeConfig {
  scene: THREE.Scene
  loader?: AnimatedAssetLoaderLike
}

interface AssetHandle {
  id: string
  instance: AnimatedAssetInstanceLike
  assetId: string
}

// ============================================================================
// Asset Bridge Class
// ============================================================================

export class AssetBridge {
  private scene: THREE.Scene
  private loader: AnimatedAssetLoaderLike | null
  private assets: Map<string, AssetHandle> = new Map()
  private nextId: number = 1

  constructor(config: AssetBridgeConfig) {
    this.scene = config.scene
    this.loader = config.loader ?? null
  }

  // ==========================================================================
  // Public API - Returns functions for Forge runtime
  // ==========================================================================

  /**
   * Create the asset namespace for Forge scripts.
   */
  createNamespace(): ForgeMap {
    return {
      // Asset creation
      create: this.createAsset.bind(this),
      exists: this.exists.bind(this),
      remove: this.removeAsset.bind(this),
      getInfo: this.getAssetInfo.bind(this),

      // Parameters
      getParam: this.getParam.bind(this),
      setParam: this.setParam.bind(this),
      setParams: this.setParams.bind(this),

      // Animation control
      playAnimation: this.playAnimation.bind(this),
      stopAnimation: this.stopAnimation.bind(this),
      stopAllAnimations: this.stopAllAnimations.bind(this),
      isPlaying: this.isAnimationPlaying.bind(this),

      // State control
      setState: this.setState.bind(this),
      getState: this.getState.bind(this),
      getStates: this.getStateNames.bind(this),
      getAnimations: this.getAnimationNames.bind(this),

      // Continuous effects
      enableSpin: this.enableSpin.bind(this),
      disableSpin: this.disableSpin.bind(this),

      // Transform
      setPosition: this.setPosition.bind(this),
      setRotation: this.setRotation.bind(this),
      setScale: this.setScale.bind(this),
      getPosition: this.getPosition.bind(this),
      getWorldPosition: this.getWorldPosition.bind(this),
      getBounds: this.getBounds.bind(this),

      // Visibility
      setVisible: this.setVisible.bind(this),
      isVisible: this.isVisible.bind(this),

      // Queries
      all: () => Array.from(this.assets.keys()),
      count: () => this.assets.size,
      availableAssets: this.getAvailableAssets.bind(this),
      hasAssetType: this.hasAssetType.bind(this),
    }
  }

  // ==========================================================================
  // Asset Creation
  // ==========================================================================

  private createAsset(
    assetId: string,
    x: number = 0,
    y: number = 0,
    z: number = 0,
    rotation: number = 0,
    params: ForgeMap = {}
  ): string | null {
    if (!this.loader) {
      console.warn('[AssetBridge] No loader configured')
      return null
    }

    const instance = this.loader.createInstance(
      assetId,
      { x, y, z },
      rotation,
      params as Record<string, unknown>
    )

    if (!instance) {
      console.warn(`[AssetBridge] Failed to create asset: ${assetId}`)
      return null
    }

    const id = `asset_${this.nextId++}`
    this.assets.set(id, { id, instance, assetId })
    this.scene.add(instance.group)

    return id
  }

  private exists(id: string): boolean {
    return this.assets.has(id)
  }

  private removeAsset(id: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    this.scene.remove(handle.instance.group)
    handle.instance.dispose()
    this.assets.delete(id)
    return true
  }

  private getAssetInfo(id: string): ForgeMap | null {
    const handle = this.assets.get(id)
    if (!handle) return null

    const pos = handle.instance.group.position
    const rot = handle.instance.group.rotation
    const scale = handle.instance.group.scale

    return {
      id: handle.id,
      assetId: handle.assetId,
      position: [pos.x, pos.y, pos.z],
      rotation: [rot.x, rot.y, rot.z],
      scale: [scale.x, scale.y, scale.z],
      visible: handle.instance.group.visible,
      currentState: handle.instance.getCurrentState(),
      states: handle.instance.getStateNames(),
      animations: handle.instance.getAnimationNames(),
    }
  }

  // ==========================================================================
  // Parameters
  // ==========================================================================

  private getParam(id: string, name: string): ForgeValue {
    const handle = this.assets.get(id)
    if (!handle) return null

    return handle.instance.getParam(name) as ForgeValue
  }

  private setParam(id: string, name: string, value: ForgeValue): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.setParam(name, value)
    return true
  }

  private setParams(id: string, params: ForgeMap): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.setParams(params as Record<string, unknown>)
    return true
  }

  // ==========================================================================
  // Animation Control
  // ==========================================================================

  private playAnimation(id: string, animationName: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.playAnimation(animationName)
    return true
  }

  private stopAnimation(id: string, animationName: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.stopAnimation(animationName)
    return true
  }

  private stopAllAnimations(id: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.stopAllAnimations()
    return true
  }

  private isAnimationPlaying(id: string, animationName: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    return handle.instance.isAnimationPlaying(animationName)
  }

  // ==========================================================================
  // State Control
  // ==========================================================================

  private setState(id: string, stateName: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.setState(stateName)
    return true
  }

  private getState(id: string): string | null {
    const handle = this.assets.get(id)
    if (!handle) return null

    return handle.instance.getCurrentState()
  }

  private getStateNames(id: string): string[] {
    const handle = this.assets.get(id)
    if (!handle) return []

    return handle.instance.getStateNames()
  }

  private getAnimationNames(id: string): string[] {
    const handle = this.assets.get(id)
    if (!handle) return []

    return handle.instance.getAnimationNames()
  }

  // ==========================================================================
  // Continuous Effects
  // ==========================================================================

  private enableSpin(
    id: string,
    axis: string = 'y',
    speed: number = Math.PI * 2,
    partIds?: string[]
  ): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    const validAxis = axis as 'x' | 'y' | 'z'
    if (validAxis !== 'x' && validAxis !== 'y' && validAxis !== 'z') {
      console.warn(`[AssetBridge] Invalid spin axis: ${axis}`)
      return false
    }

    handle.instance.enableContinuousSpin(validAxis, speed, partIds)
    return true
  }

  private disableSpin(id: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.disableContinuousSpin()
    return true
  }

  // ==========================================================================
  // Transform
  // ==========================================================================

  private setPosition(id: string, x: number, y: number, z: number): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.group.position.set(x, y, z)
    return true
  }

  private setRotation(id: string, x: number, y: number, z: number): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.group.rotation.set(x, y, z)
    return true
  }

  private setScale(id: string, x: number, y: number, z: number): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.group.scale.set(x, y, z)
    return true
  }

  private getPosition(id: string): number[] | null {
    const handle = this.assets.get(id)
    if (!handle) return null

    const pos = handle.instance.group.position
    return [pos.x, pos.y, pos.z]
  }

  private getWorldPosition(id: string): number[] | null {
    const handle = this.assets.get(id)
    if (!handle) return null

    const worldPos = handle.instance.getWorldPosition()
    return [worldPos.x, worldPos.y, worldPos.z]
  }

  private getBounds(id: string): ForgeMap | null {
    const handle = this.assets.get(id)
    if (!handle) return null

    const box = handle.instance.getBoundingBox()
    return {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      center: [
        (box.min.x + box.max.x) / 2,
        (box.min.y + box.max.y) / 2,
        (box.min.z + box.max.z) / 2,
      ],
      size: [
        box.max.x - box.min.x,
        box.max.y - box.min.y,
        box.max.z - box.min.z,
      ],
    }
  }

  // ==========================================================================
  // Visibility
  // ==========================================================================

  private setVisible(id: string, visible: boolean): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    handle.instance.group.visible = visible
    return true
  }

  private isVisible(id: string): boolean {
    const handle = this.assets.get(id)
    if (!handle) return false

    return handle.instance.group.visible
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  private getAvailableAssets(): string[] {
    if (!this.loader) return []
    return this.loader.getAssetIds()
  }

  private hasAssetType(assetId: string): boolean {
    if (!this.loader) return false
    return this.loader.hasAsset(assetId)
  }

  // ==========================================================================
  // Update (called per frame)
  // ==========================================================================

  /**
   * Update all managed assets. Call this from your game loop.
   */
  update(deltaTime: number): void {
    for (const handle of this.assets.values()) {
      handle.instance.update(deltaTime)
    }
  }

  // ==========================================================================
  // External Integration
  // ==========================================================================

  /**
   * Register an externally-created asset instance.
   */
  registerExternal(
    id: string,
    instance: AnimatedAssetInstanceLike,
    assetId: string
  ): void {
    this.assets.set(id, { id, instance, assetId })
  }

  /**
   * Unregister an asset without disposing it.
   */
  unregister(id: string): boolean {
    return this.assets.delete(id)
  }

  /**
   * Get the underlying asset instance for direct manipulation.
   */
  getInstance(id: string): AnimatedAssetInstanceLike | null {
    const handle = this.assets.get(id)
    return handle?.instance ?? null
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of all managed assets.
   */
  dispose(): void {
    for (const handle of this.assets.values()) {
      this.scene.remove(handle.instance.group)
      handle.instance.dispose()
    }
    this.assets.clear()
  }
}

/**
 * Create asset namespace bindings for Forge 2.0 runtime.
 */
export function createAssetBindings(config: AssetBridgeConfig): { asset: ForgeMap, bridge: AssetBridge } {
  const bridge = new AssetBridge(config)
  return {
    asset: bridge.createNamespace(),
    bridge,
  }
}
