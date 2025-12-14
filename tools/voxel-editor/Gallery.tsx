import React, { useState, useEffect } from 'react'
import type { VoxelProject } from './types'

// Bundled assets
import terminalAsset from './assets/terminal.json'
import tableAsset from './assets/table.json'

interface SavedAsset {
  id: string
  name: string
  project: VoxelProject
  thumbnail: string  // base64 data URL
  savedAt: number
}

interface PresetAsset {
  id: string
  name: string
  project: VoxelProject
}

const PRESET_ASSETS: PresetAsset[] = [
  { id: 'terminal', name: 'Terminal', project: terminalAsset as VoxelProject },
  { id: 'table', name: 'Table', project: tableAsset as VoxelProject },
]

interface Props {
  onLoad: (project: VoxelProject) => void
  currentProject: VoxelProject
}

const STORAGE_KEY = 'voxel-editor-assets'

export function loadAssets(): SavedAsset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveAsset(asset: SavedAsset) {
  const assets = loadAssets()
  const existingIndex = assets.findIndex(a => a.id === asset.id)
  if (existingIndex >= 0) {
    assets[existingIndex] = asset
  } else {
    assets.unshift(asset)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets))
}

export function deleteAsset(id: string) {
  const assets = loadAssets().filter(a => a.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets))
}

const styles = {
  gallery: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    padding: 16,
    background: '#16213e',
    borderRadius: 8,
    maxHeight: 400,
    overflowY: 'auto' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: '#888',
    letterSpacing: 1,
  },
  saveBtn: {
    padding: '4px 12px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    background: '#27ae60',
    color: '#fff',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  assetCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#0d0d1a',
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: '2px solid transparent',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover' as const,
    background: '#1a1a2e',
  },
  assetInfo: {
    padding: 6,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetName: {
    fontSize: 10,
    fontWeight: 500,
    color: '#aaa',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  deleteBtn: {
    padding: '2px 6px',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
    background: 'transparent',
    color: '#666',
  },
  empty: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center' as const,
    padding: 20,
  },
  nameInput: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #333',
    borderRadius: 4,
    background: '#0d0d1a',
    color: '#fff',
    fontSize: 12,
    marginBottom: 8,
  },
}

export function Gallery({ onLoad, currentProject }: Props) {
  const [assets, setAssets] = useState<SavedAsset[]>([])
  const [assetName, setAssetName] = useState(currentProject.name || '')

  useEffect(() => {
    setAssets(loadAssets())
  }, [])

  useEffect(() => {
    setAssetName(currentProject.name || '')
  }, [currentProject.name])

  const handleSave = () => {
    const name = assetName.trim() || 'Untitled'
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()

    // Generate thumbnail from canvas
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, 64, 64)

    // Simple top-down thumbnail
    const { width, depth, height, voxels, palette } = currentProject
    const scale = Math.min(60 / width, 60 / depth)
    const offsetX = (64 - width * scale) / 2
    const offsetY = (64 - depth * scale) / 2

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        // Find highest voxel at this x,z
        for (let y = height - 1; y >= 0; y--) {
          const colorIndex = voxels[y]?.[z]?.[x]
          if (colorIndex >= 0) {
            ctx.fillStyle = palette[colorIndex]
            ctx.fillRect(offsetX + x * scale, offsetY + z * scale, scale, scale)
            break
          }
        }
      }
    }

    const thumbnail = canvas.toDataURL('image/png')

    const asset: SavedAsset = {
      id,
      name,
      project: { ...currentProject, name },
      thumbnail,
      savedAt: Date.now(),
    }

    saveAsset(asset)
    setAssets(loadAssets())
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Delete this asset?')) {
      deleteAsset(id)
      setAssets(loadAssets())
    }
  }

  const handleLoad = (asset: SavedAsset) => {
    onLoad(asset.project)
    setAssetName(asset.name)
  }

  const generateThumbnail = (project: VoxelProject): string => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, 64, 64)

    const { width, depth, height, voxels, palette } = project
    const scale = Math.min(60 / width, 60 / depth)
    const offsetX = (64 - width * scale) / 2
    const offsetY = (64 - depth * scale) / 2

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        for (let y = height - 1; y >= 0; y--) {
          const colorIndex = voxels[y]?.[z]?.[x]
          if (colorIndex >= 0) {
            ctx.fillStyle = palette[colorIndex]
            ctx.fillRect(offsetX + x * scale, offsetY + z * scale, scale, scale)
            break
          }
        }
      }
    }
    return canvas.toDataURL('image/png')
  }

  return (
    <div style={styles.gallery}>
      <div style={styles.header}>
        <div style={styles.title}>Presets</div>
      </div>
      <div style={styles.grid}>
        {PRESET_ASSETS.map(asset => (
          <div
            key={asset.id}
            style={styles.assetCard}
            onClick={() => onLoad(asset.project)}
            onMouseOver={e => (e.currentTarget.style.borderColor = '#27ae60')}
            onMouseOut={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <img
              src={generateThumbnail(asset.project)}
              alt={asset.name}
              style={styles.thumbnail}
            />
            <div style={styles.assetInfo}>
              <div style={styles.assetName}>{asset.name}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...styles.header, marginTop: 12 }}>
        <div style={styles.title}>My Assets</div>
      </div>

      <input
        type="text"
        placeholder="Asset name..."
        value={assetName}
        onChange={e => setAssetName(e.target.value)}
        style={styles.nameInput}
      />

      <button style={styles.saveBtn} onClick={handleSave}>
        Save to Gallery
      </button>

      {assets.length === 0 ? (
        <div style={styles.empty}>No saved assets yet</div>
      ) : (
        <div style={styles.grid}>
          {assets.map(asset => (
            <div
              key={asset.id}
              style={styles.assetCard}
              onClick={() => handleLoad(asset)}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#3498db')}
              onMouseOut={e => (e.currentTarget.style.borderColor = 'transparent')}
            >
              <img src={asset.thumbnail} alt={asset.name} style={styles.thumbnail} />
              <div style={styles.assetInfo}>
                <div style={styles.assetName}>{asset.name}</div>
                <button
                  style={styles.deleteBtn}
                  onClick={e => handleDelete(e, asset.id)}
                  onMouseOver={e => (e.currentTarget.style.color = '#e74c3c')}
                  onMouseOut={e => (e.currentTarget.style.color = '#666')}
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
