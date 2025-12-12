// Main Game Class - Orchestrates all game systems

import * as THREE from 'three'
import { ShipScene } from './scene/ShipScene'
import { PlayerController } from './player/PlayerController'
import { InteractionSystem } from './player/Interaction'
import { Runtime } from '../runtime/Runtime'
import { GALLEY_SHIP } from '../content/ship/galley'
import { GALLEY_LAYOUT } from '../content/ship/galley.layout'

export class Game {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: ShipScene
  private player: PlayerController
  private interaction: InteractionSystem
  private runtime: Runtime

  private clock = new THREE.Clock()
  private running = false

  // UI elements
  private warningOverlay: HTMLElement | null = null
  private gameOverOverlay: HTMLElement | null = null
  private victoryOverlay: HTMLElement | null = null

  // Victory tracking
  private hasReachedCorridor = false

  constructor(container: HTMLElement) {
    this.container = container

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    // Create runtime
    this.runtime = new Runtime()

    // Create scene
    this.scene = new ShipScene(this.runtime)

    // Create player
    this.player = new PlayerController()

    // Create interaction system
    this.interaction = new InteractionSystem(this.player, this.scene, this.runtime)
  }

  async init() {
    // Set layout data (positions, sizes - hidden from player)
    this.runtime.setLayout(GALLEY_LAYOUT)

    // Load and compile ship definition (StarLang code player can edit)
    const result = await this.runtime.init(GALLEY_SHIP)

    if (!result.success) {
      console.error('Failed to compile ship:', result.errors)
      throw new Error('Ship compilation failed: ' + result.errors.map(e => e.message).join(', '))
    }

    // Build 3D scene from compiled structure
    const structure = this.runtime.getStructure()
    if (structure) {
      this.scene.buildFromStructure(structure)
    }

    // Load ship files for editing
    this.runtime.loadFile('galley.sl', GALLEY_SHIP)

    // Set player starting position (inside galley)
    this.player.setPosition(0, 0, 0)

    // Set initial O2 levels (start slightly low to create urgency)
    this.runtime.setProperty('galley.o2_level', 19.5, 'SYSTEM')

    // Set initial player room
    this.runtime.setPlayerRoom('galley')

    // Subscribe to atmosphere events
    this.setupAtmosphereEvents()

    // Update collision objects
    this.updateCollision()

    // Create warning overlay UI
    this.createWarningOverlay()
    this.createGameOverOverlay()
    this.createVictoryOverlay()

    console.log('Game initialized successfully')
  }

  private setupAtmosphereEvents() {
    this.runtime.on('atmosphere:warning', (event) => {
      this.showWarning(`⚠ WARNING: O2 levels low (${event.o2Level.toFixed(1)}%)`)
    })

    this.runtime.on('atmosphere:critical', (event) => {
      this.showWarning(`🚨 CRITICAL: O2 at ${event.o2Level.toFixed(1)}% - Find breathable air!`, true)
    })

    this.runtime.on('game:over', (event) => {
      this.showGameOver()
    })

    // Update collision when doors open/close
    this.runtime.on('door:open', () => {
      this.updateCollision()
    })

    this.runtime.on('door:close', () => {
      this.updateCollision()
    })
  }

  private createWarningOverlay() {
    this.warningOverlay = document.createElement('div')
    this.warningOverlay.id = 'atmosphere-warning'
    this.warningOverlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 50, 50, 0.9);
      color: white;
      padding: 15px 30px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
      z-index: 1000;
      display: none;
      text-align: center;
      box-shadow: 0 4px 20px rgba(255, 0, 0, 0.5);
    `
    document.body.appendChild(this.warningOverlay)
  }

  private createGameOverOverlay() {
    this.gameOverOverlay = document.createElement('div')
    this.gameOverOverlay.id = 'game-over'
    this.gameOverOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      font-family: 'JetBrains Mono', monospace;
      z-index: 2000;
    `
    this.gameOverOverlay.innerHTML = `
      <h1 style="font-size: 48px; color: #ff4444; margin-bottom: 20px;">OXYGEN DEPLETED</h1>
      <p style="font-size: 20px; color: #888; margin-bottom: 40px;">You succumbed to hypoxia.</p>
      <button id="restart-btn" style="
        background: #ff4444;
        border: none;
        padding: 15px 40px;
        font-size: 18px;
        color: white;
        cursor: pointer;
        font-family: 'JetBrains Mono', monospace;
        border-radius: 4px;
      ">RESTART</button>
    `
    document.body.appendChild(this.gameOverOverlay)

