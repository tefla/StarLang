import { test, expect, describe } from 'bun:test'
import { tokenize, parse, compileAsset, compileLayout, compileEntity } from './index'

describe('Forge Lexer', () => {
  test('tokenizes basic asset header', () => {
    const tokens = tokenize('asset wall-fan')
    expect(tokens.map(t => t.type)).toEqual(['KEYWORD', 'IDENTIFIER', 'EOF'])
    expect(tokens[0]!.value).toBe('asset')
    expect(tokens[1]!.value).toBe('wall-fan')
  })

  test('tokenizes indented block', () => {
    const source = `asset foo
  name: "Test"`
    const tokens = tokenize(source)
    const types = tokens.map(t => t.type)
    expect(types).toContain('INDENT')
    expect(types).toContain('DEDENT')
  })

  test('tokenizes color literals', () => {
    const tokens = tokenize('#ff0000')
    expect(tokens[0]!.type).toBe('COLOR')
    expect(tokens[0]!.value).toBe('#ff0000')
  })

  test('tokenizes duration literals', () => {
    const tokens = tokenize('300ms 2s')
    expect(tokens[0]!.type).toBe('DURATION')
    expect(tokens[0]!.value).toBe('300ms')
    expect(tokens[1]!.type).toBe('DURATION')
    expect(tokens[1]!.value).toBe('2s')
  })

  test('tokenizes reactive references', () => {
    const tokens = tokenize('$powered $speed')
    expect(tokens[0]!.type).toBe('DOLLAR')
    expect(tokens[1]!.type).toBe('IDENTIFIER')
    expect(tokens[1]!.value).toBe('powered')
  })

  test('tokenizes arrows', () => {
    const tokens = tokenize('-> <->')
    expect(tokens[0]!.type).toBe('ARROW')
    expect(tokens[1]!.type).toBe('BIARROW')
  })

  test('tokenizes vectors', () => {
    const tokens = tokenize('(1, 2, 3)')
    expect(tokens.map(t => t.type)).toEqual([
      'LPAREN', 'NUMBER', 'COMMA', 'NUMBER', 'COMMA', 'NUMBER', 'RPAREN', 'EOF'
    ])
  })
})

describe('Forge Parser', () => {
  test('parses minimal asset', () => {
    const ast = parse(`asset test
  name: "Test Asset"
  anchor: (0, 0, 0)`)

    expect(ast.definitions.length).toBe(1)
    expect(ast.definitions[0]!.kind).toBe('asset')

    const asset = ast.definitions[0]!
    if (asset.kind === 'asset') {
      expect(asset.name).toBe('test')
      expect(asset.displayName).toBe('Test Asset')
      expect(asset.anchor?.kind).toBe('vec3')
    }
  })

  test('parses geometry block', () => {
    const ast = parse(`asset box-test
  geometry:
    box (0, 0, 0) to (10, 10, 10) as METAL`)

    const asset = ast.definitions[0]!
    if (asset.kind === 'asset') {
      expect(asset.geometry).toBeDefined()
      expect(asset.geometry!.primitives.length).toBe(1)
      expect(asset.geometry!.primitives[0]!.kind).toBe('box')
    }
  })

  test('parses params block', () => {
    const ast = parse(`asset param-test
  params:
    speed: float[0..10] = 4.0
    state: enum(ON, OFF) = ON
    enabled: bool = true`)

    const asset = ast.definitions[0]!
    if (asset.kind === 'asset') {
      expect(asset.params).toBeDefined()
      expect(asset.params!.params.length).toBe(3)

      const speedParam = asset.params!.params[0]!
      expect(speedParam.name).toBe('speed')
      expect(speedParam.type.name).toBe('float')
      expect(speedParam.type.constraint).toBeDefined()
    }
  })

  test('parses child reference', () => {
    const ast = parse(`asset parent
  child fan-blades at (8, 8, 3):
    animate spin on z`)

    const asset = ast.definitions[0]!
    if (asset.kind === 'asset') {
      expect(asset.children).toBeDefined()
      expect(asset.children!.length).toBe(1)
      expect(asset.children![0]!.asset).toBe('fan-blades')
    }
  })
})

