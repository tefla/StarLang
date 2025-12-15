/**
 * Manages animation playback for animated assets.
 *
 * Handles:
 * - Playing, stopping, and looping animations
 * - Keyframe interpolation with easing
 * - Named state application
 */

import type {
  AnimationDef,
  AnimationKeyframe,
  PartState,
  AssetStateDef,
} from './AnimatedAsset'
import type { DynamicPartMesh } from './DynamicPartMesh'
import { getEasing } from './Easing'

interface ActiveAnimation {
  name: string
  animation: AnimationDef
  startTime: number
}

/**
 * Controls animations for an animated asset instance.
 */
export class AnimationController {
  private parts: Map<string, DynamicPartMesh>
  private states: Record<string, AssetStateDef>
  private animations: Record<string, AnimationDef>

  private currentStateName: string | null = null
  private activeAnimations: Map<string, ActiveAnimation> = new Map()

  constructor(
    parts: Map<string, DynamicPartMesh>,
    states: Record<string, AssetStateDef>,
    animations: Record<string, AnimationDef>
  ) {
    this.parts = parts
    this.states = states
    this.animations = animations
  }

  /**
   * Get the current state name.
   */
  getCurrentState(): string | null {
    return this.currentStateName
  }

  /**
   * Get all available state names.
   */
  getStateNames(): string[] {
    return Object.keys(this.states)
  }

  /**
   * Get all available animation names.
   */
  getAnimationNames(): string[] {
    return Object.keys(this.animations)
  }

  /**
   * Set the current state (instant, no animation).
   */
  setState(stateName: string): void {
    const state = this.states[stateName]
    if (!state) {
      console.warn(`AnimationController: Unknown state "${stateName}"`)
      return
    }

    this.currentStateName = stateName

    for (const [partId, partState] of Object.entries(state.parts)) {
      const part = this.parts.get(partId)
      if (part) {
        part.applyState(partState)
      }
    }
  }

  /**
   * Play an animation.
   * If the animation is already playing, it restarts from the beginning.
   */
  playAnimation(animationName: string): void {
    const animation = this.animations[animationName]
    if (!animation) {
      console.warn(`AnimationController: Unknown animation "${animationName}"`)
      return
    }

    this.activeAnimations.set(animationName, {
      name: animationName,
      animation,
      startTime: performance.now(),
    })
  }

  /**
   * Stop an animation.
   */
  stopAnimation(animationName: string): void {
    this.activeAnimations.delete(animationName)
  }

  /**
   * Stop all animations.
   */
  stopAllAnimations(): void {
    this.activeAnimations.clear()
  }

  /**
   * Check if an animation is playing.
   */
  isAnimationPlaying(animationName: string): boolean {
    return this.activeAnimations.has(animationName)
  }

  /**
   * Update animations (call each frame).
   */
  update(_deltaTime: number): void {
    const now = performance.now()

    for (const [name, active] of this.activeAnimations.entries()) {
      const { animation, startTime } = active
      const elapsed = now - startTime
      const duration = animation.duration

      let normalizedTime = elapsed / duration

      if (animation.loop) {
        normalizedTime = normalizedTime % 1
      } else if (normalizedTime >= 1) {
        // Animation finished
        normalizedTime = 1
        this.applyAnimationFrame(animation, normalizedTime)
        this.activeAnimations.delete(name)
        continue
      }

      this.applyAnimationFrame(animation, normalizedTime)
    }
  }

  /**
   * Apply a specific frame of an animation.
   * @param animation The animation definition
   * @param time Normalized time (0-1)
   */
  private applyAnimationFrame(animation: AnimationDef, time: number): void {
    const { keyframes } = animation

    if (keyframes.length === 0) return

    // Find surrounding keyframes
    let fromFrame = keyframes[0]!
    let toFrame = keyframes[keyframes.length - 1]!
    let segmentStart = 0
    let segmentEnd = 1

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (keyframes[i]!.time <= time && keyframes[i + 1]!.time >= time) {
        fromFrame = keyframes[i]!
        toFrame = keyframes[i + 1]!
        segmentStart = fromFrame.time
        segmentEnd = toFrame.time
        break
      }
    }

    // Handle edge case: time before first keyframe
    if (time < keyframes[0]!.time) {
      fromFrame = keyframes[0]!
      toFrame = keyframes[0]!
      segmentStart = 0
      segmentEnd = keyframes[0]!.time
    }

    // Calculate interpolation factor within segment
    const segmentDuration = segmentEnd - segmentStart
    let t = segmentDuration > 0 ? (time - segmentStart) / segmentDuration : 1

    // Apply easing from the target keyframe
    const easingName = toFrame.easing
    const easingFn = getEasing(easingName)
    t = easingFn(t)

    // Get from/to states
    const fromState = this.resolveKeyframeState(fromFrame)
    const toState = this.resolveKeyframeState(toFrame)

    // Interpolate each part
    for (const partId of this.parts.keys()) {
      const part = this.parts.get(partId)!
      const from = fromState[partId] ?? {}
      const to = toState[partId] ?? {}
      part.lerpState(from, to, t)
    }
  }

  /**
   * Resolve a keyframe to part states.
   * Keyframes can reference named states or have direct part overrides.
   */
  private resolveKeyframeState(
    keyframe: AnimationKeyframe
  ): Record<string, PartState> {
    // If keyframe references a named state
    if (keyframe.state && this.states[keyframe.state]) {
      return this.states[keyframe.state]!.parts
    }

    // If keyframe has direct part overrides
    if (keyframe.parts) {
      return keyframe.parts
    }

    // Empty state - no changes
    return {}
  }

  /**
   * Seek to a specific time in an animation (for editor preview).
   */
  seekAnimation(animationName: string, normalizedTime: number): void {
    const animation = this.animations[animationName]
    if (!animation) return

    // Clamp time to 0-1
    const time = Math.max(0, Math.min(1, normalizedTime))
    this.applyAnimationFrame(animation, time)
  }
}
