// Main Game Class - Orchestrates all game systems

import * as THREE from 'three'
import { SceneManager } from './SceneManager'
import { PlayerSystem } from './PlayerSystem'
import { InteractionSystem } from './Interaction'
import { CameraSystem } from './CameraSystem'
import { InputEventSystem } from './InputEventSystem'
import { PositionSyncSystem } from './PositionSyncSystem'
import { Runtime } from '../runtime/Runtime'
import { RuntimeForgeBridge } from '../runtime/RuntimeForgeBridge'
import type { ShipLayout } from '../types/layout'
import { audioSystem } from './AudioSystem'
import { VOXEL_SIZE } from '../voxel/VoxelTypes'
import { Config } from '../forge/ConfigRegistry'
import { compileLayout } from '../forge'
import { GameRunner, type GameConfig } from './GameRunner'
import { loadAnimatedAssetsFromGameRoot } from '../voxel/AnimatedAssetLoader'
import { Forge2GameMode } from './Forge2GameMode'

// Asset files for different games
// TODO: Move to game config or discover automatically
const GAME_ASSETS: Record<string, string[]> = {
  pong: ['arena.asset.forge', 'ball.asset.forge', 'paddle.asset.forge'],
}

export interface GameOptions {
  gameRoot?: string // Default: from URL ?game= param or 'galley'
}

export class Game {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: SceneManager
  private player: PlayerSystem | null = null
  private cameraSystem: CameraSystem | null = null
  private inputEventSystem: InputEventSystem | null = null
  private positionSyncSystem: PositionSyncSystem | null = null
  private interaction: InteractionSystem | null = null
  private runtime: Runtime
  private bridge: RuntimeForgeBridge
  private gameRunner: GameRunner
  private gameConfig: GameConfig | null = null
  private gameRoot: string
  private forge2Mode: Forge2GameMode | null = null

  private clock = new THREE.Clock()
  private running = false

  // UI elements
  private warningOverlay: HTMLElement | null = null
  private gameOverOverlay: HTMLElement | null = null
  private victoryOverlay: HTMLElement | null = null

  // Victory tracking
  private hasReachedCorridor = false

  constructor(container: HTMLElement, options: GameOptions = {}) {
    this.container = container

    // Determine game root from options, URL param, or default
    this.gameRoot = options.gameRoot || this.getGameRootFromURL() || 'galley'
    console.log(`[Game] Loading game from: /game/${this.gameRoot}`)

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
    this.scene = new SceneManager(this.runtime)

    // Player and interaction systems are created later based on controller type
  }

  /**
   * Get game root from URL query parameter (?game=pong)
   */
  private getGameRootFromURL(): string | null {
    const params = new URLSearchParams(window.location.search)
    return params.get('game')
  }

