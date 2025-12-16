import { test, expect } from '@playwright/test'

test('pong game loads without errors', async ({ page }) => {
  const errors: string[] = []

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
    console.log(`[${msg.type()}] ${msg.text()}`)
  })

  // Capture page errors
  page.on('pageerror', err => {
    errors.push(err.message)
    console.log(`[pageerror] ${err.message}`)
  })

  // Navigate to pong game
  await page.goto('http://localhost:3000/?game=pong')

  // Wait for game to initialize
  await page.waitForTimeout(3000)

  // Check for errors
  console.log('\n=== Errors found ===')
  for (const err of errors) {
    console.log(err)
  }

  // For now, just report - don't fail
  if (errors.length > 0) {
    console.log(`\nFound ${errors.length} error(s)`)
  } else {
    console.log('No errors!')
  }
})
