/**
 * Forge 2.0 Standard Library: Vector Math
 *
 * Provides vector operations for 2D and 3D game math.
 * Vectors are represented as arrays: [x, y] or [x, y, z]
 */

import type { ForgeValue, ForgeMap } from '../types'

type Vec2 = [number, number]
type Vec3 = [number, number, number]
type Vec = Vec2 | Vec3 | number[]

function isVec(v: ForgeValue): v is Vec {
  return Array.isArray(v) && v.every(n => typeof n === 'number')
}

function assertVec(v: ForgeValue, name: string): asserts v is Vec {
  if (!isVec(v)) {
    throw new Error(`${name} must be a vector (array of numbers)`)
  }
}

/**
 * Create a vector.
 */
export function vec(...components: number[]): Vec {
  return components
}

/**
 * Create a 2D vector.
 */
export function vec2(x: number = 0, y: number = 0): Vec2 {
  return [x, y]
}

/**
 * Create a 3D vector.
 */
export function vec3(x: number = 0, y: number = 0, z: number = 0): Vec3 {
  return [x, y, z]
}

/**
 * Add two vectors.
 */
export function add(a: ForgeValue, b: ForgeValue): Vec {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')
  const len = Math.max(a.length, b.length)
  const result: number[] = []
  for (let i = 0; i < len; i++) {
    result.push((a[i] ?? 0) + (b[i] ?? 0))
  }
  return result
}

/**
 * Subtract vector b from a.
 */
export function sub(a: ForgeValue, b: ForgeValue): Vec {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')
  const len = Math.max(a.length, b.length)
  const result: number[] = []
  for (let i = 0; i < len; i++) {
    result.push((a[i] ?? 0) - (b[i] ?? 0))
  }
  return result
}

/**
 * Multiply vector by scalar or component-wise multiply two vectors.
 */
export function mul(a: ForgeValue, b: ForgeValue): Vec | number {
  assertVec(a, 'First argument')

  if (typeof b === 'number') {
    // Scalar multiplication
    return a.map(n => n * b)
  }

  assertVec(b, 'Second argument')
  // Component-wise multiplication
  const len = Math.max(a.length, b.length)
  const result: number[] = []
  for (let i = 0; i < len; i++) {
    result.push((a[i] ?? 0) * (b[i] ?? 0))
  }
  return result
}

/**
 * Divide vector by scalar or component-wise divide.
 */
export function div(a: ForgeValue, b: ForgeValue): Vec {
  assertVec(a, 'First argument')

  if (typeof b === 'number') {
    if (b === 0) throw new Error('Division by zero')
    return a.map(n => n / b)
  }

  assertVec(b, 'Second argument')
  const len = Math.max(a.length, b.length)
  const result: number[] = []
  for (let i = 0; i < len; i++) {
    const divisor = b[i] ?? 1
    if (divisor === 0) throw new Error('Division by zero')
    result.push((a[i] ?? 0) / divisor)
  }
  return result
}

/**
 * Dot product of two vectors.
 */
export function dot(a: ForgeValue, b: ForgeValue): number {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) {
    sum += a[i]! * b[i]!
  }
  return sum
}

/**
 * Cross product of two 3D vectors.
 */
export function cross(a: ForgeValue, b: ForgeValue): Vec3 {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')

  const ax = a[0] ?? 0
  const ay = a[1] ?? 0
  const az = a[2] ?? 0
  const bx = b[0] ?? 0
  const by = b[1] ?? 0
  const bz = b[2] ?? 0

  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ]
}

/**
 * Length/magnitude of a vector.
 */
export function length(v: ForgeValue): number {
  assertVec(v, 'Argument')
  return Math.sqrt(v.reduce((sum, n) => sum + n * n, 0))
}

/**
 * Squared length (avoids sqrt, useful for comparisons).
 */
export function lengthSq(v: ForgeValue): number {
  assertVec(v, 'Argument')
  return v.reduce((sum, n) => sum + n * n, 0)
}

/**
 * Normalize a vector to unit length.
 */
export function normalize(v: ForgeValue): Vec {
  assertVec(v, 'Argument')
  const len = length(v)
  if (len === 0) return v.map(() => 0)
  return v.map(n => n / len)
}