describe('Forge Compiler', () => {
  test('compiles basic asset', () => {
    const result = compileAsset(`asset simple
  name: "Simple Asset"
  anchor: (5, 5, 0)
  geometry:
    box (0, 0, 0) to (10, 10, 2) as METAL`)

    expect(result).not.toBeNull()
    expect(result!.id).toBe('simple')
    expect(result!.name).toBe('Simple Asset')
    expect(result!.anchor).toEqual({ x: 5, y: 5, z: 0 })
    expect(result!.voxels.length).toBeGreaterThan(0)
  })

  test('compiles asset with params', () => {
    const result = compileAsset(`asset with-params
  params:
    speed: float[0..10] = 2.0
    enabled: bool = true`)

    expect(result).not.toBeNull()
    expect(result!.parameters).toBeDefined()
    expect(result!.parameters!.speed).toEqual({
      type: 'number',
      default: 2.0
    })
    expect(result!.parameters!.enabled).toEqual({
      type: 'boolean',
      default: true
    })
  })
})

describe('Door Sliding Integration', () => {
  test('parses door-sliding.asset.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/assets/door-sliding.asset.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    expect(ast.definitions.length).toBe(1)

    const asset = ast.definitions[0]!
    if (asset.kind === 'asset') {
      expect(asset.name).toBe('door-sliding')
      expect(asset.parts).toBeDefined()
      expect(asset.parts!.parts.length).toBe(2)
      expect(asset.states).toBeDefined()
      expect(asset.animations).toBeDefined()
    }
  })

  test('compiles door-sliding.asset.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/assets/door-sliding.asset.forge', import.meta.url)
    ).text()

    const result = compileAsset(source)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('door-sliding')

    // Should have dynamic parts
    expect(result!.dynamicParts).toBeDefined()
    expect(result!.dynamicParts!.length).toBe(2)

    // Should have states
    expect(result!.states).toBeDefined()
    expect(result!.states!.closed).toBeDefined()
    expect(result!.states!.open).toBeDefined()
    expect(result!.states!.locked).toBeDefined()
    expect(result!.states!.sealed).toBeDefined()

    // Should have animations
    expect(result!.animations).toBeDefined()
    expect(result!.animations!.open).toBeDefined()
    expect(result!.animations!.close).toBeDefined()
    expect(result!.animations!.open.duration).toBe(300)

    // Should have state bindings
    expect(result!.stateBindings).toBeDefined()

    // Should have parameters
    expect(result!.parameters).toBeDefined()
    expect(result!.parameters!.state).toBeDefined()
  })
})

describe('Fan Blades Integration', () => {
  test('parses fan-blades.asset.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/assets/fan-blades.asset.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    expect(ast.definitions.length).toBe(1)

    const asset = ast.definitions[0]!
    if (asset.kind === 'asset') {
      expect(asset.name).toBe('fan-blades')
      // Now has parts instead of geometry (for AnimatedAssetInstance support)
      expect(asset.parts).toBeDefined()
      // AST structure: asset.parts = { kind: 'parts', parts: [...] }
      expect(asset.parts!.parts.length).toBe(1)
      expect(asset.parts!.parts[0]!.name).toBe('rotor')
      // 4 hub voxels + 4 repeat blocks in the rotor part
      expect(asset.parts!.parts[0]!.geometry.length).toBe(8)
    }
  })

  test('compiles fan-blades.asset.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/assets/fan-blades.asset.forge', import.meta.url)
    ).text()

    const result = compileAsset(source)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('fan-blades')
    expect(result!.anchor).toEqual({ x: 6, y: 6, z: 0 })

    // Now has dynamicParts instead of static voxels (for AnimatedAssetInstance)
    expect(result!.dynamicParts).toBeDefined()
    expect(result!.dynamicParts!.length).toBe(1)
    expect(result!.dynamicParts![0]!.id).toBe('rotor')

    // Rotor should have 44 voxels: 4 hub + 10*4 blade
    const rotorVoxels = result!.dynamicParts![0]!.voxels
    expect(rotorVoxels.length).toBe(44)

    // Check hub voxels
    const hubVoxels = rotorVoxels.filter(v => v.type === 'FAN_HUB')
    expect(hubVoxels.length).toBe(4)

    // Check blade voxels
    const bladeVoxels = rotorVoxels.filter(v => v.type === 'FAN_BLADE')
    expect(bladeVoxels.length).toBe(40)
  })
})

