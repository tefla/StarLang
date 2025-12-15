import { AssetEditor } from './AssetEditor'

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app')
  if (!container) {
    console.error('No #app container found')
    return
  }

  // Remove loading message
  const loading = document.getElementById('loading')
  if (loading) loading.remove()

  // Create editor
  const editor = new AssetEditor(container)

  // Expose for debugging
  ;(window as unknown as { editor: AssetEditor }).editor = editor

  console.log('Asset Editor initialized')
})
