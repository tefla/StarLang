/**
 * Forge 2.0 UI Bridge
 *
 * Connects Forge scripts to the DOM for UI rendering.
 * Provides a `ui` namespace for creating text, buttons, panels, and screens.
 */

import type { ForgeMap } from './types'
import type { Runtime } from './runtime'

// ============================================================================
// Types
// ============================================================================

export interface UIBridgeConfig {
  /** Container element for UI (typically the game container) */
  container: HTMLElement
  /** Base z-index for UI elements (default: 1000) */
  zIndexBase?: number
}

export interface UIElementHandle {
  id: string
  element: HTMLElement
  type: 'text' | 'button' | 'panel' | 'screen'
  parent: string | null
}

export type AnchorPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

// ============================================================================
// UI Bridge Class
// ============================================================================

export class UIBridge {
  private container: HTMLElement
  private uiContainer: HTMLElement
  private elements: Map<string, UIElementHandle> = new Map()
  private nextId: number = 1
  private zIndexBase: number
  private runtime: Runtime | null = null

  constructor(config: UIBridgeConfig) {
    this.container = config.container
    this.zIndexBase = config.zIndexBase ?? 1000

    // Create dedicated UI container
    this.uiContainer = document.createElement('div')
    this.uiContainer.id = 'forge-ui-container'
    this.uiContainer.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: ${this.zIndexBase};
      overflow: hidden;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    `
    this.container.appendChild(this.uiContainer)
  }

  // ==========================================================================
  // Runtime Integration
  // ==========================================================================

  /**
   * Attach runtime for event emission (button clicks, etc.)
   */
  attachRuntime(runtime: Runtime): void {
    this.runtime = runtime
  }

  // ==========================================================================
  // Public API - Returns functions for Forge runtime
  // ==========================================================================

  /**
   * Create the ui namespace for Forge scripts.
   */
  createNamespace(): ForgeMap {
    return {
      // Element creation
      text: this.createText.bind(this),
      button: this.createButton.bind(this),
      panel: this.createPanel.bind(this),
      screen: this.createScreen.bind(this),

      // Hierarchy
      add: this.addToParent.bind(this),
      remove: this.removeElement.bind(this),
      destroy: this.removeElement.bind(this),  // Alias for remove

      // Visibility
      show: this.showElement.bind(this),
      hide: this.hideElement.bind(this),
      isVisible: this.isVisible.bind(this),
      toggle: this.toggleVisibility.bind(this),

      // Content updates
      setText: this.setText.bind(this),
      setStyle: this.setStyle.bind(this),

      // Queries
      exists: this.exists.bind(this),
      elements: () => Array.from(this.elements.keys()),
      count: () => this.elements.size,
    }
  }

  // ==========================================================================
  // Element Creation
  // ==========================================================================

  private createText(
    content: string,
    options: ForgeMap = {}
  ): string {
    const id = `ui_text_${this.nextId++}`

    const el = document.createElement('div')
    el.id = id
    el.textContent = content

    // Check if this text should be clickable
    const onClick = options.onClick as string | undefined
    const isClickable = !!onClick

    el.style.cssText = `
      position: absolute;
      pointer-events: ${isClickable ? 'auto' : 'none'};
      cursor: ${isClickable ? 'pointer' : 'default'};
      font-family: ${options.fontFamily || "'JetBrains Mono', monospace"};
      font-size: ${options.fontSize || 16}px;
      color: ${options.color || '#ffffff'};
      white-space: nowrap;
      text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      ${isClickable ? 'transition: color 0.15s ease;' : ''}
    `

    // Add hover effect for clickable text
    if (isClickable) {
      const originalColor = options.color as string || '#ffffff'
      const hoverColor = options.hoverColor as string || '#00ff88'
      el.addEventListener('mouseenter', () => {
        el.style.color = hoverColor
      })
      el.addEventListener('mouseleave', () => {
        el.style.color = originalColor
      })

      // Click handling - emit event to Forge runtime
      el.addEventListener('click', () => {
        if (this.runtime) {
          this.runtime.emit(`ui:click:${onClick}`, { id, text: content })
          this.runtime.emit('ui:click', { id, text: content, handler: onClick })
        }
      })
    }

    this.applyAnchor(el, (options.anchor as AnchorPosition) || 'top-left')
    this.applyOffset(el, options.x as number || 0, options.y as number || 0)

    // Text elements are shown by default when created at root level
    // or hidden until added to a parent
    if (!options._inParent) {
      this.uiContainer.appendChild(el)
    }

    this.elements.set(id, { id, element: el, type: 'text', parent: null })
    return id
  }

  private createButton(
    text: string,
    options: ForgeMap = {}
  ): string {
    const id = `ui_btn_${this.nextId++}`

    const el = document.createElement('button')
    el.id = id
    el.textContent = text
    el.style.cssText = `
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      font-family: ${options.fontFamily || "'JetBrains Mono', monospace"};
      font-size: ${options.fontSize || 16}px;
      color: ${options.color || '#ffffff'};
      background: ${options.background || '#4a6fa5'};
      border: ${options.border || '2px solid rgba(255, 255, 255, 0.3)'};
      padding: ${options.padding || '12px 24px'};
      border-radius: ${options.borderRadius || '4px'};
      transition: all 0.2s ease;
      outline: none;
    `

    // Hover effect
    el.addEventListener('mouseenter', () => {
      el.style.background = options.hoverBackground as string || '#5a8fbf'
      el.style.transform = el.style.transform.replace('scale(1)', 'scale(1.05)') || 'scale(1.05)'
    })
    el.addEventListener('mouseleave', () => {
      el.style.background = options.background as string || '#4a6fa5'
      el.style.transform = el.style.transform.replace('scale(1.05)', '') || ''
    })

    // Click handling - emit event to Forge runtime
    const onClick = options.onClick as string | undefined
    el.addEventListener('click', () => {
      if (this.runtime) {
        if (onClick) {
          // Named event: ui:click:start_game
          this.runtime.emit(`ui:click:${onClick}`, { id, text })
        }
        // Always emit generic event too
        this.runtime.emit('ui:click', { id, text, handler: onClick || null })
      }
    })

    this.applyAnchor(el, (options.anchor as AnchorPosition) || 'center')
    this.applyOffset(el, options.x as number || 0, options.y as number || 0)

    this.elements.set(id, { id, element: el, type: 'button', parent: null })
    return id
  }

  private createPanel(options: ForgeMap = {}): string {
    const id = `ui_panel_${this.nextId++}`

    const el = document.createElement('div')
    el.id = id
    el.style.cssText = `
      position: absolute;
      pointer-events: none;
      display: flex;
      flex-direction: ${options.direction || 'column'};
      align-items: ${options.align || 'center'};
      justify-content: ${options.justify || 'center'};
      gap: ${options.gap || 10}px;
      padding: ${options.padding || 20}px;
      background: ${options.background || 'transparent'};
      border: ${options.border || 'none'};
      border-radius: ${options.borderRadius || '0'};
    `

    this.applyAnchor(el, (options.anchor as AnchorPosition) || 'center')
    this.applyOffset(el, options.x as number || 0, options.y as number || 0)

    this.uiContainer.appendChild(el)
    this.elements.set(id, { id, element: el, type: 'panel', parent: null })
    return id
  }

  private createScreen(
    name: string,
    options: ForgeMap = {}
  ): string {
    const id = `ui_screen_${this.nextId++}`

    const el = document.createElement('div')
    el.id = id
    el.dataset.screenName = name
    el.style.cssText = `
      position: fixed;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${options.gap || 20}px;
      background: ${options.background || 'rgba(0, 0, 0, 0.9)'};
      z-index: ${this.zIndexBase + 100};
      pointer-events: auto;
    `

    this.uiContainer.appendChild(el)
    this.elements.set(id, { id, element: el, type: 'screen', parent: null })
    return id
  }

  // ==========================================================================
  // Hierarchy
  // ==========================================================================

  private addToParent(parentId: string, childId: string): boolean {
    const parent = this.elements.get(parentId)
    const child = this.elements.get(childId)

    if (!parent || !child) return false
    if (parent.type !== 'screen' && parent.type !== 'panel') return false

    // Remove from previous parent if any
    if (child.element.parentElement) {
      child.element.parentElement.removeChild(child.element)
    }

    // For elements added to screens/panels, use relative positioning
    child.element.style.position = 'relative'
    child.element.style.top = ''
    child.element.style.left = ''
    child.element.style.right = ''
    child.element.style.bottom = ''
    child.element.style.transform = ''
    child.element.style.marginLeft = ''
    child.element.style.marginTop = ''

    parent.element.appendChild(child.element)
    child.parent = parentId

    return true
  }

  private removeElement(id: string): boolean {
    const handle = this.elements.get(id)
    if (!handle) return false

    if (handle.element.parentElement) {
      handle.element.parentElement.removeChild(handle.element)
    }

    this.elements.delete(id)
    return true
  }

  // ==========================================================================
  // Visibility
  // ==========================================================================

  private showElement(id: string): boolean {
    const handle = this.elements.get(id)
    if (!handle) return false

    if (handle.type === 'screen') {
      handle.element.style.display = 'flex'
    } else {
      handle.element.style.display = ''
    }
    return true
  }

  private hideElement(id: string): boolean {
    const handle = this.elements.get(id)
    if (!handle) return false

    handle.element.style.display = 'none'
    return true
  }

  private isVisible(id: string): boolean {
    const handle = this.elements.get(id)
    if (!handle) return false

    return handle.element.style.display !== 'none'
  }

  private toggleVisibility(id: string): boolean {
    const handle = this.elements.get(id)
    if (!handle) return false

    if (this.isVisible(id)) {
      return this.hideElement(id)
    } else {
      return this.showElement(id)
    }
  }

  // ==========================================================================
  // Content Updates
  // ==========================================================================

  private setText(id: string, text: string): boolean {
    const handle = this.elements.get(id)
    if (!handle) return false

    handle.element.textContent = text
    return true
  }

  private setStyle(id: string, property: string, value: string): boolean {
    const handle = this.elements.get(id)
    if (!handle) return false

    ;(handle.element.style as any)[property] = value
    return true
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  private exists(id: string): boolean {
    return this.elements.has(id)
  }

  // ==========================================================================
  // Anchor Positioning
  // ==========================================================================

  private applyAnchor(el: HTMLElement, anchor: AnchorPosition): void {
    // Reset positioning
    el.style.top = ''
    el.style.left = ''
    el.style.right = ''
    el.style.bottom = ''
    el.style.transform = ''

    switch (anchor) {
      case 'top-left':
        el.style.top = '0'
        el.style.left = '0'
        break
      case 'top-center':
        el.style.top = '0'
        el.style.left = '50%'
        el.style.transform = 'translateX(-50%)'
        break
      case 'top-right':
        el.style.top = '0'
        el.style.right = '0'
        break
      case 'center-left':
        el.style.top = '50%'
        el.style.left = '0'
        el.style.transform = 'translateY(-50%)'
        break
      case 'center':
        el.style.top = '50%'
        el.style.left = '50%'
        el.style.transform = 'translate(-50%, -50%)'
        break
      case 'center-right':
        el.style.top = '50%'
        el.style.right = '0'
        el.style.transform = 'translateY(-50%)'
        break
      case 'bottom-left':
        el.style.bottom = '0'
        el.style.left = '0'
        break
      case 'bottom-center':
        el.style.bottom = '0'
        el.style.left = '50%'
        el.style.transform = 'translateX(-50%)'
        break
      case 'bottom-right':
        el.style.bottom = '0'
        el.style.right = '0'
        break
    }
  }

  private applyOffset(el: HTMLElement, x: number, y: number): void {
    if (x !== 0) {
      el.style.marginLeft = `${x}px`
    }
    if (y !== 0) {
      el.style.marginTop = `${y}px`
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of all UI elements.
   */
  dispose(): void {
    for (const handle of this.elements.values()) {
      if (handle.element.parentElement) {
        handle.element.parentElement.removeChild(handle.element)
      }
    }
    this.elements.clear()

    if (this.uiContainer.parentElement) {
      this.uiContainer.parentElement.removeChild(this.uiContainer)
    }

    this.runtime = null
  }
}

/**
 * Create UI namespace bindings for Forge 2.0 runtime.
 */
export function createUIBindings(container: HTMLElement): { ui: ForgeMap; bridge: UIBridge } {
  const bridge = new UIBridge({ container })
  return {
    ui: bridge.createNamespace(),
    bridge,
  }
}
