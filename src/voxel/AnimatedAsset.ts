/**
 * Type definitions for animated voxel assets.
 *
 * Extends the basic VoxelAsset system with:
 * - Dynamic parts that become separate THREE.js objects
 * - Named states with visual configurations
 * - Keyframe animations with easing
 * - State bindings that connect runtime parameters to visuals
 */

import type { VoxelPlacement, Rotation90 } from './VoxelAsset'

/**
 * Easing function names supported by the animation system.
 */
export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'step'

/**
 * A transform applied to a dynamic part.
 */
export interface PartTransform {
  position?: [number, number, number]
  rotation?: Rotation90
  scale?: [number, number, number]
}

/**
 * Visual properties that can be animated.
 */
export interface PartVisuals {
  /** Emissive color as hex string (e.g., "#00ff00") */
  emissive?: string
  /** Emissive intensity (0-1) */
  emissiveIntensity?: number
  /** Base color override as hex string */
  color?: string
  /** Opacity (0-1) for transparency */
  opacity?: number
  /** Show/hide the part */
  visible?: boolean
}

/**
 * Combined state for a dynamic part (transform + visuals).
 */
export interface PartState extends PartTransform, PartVisuals {}

/**
 * Compact box definition for generating solid blocks.
 */
export interface BoxDef {
  /** Width (X) in voxels */
  width: number
  /** Height (Y) in voxels */
  height: number
  /** Depth (Z) in voxels */
  depth: number
  /** Voxel type for all voxels in the box */
  type: string
}

/**
 * A dynamic part that can be animated independently.
 * These become separate THREE.js objects at runtime.
 */
export interface DynamicPartDef {
  /** Unique ID for this part within the asset */
  id: string
  /** Voxels that make up this part (can be empty if using box) */
  voxels?: VoxelPlacement[]
  /** Compact box definition - generates a solid block of voxels */
  box?: BoxDef
  /** Local anchor point for transforms */
  anchor?: { x: number; y: number; z: number }
  /** Initial transform relative to asset origin */
  transform?: PartTransform
}

/**
 * A named state configuration for the asset.
 * States define the visual configuration of all parts.
 */
export interface AssetStateDef {
  /** State for each part by ID */
  parts: Record<string, PartState>
}

/**
 * A single keyframe in an animation.
 */
export interface AnimationKeyframe {
  /** Normalized time (0-1) within the animation */
  time: number
  /** Reference to a named state (mutually exclusive with parts) */
  state?: string
  /** Direct part state overrides (mutually exclusive with state) */
  parts?: Record<string, PartState>
  /** Easing function to use when transitioning TO this keyframe */
  easing?: EasingType
}

/**
 * An animation definition with keyframes.
 */
export interface AnimationDef {
  /** Duration in milliseconds */
  duration: number
  /** Whether the animation loops */
  loop?: boolean
  /** Keyframes defining the animation */
  keyframes: AnimationKeyframe[]
}

/**
 * Action to take when a parameter changes value.
 */
export interface StateBindingAction {
  /** Set the asset to this named state */
  setState?: string
  /** Start playing this animation */
  playAnimation?: string
  /** Stop this animation */
  stopAnimation?: string
}

/**
 * Binding between parameter values and actions.
 * Keys are string representations of parameter values.
 */
export type StateBindingDef = Record<string, StateBindingAction>

/**
 * Parameter definition for an animated asset.
 */
export interface AnimatedParameterDef {
  type: 'enum' | 'number' | 'boolean'
  values?: string[]
  default: string | number | boolean
}

/**
 * Extended asset definition with animation support.
 * Backwards compatible with VoxelAssetDef.
 */
export interface AnimatedAssetDef {
  /** Unique asset ID */
  id: string
  /** Display name */
  name: string
  /** Optional description */
  description?: string
  /** Anchor point for placement */
  anchor: { x: number; y: number; z: number }

  /** Static voxels (baked into world mesh) */
  voxels: VoxelPlacement[]

  /** Child assets (existing composition system) */
  children?: Array<{
    asset: string
    offset: [number, number, number]
    rotation?: Rotation90
    condition?: string
  }>

  /** Dynamic parts that become runtime THREE.js objects */
  dynamicParts?: DynamicPartDef[]

  /** Named states for the asset */
  states?: Record<string, AssetStateDef>

  /** Animation definitions */
  animations?: Record<string, AnimationDef>

  /** Bindings from parameter values to states/animations */
  stateBindings?: Record<string, StateBindingDef>

  /** Parameters that can drive state changes */
  parameters?: Record<string, AnimatedParameterDef>
}

/**
 * Type guard to check if an asset has animation capabilities.
 */
export function isAnimatedAsset(asset: unknown): asset is AnimatedAssetDef {
  if (!asset || typeof asset !== 'object') return false
  const a = asset as Record<string, unknown>
  return (
    'dynamicParts' in a ||
    'states' in a ||
    'animations' in a ||
    'stateBindings' in a
  )
}

/**
 * Type guard to check if an asset has dynamic parts.
 */
export function hasDynamicParts(asset: AnimatedAssetDef): boolean {
  return !!(asset.dynamicParts && asset.dynamicParts.length > 0)
}
