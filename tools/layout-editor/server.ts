// Layout Editor Server
import index from './index.html'
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const LAYOUTS_DIR = join(import.meta.dir, '../../src/content/ship')
const ASSETS_DIR = join(import.meta.dir, '../../src/content/assets')

// Recursively find all asset files
async function findAssetFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await findAssetFiles(fullPath))
    } else if (entry.name.endsWith('.asset.json')) {
      results.push(fullPath)
    }
  }
  return results
}

// Find an asset file by ID
async function findAssetById(assetId: string): Promise<string | null> {
  const files = await findAssetFiles(ASSETS_DIR)
  for (const filePath of files) {
    try {
      const file = Bun.file(filePath)
      const content = await file.json()
      if (content.id === assetId) {
        return filePath
      }
    } catch {
      // Skip invalid files
    }
  }
  return null
}

const server = Bun.serve({
  port: 3001,
  routes: {
    '/': index,
  },
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname
    const method = req.method

    // List all available assets
    if (pathname === '/api/assets' && method === 'GET') {
      try {
        const files = await findAssetFiles(ASSETS_DIR)
        const assets: Array<{ id: string; name: string; path: string }> = []
        for (const filePath of files) {
          try {
            const file = Bun.file(filePath)
            const content = await file.json()
            assets.push({
              id: content.id,
              name: content.name,
              path: relative(ASSETS_DIR, filePath)
            })
          } catch {
            // Skip invalid files
          }
        }
        return Response.json({ assets })
      } catch (err) {
        console.error('Failed to list assets:', err)
        return Response.json({ error: 'Failed to list assets' }, { status: 500 })
      }
    }

    // Get a specific asset by ID
    if (pathname.startsWith('/api/assets/') && method === 'GET') {
      const assetId = pathname.replace('/api/assets/', '')
      try {
        const filePath = await findAssetById(assetId)
        if (!filePath) {
          return Response.json({ error: 'Asset not found' }, { status: 404 })
        }
        const file = Bun.file(filePath)
        const content = await file.json()
        return Response.json(content)
      } catch (err) {
        console.error('Failed to load asset:', err)
        return Response.json({ error: 'Failed to load asset' }, { status: 500 })
      }
    }

    // List available layout files
    if (pathname === '/api/layouts' && method === 'GET') {
      try {
        const files = await readdir(LAYOUTS_DIR)
        const layouts = files.filter(f => f.endsWith('.layout.json'))
        return Response.json({ layouts })
      } catch (err) {
        console.error('Failed to list layouts:', err)
        return Response.json({ error: 'Failed to list layouts' }, { status: 500 })
      }
    }

    // Create a new layout file
    if (pathname.startsWith('/api/layouts/new/') && method === 'POST') {
      let name = pathname.replace('/api/layouts/new/', '')
      if (!name.endsWith('.layout.json')) {
        name += '.layout.json'
      }
      try {
        const filePath = join(LAYOUTS_DIR, name)
        const emptyLayout = { rooms: {}, doors: {}, terminals: {}, switches: {} }
        await Bun.write(filePath, JSON.stringify(emptyLayout, null, 2))
        console.log(`Created new layout: ${name}`)
        return Response.json({ success: true, name })
      } catch (err) {
        console.error('Failed to create layout:', err)
        return Response.json({ error: 'Failed to create layout' }, { status: 500 })
      }
    }

    // Load or save a specific layout file
    if (pathname.startsWith('/api/layouts/')) {
      const name = pathname.replace('/api/layouts/', '')
      if (!name.endsWith('.layout.json')) {
        return Response.json({ error: 'Invalid file name' }, { status: 400 })
      }

      if (method === 'GET') {
        try {
          const filePath = join(LAYOUTS_DIR, name)
          const file = Bun.file(filePath)
          const content = await file.json()
          return Response.json(content)
        } catch (err) {
          console.error('Failed to load layout:', err)
          return Response.json({ error: 'Failed to load layout' }, { status: 500 })
        }
      }

      if (method === 'PUT') {
        try {
          const data = await req.json()
          const filePath = join(LAYOUTS_DIR, name)
          await Bun.write(filePath, JSON.stringify(data, null, 2))
          console.log(`Saved layout: ${name}`)
          return Response.json({ success: true })
        } catch (err) {
          console.error('Failed to save layout:', err)
          return Response.json({ error: 'Failed to save layout' }, { status: 500 })
        }
      }
    }

    return new Response('Not found', { status: 404 })
  },
  development: {
    hmr: true,
    console: true,
  }
})

console.log(`Layout Editor running at http://localhost:${server.port}`)
