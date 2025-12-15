/**
 * Animation preview panel for the asset editor.
 *
 * Features:
 * - State picker dropdown
 * - Animation playback controls
 * - Parameter controls
 * - Live preview in 3D view
 */

import type { AnimatedAssetDef } from '../voxel/AnimatedAsset'
import type { AnimatedAssetInstance } from '../voxel/AnimatedAssetInstance'

/**
 * Animation preview controls for the asset editor.
 */
export class AnimationPreview {
  private container: HTMLElement
  private panel: HTMLElement | null = null

  private currentAsset: AnimatedAssetDef | null = null
  private previewInstance: AnimatedAssetInstance | null = null

  // UI elements
  private stateSelect: HTMLSelectElement | null = null
  private animationSelect: HTMLSelectElement | null = null
  private parameterControls: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  /**
   * Create the preview panel UI.
   */
  createUI(): void {
    this.panel = document.createElement('div')
    this.panel.style.cssText = `
      position: absolute;
      bottom: 180px;
      left: 10px;
      background: rgba(0,0,0,0.85);
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #446;
      width: 200px;
      font-family: sans-serif;
      display: none;
    `

    // Title
    const title = document.createElement('div')
    title.textContent = 'Animation Preview'
    title.style.cssText = `
      color: #fff;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #446;
    `
    this.panel.appendChild(title)

    // State selector
    const stateRow = this.createRow('State')
    this.stateSelect = document.createElement('select')
    this.stateSelect.style.cssText = this.selectStyle()
    this.stateSelect.addEventListener('change', () => this.onStateChange())
    stateRow.appendChild(this.stateSelect)
    this.panel.appendChild(stateRow)

    // Animation selector
    const animRow = this.createRow('Animation')
    this.animationSelect = document.createElement('select')
    this.animationSelect.style.cssText = this.selectStyle()
    animRow.appendChild(this.animationSelect)
    this.panel.appendChild(animRow)

    // Animation controls
    const controlsRow = document.createElement('div')
    controlsRow.style.cssText = 'display: flex; gap: 4px; margin-top: 8px;'

    const playBtn = this.createButton('Play', () => this.onPlayClick())
    const stopBtn = this.createButton('Stop', () => this.onStopClick())

    controlsRow.appendChild(playBtn)
    controlsRow.appendChild(stopBtn)
    this.panel.appendChild(controlsRow)

    // Parameter controls container
    this.parameterControls = document.createElement('div')
    this.parameterControls.style.cssText = 'margin-top: 12px;'
    this.panel.appendChild(this.parameterControls)

    this.container.appendChild(this.panel)
  }

  private createRow(label: string): HTMLElement {
    const row = document.createElement('div')
    row.style.cssText = 'margin-bottom: 8px;'

    const labelEl = document.createElement('div')
    labelEl.textContent = label
    labelEl.style.cssText = 'color: #888; font-size: 10px; margin-bottom: 2px;'
    row.appendChild(labelEl)

    return row
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = text
    btn.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      border: none;
      border-radius: 3px;
      background: #446;
      color: #fff;
      font-size: 11px;
      cursor: pointer;
    `
    btn.addEventListener('click', onClick)
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#557'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#446'
    })
    return btn
  }

  private selectStyle(): string {
    return `
      width: 100%;
      padding: 4px;
      border: 1px solid #446;
      border-radius: 3px;
      background: #223;
      color: #fff;
      font-size: 11px;
      cursor: pointer;
    `
  }

  /**
   * Set the asset to preview.
   */
  setAsset(asset: AnimatedAssetDef | null): void {
    this.currentAsset = asset
    this.updateSelects()
    this.updateParameterControls()

    if (this.panel) {
      this.panel.style.display = asset ? 'block' : 'none'
    }
  }

  /**
   * Set the preview instance.
   */
  setPreviewInstance(instance: AnimatedAssetInstance | null): void {
    this.previewInstance = instance
  }

  /**
   * Check if the panel is visible.
   */
  isVisible(): boolean {
    return this.panel?.style.display !== 'none'
  }

  /**
   * Show the panel.
   */
  show(): void {
    if (this.panel && this.currentAsset) {
      this.panel.style.display = 'block'
    }
  }

  /**
   * Hide the panel.
   */
  hide(): void {
    if (this.panel) {
      this.panel.style.display = 'none'
    }
  }

  private updateSelects(): void {
    if (!this.stateSelect || !this.animationSelect) return

    // Clear existing options
    this.stateSelect.innerHTML = ''
    this.animationSelect.innerHTML = ''

    if (!this.currentAsset) return

    // Populate states
    const defaultStateOpt = document.createElement('option')
    defaultStateOpt.value = ''
    defaultStateOpt.textContent = '-- Select State --'
    this.stateSelect.appendChild(defaultStateOpt)

    if (this.currentAsset.states) {
      for (const stateName of Object.keys(this.currentAsset.states)) {
        const opt = document.createElement('option')
        opt.value = stateName
        opt.textContent = stateName
        this.stateSelect.appendChild(opt)
      }
    }

    // Populate animations
    const defaultAnimOpt = document.createElement('option')
    defaultAnimOpt.value = ''
    defaultAnimOpt.textContent = '-- Select Animation --'
    this.animationSelect.appendChild(defaultAnimOpt)

    if (this.currentAsset.animations) {
      for (const animName of Object.keys(this.currentAsset.animations)) {
        const opt = document.createElement('option')
        opt.value = animName
        opt.textContent = animName
        this.animationSelect.appendChild(opt)
      }
    }
  }

  private updateParameterControls(): void {
    if (!this.parameterControls) return

    // Clear existing controls
    this.parameterControls.innerHTML = ''

    if (!this.currentAsset?.parameters) return

    const title = document.createElement('div')
    title.textContent = 'Parameters'
    title.style.cssText = `
      color: #888;
      font-size: 10px;
      margin-bottom: 6px;
      padding-top: 8px;
      border-top: 1px solid #335;
    `
    this.parameterControls.appendChild(title)

    for (const [paramName, paramDef] of Object.entries(this.currentAsset.parameters)) {
      const row = document.createElement('div')
      row.style.cssText = 'margin-bottom: 6px;'

      const label = document.createElement('div')
      label.textContent = paramName
      label.style.cssText = 'color: #aaa; font-size: 10px; margin-bottom: 2px;'
      row.appendChild(label)

      if (paramDef.type === 'enum' && paramDef.values) {
        const select = document.createElement('select')
        select.style.cssText = this.selectStyle()

        for (const value of paramDef.values) {
          const opt = document.createElement('option')
          opt.value = value
          opt.textContent = value
          if (value === paramDef.default) opt.selected = true
          select.appendChild(opt)
        }

        select.addEventListener('change', () => {
          this.previewInstance?.setParam(paramName, select.value)
        })

        row.appendChild(select)
      } else if (paramDef.type === 'boolean') {
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = paramDef.default as boolean
        checkbox.addEventListener('change', () => {
          this.previewInstance?.setParam(paramName, checkbox.checked)
        })
        row.appendChild(checkbox)
      }

      this.parameterControls.appendChild(row)
    }
  }

  private onStateChange(): void {
    const stateName = this.stateSelect?.value
    if (stateName && this.previewInstance) {
      this.previewInstance.stopAllAnimations()
      this.previewInstance.setState(stateName)
    }
  }

  private onPlayClick(): void {
    const animName = this.animationSelect?.value
    if (animName && this.previewInstance) {
      this.previewInstance.playAnimation(animName)
    }
  }

  private onStopClick(): void {
    if (this.previewInstance) {
      this.previewInstance.stopAllAnimations()
    }
  }
}
