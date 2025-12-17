import index from "./index.html"
import editor from "./asset-editor.html"
import forgePreview from "./forge-preview.html"
import { enableForgeHotReload, type ForgeHotReloadEvent } from "./src/forge"
import type { ServerWebSocket } from "bun"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

// Asset directory for JSON assets
const ASSETS_DIR = './game/assets'

// Track connected WebSocket clients for hot reload
const hotReloadClients = new Set<ServerWebSocket<unknown>>()

// Enable Forge hot reload in development (watch shared and game directories)
const forgeHotReload = enableForgeHotReload('./game')
forgeHotReload.on((event: ForgeHotReloadEvent) => {
  // Broadcast to all connected clients
  const message = JSON.stringify(event)
  for (const client of hotReloadClients) {
    try {
      client.send(message)
    } catch {
      hotReloadClients.delete(client)
    }
  }

  // Log to console
  if (event.type === 'error') {
    console.error(`[Forge HMR] Error in ${event.filePath}:\n${event.error}`)
  } else {
    const name = event.asset?.id ?? event.layout?.id ?? event.entity?.id ?? 'unknown'
    console.log(`[Forge HMR] Reloaded ${event.type}: ${name}`)
  }
})

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/editor": editor,
    "/asset-editor": editor,
    "/forge": forgePreview,
    "/forge-preview": forgePreview,
  },
  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade for hot reload
    if (url.pathname === '/__forge_hmr') {
      const upgraded = server.upgrade(req)
      if (upgraded) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    // Manual reload trigger - sends reload signal to all connected clients
    if (url.pathname === '/__reload') {
      const reloadMessage = JSON.stringify({ type: 'reload' })
      for (const client of hotReloadClients) {
        try {
          client.send(reloadMessage)
        } catch {
          hotReloadClients.delete(client)
        }
      }
      console.log('[HMR] Triggered browser reload')
      return new Response('Reload triggered', { status: 200 })
    }

    // ==========================================================================
    // Asset API Endpoints
    // ==========================================================================

    // GET /api/assets - List all assets with metadata
    if (url.pathname === '/api/assets' && req.method === 'GET') {
      try {
        const files = await readdir(ASSETS_DIR)
        const assets: Array<{
          name: string
          filename: string
          description?: string
          tags?: string[]
        }> = []

        for (const file of files) {
          if (file.endsWith('.asset.json')) {
            const filePath = join(ASSETS_DIR, file)
            const content = await Bun.file(filePath).json()
            assets.push({
              name: content.name || file.replace('.asset.json', ''),
              filename: file.replace('.asset.json', ''),
              description: content.description,
              tags: content.metadata?.tags,
            })
          }
        }

        return new Response(JSON.stringify({ assets }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        console.error('[API] Error listing assets:', error)
        return new Response(JSON.stringify({ error: 'Failed to list assets' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // GET /api/assets/:name - Get specific asset
    const assetGetMatch = url.pathname.match(/^\/api\/assets\/([^/]+)$/)
    if (assetGetMatch && req.method === 'GET') {
      const assetName = assetGetMatch[1]
      const filePath = join(ASSETS_DIR, `${assetName}.asset.json`)
      const file = Bun.file(filePath)

      if (await file.exists()) {
        return new Response(file, {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // POST /api/assets/:name - Create or update asset
    if (assetGetMatch && req.method === 'POST') {
      const assetName = assetGetMatch[1]
      const filePath = join(ASSETS_DIR, `${assetName}.asset.json`)

      try {
        const body = await req.json()

        // Validate basic structure
        if (!body.name) {
          return new Response(JSON.stringify({ error: 'Asset must have a name' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        // Add/update metadata
        body.metadata = body.metadata || {}
        body.metadata.modified = new Date().toISOString().split('T')[0]
        if (!body.metadata.created) {
          body.metadata.created = body.metadata.modified
        }

        // Write file with pretty formatting
        await Bun.write(filePath, JSON.stringify(body, null, 2))

        // Notify hot reload clients
        const reloadMessage = JSON.stringify({
          type: 'asset',
          filePath: filePath,
          asset: { id: assetName, name: body.name }
        })
        for (const client of hotReloadClients) {
          try {
            client.send(reloadMessage)
          } catch {
            hotReloadClients.delete(client)
          }
        }

        console.log(`[API] Saved asset: ${assetName}`)
        return new Response(JSON.stringify({ success: true, name: assetName }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        console.error('[API] Error saving asset:', error)
        return new Response(JSON.stringify({ error: 'Failed to save asset' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    // DELETE /api/assets/:name - Delete asset
    if (assetGetMatch && req.method === 'DELETE') {
      const assetName = assetGetMatch[1]
      const filePath = join(ASSETS_DIR, `${assetName}.asset.json`)
      const file = Bun.file(filePath)

      if (await file.exists()) {
        try {
          await Bun.write(filePath, '') // Clear file
          const { unlink } = await import('node:fs/promises')
          await unlink(filePath)

          console.log(`[API] Deleted asset: ${assetName}`)
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.error('[API] Error deleting asset:', error)
          return new Response(JSON.stringify({ error: 'Failed to delete asset' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Serve .forge, .f2 and manifest.json files from game directory (any subdirectory)
    if (url.pathname.startsWith('/game/') && (url.pathname.endsWith('.forge') || url.pathname.endsWith('.f2') || url.pathname.endsWith('.json'))) {
      const filePath = `.${url.pathname}`
      const file = Bun.file(filePath)
      if (await file.exists()) {
        const contentType = url.pathname.endsWith('.json') ? 'application/json' : 'text/plain'
        return new Response(file, {
          headers: { 'Content-Type': contentType }
        })
      }
    }

    // Serve ship files (.sl, .json) from game/ships/
    if (url.pathname.startsWith('/game/ships/')) {
      const filePath = `.${url.pathname}`
      const file = Bun.file(filePath)
      if (await file.exists()) {
        const contentType = url.pathname.endsWith('.json') ? 'application/json' : 'text/plain'
        return new Response(file, {
          headers: { 'Content-Type': contentType }
        })
      }
    }

    // Serve static files from public/
    if (url.pathname.endsWith('.bin') || url.pathname.endsWith('.mesh.bin')) {
      const filePath = `./public${url.pathname}`
      const file = Bun.file(filePath)
      if (await file.exists()) {
        return new Response(file, {
          headers: { 'Content-Type': 'application/octet-stream' }
        })
      }
    }

    return new Response('Not found', { status: 404 })
  },
  websocket: {
    open(ws) {
      hotReloadClients.add(ws)
      console.log('[Forge HMR] Client connected')
    },
    message() {
      // Clients don't send messages
    },
    close(ws) {
      hotReloadClients.delete(ws)
      console.log('[Forge HMR] Client disconnected')
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})

console.log("Server running at http://localhost:3000")
console.log("Asset Viewer at http://localhost:3000/?game=asset-viewer")
console.log("Voxel Editor at http://localhost:3000/editor")
console.log("Forge Preview at http://localhost:3000/forge")
console.log("Asset API at http://localhost:3000/api/assets")
console.log("Forge HMR enabled - watching game/")
