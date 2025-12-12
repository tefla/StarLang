// Interaction System - Handles player interactions with objects

import * as THREE from 'three'
import { PlayerController } from './PlayerController'
import { ShipScene } from '../scene/ShipScene'
import { TerminalMesh } from '../terminals/TerminalMesh'
import { DoorMesh } from '../scene/DoorMesh'
import { Runtime } from '../../runtime/Runtime'

export type InteractionTarget = {
  type: 'door' | 'terminal' | 'door_panel'
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

  private debugCounter = 0

  update() {
    if (this.focusedTerminal) {
      // Don't update targeting while focused
      return
    }

    // Raycast to find what player is looking at
    const interactables = this.scene.getInteractables()
    const intersection = this.player.raycast(interactables)

    // Debug logging every second
    this.debugCounter++
    if (this.debugCounter % 60 === 0) {
      console.log('[Interaction] Interactables:', interactables.length,
        'Hit:', intersection ? `${intersection.object.name} at ${intersection.distance.toFixed(2)}` : 'none')
    }

    if (intersection && intersection.distance <= this.interactionRange) {
      const userData = intersection.object.userData as { type?: string; id?: string }

      if (this.debugCounter % 60 === 0) {
        console.log('[Interaction] Target userData:', userData)
      }

      if (userData.type && userData.id) {
        this.currentTarget = {
          type: userData.type as 'door' | 'terminal' | 'door_panel',
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
    console.log('[Interaction] Interact called, target:', this.currentTarget)
    if (!this.currentTarget) {
      console.log('[Interaction] No target to interact with')
      return
    }

    console.log('[Interaction] Interacting with:', this.currentTarget.type, this.currentTarget.id)
    switch (this.currentTarget.type) {
      case 'door':
      case 'door_panel':
        this.interactWithDoor(this.currentTarget.id)
        break
      case 'terminal':
        this.interactWithTerminal(this.currentTarget.id)
        break
    }
  }

  private interactWithDoor(doorId: string) {
    const doorMesh = this.scene.doorMeshes.get(doorId)
    if (!doorMesh) return

    const state = doorMesh.getState()

    if (state === 'OPEN') {
      const result = this.runtime.closeDoor(doorId)
      this.showMessage(result.message)
    } else if (state === 'CLOSED') {
      const result = this.runtime.openDoor(doorId)
      this.showMessage(result.message)
    } else if (state === 'LOCKED') {
      this.showMessage('Door is locked. Find a terminal to unlock it.')
    } else if (state === 'SEALED') {
      this.showMessage('EMERGENCY SEAL - Cannot override manually')
    }
  }

  private interactWithTerminal(terminalId: string) {
    const terminalMesh = this.scene.terminalMeshes.get(terminalId)
    if (!terminalMesh) {
      console.log('[Interaction] Terminal not found:', terminalId)
      return
    }

    const terminalType = terminalMesh.definition.properties.terminal_type
    console.log('[Interaction] Interacting with terminal:', terminalId, 'type:', terminalType)

    if (terminalType === 'STATUS') {
      this.showMessage('Status display - read only')
      return
    }

    // Focus on terminal
    console.log('[Interaction] Calling focusTerminal...')
    this.focusTerminal(terminalMesh)
  }

  private focusTerminal(terminal: TerminalMesh) {
    console.log('[Interaction] Focusing terminal:', terminal.definition.id)
    this.focusedTerminal = terminal
    terminal.focus()

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

    // Re-enable player
    this.player.setEnabled(true)

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

      this.showMessage('Code saved and compiled!')
    } else {
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
      case 'door':
        const doorMesh = this.scene.doorMeshes.get(this.currentTarget.id)
        const state = doorMesh?.getState() ?? 'CLOSED'
        if (state === 'OPEN') {
          text = 'Press <kbd>E</kbd> to close door'
        } else if (state === 'CLOSED') {
          text = 'Press <kbd>E</kbd> to open door'
        } else if (state === 'LOCKED') {
          text = '<span style="color: #ffb347;">LOCKED</span> - Find terminal to unlock'
        } else {
          text = '<span style="color: #ff6b6b;">SEALED</span> - Emergency lockdown'
        }
        break
      case 'door_panel':
        text = 'Press <kbd>E</kbd> to use door panel'
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
    // Temporary message display (could be improved with proper UI)
    console.log('[Game]', message)

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
