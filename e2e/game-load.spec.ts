/**
 * E2E Test: Game Load
 *
 * Verifies that the game loads without errors and renders properly.
 */

import { test, expect } from './fixtures'

test.describe('Game Load', () => {
  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = []

    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Navigate to game
    await page.goto('/')

    // Wait for initial load
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('hot-update') &&
        !e.includes('WebSocket') &&
        !e.includes('404') && // Optional resources may 404
        !e.includes('.entity.forge') // Entity files are optional
    )

    expect(criticalErrors).toHaveLength(0)
  })

  test('canvas element exists', async ({ page }) => {
    await page.goto('/')
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 10000 })
  })

  test('canvas has correct dimensions', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('canvas', { timeout: 10000 })

    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()

    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)
  })

  test('forge assets are loaded', async ({ page }) => {
    // Listen for the Forge asset loading message
    let assetLoadMessage = ''

    page.on('console', (msg) => {
      if (msg.text().includes('ForgeAssetLoader')) {
        assetLoadMessage = msg.text()
      }
    })

    await page.goto('/')
    await page.waitForTimeout(3000)

    // Check that assets were loaded
    expect(assetLoadMessage).toContain('Compiled')
    expect(assetLoadMessage).toContain('assets')
  })

  test('no WebGL context lost errors', async ({ page }) => {
    let contextLost = false

    page.on('console', (msg) => {
      if (msg.text().toLowerCase().includes('context lost')) {
        contextLost = true
      }
    })

    await page.goto('/')
    await page.waitForTimeout(3000)

    expect(contextLost).toBe(false)
  })
})
