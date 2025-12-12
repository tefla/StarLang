// In-World Terminal - 3D terminal with screen texture

import * as THREE from 'three'
import type { TerminalDefinition, TerminalType } from '../../types/nodes'
import { Runtime } from '../../runtime/Runtime'

export class TerminalMesh {
  public group: THREE.Group
  public definition: TerminalDefinition
  public isInteractable = true
  public isFocused = false

  private screenMesh: THREE.Mesh
  private screenCanvas: HTMLCanvasElement
  private screenTexture: THREE.CanvasTexture
  private screenContext: CanvasRenderingContext2D

  private runtime: Runtime
  private screenWidth = 512
  private screenHeight = 384

  // Terminal content state
  private lines: string[] = []
  private cursorLine = 0
  private cursorCol = 0
  private inputBuffer = ''

  constructor(definition: TerminalDefinition, runtime: Runtime) {
    this.definition = definition
    this.runtime = runtime
    this.group = new THREE.Group()
    this.group.name = `terminal_${definition.id}`
    this.group.userData = { type: 'terminal', id: definition.id, interactable: true }

    // Create canvas for screen rendering
    this.screenCanvas = document.createElement('canvas')
    this.screenCanvas.width = this.screenWidth
    this.screenCanvas.height = this.screenHeight
    this.screenContext = this.screenCanvas.getContext('2d')!

    // Create texture from canvas
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas)
    this.screenTexture.minFilter = THREE.LinearFilter
    this.screenTexture.magFilter = THREE.LinearFilter

    // Build terminal geometry based on type
    this.buildGeometry(definition.properties.terminal_type)

    // Create screen mesh
    const screenGeometry = new THREE.PlaneGeometry(0.8, 0.6)
    const screenMaterial = new THREE.MeshStandardMaterial({
      map: this.screenTexture,
      emissive: new THREE.Color(0x1a2744),
      emissiveIntensity: 0.5,
      emissiveMap: this.screenTexture,
    })
    this.screenMesh = new THREE.Mesh(screenGeometry, screenMaterial)

    // Position screen based on terminal type - flush with the frame surface
    // Note: screen is a PlaneGeometry which faces +Z by default
    if (definition.properties.terminal_type === 'ENGINEERING') {
      // Workstation monitor frame is at z=0.06, depth 0.08
      // Screen should be on the front face (toward keyboard at +z side of desk)
      // Frame front is at z = 0.06 + 0.04 = 0.10, but we want it on the back (keyboard side)
      // Frame back is at z = 0.06 - 0.04 = 0.02
      this.screenMesh.position.set(0, 1.2, 0.019)
      // No rotation needed - screen faces +Z which is toward the keyboard
    } else {
      // Wall panel backing is at z=0, depth 0.1, so front face at z=0.05
      this.screenMesh.position.set(0, 1.2, 0.051)
    }
    this.group.add(this.screenMesh)

    // Position terminal
    const { position, rotation } = definition.properties
    this.group.position.set(position.x, position.y, position.z)
    this.group.rotation.y = (rotation * Math.PI) / 180