    // Add restart handler
    const restartBtn = this.gameOverOverlay.querySelector('#restart-btn')
    restartBtn?.addEventListener('click', () => this.restartGame())
  }

  private showWarning(message: string, critical = false) {
    if (!this.warningOverlay) return

    this.warningOverlay.textContent = message
    this.warningOverlay.style.display = 'block'
    this.warningOverlay.style.background = critical
      ? 'rgba(200, 0, 0, 0.95)'
      : 'rgba(255, 150, 50, 0.9)'

    // Hide after a few seconds (unless critical)
    if (!critical) {
      setTimeout(() => {
        if (this.warningOverlay) this.warningOverlay.style.display = 'none'
      }, 5000)
    }
  }

  private showGameOver() {
    if (!this.gameOverOverlay) return
    this.gameOverOverlay.style.display = 'flex'
    this.player.unlock() // Release pointer lock
  }

  private restartGame() {
    // Reset game state
    this.runtime.resetGame()
    this.runtime.setProperty('galley.o2_level', 19.5, 'SYSTEM')
    this.hasReachedCorridor = false

    // Hide overlays
    if (this.warningOverlay) this.warningOverlay.style.display = 'none'
    if (this.gameOverOverlay) this.gameOverOverlay.style.display = 'none'
    if (this.victoryOverlay) this.victoryOverlay.style.display = 'none'

    // Reset player position
    this.player.setPosition(0, 0, 0)
  }

  private createVictoryOverlay() {
    this.victoryOverlay = document.createElement('div')
    this.victoryOverlay.id = 'victory-overlay'
    this.victoryOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 20, 40, 0.95);
      color: white;
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      font-family: 'JetBrains Mono', monospace;
      z-index: 2000;
    `
    this.victoryOverlay.innerHTML = `
      <h1 style="font-size: 48px; color: #77dd77; margin-bottom: 20px;">ESCAPE SUCCESSFUL</h1>
      <p style="font-size: 20px; color: #9ca3af; margin-bottom: 10px; max-width: 600px; text-align: center;">
        You've escaped the galley and reached the corridor.
      </p>
      <p style="font-size: 16px; color: #666; margin-bottom: 40px;">
        Act 1 Complete - More to explore ahead...
      </p>
      <button id="continue-btn" style="
        background: #77dd77;
        border: none;
        padding: 15px 40px;
        font-size: 18px;
        color: #1a2744;
        cursor: pointer;
        font-family: 'JetBrains Mono', monospace;
        border-radius: 4px;
      ">CONTINUE EXPLORING</button>
    `
    document.body.appendChild(this.victoryOverlay)

    // Add continue handler
    const continueBtn = this.victoryOverlay.querySelector('#continue-btn')
    continueBtn?.addEventListener('click', () => {
      if (this.victoryOverlay) this.victoryOverlay.style.display = 'none'
    })
  }

  private showVictory() {
    if (!this.victoryOverlay || this.hasReachedCorridor) return
    this.hasReachedCorridor = true
    this.victoryOverlay.style.display = 'flex'
    this.player.unlock()
  }

  private updateCollision() {
    const collisionObjects = this.scene.getCollisionObjects()
    this.player.setCollisionObjects(collisionObjects)
  }

  start() {
    this.running = true
    this.clock.start()
    this.animate()
  }

  stop() {
    this.running = false
  }

  private animate = () => {
    if (!this.running) return
    requestAnimationFrame(this.animate)

    const deltaTime = this.clock.getDelta()

    // Update player room based on position
    this.updatePlayerRoom()

    // Update systems
    this.player.update(deltaTime)
    this.scene.update(deltaTime)
    this.interaction.update()
    this.runtime.tick(deltaTime)

    // Render
    this.renderer.render(this.scene.scene, this.player.camera)
  }

  private updatePlayerRoom() {
    const structure = this.runtime.getStructure()
    if (!structure) return

    const playerPos = this.player.camera.position

    // Check which room the player is in
    for (const [roomId, room] of structure.rooms) {
      const { position, size } = room.properties
      const halfWidth = size.width / 2
      const halfDepth = size.depth / 2

      // Check if player is within room bounds
      if (
        playerPos.x >= position.x - halfWidth &&
        playerPos.x <= position.x + halfWidth &&
        playerPos.z >= position.z - halfDepth &&
        playerPos.z <= position.z + halfDepth
      ) {
        const previousRoom = this.runtime.getPlayerRoom()
        if (previousRoom !== roomId) {
          this.runtime.setPlayerRoom(roomId)

          // Victory condition: entered corridor from galley
          if (roomId === 'corridor' && previousRoom === 'galley' && !this.hasReachedCorridor) {
            this.showVictory()
          }
        }
        return
      }
    }
  }

  resize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight

    this.renderer.setSize(width, height)
    this.player.resize(width, height)
  }

  dispose() {
    this.running = false
    this.scene.dispose()
    this.player.dispose()
    this.interaction.dispose()
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
  }
}
