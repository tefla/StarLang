// StarLang Layout Editor

type Tool = 'select' | 'room' | 'door' | 'switch' | 'terminal' | 'wallLight'

interface Position3D {
  x: number
  y: number
  z: number
}

interface RoomData {
  id: string
  position: Position3D
  size: { width: number; height: number; depth: number }
}

interface DoorData {
  id: string
  position: Position3D
  rotation: number
}

interface SwitchData {
  id: string
  position: Position3D
  rotation: number
  status: 'OK' | 'FAULT'
}

interface TerminalData {
  id: string
  position: Position3D
  rotation: number
}

interface WallLightData {
  id: string
  position: Position3D
  rotation: number
  color: string
  intensity: number
}

interface LayoutData {
  rooms: RoomData[]
  doors: DoorData[]
  switches: SwitchData[]
  terminals: TerminalData[]
  wallLights: WallLightData[]
}

type SelectedObject =
  | { type: 'room'; data: RoomData }
  | { type: 'door'; data: DoorData }
  | { type: 'switch'; data: SwitchData }
  | { type: 'terminal'; data: TerminalData }
  | { type: 'wallLight'; data: WallLightData }
  | null

class LayoutEditor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private container: HTMLElement

  private tool: Tool = 'select'
  private layout: LayoutData = { rooms: [], doors: [], switches: [], terminals: [], wallLights: [] }
  private selected: SelectedObject = null

  // View state
  private offsetX = 0
  private offsetY = 0
  private zoom = 30 // pixels per unit
  private gridSize = 1

  // Interaction state
  private isDragging = false
  private isPanning = false
  private dragStart = { x: 0, y: 0 }
  private dragStartWorld = { x: 0, z: 0 }
  private drawingRoom: { startX: number; startZ: number; endX: number; endZ: number } | null = null

  // ID counters
  private roomCounter = 1
  private doorCounter = 1
  private switchCounter = 1
  private terminalCounter = 1
  private wallLightCounter = 1

  // Current file
  private currentFile: string = ''
  private hasUnsavedChanges = false

  constructor() {
    this.canvas = document.getElementById('editor-canvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.container = document.getElementById('canvas-container')!

    this.setupCanvas()
    this.setupEventListeners()
    this.loadLayoutList()
    this.render()
  }

  private async loadLayoutList() {
    try {
      const res = await fetch('/api/layouts')
      const data = await res.json()
      const select = document.getElementById('file-select') as HTMLSelectElement
      select.innerHTML = '<option value="">-- Select Layout --</option>'
      for (const layout of data.layouts) {
        const option = document.createElement('option')
        option.value = layout
        option.textContent = layout.replace('.layout.json', '')
        select.appendChild(option)
      }
    } catch (err) {
      console.error('Failed to load layout list:', err)
    }
  }

  private async loadFromGame() {
    const select = document.getElementById('file-select') as HTMLSelectElement
    const filename = select.value
    if (!filename) {
      alert('Please select a layout file first')
      return
    }

    if (this.hasUnsavedChanges && !confirm('You have unsaved changes. Load anyway?')) {
      return
    }

    try {
      const res = await fetch(`/api/layouts/${filename}`)
      const data = await res.json()
      this.loadLayout(data)
      this.currentFile = filename
      this.hasUnsavedChanges = false
      this.updateTitle()
      this.updateStatus(`Loaded ${filename}`)
    } catch (err) {
      alert('Failed to load layout')
      console.error(err)
    }
  }

  private async saveToGame() {
    if (!this.currentFile) {
      const name = prompt('Enter layout name (without extension):')
      if (!name) return
      this.currentFile = name + '.layout.json'
    }

    const data = this.exportToObject()

    try {
      const res = await fetch(`/api/layouts/${this.currentFile}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (res.ok) {
        this.hasUnsavedChanges = false
        this.updateTitle()
        this.updateStatus(`Saved ${this.currentFile}`)
        this.loadLayoutList() // Refresh list in case it's new
      } else {
        alert('Failed to save layout')
      }
    } catch (err) {
      alert('Failed to save layout')
      console.error(err)
    }
  }

  private async createNewFile() {
    const name = prompt('Enter new layout name (without extension):')
    if (!name) return

    try {
      const res = await fetch(`/api/layouts/new/${name}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        await this.loadLayoutList()
        const select = document.getElementById('file-select') as HTMLSelectElement
        select.value = data.name
        this.clearAll(false)
        this.currentFile = data.name
        this.hasUnsavedChanges = false
        this.updateTitle()
        this.updateStatus(`Created ${data.name}`)
      } else {
        alert('Failed to create layout')
      }
    } catch (err) {
      alert('Failed to create layout')
      console.error(err)
    }
  }

  private updateTitle() {
    const title = this.currentFile
      ? `StarLang Layout Editor - ${this.currentFile}${this.hasUnsavedChanges ? ' *' : ''}`
      : 'StarLang Layout Editor'
    document.title = title
  }

  private markUnsaved() {
    this.hasUnsavedChanges = true
    this.updateTitle()
  }

  private setupCanvas() {
    const resize = () => {
      this.canvas.width = this.container.clientWidth
      this.canvas.height = this.container.clientHeight
      this.render()
    }
    resize()
    window.addEventListener('resize', resize)

    // Center the view
    this.offsetX = this.canvas.width / 2
    this.offsetY = this.canvas.height / 2
  }

  private setupEventListeners() {
    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.tool = btn.getAttribute('data-tool') as Tool
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this.updateStatus()
      })
    })

    // File buttons
    document.getElementById('load-btn')?.addEventListener('click', () => this.loadFromGame())
    document.getElementById('save-btn')?.addEventListener('click', () => this.saveToGame())
    document.getElementById('new-file-btn')?.addEventListener('click', () => this.createNewFile())

    // Action buttons
    document.getElementById('export-btn')?.addEventListener('click', () => this.exportJSON())
    document.getElementById('import-btn')?.addEventListener('click', () => this.importJSON())
    document.getElementById('clear-btn')?.addEventListener('click', () => this.clearAll(true))
    document.getElementById('zoom-in')?.addEventListener('click', () => { this.zoom *= 1.2; this.render() })
    document.getElementById('zoom-out')?.addEventListener('click', () => { this.zoom /= 1.2; this.render() })
    document.getElementById('reset-view')?.addEventListener('click', () => this.resetView())

    // JSON modal
    document.getElementById('overlay')?.addEventListener('click', () => this.closeModal())
    document.querySelector('#json-output .close-btn')?.addEventListener('click', () => this.closeModal())
    document.getElementById('copy-json')?.addEventListener('click', () => this.copyJSON())

    // File input
    document.getElementById('file-input')?.addEventListener('change', (e) => this.handleFileImport(e))

    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e))
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e))
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e))
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e))
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Keyboard
    window.addEventListener('keydown', (e) => this.onKeyDown(e))
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; z: number } {
    return {
      x: (screenX - this.offsetX) / this.zoom,
      z: (screenY - this.offsetY) / this.zoom
    }
  }

  private worldToScreen(worldX: number, worldZ: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.offsetX,
      y: worldZ * this.zoom + this.offsetY
    }
  }

  private snapToGrid(value: number): number {
    return Math.round(value / this.gridSize) * this.gridSize
  }

  private onMouseDown(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = this.screenToWorld(screenX, screenY)

    // Right click or middle click = pan
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true
      this.dragStart = { x: screenX, y: screenY }
      return
    }

    if (this.tool === 'select') {
      // Try to select something
      const hit = this.hitTest(world.x, world.z)
      this.selected = hit
      this.updatePropertiesPanel()

      if (hit) {
        this.isDragging = true
        this.dragStartWorld = { x: world.x, z: world.z }
      }
    } else if (this.tool === 'room') {
      // Start drawing room
      this.drawingRoom = {
        startX: this.snapToGrid(world.x),
        startZ: this.snapToGrid(world.z),
        endX: this.snapToGrid(world.x),
        endZ: this.snapToGrid(world.z)
      }
    } else if (this.tool === 'door') {
      this.placeDoor(world.x, world.z)
    } else if (this.tool === 'switch') {
      this.placeSwitch(world.x, world.z)
    } else if (this.tool === 'terminal') {
      this.placeTerminal(world.x, world.z)
    } else if (this.tool === 'wallLight') {
      this.placeWallLight(world.x, world.z)
    }

    this.render()
  }

  private onMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = this.screenToWorld(screenX, screenY)

    if (this.isPanning) {
      this.offsetX += screenX - this.dragStart.x
      this.offsetY += screenY - this.dragStart.y
      this.dragStart = { x: screenX, y: screenY }
      this.render()
      return
    }

    if (this.isDragging && this.selected) {
      const dx = this.snapToGrid(world.x) - this.snapToGrid(this.dragStartWorld.x)
      const dz = this.snapToGrid(world.z) - this.snapToGrid(this.dragStartWorld.z)

      if (dx !== 0 || dz !== 0) {
        this.selected.data.position.x += dx
        this.selected.data.position.z += dz
        this.dragStartWorld = { x: world.x, z: world.z }
        this.render()
      }
    }

    if (this.drawingRoom) {
      this.drawingRoom.endX = this.snapToGrid(world.x)
      this.drawingRoom.endZ = this.snapToGrid(world.z)
      this.render()
    }

    // Update status with coordinates
    this.updateStatus(`(${world.x.toFixed(1)}, ${world.z.toFixed(1)})`)
  }

  private onMouseUp(e: MouseEvent) {
    if (this.isPanning) {
      this.isPanning = false
      return
    }

    if (this.isDragging) {
      this.isDragging = false
      this.updatePropertiesPanel()
    }

    if (this.drawingRoom) {
      const { startX, startZ, endX, endZ } = this.drawingRoom
      const width = Math.abs(endX - startX)
      const depth = Math.abs(endZ - startZ)

      if (width >= 1 && depth >= 1) {
        const room: RoomData = {
          id: `room_${this.roomCounter++}`,
          position: {
            x: Math.min(startX, endX) + width / 2,
            y: 0,
            z: Math.min(startZ, endZ) + depth / 2
          },
          size: { width, height: 3, depth }
        }
        this.layout.rooms.push(room)
        this.selected = { type: 'room', data: room }
        this.markUnsaved()
        this.updatePropertiesPanel()
      }

      this.drawingRoom = null
      this.render()
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const worldBefore = this.screenToWorld(mouseX, mouseY)

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    this.zoom *= zoomFactor
    this.zoom = Math.max(10, Math.min(100, this.zoom))

    const worldAfter = this.screenToWorld(mouseX, mouseY)

    this.offsetX += (worldAfter.x - worldBefore.x) * this.zoom
    this.offsetY += (worldAfter.z - worldBefore.z) * this.zoom

    this.render()
  }

  private onKeyDown(e: KeyboardEvent) {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      this.saveToGame()
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selected) {
        this.deleteSelected()
      }
    } else if (e.key === 'Escape') {
      this.selected = null
      this.updatePropertiesPanel()
      this.render()
    } else if (e.key === 'r' && this.selected) {
      // Rotate selected
      if (this.selected.type !== 'room') {
        this.selected.data.rotation = (this.selected.data.rotation + 90) % 360
        this.markUnsaved()
        this.updatePropertiesPanel()
        this.render()
      }
    }
  }

  private hitTest(worldX: number, worldZ: number): SelectedObject {
    // Check wall lights first (smallest)
    for (const light of this.layout.wallLights) {
      if (this.pointInRect(worldX, worldZ, light.position.x - 0.25, light.position.z - 0.25, 0.5, 0.5)) {
        return { type: 'wallLight', data: light }
      }
    }

    // Check terminals
    for (const terminal of this.layout.terminals) {
      if (this.pointInRect(worldX, worldZ, terminal.position.x - 0.3, terminal.position.z - 0.3, 0.6, 0.6)) {
        return { type: 'terminal', data: terminal }
      }
    }

    // Check switches
    for (const sw of this.layout.switches) {
      if (this.pointInRect(worldX, worldZ, sw.position.x - 0.2, sw.position.z - 0.2, 0.4, 0.4)) {
        return { type: 'switch', data: sw }
      }
    }

    // Check doors
    for (const door of this.layout.doors) {
      if (this.pointInRect(worldX, worldZ, door.position.x - 0.6, door.position.z - 0.3, 1.2, 0.6)) {
        return { type: 'door', data: door }
      }
    }

    // Check rooms
    for (const room of this.layout.rooms) {
      const halfW = room.size.width / 2
      const halfD = room.size.depth / 2
      if (this.pointInRect(worldX, worldZ, room.position.x - halfW, room.position.z - halfD, room.size.width, room.size.depth)) {
        return { type: 'room', data: room }
      }
    }

    return null
  }

  private pointInRect(px: number, pz: number, rx: number, rz: number, rw: number, rd: number): boolean {
    return px >= rx && px <= rx + rw && pz >= rz && pz <= rz + rd
  }

  private placeDoor(worldX: number, worldZ: number) {
    const door: DoorData = {
      id: `door_${this.doorCounter++}`,
      position: { x: this.snapToGrid(worldX), y: 0, z: this.snapToGrid(worldZ) },
      rotation: 90
    }
    this.layout.doors.push(door)
    this.selected = { type: 'door', data: door }
    this.markUnsaved()
    this.updatePropertiesPanel()
    this.render()
  }

  private placeSwitch(worldX: number, worldZ: number) {
    const sw: SwitchData = {
      id: `switch_${this.switchCounter++}`,
      position: { x: this.snapToGrid(worldX), y: 0, z: this.snapToGrid(worldZ) },
      rotation: 0,
      status: 'OK'
    }
    this.layout.switches.push(sw)
    this.selected = { type: 'switch', data: sw }
    this.markUnsaved()
    this.updatePropertiesPanel()
    this.render()
  }

  private placeTerminal(worldX: number, worldZ: number) {
    const terminal: TerminalData = {
      id: `terminal_${this.terminalCounter++}`,
      position: { x: this.snapToGrid(worldX), y: 0, z: this.snapToGrid(worldZ) },
      rotation: 0
    }
    this.layout.terminals.push(terminal)
    this.selected = { type: 'terminal', data: terminal }
    this.markUnsaved()
    this.updatePropertiesPanel()
    this.render()
  }

  private placeWallLight(worldX: number, worldZ: number) {
    const light: WallLightData = {
      id: `wall_light_${this.wallLightCounter++}`,
      position: { x: this.snapToGrid(worldX), y: 1.5, z: this.snapToGrid(worldZ) },
      rotation: 0,
      color: '#ffffee',
      intensity: 1.0
    }
    this.layout.wallLights.push(light)
    this.selected = { type: 'wallLight', data: light }
    this.markUnsaved()
    this.updatePropertiesPanel()
    this.render()
  }

  private deleteSelected() {
    if (!this.selected) return

    switch (this.selected.type) {
      case 'room':
        this.layout.rooms = this.layout.rooms.filter(r => r !== this.selected!.data)
        break
      case 'door':
        this.layout.doors = this.layout.doors.filter(d => d !== this.selected!.data)
        break
      case 'switch':
        this.layout.switches = this.layout.switches.filter(s => s !== this.selected!.data)
        break
      case 'terminal':
        this.layout.terminals = this.layout.terminals.filter(t => t !== this.selected!.data)
        break
      case 'wallLight':
        this.layout.wallLights = this.layout.wallLights.filter(l => l !== this.selected!.data)
        break
    }

    this.selected = null
    this.markUnsaved()
    this.updatePropertiesPanel()
    this.render()
  }

  private render() {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // Draw grid
    this.drawGrid()

    // Draw rooms
    for (const room of this.layout.rooms) {
      this.drawRoom(room, this.selected?.type === 'room' && this.selected.data === room)
    }

    // Draw doors
    for (const door of this.layout.doors) {
      this.drawDoor(door, this.selected?.type === 'door' && this.selected.data === door)
    }

    // Draw switches
    for (const sw of this.layout.switches) {
      this.drawSwitch(sw, this.selected?.type === 'switch' && this.selected.data === sw)
    }

    // Draw terminals
    for (const terminal of this.layout.terminals) {
      this.drawTerminal(terminal, this.selected?.type === 'terminal' && this.selected.data === terminal)
    }

    // Draw wall lights
    for (const light of this.layout.wallLights) {
      this.drawWallLight(light, this.selected?.type === 'wallLight' && this.selected.data === light)
    }

    // Draw room being created
    if (this.drawingRoom) {
      const { startX, startZ, endX, endZ } = this.drawingRoom
      const minX = Math.min(startX, endX)
      const minZ = Math.min(startZ, endZ)
      const width = Math.abs(endX - startX)
      const depth = Math.abs(endZ - startZ)

      const screen = this.worldToScreen(minX, minZ)
      ctx.strokeStyle = '#77dd77'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(screen.x, screen.y, width * this.zoom, depth * this.zoom)
      ctx.setLineDash([])
    }

    // Draw origin marker
    const origin = this.worldToScreen(0, 0)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(origin.x - 10, origin.y)
    ctx.lineTo(origin.x + 10, origin.y)
    ctx.moveTo(origin.x, origin.y - 10)
    ctx.lineTo(origin.x, origin.y + 10)
    ctx.stroke()
  }

  private drawGrid() {
    const ctx = this.ctx
    ctx.strokeStyle = '#252540'
    ctx.lineWidth = 1

    const startWorld = this.screenToWorld(0, 0)
    const endWorld = this.screenToWorld(this.canvas.width, this.canvas.height)

    const gridStep = this.gridSize
    const startX = Math.floor(startWorld.x / gridStep) * gridStep
    const startZ = Math.floor(startWorld.z / gridStep) * gridStep

    for (let x = startX; x <= endWorld.x; x += gridStep) {
      const screen = this.worldToScreen(x, 0)
      ctx.beginPath()
      ctx.moveTo(screen.x, 0)
      ctx.lineTo(screen.x, this.canvas.height)
      ctx.stroke()
    }

    for (let z = startZ; z <= endWorld.z; z += gridStep) {
      const screen = this.worldToScreen(0, z)
      ctx.beginPath()
      ctx.moveTo(0, screen.y)
      ctx.lineTo(this.canvas.width, screen.y)
      ctx.stroke()
    }
  }

  private drawRoom(room: RoomData, selected: boolean) {
    const ctx = this.ctx
    const halfW = room.size.width / 2
    const halfD = room.size.depth / 2
    const topLeft = this.worldToScreen(room.position.x - halfW, room.position.z - halfD)
    const w = room.size.width * this.zoom
    const d = room.size.depth * this.zoom

    // Fill
    ctx.fillStyle = selected ? 'rgba(119, 221, 119, 0.2)' : 'rgba(100, 100, 150, 0.3)'
    ctx.fillRect(topLeft.x, topLeft.y, w, d)

    // Border
    ctx.strokeStyle = selected ? '#77dd77' : '#666'
    ctx.lineWidth = selected ? 2 : 1
    ctx.strokeRect(topLeft.x, topLeft.y, w, d)

    // Label
    ctx.fillStyle = '#aaa'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    const center = this.worldToScreen(room.position.x, room.position.z)
    ctx.fillText(room.id, center.x, center.y)
  }

  private drawDoor(door: DoorData, selected: boolean) {
    const ctx = this.ctx
    const pos = this.worldToScreen(door.position.x, door.position.z)
    const size = 0.6 * this.zoom

    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate((door.rotation * Math.PI) / 180)

    ctx.fillStyle = selected ? '#77dd77' : '#ffaa44'
    ctx.fillRect(-size, -size / 4, size * 2, size / 2)

    ctx.restore()

    // Label
    if (selected) {
      ctx.fillStyle = '#fff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(door.id, pos.x, pos.y - 15)
    }
  }

  private drawSwitch(sw: SwitchData, selected: boolean) {
    const ctx = this.ctx
    const pos = this.worldToScreen(sw.position.x, sw.position.z)
    const size = 0.2 * this.zoom

    ctx.fillStyle = sw.status === 'OK' ? (selected ? '#77dd77' : '#44aa44') : (selected ? '#ff8888' : '#aa4444')
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2)
    ctx.fill()

    // Direction indicator (arrow showing which way it faces)
    // Use (180 - rotation) to account for Three.js CCW vs Canvas CW rotation
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(((180 - sw.rotation) * Math.PI) / 180)
    ctx.strokeStyle = selected ? '#fff' : '#222'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -size * 1.5)
    ctx.moveTo(-size * 0.4, -size)
    ctx.lineTo(0, -size * 1.5)
    ctx.lineTo(size * 0.4, -size)
    ctx.stroke()
    ctx.restore()

    if (selected) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(sw.id, pos.x, pos.y - size - 10)
    }
  }

  private drawTerminal(terminal: TerminalData, selected: boolean) {
    const ctx = this.ctx
    const pos = this.worldToScreen(terminal.position.x, terminal.position.z)
    const size = 0.3 * this.zoom

    // Use (180 - rotation) to account for Three.js CCW vs Canvas CW rotation
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(((180 - terminal.rotation) * Math.PI) / 180)

    ctx.fillStyle = selected ? '#88ccff' : '#4488aa'
    ctx.fillRect(-size / 2, -size / 2, size, size)

    // Direction indicator (line showing front)
    ctx.strokeStyle = selected ? '#fff' : '#226688'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-size / 3, -size / 2)
    ctx.lineTo(size / 3, -size / 2)
    ctx.stroke()

    ctx.restore()

    if (selected) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.save()
      ctx.translate(pos.x, pos.y)
      ctx.rotate(((180 - terminal.rotation) * Math.PI) / 180)
      ctx.strokeRect(-size / 2, -size / 2, size, size)
      ctx.restore()

      ctx.fillStyle = '#fff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(terminal.id, pos.x, pos.y - size / 2 - 10)
    }
  }

  private drawWallLight(light: WallLightData, selected: boolean) {
    const ctx = this.ctx
    const pos = this.worldToScreen(light.position.x, light.position.z)
    const size = 0.25 * this.zoom

    // Draw light glow effect
    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 2)
    gradient.addColorStop(0, light.color + '66')
    gradient.addColorStop(1, light.color + '00')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size * 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw light fixture (diamond shape)
    // Use (180 - rotation) to account for Three.js CCW vs Canvas CW rotation
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(((180 - light.rotation) * Math.PI) / 180)

    ctx.fillStyle = selected ? light.color : '#ffee88'
    ctx.beginPath()
    ctx.moveTo(0, -size)
    ctx.lineTo(size * 0.7, 0)
    ctx.lineTo(0, size)
    ctx.lineTo(-size * 0.7, 0)
    ctx.closePath()
    ctx.fill()

    // Direction indicator (small arrow)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -size * 1.2)
    ctx.stroke()

    ctx.restore()

    if (selected) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, size * 1.2, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = '#fff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(light.id, pos.x, pos.y - size * 1.5 - 5)
    }
  }

  private updatePropertiesPanel() {
    const noSelection = document.getElementById('no-selection')!
    const selectionProps = document.getElementById('selection-props')!

    if (!this.selected) {
      noSelection.style.display = 'block'
      selectionProps.style.display = 'none'
      return
    }

    noSelection.style.display = 'none'
    selectionProps.style.display = 'block'

    let html = ''

    if (this.selected.type === 'room') {
      const room = this.selected.data
      html = `
        <div class="prop-group">
          <label>ID</label>
          <input type="text" id="prop-id" value="${room.id}">
        </div>
        <div class="prop-row">
          <div class="prop-group">
            <label>Pos X</label>
            <input type="number" id="prop-x" value="${room.position.x}" step="0.5">
          </div>
          <div class="prop-group">
            <label>Pos Z</label>
            <input type="number" id="prop-z" value="${room.position.z}" step="0.5">
          </div>
        </div>
        <div class="prop-row">
          <div class="prop-group">
            <label>Width</label>
            <input type="number" id="prop-width" value="${room.size.width}" step="0.5" min="1">
          </div>
          <div class="prop-group">
            <label>Depth</label>
            <input type="number" id="prop-depth" value="${room.size.depth}" step="0.5" min="1">
          </div>
        </div>
        <div class="prop-group">
          <label>Height</label>
          <input type="number" id="prop-height" value="${room.size.height}" step="0.5" min="1">
        </div>
      `
    } else if (this.selected.type === 'door') {
      const door = this.selected.data
      html = `
        <div class="prop-group">
          <label>ID</label>
          <input type="text" id="prop-id" value="${door.id}">
        </div>
        <div class="prop-row">
          <div class="prop-group">
            <label>Pos X</label>
            <input type="number" id="prop-x" value="${door.position.x}" step="0.5">
          </div>
          <div class="prop-group">
            <label>Pos Z</label>
            <input type="number" id="prop-z" value="${door.position.z}" step="0.5">
          </div>
        </div>
        <div class="prop-group">
          <label>Rotation</label>
          <select id="prop-rotation">
            <option value="0" ${door.rotation === 0 ? 'selected' : ''}>0°</option>
            <option value="90" ${door.rotation === 90 ? 'selected' : ''}>90°</option>
            <option value="180" ${door.rotation === 180 ? 'selected' : ''}>180°</option>
            <option value="270" ${door.rotation === 270 ? 'selected' : ''}>270°</option>
          </select>
        </div>
      `
    } else if (this.selected.type === 'switch') {
      const sw = this.selected.data
      html = `
        <div class="prop-group">
          <label>ID</label>
          <input type="text" id="prop-id" value="${sw.id}">
        </div>
        <div class="prop-row">
          <div class="prop-group">
            <label>Pos X</label>
            <input type="number" id="prop-x" value="${sw.position.x}" step="0.5">
          </div>
          <div class="prop-group">
            <label>Pos Z</label>
            <input type="number" id="prop-z" value="${sw.position.z}" step="0.5">
          </div>
        </div>
        <div class="prop-group">
          <label>Rotation</label>
          <select id="prop-rotation">
            <option value="0" ${sw.rotation === 0 ? 'selected' : ''}>0°</option>
            <option value="90" ${sw.rotation === 90 ? 'selected' : ''}>90°</option>
            <option value="180" ${sw.rotation === 180 ? 'selected' : ''}>180°</option>
            <option value="270" ${sw.rotation === 270 ? 'selected' : ''}>270°</option>
          </select>
        </div>
        <div class="prop-group">
          <label>Status</label>
          <select id="prop-status">
            <option value="OK" ${sw.status === 'OK' ? 'selected' : ''}>OK (Working)</option>
            <option value="FAULT" ${sw.status === 'FAULT' ? 'selected' : ''}>FAULT (Broken)</option>
          </select>
        </div>
      `
    } else if (this.selected.type === 'terminal') {
      const terminal = this.selected.data
      html = `
        <div class="prop-group">
          <label>ID</label>
          <input type="text" id="prop-id" value="${terminal.id}">
        </div>
        <div class="prop-row">
          <div class="prop-group">
            <label>Pos X</label>
            <input type="number" id="prop-x" value="${terminal.position.x}" step="0.5">
          </div>
          <div class="prop-group">
            <label>Pos Z</label>
            <input type="number" id="prop-z" value="${terminal.position.z}" step="0.5">
          </div>
        </div>
        <div class="prop-group">
          <label>Rotation</label>
          <select id="prop-rotation">
            <option value="0" ${terminal.rotation === 0 ? 'selected' : ''}>0°</option>
            <option value="90" ${terminal.rotation === 90 ? 'selected' : ''}>90°</option>
            <option value="180" ${terminal.rotation === 180 ? 'selected' : ''}>180°</option>
            <option value="270" ${terminal.rotation === 270 ? 'selected' : ''}>270°</option>
          </select>
        </div>
      `
    } else if (this.selected.type === 'wallLight') {
      const light = this.selected.data
      html = `
        <div class="prop-group">
          <label>ID</label>
          <input type="text" id="prop-id" value="${light.id}">
        </div>
        <div class="prop-row">
          <div class="prop-group">
            <label>Pos X</label>
            <input type="number" id="prop-x" value="${light.position.x}" step="0.5">
          </div>
          <div class="prop-group">
            <label>Pos Z</label>
            <input type="number" id="prop-z" value="${light.position.z}" step="0.5">
          </div>
        </div>
        <div class="prop-group">
          <label>Height (Y)</label>
          <input type="number" id="prop-y" value="${light.position.y}" step="0.25" min="0" max="3">
        </div>
        <div class="prop-group">
          <label>Rotation</label>
          <select id="prop-rotation">
            <option value="0" ${light.rotation === 0 ? 'selected' : ''}>0° (North)</option>
            <option value="90" ${light.rotation === 90 ? 'selected' : ''}>90° (East)</option>
            <option value="180" ${light.rotation === 180 ? 'selected' : ''}>180° (South)</option>
            <option value="270" ${light.rotation === 270 ? 'selected' : ''}>270° (West)</option>
          </select>
        </div>
        <div class="prop-group">
          <label>Color</label>
          <input type="color" id="prop-color" value="${light.color}">
        </div>
        <div class="prop-group">
          <label>Intensity</label>
          <input type="number" id="prop-intensity" value="${light.intensity}" step="0.1" min="0" max="5">
        </div>
      `
    }

    html += `<button class="tool-btn danger" style="margin-top: 15px; width: 100%;" id="delete-btn">Delete</button>`

    selectionProps.innerHTML = html

    // Add event listeners
    this.setupPropertyListeners()
  }

  private setupPropertyListeners() {
    if (!this.selected) return

    document.getElementById('prop-id')?.addEventListener('change', (e) => {
      this.selected!.data.id = (e.target as HTMLInputElement).value
      this.markUnsaved()
      this.render()
    })

    document.getElementById('prop-x')?.addEventListener('change', (e) => {
      this.selected!.data.position.x = parseFloat((e.target as HTMLInputElement).value)
      this.markUnsaved()
      this.render()
    })

    document.getElementById('prop-z')?.addEventListener('change', (e) => {
      this.selected!.data.position.z = parseFloat((e.target as HTMLInputElement).value)
      this.markUnsaved()
      this.render()
    })

    if (this.selected.type === 'room') {
      document.getElementById('prop-width')?.addEventListener('change', (e) => {
        (this.selected!.data as RoomData).size.width = parseFloat((e.target as HTMLInputElement).value)
        this.markUnsaved()
        this.render()
      })
      document.getElementById('prop-depth')?.addEventListener('change', (e) => {
        (this.selected!.data as RoomData).size.depth = parseFloat((e.target as HTMLInputElement).value)
        this.markUnsaved()
        this.render()
      })
      document.getElementById('prop-height')?.addEventListener('change', (e) => {
        (this.selected!.data as RoomData).size.height = parseFloat((e.target as HTMLInputElement).value)
        this.markUnsaved()
        this.render()
      })
    }

    if (this.selected.type !== 'room') {
      document.getElementById('prop-rotation')?.addEventListener('change', (e) => {
        (this.selected!.data as any).rotation = parseInt((e.target as HTMLSelectElement).value)
        this.markUnsaved()
        this.render()
      })
    }

    if (this.selected.type === 'switch') {
      document.getElementById('prop-status')?.addEventListener('change', (e) => {
        (this.selected!.data as SwitchData).status = (e.target as HTMLSelectElement).value as 'OK' | 'FAULT'
        this.markUnsaved()
        this.render()
      })
    }

    if (this.selected.type === 'wallLight') {
      document.getElementById('prop-y')?.addEventListener('change', (e) => {
        (this.selected!.data as WallLightData).position.y = parseFloat((e.target as HTMLInputElement).value)
        this.markUnsaved()
        this.render()
      })
      document.getElementById('prop-color')?.addEventListener('change', (e) => {
        (this.selected!.data as WallLightData).color = (e.target as HTMLInputElement).value
        this.markUnsaved()
        this.render()
      })
      document.getElementById('prop-intensity')?.addEventListener('change', (e) => {
        (this.selected!.data as WallLightData).intensity = parseFloat((e.target as HTMLInputElement).value)
        this.markUnsaved()
        this.render()
      })
    }

    document.getElementById('delete-btn')?.addEventListener('click', () => this.deleteSelected())
  }

  private exportToObject(): any {
    const output: any = {
      rooms: {},
      doors: {},
      terminals: {},
      switches: {},
      wallLights: {}
    }

    for (const room of this.layout.rooms) {
      output.rooms[room.id] = {
        position: room.position,
        size: room.size
      }
    }

    for (const door of this.layout.doors) {
      output.doors[door.id] = {
        position: door.position,
        rotation: door.rotation
      }
    }

    for (const terminal of this.layout.terminals) {
      output.terminals[terminal.id] = {
        position: terminal.position,
        rotation: terminal.rotation
      }
    }

    for (const sw of this.layout.switches) {
      output.switches[sw.id] = {
        position: sw.position,
        rotation: sw.rotation,
        status: sw.status
      }
    }

    for (const light of this.layout.wallLights) {
      output.wallLights[light.id] = {
        position: light.position,
        rotation: light.rotation,
        color: light.color,
        intensity: light.intensity
      }
    }

    return output
  }

  private exportJSON() {
    const output = this.exportToObject()
    const json = JSON.stringify(output, null, 2)
    document.getElementById('json-content')!.textContent = json
    document.getElementById('overlay')!.style.display = 'block'
    document.getElementById('json-output')!.style.display = 'block'
  }

  private copyJSON() {
    const json = document.getElementById('json-content')!.textContent!
    navigator.clipboard.writeText(json)
    alert('Copied to clipboard!')
  }

  private closeModal() {
    document.getElementById('overlay')!.style.display = 'none'
    document.getElementById('json-output')!.style.display = 'none'
  }

  private importJSON() {
    document.getElementById('file-input')?.click()
  }

  private handleFileImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        this.loadLayout(data)
      } catch (err) {
        alert('Failed to parse JSON file')
      }
    }
    reader.readAsText(file)
  }

  private loadLayout(data: any) {
    this.layout = { rooms: [], doors: [], switches: [], terminals: [], wallLights: [] }

    if (data.rooms) {
      for (const [id, room] of Object.entries(data.rooms as Record<string, any>)) {
        this.layout.rooms.push({
          id,
          position: room.position,
          size: room.size
        })
        this.roomCounter = Math.max(this.roomCounter, this.extractCounter(id, 'room_') + 1)
      }
    }

    if (data.doors) {
      for (const [id, door] of Object.entries(data.doors as Record<string, any>)) {
        this.layout.doors.push({
          id,
          position: door.position,
          rotation: door.rotation
        })
        this.doorCounter = Math.max(this.doorCounter, this.extractCounter(id, 'door_') + 1)
      }
    }

    if (data.switches) {
      for (const [id, sw] of Object.entries(data.switches as Record<string, any>)) {
        this.layout.switches.push({
          id,
          position: sw.position,
          rotation: sw.rotation,
          status: sw.status || 'OK'
        })
        this.switchCounter = Math.max(this.switchCounter, this.extractCounter(id, 'switch_') + 1)
      }
    }

    if (data.terminals) {
      for (const [id, terminal] of Object.entries(data.terminals as Record<string, any>)) {
        this.layout.terminals.push({
          id,
          position: terminal.position,
          rotation: terminal.rotation
        })
        this.terminalCounter = Math.max(this.terminalCounter, this.extractCounter(id, 'terminal_') + 1)
      }
    }

    if (data.wallLights) {
      for (const [id, light] of Object.entries(data.wallLights as Record<string, any>)) {
        this.layout.wallLights.push({
          id,
          position: light.position,
          rotation: light.rotation,
          color: light.color || '#ffffee',
          intensity: light.intensity ?? 1.0
        })
        this.wallLightCounter = Math.max(this.wallLightCounter, this.extractCounter(id, 'wall_light_') + 1)
      }
    }

    this.selected = null
    this.updatePropertiesPanel()
    this.resetView()
  }

  private extractCounter(id: string, prefix: string): number {
    if (id.startsWith(prefix)) {
      const num = parseInt(id.substring(prefix.length))
      if (!isNaN(num)) return num
    }
    return 0
  }

  private clearAll(askConfirm = true) {
    if (askConfirm && !confirm('Clear all objects?')) {
      return
    }
    this.layout = { rooms: [], doors: [], switches: [], terminals: [], wallLights: [] }
    this.selected = null
    this.roomCounter = 1
    this.doorCounter = 1
    this.switchCounter = 1
    this.terminalCounter = 1
    this.wallLightCounter = 1
    this.updatePropertiesPanel()
    this.render()
  }

  private resetView() {
    this.zoom = 30
    this.offsetX = this.canvas.width / 2
    this.offsetY = this.canvas.height / 2
    this.render()
  }

  private updateStatus(extra = '') {
    const status = document.getElementById('status')!
    let text = ''
    switch (this.tool) {
      case 'select': text = 'Click to select. Drag to move. Press R to rotate.'; break
      case 'room': text = 'Click and drag to create a room.'; break
      case 'door': text = 'Click to place a door.'; break
      case 'switch': text = 'Click to place a switch.'; break
      case 'terminal': text = 'Click to place a terminal.'; break
      case 'wallLight': text = 'Click to place a wall light.'; break
    }
    status.textContent = extra ? `${text} ${extra}` : text
  }
}

// Initialize
new LayoutEditor()
