/**
 * VoxelTypeRegistry - Unified access to voxel type definitions
 *
 * This registry bridges the TypeScript VoxelType enum (compile-time constants)
 * with Forge config (runtime data). It provides:
 *
 * 1. Validation that config IDs match the enum (catches mismatches)
 * 2. Support for custom types beyond the enum (loaded from config)
 * 3. Unified access for all voxel type properties (color, solid, transparent)
 *
 * Core types (AIR, WALL, etc.) are defined in the VoxelType enum for TypeScript
 * type safety. Additional custom types can be added via voxel-types.config.forge.
 */

import { VoxelType } from './VoxelTypes'
import { Config, configRegistry } from '../forge/ConfigRegistry'

/**
 * Definition for a voxel type.
 */
export interface VoxelTypeDef {
  id: number
  name: string
  color: number
  solid: boolean
  transparent: boolean
  passable: boolean
  isCustom: boolean  // true if not from TypeScript enum
}

/**
 * Validation result for config/enum matching.
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * VoxelTypeRegistry - Central registry for all voxel type information.
 *
 * Usage:
 *   const id = VoxelTypeRegistry.getId('WALL')  // returns 2
 *   const color = VoxelTypeRegistry.getColor(VoxelType.WALL)  // returns color
 *   const isValid = VoxelTypeRegistry.validate()  // checks config vs enum
 */
export class VoxelTypeRegistry {
  private static types = new Map<number, VoxelTypeDef>()
  private static nameToId = new Map<string, number>()
  private static initialized = false

  /**
   * Initialize the registry from config.
   * Called automatically on first use, but can be called explicitly to validate early.
   */
  static initialize(): ValidationResult {
    if (this.initialized) {
      return { valid: true, errors: [], warnings: [] }
    }

    this.types.clear()
    this.nameToId.clear()

    const errors: string[] = []
    const warnings: string[] = []

    // First, register all types from the TypeScript enum
    const enumValues = Object.entries(VoxelType)
      .filter(([key, value]) => typeof value === 'number')
      .map(([name, id]) => ({ name, id: id as number }))

    for (const { name, id } of enumValues) {
      this.types.set(id, {
        id,
        name,
        color: 0x888888,  // Default, will be overwritten by config
        solid: true,
        transparent: false,
        passable: false,
        isCustom: false
      })
      this.nameToId.set(name, id)
    }

    // Then, load config and update/validate
    const configTypes = Config.voxelTypes.getAllTypes()

    for (const { name, id } of configTypes) {
      const existing = this.types.get(id)

      if (existing && !existing.isCustom) {
        // Validate enum type matches config
        if (existing.name !== name) {
          errors.push(
            `Voxel type ID ${id} mismatch: enum has '${existing.name}', config has '${name}'`
          )
        }

        // Update properties from config
        existing.color = Config.voxelTypes.getColor(name)
        existing.solid = Config.voxelTypes.isSolid(name)
        existing.transparent = Config.voxelTypes.isTransparent(name)
        existing.passable = Config.voxelTypes.isPassable(name)
      } else if (!existing) {
        // Custom type from config only
        this.types.set(id, {
          id,
          name,
          color: Config.voxelTypes.getColor(name),
          solid: Config.voxelTypes.isSolid(name),
          transparent: Config.voxelTypes.isTransparent(name),
          passable: Config.voxelTypes.isPassable(name),
          isCustom: true
        })
        this.nameToId.set(name, id)
      }
    }

    // Check for enum types missing from config
    for (const [id, def] of this.types) {
      if (!def.isCustom) {
        const inConfig = configTypes.some(ct => ct.id === id)
        if (!inConfig) {
          warnings.push(
            `Enum type '${def.name}' (id=${id}) not found in voxel-types config`
          )
        }
      }
    }

    this.initialized = true

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate that config matches enum definitions.
   */
  static validate(): ValidationResult {
    this.ensureInitialized()
    // Re-validate by re-initializing
    this.initialized = false
    return this.initialize()
  }

  /**
   * Ensure the registry is initialized.
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize()
    }
  }

  /**
   * Get type ID by name.
   */
  static getId(name: string): number | undefined {
    this.ensureInitialized()
    return this.nameToId.get(name)
  }

  /**
   * Get type name by ID.
   */
  static getName(id: number): string | undefined {
    this.ensureInitialized()
    return this.types.get(id)?.name
  }

  /**
   * Get type definition by ID.
   */
  static getDef(id: number): VoxelTypeDef | undefined {
    this.ensureInitialized()
    return this.types.get(id)
  }

  /**
   * Get type definition by name.
   */
  static getDefByName(name: string): VoxelTypeDef | undefined {
    this.ensureInitialized()
    const id = this.nameToId.get(name)
    return id !== undefined ? this.types.get(id) : undefined
  }

  /**
   * Get color for a voxel type.
   */
  static getColor(id: number): number {
    this.ensureInitialized()
    return this.types.get(id)?.color ?? 0x888888
  }

  /**
   * Check if a voxel type is solid.
   */
  static isSolid(id: number): boolean {
    this.ensureInitialized()
    return this.types.get(id)?.solid ?? true
  }

  /**
   * Check if a voxel type is transparent.
   */
  static isTransparent(id: number): boolean {
    this.ensureInitialized()
    return this.types.get(id)?.transparent ?? false
  }

  /**
   * Check if a voxel type is passable.
   */
  static isPassable(id: number): boolean {
    this.ensureInitialized()
    return this.types.get(id)?.passable ?? false
  }

  /**
   * Get all registered types.
   */
  static getAllTypes(): VoxelTypeDef[] {
    this.ensureInitialized()
    return Array.from(this.types.values()).sort((a, b) => a.id - b.id)
  }

  /**
   * Get all custom types (not from enum).
   */
  static getCustomTypes(): VoxelTypeDef[] {
    this.ensureInitialized()
    return this.getAllTypes().filter(t => t.isCustom)
  }

  /**
   * Get types in a named group.
   */
  static getTypeGroup(groupName: string): number[] {
    return Config.voxelTypes.getTypeGroup(groupName)
  }

  /**
   * Check if a type is valid (exists in registry).
   */
  static isValid(id: number): boolean {
    this.ensureInitialized()
    return this.types.has(id)
  }

  /**
   * Check if a type name is valid.
   */
  static isValidName(name: string): boolean {
    this.ensureInitialized()
    return this.nameToId.has(name)
  }

  /**
   * Reset the registry (for testing).
   */
  static reset(): void {
    this.types.clear()
    this.nameToId.clear()
    this.initialized = false
  }
}

// Export a convenience function that validates on import
export function validateVoxelTypes(): ValidationResult {
  return VoxelTypeRegistry.validate()
}
