// Forge Compiler - Transforms AST to runtime types
// Compiles Forge definitions to AnimatedAssetDef, ShipLayout, etc.

import * as AST from './types'
import type {
  AnimatedAssetDef,
  AnimatedParameterDef,
  AssetStateDef,
  AnimationDef,
  AnimationKeyframe,
  DynamicPartDef,
  PartState,
  StateBindingDef,
  EasingType
} from '../voxel/AnimatedAsset'
import type { VoxelPlacement, VoxelBox } from '../voxel/VoxelAsset'
import type {
  ShipLayout,
  RoomLayout,
  DoorLayout,
  TerminalLayout,
  SwitchLayout,
  WallLightLayout,
  AssetInstance
} from '../types/layout'
import type {
  CompiledEntityDef,
  EntityScreenDef,
  EntityStyleDef,
  EntityEventHandler,
  EntityAction,
  EntityParamDef,
  RenderElement,
  RenderMatchCase
} from '../types/entity'

export class CompileError extends Error {
  constructor(
    message: string,
    public loc: AST.SourceLocation
  ) {
    super(`${message} at line ${loc.line}, column ${loc.column}`)
    this.name = 'CompileError'
  }
}

export interface CompileResult<T> {
  success: boolean
  result?: T
  errors: CompileError[]
}

export class ForgeCompiler {
  private errors: CompileError[] = []

  /**
   * Compile an asset definition to AnimatedAssetDef.
   */
  compileAsset(asset: AST.AssetDef): CompileResult<AnimatedAssetDef> {
    this.errors = []

    try {
      const result: AnimatedAssetDef = {
        id: asset.name,
        name: asset.displayName ?? asset.name,
        description: asset.description,
        anchor: this.compileVec3ToAnchor(asset.anchor),
        voxels: []
      }

      // Compile geometry to voxels and extract children
      let geometryChildren: AST.ChildRef[] = []
      if (asset.geometry) {
        const { voxels, boxes, children } = this.compileGeometry(asset.geometry)
        result.voxels = voxels
        geometryChildren = children
        // Boxes are expanded to voxels or stored separately
        if (boxes.length > 0) {
          // For now, expand boxes to voxels
          for (const box of boxes) {
            const expanded = this.expandBox(box)
            result.voxels.push(...expanded)
          }
        }
      }

      // Compile parts to dynamicParts
      if (asset.parts) {
        result.dynamicParts = this.compileParts(asset.parts)
      }

      // Compile children (merge top-level and geometry children)
      const allChildren = [...(asset.children || []), ...geometryChildren]
      if (allChildren.length > 0) {
        result.children = this.compileChildren(allChildren, asset.body)
      }

      // Compile states
      if (asset.states) {
        result.states = this.compileStates(asset.states)
      }

      // Compile animations
      if (asset.animations) {
        result.animations = this.compileAnimations(asset.animations)
      }

      // Compile params to parameters
      if (asset.params) {
        result.parameters = this.compileParams(asset.params)
      }

      // Compile when/on blocks to stateBindings
      if (asset.body) {
        result.stateBindings = this.compileBindings(asset.body)
      }

      return {
        success: this.errors.length === 0,
        result,
        errors: this.errors
      }
    } catch (e) {
      if (e instanceof CompileError) {
        this.errors.push(e)
      } else {
        this.errors.push(new CompileError(String(e), asset.loc))
      }
      return {
        success: false,
        errors: this.errors
      }
    }
  }