  async init() {
    console.log('=== GAME INIT START ===')

    // Check for Forge 2.0 game first (.f2 files)
    const isForge2 = await this.isForge2Game()
    if (isForge2) {
      console.log(`[Game] Detected Forge 2.0 game: ${this.gameRoot}`)
      const aspect = this.container.clientWidth / this.container.clientHeight
      await this.initForge2Mode(aspect)

      // Create UI overlays
      this.createWarningOverlay()
      this.createGameOverOverlay()
      this.createVictoryOverlay()

      console.log('Game initialized successfully (Forge 2.0 mode)')
      return
    }

    // Load Forge scripting files first (configs, rules, scenarios, behaviors, game definitions)
    await this.bridge.loadForgeFiles()

    // Load all forge files from game directory
    await this.loadGameForgeFiles()

    // Find and load game definition from game root
    const gameFiles = await this.findGameFiles()
    if (gameFiles.gameFile) {
      await this.gameRunner.loadGameFile(gameFiles.gameFile)
    }

    // Start the game and get configuration
    // Try to find game by name matching gameRoot, or use first available
    const gameNames = this.gameRunner.getGameNames()
    const gameName = gameNames.find(n => n.includes(this.gameRoot)) || gameNames[0]

    if (gameName) {
      this.gameConfig = this.gameRunner.startGame(gameName)
    }

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
    console.log('Controller type:', this.gameConfig.player.controller)

    // Set up camera and input based on controller type
    const isFixedCamera = this.gameConfig.player.controller === 'fixed_camera'
    const aspect = this.container.clientWidth / this.container.clientHeight

    if (isFixedCamera) {
      // Fixed camera mode (e.g., Pong)
      await this.initFixedCameraMode(aspect)
    } else {
      // First person mode (e.g., Galley)
      await this.initFirstPersonMode()
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

    // Subscribe to atmosphere events (only for first person games)
    if (!isFixedCamera) {
      this.setupAtmosphereEvents()
    }

    // Create warning overlay UI
    this.createWarningOverlay()
    this.createGameOverOverlay()
    this.createVictoryOverlay()

    console.log('Game initialized successfully')
  }

  /**
   * Check if this is a Forge 2.0 game (has a .f2 file)
   */
  private async isForge2Game(): Promise<boolean> {
    const f2Path = `/game/${this.gameRoot}/${this.gameRoot}.f2`
    console.log(`[Game] Checking for Forge 2.0 game: ${f2Path}`)
    try {
      // Use GET instead of HEAD for better compatibility
      const response = await fetch(f2Path)
      console.log(`[Game] Forge 2.0 check response: ${response.status}`)
      return response.ok
    } catch (e) {
      console.log(`[Game] Forge 2.0 check failed:`, e)
      return false
    }
  }

  /**
   * Initialize Forge 2.0 game mode
   */
  private async initForge2Mode(aspect: number): Promise<void> {
    console.log('[Game] Initializing Forge 2.0 mode')

    // Create Forge 2.0 game mode with the scene
    this.forge2Mode = new Forge2GameMode(this.scene.scene)

    // Set up input listeners
    this.forge2Mode.setupInputListeners(this.container)

    // Create camera (orthographic, top-down for Pong-style games)
    this.cameraSystem = new CameraSystem({
      type: 'orthographic',
      position: { x: 0, y: 15, z: 0 },
      lookAt: { x: 0, y: 0, z: 0 },
      viewSize: 14,
    }, aspect)

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
    this.scene.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 10, 5)
    directionalLight.castShadow = true
    this.scene.scene.add(directionalLight)

    // Load the game
    const gamePath = `/game/${this.gameRoot}/${this.gameRoot}.f2`
    await this.forge2Mode.loadGame(gamePath)

    // Set up event handlers for game lifecycle
    this.forge2Mode.on('game:victory', (data) => {
      console.log('[Game] Victory!', data)
      this.showVictory()
    })

    this.forge2Mode.on('game:defeat', (data) => {
      console.log('[Game] Defeat!', data)
      this.showGameOver()
    })
  }

  /**
   * Find game files in the game root directory
   */
  private async findGameFiles(): Promise<{ gameFile: string | null }> {
    // Try to find *.game.forge in game root
    const possiblePaths = [
      `/game/${this.gameRoot}/${this.gameRoot}.game.forge`,
      `/game/forge/${this.gameRoot}.game.forge`,
    ]

    for (const path of possiblePaths) {
      try {
        const response = await fetch(path, { method: 'HEAD' })
        if (response.ok) {
          return { gameFile: path }
        }
      } catch {
        // Continue to next path
      }
    }

    return { gameFile: null }
  }

