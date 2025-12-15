/**
 * Easing functions for animation interpolation.
 *
 * All functions take a normalized time value (0-1) and return
 * an eased value (0-1).
 */

export type EasingFunction = (t: number) => number

/**
 * Available easing functions.
 */
export const easingFunctions: Record<string, EasingFunction> = {
  // Linear - no easing
  linear: (t) => t,

  // Quadratic
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

  // Quadratic (explicit names)
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

  // Cubic
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  // Step - instant transition at t=1
  step: (t) => (t < 1 ? 0 : 1),
}

/**
 * Get an easing function by name.
 * Returns linear easing if the name is not found.
 */
export function getEasing(name: string | undefined): EasingFunction {
  if (!name) return easingFunctions.linear!
  return easingFunctions[name] ?? easingFunctions.linear!
}

/**
 * Interpolate between two numbers with easing.
 */
export function lerpNumber(
  from: number,
  to: number,
  t: number,
  easing: EasingFunction = easingFunctions.linear!
): number {
  const easedT = easing(t)
  return from + (to - from) * easedT
}

/**
 * Interpolate between two 3D vectors with easing.
 */
export function lerpVector3(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
  easing: EasingFunction = easingFunctions.linear!
): [number, number, number] {
  const easedT = easing(t)
  return [
    from[0] + (to[0] - from[0]) * easedT,
    from[1] + (to[1] - from[1]) * easedT,
    from[2] + (to[2] - from[2]) * easedT,
  ]
}