    // Initialize screen content
    this.initializeContent()
    this.renderScreen()
  }

  private buildGeometry(terminalType: TerminalType) {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a3a4a,
      roughness: 0.7,
      metalness: 0.3,
    })

    if (terminalType === 'ENGINEERING') {
      // Full workstation with desk
      this.buildWorkstation(frameMaterial)
    } else {
      // Wall-mounted panel
      this.buildWallPanel(frameMaterial)
    }
  }

  private buildWorkstation(material: THREE.Material) {
    // Desk
    const deskGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.6)
    const desk = new THREE.Mesh(deskGeometry, material)
    desk.position.set(0, 0.75, 0)
    this.group.add(desk)

    // Desk legs
    const legGeometry = new THREE.BoxGeometry(0.05, 0.75, 0.05)
    const positions = [
      [-0.55, 0.375, 0.25],
      [0.55, 0.375, 0.25],
      [-0.55, 0.375, -0.25],
      [0.55, 0.375, -0.25],
    ]
    for (const [x, y, z] of positions) {
      const leg = new THREE.Mesh(legGeometry, material)
      leg.position.set(x!, y!, z!)
      this.group.add(leg)
    }

    // Monitor stand
    const standGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1)
    const stand = new THREE.Mesh(standGeometry, material)
    stand.position.set(0, 0.97, 0)
    this.group.add(stand)

    // Monitor frame
    const frameGeometry = new THREE.BoxGeometry(0.9, 0.7, 0.08)
    const frame = new THREE.Mesh(frameGeometry, material)
    frame.position.set(0, 1.2, 0.06)
    this.group.add(frame)

    // Keyboard
    const keyboardGeometry = new THREE.BoxGeometry(0.5, 0.02, 0.15)
    const keyboardMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.8,
    })
    const keyboard = new THREE.Mesh(keyboardGeometry, keyboardMaterial)
    keyboard.position.set(0, 0.78, 0.15)
    this.group.add(keyboard)
  }

  private buildWallPanel(material: THREE.Material) {
    // Wall mounting
    const backingGeometry = new THREE.BoxGeometry(0.9, 0.7, 0.1)
    const backing = new THREE.Mesh(backingGeometry, material)
    backing.position.set(0, 1.2, 0)
    this.group.add(backing)
  }

  private initializeContent() {
    const type = this.definition.properties.terminal_type

    if (type === 'STATUS') {
      this.lines = [
        `═══ ${this.definition.properties.display_name} ═══`,
        '',
        'ENVIRONMENTAL STATUS',
        '────────────────────',
        '',
        '  O2 Level:    21.0%  ✓',
        '  Temperature: 22.0°C ✓',
        '  Pressure:    1.0atm ✓',
        '',
        '────────────────────',
        'System Status: NOMINAL',
      ]
    } else if (type === 'ENGINEERING') {
      this.lines = [
        '═══ ENGINEERING WORKSTATION ═══',
        `User: Riley Chen (Cook)`,
        '',
        'Files:',
        '  galley.sl',
        '',
        '> Press E to interact',
      ]
    } else {
      this.lines = [
        '═══ COMMAND INTERFACE ═══',
        `User: Riley Chen (Cook)`,
        '',
        '> _',
      ]
    }
  }

  renderScreen() {
    const ctx = this.screenContext

    // Clear with background color
    ctx.fillStyle = '#1a2744'
    ctx.fillRect(0, 0, this.screenWidth, this.screenHeight)

    // Add subtle scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    for (let y = 0; y < this.screenHeight; y += 2) {
      ctx.fillRect(0, y, this.screenWidth, 1)
    }

    // Render text
    ctx.font = '16px "JetBrains Mono", "Fira Code", monospace'
    ctx.fillStyle = '#d0d0d0'

    const lineHeight = 20
    const padding = 20

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i] ?? ''
      const y = padding + (i + 1) * lineHeight

      // Syntax highlighting for keywords
      if (line.includes('═') || line.includes('─')) {
        ctx.fillStyle = '#4a6fa5'
      } else if (line.includes('✓')) {
        ctx.fillStyle = '#77dd77'
      } else if (line.includes('⚠') || line.includes('WARNING')) {
        ctx.fillStyle = '#ffb347'
      } else if (line.includes('✗') || line.includes('ERROR') || line.includes('CRITICAL')) {
        ctx.fillStyle = '#ff6b6b'
      } else if (line.startsWith('>')) {
        ctx.fillStyle = '#77dd77'
      } else if (line.startsWith('  ')) {
        ctx.fillStyle = '#9ca3af'
      } else {
        ctx.fillStyle = '#d0d0d0'
      }

      ctx.fillText(line, padding, y)
    }

    // Update texture
    this.screenTexture.needsUpdate = true
  }

  // Update screen content (called for STATUS terminals to reflect state)
  updateFromState() {
    const type = this.definition.properties.terminal_type
    if (type !== 'STATUS') return

    const location = this.definition.properties.location
    const state = this.runtime.getState(location)

    if (state) {
      const o2 = state.values['o2_level']?.toFixed(1) ?? '??'
      const temp = state.values['temperature']?.toFixed(1) ?? '??'
      const pressure = state.values['pressure']?.toFixed(2) ?? '??'

      const o2Status = parseFloat(o2) < 16 ? '✗' : parseFloat(o2) < 19 ? '⚠' : '✓'
      const o2Color = parseFloat(o2) < 16 ? 'CRITICAL' : parseFloat(o2) < 19 ? 'WARNING' : 'NOMINAL'

      this.lines = [
        `═══ ${this.definition.properties.display_name} ═══`,
        '',
        'ENVIRONMENTAL STATUS',
        '────────────────────',
        '',
        `  O2 Level:    ${o2}%  ${o2Status}`,
        `  Temperature: ${temp}°C ✓`,
        `  Pressure:    ${pressure}atm ✓`,
        '',
        '────────────────────',
        `System Status: ${o2Color}`,
      ]
      this.renderScreen()
    }
  }

  // Set screen content for code editing
  setCodeContent(filename: string, code: string, errors: string[] = []) {
    const lines = code.split('\n')
    this.lines = [
      `═══ ENGINEERING WORKSTATION ═══`,
      `File: ${filename}`,
      '────────────────────────────────',
    ]

    // Add line numbers
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const lineNum = String(i + 1).padStart(3, ' ')
      this.lines.push(`${lineNum}│ ${lines[i]}`)
    }

    if (lines.length > 12) {
      this.lines.push(`   │ ... (${lines.length - 12} more lines)`)
    }

    this.lines.push('────────────────────────────────')

    if (errors.length > 0) {
      this.lines.push('ERRORS:')
      for (const error of errors.slice(0, 2)) {
        this.lines.push(`  ${error}`)
      }
    } else {
      this.lines.push('Status: Ready')
    }

    this.lines.push('')
    this.lines.push('[Ctrl+S] Save  [Esc] Exit')

    this.renderScreen()
  }

  update(deltaTime: number) {
    // Periodic state updates for status terminals
    if (this.definition.properties.terminal_type === 'STATUS') {
      this.updateFromState()
    }
  }

  focus() {
    this.isFocused = true
    // Change emissive to indicate focus
    const material = this.screenMesh.material as THREE.MeshStandardMaterial
    material.emissiveIntensity = 0.8
  }

  unfocus() {
    this.isFocused = false
    const material = this.screenMesh.material as THREE.MeshStandardMaterial
    material.emissiveIntensity = 0.5
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose()
        }
      }
    })
    this.screenTexture.dispose()
  }
}
