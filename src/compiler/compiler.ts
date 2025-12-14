// StarLang Compiler - Transforms AST into runtime definitions

import { Parser } from './parser'
import type { ASTNode, ASTValue, ParseResult } from './parser'
import type {
  NodeDefinition,
  RoomDefinition,
  DoorDefinition,
  TerminalDefinition,
  SwitchDefinition,
  WallLightDefinition,
  Position3D,
  ShipStructure
} from '../types/nodes'
import type {
  ShipLayout,
  VoxelLayoutV2,
  RoomVolume,
  EntityPlacement,
  DoorPlacement
} from '../types/layout'
import { VOXEL_SIZE } from '../voxel/VoxelTypes'

export interface CompileResult {
  success: boolean
  structure: ShipStructure | null
  errors: CompileError[]
}

export interface CompileError {
  message: string
  line: number
  nodeId?: string
}

export class Compiler {
  private errors: CompileError[] = []
  private layout: ShipLayout | null = null
  private voxelLayout: VoxelLayoutV2 | null = null

  // Set layout data to merge with StarLang definitions (V1 format)
  setLayout(layout: ShipLayout) {
    this.layout = layout
  }

  // Set voxel layout data (V2 format)
  setVoxelLayout(layout: VoxelLayoutV2) {
    this.voxelLayout = layout
    // Also convert to V1 format for backward compatibility
    this.layout = this.convertVoxelLayoutToV1(layout)
  }

  // Convert VoxelLayoutV2 to V1 ShipLayout for compatibility
  private convertVoxelLayoutToV1(voxelLayout: VoxelLayoutV2): ShipLayout {
    const v1Layout: ShipLayout = {
      rooms: {},
      doors: {},
      terminals: {},
      sensors: {},
      switches: {},
      wallLights: {}
    }

    // Convert room volumes to V1 room layouts
    for (const [id, room] of Object.entries(voxelLayout.rooms)) {
      v1Layout.rooms[id] = {
        position: this.voxelToWorldPosition(room.minVoxel),
        size: {
          width: (room.maxVoxel.x - room.minVoxel.x + 1) * VOXEL_SIZE,
          height: (room.maxVoxel.y - room.minVoxel.y + 1) * VOXEL_SIZE,
          depth: (room.maxVoxel.z - room.minVoxel.z + 1) * VOXEL_SIZE
        }
      }
    }

    // Convert entity placements
    for (const [id, entity] of Object.entries(voxelLayout.entities)) {
      const worldPos = this.voxelToWorldPosition(entity.voxelPos)

      switch (entity.type) {
        case 'door':
          const door = entity as DoorPlacement
          v1Layout.doors[id] = {
            position: worldPos,
            rotation: entity.rotation
          }
          break
        case 'terminal':
          v1Layout.terminals[id] = {
            position: worldPos,
            rotation: entity.rotation
          }
          break
        case 'switch':
          if (!v1Layout.switches) v1Layout.switches = {}
          v1Layout.switches[id] = {
            position: worldPos,
            rotation: entity.rotation,
            status: (entity.status as 'OK' | 'FAULT') ?? 'OK'
          }
          break
        case 'light':
          if (!v1Layout.wallLights) v1Layout.wallLights = {}
          v1Layout.wallLights[id] = {
            position: worldPos,
            rotation: entity.rotation,
            color: '#ffffee',
            intensity: 1
          }
          break
      }
    }

    return v1Layout
  }

  // Convert voxel coordinates to world position
  private voxelToWorldPosition(voxel: { x: number; y: number; z: number }): Position3D {
    return {
      x: voxel.x * VOXEL_SIZE,
      y: voxel.y * VOXEL_SIZE,
      z: voxel.z * VOXEL_SIZE
    }
  }

  // Get room definitions from voxel layout
  getRoomVolumes(): Record<string, RoomVolume> {
    return this.voxelLayout?.rooms ?? {}
  }

  // Get entity placements from voxel layout
  getEntityPlacements(): Record<string, EntityPlacement | DoorPlacement> {
    return this.voxelLayout?.entities ?? {}
  }

  compile(source: string): CompileResult {
    const parser = new Parser()
    const parseResult = parser.parse(source)

    if (!parseResult.success) {
      return {
        success: false,
        structure: null,
        errors: parseResult.errors.map(e => ({
          message: e.message,
          line: e.line
        }))
      }
    }

    this.errors = []
    const structure = this.buildStructure(parseResult.nodes)

    return {
      success: this.errors.length === 0,
      structure: this.errors.length === 0 ? structure : null,
      errors: this.errors
    }
  }

  private buildStructure(nodes: ASTNode[]): ShipStructure {
    const structure: ShipStructure = {
      rooms: new Map(),
      doors: new Map(),
      terminals: new Map(),
      sensors: new Map(),
      switches: new Map(),
      wallLights: new Map()
    }

    for (const node of nodes) {
      try {
        switch (node.type) {
          case 'ROOM':
            const room = this.compileRoom(node)
            structure.rooms.set(room.id, room)
            break
          case 'DOOR':
            const door = this.compileDoor(node)
            structure.doors.set(door.id, door)
            break
          case 'TERMINAL':
            const terminal = this.compileTerminal(node)
            structure.terminals.set(terminal.id, terminal)
            break
          case 'SWITCH':
            const sw = this.compileSwitch(node)
            structure.switches.set(sw.id, sw)
            break
        }
      } catch (error) {
        if (error instanceof Error) {
          this.errors.push({
            message: error.message,
            line: node.line,
            nodeId: node.name
          })
        }
      }
    }

    // Wall lights come directly from layout (no StarLang definition needed)
    if (this.layout?.wallLights) {
      for (const [id, lightData] of Object.entries(this.layout.wallLights)) {
        const wallLight: WallLightDefinition = {
          id,
          type: 'WALL_LIGHT',
          properties: {
            position: lightData.position,
            rotation: lightData.rotation,
            color: lightData.color || '#ffffee',
            intensity: lightData.intensity ?? 1.0
          }
        }
        structure.wallLights.set(id, wallLight)
      }
    }

    return structure
  }