describe('Wall Fan Integration', () => {
  test('parses wall-fan.asset.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/assets/wall-fan.asset.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    expect(ast.definitions.length).toBe(1)

    const asset = ast.definitions[0]!
    if (asset.kind === 'asset') {
      expect(asset.name).toBe('wall-fan')
      expect(asset.displayName).toBe('Wall Ventilation Fan')
      expect(asset.geometry).toBeDefined()
      expect(asset.children).toBeDefined()
      expect(asset.params).toBeDefined()
    }
  })

  test('compiles wall-fan.asset.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/assets/wall-fan.asset.forge', import.meta.url)
    ).text()

    const result = compileAsset(source)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('wall-fan')
    expect(result!.name).toBe('Wall Ventilation Fan')
    expect(result!.anchor).toEqual({ x: 8, y: 8, z: 0 })

    // Should have voxels from the duct geometry
    expect(result!.voxels.length).toBeGreaterThan(0)

    // Should have child reference with animation
    expect(result!.children).toBeDefined()
    expect(result!.children!.length).toBe(1)
    expect(result!.children![0]!.asset).toBe('fan-blades')
    expect(result!.children![0]!.offset).toEqual([8, 8, 3])
    expect(result!.children![0]!.animate).toBeDefined()
    expect(result!.children![0]!.animate!.type).toBe('spin')
    expect(result!.children![0]!.animate!.axis).toBe('z')

    // Should have params
    expect(result!.parameters).toBeDefined()
    expect(result!.parameters!.powered).toBeDefined()
    expect(result!.parameters!.speed).toBeDefined()
  })
})

describe('Galley Layout Integration', () => {
  test('parses galley.layout.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/layouts/galley.layout.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    expect(ast.definitions.length).toBe(1)

    const layout = ast.definitions[0]!
    if (layout.kind === 'layout') {
      expect(layout.name).toBe('galley-deck')
      expect(layout.coordinate).toBe('voxel')
      expect(layout.rooms.length).toBe(3)
      expect(layout.doors.length).toBe(2)
      expect(layout.terminals.length).toBe(3)
      expect(layout.switches.length).toBe(3)
      expect(layout.wallLights.length).toBe(4)
      expect(layout.assets.length).toBe(2)
    }
  })

  test('compiles galley.layout.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/layouts/galley.layout.forge', import.meta.url)
    ).text()

    const result = compileLayout(source)
    expect(result).not.toBeNull()

    // Check rooms
    expect(result!.rooms).toBeDefined()
    expect(Object.keys(result!.rooms).length).toBe(3)
    expect(result!.rooms.galley).toBeDefined()
    expect(result!.rooms.galley.position).toEqual({ x: -16, y: 0, z: 0 })
    expect(result!.rooms.galley.size).toEqual({ width: 240, height: 120, depth: 240 })

    // Check doors
    expect(result!.doors).toBeDefined()
    expect(Object.keys(result!.doors!).length).toBe(2)
    expect(result!.doors!.galley_exit).toBeDefined()
    expect(result!.doors!.galley_exit.rotation).toBe(90) // east

    // Check terminals
    expect(result!.terminals).toBeDefined()
    expect(Object.keys(result!.terminals!).length).toBe(3)

    // Check switches
    expect(result!.switches).toBeDefined()
    expect(Object.keys(result!.switches!).length).toBe(3)
    expect(result!.switches!.door_switch.status).toBe('FAULT')

    // Check wall lights
    expect(result!.wallLights).toBeDefined()
    expect(Object.keys(result!.wallLights!).length).toBe(4)
    expect(result!.wallLights!['wall-light-1'].color).toBe('#ffffee')

    // Check asset instances
    expect(result!.assetInstances).toBeDefined()
    expect(Object.keys(result!.assetInstances!).length).toBe(2)
    expect(result!.assetInstances!.galley_vent_fan.asset).toBe('wall-fan')
  })
})

