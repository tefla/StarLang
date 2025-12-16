/**
 * InputEventSystem - Routes keyboard input to ForgeVM state
 *
 * Instead of (or in addition to) routing input to PlayerSystem,
 * this system updates ForgeVM state so game rules can respond to input.
 *
 * Key state is stored at $input.{KeyCode} (e.g., $input.KeyW, $input.ArrowUp)
 */

import type { ForgeVM } from '../forge/vm'

// ============================================================================
// Types
// ============================================================================

export interface InputConfig {
  // Which keys to track (if not specified, track common game keys)
  trackedKeys?: string[]
}

// ============================================================================
// Default tracked keys
// ============================================================================

const DEFAULT_TRACKED_KEYS = [
  // WASD
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  // Arrow keys
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  // Common game keys
  'Space', 'Enter', 'Escape',
  'KeyE', 'KeyQ', 'KeyR', 'KeyF',
  // Shift/Ctrl
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
]

// ============================================================================
// InputEventSystem Class
// ============================================================================

export class InputEventSystem {
  private vm: ForgeVM
  private trackedKeys: Set<string>
  private keyState: Map<string, boolean> = new Map()
  private enabled: boolean = true

  // Event handler references for cleanup
  private keydownHandler: (e: KeyboardEvent) => void
  private keyupHandler: (e: KeyboardEvent) => void

  constructor(vm: ForgeVM, config: InputConfig = {}) {
    this.vm = vm
    this.trackedKeys = new Set(config.trackedKeys ?? DEFAULT_TRACKED_KEYS)

    // Bind handlers
    this.keydownHandler = this.handleKeyDown.bind(this)
    this.keyupHandler = this.handleKeyUp.bind(this)

    // Setup event listeners
    this.setupEventListeners()

    // Initialize all tracked keys to false
    for (const key of this.trackedKeys) {
      this.setKeyState(key, false)
    }
  }

  private setupEventListeners(): void {
    if (typeof document === 'undefined') return

    document.addEventListener('keydown', this.keydownHandler)
    document.addEventListener('keyup', this.keyupHandler)
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return

    const key = e.code

    // Only track if in tracked keys list
    if (!this.trackedKeys.has(key)) return

    // Only update if state changed (avoid repeated events from key repeat)
    if (this.keyState.get(key) === true) return

    this.setKeyState(key, true)

    // Emit keydown event
    this.vm.emit('input:keydown', { key })
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (!this.enabled) return

    const key = e.code

    // Only track if in tracked keys list
    if (!this.trackedKeys.has(key)) return

    this.setKeyState(key, false)

    // Emit keyup event
    this.vm.emit('input:keyup', { key })
  }

  private setKeyState(key: string, pressed: boolean): void {
    this.keyState.set(key, pressed)

    // Update VM state at input_{KeyCode} (using underscore convention)
    this.vm.setStateValue(`input_${key}`, pressed)
  }

  /**
   * Check if a key is currently pressed.
   */
  isKeyPressed(key: string): boolean {
    return this.keyState.get(key) ?? false
  }

  /**
   * Get all currently pressed keys.
   */
  getPressedKeys(): string[] {
    return Array.from(this.keyState.entries())
      .filter(([_, pressed]) => pressed)
      .map(([key]) => key)
  }

  /**
   * Enable or disable input processing.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled

    // If disabling, release all keys
    if (!enabled) {
      for (const key of this.keyState.keys()) {
        if (this.keyState.get(key)) {
          this.setKeyState(key, false)
        }
      }
    }
  }

  /**
   * Check if input is enabled.
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Add a key to track.
   */
  trackKey(key: string): void {
    this.trackedKeys.add(key)
    if (!this.keyState.has(key)) {
      this.setKeyState(key, false)
    }
  }

  /**
   * Remove a key from tracking.
   */
  untrackKey(key: string): void {
    this.trackedKeys.delete(key)
    this.keyState.delete(key)
  }

  /**
   * Clean up event listeners.
   */
  dispose(): void {
    if (typeof document === 'undefined') return

    document.removeEventListener('keydown', this.keydownHandler)
    document.removeEventListener('keyup', this.keyupHandler)
  }
}
