// StarLang Runtime - Manages ship state and code execution

import { Compiler } from '../compiler/compiler'
import type { CompileResult } from '../compiler/compiler'
import type {
  ShipStructure,
  NodeState,
  RoomDefinition,
  DoorDefinition,
  TerminalDefinition
} from '../types/nodes'
import type { ShipLayout } from '../types/layout'

export type StateCallback = (path: string, value: any, oldValue: any) => void
export type EventType = 'compile:success' | 'compile:error' | 'state:change' | 'door:open' | 'door:close' | 'atmosphere:warning' | 'atmosphere:critical' | 'game:over'
export type EventHandler = (event: any) => void

// Atmosphere simulation constants
const O2_DEPLETION_RATE = 0.05 // % per second when room is occupied
const O2_WARNING_THRESHOLD = 19
const O2_CRITICAL_THRESHOLD = 16
const O2_GAMEOVER_THRESHOLD = 12

interface FileContent {
  path: string
  content: string
  lastModified: number
}

export class Runtime {
  private compiler = new Compiler()
  private structure: ShipStructure | null = null
  private states = new Map<string, NodeState>()
  private subscribers = new Map<string, Set<StateCallback>>()
  private eventHandlers = new Map<EventType, Set<EventHandler>>()
  private files = new Map<string, FileContent>()
  private layout: ShipLayout | null = null

  // Player location tracking
  private playerRoomId: string | null = null
  private lastWarningLevel: 'none' | 'warning' | 'critical' = 'none'
  private gameOver = false

  // Set layout data (separate from StarLang code)
  setLayout(layout: ShipLayout) {
    this.layout = layout
    this.compiler.setLayout(layout)
  }

  // Track which room the player is in
  setPlayerRoom(roomId: string | null) {
    this.playerRoomId = roomId
  }

  getPlayerRoom(): string | null {
    return this.playerRoomId
  }

  isGameOver(): boolean {
    return this.gameOver
  }

  resetGame() {
    this.gameOver = false
    this.lastWarningLevel = 'none'
  }

  // Initialize runtime with ship definition
  async init(shipSource: string): Promise<CompileResult> {
    const result = this.compiler.compile(shipSource)

    if (result.success && result.structure) {
      this.structure = result.structure
      this.initializeStates()
      this.emit('compile:success', { structure: this.structure })
    } else {
      this.emit('compile:error', { errors: result.errors })
    }

    return result
  }

  // Initialize default states for all nodes
  private initializeStates() {
    if (!this.structure) return

    // Initialize room states
    for (const [id, room] of this.structure.rooms) {
      this.states.set(id, {
        id,
        values: {
          o2_level: 21.0,
          temperature: 22.0,
          pressure: 1.0,
          powered: true
        },
        lastModified: Date.now(),
        modifiedBy: 'SYSTEM'
      })
    }

    // Initialize door states
    for (const [id, door] of this.structure.doors) {
      this.states.set(id, {
        id,
        values: {
          state: door.properties.locked ? 'LOCKED' : 'CLOSED',
          locked_by: door.properties.locked ? 'SYSTEM' : undefined
        },
        lastModified: Date.now(),
        modifiedBy: 'SYSTEM'
      })
    }
  }

  // Hot-reload: recompile and reconcile state
  recompile(source: string): CompileResult {
    const oldStates = new Map(this.states)

    const result = this.compiler.compile(source)

    if (result.success && result.structure) {
      this.structure = result.structure

      // Reconcile: preserve existing state for nodes that still exist
      this.states.clear()
      this.initializeStates()

      // Restore preserved states (but respect definition changes)
      for (const [id, oldState] of oldStates) {
        const newState = this.states.get(id)
        if (newState) {
          // For doors, check if locked property changed - if so, use new state
          const door = this.structure.doors.get(id)
          if (door) {
            // Door's state is determined by the new locked property
            // Don't restore old state - initializeStates already set it correctly
            continue
          }

          // For other nodes, merge old values into new state
          for (const [key, value] of Object.entries(oldState.values)) {
            if (key in newState.values) {
              newState.values[key] = value
            }
          }
        }
      }

      this.emit('compile:success', { structure: this.structure })
    } else {
      this.emit('compile:error', { errors: result.errors })
    }

    return result
  }

  // Get ship structure
  getStructure(): ShipStructure | null {
    return this.structure
  }

  // Get state for a node
  getState(id: string): NodeState | undefined {
    return this.states.get(id)
  }

  // Get a specific property value
  getProperty(path: string): any {
    const [id, ...rest] = path.split('.')
    const state = this.states.get(id!)
    if (!state) return undefined

    let value: any = state.values
    for (const key of rest) {
      if (value === undefined) return undefined
      value = value[key]
    }
    return value
  }

