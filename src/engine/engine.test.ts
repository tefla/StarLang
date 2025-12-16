import { test, expect, describe, mock } from 'bun:test'
import { ScreenRenderer, EntitySystem, ForgeLoader } from './index'
import type { EntityScreenDef, RenderElement } from '../types/entity'

// Mock document.createElement for canvas
const mockCanvas = {
  width: 512,
  height: 384,
  getContext: () => ({
    fillStyle: '',
    fillRect: () => {},
    fillText: () => {},
    font: '',
    measureText: () => ({ width: 100 })
  })
}
// @ts-ignore - mocking for tests
global.document = {
  // @ts-ignore - minimal mock for tests
  createElement: () => mockCanvas
}

describe('ScreenRenderer', () => {
  const screenConfig: EntityScreenDef = {
    size: [512, 384],
    font: 'JetBrains Mono',
    fontSize: 16,
    background: '#1a2744',
    lineHeight: 20,
    padding: 20
  }

  test('creates renderer with config', () => {
    const renderer = new ScreenRenderer(screenConfig)
    expect(renderer.getSize()).toEqual([512, 384])
  })

  test('creates THREE texture', () => {
    const renderer = new ScreenRenderer(screenConfig)
    const texture = renderer.getTexture()
    expect(texture).toBeDefined()
  })

  test('renders text elements', () => {
    const elements: RenderElement[] = [
      { type: 'text', content: 'Hello World', centered: false }
    ]
    const renderer = new ScreenRenderer(screenConfig, {}, elements)
    // Should not throw
    renderer.render({ params: {} })
  })

  test('renders row elements', () => {
    const elements: RenderElement[] = [
      { type: 'row', label: 'Status:', value: 'OK' }
    ]
    const renderer = new ScreenRenderer(screenConfig, {}, elements)
    renderer.render({ params: {} })
  })

  test('renders match elements', () => {
    const elements: RenderElement[] = [
      {
        type: 'match',
        expression: '$type',
        cases: [
          { pattern: 'STATUS', elements: [{ type: 'text', content: 'Status View' }] },
          { pattern: 'COMMAND', elements: [{ type: 'text', content: 'Command View' }] }
        ]
      }
    ]
    const renderer = new ScreenRenderer(screenConfig, {}, elements)
    renderer.render({ params: { type: 'STATUS' } })
  })

  test('interpolates template strings', () => {
    const elements: RenderElement[] = [
      { type: 'text', content: 'Hello {$name}!' }
    ]
    const renderer = new ScreenRenderer(screenConfig, {}, elements)
    renderer.render({ params: { name: 'World' } })
  })
})

describe('EntitySystem', () => {
  test('registers entity definitions', () => {
    const system = new EntitySystem()
    system.registerDefinition({
      id: 'test-entity',
      params: { type: { type: 'string', default: 'default' } }
    })
    expect(system.getDefinition('test-entity')).toBeDefined()
  })

  test('returns undefined for unknown definitions', () => {
    const system = new EntitySystem()
    expect(system.getDefinition('unknown')).toBeUndefined()
  })

  test('getAllInstances returns empty array initially', () => {
    const system = new EntitySystem()
    expect(system.getAllInstances()).toEqual([])
  })
})

describe('ForgeLoader', () => {
  test('loads entity from source', () => {
    const loader = new ForgeLoader()
    const result = loader.loadSource(`
entity test-entity
  params:
    type: enum(A, B) = A
`)
    expect(result.errors).toEqual([])
    expect(result.entities.length).toBe(1)
    expect(result.entities[0]!.id).toBe('test-entity')
  })

  test('loads asset from source', () => {
    const loader = new ForgeLoader()
    const result = loader.loadSource(`
asset test-asset
  name: "Test Asset"
  anchor: (0, 0, 0)
`)
    expect(result.errors).toEqual([])
    expect(result.assets.length).toBe(1)
    expect(result.assets[0]!.id).toBe('test-asset')
  })

  test('caches loaded definitions', () => {
    const loader = new ForgeLoader()
    loader.loadSource(`
entity cached-entity
  params:
    x: int = 0
`)
    expect(loader.getEntity('cached-entity')).toBeDefined()
  })

  test('reports parse errors', () => {
    const loader = new ForgeLoader()
    const result = loader.loadSource(`
entity broken
  invalid syntax here @@@@
`)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('clears cache', () => {
    const loader = new ForgeLoader()
    loader.loadSource(`entity to-clear\n  params:\n    x: int = 0`)
    expect(loader.getEntity('to-clear')).toBeDefined()
    loader.clearCache()
    expect(loader.getEntity('to-clear')).toBeUndefined()
  })
})

describe('Integration: Terminal Entity', () => {
  test('loads terminal entity from Forge', async () => {
    const loader = new ForgeLoader()
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = loader.loadSource(source)
    expect(result.errors).toEqual([])
    expect(result.entities.length).toBe(1)

    const terminal = result.entities[0]!
    expect(terminal.id).toBe('terminal')
    expect(terminal.screen).toBeDefined()
    expect(terminal.render).toBeDefined()
    expect(terminal.styles).toBeDefined()
    expect(terminal.events).toBeDefined()
  })

  test('creates screen renderer from terminal definition', async () => {
    const loader = new ForgeLoader()
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = loader.loadSource(source)
    const terminal = result.entities[0]!

    const renderer = new ScreenRenderer(
      terminal.screen!,
      terminal.styles,
      terminal.render
    )

    expect(renderer.getSize()).toEqual([512, 384])

    // Render with STATUS type
    renderer.render({ params: { type: 'STATUS', display_name: 'Test Terminal' } })
  })
})
