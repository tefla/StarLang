import index from "./index.html"
import editor from "./editor.html"

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/editor": editor,
  },
  development: {
    hmr: true,
    console: true,
  }
})

console.log("Server running at http://localhost:3000")
console.log("Voxel Editor at http://localhost:3000/editor")
