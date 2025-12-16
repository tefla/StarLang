// Interaction System - Handles player interactions with objects

import * as THREE from 'three'
import { PlayerController } from './PlayerController'
import { ShipScene } from '../scene/ShipScene'
import { ScreenEntity } from '../../engine/EntitySystem'
import { Runtime } from '../../runtime/Runtime'
import { audioSystem } from '../audio/AudioSystem'
import { VoxelRaycast } from '../../voxel/VoxelRaycast'
import { VoxelType, VOXEL_SIZE } from '../../voxel/VoxelTypes'
import { Config } from '../../forge/ConfigRegistry'

export type InteractionTarget = {
  type: string  // Validated against interactions.interactable_types config
  id: string
  object: THREE.Object3D
  distance: number
}

export class InteractionSystem {
  private player: PlayerController
  private scene: ShipScene
  private runtime: Runtime

  private currentTarget: InteractionTarget | null = null
  private get interactionRange() { return Config.player.interaction.range }
  private focusedTerminal: ScreenEntity | null = null

  // UI elements
  private crosshair: HTMLElement | null = null
  private prompt: HTMLElement | null = null
  private editorOverlay: HTMLElement | null = null
  private editorTextarea: HTMLTextAreaElement | null = null
  private editorFilename: HTMLElement | null = null
  private editorStatus: HTMLElement | null = null
  private editorErrors: HTMLElement | null = null

  // Code editing state
  private isEditingCode = false
  private currentCode = ''
  private currentFile = ''

  constructor(player: PlayerController, scene: ShipScene, runtime: Runtime) {
    this.player = player
    this.scene = scene
    this.runtime = runtime

    this.crosshair = document.getElementById('crosshair')
    this.prompt = document.getElementById('interaction-prompt')
    this.editorOverlay = document.getElementById('code-editor-overlay')
    this.editorTextarea = document.getElementById('code-editor-textarea') as HTMLTextAreaElement
    this.editorFilename = document.getElementById('code-editor-filename')
    this.editorStatus = document.getElementById('code-editor-status')
    this.editorErrors = document.getElementById('code-editor-errors')

    this.setupEventListeners()
  }

