// Compiled Entity Definition
// Target type for Forge entity compilation

/**
 * Screen configuration for an entity.
 */
export interface EntityScreenDef {
  size: [number, number]
  font?: string
  fontSize?: number
  background?: string
  lineHeight?: number
  padding?: number
}

/**
 * Style definition for text rendering.
 */
export interface EntityStyleDef {
  color?: string
  fontWeight?: string
  fontStyle?: string
}

/**
 * Event handler definition.
 */
export interface EntityEventHandler {
  event: string
  condition?: string  // Expression string for runtime evaluation
  actions: EntityAction[]
}

/**
 * Actions that can be performed in event handlers.
 */
export type EntityAction =
  | { type: 'set'; property: string; value: unknown }
  | { type: 'emit'; event: string }

/**
 * Render statement for building screen content.
 */
export type RenderElement =
  | { type: 'text'; content: string; centered?: boolean }
  | { type: 'row'; label: string; value: string }
  | { type: 'code'; content: string; lineNumbers?: boolean }
  | { type: 'match'; expression: string; cases: RenderMatchCase[] }

export interface RenderMatchCase {
  pattern: string
  elements: RenderElement[]
}

/**
 * Parameter definition for an entity.
 */
export interface EntityParamDef {
  type: 'string' | 'number' | 'boolean' | 'enum'
  default?: unknown
  enumValues?: string[]
}

/**
 * Compiled entity definition.
 * This is the runtime representation of a Forge entity.
 */
export interface CompiledEntityDef {
  id: string
  params?: Record<string, EntityParamDef>
  screen?: EntityScreenDef
  render?: RenderElement[]
  styles?: Record<string, EntityStyleDef>
  events?: EntityEventHandler[]
}