/**
 * Distance between two points.
 */
export function distance(a: ForgeValue, b: ForgeValue): number {
  return length(sub(a, b))
}

/**
 * Squared distance (avoids sqrt).
 */
export function distanceSq(a: ForgeValue, b: ForgeValue): number {
  return lengthSq(sub(a, b))
}

/**
 * Linear interpolation between two vectors.
 */
export function lerp(a: ForgeValue, b: ForgeValue, t: number): Vec {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')
  const len = Math.max(a.length, b.length)
  const result: number[] = []
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0
    const vb = b[i] ?? 0
    result.push(va + (vb - va) * t)
  }
  return result
}

/**
 * Clamp each component between min and max.
 */
export function clamp(v: ForgeValue, min: number, max: number): Vec {
  assertVec(v, 'First argument')
  return v.map(n => Math.min(max, Math.max(min, n)))
}

/**
 * Negate a vector.
 */
export function negate(v: ForgeValue): Vec {
  assertVec(v, 'Argument')
  return v.map(n => -n)
}

/**
 * Reflect vector off a surface with given normal.
 */
export function reflect(v: ForgeValue, normal: ForgeValue): Vec {
  assertVec(v, 'First argument')
  assertVec(normal, 'Second argument')
  const d = 2 * dot(v, normal)
  return sub(v, mul(normal, d) as Vec)
}

/**
 * Angle between two vectors in radians.
 */
export function angle(a: ForgeValue, b: ForgeValue): number {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')
  const d = dot(a, b)
  const la = length(a)
  const lb = length(b)
  if (la === 0 || lb === 0) return 0
  return Math.acos(Math.max(-1, Math.min(1, d / (la * lb))))
}

/**
 * Project vector a onto vector b.
 */
export function project(a: ForgeValue, b: ForgeValue): Vec {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')
  const bLenSq = lengthSq(b)
  if (bLenSq === 0) return b.map(() => 0)
  const scalar = dot(a, b) / bLenSq
  return mul(b, scalar) as Vec
}

/**
 * Get a perpendicular 2D vector (rotated 90 degrees).
 */
export function perp2d(v: ForgeValue): Vec2 {
  assertVec(v, 'Argument')
  return [-(v[1] ?? 0), v[0] ?? 0]
}

/**
 * Rotate a 2D vector by angle (radians).
 */
export function rotate2d(v: ForgeValue, angle: number): Vec2 {
  assertVec(v, 'Argument')
  const x = v[0] ?? 0
  const y = v[1] ?? 0
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    x * cos - y * sin,
    x * sin + y * cos,
  ]
}

/**
 * Check if two vectors are approximately equal.
 */
export function equals(a: ForgeValue, b: ForgeValue, epsilon: number = 0.0001): boolean {
  assertVec(a, 'First argument')
  assertVec(b, 'Second argument')
  if (a.length !== b.length) return false
  return a.every((v, i) => Math.abs(v - b[i]!) < epsilon)
}

/**
 * Create a map of all vec functions for binding to runtime.
 */
export function createVecBindings(): Map<string, ForgeValue> {
  const bindings = new Map<string, ForgeValue>()

  // Create a vec namespace object
  const vecNamespace: ForgeMap = {
    vec,
    vec2,
    vec3,
    add,
    sub,
    mul,
    div,
    dot,
    cross,
    length,
    lengthSq,
    normalize,
    distance,
    distanceSq,
    lerp,
    clamp,
    negate,
    reflect,
    angle,
    project,
    perp2d,
    rotate2d,
    equals,
    // Constants
    ZERO2: [0, 0] as Vec2,
    ZERO3: [0, 0, 0] as Vec3,
    ONE2: [1, 1] as Vec2,
    ONE3: [1, 1, 1] as Vec3,
    UP: [0, 1, 0] as Vec3,
    DOWN: [0, -1, 0] as Vec3,
    LEFT: [-1, 0, 0] as Vec3,
    RIGHT: [1, 0, 0] as Vec3,
    FORWARD: [0, 0, -1] as Vec3,
    BACK: [0, 0, 1] as Vec3,
  }

  bindings.set('vec', vecNamespace)

  return bindings
}
