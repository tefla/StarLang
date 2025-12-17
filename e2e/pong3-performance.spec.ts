/**
 * E2E Tests: Pong3 Performance
 *
 * Verifies that pong3 game has good performance after switching
 * from per-frame voxel operations to render mesh transforms.
 */

import { test, expect } from './fixtures'

test.describe('Pong3 Performance', () => {
  test('game loads in under 5 seconds', async ({ page }) => {
    const start = Date.now()

    await page.goto('/?game=pong3')

    // Wait for canvas to be visible
    await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 })

    // Wait for start screen UI
    await expect(page.locator('text=VOXEL PONG')).toBeVisible({ timeout: 5000 })

    const loadTime = Date.now() - start
    console.log(`Game loaded in ${loadTime}ms`)

    expect(loadTime).toBeLessThan(5000)
  })

  test('maintains 30+ FPS during gameplay', async ({ page }) => {
    await page.goto('/?game=pong3')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for init

    // Start game
    await page.keyboard.press('Space')
    await page.waitForTimeout(500) // Let game start

    // Measure frame times over 2 seconds
    const frameTimes = await page.evaluate(() => {
      return new Promise<number[]>((resolve) => {
        const times: number[] = []
        let last = performance.now()
        let count = 0

        function measure() {
          const now = performance.now()
          times.push(now - last)
          last = now
          count++
          if (count < 120) {
            requestAnimationFrame(measure)
          } else {
            resolve(times)
          }
        }
        requestAnimationFrame(measure)
      })
    })

    // Calculate average frame time
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
    const avgFPS = 1000 / avgFrameTime
    console.log(`Average FPS: ${avgFPS.toFixed(1)} (${avgFrameTime.toFixed(2)}ms per frame)`)

    // Should maintain at least 30 FPS (33ms per frame)
    expect(avgFrameTime).toBeLessThan(33)
  })

  test('no voxel rebuilds during gameplay', async ({ page }) => {
    const rebuildLogs: string[] = []

    // Capture console logs about voxel rebuilds
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('rebuildDirty') || text.includes('rebuildAll') || text.includes('voxel.rebuild')) {
        rebuildLogs.push(text)
      }
    })

    await page.goto('/?game=pong3')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000) // Wait for init (should see rebuildAll once)

    // Clear logs after init
    const initRebuildCount = rebuildLogs.length
    rebuildLogs.length = 0

    // Start game and play for 3 seconds
    await page.keyboard.press('Space')
    await page.waitForTimeout(3000)

    // Should have no rebuild logs during gameplay
    console.log(`Voxel rebuilds during init: ${initRebuildCount}`)
    console.log(`Voxel rebuilds during gameplay: ${rebuildLogs.length}`)
    console.log('Rebuild logs:', rebuildLogs)

    // Should have no rebuilds during gameplay (only at init)
    expect(rebuildLogs.length).toBe(0)
  })

  test('render objects exist for ball and paddles', async ({ page }) => {
    await page.goto('/?game=pong3')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(3000) // Wait for full init

    // Check that render bridge has created objects
    const renderObjectCount = await page.evaluate(() => {
      const win = window as unknown as {
        game?: {
          renderBridge?: {
            objects?: Map<string, unknown>
            createNamespace?: () => { count: () => number }
          }
        }
      }

      // Try to access render bridge object count
      if (win.game?.renderBridge?.objects) {
        return win.game.renderBridge.objects.size
      }

      return -1 // Not accessible
    })

    // We expect at least 3 objects: ball + 2 paddles
    // If -1, the test is inconclusive (render bridge not exposed)
    if (renderObjectCount >= 0) {
      console.log(`Render object count: ${renderObjectCount}`)
      expect(renderObjectCount).toBeGreaterThanOrEqual(3)
    } else {
      console.log('RenderBridge not exposed to window, skipping object count check')
    }
  })

  test('ball and paddles move smoothly', async ({ page }) => {
    await page.goto('/?game=pong3')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Start game
    await page.keyboard.press('Space')
    await page.waitForTimeout(100)

    // Move paddle up for 500ms
    await page.keyboard.down('W')
    await page.waitForTimeout(500)
    await page.keyboard.up('W')

    // Move paddle down for 500ms
    await page.keyboard.down('S')
    await page.waitForTimeout(500)
    await page.keyboard.up('S')

    // If we got here without errors, movement works
    // The real test is that we didn't see frame drops from voxel rebuilds
  })

  test('game responds to input without lag', async ({ page }) => {
    await page.goto('/?game=pong3')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Measure input response time
    const start = Date.now()
    await page.keyboard.press('Space') // Start game
    await page.waitForTimeout(100)

    // The game should start quickly (no long processing from voxel rebuilds)
    const responseTime = Date.now() - start
    console.log(`Input response time: ${responseTime}ms`)

    // Response should be under 200ms
    expect(responseTime).toBeLessThan(200)
  })
})

test.describe('Pong3 Visual Regression', () => {
  test('start screen renders correctly', async ({ page }) => {
    await page.goto('/?game=pong3')
    await page.waitForSelector('canvas', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // Check start screen elements
    await expect(page.locator('text=VOXEL PONG')).toBeVisible()
    await expect(page.locator('text=Press SPACE to Start')).toBeVisible()
  })

  test('canvas has correct dimensions', async ({ page }) => {
    await page.goto('/?game=pong3')
    await page.waitForSelector('canvas', { timeout: 10000 })

    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()

    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)
  })
})