  /**
   * Compile a layout definition to ShipLayout.
   */
  compileLayout(layout: AST.LayoutDef): CompileResult<ShipLayout> {
    this.errors = []

    try {
      const result: ShipLayout = {
        version: 2,
        rooms: {}
      }

      // Compile rooms
      for (const room of layout.rooms) {
        const pos = this.compileVec3ToPosition(room.position)
        const size = this.compileVec3ToPosition(room.size)
        result.rooms[room.name] = {
          position: pos,
          size: { width: size.x, height: size.y, depth: size.z }
        }
      }

      // Compile doors
      if (layout.doors.length > 0) {
        result.doors = {}
        for (const door of layout.doors) {
          result.doors[door.name] = {
            position: this.compileVec3ToPosition(door.position),
            rotation: this.facingToRotation(door.facing)
          }
        }
      }

      // Compile terminals
      if (layout.terminals.length > 0) {
        result.terminals = {}
        for (const terminal of layout.terminals) {
          result.terminals[terminal.name] = {
            position: this.compileVec3ToPosition(terminal.position),
            rotation: terminal.rotation
          }
        }
      }

      // Compile switches
      if (layout.switches.length > 0) {
        result.switches = {}
        for (const sw of layout.switches) {
          result.switches[sw.name] = {
            position: this.compileVec3ToPosition(sw.position),
            rotation: sw.rotation,
            status: (sw.status as 'OK' | 'FAULT') ?? 'OK'
          }
        }
      }

      // Compile wall lights
      if (layout.wallLights.length > 0) {
        result.wallLights = {}
        for (const light of layout.wallLights) {
          result.wallLights[light.name] = {
            position: this.compileVec3ToPosition(light.position),
            rotation: light.rotation,
            color: light.color?.value ?? '#ffffff',
            intensity: light.intensity ?? 1
          }
        }
      }

      // Compile asset instances
      if (layout.assets.length > 0) {
        result.assetInstances = {}
        for (const asset of layout.assets) {
          result.assetInstances[asset.name] = {
            asset: asset.asset,
            position: this.compileVec3ToPosition(asset.position),
            rotation: (asset.rotation ?? 0) as 0 | 90 | 180 | 270
          }
        }
      }

      return {
        success: this.errors.length === 0,
        result,
        errors: this.errors
      }
    } catch (e) {
      if (e instanceof CompileError) {
        this.errors.push(e)
      } else {
        this.errors.push(new CompileError(String(e), layout.loc))
      }
      return {
        success: false,
        errors: this.errors
      }
    }
  }

  /**
   * Compile an entity definition to CompiledEntityDef.
   */
  compileEntity(entity: AST.EntityDef): CompileResult<CompiledEntityDef> {
    this.errors = []

    try {
      const result: CompiledEntityDef = {
        id: entity.name
      }

      // Compile params
      if (entity.params) {
        result.params = this.compileEntityParams(entity.params)
      }

      // Compile screen
      if (entity.screen) {
        result.screen = this.compileScreen(entity.screen)
      }

      // Compile render block
      if (entity.render) {
        result.render = this.compileRenderBlock(entity.render)
      }

      // Compile styles
      if (entity.styles) {
        result.styles = this.compileEntityStyles(entity.styles)
      }

      // Compile event handlers
      if (entity.body) {
        result.events = this.compileEventHandlers(entity.body)
      }

      return {
        success: this.errors.length === 0,
        result,
        errors: this.errors
      }
    } catch (e) {
      if (e instanceof CompileError) {
        this.errors.push(e)
      } else {
        this.errors.push(new CompileError(String(e), entity.loc))
      }
      return {
        success: false,
        errors: this.errors
      }
    }
  }

  private compileEntityParams(params: AST.ParamsBlock): Record<string, EntityParamDef> {
    const result: Record<string, EntityParamDef> = {}

    for (const param of params.params) {
      let paramDef: EntityParamDef

      switch (param.type.name) {
        case 'enum':
          paramDef = {
            type: 'enum',
            enumValues: param.type.enumValues ?? [],
            default: param.default ? this.evalEnumValue(param.default) : param.type.enumValues?.[0] ?? ''
          }
          break

        case 'bool':
          paramDef = {
            type: 'boolean',
            default: param.default ? (param.default.kind === 'boolean' ? param.default.value : false) : false
          }
          break

        case 'float':
        case 'int':
          paramDef = {
            type: 'number',
            default: param.default ? this.evalNumber(param.default) : 0
          }
          break

        case 'string':
          paramDef = {
            type: 'string',
            default: param.default ? this.evalString(param.default) : ''
          }
          break

        default:
          paramDef = {
            type: 'string',
            default: ''
          }
      }

      result[param.name] = paramDef
    }

    return result
  }

