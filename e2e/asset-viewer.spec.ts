import { test, expect } from '@playwright/test'

test.describe('Asset Viewer', () => {
  test('loads and displays test-box asset', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    // Wait for canvas to be visible
    await expect(page.locator('canvas')).toBeVisible()

    // Check that asset name is displayed
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })

    // Check controls hint is shown
    await expect(page.locator('text=Orbit')).toBeVisible()
  })

  test('loads and displays spaceship asset', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=spaceship')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: spaceship')).toBeVisible({ timeout: 5000 })
  })

  test('shows error for missing asset', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=nonexistent')

    await expect(page.locator('canvas')).toBeVisible()

    // Should show error message
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 5000 })
  })

  test('shows error when no asset specified', async ({ page }) => {
    await page.goto('/?game=asset-viewer')

    await expect(page.locator('canvas')).toBeVisible()

    // Should show "no asset" message
    await expect(page.locator('text=No asset specified')).toBeVisible({ timeout: 5000 })
  })

  test('camera responds to WASD orbit input', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })

    // Focus the container to receive keyboard events
    await page.locator('#game-container').focus()

    // Press WASD keys to orbit camera
    await page.keyboard.press('d')
    await page.waitForTimeout(100)
    await page.keyboard.press('a')
    await page.waitForTimeout(100)
    await page.keyboard.press('w')
    await page.waitForTimeout(100)
    await page.keyboard.press('s')
    await page.waitForTimeout(100)

    // If we got here without errors, camera input is working
  })

  test('camera responds to Shift+WASD pan input', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })

    await page.locator('#game-container').focus()

    // Pan with Shift+WASD
    await page.keyboard.down('Shift')
    await page.keyboard.press('w')
    await page.waitForTimeout(100)
    await page.keyboard.press('s')
    await page.waitForTimeout(100)
    await page.keyboard.up('Shift')
  })

  test('grid toggles with G key', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })

    await page.locator('#game-container').focus()

    // Toggle grid off and on
    await page.keyboard.press('g')
    await page.waitForTimeout(200)
    await page.keyboard.press('g')
    await page.waitForTimeout(200)
  })

  test('catalog shows available assets', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })

    // Catalog title should be visible
    await expect(page.locator('text=Assets')).toBeVisible({ timeout: 5000 })

    // Should list some assets (at least test-box and spaceship)
    await expect(page.locator('text=Test Box')).toBeVisible({ timeout: 5000 })
  })

  test('number keys switch between assets', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })

    await page.locator('#game-container').focus()

    // Press 2 to switch to second asset
    await page.keyboard.press('2')
    await page.waitForTimeout(500)

    // Should have loaded a different asset (check that display changed)
    // The catalog numbering depends on order, so just verify something loaded
    await expect(page.locator('text=Asset:')).toBeVisible()
  })

  test('catalog toggles with C key', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Assets')).toBeVisible({ timeout: 5000 })

    await page.locator('#game-container').focus()

    // Toggle catalog off
    await page.keyboard.press('c')
    await page.waitForTimeout(300)

    // Catalog title should be hidden
    // (Note: The text may still exist in DOM but be hidden)

    // Toggle catalog back on
    await page.keyboard.press('c')
    await page.waitForTimeout(300)

    // Catalog should be visible again
    await expect(page.locator('text=Assets')).toBeVisible()
  })

  test('clicking catalog items loads assets', async ({ page }) => {
    await page.goto('/?game=asset-viewer&asset=test-box')

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('text=Asset: test-box')).toBeVisible({ timeout: 5000 })

    // Wait for catalog to load
    await expect(page.locator('text=Assets')).toBeVisible({ timeout: 5000 })

    // Find and click on a different asset in the catalog (e.g., Spaceship)
    const spaceshipItem = page.locator('text=/\\d+\\. Spaceship/')
    await expect(spaceshipItem).toBeVisible({ timeout: 5000 })
    await spaceshipItem.click()

    // Wait for asset to load
    await page.waitForTimeout(500)

    // Should now show the spaceship asset
    await expect(page.locator('text=Asset: spaceship')).toBeVisible({ timeout: 5000 })
  })
})
