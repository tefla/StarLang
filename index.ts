import index from "./index.html"
import editor from "./asset-editor.html"

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/editor": editor,
    "/asset-editor": editor,
  },
  async fetch(req) {
    const url = new URL(req.url)

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
  development: {
    hmr: true,
    console: true,
  }
})

console.log("Server running at http://localhost:3000")
console.log("Voxel Editor at http://localhost:3000/editor")
