// In-World Terminal - 3D terminal with screen texture

import * as THREE from 'three'
import type { TerminalDefinition, TerminalType } from '../../types/nodes'
import { Runtime } from '../../runtime/Runtime'
import { VOXEL_SIZE } from '../../voxel/VoxelTypes'

// Engineering terminal startup message
const ENGINEERING_MESSAGE = [
  '═══ ENGINEERING TERMINAL ═══',
  '',
  'System Status: DEGRADED',
  'AI Core: OFFLINE',
  '',
  'Ship configuration loaded.',
  '',
  '─────────────────────────────────',
]

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

  // Status update timer (for polling state)
  private updateTimer = 0
  private updateInterval = 1.0 // seconds

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
      side: THREE.DoubleSide, // Visible from both sides during debugging
    })
    this.screenMesh = new THREE.Mesh(screenGeometry, screenMaterial)

    // Position screen based on terminal type
    // PlaneGeometry faces +Z by default, but we need it to face toward the player
    // The terminal group is rotated, so we position in local coordinates
    if (definition.properties.terminal_type === 'ENGINEERING') {
      // Voxel workstation monitor is at:
      // - Y: 48-76 voxels, center at 62 voxels = 1.55m
      // - Z: offsetZ=8, front face at ~6 voxels = 0.15m from terminal center
      // Screen should face -Z (toward player after terminal rotation is applied)
      this.screenMesh.position.set(0, 1.55, 0.16)
      this.screenMesh.rotation.y = Math.PI // Face -Z (toward player)
    } else {
      // Wall panel - screen faces outward from wall
      this.screenMesh.position.set(0, 1.2, 0.051)
    }
    this.group.add(this.screenMesh)

    // Position terminal (convert voxel coords to world coords)
    const { position, rotation } = definition.properties
    this.group.position.set(
      position.x * VOXEL_SIZE,
      position.y * VOXEL_SIZE,
      position.z * VOXEL_SIZE
    )
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

  private buildWorkstation(_material: THREE.Material) {
    // Desk, legs, stand, frame, and keyboard are now voxels in the pre-built mesh.
    // Only the dynamic screen (canvas texture) is created here.
    // This method is kept for compatibility but no longer creates geometry.
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
      this.lines = [...ENGINEERING_MESSAGE]
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
      } else if (line.includes('EMERGENCY') || line.includes('malfunction')) {
        ctx.fillStyle = '#ff8866'
      } else if (line.includes('locked: true') || line.includes('← Change')) {
        ctx.fillStyle = '#77dd77' // Highlight the solution
      } else if (line.includes('Press E') || line.includes('Ctrl+S')) {
        ctx.fillStyle = '#77aaff' // Controls
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

      // O2 status: < 16% critical, < 19% warning
      const o2Val = parseFloat(o2)
      const o2Status = o2Val < 16 ? '✗ CRITICAL' : o2Val < 19 ? '⚠ LOW' : '✓'

      // Temperature status: < 15°C or > 30°C warning, < 5°C or > 40°C critical
      const tempVal = parseFloat(temp)
      const tempStatus = (tempVal < 5 || tempVal > 40) ? '✗ CRITICAL' :
                         (tempVal < 15 || tempVal > 30) ? '⚠ WARN' : '✓'

      // Pressure status: < 0.8 or > 1.2 warning, < 0.5 or > 1.5 critical
      const pressVal = parseFloat(pressure)
      const pressStatus = (pressVal < 0.5 || pressVal > 1.5) ? '✗ CRITICAL' :
                          (pressVal < 0.8 || pressVal > 1.2) ? '⚠ WARN' : '✓'

      // Overall status
      const hasCritical = o2Val < 16 || tempVal < 5 || tempVal > 40 || pressVal < 0.5 || pressVal > 1.5
      const hasWarning = o2Val < 19 || tempVal < 15 || tempVal > 30 || pressVal < 0.8 || pressVal > 1.2
      const overallStatus = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'NOMINAL'

      this.lines = [
        `═══ ${this.definition.properties.display_name} ═══`,
        '',
        'ENVIRONMENTAL STATUS',
        '────────────────────',
        '',
        `  O2 Level:    ${o2.padStart(5)}%  ${o2Status}`,
        `  Temperature: ${temp.padStart(5)}°C ${tempStatus}`,
        `  Pressure:    ${pressure.padStart(5)}atm ${pressStatus}`,
        '',
        '────────────────────',
        `System Status: ${overallStatus}`,
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
    // Periodic state updates for status terminals (every 1 second)
    if (this.definition.properties.terminal_type === 'STATUS') {
      this.updateTimer += deltaTime
      if (this.updateTimer >= this.updateInterval) {
        this.updateTimer = 0
        this.updateFromState()
      }
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