  private compileScreen(screen: AST.ScreenBlock): EntityScreenDef {
    const result: EntityScreenDef = {
      size: [
        this.evalNumber(screen.size.x),
        this.evalNumber(screen.size.y)
      ]
    }

    if (screen.font) result.font = screen.font
    if (screen.fontSize) result.fontSize = screen.fontSize
    if (screen.background) result.background = screen.background.value
    if (screen.lineHeight) result.lineHeight = screen.lineHeight
    if (screen.padding) result.padding = screen.padding

    return result
  }

  private compileRenderBlock(render: AST.RenderBlock): RenderElement[] {
    return render.body.map(stmt => this.compileRenderStatement(stmt))
  }

  private compileRenderStatement(stmt: AST.RenderStatement): RenderElement {
    switch (stmt.kind) {
      case 'text':
        return {
          type: 'text',
          content: this.compileExpressionToString(stmt.content),
          centered: stmt.centered
        }

      case 'row':
        return {
          type: 'row',
          label: this.compileExpressionToString(stmt.label),
          value: this.compileExpressionToString(stmt.value)
        }

      case 'code':
        return {
          type: 'code',
          content: this.compileExpressionToString(stmt.content),
          lineNumbers: stmt.lineNumbers
        }

      case 'match':
        return {
          type: 'match',
          expression: this.compileExpressionToString(stmt.expression),
          cases: stmt.cases.map(c => ({
            pattern: this.compileExpressionToString(c.pattern),
            elements: c.body.map(s => this.compileRenderStatement(s as AST.RenderStatement))
          }))
        }

      default:
        throw new CompileError(`Unknown render statement kind`, stmt.loc)
    }
  }

  private compileExpressionToString(expr: AST.Expression): string {
    if (expr.kind === 'string') return expr.value
    if (expr.kind === 'number') return String(expr.value)
    if (expr.kind === 'boolean') return String(expr.value)
    if (expr.kind === 'identifier') return expr.name
    if (expr.kind === 'reactive') return '$' + expr.path.join('.')
    if (expr.kind === 'binary') {
      return `${this.compileExpressionToString(expr.left)} ${expr.operator} ${this.compileExpressionToString(expr.right)}`
    }
    return String(expr)
  }

  private compileEntityStyles(styles: AST.StylesBlock): Record<string, EntityStyleDef> {
    const result: Record<string, EntityStyleDef> = {}

    for (const style of styles.styles) {
      const styleDef: EntityStyleDef = {}

      for (const [key, value] of Object.entries(style.properties)) {
        if (key === 'color' && value.kind === 'color') {
          styleDef.color = value.value
        } else if (key === 'fontWeight' && value.kind === 'string') {
          styleDef.fontWeight = value.value
        } else if (key === 'fontStyle' && value.kind === 'string') {
          styleDef.fontStyle = value.value
        }
      }

      result[style.name] = styleDef
    }

    return result
  }

  private compileEventHandlers(body: AST.Statement[]): EntityEventHandler[] {
    const handlers: EntityEventHandler[] = []

    for (const stmt of body) {
      if (stmt.kind === 'on') {
        const handler: EntityEventHandler = {
          event: stmt.event,
          actions: []
        }

        if (stmt.condition) {
          handler.condition = this.compileExpressionToString(stmt.condition)
        }

        for (const action of stmt.body) {
          if (action.kind === 'set') {
            handler.actions.push({
              type: 'set',
              property: action.property,
              value: this.compilePropertyValue(action.value)
            })
          } else if (action.kind === 'emit') {
            handler.actions.push({
              type: 'emit',
              event: action.event
            })
          }
        }

        handlers.push(handler)
      }
    }

    return handlers
  }

  private compileVec3ToPosition(vec: AST.Vec3): { x: number; y: number; z: number } {
    return {
      x: this.evalNumber(vec.x),
      y: this.evalNumber(vec.y),
      z: this.evalNumber(vec.z)
    }
  }

  private facingToRotation(facing: string): number {
    switch (facing) {
      case 'north': return 0
      case 'east': return 90
      case 'south': return 180
      case 'west': return 270
      default: return 0
    }
  }

