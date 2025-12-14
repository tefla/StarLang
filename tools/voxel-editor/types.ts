// 3D Voxel grid - voxels[y][z][x] where Y is up
// Value is palette index, -1 = empty
export type VoxelGrid = number[][][]

export interface VoxelProject {
  name: string
  width: number   // X axis
  height: number  // Y axis (up)
  depth: number   // Z axis
  voxels: VoxelGrid
  palette: string[]
}

export type Tool = 'place' | 'erase' | 'pick'

export interface EditorState {
  project: VoxelProject
  selectedColor: number
  tool: Tool
  currentLayer: number  // Y level being edited
  showAllLayers: boolean
  showGrid: boolean
}

export function createEmptyProject(width = 16, height = 16, depth = 16): VoxelProject {
  const voxels: VoxelGrid = []
  for (let y = 0; y < height; y++) {
    const layer: number[][] = []
    for (let z = 0; z < depth; z++) {
      const row: number[] = []
      for (let x = 0; x < width; x++) {
        row.push(-1)
      }
      layer.push(row)
    }
    voxels.push(layer)
  }

  return {
    name: 'Untitled',
    width,
    height,
    depth,
    voxels,
    palette: [
      '#2d2d2d', // 0: dark gray
      '#5a5a5a', // 1: medium gray
      '#8a8a8a', // 2: light gray
      '#ffffff', // 3: white
      '#e74c3c', // 4: red
      '#e67e22', // 5: orange
      '#f1c40f', // 6: yellow
      '#2ecc71', // 7: green
      '#3498db', // 8: blue
      '#9b59b6', // 9: purple
      '#1abc9c', // 10: teal
      '#e91e63', // 11: pink
      '#795548', // 12: brown
      '#607d8b', // 13: blue gray
      '#ff9800', // 14: amber
      '#00bcd4', // 15: cyan
      '#00ff88', // 16: SCREEN (emissive in preview/game)
    ]
  }
}

export function getVoxel(project: VoxelProject, x: number, y: number, z: number): number {
  if (x < 0 || x >= project.width) return -1
  if (y < 0 || y >= project.height) return -1
  if (z < 0 || z >= project.depth) return -1
  return project.voxels[y][z][x]
}

export function setVoxel(project: VoxelProject, x: number, y: number, z: number, color: number): VoxelProject {
  if (x < 0 || x >= project.width) return project
  if (y < 0 || y >= project.height) return project
  if (z < 0 || z >= project.depth) return project

  const newVoxels = project.voxels.map((layer, ly) =>
    ly === y
      ? layer.map((row, lz) =>
          lz === z
            ? row.map((v, lx) => (lx === x ? color : v))
            : row
        )
      : layer
  )

  return { ...project, voxels: newVoxels }
}
