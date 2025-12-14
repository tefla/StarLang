// Layout types - Physical 3D positioning separate from logical StarLang
// Players see/edit StarLang only; layout data is hidden

import type { Position3D } from './nodes'

export interface RoomLayout {
  position: Position3D
  size: { width: number; height: number; depth: number }
}

export interface DoorLayout {
  position: Position3D
  rotation: number
}

export interface TerminalLayout {
  position: Position3D
  rotation: number
}

export interface SensorLayout {
  position: Position3D
}

export interface SwitchLayout {
  position: Position3D
  rotation: number
  status: 'OK' | 'FAULT'  // Physical state - broken switches don't respond
}

export interface WallLightLayout {
  position: Position3D
  rotation: number
  color: string      // Hex color like '#ffffee'
  intensity: number  // 0-5, default 1
}

export interface ShipLayout {
  rooms: Record<string, RoomLayout>
  doors: Record<string, DoorLayout>
  terminals: Record<string, TerminalLayout>
  sensors?: Record<string, SensorLayout>
  switches?: Record<string, SwitchLayout>
  wallLights?: Record<string, WallLightLayout>
}