  private compileVec3ToAnchor(vec?: AST.Vec3): { x: number; y: number; z: number } {
    if (!vec) return { x: 0, y: 0, z: 0 }
    return {
      x: this.evalNumber(vec.x),
      y: this.evalNumber(vec.y),
      z: this.evalNumber(vec.z)
    }
  }

  private compileVec3ToArray(vec: AST.Vec3): [number, number, number] {
    return [
      this.evalNumber(vec.x),
      this.evalNumber(vec.y),
      this.evalNumber(vec.z)
    ]
  }

  private evalNumber(expr: AST.Expression): number {
    if (expr.kind === 'number') return expr.value
    if (expr.kind === 'unary' && expr.operator === '-') {
      return -this.evalNumber(expr.operand)
    }
    if (expr.kind === 'binary') {
      const left = this.evalNumber(expr.left)
      const right = this.evalNumber(expr.right)
      switch (expr.operator) {
        case '+': return left + right
        case '-': return left - right
        case '*': return left * right
        case '/': return left / right
      }
    }
    throw new CompileError(`Cannot evaluate expression as number`, expr.loc)
  }

  private evalString(expr: AST.Expression): string {
    if (expr.kind === 'string') return expr.value
    throw new CompileError(`Cannot evaluate expression as string`, expr.loc)
  }

  private evalEnumValue(expr: AST.Expression): string {
    if (expr.kind === 'string') return expr.value
    if (expr.kind === 'identifier') return expr.name
    throw new CompileError(`Cannot evaluate expression as enum value`, expr.loc)
  }

  private compileGeometry(geometry: AST.GeometryBlock): { voxels: VoxelPlacement[]; boxes: VoxelBox[]; children: AST.ChildRef[] } {
    const voxels: VoxelPlacement[] = []
    const boxes: VoxelBox[] = []
    const children: AST.ChildRef[] = []

    for (const prim of geometry.primitives) {
      switch (prim.kind) {
        case 'voxel':
          voxels.push({
            offset: this.compileVec3ToArray(prim.position),
            type: prim.type as VoxelPlacement['type']
          })
          break

        case 'box':
          if (prim.to) {
            // box (x1, y1, z1) to (x2, y2, z2) as TYPE
            boxes.push({
              min: this.compileVec3ToArray(prim.from),
              max: this.compileVec3ToArray(prim.to),
              type: prim.type as VoxelBox['type']
            })
          } else if (prim.size) {
            // box (x, y, z) size (w, h, d) as TYPE
            const from = this.compileVec3ToArray(prim.from)
            const size = this.compileVec3ToArray(prim.size)
            boxes.push({
              min: from,
              max: [from[0] + size[0], from[1] + size[1], from[2] + size[2]],
              type: prim.type as VoxelBox['type']
            })
          }
          break

        case 'repeat':
          // Expand repeat patterns
          const expanded = this.expandRepeat(prim)
          voxels.push(...expanded)
          break

        case 'child':
          // Collect children from geometry block
          children.push(prim)
          break
      }
    }

    return { voxels, boxes, children }
  }

  private expandBox(box: VoxelBox): VoxelPlacement[] {
    const voxels: VoxelPlacement[] = []
    for (let x = box.min[0]; x < box.max[0]; x++) {
      for (let y = box.min[1]; y < box.max[1]; y++) {
        for (let z = box.min[2]; z < box.max[2]; z++) {
          voxels.push({
            offset: [x, y, z],
            type: box.type
          })
        }
      }
    }
    return voxels
  }

  private expandRepeat(repeat: AST.RepeatPattern): VoxelPlacement[] {
    const voxels: VoxelPlacement[] = []

    // For now, only handle single-variable repeats
    if (repeat.variables.length === 1) {
      const v = repeat.variables[0]!
      const from = this.evalNumber(v.from)
      const to = this.evalNumber(v.to)
      const step = v.step ? this.evalNumber(v.step) : 1

      for (let i = from; i <= to; i += step) {
        for (const prim of repeat.body) {
          if (prim.kind === 'voxel') {
            // Substitute variable in position
            const pos = this.substituteVec3(prim.position, v.name, i)
            voxels.push({
              offset: this.compileVec3ToArray(pos),
              type: prim.type as VoxelPlacement['type']
            })
          }
        }
      }
    }

    return voxels
  }

