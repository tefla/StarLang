// Interaction System - Handles player interactions with objects

import * as THREE from 'three'
import { PlayerController } from './PlayerController'
import { ShipScene } from '../scene/ShipScene'
import { TerminalMesh } from '../terminals/TerminalMesh'
import { DoorMesh } from '../scene/DoorMesh'
import { SwitchMesh } from '../scene/SwitchMesh'
import { Runtime } from '../../runtime/Runtime'
import { audioSystem } from '../audio/AudioSystem'

export type InteractionTarget = {
  type: 'door' | 'terminal' | 'door_panel' | 'switch'
  id: string
  object: THREE.Object3D
  distance: number
}

export class InteractionSystem {
  private player: PlayerController
  private scene: ShipScene
  private runtime: Runtime

  private currentTarget: InteractionTarget | null = null
  private interactionRange = 2.5
  private focusedTerminal: TerminalMesh | null = null

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

    // Raycast to find what player is looking at
    const interactables = this.scene.getInteractables()
    const intersection = this.player.raycast(interactables)

    if (intersection && intersection.distance <= this.interactionRange) {
      const userData = intersection.object.userData as { type?: string; id?: string }

      if (userData.type && userData.id) {
        this.currentTarget = {
          type: userData.type as 'door' | 'terminal' | 'door_panel' | 'switch',
          id: userData.id,
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
    const switchMesh = this.scene.switchMeshes.get(switchId)
    if (!switchMesh) return

    // Check if switch is broken - give feedback but doesn't work
    if (switchMesh.getStatus() === 'FAULT') {
      switchMesh.pressBroken()
      // Emit visual sparks
      this.scene.sparkEffect.emit(switchMesh.group.position, 12)
      return
    }

    // Switch works - animate it
    switchMesh.press()

    // Find which door this switch controls
    const structure = this.runtime.getStructure()
    if (!structure) return

    for (const [doorId, doorDef] of structure.doors) {
      if (doorDef.properties.control === switchId) {
        // Found the door this switch controls - toggle it
        const doorMesh = this.scene.doorMeshes.get(doorId)
        if (doorMesh) {
          const state = doorMesh.getState()
          if (state === 'OPEN') {
            this.runtime.closeDoor(doorId)
          } else if (state === 'CLOSED') {
            this.runtime.openDoor(doorId)
          }
        }
        return
      }
    }

    // Check if this is a light switch - toggle room lights
    if (switchId.includes('light_switch') || switchMesh.definition.properties.display_name.toLowerCase().includes('light')) {
      const roomId = switchMesh.definition.properties.location
      const roomMesh = this.scene.roomMeshes.get(roomId)
      if (roomMesh) {
        roomMesh.toggleLights()
      }
    }
  }

  private interactWithTerminal(terminalId: string) {
    const terminalMesh = this.scene.terminalMeshes.get(terminalId)
    if (!terminalMesh) return

    const terminalType = terminalMesh.definition.properties.terminal_type

    // STATUS terminals are read-only, just don't respond to E
    if (terminalType === 'STATUS') {
      return
    }

    // Focus on terminal
    this.focusTerminal(terminalMesh)
  }

  private focusTerminal(terminal: TerminalMesh) {
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
    if (terminal.definition.properties.terminal_type === 'ENGINEERING') {
      const files = terminal.definition.properties.mounted_files ?? []

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
    this.editorStatus.textContent = 'Ready'
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
        this.editorStatus.textContent = 'Compiled successfully!'
        this.editorStatus.style.color = '#77dd77'
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
        this.editorStatus.textContent = 'Compile error'
        this.editorStatus.style.color = '#ff6b6b'
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
        const switchMesh = this.scene.switchMeshes.get(this.currentTarget.id)
        const switchName = switchMesh?.definition.properties.display_name ?? 'Switch'
        if (switchMesh?.getStatus() === 'FAULT') {
          text = `<span style="color: #ff6b6b;">${switchName}</span> - Not responding`
        } else {
          text = `Press <kbd>E</kbd> to use ${switchName}`
        }
        break
      case 'terminal':
        const terminal = this.scene.terminalMeshes.get(this.currentTarget.id)
        const type = terminal?.definition.properties.terminal_type ?? 'STATUS'
        if (type === 'STATUS') {
          text = `${terminal?.definition.properties.display_name ?? 'Status Display'}`
        } else {
          text = `Press <kbd>E</kbd> to use terminal`
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
      }, 2000)
    }
  }

  dispose() {
    // Clean up
  }
}
