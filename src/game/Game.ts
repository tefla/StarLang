// Main Game Class - Orchestrates all game systems

import * as THREE from 'three'
import { ShipScene } from './scene/ShipScene'
import { PlayerController } from './player/PlayerController'
import { InteractionSystem } from './player/Interaction'
import { Runtime } from '../runtime/Runtime'
import { RuntimeForgeBridge } from '../runtime/RuntimeForgeBridge'
import { GALLEY_SHIP } from '../content/ship/galley'
import GALLEY_LAYOUT from '../content/ship/galley.layout.json'
import type { ShipLayout } from '../types/layout'
import { audioSystem } from './audio/AudioSystem'
import { VOXEL_SIZE } from '../voxel/VoxelTypes'
import { Config } from '../forge/ConfigRegistry'
import { GameRunner, type GameConfig } from '../engine/GameRunner'

export class Game {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: ShipScene
  private player: PlayerController
  private interaction: InteractionSystem
  private runtime: Runtime
  private bridge: RuntimeForgeBridge
  private gameRunner: GameRunner
  private gameConfig: GameConfig | null = null

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

    // Create RuntimeForgeBridge (wraps ForgeVM)
    this.bridge = new RuntimeForgeBridge(this.runtime)

    // Create GameRunner (loads game.forge definitions)
    this.gameRunner = new GameRunner(this.bridge.vm)

    // Create scene
    this.scene = new ShipScene(this.runtime)

    // Create player
    this.player = new PlayerController()