  private substituteVec3(vec: AST.Vec3, varName: string, value: number): AST.Vec3 {
    return {
      kind: 'vec3',
      x: this.substituteExpr(vec.x, varName, value),
      y: this.substituteExpr(vec.y, varName, value),
      z: this.substituteExpr(vec.z, varName, value),
      loc: vec.loc
    }
  }

  private substituteExpr(expr: AST.Expression, varName: string, value: number): AST.Expression {
    if (expr.kind === 'identifier' && expr.name === varName) {
      return { kind: 'number', value, loc: expr.loc }
    }
    if (expr.kind === 'binary') {
      return {
        kind: 'binary',
        operator: expr.operator,
        left: this.substituteExpr(expr.left, varName, value),
        right: this.substituteExpr(expr.right, varName, value),
        loc: expr.loc
      }
    }
    return expr
  }

  private compileParts(parts: AST.PartsBlock): DynamicPartDef[] {
    return parts.parts.map(part => {
      const voxels: VoxelPlacement[] = []

      for (const prim of part.geometry) {
        if (prim.kind === 'voxel') {
          voxels.push({
            offset: this.compileVec3ToArray(prim.position),
            type: prim.type as VoxelPlacement['type']
          })
        } else if (prim.kind === 'box') {
          // Expand box to voxels
          if (prim.to) {
            const box: VoxelBox = {
              min: this.compileVec3ToArray(prim.from),
              max: this.compileVec3ToArray(prim.to),
              type: prim.type as VoxelBox['type']
            }
            voxels.push(...this.expandBox(box))
          } else if (prim.size) {
            const from = this.compileVec3ToArray(prim.from)
            const size = this.compileVec3ToArray(prim.size)
            const box: VoxelBox = {
              min: from,
              max: [from[0] + size[0], from[1] + size[1], from[2] + size[2]],
              type: prim.type as VoxelBox['type']
            }
            voxels.push(...this.expandBox(box))
          }
        } else if (prim.kind === 'repeat') {
          // Expand repeat patterns (same as in compileGeometry)
          voxels.push(...this.expandRepeat(prim))
        }
      }

      const result: DynamicPartDef = {
        id: part.name,
        voxels
      }

      if (part.position) {
        result.anchor = this.compileVec3ToAnchor(part.position)
      }

      return result
    })
  }

  private compileChildren(
    children: AST.ChildRef[],
    body?: AST.Statement[]
  ): AnimatedAssetDef['children'] {
    return children.map(child => {
      const result: NonNullable<AnimatedAssetDef['children']>[number] = {
        asset: child.asset,
        offset: this.compileVec3ToArray(child.position)
      }

      // Handle condition
      if (child.condition) {
        result.condition = this.compileCondition(child.condition)
      }

      // Handle animation from child body
      if (child.body) {
        const anim = this.extractChildAnimation(child.body)
        if (anim) {
          result.animate = anim
        }
      }

      return result
    })
  }

  private extractChildAnimation(body: AST.Statement[]): { type: 'spin'; axis: 'x' | 'y' | 'z'; speed?: number } | undefined {
    for (const stmt of body) {
      if (stmt.kind === 'animate') {
        // Direct animation: animate spin on z at $speed
        if (stmt.animation === 'spin' && stmt.axis) {
          return {
            type: 'spin',
            axis: stmt.axis as 'x' | 'y' | 'z',
            speed: stmt.speed ? this.evalAnimSpeed(stmt.speed) : undefined
          }
        }
      } else if (stmt.kind === 'when') {
        // Nested when: when $powered: animate spin on z at $speed
        const nestedAnim = this.extractChildAnimation(stmt.body)
        if (nestedAnim) {
          return nestedAnim
        }
      }
    }
    return undefined
  }

  private evalAnimSpeed(expr: AST.Expression): number | undefined {
    // For reactive refs like $speed, return undefined (runtime resolved)
    if (expr.kind === 'reactive') return undefined
    // For literal numbers, evaluate
    if (expr.kind === 'number') return expr.value
    return undefined
  }

