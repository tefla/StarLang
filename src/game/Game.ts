// Main Game Class - Orchestrates all game systems

import * as THREE from 'three'
import { ShipScene } from './scene/ShipScene'
import { PlayerController } from './player/PlayerController'
import { InteractionSystem } from './player/Interaction'
import { Runtime } from '../runtime/Runtime'
import { GALLEY_SHIP } from '../content/ship/galley'

export class Game {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: ShipScene
  private player: PlayerController
  private interaction: InteractionSystem
  private runtime: Runtime

  private clock = new THREE.Clock()
  private running = false

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
    // Load and compile ship definition
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

    // Set initial O2 levels
    this.runtime.setProperty('galley.o2_level', 18.2, 'SYSTEM')

    // Update collision objects
    this.updateCollision()

    console.log('Game initialized successfully')
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

    // Update systems
    this.player.update(deltaTime)
    this.scene.update(deltaTime)
    this.interaction.update()
    this.runtime.tick(deltaTime)

    // Render
    this.renderer.render(this.scene.scene, this.player.camera)
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
