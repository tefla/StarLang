/**
 * E2E Test Fixtures
 * Common utilities for Playwright tests
 */

import { test as base, expect, type Page } from '@playwright/test'

/**
 * Extended test fixture with game-specific helpers.
 */
export const test = base.extend<{
  gamePage: Page
}>({
  gamePage: async ({ page }, use) => {
    // Navigate to the game
    await page.goto('/')

    // Wait for the game canvas to be present and visible
    const canvas = page.locator('canvas')
    await canvas.waitFor({ state: 'visible', timeout: 15000 })

    // Give Three.js time to fully initialize and render
    await page.waitForTimeout(2000)

    // Verify canvas has dimensions (Three.js has initialized)
    const box = await canvas.boundingBox()
    if (!box || box.width === 0 || box.height === 0) {
      throw new Error('Canvas not properly initialized')
    }

    await use(page)
  },
})

export { expect }

/**
 * Helper to advance game time by simulating ticks.
 */
export async function advanceTime(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => {
    // Access the global runtime if available
    const win = window as unknown as { gameRuntime?: { tick: (delta: number) => void } }
    if (win.gameRuntime?.tick) {
      win.gameRuntime.tick(s)
    }
  }, seconds)
}

/**
 * Helper to get the current game state.
 */
export async function getGameState(page: Page): Promise<Record<string, unknown>> {
  return await page.evaluate(() => {
    const win = window as unknown as { gameRuntime?: { getState: () => Record<string, unknown> } }
    return win.gameRuntime?.getState?.() ?? {}
  })
}

/**
 * Helper to set a game state value.
 */
export async function setGameState(page: Page, path: string, value: unknown): Promise<void> {
  await page.evaluate(
    ([p, v]) => {
      const win = window as unknown as { gameRuntime?: { setStateValue: (path: string, value: unknown) => void } }
      win.gameRuntime?.setStateValue?.(p, v)
    },
    [path, value] as const
  )
}

/**
 * Helper to emit a game event.
 */
export async function emitEvent(page: Page, event: string, data?: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ([e, d]) => {
      const win = window as unknown as { gameRuntime?: { emit: (event: string, data?: Record<string, unknown>) => void } }
      win.gameRuntime?.emit?.(e, d)
    },
    [event, data] as const
  )
}

/**
 * Helper to wait for a specific game state.
 */
export async function waitForState(
  page: Page,
  path: string,
  expected: unknown,
  timeout: number = 5000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const state = await getGameState(page)
    const parts = path.split('.')
    let current: unknown = state
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part]
      } else {
        current = undefined
        break
      }
    }
    if (current === expected) return
    await page.waitForTimeout(100)
  }
  throw new Error(`Timeout waiting for state ${path} to be ${expected}`)
}

/**
 * Helper to click at canvas coordinates.
 */
export async function clickCanvas(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')

  await page.mouse.click(box.x + x, box.y + y)
}

/**
 * Helper to check if an element exists.
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count()) > 0
}
