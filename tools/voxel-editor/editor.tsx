import React, { useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { VoxelEditor3D } from './VoxelEditor3D'
import { Preview3D } from './Preview3D'
import { Toolbar } from './Toolbar'
import { Gallery } from './Gallery'
import { createEmptyProject, setVoxel, type Tool, type VoxelProject } from './types'
import { exportToGLTF, downloadBlob } from './exporter'

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    background: '#1a1a2e',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: '#16213e',
    borderBottom: '1px solid #0f3460',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
  },
  headerActions: {
    display: 'flex',
    gap: 8,
  },
  btn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,  // Important for nested flex
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    padding: 16,
    borderRight: '1px solid #0f3460',
    overflowY: 'auto' as const,
    width: 240,
    flexShrink: 0,
  },
  workspace: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,  // Important for flex children to shrink
  },
  editorPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    borderRight: '1px solid #0f3460',
    minWidth: 0,
  },
  previewPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0,
  },
  panelHeader: {
    padding: '8px 16px',
    background: '#16213e',
    fontSize: 12,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    flexShrink: 0,
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
  },
  sizeSelector: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  select: {
    padding: '6px 12px',
    background: '#2d2d2d',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#fff',
    fontSize: 13,
  },
}

function App() {
  const [project, setProject] = useState<VoxelProject>(() => createEmptyProject(16, 16, 16))
  const [selectedColor, setSelectedColor] = useState(4)
  const [tool, setTool] = useState<Tool>('place')
  const [currentLayer, setCurrentLayer] = useState(0)
  const [showAllLayers, setShowAllLayers] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [onionSkinning, setOnionSkinning] = useState(true)
  const [onionLayers, setOnionLayers] = useState(3)

  const handleVoxelChange = useCallback((x: number, y: number, z: number, color: number) => {
    setProject(prev => setVoxel(prev, x, y, z, color))
  }, [])

  const handleNew = (size: number) => {
    if (confirm('Create new project? Unsaved changes will be lost.')) {
      setProject(createEmptyProject(size, size, size))
      setCurrentLayer(0)
    }
  }

  const handleClear = () => {
    if (confirm('Clear all voxels?')) {
      setProject(prev => createEmptyProject(prev.width, prev.height, prev.depth))
    }
  }

  const handleSaveFile = () => {
    const json = JSON.stringify(project, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name || 'voxel-asset'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const loaded = JSON.parse(text) as VoxelProject
        setProject(loaded)
        setCurrentLayer(0)
      } catch (err) {
        alert('Invalid project file')
      }
    }
    input.click()
  }

  const handleExportGLTF = async () => {
    try {
      const blob = await exportToGLTF(project)
      downloadBlob(blob, `${project.name || 'voxel-asset'}.glb`)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Check console for details.')
    }
  }

  const handleLoadFromGallery = (loadedProject: VoxelProject) => {
    setProject(loadedProject)
    setCurrentLayer(0)
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.title}>Voxel Asset Editor</div>
        <div style={styles.headerActions}>
          <div style={styles.sizeSelector}>
            <span style={{ color: '#888', fontSize: 12 }}>Size:</span>
            <select
              style={styles.select}
              value={`${project.width}`}
              onChange={e => handleNew(parseInt(e.target.value))}
            >
              <option value="8">8x8x8</option>
              <option value="16">16x16x16</option>
              <option value="32">32x32x32</option>
            </select>
          </div>
          <button
            style={{ ...styles.btn, background: '#2d2d2d', color: '#aaa' }}
            onClick={handleClear}
          >
            Clear
          </button>
          <button
            style={{ ...styles.btn, background: '#2d2d2d', color: '#aaa' }}
            onClick={handleLoadFile}
          >
            Load File
          </button>
          <button
            style={{ ...styles.btn, background: '#3498db', color: '#fff' }}
            onClick={handleSaveFile}
          >
            Save File
          </button>
          <button
            style={{ ...styles.btn, background: '#27ae60', color: '#fff' }}
            onClick={handleExportGLTF}
          >
            Export glTF
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <aside style={styles.sidebar}>
          <Toolbar
            palette={project.palette}
            selectedColor={selectedColor}
            tool={tool}
            currentLayer={currentLayer}
            maxLayer={project.height}
            showAllLayers={showAllLayers}
            showGrid={showGrid}
            onionSkinning={onionSkinning}
            onionLayers={onionLayers}
            onColorSelect={setSelectedColor}
            onToolSelect={setTool}
            onLayerChange={setCurrentLayer}
            onToggleAllLayers={() => setShowAllLayers(v => !v)}
            onToggleGrid={() => setShowGrid(v => !v)}
            onToggleOnionSkinning={() => setOnionSkinning(v => !v)}
            onOnionLayersChange={setOnionLayers}
          />
          <Gallery
            currentProject={project}
            onLoad={handleLoadFromGallery}
          />
        </aside>

        <div style={styles.workspace}>
          <div style={styles.editorPanel}>
            <div style={styles.panelHeader}>Editor (Layer {currentLayer})</div>
            <div style={styles.panelContent}>
              <VoxelEditor3D
                project={project}
                selectedColor={selectedColor}
                tool={tool}
                currentLayer={currentLayer}
                showAllLayers={showAllLayers}
                showGrid={showGrid}
                onionSkinning={onionSkinning}
                onionLayers={onionLayers}
                onVoxelChange={handleVoxelChange}
                onColorPick={setSelectedColor}
              />
            </div>
          </div>
          <div style={styles.previewPanel}>
            <div style={styles.panelHeader}>Preview (All Layers)</div>
            <div style={styles.panelContent}>
              <Preview3D project={project} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
