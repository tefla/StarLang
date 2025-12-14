// AmbientSoundManager - Manages reactive environmental sounds
// Subscribes to runtime state and triggers spatial ambient audio

import * as THREE from 'three'
import type { Runtime } from '../../runtime/Runtime'
import type {
  ShipStructure,
  PipeDefinition,
  VentDefinition,
  ConduitDefinition,
  HullSectionDefinition
} from '../../types/nodes'
import { AudioSystem } from './AudioSystem'

interface AmbientSource {
  id: string
  type: 'PIPE' | 'VENT' | 'CONDUIT' | 'HULL_SECTION'
  position: THREE.Vector3
  lastSoundTime: number
  // State tracking for reactive sounds
  activity: number  // 0-1, how active this source is
}

interface AmbientConfig {
  // How often to potentially trigger ambient sounds (ms)
  tickInterval: number
  // Base probability of a sound per tick (0-1)
  baseProbability: number
  // Multiplier when systems are active
  activityMultiplier: number
}

const DEFAULT_CONFIG: AmbientConfig = {
  tickInterval: 500,
  baseProbability: 0.02,
  activityMultiplier: 3.0
}

export class AmbientSoundManager {
  private runtime: Runtime
  private audioSystem: AudioSystem
  private structure: ShipStructure | null = null
  private sources: Map<string, AmbientSource> = new Map()
  private config: AmbientConfig

  private tickHandle: number | null = null
  private unsubscribers: (() => void)[] = []

  // Track global ship state for reactive sounds
  private shipState = {
    powerFluctuation: false,
    pressureDelta: 0,
    atmoActive: true,
    doorsMoving: new Set<string>()
  }

