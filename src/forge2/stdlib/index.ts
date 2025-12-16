/**
 * Forge 2.0 Standard Library
 *
 * Provides common utilities for game development:
 * - vec: Vector math operations
 * - math: Extended math functions
 * - list: List manipulation utilities
 * - string: String utilities
 * - random: Random number generation
 */

import type { ForgeValue, ForgeMap } from '../types'
import { createVecBindings } from './vec'

/**
 * Extended math functions beyond the built-ins.
 */
function createMathBindings(): Map<string, ForgeValue> {
  const bindings = new Map<string, ForgeValue>()

  const mathNamespace: ForgeMap = {
    // Trigonometry
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,

    // Rounding
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    trunc: Math.trunc,

    // Exponential/Logarithmic
    pow: Math.pow,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    exp: Math.exp,
    log: Math.log,
    log2: Math.log2,
    log10: Math.log10,

    // Utility
    abs: Math.abs,
    sign: Math.sign,
    min: (...args: number[]) => Math.min(...args),
    max: (...args: number[]) => Math.max(...args),

    // Clamping and mapping
    clamp: (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value)),

    lerp: (a: number, b: number, t: number) => a + (b - a) * t,

    inverseLerp: (a: number, b: number, value: number) => {
      if (a === b) return 0
      return (value - a) / (b - a)
    },

    map: (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
      const t = (value - inMin) / (inMax - inMin)
      return outMin + (outMax - outMin) * t
    },

    // Angle conversion
    radians: (degrees: number) => degrees * (Math.PI / 180),
    degrees: (radians: number) => radians * (180 / Math.PI),

    // Smoothing
    smoothstep: (edge0: number, edge1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
      return t * t * (3 - 2 * t)
    },

    smootherstep: (edge0: number, edge1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
      return t * t * t * (t * (t * 6 - 15) + 10)
    },

    // Constants
    PI: Math.PI,
    TAU: Math.PI * 2,
    E: Math.E,
    EPSILON: Number.EPSILON,
    INFINITY: Infinity,
  }

  bindings.set('math', mathNamespace)
  return bindings
}

/**
 * List manipulation utilities.
 */