  private setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !this.isEditingCode) {
        this.interact()
      }

      if (e.code === 'Escape') {
        this.exitFocus()
      }

      // Handle Ctrl+S for save in editor
      if (this.isEditingCode && e.ctrlKey && e.code === 'KeyS') {
        e.preventDefault()
        this.saveCode()
      }
    })
  }

  update() {
    if (this.focusedTerminal) {
      // Don't update targeting while focused
      return
    }

    // First check for voxel-based switches via voxel raycast
    const switchTarget = this.checkVoxelSwitch()
    if (switchTarget) {
      this.currentTarget = switchTarget
      this.showInteractionPrompt()
      this.setCrosshairInteractive(true)
      return
    }

    // Raycast to find what player is looking at (mesh-based objects)
    const interactables = this.scene.getInteractables()
    const intersection = this.player.raycast(interactables)

    if (intersection && intersection.distance <= this.interactionRange) {
      // Traverse up parent chain to find userData with type/id
      let obj: THREE.Object3D | null = intersection.object
      let userData: { type?: string; id?: string } | null = null

      while (obj) {
        const data = obj.userData as { type?: string; id?: string }
        if (data.type && data.id) {
          userData = data
          break
        }
        obj = obj.parent
      }

      if (userData && userData.id) {
        this.currentTarget = {
          type: userData.type as 'door' | 'terminal' | 'door_panel' | 'switch',
          id: userData.id,  // Already checked in conditional
          object: intersection.object,
          distance: intersection.distance
        }

        this.showInteractionPrompt()
        this.setCrosshairInteractive(true)
        return
      }
    }

    // No valid target
    this.currentTarget = null
    this.hideInteractionPrompt()
    this.setCrosshairInteractive(false)
  }

  /**
   * Check if player is looking at a voxel-based switch.
   */
  private checkVoxelSwitch(): InteractionTarget | null {
    if (!this.scene.voxelWorld) return null

    const voxelRaycast = new VoxelRaycast(this.scene.voxelWorld)
    const origin = this.player.camera.position.clone()
    const direction = this.player.getLookDirection()

    const hit = voxelRaycast.cast(origin, direction, this.interactionRange)
    if (!hit) return null

    // Debug: log what we hit
    if (hit.voxelType !== VoxelType.AIR && hit.voxelType !== VoxelType.WALL &&
        hit.voxelType !== VoxelType.FLOOR && hit.voxelType !== VoxelType.CEILING) {
      console.log(`Raycast hit voxel type ${hit.voxelType} at (${hit.voxelCoord.x}, ${hit.voxelCoord.y}, ${hit.voxelCoord.z})`)
    }

    // Check if we hit a switch-related voxel
    const voxelType = hit.voxelType
    if (voxelType !== VoxelType.SWITCH &&
        voxelType !== VoxelType.SWITCH_BUTTON &&
        voxelType !== VoxelType.LED_GREEN &&
        voxelType !== VoxelType.LED_RED) {
      return null
    }

    // Find which switch this voxel belongs to
    const hitWorldPos = new THREE.Vector3(
      hit.voxelCoord.x * VOXEL_SIZE,
      hit.voxelCoord.y * VOXEL_SIZE,
      hit.voxelCoord.z * VOXEL_SIZE
    )

    // Find nearest switch definition
    // Switch positions in layout are in voxel coordinates, convert to world
    let nearestSwitch: { id: string; distance: number } | null = null
    for (const [id, switchDef] of this.scene.switchDefs) {
      const switchPos = new THREE.Vector3(
        switchDef.properties.position.x * VOXEL_SIZE,
        (switchDef.properties.position.y + Config.player.interaction.switchHeightOffset) * VOXEL_SIZE,
        switchDef.properties.position.z * VOXEL_SIZE
      )
      const dist = hitWorldPos.distanceTo(switchPos)
      if (dist < 1.0 && (!nearestSwitch || dist < nearestSwitch.distance)) {
        nearestSwitch = { id, distance: dist }
      }
    }

    if (!nearestSwitch) return null

    return {
      type: 'switch',
      id: nearestSwitch.id,
      object: new THREE.Object3D(),  // Placeholder - no mesh
      distance: hit.distance
    }
  }

  private interact() {
    if (!this.currentTarget) return

    switch (this.currentTarget.type) {
      case 'switch':
        this.interactWithSwitch(this.currentTarget.id)
        break
      case 'terminal':
        this.interactWithTerminal(this.currentTarget.id)
        break
      // Doors are controlled via switches, not direct interaction
    }
  }

  private interactWithSwitch(switchId: string) {
    const switchDef = this.scene.switchDefs.get(switchId)
    if (!switchDef) return

    // Convert voxel coords to world coords
    const switchPos = new THREE.Vector3(
      switchDef.properties.position.x * VOXEL_SIZE,
      (switchDef.properties.position.y + Config.player.interaction.switchHeightOffset) * VOXEL_SIZE,
      switchDef.properties.position.z * VOXEL_SIZE
    )

    // Check if switch is broken - give feedback but doesn't work
    if (switchDef.properties.status === 'FAULT') {
      audioSystem.playSwitchClick(switchPos, false)
      audioSystem.playSparks(switchPos)
      this.scene.sparkEffect.emit(switchPos, 12)
      return
    }

    // Switch works - play sound
    audioSystem.playSwitchClick(switchPos, true)

    // Find which door this switch controls
    const structure = this.runtime.getStructure()
    if (!structure) return

    for (const [doorId, doorDef] of structure.doors) {
      if (doorDef.properties.control === switchId) {
        // Found the door this switch controls - toggle it
        const doorInstance = this.scene.animatedAssets.get(`door_${doorId}`)
        if (doorInstance) {
          const state = doorInstance.getParam('state')
          if (state === 'OPEN') {
            this.runtime.closeDoor(doorId)
          } else if (state === 'CLOSED') {
            this.runtime.openDoor(doorId)
          }
        }
        return
      }
    }

    // Check if this is a light switch - toggle all lights in the room
    const displayName = switchDef.properties.display_name?.toLowerCase() ?? ''
    if (switchId.includes('light_switch') || displayName.includes('light')) {
      this.scene.toggleLights()
    }
  }

  private interactWithTerminal(terminalId: string) {
    const terminal = this.scene.terminals.get(terminalId)
    if (!terminal) return

    const terminalType = terminal.getTerminalType()

    // STATUS terminals are read-only, just don't respond to E
    if (terminalType === 'STATUS') {
      return
    }

    // Focus on terminal
    this.focusTerminal(terminal)
  }

  private focusTerminal(terminal: ScreenEntity) {
    this.focusedTerminal = terminal
    terminal.focus()
    audioSystem.playTerminalAccess()

    // Disable player movement
    this.player.setEnabled(false)

    // Exit pointer lock
    document.exitPointerLock()

    // Hide interaction UI
    this.hideInteractionPrompt()
    if (this.crosshair) this.crosshair.style.display = 'none'

    // Load file content and show editor
    if (terminal.getTerminalType() === 'ENGINEERING') {
      const files = terminal.getMountedFiles()

      if (files.length > 0) {
        const file = this.runtime.getFile(files[0]!)

        if (file) {
          this.currentFile = files[0]!
          this.currentCode = file.content
        } else {
          this.currentFile = files[0]!
          this.currentCode = '# File not found\n# Press Esc to exit'
        }

        this.isEditingCode = true
        this.showEditor()
      }
    }
  }

  private showEditor() {
    if (!this.editorOverlay || !this.editorTextarea || !this.editorFilename || !this.editorStatus || !this.editorErrors) return

    this.editorFilename.textContent = this.currentFile
    this.editorTextarea.value = this.currentCode
    this.editorStatus.textContent = Config.ui.editor.statusReady
    this.editorErrors.textContent = ''
    this.editorOverlay.classList.add('visible')

    // Focus textarea for immediate typing
    setTimeout(() => {
      this.editorTextarea?.focus()
    }, 100)
  }

  private hideEditor() {
    if (this.editorOverlay) {
      this.editorOverlay.classList.remove('visible')
    }
  }

  private exitFocus() {
    if (!this.focusedTerminal) return

    this.focusedTerminal.unfocus()
    this.focusedTerminal = null
    this.isEditingCode = false

    // Hide editor
    this.hideEditor()

    // Re-enable player and restore pointer lock for first-person control
    this.player.setEnabled(true)
    this.player.lock()

    // Show crosshair
    if (this.crosshair) this.crosshair.style.display = 'block'
  }

  private saveCode() {
    // Get code from textarea
    if (this.editorTextarea) {
      this.currentCode = this.editorTextarea.value
    }

    // Update file in runtime
    this.runtime.loadFile(this.currentFile, this.currentCode)

    // Get all files and recompile
    const files = this.runtime.getAllFiles()
    const allCode = files.map(f => f.content).join('\n\n')

    const result = this.runtime.recompile(allCode)

    if (result.success) {
      // Play success sound
      audioSystem.playCompileSuccess()

      // Update editor status
      if (this.editorStatus) {
        this.editorStatus.textContent = Config.ui.editor.statusSuccess
        this.editorStatus.style.color = Config.ui.editor.colorSuccess
      }
      if (this.editorErrors) {
        this.editorErrors.textContent = ''
      }

      // Rebuild the scene with new structure
      const structure = this.runtime.getStructure()
      if (structure) {
        this.scene.buildFromStructure(structure)
      }
      // Editor status bar shows success - no toast needed
    } else {
      // Play error sound
      audioSystem.playCompileError()

      // Show errors in editor
      if (this.editorStatus) {
        this.editorStatus.textContent = Config.ui.editor.statusError
        this.editorStatus.style.color = Config.ui.editor.colorError
      }
      if (this.editorErrors) {
        const errorText = result.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n')
        this.editorErrors.textContent = errorText
      }
    }
  }

  private showInteractionPrompt() {
    if (!this.prompt || !this.currentTarget) return

    let text = ''
    switch (this.currentTarget.type) {
      case 'switch':
        const switchDef = this.scene.switchDefs.get(this.currentTarget.id)
        const switchName = switchDef?.properties.display_name ?? 'Switch'
        if (switchDef?.properties.status === 'FAULT') {
          // Use config prompt with {name} placeholder replaced
          const brokenPrompt = Config.ui.prompts.switchBroken.replace('{name}', switchName)
          text = `<span style="color: ${Config.ui.editor.colorError};">${brokenPrompt}</span>`
        } else {
          // Use config prompt with {name} placeholder and [E] -> <kbd>E</kbd>
          text = Config.ui.prompts.switchNormal
            .replace('{name}', switchName)
            .replace('[E]', '<kbd>E</kbd>')
        }
        break
      case 'terminal':
        const terminal = this.scene.terminals.get(this.currentTarget.id)
        const type = terminal?.getTerminalType() ?? 'STATUS'
        if (type === 'STATUS') {
          text = Config.ui.prompts.terminalStatus.replace('{name}', terminal?.getDisplayName() ?? 'Status Display')
        } else {
          text = Config.ui.prompts.terminalEngineering.replace('[E]', '<kbd>E</kbd>')
        }
        break
    }

    this.prompt.innerHTML = text
    this.prompt.classList.add('visible')
  }

  private hideInteractionPrompt() {
    if (this.prompt) {
      this.prompt.classList.remove('visible')
    }
  }

  private setCrosshairInteractive(interactive: boolean) {
    if (this.crosshair) {
      if (interactive) {
        this.crosshair.classList.add('interactive')
      } else {
        this.crosshair.classList.remove('interactive')
      }
    }
  }

  private showMessage(message: string) {
    // Show in prompt briefly
    if (this.prompt) {
      this.prompt.innerHTML = message
      this.prompt.classList.add('visible')
      setTimeout(() => {
        if (!this.currentTarget) {
          this.prompt?.classList.remove('visible')
        }
      }, Config.ui.message.displayDuration)
    }
  }

  dispose() {
    // Clean up
  }
}
