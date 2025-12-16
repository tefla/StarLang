// Forge Hot Reload Client - Browser-side hot reload support
// Connects to the dev server's WebSocket and handles reload events

import type { ForgeHotReloadEvent, ForgeHotReloadHandler } from './hot-reload'

/**
 * ForgeHotReloadClient - Connects to the dev server for hot reload events.
 */
export class ForgeHotReloadClient {
  private ws: WebSocket | null = null
  private handlers: Set<ForgeHotReloadHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000

  constructor(private wsUrl = `ws://${window.location.host}/__forge_hmr`) {}

  /**
   * Connect to the hot reload WebSocket.
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(this.wsUrl)

      this.ws.onopen = () => {
        console.log('[Forge HMR] Connected to hot reload server')
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ForgeHotReloadEvent
          this.emit(data)
        } catch (e) {
          console.error('[Forge HMR] Failed to parse message:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('[Forge HMR] Disconnected from hot reload server')
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('[Forge HMR] WebSocket error:', error)
      }

    } catch (e) {
      console.error('[Forge HMR] Failed to connect:', e)
      this.scheduleReconnect()
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Forge HMR] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5)

    setTimeout(() => {
      console.log(`[Forge HMR] Reconnecting... (attempt ${this.reconnectAttempts})`)
      this.connect()
    }, delay)
  }

  /**
   * Subscribe to hot reload events.
   */
  on(handler: ForgeHotReloadHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /**
   * Emit an event to all handlers.
   */
  private emit(event: ForgeHotReloadEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (e) {
        console.error('[Forge HMR] Handler error:', e)
      }
    }
  }

  /**
   * Disconnect from the hot reload server.
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.handlers.clear()
  }
}

// Singleton instance
let clientInstance: ForgeHotReloadClient | null = null

/**
 * Get or create the global hot reload client.
 */
export function getForgeHotReloadClient(): ForgeHotReloadClient {
  if (!clientInstance) {
    clientInstance = new ForgeHotReloadClient()
  }
  return clientInstance
}

/**
 * Enable hot reload in the browser.
 * Connects to the dev server and returns a cleanup function.
 */
export function enableClientHotReload(handler?: ForgeHotReloadHandler): () => void {
  const client = getForgeHotReloadClient()
  client.connect()

  let unsubscribe: (() => void) | undefined
  if (handler) {
    unsubscribe = client.on(handler)
  }

  return () => {
    unsubscribe?.()
    client.disconnect()
  }
}