function createListBindings(): Map<string, ForgeValue> {
  const bindings = new Map<string, ForgeValue>()

  const listNamespace: ForgeMap = {
    // Creation
    range: (start: number, end?: number, step: number = 1): number[] => {
      if (end === undefined) {
        end = start
        start = 0
      }
      const result: number[] = []
      if (step > 0) {
        for (let i = start; i < end; i += step) result.push(i)
      } else if (step < 0) {
        for (let i = start; i > end; i += step) result.push(i)
      }
      return result
    },

    repeat: (value: ForgeValue, count: number): ForgeValue[] => {
      return Array(count).fill(value)
    },

    // Transformation
    map: (list: ForgeValue[], fn: (item: ForgeValue, index: number) => ForgeValue): ForgeValue[] => {
      return list.map(fn)
    },

    filter: (list: ForgeValue[], fn: (item: ForgeValue, index: number) => boolean): ForgeValue[] => {
      return list.filter(fn)
    },

    reduce: (list: ForgeValue[], fn: (acc: ForgeValue, item: ForgeValue, index: number) => ForgeValue, initial: ForgeValue): ForgeValue => {
      return list.reduce(fn, initial)
    },

    flatMap: (list: ForgeValue[], fn: (item: ForgeValue, index: number) => ForgeValue[]): ForgeValue[] => {
      return list.flatMap(fn)
    },

    flatten: (list: ForgeValue[]): ForgeValue[] => {
      return list.flat()
    },

    // Search
    find: (list: ForgeValue[], fn: (item: ForgeValue, index: number) => boolean): ForgeValue | null => {
      return list.find(fn) ?? null
    },

    findIndex: (list: ForgeValue[], fn: (item: ForgeValue, index: number) => boolean): number => {
      return list.findIndex(fn)
    },

    indexOf: (list: ForgeValue[], item: ForgeValue): number => {
      return list.indexOf(item)
    },

    includes: (list: ForgeValue[], item: ForgeValue): boolean => {
      return list.includes(item)
    },

    every: (list: ForgeValue[], fn: (item: ForgeValue, index: number) => boolean): boolean => {
      return list.every(fn)
    },

    some: (list: ForgeValue[], fn: (item: ForgeValue, index: number) => boolean): boolean => {
      return list.some(fn)
    },

    // Manipulation
    concat: (...lists: ForgeValue[][]): ForgeValue[] => {
      return lists.flat()
    },

    slice: (list: ForgeValue[], start?: number, end?: number): ForgeValue[] => {
      return list.slice(start, end)
    },

    splice: (list: ForgeValue[], start: number, deleteCount: number, ...items: ForgeValue[]): ForgeValue[] => {
      const copy = [...list]
      copy.splice(start, deleteCount, ...items)
      return copy
    },

    reverse: (list: ForgeValue[]): ForgeValue[] => {
      return [...list].reverse()
    },

    sort: (list: ForgeValue[], compareFn?: (a: ForgeValue, b: ForgeValue) => number): ForgeValue[] => {
      return [...list].sort(compareFn)
    },

    shuffle: (list: ForgeValue[]): ForgeValue[] => {
      const result = [...list]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j]!, result[i]!]
      }
      return result
    },

    // Aggregation
    sum: (list: number[]): number => {
      return list.reduce((a, b) => a + b, 0)
    },

    product: (list: number[]): number => {
      return list.reduce((a, b) => a * b, 1)
    },

    min: (list: number[]): number => {
      return Math.min(...list)
    },

    max: (list: number[]): number => {
      return Math.max(...list)
    },

    average: (list: number[]): number => {
      if (list.length === 0) return 0
      return list.reduce((a, b) => a + b, 0) / list.length
    },

    // Set operations
    unique: (list: ForgeValue[]): ForgeValue[] => {
      return [...new Set(list)]
    },

    union: (a: ForgeValue[], b: ForgeValue[]): ForgeValue[] => {
      return [...new Set([...a, ...b])]
    },

    intersection: (a: ForgeValue[], b: ForgeValue[]): ForgeValue[] => {
      const setB = new Set(b)
      return a.filter(x => setB.has(x))
    },

    difference: (a: ForgeValue[], b: ForgeValue[]): ForgeValue[] => {
      const setB = new Set(b)
      return a.filter(x => !setB.has(x))
    },

    // Access
    first: (list: ForgeValue[]): ForgeValue | null => list[0] ?? null,
    last: (list: ForgeValue[]): ForgeValue | null => list[list.length - 1] ?? null,
    at: (list: ForgeValue[], index: number): ForgeValue | null => list.at(index) ?? null,

    // Info
    length: (list: ForgeValue[]): number => list.length,
    isEmpty: (list: ForgeValue[]): boolean => list.length === 0,
  }

  bindings.set('list', listNamespace)
  return bindings
}

/**
 * String manipulation utilities.
 */
function createStringBindings(): Map<string, ForgeValue> {
  const bindings = new Map<string, ForgeValue>()

  const stringNamespace: ForgeMap = {
    // Case
    toUpperCase: (s: string) => s.toUpperCase(),
    toLowerCase: (s: string) => s.toLowerCase(),
    capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
    titleCase: (s: string) => s.replace(/\b\w/g, c => c.toUpperCase()),

    // Trimming
    trim: (s: string) => s.trim(),
    trimStart: (s: string) => s.trimStart(),
    trimEnd: (s: string) => s.trimEnd(),

    // Padding
    padStart: (s: string, length: number, char: string = ' ') => s.padStart(length, char),
    padEnd: (s: string, length: number, char: string = ' ') => s.padEnd(length, char),

    // Splitting/Joining
    split: (s: string, separator: string) => s.split(separator),
    join: (list: string[], separator: string = '') => list.join(separator),

    // Search
    includes: (s: string, search: string) => s.includes(search),
    startsWith: (s: string, search: string) => s.startsWith(search),
    endsWith: (s: string, search: string) => s.endsWith(search),
    indexOf: (s: string, search: string) => s.indexOf(search),
    lastIndexOf: (s: string, search: string) => s.lastIndexOf(search),

    // Manipulation
    replace: (s: string, search: string, replacement: string) => s.replace(search, replacement),
    replaceAll: (s: string, search: string, replacement: string) => s.replaceAll(search, replacement),
    slice: (s: string, start?: number, end?: number) => s.slice(start, end),
    substring: (s: string, start: number, end?: number) => s.substring(start, end),
    repeat: (s: string, count: number) => s.repeat(count),
    reverse: (s: string) => s.split('').reverse().join(''),

    // Info
    length: (s: string) => s.length,
    isEmpty: (s: string) => s.length === 0,
    charAt: (s: string, index: number) => s.charAt(index),
    charCodeAt: (s: string, index: number) => s.charCodeAt(index),

    // Conversion
    fromCharCode: (...codes: number[]) => String.fromCharCode(...codes),
    toNumber: (s: string) => parseFloat(s),
    toInt: (s: string, radix: number = 10) => parseInt(s, radix),

    // Template
    format: (template: string, ...args: ForgeValue[]) => {
      let i = 0
      return template.replace(/{}/g, () => String(args[i++] ?? ''))
    },
  }

  bindings.set('string', stringNamespace)
  return bindings
}