  private compileCondition(expr: AST.Expression): string {
    // Convert expression to string representation for runtime evaluation
    if (expr.kind === 'reactive') {
      return '$' + expr.path.join('.')
    }
    if (expr.kind === 'identifier') {
      return expr.name
    }
    if (expr.kind === 'binary') {
      return `${this.compileCondition(expr.left)} ${expr.operator} ${this.compileCondition(expr.right)}`
    }
    return String(expr)
  }

  private compileStates(states: AST.StatesBlock): Record<string, AssetStateDef> {
    const result: Record<string, AssetStateDef> = {}

    for (const state of states.states) {
      const parts: Record<string, PartState> = {}

      for (const binding of state.bindings) {
        // Parse target: "part.property" or just "property"
        const [partId, ...propPath] = binding.target.split('.')
        const propName = propPath.join('.') || partId!

        if (!parts[partId!]) {
          parts[partId!] = {}
        }

        const value = this.compilePropertyValue(binding.value)
        this.setNestedProperty(parts[partId!]!, propName, value)
      }

      result[state.name] = { parts }
    }

    return result
  }

  private compilePropertyValue(expr: AST.Expression): unknown {
    if (expr.kind === 'number') return expr.value
    if (expr.kind === 'string') return expr.value
    if (expr.kind === 'boolean') return expr.value
    if (expr.kind === 'color') return expr.value
    if (expr.kind === 'vec3') return this.compileVec3ToArray(expr)

    // Handle color @ intensity: #rrggbb @ 0.5
    if (expr.kind === 'binary' && expr.operator === '@') {
      // This would be emissive with intensity
      return {
        color: this.compilePropertyValue(expr.left),
        intensity: this.evalNumber(expr.right)
      }
    }

    throw new CompileError(`Cannot compile property value`, expr.loc)
  }

  private setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.')
    let current = obj
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]!]) {
        current[parts[i]!] = {}
      }
      current = current[parts[i]!] as Record<string, unknown>
    }
    current[parts[parts.length - 1]!] = value
  }

  private compileAnimations(animations: AST.AnimationsBlock): Record<string, AnimationDef> {
    const result: Record<string, AnimationDef> = {}

    for (const anim of animations.animations) {
      const keyframes: AnimationKeyframe[] = anim.keyframes.map(kf => ({
        time: kf.percent / 100,
        state: kf.state,
        easing: kf.easing as EasingType
      }))

      result[anim.name] = {
        duration: anim.duration.value,
        keyframes,
        loop: anim.loop ?? false
      }
    }

    return result
  }

  private compileParams(params: AST.ParamsBlock): Record<string, AnimatedParameterDef> {
    const result: Record<string, AnimatedParameterDef> = {}

    for (const param of params.params) {
      let paramDef: AnimatedParameterDef

      switch (param.type.name) {
        case 'enum':
          paramDef = {
            type: 'enum',
            values: param.type.enumValues ?? [],
            default: param.default ? this.evalEnumValue(param.default) : param.type.enumValues?.[0] ?? ''
          }
          break

        case 'bool':
          paramDef = {
            type: 'boolean',
            default: param.default ? (param.default.kind === 'boolean' ? param.default.value : false) : false
          }
          break

        case 'float':
        case 'int':
          paramDef = {
            type: 'number',
            default: param.default ? this.evalNumber(param.default) : 0
          }
          break

        default:
          // Treat unknown as string enum
          paramDef = {
            type: 'enum',
            values: [],
            default: ''
          }
      }

      result[param.name] = paramDef
    }

    return result
  }

  private compileBindings(body: AST.Statement[]): Record<string, StateBindingDef> {
    const result: Record<string, StateBindingDef> = {}

    for (const stmt of body) {
      if (stmt.kind === 'when') {
        // when $param: ... -> stateBinding
        if (stmt.condition.kind === 'reactive') {
          const paramName = stmt.condition.path.join('.')
          if (!result[paramName]) {
            result[paramName] = {}
          }
          // Look for match inside the when body
          for (const action of stmt.body) {
            if (action.kind === 'match') {
              // Recursively process the match
              this.compileMatchBindings(action, paramName, result)
            } else if (action.kind === 'setState') {
              // This is a simple binding: when $param: setState(state)
              // We need the value trigger from match/if
            }
          }
        }
      } else if (stmt.kind === 'match') {
        // match $param: CASE -> action
        if (stmt.expression.kind === 'reactive') {
          const paramName = stmt.expression.path.join('.')
          if (!result[paramName]) {
            result[paramName] = {}
          }
          this.compileMatchBindings(stmt, paramName, result)
        }
      }
    }

    return result
  }

  private compileMatchBindings(
    match: AST.MatchBlock,
    paramName: string,
    result: Record<string, StateBindingDef>
  ): void {
    for (const case_ of match.cases) {
      const caseValue = case_.pattern.kind === 'identifier' ? case_.pattern.name : String(case_.pattern)
      const binding: { setState?: string; playAnimation?: string; stopAnimation?: string } = {}

      for (const action of case_.body) {
        if (action.kind === 'setState') {
          binding.setState = action.state
        } else if (action.kind === 'play') {
          binding.playAnimation = action.animation
        } else if (action.kind === 'stopAnimation') {
          binding.stopAnimation = action.animation
        }
      }

      result[paramName]![caseValue] = binding
    }
  }
}

