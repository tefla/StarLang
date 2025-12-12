# UI Binding

## Overview

The UI needs to stay synchronized with ship state. When O2 levels change, the display updates. When a door opens, the map reflects it. This document describes how the UI subscribes to and renders ship state.

---

## The Subscription Model

React components subscribe to specific state paths. When that state changes, the component re-renders.

```typescript
// Hook for subscribing to ship state
function useShipState<T>(path: string): T {
  const runtime = useRuntime()
  const [value, setValue] = useState<T>(() => runtime.getState(path))
  
  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = runtime.subscribe(path, (newValue) => {
      setValue(newValue)
    })
    
    return unsubscribe
  }, [runtime, path])
  
  return value
}

// Usage
function OxygenGauge({ roomId }: { roomId: string }) {
  const o2Level = useShipState<number>(`${roomId}.o2_level`)
  
  return (
    <Gauge 
      value={o2Level} 
      max={100} 
      label="O2"
      warning={o2Level < 19}
      critical={o2Level < 16}
    />
  )
}
```

---

## State Paths

State is accessed via dot-notation paths:

```typescript
// Room state
"galley.o2_level"          // 18.2
"galley.current_temp"      // 22.4
"galley.occupants"         // ["riley_chen"]

// Door state
"door_galley_to_corridor.state"       // "SEALED"
"door_galley_to_corridor.sealed_by"   // "atmo.critical"

// Sensor state
"sensor.o2_galley.current_reading"    // 18.2
"sensor.o2_galley.status"             // "OK"

// Signal state
"signal.atmo.critical.active"         // true
"signal.atmo.critical.triggered_at"   // 1699012938847
```

### Wildcard Subscriptions

For subscribing to multiple related values:

```typescript
// Subscribe to all sensors in galley
const sensors = useShipState<SensorState[]>("galley.sensors.*")

// Subscribe to any door state change
useShipStateEffect("*.doors.*.state", (change) => {
  console.log(`Door ${change.nodeId} changed to ${change.newValue}`)
})
```

---

## Component Patterns

### Display Components

Pure display, subscribed to state:

```typescript
function RoomStatus({ roomId }: { roomId: string }) {
  const temp = useShipState<number>(`${roomId}.current_temp`)
  const o2 = useShipState<number>(`${roomId}.o2_level`)
  const pressure = useShipState<number>(`${roomId}.pressure`)
  
  return (
    <div className="room-status">
      <StatusItem label="Temp" value={`${temp.toFixed(1)}°C`} />
      <StatusItem 
        label="O2" 
        value={`${o2.toFixed(1)}%`}
        status={o2 < 16 ? 'critical' : o2 < 19 ? 'warning' : 'ok'}
      />
      <StatusItem label="Pressure" value={`${pressure.toFixed(2)} atm`} />
    </div>
  )
}
```

### Interactive Components

Components that dispatch actions:

```typescript
function DoorControl({ doorId }: { doorId: string }) {
  const runtime = useRuntime()
  const state = useShipState<string>(`${doorId}.state`)
  const canOpen = useShipState<boolean>(`${doorId}.can_open`)
  
  const handleOpen = async () => {
    const result = await runtime.playerAction({
      type: 'INTERACT',
      target: doorId,
      action: 'OPEN'
    })
    
    if (!result.success) {
      showNotification(result.message)
    }
  }
  
  return (
    <div className="door-control">
      <span className={`door-state door-state--${state.toLowerCase()}`}>
        {state}
      </span>
      <button 
        onClick={handleOpen}
        disabled={!canOpen || state === 'OPEN'}
      >
        Open
      </button>
    </div>
  )
}
```

### Terminal Components

Complex components with their own state:

```typescript
function EngineeringTerminal({ terminalId }: { terminalId: string }) {
  const runtime = useRuntime()
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [modified, setModified] = useState(false)
  const [errors, setErrors] = useState<CompileError[]>([])
  
  // Load file list from terminal's mounted files
  const mountedFiles = useShipState<string[]>(`${terminalId}.mounted_files`)
  
  const handleSave = async () => {
    if (!currentFile) return
    
    const result = await runtime.recompile(currentFile, content)
    
    if (result.success) {
      setModified(false)
      setErrors([])
      showNotification('Saved and compiled')
    } else {
      setErrors(result.errors)
    }
  }
  
  return (
    <div className="engineering-terminal">
      <FileList 
        files={mountedFiles}
        current={currentFile}
        onSelect={setCurrentFile}
      />
      <CodeEditor
        value={content}
        onChange={(v) => { setContent(v); setModified(true) }}
        errors={errors}
      />
      <TerminalFooter
        modified={modified}
        onSave={handleSave}
        onRevert={() => loadFile(currentFile)}
      />
    </div>
  )
}
```

---

## 3D Ship View Rendering

The 3D view renders using Three.js with pixelation post-processing.

```typescript
// renderer/scene.ts
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

class ShipRenderer {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private controls: PointerLockControls
  private runtime: StarLangRuntime

  constructor(canvas: HTMLCanvasElement, runtime: StarLangRuntime) {
    this.runtime = runtime
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })

    // Pixelation post-processing
    this.composer = new EffectComposer(this.renderer)
    const pixelPass = new RenderPixelatedPass(6, this.scene, this.camera)
    pixelPass.normalEdgeStrength = 1
    pixelPass.depthEdgeStrength = 1
    this.composer.addPass(pixelPass)

    // First-person controls
    this.controls = new PointerLockControls(this.camera, canvas)

    this.buildShipFromDefinitions()
    this.subscribeToStateChanges()
  }

  private buildShipFromDefinitions() {
    const rooms = this.runtime.getDefinitionsByType('ROOM')
    for (const room of rooms) {
      const roomMesh = this.createRoomMesh(room)
      this.scene.add(roomMesh)
    }
  }

  private subscribeToStateChanges() {
    // Update room visuals when state changes
    this.runtime.subscribe('*.o2_level', (change) => {
      this.updateRoomLighting(change.nodeId, change.newValue)
    })
  }
}
```

