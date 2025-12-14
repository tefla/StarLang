import React from 'react'
import type { Tool } from './types'

interface Props {
  palette: string[]
  selectedColor: number
  tool: Tool
  currentLayer: number
  maxLayer: number
  showAllLayers: boolean
  showGrid: boolean
  onionSkinning: boolean
  onionLayers: number
  onColorSelect: (index: number) => void
  onToolSelect: (tool: Tool) => void
  onLayerChange: (layer: number) => void
  onToggleAllLayers: () => void
  onToggleGrid: () => void
  onToggleOnionSkinning: () => void
  onOnionLayersChange: (layers: number) => void
}

const styles = {
  toolbar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    padding: 16,
    background: '#16213e',
    borderRadius: 8,
    minWidth: 200,
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: '#888',
    letterSpacing: 1,
  },
  palette: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 4,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    outline: 'none',
  },
  tools: {
    display: 'flex',
    gap: 4,
  },
  toolBtn: {
    flex: 1,
    padding: '8px 4px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  layerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  layerBtn: {
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    background: '#2d2d2d',
    color: '#aaa',
    transition: 'all 0.15s',
  },
  layerValue: {
    flex: 1,
    textAlign: 'center' as const,
    fontWeight: 600,
    fontSize: 14,
  },
  toggles: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 4,
    cursor: 'pointer',
    color: '#aaa',
    fontSize: 12,
  },
  helpText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 1.4,
  },
}

export function Toolbar({
  palette,
  selectedColor,
  tool,
  currentLayer,
  maxLayer,
  showAllLayers,
  showGrid,
  onionSkinning,
  onionLayers,
  onColorSelect,
  onToolSelect,
  onLayerChange,
  onToggleAllLayers,
  onToggleGrid,
  onToggleOnionSkinning,
  onOnionLayersChange,
}: Props) {
  const tools: { id: Tool; label: string; hint: string }[] = [
    { id: 'place', label: 'Place', hint: 'Click to add voxel' },
    { id: 'erase', label: 'Erase', hint: 'Click voxel to remove' },
    { id: 'pick', label: 'Pick', hint: 'Click to sample color' },
  ]

  return (
    <div style={styles.toolbar}>
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Tools</div>
        <div style={styles.tools}>
          {tools.map(t => (
            <button
              key={t.id}
              title={t.hint}
              style={{
                ...styles.toolBtn,
                background: tool === t.id ? '#3498db' : '#2d2d2d',
                color: tool === t.id ? '#fff' : '#aaa',
              }}
              onClick={() => onToolSelect(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Layer (Y): {currentLayer}</div>
        <div style={styles.layerControls}>
          <button
            style={{
              ...styles.layerBtn,
              opacity: currentLayer > 0 ? 1 : 0.3,
            }}
            onClick={() => onLayerChange(Math.max(0, currentLayer - 1))}
            disabled={currentLayer <= 0}
          >
            -
          </button>
          <input
            type="range"
            min={0}
            max={maxLayer - 1}
            value={currentLayer}
            onChange={e => onLayerChange(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: '#3498db' }}
          />
          <button
            style={{
              ...styles.layerBtn,
              opacity: currentLayer < maxLayer - 1 ? 1 : 0.3,
            }}
            onClick={() => onLayerChange(Math.min(maxLayer - 1, currentLayer + 1))}
            disabled={currentLayer >= maxLayer - 1}
          >
            +
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Palette</div>
        <div style={styles.palette}>
          {palette.map((color, i) => (
            <button
              key={i}
              title={i === 16 ? 'Screen (emissive)' : `Color ${i}`}
              style={{
                ...styles.colorSwatch,
                background: color,
                boxShadow: selectedColor === i
                  ? '0 0 0 2px #fff, 0 0 0 4px #3498db'
                  : i === 16 ? '0 0 0 1px #00ff88' : 'none',
                position: 'relative' as const,
              }}
              onClick={() => onColorSelect(i)}
            >
              {i === 16 && (
                <span style={{
                  position: 'absolute',
                  bottom: 1,
                  right: 2,
                  fontSize: 8,
                  fontWeight: 'bold',
                  color: '#000',
                  textShadow: '0 0 2px #fff',
                }}>S</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>View</div>
        <div style={styles.toggles}>
          <button
            style={{
              ...styles.toggle,
              background: showGrid ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
              borderColor: showGrid ? '#3498db' : '#333',
              color: showGrid ? '#3498db' : '#aaa',
            }}
            onClick={onToggleGrid}
          >
            Show Grid
          </button>
          <button
            style={{
              ...styles.toggle,
              background: showAllLayers ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
              borderColor: showAllLayers ? '#3498db' : '#333',
              color: showAllLayers ? '#3498db' : '#aaa',
            }}
            onClick={onToggleAllLayers}
          >
            Show All Layers
          </button>
          <button
            style={{
              ...styles.toggle,
              background: onionSkinning ? 'rgba(155, 89, 182, 0.2)' : 'transparent',
              borderColor: onionSkinning ? '#9b59b6' : '#333',
              color: onionSkinning ? '#9b59b6' : '#aaa',
            }}
            onClick={onToggleOnionSkinning}
          >
            Onion Skin
          </button>
          {onionSkinning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#888' }}>Layers:</span>
              <input
                type="range"
                min={1}
                max={5}
                value={onionLayers}
                onChange={e => onOnionLayersChange(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: '#9b59b6' }}
              />
              <span style={{ fontSize: 10, color: '#9b59b6', width: 16 }}>{onionLayers}</span>
            </div>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Controls</div>
        <div style={styles.helpText}>
          <div>Left-click: Place/Erase</div>
          <div>Right-drag: Rotate view</div>
          <div>Scroll: Zoom</div>
        </div>
      </div>
    </div>
  )
}