  constructor(runtime: Runtime, audioSystem: AudioSystem, config: Partial<AmbientConfig> = {}) {
    this.runtime = runtime
    this.audioSystem = audioSystem
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // Initialize with ship structure
  init(structure: ShipStructure) {
    this.structure = structure
    this.buildSources()
    this.subscribeToEvents()
    this.startAmbientLoop()
  }

  // Build ambient sources from ship structure
  private buildSources() {
    if (!this.structure) return

    // Add pipes
    for (const [id, pipe] of this.structure.pipes) {
      this.sources.set(id, {
        id,
        type: 'PIPE',
        position: new THREE.Vector3(
          pipe.properties.position.x,
          pipe.properties.position.y,
          pipe.properties.position.z
        ),
        lastSoundTime: 0,
        activity: 0.5
      })
    }

    // Add vents
    for (const [id, vent] of this.structure.vents) {
      this.sources.set(id, {
        id,
        type: 'VENT',
        position: new THREE.Vector3(
          vent.properties.position.x,
          vent.properties.position.y,
          vent.properties.position.z
        ),
        lastSoundTime: 0,
        activity: 0.5
      })
    }

    // Add conduits
    for (const [id, conduit] of this.structure.conduits) {
      this.sources.set(id, {
        id,
        type: 'CONDUIT',
        position: new THREE.Vector3(
          conduit.properties.position.x,
          conduit.properties.position.y,
          conduit.properties.position.z
        ),
        lastSoundTime: 0,
        activity: 0.3
      })
    }

    // Add hull sections
    for (const [id, hull] of this.structure.hullSections) {
      this.sources.set(id, {
        id,
        type: 'HULL_SECTION',
        position: new THREE.Vector3(
          hull.properties.position.x,
          hull.properties.position.y,
          hull.properties.position.z
        ),
        lastSoundTime: 0,
        activity: 0.2
      })
    }
  }

  // Subscribe to runtime events that affect ambient sounds
  private subscribeToEvents() {
    // Door events increase pipe/vent activity (pressure changes)
    this.runtime.on('door:open', (event) => {
      this.shipState.doorsMoving.add(event.doorId)
      this.boostNearbyActivity(event.doorId, ['PIPE', 'VENT'], 1.0)

      // Clear after animation
      setTimeout(() => {
        this.shipState.doorsMoving.delete(event.doorId)
      }, 1000)
    })

    this.runtime.on('door:close', (event) => {
      this.shipState.doorsMoving.add(event.doorId)
      this.boostNearbyActivity(event.doorId, ['PIPE', 'VENT'], 0.8)

      setTimeout(() => {
        this.shipState.doorsMoving.delete(event.doorId)
      }, 1000)
    })

    // Atmosphere warnings increase vent activity
    this.runtime.on('atmosphere:warning', () => {
      for (const source of this.sources.values()) {
        if (source.type === 'VENT') {
          source.activity = Math.min(1.0, source.activity + 0.3)
        }
      }
    })

    // Subscribe to power state changes
    const powerUnsub = this.runtime.subscribe('*.powered', (path, value, oldValue) => {
      if (value !== oldValue) {
        this.shipState.powerFluctuation = true
        // Boost conduit activity on power changes
        for (const source of this.sources.values()) {
          if (source.type === 'CONDUIT') {
            source.activity = Math.min(1.0, source.activity + 0.5)
          }
        }
        setTimeout(() => {
          this.shipState.powerFluctuation = false
        }, 2000)
      }
    })
    this.unsubscribers.push(powerUnsub)

    // Subscribe to pressure changes
    const pressureUnsub = this.runtime.subscribe('*.pressure', (path, value, oldValue) => {
      if (typeof value === 'number' && typeof oldValue === 'number') {
        this.shipState.pressureDelta = Math.abs(value - oldValue)
        // Hull sections respond to pressure changes
        for (const source of this.sources.values()) {
          if (source.type === 'HULL_SECTION') {
            source.activity = Math.min(1.0, source.activity + this.shipState.pressureDelta * 2)
          }
        }
      }
    })
    this.unsubscribers.push(pressureUnsub)
  }

  // Boost activity for sources near a door
  private boostNearbyActivity(doorId: string, types: string[], amount: number) {
    const door = this.structure?.doors.get(doorId)
    if (!door) return

    const doorPos = new THREE.Vector3(
      door.properties.position.x,
      door.properties.position.y,
      door.properties.position.z
    )

    for (const source of this.sources.values()) {
      if (types.includes(source.type)) {
        const distance = source.position.distanceTo(doorPos)
        if (distance < 10) {
          const boost = amount * (1 - distance / 10)
          source.activity = Math.min(1.0, source.activity + boost)
        }
      }
    }
  }

  // Main ambient loop - randomly trigger sounds
  private startAmbientLoop() {
    const tick = () => {
      const now = Date.now()

      for (const source of this.sources.values()) {
        // Calculate probability based on activity
        const probability = this.config.baseProbability *
          (1 + source.activity * this.config.activityMultiplier)

        // Minimum time between sounds from same source
        const minInterval = 2000 / (1 + source.activity)
        if (now - source.lastSoundTime < minInterval) continue

        // Random trigger
        if (Math.random() < probability) {
          this.triggerAmbientSound(source)
          source.lastSoundTime = now
        }

        // Decay activity over time
        source.activity = Math.max(0.1, source.activity * 0.98)
      }

      this.tickHandle = window.setTimeout(tick, this.config.tickInterval)
    }

    tick()
  }

  // Trigger appropriate sound for source type
  private triggerAmbientSound(source: AmbientSource) {
    switch (source.type) {
      case 'PIPE':
        this.audioSystem.playPipeSound(source.position, source.activity)
        break
      case 'VENT':
        this.audioSystem.playVentSound(source.position, source.activity)
        break
      case 'CONDUIT':
        this.audioSystem.playConduitSound(source.position, source.activity)
        break
      case 'HULL_SECTION':
        this.audioSystem.playHullSound(source.position, source.activity)
        break
    }
  }

  // Manually trigger a sound at a location (for scripted events)
  triggerAt(type: 'PIPE' | 'VENT' | 'CONDUIT' | 'HULL_SECTION', position: THREE.Vector3, intensity = 0.5) {
    const fakeSource: AmbientSource = {
      id: 'manual',
      type,
      position,
      lastSoundTime: 0,
      activity: intensity
    }
    this.triggerAmbientSound(fakeSource)
  }

  // Clean up
  dispose() {
    if (this.tickHandle !== null) {
      clearTimeout(this.tickHandle)
      this.tickHandle = null
    }

    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
    this.sources.clear()
  }
}
