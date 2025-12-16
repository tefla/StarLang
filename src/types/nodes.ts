// StarLang Node Types
// All types are dynamic strings - validated against config at runtime

/** Node type identifier - validated against node-types config */
export type NodeType = string

/** Crew role identifier - validated against roles config */
export type Role = string

/** Door state - validated against node-types.DOOR.states config */
export type DoorState = string

/** Terminal type - validated against node-types.TERMINAL.terminal_types config */
export type TerminalType = string

/** Switch hardware status - validated against node-types.SWITCH.statuses config */
export type SwitchStatus = string

export interface Position3D {
  x: number
  y: number
  z: number
}

export interface NodeDefinition {
  id: string
  type: NodeType
  properties: Record<string, any>
}

export interface RoomDefinition extends NodeDefinition {
  type: 'ROOM'
  properties: {
    display_name: string
    deck: number
    section: number
    position: Position3D
    size: { width: number; height: number; depth: number }
    adjacent: string[]
  }
}

export interface DoorDefinition extends NodeDefinition {
  type: 'DOOR'
  properties: {
    display_name: string
    connects: [string, string]
    position: Position3D
    rotation: number
    control: string  // ID of switch that controls this door
    access?: Role
  }
}

export interface SwitchDefinition extends NodeDefinition {
  type: 'SWITCH'
  properties: {
    display_name: string
    location: string
    position: Position3D
    rotation: number
    status: SwitchStatus  // From layout - OK = works, FAULT = broken
  }
}

export interface TerminalDefinition extends NodeDefinition {
  type: 'TERMINAL'
  properties: {
    display_name: string
    terminal_type: TerminalType
    location: string
    position: Position3D
    rotation: number
    mounted_files?: string[]
    access?: Role
  }
}

export interface SensorDefinition extends NodeDefinition {
  type: 'SENSOR'
  properties: {
    display_name: string
    sensor_type: 'O2' | 'TEMP' | 'PRESSURE'
    location: string
    position: Position3D
  }
}

export interface WallLightDefinition extends NodeDefinition {
  type: 'WALL_LIGHT'
  properties: {
    position: Position3D
    rotation: number
    color: string
    intensity: number
  }
}

// Runtime state types
export interface NodeState {
  id: string
  values: Record<string, any>
  lastModified: number
  modifiedBy: string
}

export interface RoomState extends NodeState {
  values: {
    o2_level: number
    temperature: number
    pressure: number
    powered: boolean
  }
}

export interface DoorNodeState extends NodeState {
  values: {
    state: DoorState
    locked_by?: string
  }
}

// Ship structure compiled from StarLang
export interface ShipStructure {
  rooms: Map<string, RoomDefinition>
  doors: Map<string, DoorDefinition>
  terminals: Map<string, TerminalDefinition>
  sensors: Map<string, SensorDefinition>
  switches: Map<string, SwitchDefinition>
  wallLights: Map<string, WallLightDefinition>
}
