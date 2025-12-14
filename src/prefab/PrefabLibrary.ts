/**
 * Prefab library for managing prefab templates.
 *
 * Provides storage, search, and CRUD operations for prefabs.
 */

import type {
  Prefab,
  PrefabCategory,
  PrefabBounds
} from './PrefabTypes'
import { voxelKey, parseVoxelKey } from './PrefabTypes'
import { VoxelType, type Voxel, type VoxelCoord } from '../voxel/VoxelTypes'
import { VoxelWorld } from '../voxel/VoxelWorld'

/**
 * Callback for library changes.
 */
export type LibraryChangeListener = (event: {
  type: 'add' | 'update' | 'remove'
  prefab: Prefab
}) => void

/**
 * Manages a collection of prefab templates.
 */
export class PrefabLibrary {
  /** All prefabs indexed by ID */
  private prefabs: Map<string, Prefab> = new Map()

  /** Change listeners */
  private listeners: LibraryChangeListener[] = []

  /** Counter for generating unique IDs */
  private nextId = 1

  /**
   * Generate a unique prefab ID.
   */
  generateId(): string {
    return `prefab_${this.nextId++}`
  }

  /**
   * Get all prefabs.
   */
  getAll(): Prefab[] {
    return Array.from(this.prefabs.values())
  }

  /**
   * Get prefab by ID.
   */
  get(id: string): Prefab | undefined {
    return this.prefabs.get(id)
  }

  /**
   * Add a new prefab to the library.
   */
  add(prefab: Prefab): void {
    this.prefabs.set(prefab.id, prefab)
    this.notifyListeners({ type: 'add', prefab })
  }

  /**
   * Update an existing prefab.
   * This will affect all instances that reference it.
   */
  update(prefab: Prefab): void {
    if (!this.prefabs.has(prefab.id)) {
      throw new Error(`Prefab not found: ${prefab.id}`)
    }
    this.prefabs.set(prefab.id, {
      ...prefab,
      metadata: {
        createdAt: prefab.metadata?.createdAt ?? new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        author: prefab.metadata?.author,
        description: prefab.metadata?.description,
        tags: prefab.metadata?.tags
      }
    })
    this.notifyListeners({ type: 'update', prefab })
  }

  /**
   * Remove a prefab from the library.
   */
  remove(id: string): boolean {
    const prefab = this.prefabs.get(id)
    if (!prefab) return false

    this.prefabs.delete(id)
    this.notifyListeners({ type: 'remove', prefab })
    return true
  }

  /**
   * Search prefabs by name.
   */
  searchByName(query: string): Prefab[] {
    const lowerQuery = query.toLowerCase()
    return this.getAll().filter(p =>
      p.name.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Get prefabs by category.
   */
  getByCategory(category: PrefabCategory): Prefab[] {
    return this.getAll().filter(p => p.category === category)
  }

  /**
   * Get prefabs by tag.
   */
  getByTag(tag: string): Prefab[] {
    return this.getAll().filter(p =>
      p.metadata?.tags?.includes(tag)
    )
  }

  /**
   * Create a prefab from a region of the voxel world.
   */
  createFromRegion(
    world: VoxelWorld,
    minVoxel: VoxelCoord,
    maxVoxel: VoxelCoord,
    options: {
      name: string
      category?: PrefabCategory
      anchor?: VoxelCoord
    }
  ): Prefab {
    const voxels: Record<string, Voxel> = {}

    // Extract voxels from region
    for (let x = minVoxel.x; x <= maxVoxel.x; x++) {
      for (let y = minVoxel.y; y <= maxVoxel.y; y++) {
        for (let z = minVoxel.z; z <= maxVoxel.z; z++) {
          const voxel = world.getVoxel(x, y, z)
          if (voxel !== VoxelType.AIR) {
            // Store relative to min corner (or custom anchor)
            const anchor = options.anchor ?? minVoxel
            const relX = x - anchor.x
            const relY = y - anchor.y
            const relZ = z - anchor.z
            voxels[voxelKey({ x: relX, y: relY, z: relZ })] = voxel
          }
        }
      }
    }

    // Calculate bounds relative to anchor
    const anchor = options.anchor ?? minVoxel
    const bounds: PrefabBounds = {
      minX: minVoxel.x - anchor.x,
      minY: minVoxel.y - anchor.y,
      minZ: minVoxel.z - anchor.z,
      maxX: maxVoxel.x - anchor.x,
      maxY: maxVoxel.y - anchor.y,
      maxZ: maxVoxel.z - anchor.z
    }

    const prefab: Prefab = {
      id: this.generateId(),
      name: options.name,
      category: options.category ?? 'other',
      voxels,
      bounds,
      anchor: { x: 0, y: 0, z: 0 },
      entities: [],
      connectors: [],
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      }
    }

    this.add(prefab)
    return prefab
  }

  /**
   * Subscribe to library changes.
   */
  subscribe(listener: LibraryChangeListener): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify all listeners of a change.
   */
  private notifyListeners(event: Parameters<LibraryChangeListener>[0]): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  /**
   * Serialize library to JSON.
   */
  toJSON(): { prefabs: Prefab[] } {
    return { prefabs: this.getAll() }
  }

  /**
   * Load library from JSON.
   */
  static fromJSON(data: { prefabs: Prefab[] }): PrefabLibrary {
    const library = new PrefabLibrary()
    for (const prefab of data.prefabs) {
      library.prefabs.set(prefab.id, prefab)
      // Track highest ID for generation
      const match = prefab.id.match(/prefab_(\d+)/)
      if (match && match[1]) {
        library.nextId = Math.max(library.nextId, parseInt(match[1], 10) + 1)
      }
    }
    return library
  }

  /**
   * Get statistics about the library.
   */
  getStats(): {
    totalPrefabs: number
    byCategory: Record<string, number>
    totalVoxels: number
  } {
    const byCategory: Record<string, number> = {}
    let totalVoxels = 0

    for (const prefab of this.prefabs.values()) {
      byCategory[prefab.category] = (byCategory[prefab.category] ?? 0) + 1
      totalVoxels += Object.keys(prefab.voxels).length
    }

    return {
      totalPrefabs: this.prefabs.size,
      byCategory,
      totalVoxels
    }
  }
}