### Room Mesh Creation

```typescript
// renderer/rooms.ts
function createRoomMesh(definition: NodeDefinition): THREE.Group {
  const room = new THREE.Group()
  room.name = definition.id

  const { width, height, depth } = definition.properties.dimensions
  const material = new THREE.MeshLambertMaterial({ color: PALETTE.MID })

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.2, depth),
    material
  )
  floor.position.y = -height / 2
  room.add(floor)

  // Walls (with door openings)
  const walls = createWallsWithOpenings(definition)
  room.add(walls)

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.2, depth),
    material
  )
  ceiling.position.y = height / 2
  room.add(ceiling)

  // Position based on ship layout
  const pos = definition.properties.position
  room.position.set(pos.x, pos.y, pos.z)

  return room
}
```

### State-Driven Lighting

```typescript
// Update room appearance based on ship state
function updateRoomLighting(roomId: string, o2Level: number) {
  const room = scene.getObjectByName(roomId)
  if (!room) return

  const light = room.getObjectByName('ambient_light') as THREE.PointLight

  if (o2Level < 16) {
    // Critical - red emergency lighting
    light.color.setHex(PALETTE.CRIT)
    light.intensity = 0.5 + Math.sin(Date.now() / 200) * 0.3 // Pulse
  } else if (o2Level < 19) {
    // Warning - amber tint
    light.color.setHex(PALETTE.WARN)
    light.intensity = 0.8
  } else {
    // Normal - cool white
    light.color.setHex(0xffffff)
    light.intensity = 1
  }
}
```

---

## Batch Updates

To prevent render thrashing, state updates are batched.

```typescript
class StateStore {
  private pendingNotifications: Map<string, any> = new Map()
  private notifyScheduled = false
  
  setProperty(id: string, property: string, value: any): void {
    const path = `${id}.${property}`
    const state = this.states.get(id)
    
    if (state) {
      state.values[property] = value
      this.pendingNotifications.set(path, value)
      this.scheduleNotify()
    }
  }
  
  private scheduleNotify(): void {
    if (this.notifyScheduled) return
    
    this.notifyScheduled = true
    
    // Batch notifications to next frame
    requestAnimationFrame(() => {
      this.notifyScheduled = false
      
      // Notify all pending changes at once
      for (const [path, value] of this.pendingNotifications) {
        this.notifySubscribers(path, value)
      }
      
      this.pendingNotifications.clear()
    })
  }
}
```

---

## Derived State

Some UI state is computed from multiple sources:

```typescript
// Can the player open this door?
function useCanOpenDoor(doorId: string): boolean {
  const doorState = useShipState(`${doorId}.state`)
  const doorDef = useDefinition(doorId)
  const playerCredentials = useGameState(s => s.credentials)
  const playerRoom = useGameState(s => s.playerRoom)
  
  return useMemo(() => {
    // Can't open if already open
    if (doorState === 'OPEN') return false
    
    // Can't open if jammed
    if (doorState === 'JAMMED') return false
    
    // Must be adjacent to door
    const doorRooms = doorDef.properties.connects
    if (!doorRooms.includes(playerRoom)) return false
    
    // Check permissions
    if (doorState === 'SEALED') {
      return evaluatePermission(
        doorDef.properties.unseal_requires,
        playerCredentials
      )
    }
    
    return evaluatePermission(
      doorDef.properties.access,
      playerCredentials
    )
  }, [doorState, doorDef, playerCredentials, playerRoom])
}
```

---

## Animation

State changes can trigger animations:

```typescript
function AnimatedGauge({ value, max, label }: GaugeProps) {
  const prevValue = usePrevious(value)
  const [displayValue, setDisplayValue] = useState(value)
  
  useEffect(() => {
    if (prevValue === undefined) {
      setDisplayValue(value)
      return
    }
    
    // Animate from previous to current
    const start = prevValue
    const end = value
    const duration = 300
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      
      setDisplayValue(start + (end - start) * eased)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
  }, [value, prevValue])
  
  return (
    <div className="gauge">
      <div 
        className="gauge-fill"
        style={{ width: `${(displayValue / max) * 100}%` }}
      />
      <span className="gauge-label">{label}: {displayValue.toFixed(1)}%</span>
    </div>
  )
}
```

---

## Event Notifications

UI can subscribe to runtime events for notifications:

```typescript
function useRuntimeNotifications() {
  const runtime = useRuntime()
  
  useEffect(() => {
    const handlers = {
      'signal:triggered': (e: SignalEvent) => {
        if (e.severity === 'CRITICAL') {
          showAlert(e.message)
        }
      },
      
      'compile:error': (e: CompileEvent) => {
        showErrorToast(`Compilation failed: ${e.errors[0].message}`)
      },
      
      'compile:success': (e: CompileEvent) => {
        showSuccessToast('Changes applied')
      },
      
      'door:access_denied': (e: DoorEvent) => {
        showToast(e.message)
      }
    }
    
    for (const [event, handler] of Object.entries(handlers)) {
      runtime.on(event, handler)
    }
    
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        runtime.off(event, handler)
      }
    }
  }, [runtime])
}
```
