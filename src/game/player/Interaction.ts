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

      // Handle code editing
      if (this.isEditingCode) {
        this.handleCodeInput(e)
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
    console.log('[Interaction] Player movement disabled')

    // Exit pointer lock
    document.exitPointerLock()
    console.log('[Interaction] Pointer lock exited')

    // Hide interaction UI
    this.hideInteractionPrompt()
    if (this.crosshair) this.crosshair.style.display = 'none'

    // Load file content
    if (terminal.definition.properties.terminal_type === 'ENGINEERING') {
      const files = terminal.definition.properties.mounted_files ?? []
      console.log('[Interaction] Mounted files:', files)

      if (files.length > 0) {
        const file = this.runtime.getFile(files[0]!)
        console.log('[Interaction] Loaded file:', file ? 'found' : 'not found')

        if (file) {
          this.currentFile = files[0]!
          this.currentCode = file.content
          this.isEditingCode = true
          terminal.setCodeContent(this.currentFile, this.currentCode)
          console.log('[Interaction] Code content set, editing enabled')
        } else {
          // File not found - show tutorial/help text
          this.currentFile = files[0]!
          this.currentCode = '# No file loaded\n# Press Esc to exit'
          this.isEditingCode = true
          terminal.setCodeContent(this.currentFile, this.currentCode)
          console.log('[Interaction] File not found, showing placeholder')
        }
      }
    }

    this.showMessage('Terminal focused - Press Esc to exit')
    console.log('[Interaction] Terminal focus complete')
  }

  private exitFocus() {
    if (!this.focusedTerminal) return

    this.focusedTerminal.unfocus()
    this.focusedTerminal = null
    this.isEditingCode = false

    // Re-enable player
    this.player.setEnabled(true)

    // Show crosshair
    if (this.crosshair) this.crosshair.style.display = 'block'
  }

  private handleCodeInput(e: KeyboardEvent) {
    if (!this.focusedTerminal) return

    // Ctrl+S to save
    if (e.ctrlKey && e.code === 'KeyS') {
      e.preventDefault()
      this.saveCode()
      return
    }

    // Handle text input (simplified for MVP)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.currentCode += e.key
      this.focusedTerminal.setCodeContent(this.currentFile, this.currentCode)
    } else if (e.code === 'Backspace') {
      this.currentCode = this.currentCode.slice(0, -1)
      this.focusedTerminal.setCodeContent(this.currentFile, this.currentCode)
    } else if (e.code === 'Enter') {
      this.currentCode += '\n'
      this.focusedTerminal.setCodeContent(this.currentFile, this.currentCode)
    }
  }

  private saveCode() {
    // Update file in runtime
    this.runtime.loadFile(this.currentFile, this.currentCode)

    // Get all files and recompile
    const files = this.runtime.getAllFiles()
    const allCode = files.map(f => f.content).join('\n\n')

    const result = this.runtime.recompile(allCode)

    if (result.success) {
      this.showMessage('Saved and compiled successfully!')
      if (this.focusedTerminal) {
        this.focusedTerminal.setCodeContent(this.currentFile, this.currentCode)
      }
    } else {
      const errors = result.errors.map(e => `Line ${e.line}: ${e.message}`)
      this.showMessage('Compile error!')
      if (this.focusedTerminal) {
        this.focusedTerminal.setCodeContent(this.currentFile, this.currentCode, errors)
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
