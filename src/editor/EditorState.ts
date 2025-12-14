/**
 * Editor state machine and action management.
 *
 * Manages editor modes, tool selection, undo/redo history,
 * and current selection state.
 */

import type { VoxelCoord, Voxel, VoxelType } from '../voxel/VoxelTypes'

/**
 * Editor operating modes.
 */
export enum EditorMode {
  /** Normal gameplay - editor disabled */
  DISABLED = 'DISABLED',
  /** Voxel placement/removal mode */
  VOXEL = 'VOXEL',
  /** Selection mode */
  SELECT = 'SELECT',
  /** Room volume definition mode */
  ROOM = 'ROOM',
  /** Entity placement mode (doors, terminals, etc.) */
  ENTITY = 'ENTITY',
  /** Prefab placement mode */
  PREFAB = 'PREFAB'
}

/**
 * Voxel brush modes.
 */
export enum BrushMode {
  /** Single voxel at a time */
  SINGLE = 'SINGLE',
  /** Draw a line */
  LINE = 'LINE',
  /** Fill a box */
  BOX = 'BOX',
  /** Flood fill */
  FILL = 'FILL'
}

/**
 * A recorded editor action for undo/redo.
 */
export type EditorAction =
  | { type: 'SET_VOXELS', voxels: Array<{ coord: VoxelCoord, before: Voxel, after: Voxel }> }
  | { type: 'PLACE_ENTITY', entityId: string, entityType: string, position: VoxelCoord }
  | { type: 'DELETE_ENTITY', entityId: string, entityType: string, position: VoxelCoord }
  | { type: 'DEFINE_ROOM', roomId: string, volume: RoomVolume }
  | { type: 'DELETE_ROOM', roomId: string, volume: RoomVolume }
  | { type: 'PLACE_PREFAB', instanceId: string, prefabId: string, position: VoxelCoord, rotation: number }
  | { type: 'DELETE_PREFAB', instanceId: string, prefabId: string, position: VoxelCoord, rotation: number }

/**
 * Room volume definition.
 */
export interface RoomVolume {
  minVoxel: VoxelCoord
  maxVoxel: VoxelCoord
  regions?: VoxelRegion[]
}

/**
 * A region within a room (for non-rectangular rooms).
 */
export interface VoxelRegion {
  minVoxel: VoxelCoord
  maxVoxel: VoxelCoord
}

/**
 * Current selection state.
 */
export interface Selection {
  /** Selected voxel coordinates */
  voxels: VoxelCoord[]
  /** Selected entity IDs */
  entities: string[]
  /** Selection start point (for box selection) */
  start: VoxelCoord | null
  /** Selection end point (for box selection) */
  end: VoxelCoord | null
}

/**
 * Ghost preview state (for showing where voxels/prefabs will be placed).
 */
export interface GhostPreview {
  /** Whether ghost is visible */
  visible: boolean
  /** Ghost position */
  position: VoxelCoord | null
  /** Prefab being previewed (if any) */
  prefabId: string | null
  /** Rotation for prefab */
  rotation: number
  /** Whether placement is valid at current position */
  valid: boolean
}

/**
 * Full editor state.
 */
export interface EditorState {
  /** Current editor mode */
  mode: EditorMode
  /** Current brush mode */
  brushMode: BrushMode
  /** Brush size (radius in voxels) */
  brushSize: number
  /** Selected voxel type to place */
  selectedVoxelType: VoxelType
  /** Selected voxel variant */
  selectedVariant: number
  /** Selected prefab ID */
  selectedPrefab: string | null
  /** Selected entity type for placement */
  selectedEntityType: string | null
  /** Current selection */
  selection: Selection
  /** Ghost preview */
  ghost: GhostPreview
  /** Undo stack */
  undoStack: EditorAction[]
  /** Redo stack */
  redoStack: EditorAction[]
  /** Maximum undo history size */
  maxUndoSize: number
  /** Is editor UI visible */
  uiVisible: boolean
  /** Grid snap enabled */
  gridSnap: boolean
}

