/**
 * Simple dev server for the asset editor
 */

import html from '../../asset-editor.html'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const ASSETS_DIR = join(import.meta.dir, '../content/assets')

// Get list of all assets
async function listAssets(): Promise<string[]> {
  const assets: string[] = []

  async function scan(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await scan(join(dir, entry.name), `${prefix}${entry.name}/`)
      } else if (entry.name.endsWith('.asset.json')) {
        assets.push(`${prefix}${entry.name.replace('.asset.json', '')}`)
      }
    }
  }

  await scan(ASSETS_DIR, '')
  return assets
}

Bun.serve({
  port: 3001,
  routes: {
    '/': html,

    // API to list available assets
    '/api/assets': async () => {
      const assets = await listAssets()
      return Response.json(assets)
    },
  },

  // Handle asset loading with fetch handler
  async fetch(req) {
    const url = new URL(req.url)

    // Handle /api/asset/path/to/asset
    if (url.pathname.startsWith('/api/asset/')) {
      const assetPath = url.pathname.replace('/api/asset/', '')
      const filePath = join(ASSETS_DIR, `${assetPath}.asset.json`)

      const file = Bun.file(filePath)
      if (await file.exists()) {
        return new Response(file, {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response('Not found', { status: 404 })
    }

    // Return 404 for unhandled paths
    return new Response('Not found', { status: 404 })
  },

  development: {
    hmr: true,
    console: true,
  },
})

console.log('Asset Editor running at http://localhost:3001')
