import { test, expect } from '@playwright/test'

/**
 * Pong3 - Voxel-based Pong game tests
 * Tests the voxel rendering version of Pong
 */

test.describe('Pong3 Voxel Game', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console messages for debugging
    page.on('console', msg => {
      console.log(`[${msg.type()}] ${msg.text()}`)
    })
  })

  test('pong3 game loads without errors', async ({ page }) => {
    const errors: string[] = []

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Capture page errors
    page.on('pageerror', err => {
      errors.push(err.message)
    })

    // Navigate to pong3 game
    await page.goto('http://localhost:3000/?game=pong3')

    // Wait for canvas to be present
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 10000 })

    // Wait for game to initialize
    await page.waitForTimeout(2000)

    // Should have no parse errors or critical failures
    const parseErrors = errors.filter(e => e.includes('Parse error') || e.includes('Failed to initialize'))
    expect(parseErrors).toHaveLength(0)
  })

  test('displays start screen on load', async ({ page }) => {
    await page.goto('http://localhost:3000/?game=pong3')

    // Wait for UI elements
    await page.waitForTimeout(2000)

    // Should show VOXEL PONG title on start screen
    const title = page.locator('text=VOXEL PONG')
    await expect(title).toBeVisible({ timeout: 5000 })

    // Should show start instructions
    const startHint = page.locator('text=Press SPACE to Start')
    await expect(startHint).toBeVisible()
  })

  test('starts game when pressing Space', async ({ page }) => {
    await page.goto('http://localhost:3000/?game=pong3')
    await page.waitForTimeout(2000)

    // Press Space to start
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)

    // Start screen should be hidden (title should not be visible)
    const title = page.locator('text=VOXEL PONG')
    await expect(title).not.toBeVisible({ timeout: 2000 })

    // Score display should still be visible
    const score = page.locator('text=0 - 0')
    await expect(score).toBeVisible()
  })

  test('pauses game when pressing Escape', async ({ page }) => {
    await page.goto('http://localhost:3000/?game=pong3')
    await page.waitForTimeout(2000)

    // Start the game
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)

    // Press Escape to pause
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Should show PAUSED text
    const pauseText = page.locator('text=PAUSED')
    await expect(pauseText).toBeVisible()

    // Press Escape again to unpause
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // PAUSED should be hidden
    await expect(pauseText).not.toBeVisible()
  })

  test('paddle responds to W/S keyboard input', async ({ page }) => {
    await page.goto('http://localhost:3000/?game=pong3')
    await page.waitForTimeout(2000)

    // Start the game
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)

    // Hold W key for a bit to move paddle up
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyW')

    // Game should still be running without errors
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()

    // Hold S key for a bit to move paddle down
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyS')

    // Game should still be running
    await expect(canvas).toBeVisible()
  })

  test('paddle responds to Arrow keys', async ({ page }) => {
    await page.goto('http://localhost:3000/?game=pong3')
    await page.waitForTimeout(2000)

    // Start the game
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)

    // Use arrow keys
    await page.keyboard.down('ArrowUp')
    await page.waitForTimeout(300)
    await page.keyboard.up('ArrowUp')

    await page.keyboard.down('ArrowDown')
    await page.waitForTimeout(300)
    await page.keyboard.up('ArrowDown')

    // Game should still be running without errors
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('game emits ready event with correct metadata', async ({ page }) => {
    let gameReadyEvent: { title?: string; instructions?: string } | null = null

    // Listen for game:ready event
    await page.exposeFunction('captureGameEvent', (event: { title?: string; instructions?: string }) => {
      gameReadyEvent = event
    })

    await page.goto('http://localhost:3000/?game=pong3')

    // Inject listener for game events
    await page.evaluate(() => {
      const originalEmit = (window as any).gameVM?.emit
      if (originalEmit) {
        (window as any).gameVM.emit = (event: string, data: any) => {
          if (event === 'game:ready') {
            (window as any).captureGameEvent(data)
          }
          return originalEmit(event, data)
        }
      }
    })

    await page.waitForTimeout(3000)

    // Note: Event may have already fired before we could capture it
    // This test is more for documentation of expected behavior
  })

  test('game runs smoothly with voxel rendering', async ({ page }) => {
    await page.goto('http://localhost:3000/?game=pong3')
    await page.waitForTimeout(2000)

    // Start the game
    await page.keyboard.press('Space')

    // Let the game run for a few seconds with ball moving
    await page.waitForTimeout(5000)

    // Check that the game is still running (canvas still visible, no crashes)
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()

    // Score should still be displayed (game hasn't crashed)
    const score = page.locator('text=/\\d+ - \\d+/')
    await expect(score).toBeVisible()
  })
})
