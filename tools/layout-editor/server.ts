// Layout Editor Server
import index from './index.html'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const LAYOUTS_DIR = join(import.meta.dir, '../../src/content/ship')

const server = Bun.serve({
  port: 3001,
  routes: {
    '/': index,

    // List available layout files
    '/api/layouts': {
      GET: async () => {
        try {
          const files = await readdir(LAYOUTS_DIR)
          const layouts = files.filter(f => f.endsWith('.layout.json'))
          return Response.json({ layouts })
        } catch (err) {
          return Response.json({ error: 'Failed to list layouts' }, { status: 500 })
        }
      }
    },

    // Load a specific layout file
    '/api/layouts/:name': {
      GET: async (req) => {
        const name = req.params.name
        if (!name.endsWith('.layout.json')) {
          return Response.json({ error: 'Invalid file name' }, { status: 400 })
        }
        try {
          const filePath = join(LAYOUTS_DIR, name)
          const file = Bun.file(filePath)
          const content = await file.json()
          return Response.json(content)
        } catch (err) {
          return Response.json({ error: 'Failed to load layout' }, { status: 500 })
        }
      },

      // Save a layout file
      PUT: async (req) => {
        const name = req.params.name
        if (!name.endsWith('.layout.json')) {
          return Response.json({ error: 'Invalid file name' }, { status: 400 })
        }
        try {
          const data = await req.json()
          const filePath = join(LAYOUTS_DIR, name)
          await Bun.write(filePath, JSON.stringify(data, null, 2))
          console.log(`Saved layout: ${name}`)
          return Response.json({ success: true })
        } catch (err) {
          return Response.json({ error: 'Failed to save layout' }, { status: 500 })
        }
      }
    },

    // Create a new layout file
    '/api/layouts/new/:name': {
      POST: async (req) => {
        let name = req.params.name
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
          return Response.json({ error: 'Failed to create layout' }, { status: 500 })
        }
      }
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})

console.log(`Layout Editor running at http://localhost:${server.port}`)