  // Set a property value
  setProperty(path: string, value: any, modifiedBy = 'PLAYER') {
    const [id, ...rest] = path.split('.')
    const state = this.states.get(id!)
    if (!state) return

    const propPath = rest.join('.')
    const oldValue = this.getProperty(path)

    // Update state
    if (rest.length === 1) {
      state.values[rest[0]!] = value
    }

    state.lastModified = Date.now()
    state.modifiedBy = modifiedBy

    // Notify subscribers
    this.notifySubscribers(path, value, oldValue)
    this.emit('state:change', { path, value, oldValue })
  }

  // Subscribe to state changes
  subscribe(path: string, callback: StateCallback): () => void {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set())
    }
    this.subscribers.get(path)!.add(callback)

    return () => {
      this.subscribers.get(path)?.delete(callback)
    }
  }

  private notifySubscribers(path: string, value: any, oldValue: any) {
    // Exact path match
    this.subscribers.get(path)?.forEach(cb => cb(path, value, oldValue))

    // Wildcard subscriptions
    const [id, prop] = path.split('.')
    this.subscribers.get(`${id}.*`)?.forEach(cb => cb(path, value, oldValue))
    this.subscribers.get(`*.${prop}`)?.forEach(cb => cb(path, value, oldValue))
    this.subscribers.get('*')?.forEach(cb => cb(path, value, oldValue))
  }

  // Event system
  on(event: EventType, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  off(event: EventType, handler: EventHandler) {
    this.eventHandlers.get(event)?.delete(handler)
  }

  private emit(event: EventType, data: any) {
    this.eventHandlers.get(event)?.forEach(handler => handler(data))
  }

  // Door interactions
  openDoor(doorId: string): { success: boolean; message: string } {
    const state = this.states.get(doorId)
    const door = this.structure?.doors.get(doorId)

    if (!state || !door) {
      return { success: false, message: 'Door not found' }
    }

    if (state.values['state'] === 'LOCKED') {
      return { success: false, message: 'Door is locked' }
    }

    if (state.values['state'] === 'SEALED') {
      return { success: false, message: 'Door is sealed - emergency lockdown' }
    }

    if (state.values['state'] === 'OPEN') {
      return { success: true, message: 'Door is already open' }
    }

    this.setProperty(`${doorId}.state`, 'OPEN')
    this.emit('door:open', { doorId })
    return { success: true, message: 'Door opened' }
  }

  closeDoor(doorId: string): { success: boolean; message: string } {
    const state = this.states.get(doorId)

    if (!state) {
      return { success: false, message: 'Door not found' }
    }

    if (state.values['state'] === 'CLOSED') {
      return { success: true, message: 'Door is already closed' }
    }

    if (state.values['state'] !== 'OPEN') {
      return { success: false, message: 'Cannot close door in current state' }
    }

    this.setProperty(`${doorId}.state`, 'CLOSED')
    this.emit('door:close', { doorId })
    return { success: true, message: 'Door closed' }
  }

  // File management for terminals
  loadFile(path: string, content: string) {
    this.files.set(path, {
      path,
      content,
      lastModified: Date.now()
    })
  }

  getFile(path: string): FileContent | undefined {
    return this.files.get(path)
  }

  getAllFiles(): FileContent[] {
    return Array.from(this.files.values())
  }

  // Simulation tick (for atmosphere, etc.)
  tick(deltaTime: number) {
    if (this.gameOver) return

    // Simulate O2 depletion in the room the player is in
    if (this.playerRoomId) {
      const state = this.states.get(this.playerRoomId)
      if (state && state.values['powered']) {
        const currentO2 = state.values['o2_level'] as number
        const newO2 = Math.max(0, currentO2 - O2_DEPLETION_RATE * deltaTime)

        if (newO2 !== currentO2) {
          this.setProperty(`${this.playerRoomId}.o2_level`, newO2, 'SYSTEM')

          // Check for warning/critical levels
          if (newO2 <= O2_GAMEOVER_THRESHOLD && !this.gameOver) {
            this.gameOver = true
            this.emit('game:over', { o2Level: newO2, roomId: this.playerRoomId })
          } else if (newO2 <= O2_CRITICAL_THRESHOLD && this.lastWarningLevel !== 'critical') {
            this.lastWarningLevel = 'critical'
            this.emit('atmosphere:critical', { o2Level: newO2, roomId: this.playerRoomId })
          } else if (newO2 <= O2_WARNING_THRESHOLD && this.lastWarningLevel === 'none') {
            this.lastWarningLevel = 'warning'
            this.emit('atmosphere:warning', { o2Level: newO2, roomId: this.playerRoomId })
          }
        }
      }
    }
  }
}

// Singleton instance
export const runtime = new Runtime()
