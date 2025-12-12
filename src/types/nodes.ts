// StarLang Node Types

export type NodeType =
  | 'ROOM'
  | 'DOOR'
  | 'SENSOR'
  | 'TERMINAL'
  | 'ATMO_OUTLET'
  | 'ATMO_INLET'
  | 'SIGNAL'

export type Role =
  | 'CAPTAIN'
  | 'OFFICER'
  | 'ENGINEERING'
  | 'MEDICAL'
  | 'COOK'
  | 'CREW'

export type DoorState = 'OPEN' | 'CLOSED' | 'LOCKED' | 'SEALED'

export type TerminalType = 'STATUS' | 'COMMAND' | 'ENGINEERING'

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
    locked: boolean
    access?: Role
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
}
