import index from "./index.html"
import editor from "./asset-editor.html"
import forgePreview from "./forge-preview.html"
import { enableForgeHotReload, type ForgeHotReloadEvent } from "./src/forge"
import type { ServerWebSocket } from "bun"

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
console.log("Voxel Editor at http://localhost:3000/editor")
console.log("Forge Preview at http://localhost:3000/forge")
console.log("Forge HMR enabled - watching game/")