  private compileRoom(node: ASTNode): RoomDefinition {
    const props = node.properties
    const layoutData = this.layout?.rooms[node.name]

    return {
      id: node.name,
      type: 'ROOM',
      properties: {
        display_name: this.getString(props['display_name']) ?? node.name,
        deck: this.getNumber(props['deck']) ?? 1,
        section: this.getNumber(props['section']) ?? 1,
        // Use layout data if available, else StarLang props, else defaults
        position: layoutData?.position ?? this.getPosition(props['position']) ?? { x: 0, y: 0, z: 0 },
        size: layoutData?.size ?? this.getSize(props['size']) ?? { width: 6, height: 3, depth: 6 },
        adjacent: this.getStringArray(props['adjacent']) ?? []
      }
    }
  }

  private compileDoor(node: ASTNode): DoorDefinition {
    const props = node.properties
    const layoutData = this.layout?.doors[node.name]

    const connects = this.getStringArray(props['connects'])
    if (!connects || connects.length !== 2) {
      throw new Error(`Door ${node.name} must have exactly 2 rooms in 'connects'`)
    }

    return {
      id: node.name,
      type: 'DOOR',
      properties: {
        display_name: this.getString(props['display_name']) ?? node.name,
        connects: connects as [string, string],
        // Use layout data if available, else StarLang props, else defaults
        position: layoutData?.position ?? this.getPosition(props['position']) ?? { x: 0, y: 0, z: 0 },
        rotation: layoutData?.rotation ?? this.getNumber(props['rotation']) ?? 0,
        control: this.getString(props['control']) ?? '',  // ID of switch that controls this door
        access: this.getString(props['access']) as any
      }
    }
  }

  private compileSwitch(node: ASTNode): SwitchDefinition {
    const props = node.properties
    const layoutData = this.layout?.switches?.[node.name]

    return {
      id: node.name,
      type: 'SWITCH',
      properties: {
        display_name: this.getString(props['display_name']) ?? node.name,
        location: this.getString(props['location']) ?? '',
        // Use layout data for physical properties
        position: layoutData?.position ?? this.getPosition(props['position']) ?? { x: 0, y: 0, z: 0 },
        rotation: layoutData?.rotation ?? this.getNumber(props['rotation']) ?? 0,
        status: layoutData?.status ?? 'OK'  // Status comes from layout (physical state)
      }
    }
  }

  private compileTerminal(node: ASTNode): TerminalDefinition {
    const props = node.properties
    const layoutData = this.layout?.terminals[node.name]

    return {
      id: node.name,
      type: 'TERMINAL',
      properties: {
        display_name: this.getString(props['display_name']) ?? node.name,
        terminal_type: (this.getString(props['terminal_type']) ?? 'STATUS') as any,
        location: this.getString(props['location']) ?? '',
        // Use layout data if available, else StarLang props, else defaults
        position: layoutData?.position ?? this.getPosition(props['position']) ?? { x: 0, y: 0, z: 0 },
        rotation: layoutData?.rotation ?? this.getNumber(props['rotation']) ?? 0,
        mounted_files: this.getStringArray(props['mounted_files']),
        access: this.getString(props['access']) as any
      }
    }
  }

  // Value extraction helpers
  private getString(value: ASTValue | undefined): string | undefined {
    if (!value) return undefined
    if (value.type === 'string') return value.value
    if (value.type === 'identifier') return value.value
    return undefined
  }

  private getNumber(value: ASTValue | undefined): number | undefined {
    if (!value) return undefined
    if (value.type === 'number') return value.value
    return undefined
  }

  private getBoolean(value: ASTValue | undefined): boolean | undefined {
    if (!value) return undefined
    if (value.type === 'boolean') return value.value
    return undefined
  }

  private getStringArray(value: ASTValue | undefined): string[] | undefined {
    if (!value) return undefined
    if (value.type !== 'array') return undefined
    return value.value
      .filter(v => v.type === 'string' || v.type === 'identifier')
      .map(v => v.value as string)
  }

  private getPosition(value: ASTValue | undefined): Position3D | undefined {
    if (!value) return undefined
    if (value.type !== 'object') return undefined
    const obj = value.value
    return {
      x: this.getNumber(obj['x']) ?? 0,
      y: this.getNumber(obj['y']) ?? 0,
      z: this.getNumber(obj['z']) ?? 0
    }
  }

  private getSize(value: ASTValue | undefined): { width: number; height: number; depth: number } | undefined {
    if (!value) return undefined
    if (value.type !== 'object') return undefined
    const obj = value.value
    return {
      width: this.getNumber(obj['width']) ?? 6,
      height: this.getNumber(obj['height']) ?? 3,
      depth: this.getNumber(obj['depth']) ?? 6
    }
  }
}