  /**
   * Load all forge files from the game directory
   */
  private async loadGameForgeFiles(): Promise<void> {
    // For now, try to load common forge files from the game directory
    const forgeFiles = [
      `/game/${this.gameRoot}/${this.gameRoot}.scenario.forge`,
      `/game/${this.gameRoot}/${this.gameRoot}.rules.forge`,
      `/game/${this.gameRoot}/${this.gameRoot}.conditions.forge`,
    ]

    for (const path of forgeFiles) {
      try {
        const response = await fetch(path)
        if (response.ok) {
          const source = await response.text()
          this.bridge.vm.loadSource(source)
          console.log(`[Game] Loaded ${path}`)
        }
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  /**
   * Initialize fixed camera mode (orthographic, no player movement)
   */
  private async initFixedCameraMode(aspect: number): Promise<void> {
    console.log('[Game] Initializing fixed camera mode')

    // Create camera from config (with defaults)
    const gameCamera = this.gameConfig!.camera
    const cameraConfig = {
      type: gameCamera?.type || 'orthographic' as const,
      position: gameCamera?.position || { x: 0, y: 15, z: 0 },
      lookAt: gameCamera?.lookAt || { x: 0, y: 0, z: 0 },
      fov: gameCamera?.fov,
      viewSize: gameCamera?.viewSize || 14,
    }

    this.cameraSystem = new CameraSystem(cameraConfig, aspect)

    // Set up input event system for fixed camera games
    this.inputEventSystem = new InputEventSystem(this.bridge.vm)

    // Set scene reference for VM callbacks
    this.bridge.setScene(this.scene)

    // Load Forge entity definitions (assets)
    await this.scene.loadForgeEntities()

    // Load game-specific assets if defined
    const gameAssets = GAME_ASSETS[this.gameRoot]
    if (gameAssets) {
      await loadAnimatedAssetsFromGameRoot(`/game/${this.gameRoot}`, gameAssets)
    }

    // Load game-specific scripts (rules, scenario, conditions)
    await this.bridge.loadGameScripts(`/game/${this.gameRoot}`)

    // Load layout if specified
    if (this.gameConfig!.layout) {
      const layoutPath = `/game/${this.gameConfig!.layout}`
      try {
        const layoutResponse = await fetch(layoutPath)
        if (layoutResponse.ok) {
          if (layoutPath.endsWith('.forge')) {
            const layoutSource = await layoutResponse.text()
            const compiledLayout = compileLayout(layoutSource, layoutPath)
            if (compiledLayout) {
              this.runtime.setLayout(compiledLayout)
              await this.scene.buildFromLayout(compiledLayout, this.gameRoot)
            }
          } else {
            const layout = await layoutResponse.json() as ShipLayout
            this.runtime.setLayout(layout)
            await this.scene.buildFromLayout(layout, this.gameRoot)
          }
        }
      } catch (e) {
        console.warn(`[Game] Failed to load layout: ${layoutPath}`)
      }
    }

    // Set up position sync if configured
    if (this.gameConfig!.sync) {
      this.positionSyncSystem = new PositionSyncSystem(this.bridge.vm)

      // Register synced entities
      for (const [entityName, statePath] of Object.entries(this.gameConfig!.sync.entries)) {
        const instance = this.scene.getAssetInstance(entityName)
        if (instance) {
          this.positionSyncSystem.register(entityName, instance.group, statePath)
          console.log(`[Game] Registered sync: ${entityName} -> ${statePath}`)
        } else {
          console.warn(`[Game] Could not find entity for sync: ${entityName}`)
        }
      }
    }

    // Start scenario if specified
    if (this.gameConfig!.scenario) {
      this.bridge.startScenario(this.gameConfig!.scenario)
    }
  }

  /**
   * Initialize first person mode (perspective camera, player movement)
   */
  private async initFirstPersonMode(): Promise<void> {
    console.log('[Game] Initializing first person mode')

    // Create player with config from Forge
    this.player = new PlayerSystem({
      moveSpeed: Config.player.movement.walkSpeed,
      lookSensitivity: Config.player.movement.lookSensitivity,
      fov: Config.player.camera.fov,
      near: Config.player.camera.near,
      far: Config.player.camera.far,
      maxPitch: Config.player.camera.maxPitch,
      height: Config.player.collision.height,
      radius: Config.player.collision.radius,
      keys: {
        forward: ['KeyW'],
        backward: ['KeyS'],
        left: ['KeyA'],
        right: ['KeyD'],
      },
    })

    // Create interaction system
    this.interaction = new InteractionSystem(this.player, this.scene, this.runtime)

    // Load layout data from game/ directory
    let layout: ShipLayout
    const layoutPath = `/game/${this.gameConfig!.layout}`

    if (layoutPath.endsWith('.forge')) {
      const layoutResponse = await fetch(layoutPath)
      if (!layoutResponse.ok) {
        throw new Error(`Failed to load layout: ${layoutPath}`)
      }
      const layoutSource = await layoutResponse.text()
      const compiledLayout = compileLayout(layoutSource, layoutPath)
      if (!compiledLayout) {
        throw new Error(`Failed to compile layout: ${layoutPath}`)
      }
      layout = compiledLayout
    } else {
      const layoutResponse = await fetch(layoutPath)
      if (!layoutResponse.ok) {
        throw new Error(`Failed to load layout: ${layoutPath}`)
      }
      layout = await layoutResponse.json() as ShipLayout
    }

    this.runtime.setLayout(layout)

    // Load ship definition from game/ directory
    const shipPath = `/game/ships/${this.gameConfig!.ship}/${this.gameConfig!.ship}.sl`
    const shipResponse = await fetch(shipPath)
    if (!shipResponse.ok) {
      throw new Error(`Failed to load ship definition: ${shipPath}`)
    }
    const shipSource = await shipResponse.text()

    // Compile ship definition (StarLang code player can edit)
    const result = await this.runtime.init(shipSource)

    if (!result.success) {
      console.error('Failed to compile ship:', result.errors)
      throw new Error('Ship compilation failed: ' + result.errors.map(e => e.message).join(', '))
    }

    // Load Forge entity definitions
    await this.scene.loadForgeEntities()

    // Load game-specific scripts (rules, scenario, conditions)
    await this.bridge.loadGameScripts(`/game/${this.gameRoot}`)

    // Set scene reference for VM callbacks (animations, state changes)
    this.bridge.setScene(this.scene)

    // Build voxel world from layout (tries pre-built mesh first)
    await this.scene.buildFromLayout(layout, this.gameConfig!.ship)

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
    this.runtime.loadFile(`${this.gameConfig!.ship}.sl`, shipSource)

    // Set player starting position from game config
    const spawn = this.gameConfig!.player.spawnPosition
    this.player.setPosition(spawn.x, spawn.y, spawn.z)

    // Debug: check spawn collision
    this.player.debugCollision('SPAWN')

    // Set initial O2 levels (start slightly low to create urgency)
    this.runtime.setProperty('galley.o2_level', Config.gameRules.initialO2Level, 'SYSTEM')

    // Set initial player room from game config
    this.runtime.setPlayerRoom(this.gameConfig!.player.spawnRoom)

    // Start the scenario from game config
    if (this.gameConfig!.scenario) {
      this.bridge.startScenario(this.gameConfig!.scenario)
    }

    // Update collision objects
    this.updateCollision()
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
    this.player?.unlock() // Release pointer lock (only in first person mode)
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

    // Reset player position (only in first person mode)
    this.player?.setPosition(0, 0, 0)
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
    this.player?.unlock()
  }

  private updateCollision() {
    if (!this.player) return // No collision in fixed camera mode
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

    // Get active camera
    const camera = this.getActiveCamera()

    // Forge 2.0 mode - simple game loop
    if (this.forge2Mode) {
      this.forge2Mode.tick(deltaTime)
      this.scene.update(deltaTime)
      this.renderer.render(this.scene.scene, camera)
      return
    }

    if (this.player) {
      // First person mode
      this.updatePlayerRoom()

      // Update audio listener position
      const cameraDirection = new THREE.Vector3()
      this.player.camera.getWorldDirection(cameraDirection)
      audioSystem.updateListener(this.player.camera.position, cameraDirection)

      // Update systems
      this.player.update(deltaTime)
      this.interaction?.update()
    }

    // Update scene
    this.scene.update(deltaTime)

    // Update position sync (for fixed camera games)
    this.positionSyncSystem?.update()

    // Use bridge.tick() instead of runtime.tick()
    // Bridge handles ForgeVM execution (rules, victory conditions)
    // and syncs state between Runtime and ForgeVM
    this.bridge.tick(deltaTime)

    // Render
    this.renderer.render(this.scene.scene, camera)
  }

  /**
   * Get the active camera (player camera or fixed camera)
   */
  private getActiveCamera(): THREE.Camera {
    if (this.player) {
      return this.player.camera
    }
    if (this.cameraSystem) {
      return this.cameraSystem.camera
    }
    throw new Error('No camera available')
  }

  private updatePlayerRoom() {
    if (!this.player) return // Only for first person mode

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

    if (this.player) {
      this.player.resize(width, height)
    }
    if (this.cameraSystem) {
      this.cameraSystem.resize(width, height)
    }
  }

  dispose() {
    this.running = false
    this.gameRunner.stopGame()
    this.bridge.dispose()
    this.forge2Mode?.dispose()
    this.scene.dispose()
    this.player?.dispose()
    this.interaction?.dispose()
    this.inputEventSystem?.dispose()
    this.renderer.dispose()
    audioSystem.dispose()
    this.container.removeChild(this.renderer.domElement)
  }
}
