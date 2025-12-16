// Forge DSL - Developer-facing language for content authoring
// Exports the complete Forge toolchain

export { ForgeLexer, tokenize, LexerError, type Token, type TokenType } from './lexer'
export { ForgeParser, parse, ParseError } from './parser'
export { ForgeCompiler, compileModule, CompileError, type CompileResult } from './compiler'
export {
  ForgeError,
  formatForgeError,
  attachSourceContext,
  formatErrors,
  type ForgeErrorLocation,
  type ForgeErrorOptions
} from './errors'
export * as AST from './types'
export {
  ForgeHotReload,
  getForgeHotReload,
  enableForgeHotReload,
  type ForgeHotReloadEvent,
  type ForgeHotReloadEventType,
  type ForgeHotReloadHandler
} from './hot-reload'
export {
  ForgeHotReloadClient,
  getForgeHotReloadClient,
  enableClientHotReload
} from './hot-reload-client'

import { parse, ParseError } from './parser'
import { LexerError } from './lexer'
import { compileModule } from './compiler'
import { formatErrors } from './errors'
import type { AnimatedAssetDef } from '../voxel/AnimatedAsset'
import type { ShipLayout } from '../types/layout'
import type { CompiledEntityDef } from '../types/entity'

/**
 * Compile Forge source code to an AnimatedAssetDef.
 * Convenience function for single-asset files.
 */
export function compileAsset(source: string, filePath?: string): AnimatedAssetDef | null {
  try {
    const module = parse(source)
    const results = compileModule(module)

    if (results.assets.length === 0) {
      return null
    }

    const first = results.assets[0]!
    if (!first.success || !first.result) {
      throw new Error(formatErrors(first.errors, source, filePath))
    }

    return first.result
  } catch (e) {
    if (e instanceof ParseError || e instanceof LexerError) {
      throw new Error(formatErrors([e], source, filePath))
    }
    throw e
  }
}

/**
 * Compile multiple Forge assets from source.
 */
export function compileAssets(source: string, filePath?: string): AnimatedAssetDef[] {
  try {
    const module = parse(source)
    const results = compileModule(module)
    const assets: AnimatedAssetDef[] = []

    for (const result of results.assets) {
      if (result.success && result.result) {
        assets.push(result.result)
      } else {
        throw new Error(formatErrors(result.errors, source, filePath))
      }
    }

    return assets
  } catch (e) {
    if (e instanceof ParseError || e instanceof LexerError) {
      throw new Error(formatErrors([e], source, filePath))
    }
    throw e
  }
}

/**
 * Compile Forge source code to a ShipLayout.
 * Convenience function for single-layout files.
 */
export function compileLayout(source: string, filePath?: string): ShipLayout | null {
  try {
    const module = parse(source)
    const results = compileModule(module)

    if (results.layouts.length === 0) {
      return null
    }

    const first = results.layouts[0]!
    if (!first.success || !first.result) {
      throw new Error(formatErrors(first.errors, source, filePath))
    }

    return first.result
  } catch (e) {
    if (e instanceof ParseError || e instanceof LexerError) {
      throw new Error(formatErrors([e], source, filePath))
    }
    throw e
  }
}

/**
 * Compile Forge source code to a CompiledEntityDef.
 * Convenience function for single-entity files.
 */
export function compileEntity(source: string, filePath?: string): CompiledEntityDef | null {
  try {
    const module = parse(source)
    const results = compileModule(module)

    if (results.entities.length === 0) {
      return null
    }

    const first = results.entities[0]!
    if (!first.success || !first.result) {
      throw new Error(formatErrors(first.errors, source, filePath))
    }

    return first.result
  } catch (e) {
    if (e instanceof ParseError || e instanceof LexerError) {
      throw new Error(formatErrors([e], source, filePath))
    }
    throw e
  }
}