/**
 * Random number generation utilities.
 */
function createRandomBindings(): Map<string, ForgeValue> {
  const bindings = new Map<string, ForgeValue>()

  const randomNamespace: ForgeMap = {
    // Basic
    random: () => Math.random(),

    // Integers
    int: (min: number, max: number) => {
      min = Math.ceil(min)
      max = Math.floor(max)
      return Math.floor(Math.random() * (max - min + 1)) + min
    },

    // Floats
    float: (min: number, max: number) => {
      return Math.random() * (max - min) + min
    },

    // Boolean
    bool: (probability: number = 0.5) => Math.random() < probability,

    // Selection
    choice: (list: ForgeValue[]) => {
      if (list.length === 0) return null
      return list[Math.floor(Math.random() * list.length)]
    },

    choices: (list: ForgeValue[], count: number) => {
      const result: ForgeValue[] = []
      for (let i = 0; i < count; i++) {
        result.push(list[Math.floor(Math.random() * list.length)]!)
      }
      return result
    },

    sample: (list: ForgeValue[], count: number) => {
      const copy = [...list]
      const result: ForgeValue[] = []
      for (let i = 0; i < count && copy.length > 0; i++) {
        const index = Math.floor(Math.random() * copy.length)
        result.push(copy.splice(index, 1)[0]!)
      }
      return result
    },

    shuffle: (list: ForgeValue[]) => {
      const result = [...list]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j]!, result[i]!]
      }
      return result
    },

    // Gaussian/Normal distribution
    gaussian: (mean: number = 0, stdDev: number = 1) => {
      // Box-Muller transform
      const u1 = Math.random()
      const u2 = Math.random()
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      return z0 * stdDev + mean
    },

    // Weighted random
    weighted: (items: ForgeValue[], weights: number[]) => {
      const totalWeight = weights.reduce((a, b) => a + b, 0)
      let random = Math.random() * totalWeight
      for (let i = 0; i < items.length; i++) {
        random -= weights[i]!
        if (random <= 0) return items[i]!
      }
      return items[items.length - 1]!
    },

    // Direction/Angle
    angle: () => Math.random() * Math.PI * 2,

    // Unit vectors
    unitVector2d: () => {
      const angle = Math.random() * Math.PI * 2
      return [Math.cos(angle), Math.sin(angle)]
    },

    unitVector3d: () => {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      return [
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
      ]
    },

    // In range
    inCircle: (radius: number = 1) => {
      const r = Math.sqrt(Math.random()) * radius
      const theta = Math.random() * Math.PI * 2
      return [r * Math.cos(theta), r * Math.sin(theta)]
    },

    inSphere: (radius: number = 1) => {
      const u = Math.random()
      const v = Math.random()
      const theta = u * 2 * Math.PI
      const phi = Math.acos(2 * v - 1)
      const r = Math.cbrt(Math.random()) * radius
      return [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ]
    },

    inRect: (width: number, height: number) => {
      return [Math.random() * width, Math.random() * height]
    },

    inBox: (width: number, height: number, depth: number) => {
      return [
        Math.random() * width,
        Math.random() * height,
        Math.random() * depth,
      ]
    },
  }

  bindings.set('random', randomNamespace)
  return bindings
}

/**
 * Create all standard library bindings.
 */
export function createStdlibBindings(): Map<string, ForgeValue> {
  const bindings = new Map<string, ForgeValue>()

  // Merge all namespace bindings
  for (const [key, value] of createVecBindings()) {
    bindings.set(key, value)
  }
  for (const [key, value] of createMathBindings()) {
    bindings.set(key, value)
  }
  for (const [key, value] of createListBindings()) {
    bindings.set(key, value)
  }
  for (const [key, value] of createStringBindings()) {
    bindings.set(key, value)
  }
  for (const [key, value] of createRandomBindings()) {
    bindings.set(key, value)
  }

  return bindings
}
