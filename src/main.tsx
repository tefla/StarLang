import { Game } from './engine/Game'

// Hide loading screen when game is ready
const loading = document.getElementById('loading')

async function init() {
  try {
    const container = document.getElementById('game-container')
    if (!container) throw new Error('Game container not found')

    const game = new Game(container)
    await game.init()

    // Hide loading screen
    if (loading) loading.classList.add('hidden')

    // Start the game loop
    game.start()

    // Handle window resize
    window.addEventListener('resize', () => game.resize())

    // Expose game instance for debugging
    ;(window as any).game = game

  } catch (error) {
    console.error('Failed to initialize game:', error)
    if (loading) {
      loading.innerHTML = `
        <h1>ERROR</h1>
        <p style="color: #ff6b6b; margin-top: 20px;">${error}</p>
      `
    }
  }
}

init()