/**
 * Convenience function to compile a Forge module.
 */
/**
 * Compiled config - plain object with config name and values.
 */
export interface CompiledConfig {
  name: string
  values: Record<string, unknown>
}

/**
 * Compile a ConfigValue (Expression or ConfigObject) to a plain value.
 */
function compileConfigValue(value: AST.ConfigValue): unknown {
  if (value.kind === 'configObject') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value.properties)) {
      result[key] = compileConfigValue(val)
    }
    return result
  }

  // It's an Expression - evaluate to a literal value
  const expr = value as AST.Expression
  switch (expr.kind) {
    case 'number':
      return expr.value
    case 'string':
      return expr.value
    case 'boolean':
      return expr.value
    case 'color':
      return expr.value  // Already a number (0xRRGGBB)
    case 'array':
      return expr.elements.map(el => compileConfigValue(el as AST.ConfigValue))
    case 'vector2':
      return [expr.x, expr.y]
    case 'vector3':
      return [expr.x, expr.y, expr.z]
    default:
      // For identifiers or complex expressions, return as string
      if ('name' in expr) {
        return (expr as AST.Identifier).name
      }
      return null
  }
}

/**
 * Compile a ConfigDef to CompiledConfig.
 */
function compileConfig(def: AST.ConfigDef): CompileResult<CompiledConfig> {
  try {
    const values: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(def.properties)) {
      values[key] = compileConfigValue(val)
    }

    return {
      success: true,
      result: { name: def.name, values },
      errors: []
    }
  } catch (e) {
    return {
      success: false,
      result: undefined,
      errors: [{
        message: `Failed to compile config ${def.name}: ${e}`,
        location: def.loc
      }]
    }
  }
}

export function compileModule(module: AST.ForgeModule): {
  assets: CompileResult<AnimatedAssetDef>[]
  layouts: CompileResult<ShipLayout>[]
  entities: CompileResult<CompiledEntityDef>[]
  configs: CompileResult<CompiledConfig>[]
} {
  const compiler = new ForgeCompiler()
  const assets: CompileResult<AnimatedAssetDef>[] = []
  const layouts: CompileResult<ShipLayout>[] = []
  const entities: CompileResult<CompiledEntityDef>[] = []
  const configs: CompileResult<CompiledConfig>[] = []

  for (const def of module.definitions) {
    if (def.kind === 'asset') {
      assets.push(compiler.compileAsset(def))
    } else if (def.kind === 'layout') {
      layouts.push(compiler.compileLayout(def))
    } else if (def.kind === 'entity') {
      entities.push(compiler.compileEntity(def))
    } else if (def.kind === 'config') {
      configs.push(compileConfig(def))
    }
  }

  return { assets, layouts, entities, configs }
}