describe('Terminal Entity Integration', () => {
  test('parses terminal.entity.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    expect(ast.definitions.length).toBe(1)

    const entity = ast.definitions[0]!
    if (entity.kind === 'entity') {
      expect(entity.name).toBe('terminal')
      expect(entity.params).toBeDefined()
      expect(entity.params!.params.length).toBe(4)
      expect(entity.screen).toBeDefined()
      expect(entity.render).toBeDefined()
      expect(entity.styles).toBeDefined()
      expect(entity.body).toBeDefined()
    }
  })

  test('parses screen block properties', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    const entity = ast.definitions[0]!

    if (entity.kind === 'entity' && entity.screen) {
      expect(entity.screen.size.kind).toBe('vec2')
      expect(entity.screen.font).toBe('JetBrains Mono')
      expect(entity.screen.fontSize).toBe(16)
      expect(entity.screen.background?.value).toBe('#1a2744')
      expect(entity.screen.lineHeight).toBe(20)
      expect(entity.screen.padding).toBe(20)
    }
  })

  test('parses render block with match statement', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    const entity = ast.definitions[0]!

    if (entity.kind === 'entity' && entity.render) {
      expect(entity.render.body.length).toBe(1)
      expect(entity.render.body[0]!.kind).toBe('match')
    }
  })

  test('parses styles block', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    const entity = ast.definitions[0]!

    if (entity.kind === 'entity' && entity.styles) {
      expect(entity.styles.styles.length).toBe(6)
      const headerStyle = entity.styles.styles.find(s => s.name === 'header')
      expect(headerStyle).toBeDefined()
      expect(headerStyle!.properties.color).toBeDefined()
    }
  })

  test('parses on event handlers', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const ast = parse(source)
    const entity = ast.definitions[0]!

    if (entity.kind === 'entity' && entity.body) {
      expect(entity.body.length).toBe(4)

      // Check focus handler
      const focusHandler = entity.body[0]!
      expect(focusHandler.kind).toBe('on')
      if (focusHandler.kind === 'on') {
        expect(focusHandler.event).toBe('focus')
      }

      // Check click handler with condition
      const clickHandler = entity.body[2]!
      expect(clickHandler.kind).toBe('on')
      if (clickHandler.kind === 'on') {
        expect(clickHandler.event).toBe('click')
        expect(clickHandler.condition).toBeDefined()
      }
    }
  })

  test('compiles terminal.entity.forge', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = compileEntity(source)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('terminal')
  })

  test('compiles entity params', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = compileEntity(source)
    expect(result!.params).toBeDefined()
    expect(result!.params!.type).toBeDefined()
    expect(result!.params!.type.type).toBe('enum')
    expect(result!.params!.type.enumValues).toEqual(['STATUS', 'ENGINEERING', 'COMMAND'])
    expect(result!.params!.type.default).toBe('STATUS')

    expect(result!.params!.focused).toBeDefined()
    expect(result!.params!.focused.type).toBe('boolean')
    expect(result!.params!.focused.default).toBe(false)
  })

  test('compiles entity screen', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = compileEntity(source)
    expect(result!.screen).toBeDefined()
    expect(result!.screen!.size).toEqual([512, 384])
    expect(result!.screen!.font).toBe('JetBrains Mono')
    expect(result!.screen!.fontSize).toBe(16)
    expect(result!.screen!.background).toBe('#1a2744')
    expect(result!.screen!.lineHeight).toBe(20)
    expect(result!.screen!.padding).toBe(20)
  })

  test('compiles entity render block', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = compileEntity(source)
    expect(result!.render).toBeDefined()
    expect(result!.render!.length).toBe(1)
    expect(result!.render![0]!.type).toBe('match')
  })

  test('compiles entity styles', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = compileEntity(source)
    expect(result!.styles).toBeDefined()
    expect(Object.keys(result!.styles!).length).toBe(6)
    expect(result!.styles!.header).toBeDefined()
    expect(result!.styles!.header.color).toBe('#4a6fa5')
    expect(result!.styles!.success.color).toBe('#77dd77')
    expect(result!.styles!.error.color).toBe('#ff6b6b')
  })

  test('compiles entity event handlers', async () => {
    const source = await Bun.file(
      new URL('../content/forge/entities/terminal.entity.forge', import.meta.url)
    ).text()

    const result = compileEntity(source)
    expect(result!.events).toBeDefined()
    expect(result!.events!.length).toBe(4)

    // Check focus handler
    const focusHandler = result!.events!.find(e => e.event === 'focus')
    expect(focusHandler).toBeDefined()
    expect(focusHandler!.actions.length).toBe(2)
    expect(focusHandler!.actions[0]).toEqual({ type: 'set', property: 'focused', value: true })
    expect(focusHandler!.actions[1]).toEqual({ type: 'emit', event: 'terminal:focus' })

    // Check click handler with condition
    const clickHandler = result!.events!.find(e => e.event === 'click')
    expect(clickHandler).toBeDefined()
    expect(clickHandler!.condition).toBe('$type == ENGINEERING')
  })
})

describe('Forge Error Formatting', () => {
  test('formats parse error with source context', () => {
    const source = `asset broken
  params:
    x: invalid@@syntax
`
    expect(() => compileAsset(source, 'test.forge')).toThrow()

    try {
      compileAsset(source, 'test.forge')
    } catch (e: unknown) {
      const message = (e as Error).message
      expect(message).toContain('error:')
      expect(message).toContain('test.forge')
      expect(message).toContain('3:')  // Line number
    }
  })

  test('formats error without file path', () => {
    const source = `entity broken
  params:
    bad syntax here!!!
`
    expect(() => compileEntity(source)).toThrow()

    try {
      compileEntity(source)
    } catch (e: unknown) {
      const message = (e as Error).message
      expect(message).toContain('error:')
      expect(message).toContain('-->')  // Location pointer
    }
  })
})
