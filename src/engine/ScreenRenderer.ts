// ScreenRenderer - Canvas-based screen rendering for entities
// Driven by Forge entity definitions

import * as THREE from 'three'
import type {
  EntityScreenDef,
  EntityStyleDef,
  RenderElement,
  RenderMatchCase
} from '../types/entity'

/**
 * Context for rendering - provides access to entity params and runtime state.
 */
export interface RenderContext {
  params: Record<string, unknown>
  state?: Record<string, unknown>
}

/**
 * ScreenRenderer - Renders canvas-based screens from Forge entity definitions.
 *
 * Creates an HTML canvas, renders content based on RenderElements,
 * and provides a THREE.js texture for use in 3D scenes.
 */
export class ScreenRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture

  private config: EntityScreenDef
  private styles: Record<string, EntityStyleDef>
  private elements: RenderElement[]

  constructor(
    config: EntityScreenDef,
    styles: Record<string, EntityStyleDef> = {},
    elements: RenderElement[] = []
  ) {
    this.config = config
    this.styles = styles
    this.elements = elements

    // Create canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = config.size[0]
    this.canvas.height = config.size[1]
    this.ctx = this.canvas.getContext('2d')!

    // Create THREE.js texture
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
  }

  /**
   * Get the THREE.js texture for use in materials.
   */
  getTexture(): THREE.CanvasTexture {
    return this.texture
  }

  /**
   * Get canvas dimensions.
   */
  getSize(): [number, number] {
    return this.config.size
  }

  /**
   * Update render elements (for dynamic content).
   */
  setElements(elements: RenderElement[]): void {
    this.elements = elements
  }

  /**
   * Render the screen with the given context.
   */
  render(context: RenderContext): void {
    const ctx = this.ctx
    const width = this.canvas.width
    const height = this.canvas.height

    // Clear with background color
    ctx.fillStyle = this.config.background ?? '#1a2744'
    ctx.fillRect(0, 0, width, height)

    // Add subtle scanlines effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    for (let y = 0; y < height; y += 2) {
      ctx.fillRect(0, y, width, 1)
    }

    // Set up font
    const fontSize = this.config.fontSize ?? 16
    const font = this.config.font ?? 'monospace'
    ctx.font = `${fontSize}px "${font}", monospace`

    const lineHeight = this.config.lineHeight ?? 20
    const padding = this.config.padding ?? 20

    // Render elements
    let y = padding
    this.renderElements(this.elements, context, padding, y, lineHeight)

    // Mark texture for update
    this.texture.needsUpdate = true
  }

  /**
   * Render a list of elements recursively.
   */
  private renderElements(
    elements: RenderElement[],
    context: RenderContext,
    x: number,
    startY: number,
    lineHeight: number
  ): number {
    let y = startY

    for (const element of elements) {
      y = this.renderElement(element, context, x, y, lineHeight)
    }

    return y
  }

  /**
   * Render a single element.
   */
  private renderElement(
    element: RenderElement,
    context: RenderContext,
    x: number,
    y: number,
    lineHeight: number
  ): number {
    switch (element.type) {
      case 'text':
        return this.renderText(element, context, x, y, lineHeight)
      case 'row':
        return this.renderRow(element, context, x, y, lineHeight)
      case 'code':
        return this.renderCode(element, context, x, y, lineHeight)
      case 'match':
        return this.renderMatch(element, context, x, y, lineHeight)
      default:
        return y + lineHeight
    }
  }

  /**
   * Render a text element.
   */
  private renderText(
    element: { type: 'text'; content: string; centered?: boolean },
    context: RenderContext,
    x: number,
    y: number,
    lineHeight: number
  ): number {
    const content = this.interpolate(element.content, context)
    const style = this.getStyleForContent(content)

    this.ctx.fillStyle = style.color ?? '#d0d0d0'

    if (element.centered) {
      const metrics = this.ctx.measureText(content)
      const centerX = (this.canvas.width - metrics.width) / 2
      this.ctx.fillText(content, centerX, y + lineHeight)
    } else {
      this.ctx.fillText(content, x, y + lineHeight)
    }

    return y + lineHeight
  }

  /**
   * Render a row element (label + value).
   */
  private renderRow(
    element: { type: 'row'; label: string; value: string },
    context: RenderContext,
    x: number,
    y: number,
    lineHeight: number
  ): number {
    const label = this.interpolate(element.label, context)
    const value = this.interpolate(element.value, context)

    // Render label in muted color
    const labelStyle = this.styles.muted ?? {}
    this.ctx.fillStyle = labelStyle.color ?? '#9ca3af'
    this.ctx.fillText(label, x, y + lineHeight)

    // Render value - apply style based on content
    const valueStyle = this.getStyleForContent(value)
    this.ctx.fillStyle = valueStyle.color ?? '#d0d0d0'

    // Position value after label
    const labelWidth = this.ctx.measureText(label).width
    this.ctx.fillText(value, x + labelWidth + 8, y + lineHeight)

    return y + lineHeight
  }

  /**
   * Render a code block element.
   */
  private renderCode(
    element: { type: 'code'; content: string; lineNumbers?: boolean },
    context: RenderContext,
    x: number,
    y: number,
    lineHeight: number
  ): number {
    const content = this.interpolate(element.content, context)
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''

      if (element.lineNumbers) {
        // Line number
        const lineNum = String(i + 1).padStart(3, ' ')
        this.ctx.fillStyle = '#6b7280'
        this.ctx.fillText(`${lineNum}│`, x, y + lineHeight)

        // Code content
        this.ctx.fillStyle = '#d0d0d0'
        this.ctx.fillText(line, x + 40, y + lineHeight)
      } else {
        this.ctx.fillStyle = '#d0d0d0'
        this.ctx.fillText(line, x, y + lineHeight)
      }

      y += lineHeight
    }

    return y
  }

  /**
   * Render a match element (conditional rendering).
   */
  private renderMatch(
    element: { type: 'match'; expression: string; cases: RenderMatchCase[] },
    context: RenderContext,
    x: number,
    y: number,
    lineHeight: number
  ): number {
    // Evaluate expression to get current value
    const value = this.evaluateExpression(element.expression, context)

    // Find matching case
    for (const caseItem of element.cases) {
      if (this.matchesPattern(value, caseItem.pattern)) {
        return this.renderElements(caseItem.elements, context, x, y, lineHeight)
      }
    }

    // No match - return unchanged y
    return y
  }

  /**
   * Interpolate template strings like "{$param}" or "{$state.value}".
   */
  private interpolate(template: string, context: RenderContext): string {
    // Handle reactive refs: $param or $state.path
    if (template.startsWith('$')) {
      return String(this.evaluateExpression(template, context))
    }

    // Handle template interpolation: "Text {$param} more text"
    return template.replace(/\{(\$[^}]+)\}/g, (_, expr) => {
      return String(this.evaluateExpression(expr, context))
    })
  }

  /**
   * Evaluate a simple expression against the context.
   */
  private evaluateExpression(expr: string, context: RenderContext): unknown {
    // Handle reactive refs: $param or $param.path
    if (expr.startsWith('$')) {
      const path = expr.slice(1).split('.')
      let value: unknown = context.params

      for (const key of path) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[key]
        } else {
          return undefined
        }
      }

      // If not found in params, try state
      if (value === undefined && context.state) {
        value = context.state
        for (const key of path) {
          if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[key]
          } else {
            return undefined
          }
        }
      }

      return value
    }

    // Plain identifier or literal
    return expr
  }

  /**
   * Check if a value matches a pattern.
   */
  private matchesPattern(value: unknown, pattern: string): boolean {
    // Simple string/identifier matching
    return String(value) === pattern
  }

  /**
   * Get style based on content (for automatic highlighting).
   */
  private getStyleForContent(content: string): EntityStyleDef {
    // Check for explicit style markers
    if (content.includes('═') || content.includes('─') || content.includes('───')) {
      return this.styles.header ?? { color: '#4a6fa5' }
    }
    if (content.includes('✓') || content.includes('OK') || content.includes('NOMINAL')) {
      return this.styles.success ?? { color: '#77dd77' }
    }
    if (content.includes('⚠') || content.includes('WARNING') || content.includes('WARN')) {
      return this.styles.warning ?? { color: '#ffb347' }
    }
    if (content.includes('✗') || content.includes('ERROR') || content.includes('CRITICAL')) {
      return this.styles.error ?? { color: '#ff6b6b' }
    }
    if (content.startsWith('>')) {
      return this.styles.prompt ?? { color: '#77dd77' }
    }

    return {}
  }

  /**
   * Create a THREE.js material for the screen.
   */
  createMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      map: this.texture,
      emissive: new THREE.Color(this.config.background ?? '#1a2744'),
      emissiveIntensity: 0.5,
      emissiveMap: this.texture,
      side: THREE.DoubleSide
    })
  }

  /**
   * Set emissive intensity (for focus effects).
   */
  setEmissiveIntensity(material: THREE.MeshStandardMaterial, intensity: number): void {
    material.emissiveIntensity = intensity
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this.texture.dispose()
  }
}