/**
 * Create initial editor state.
 */
export function createEditorState(): EditorState {
  return {
    mode: EditorMode.DISABLED,
    brushMode: BrushMode.SINGLE,
    brushSize: 1,
    selectedVoxelType: 2, // WALL
    selectedVariant: 0,
    selectedPrefab: null,
    selectedEntityType: null,
    selection: {
      voxels: [],
      entities: [],
      start: null,
      end: null
    },
    ghost: {
      visible: false,
      position: null,
      prefabId: null,
      rotation: 0,
      valid: false
    },
    undoStack: [],
    redoStack: [],
    maxUndoSize: 100,
    uiVisible: true,
    gridSnap: true
  }
}

/**
 * Editor state reducer actions.
 */
export type EditorStateAction =
  | { type: 'SET_MODE', mode: EditorMode }
  | { type: 'SET_BRUSH_MODE', brushMode: BrushMode }
  | { type: 'SET_BRUSH_SIZE', size: number }
  | { type: 'SET_VOXEL_TYPE', voxelType: VoxelType }
  | { type: 'SET_VARIANT', variant: number }
  | { type: 'SET_PREFAB', prefabId: string | null }
  | { type: 'SET_ENTITY_TYPE', entityType: string | null }
  | { type: 'SET_SELECTION', selection: Partial<Selection> }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_GHOST', ghost: Partial<GhostPreview> }
  | { type: 'PUSH_ACTION', action: EditorAction }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'TOGGLE_UI' }
  | { type: 'TOGGLE_GRID_SNAP' }

/**
 * Reduce editor state.
 */
export function reduceEditorState(
  state: EditorState,
  action: EditorStateAction
): EditorState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode }

    case 'SET_BRUSH_MODE':
      return { ...state, brushMode: action.brushMode }

    case 'SET_BRUSH_SIZE':
      return { ...state, brushSize: Math.max(1, action.size) }

    case 'SET_VOXEL_TYPE':
      return { ...state, selectedVoxelType: action.voxelType }

    case 'SET_VARIANT':
      return { ...state, selectedVariant: action.variant }

    case 'SET_PREFAB':
      return { ...state, selectedPrefab: action.prefabId }

    case 'SET_ENTITY_TYPE':
      return { ...state, selectedEntityType: action.entityType }

    case 'SET_SELECTION':
      return {
        ...state,
        selection: { ...state.selection, ...action.selection }
      }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selection: { voxels: [], entities: [], start: null, end: null }
      }

    case 'SET_GHOST':
      return {
        ...state,
        ghost: { ...state.ghost, ...action.ghost }
      }

    case 'PUSH_ACTION': {
      const undoStack = [...state.undoStack, action.action]
      // Trim undo stack if too large
      if (undoStack.length > state.maxUndoSize) {
        undoStack.shift()
      }
      return {
        ...state,
        undoStack,
        redoStack: [] // Clear redo on new action
      }
    }

    case 'UNDO': {
      const lastAction = state.undoStack[state.undoStack.length - 1]
      if (!lastAction) return state
      return {
        ...state,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, lastAction]
      }
    }

    case 'REDO': {
      const lastAction = state.redoStack[state.redoStack.length - 1]
      if (!lastAction) return state
      return {
        ...state,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, lastAction]
      }
    }

    case 'TOGGLE_UI':
      return { ...state, uiVisible: !state.uiVisible }

    case 'TOGGLE_GRID_SNAP':
      return { ...state, gridSnap: !state.gridSnap }

    default:
      return state
  }
}

/**
 * Editor state store with subscriptions.
 */
export class EditorStore {
  private state: EditorState
  private listeners: Array<(state: EditorState) => void> = []

  constructor(initialState?: Partial<EditorState>) {
    this.state = { ...createEditorState(), ...initialState }
  }

  getState(): EditorState {
    return this.state
  }

  dispatch(action: EditorStateAction): void {
    this.state = reduceEditorState(this.state, action)
    this.notify()
  }

  subscribe(listener: (state: EditorState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}