    // Create interaction system
    this.interaction = new InteractionSystem(this.player, this.scene, this.runtime)
  }

  async init() {
    console.log('=== GAME INIT START ===')

    // Load Forge scripting files first (configs, rules, scenarios, behaviors, game definitions)
    await this.bridge.loadForgeFiles()

    // Load game definition and start the game
    await this.gameRunner.loadGameFile('/content/forge/galley.game.forge')

    // Start the game and get configuration
    this.gameConfig = this.gameRunner.startGame('galley_escape')
    if (!this.gameConfig) {
      console.warn('Game definition not found, using defaults')
      // Fallback to hardcoded config
      this.gameConfig = {
        name: 'galley_escape',
        ship: 'galley',
        layout: 'ships/galley/galley.layout.json',
        scenario: 'galley_escape',
        player: {
          controller: 'first_person',
          spawnRoom: 'galley',
          spawnPosition: { x: 0, y: 0.1, z: 0 },
          collision: { type: 'cylinder', height: 1.6, radius: 0.35 },
        },
      }
    }

    console.log('Game config loaded:', this.gameConfig.name)

    // Set layout data (positions, sizes - hidden from player)
    // TODO: Load layout from gameConfig.layout path
    this.runtime.setLayout(GALLEY_LAYOUT as ShipLayout)

    // Load and compile ship definition (StarLang code player can edit)
    const result = await this.runtime.init(GALLEY_SHIP)

    if (!result.success) {
      console.error('Failed to compile ship:', result.errors)
      throw new Error('Ship compilation failed: ' + result.errors.map(e => e.message).join(', '))
    }

    // Load Forge entity definitions
    await this.scene.loadForgeEntities()

    // Set scene reference for VM callbacks (animations, state changes)
    this.bridge.setScene(this.scene)

    // Build voxel world from layout (tries pre-built mesh first)
    await this.scene.buildFromLayout(GALLEY_LAYOUT as ShipLayout, this.gameConfig.ship)

    // Pass voxel world to player for collision
    if (this.scene.voxelWorld) {
      this.player.setVoxelWorld(this.scene.voxelWorld)
    }

    // Build entity overlays from compiled structure
    const structure = this.runtime.getStructure()
    if (structure) {
      this.scene.buildFromStructure(structure)
    }

    // Load ship files for editing
    this.runtime.loadFile('galley.sl', GALLEY_SHIP)

    // Set player starting position from game config
    const spawn = this.gameConfig.player.spawnPosition
    this.player.setPosition(spawn.x, spawn.y, spawn.z)

    // Debug: check spawn collision
    this.player.debugCollision('SPAWN')

    // Set initial O2 levels (start slightly low to create urgency)
    // Note: This is also set by the scenario, but kept for fallback
    this.runtime.setProperty('galley.o2_level', Config.gameRules.initialO2Level, 'SYSTEM')

    // Set initial player room from game config
    this.runtime.setPlayerRoom(this.gameConfig.player.spawnRoom)

    // Start the scenario from game config
    if (this.gameConfig.scenario) {
      this.bridge.startScenario(this.gameConfig.scenario)
    }

    // Set up lifecycle handlers
    this.gameRunner.setHandlers({
      onVictory: () => this.showVictory(),
      onGameover: () => this.showGameOver(),
    })

    // Also listen for direct VM victory event (from conditions)
    this.bridge.vm.on('game:victory', () => {
      this.showVictory()
    })

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
      audioSystem.playWarningBeep(false)
    })

    this.runtime.on('atmosphere:critical', (event) => {
      audioSystem.playWarningBeep(true)
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
      background: ${Config.ui.gameover.background};
      color: white;
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      font-family: 'JetBrains Mono', monospace;
      z-index: 2000;
    `
    this.gameOverOverlay.innerHTML = `
      <h1 style="font-size: 48px; color: ${Config.ui.gameover.titleColor}; margin-bottom: 20px;">${Config.ui.gameover.title}</h1>
      <p style="font-size: 20px; color: #888; margin-bottom: 40px;">${Config.ui.gameover.subtitle}</p>
      <button id="restart-btn" style="
        background: ${Config.ui.gameover.buttonColor};
        border: none;
        padding: 15px 40px;
        font-size: 18px;
        color: white;
        cursor: pointer;
        font-family: 'JetBrains Mono', monospace;
        border-radius: 4px;
      ">${Config.ui.gameover.buttonText}</button>
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
      ? Config.ui.warning.colorCritical
      : Config.ui.warning.colorNormal

    // Hide after a few seconds (unless critical)
    if (!critical) {
      setTimeout(() => {
        if (this.warningOverlay) this.warningOverlay.style.display = 'none'
      }, Config.ui.warning.displayDuration)
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
    this.runtime.setProperty('galley.o2_level', Config.gameRules.initialO2Level, 'SYSTEM')
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
      background: ${Config.ui.victory.background};
      color: white;
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      font-family: 'JetBrains Mono', monospace;
      z-index: 2000;
    `
    this.victoryOverlay.innerHTML = `
      <h1 style="font-size: 48px; color: ${Config.ui.victory.titleColor}; margin-bottom: 20px;">${Config.ui.victory.title}</h1>
      <p style="font-size: 20px; color: #9ca3af; margin-bottom: 10px; max-width: 600px; text-align: center;">
        ${Config.ui.victory.subtitle}
      </p>
      <p style="font-size: 16px; color: #666; margin-bottom: 40px;">
        ${Config.ui.victory.note}
      </p>
      <button id="continue-btn" style="
        background: ${Config.ui.victory.buttonColor};
        border: none;
        padding: 15px 40px;
        font-size: 18px;
        color: #1a2744;
        cursor: pointer;
        font-family: 'JetBrains Mono', monospace;
        border-radius: 4px;
      ">${Config.ui.victory.buttonText}</button>
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

    // Update audio listener position
    const cameraDirection = new THREE.Vector3()
    this.player.camera.getWorldDirection(cameraDirection)
    audioSystem.updateListener(this.player.camera.position, cameraDirection)

    // Update systems
    this.player.update(deltaTime)
    this.scene.update(deltaTime)
    this.interaction.update()

    // Use bridge.tick() instead of runtime.tick()
    // Bridge handles ForgeVM execution (O2 depletion, victory conditions)
    // and syncs state between Runtime and ForgeVM
    this.bridge.tick(deltaTime)

    // Render
    this.renderer.render(this.scene.scene, this.player.camera)
  }

  private updatePlayerRoom() {
    const structure = this.runtime.getStructure()
    if (!structure) return

    const playerPos = this.player.camera.position

    // Check which room the player is in
    // Layout coordinates are in voxels, convert to world units
    for (const [roomId, room] of structure.rooms) {
      const { position, size } = room.properties
      // Convert voxel coordinates to world coordinates
      const centerX = position.x * VOXEL_SIZE
      const centerZ = position.z * VOXEL_SIZE
      const halfWidth = (size.width / 2) * VOXEL_SIZE
      const halfDepth = (size.depth / 2) * VOXEL_SIZE

      // Check if player is within room bounds
      if (
        playerPos.x >= centerX - halfWidth &&
        playerPos.x <= centerX + halfWidth &&
        playerPos.z >= centerZ - halfDepth &&
        playerPos.z <= centerZ + halfDepth
      ) {
        const previousRoom = this.runtime.getPlayerRoom()
        if (previousRoom !== roomId) {
          this.runtime.setPlayerRoom(roomId)
          // Victory is now handled by ForgeVM conditions (galley_escape.condition.forge)
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
    this.gameRunner.stopGame()
    this.bridge.dispose()
    this.scene.dispose()
    this.player.dispose()
    this.interaction.dispose()
    this.renderer.dispose()
    audioSystem.dispose()
    this.container.removeChild(this.renderer.domElement)
  }
}
