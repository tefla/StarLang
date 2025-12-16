// Forge Parser - Parses tokens into AST
// Recursive descent parser with indent-based block handling

import { Token, TokenType, tokenize } from './lexer'
import * as AST from './types'

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(`${message} at line ${line}, column ${column}`)
    this.name = 'ParseError'
  }
}

export class ForgeParser {
  private tokens: Token[] = []
  private pos = 0

  constructor(private source: string) {}

  parse(): AST.ForgeModule {
    this.tokens = tokenize(this.source)
    const definitions: AST.TopLevelDef[] = []

    this.skipNewlines()

    while (!this.isAtEnd()) {
      const def = this.parseTopLevel()
      if (def) {
        definitions.push(def)
      }
      this.skipNewlines()
    }

    return {
      kind: 'module',
      definitions,
      loc: { line: 1, column: 1 }
    }
  }

  // ============================================================================
  // Top-Level Definitions
  // ============================================================================

  private parseTopLevel(): AST.TopLevelDef | null {
    const token = this.current()
    if (token.type !== 'KEYWORD') return null

    switch (token.value) {
      case 'asset':
        return this.parseAsset()
      case 'layout':
        return this.parseLayout()
      case 'entity':
        return this.parseEntity()
      case 'machine':
        return this.parseMachine()
      case 'config':
        return this.parseConfig()
      case 'def':
        return this.parseFunction()
      case 'rule':
        return this.parseRule()
      case 'scenario':
        return this.parseScenario()
      case 'behavior':
        return this.parseBehavior()
      case 'condition':
        return this.parseCondition()
      case 'game':
        return this.parseGame()
      case 'interaction':
        return this.parseInteraction()
      case 'display-template':
        return this.parseDisplayTemplate()
      default:
        throw this.error(`Unexpected keyword '${token.value}'`)
    }
  }

  // ============================================================================
  // Asset Definition
  // ============================================================================

  private parseAsset(): AST.AssetDef {
    const loc = this.currentLoc()
    this.expectKeyword('asset')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const asset: AST.AssetDef = {
      kind: 'asset',
      name,
      loc
    }

    // Parse asset body
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'IDENTIFIER') {
        // Property: name: value
        const propName = token.value
        this.advance()
        this.expect('COLON')
        const value = this.parseExpression()

        switch (propName) {
          case 'name':
            asset.displayName = this.expectString(value)
            break
          case 'description':
            asset.description = this.expectString(value)
            break
          case 'anchor':
            asset.anchor = this.expectVec3(value)
            break
        }
        this.expectNewlineOrDedent()
      } else if (token.type === 'KEYWORD') {
        switch (token.value) {
          case 'params':
            asset.params = this.parseParamsBlock()
            break
          case 'geometry':
            asset.geometry = this.parseGeometryBlock()
            break
          case 'parts':
            asset.parts = this.parsePartsBlock()
            break
          case 'child':
            asset.children = asset.children || []
            asset.children.push(this.parseChild())
            break
          case 'states':
            asset.states = this.parseStatesBlock()
            break
          case 'animations':
            asset.animations = this.parseAnimationsBlock()
            break
          case 'when':
          case 'on':
            asset.body = asset.body || []
            asset.body.push(this.parseStatement())
            break
          default:
            throw this.error(`Unexpected keyword '${token.value}' in asset`)
        }
      } else {
        throw this.error(`Unexpected token '${token.value}' in asset body`)
      }
    }

    this.consumeDedent()
    return asset
  }

  // ============================================================================
  // Params Block
  // ============================================================================

  private parseParamsBlock(): AST.ParamsBlock {
    const loc = this.currentLoc()
    this.expectKeyword('params')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const params: AST.ParamDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const param = this.parseParamDef()
      params.push(param)
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'params', params, loc }
  }

  private parseParamDef(): AST.ParamDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expect('COLON')
    const type = this.parseTypeAnnotation()

    let defaultValue: AST.Expression | undefined
    if (this.check('EQUALS')) {
      this.advance()
      defaultValue = this.parseExpression()
    }

    return { kind: 'param', name, type, default: defaultValue, loc }
  }

  private parseTypeAnnotation(): AST.TypeAnnotation {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()

    const type: AST.TypeAnnotation = { kind: 'type', name, loc }

    // Check for constraints: float[0..10]
    if (this.check('LBRACKET')) {
      this.advance()
      const start = this.parseExpression()
      this.expect('RANGE')
      const end = this.parseExpression()
      this.expect('RBRACKET')
      type.constraint = { kind: 'range', start, end, loc }
    }

    // Check for enum: enum(A, B, C)
    if (name === 'enum' && this.check('LPAREN')) {
      this.advance()
      type.enumValues = []
      type.enumValues.push(this.expectIdentifier())
      while (this.check('COMMA')) {
        this.advance()
        type.enumValues.push(this.expectIdentifier())
      }
      this.expect('RPAREN')
    }

    // Check for ref: ref(room)
    if (name === 'ref' && this.check('LPAREN')) {
      this.advance()
      type.refTarget = this.expectIdentifier()
      this.expect('RPAREN')
    }

    // Check for list: list<T>
    if (name === 'list' && this.check('LT')) {
      this.advance()
      type.elementType = this.parseTypeAnnotation()
      this.expect('GT')
    }

    return type
  }

  // ============================================================================
  // Geometry Block
  // ============================================================================

  private parseGeometryBlock(): AST.GeometryBlock {
    const loc = this.currentLoc()
    this.expectKeyword('geometry')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const primitives: AST.GeometryPrimitive[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const prim = this.parseGeometryPrimitive()
      primitives.push(prim)
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'geometry', primitives, loc }
  }

  private parseGeometryPrimitive(): AST.GeometryPrimitive {
    const token = this.current()

    if (token.type === 'KEYWORD') {
      switch (token.value) {
        case 'box':
          return this.parseBox()
        case 'voxel':
          return this.parseVoxel()
        case 'repeat':
          return this.parseRepeat()
        case 'child':
          return this.parseChild()
      }
    }

    // Shorthand voxel: (x, y, z) as TYPE
    if (token.type === 'LPAREN') {
      return this.parseVoxelShorthand()
    }

    throw this.error(`Expected geometry primitive, got '${token.value}'`)
  }

  private parseBox(): AST.BoxPrimitive {
    const loc = this.currentLoc()
    this.expectKeyword('box')

    const from = this.parseVec3()

    let to: AST.Vec3 | undefined
    let size: AST.Vec3 | undefined

    if (this.checkKeyword('to')) {
      this.advance()
      to = this.parseVec3()
    } else if (this.checkKeyword('size')) {
      this.advance()
      size = this.parseVec3()
    }

    this.expectKeyword('as')
    const type = this.expectIdentifier()

    // Optional comment
    const comment = this.parseOptionalComment()

    return { kind: 'box', from, to, size, type, loc }
  }

  private parseVoxel(): AST.VoxelPrimitive {
    const loc = this.currentLoc()
    this.expectKeyword('voxel')
    const position = this.parseVec3()
    this.expectKeyword('as')
    const type = this.expectIdentifier()
    const comment = this.parseOptionalComment()

    return { kind: 'voxel', position, type, comment, loc }
  }

  private parseVoxelShorthand(): AST.VoxelPrimitive {
    const loc = this.currentLoc()
    const position = this.parseVec3()
    this.expectKeyword('as')
    const type = this.expectIdentifier()
    const comment = this.parseOptionalComment()

    return { kind: 'voxel', position, type, comment, loc }
  }

  private parseRepeat(): AST.RepeatPattern {
    const loc = this.currentLoc()
    this.expectKeyword('repeat')

    const variables: AST.RepeatPattern['variables'] = []

    // Parse variable(s): x, y from (0, 0) to (10, 10)
    const varNames: string[] = []
    varNames.push(this.expectIdentifier())
    while (this.check('COMMA')) {
      this.advance()
      varNames.push(this.expectIdentifier())
    }

    this.expectKeyword('from')
    const fromExpr = this.parseExpression()
    this.expectKeyword('to')
    const toExpr = this.parseExpression()

    let stepExpr: AST.Expression | undefined
    if (this.checkKeyword('step')) {
      this.advance()
      stepExpr = this.parseExpression()
    }

    // For single variable with number ranges
    if (varNames.length === 1) {
      variables.push({
        name: varNames[0]!,
        from: fromExpr,
        to: toExpr,
        step: stepExpr
      })
    } else {
      // For multiple variables with tuple ranges, need to split
      // This is simplified - assumes vectors match variable count
      for (let i = 0; i < varNames.length; i++) {
        variables.push({
          name: varNames[i]!,
          from: this.extractComponent(fromExpr, i),
          to: this.extractComponent(toExpr, i),
          step: stepExpr ? this.extractComponent(stepExpr, i) : undefined
        })
      }
    }

    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.GeometryPrimitive[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseGeometryPrimitive())
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'repeat', variables, body, loc }
  }

  private extractComponent(expr: AST.Expression, index: number): AST.Expression {
    if (expr.kind === 'vec2') {
      return index === 0 ? expr.x : expr.y
    }
    if (expr.kind === 'vec3') {
      return index === 0 ? expr.x : index === 1 ? expr.y : expr.z
    }
    return expr
  }

  private parseChild(): AST.ChildRef {
    const loc = this.currentLoc()
    this.expectKeyword('child')
    const asset = this.expectIdentifier()
    this.expectKeyword('at')
    const position = this.parseVec3()

    let condition: AST.Expression | undefined
    let body: AST.Statement[] | undefined

    // Check for condition
    if (this.checkKeyword('when')) {
      condition = this.parseConditionShorthand()
    }

    // Check for colon (body follows)
    if (this.check('COLON')) {
      this.advance()
      this.expectNewline()
      this.expectIndent()

      body = []
      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break

        if (this.checkKeyword('when')) {
          // Nested when inside child
          body.push(this.parseWhen())
        } else {
          body.push(this.parseStatement())
        }
      }

      this.consumeDedent()
    }

    return { kind: 'child', asset, position, condition, body, loc }
  }

  private parseConditionShorthand(): AST.Expression {
    this.expectKeyword('when')
    return this.parseExpression()
  }

  // ============================================================================
  // Parts Block
  // ============================================================================

  private parsePartsBlock(): AST.PartsBlock {
    const loc = this.currentLoc()
    this.expectKeyword('parts')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const parts: AST.Part[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const part = this.parsePart()
      parts.push(part)
    }

    this.consumeDedent()
    return { kind: 'parts', parts, loc }
  }

  private parsePart(): AST.Part {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const geometry: AST.GeometryPrimitive[] = []
    let position: AST.Vec3 | undefined

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      // Check for at: position (at is a keyword)
      if ((token.type === 'IDENTIFIER' || token.type === 'KEYWORD') && token.value === 'at') {
        // Check if next token is COLON (property) not LPAREN (geometry)
        const next = this.peek()
        if (next.type === 'COLON') {
          this.advance()
          this.expect('COLON')
          position = this.parseVec3()
          this.expectNewlineOrDedent()
          continue
        }
      }
      geometry.push(this.parseGeometryPrimitive())
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'part', name, geometry, position, loc }
  }

  // ============================================================================
  // States Block
  // ============================================================================

  private parseStatesBlock(): AST.StatesBlock {
    const loc = this.currentLoc()
    this.expectKeyword('states')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const states: AST.StateDefinition[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const state = this.parseStateDefinition()
      states.push(state)
    }

    this.consumeDedent()
    return { kind: 'states', states, loc }
  }

  private parseStateDefinition(): AST.StateDefinition {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const bindings: AST.PropertyBinding[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const binding = this.parsePropertyBinding()
      bindings.push(binding)
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'state', name, bindings, loc }
  }

  private parsePropertyBinding(): AST.PropertyBinding {
    const loc = this.currentLoc()
    const target = this.expectIdentifier()

    // Handle dot notation: part.property
    let fullTarget = target
    while (this.check('DOT')) {
      this.advance()
      fullTarget += '.' + this.expectIdentifier()
    }

    this.expect('COLON')
    const value = this.parseExpression()

    return { kind: 'property', target: fullTarget, value, loc }
  }

  // ============================================================================
  // Animations Block
  // ============================================================================

  private parseAnimationsBlock(): AST.AnimationsBlock {
    const loc = this.currentLoc()
    this.expectKeyword('animations')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const animations: AST.AnimationDefinition[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const anim = this.parseAnimationDefinition()
      animations.push(anim)
    }

    this.consumeDedent()
    return { kind: 'animations', animations, loc }
  }

  private parseAnimationDefinition(): AST.AnimationDefinition {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expect('COLON')
    const duration = this.parseDuration()

    // Check for optional 'loop' keyword
    let loop: boolean | undefined
    if (this.checkKeyword('loop')) {
      this.advance()
      loop = true
    }

    this.expectNewline()
    this.expectIndent()

    const keyframes: AST.Keyframe[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const keyframe = this.parseKeyframe()
      keyframes.push(keyframe)
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'animation', name, duration, loop, keyframes, loc }
  }

  private parseKeyframe(): AST.Keyframe {
    const loc = this.currentLoc()

    // Parse percentage: 0%, 50%, 100%
    const percentToken = this.expect('NUMBER')
    const percent = parseFloat(percentToken.value)
    this.expect('PERCENT')

    this.expect('ARROW')

    const state = this.expectIdentifier()

    let easing: string | undefined
    if (this.checkKeyword('using')) {
      this.advance()
      easing = this.expectIdentifier()
    }

    return { kind: 'keyframe', percent, state, easing, loc }
  }

  // ============================================================================
  // Statements
  // ============================================================================

  private parseStatement(): AST.Statement {
    const token = this.current()

    if (token.type === 'KEYWORD') {
      switch (token.value) {
        case 'when':
          return this.parseWhen()
        case 'on':
          return this.parseOn()
        case 'match':
          return this.parseMatch()
        case 'animate':
          return this.parseAnimate()
        case 'setState':
          return this.parseSetState()
        case 'play':
          return this.parsePlay()
        case 'stopAnimation':
          return this.parseStopAnimation()
        case 'emit':
          return this.parseEmit()
        case 'if':
          return this.parseIf()
        case 'for':
          return this.parseFor()
        case 'while':
          return this.parseWhile()
        case 'break':
          return this.parseBreak()
        case 'continue':
          return this.parseContinue()
        case 'return':
          return this.parseReturn()
      }
    }

    if (token.type === 'IDENTIFIER' && token.value === 'set') {
      return this.parseSet()
    }

    throw this.error(`Expected statement, got '${token.value}'`)
  }

  private parseWhen(): AST.WhenBlock {
    const loc = this.currentLoc()
    this.expectKeyword('when')
    const condition = this.parseExpression()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.Statement[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseStatement())
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()

    let elseBody: AST.Statement[] | undefined
    if (this.checkKeyword('else')) {
      this.advance()
      this.expect('COLON')
      this.expectNewline()
      this.expectIndent()

      elseBody = []
      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break
        elseBody.push(this.parseStatement())
        this.expectNewlineOrDedent()
      }

      this.consumeDedent()
    }

    return { kind: 'when', condition, body, else: elseBody, loc }
  }

  private parseOn(): AST.OnBlock {
    const loc = this.currentLoc()
    this.expectKeyword('on')
    const event = this.expectIdentifier()

    let condition: AST.Expression | undefined
    if (this.checkKeyword('when')) {
      this.advance()
      condition = this.parseExpression()
    }

    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.Statement[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseStatement())
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'on', event, condition, body, loc }
  }

  private parseMatch(): AST.MatchBlock {
    const loc = this.currentLoc()
    this.expectKeyword('match')
    const expression = this.parseExpression()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const cases: AST.MatchCase[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const caseLoc = this.currentLoc()
      const pattern = this.parseExpression()

      // Support both arrow syntax (PATTERN ->) and colon syntax (PATTERN:)
      const body: AST.Statement[] = []
      if (this.check('ARROW')) {
        this.advance()
        // Arrow syntax: can be inline or block
        if (this.check('NEWLINE')) {
          this.expectNewline()
          this.expectIndent()
          while (!this.checkDedent() && !this.isAtEnd()) {
            this.skipNewlines()
            if (this.checkDedent()) break
            body.push(this.parseStatement())
            this.expectNewlineOrDedent()
          }
          this.consumeDedent()
        } else {
          // Single line: PATTERN -> action1, action2
          body.push(this.parseStatement())
          while (this.check('COMMA')) {
            this.advance()
            body.push(this.parseStatement())
          }
          this.expectNewlineOrDedent()
        }
      } else if (this.check('COLON')) {
        // Colon syntax: always block
        this.advance()
        this.expectNewline()
        this.expectIndent()
        while (!this.checkDedent() && !this.isAtEnd()) {
          this.skipNewlines()
          if (this.checkDedent()) break
          body.push(this.parseStatement())
          this.expectNewlineOrDedent()
        }
        this.consumeDedent()
      } else {
        throw this.error(`Expected '->' or ':' after match pattern, got ${this.current().type}`)
      }

      cases.push({ kind: 'matchCase', pattern, body, loc: caseLoc })
    }

    this.consumeDedent()
    return { kind: 'match', expression, cases, loc }
  }

  private parseAnimate(): AST.AnimateStatement {
    const loc = this.currentLoc()
    this.expectKeyword('animate')
    const animation = this.expectIdentifier()

    let axis: string | undefined
    let speed: AST.Expression | undefined
    const params: Record<string, AST.Expression> = {}

    while (!this.check('NEWLINE') && !this.isAtEnd()) {
      if (this.checkKeyword('on')) {
        this.advance()
        axis = this.expectIdentifier()
      } else if (this.checkKeyword('at')) {
        this.advance()
        speed = this.parseExpression()
      } else {
        break
      }
    }

    return { kind: 'animate', animation, axis, speed, params: Object.keys(params).length > 0 ? params : undefined, loc }
  }

  private parseSetState(): AST.SetStateStatement {
    const loc = this.currentLoc()
    this.expectKeyword('setState')
    this.expect('LPAREN')
    const state = this.expectIdentifier()
    this.expect('RPAREN')
    return { kind: 'setState', state, loc }
  }

  private parsePlay(): AST.PlayStatement {
    const loc = this.currentLoc()
    this.expectKeyword('play')
    this.expect('LPAREN')
    const animation = this.expectIdentifier()
    this.expect('RPAREN')
    return { kind: 'play', animation, loc }
  }

  private parseStopAnimation(): AST.StopAnimationStatement {
    const loc = this.currentLoc()
    this.expectKeyword('stopAnimation')
    this.expect('LPAREN')
    const animation = this.expectIdentifier()
    this.expect('RPAREN')
    return { kind: 'stopAnimation', animation, loc }
  }

  private parseEmit(): AST.EmitStatement {
    const loc = this.currentLoc()
    this.expectKeyword('emit')
    const eventToken = this.expect('STRING')
    return { kind: 'emit', event: eventToken.value, loc }
  }

  private parseSet(): AST.SetStatement {
    const loc = this.currentLoc()
    this.advance()  // skip 'set'
    const property = this.expectIdentifier()
    this.expect('COLON')
    const value = this.parseExpression()
    return { kind: 'set', property, value, loc }
  }

  // ============================================================================
  // Control Flow Statements
  // ============================================================================

  private parseIf(): AST.IfStatement {
    const loc = this.currentLoc()
    this.expectKeyword('if')
    const condition = this.parseExpression()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.Statement[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseStatement())
      this.expectNewlineOrDedent()
    }
    this.consumeDedent()

    // Parse elif chains
    const elifBlocks: { condition: AST.Expression; body: AST.Statement[] }[] = []
    while (this.checkKeyword('elif')) {
      this.advance()
      const elifCondition = this.parseExpression()
      this.expect('COLON')
      this.expectNewline()
      this.expectIndent()

      const elifBody: AST.Statement[] = []
      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break
        elifBody.push(this.parseStatement())
        this.expectNewlineOrDedent()
      }
      this.consumeDedent()

      elifBlocks.push({ condition: elifCondition, body: elifBody })
    }

    // Parse else
    let elseBody: AST.Statement[] | undefined
    if (this.checkKeyword('else')) {
      this.advance()
      this.expect('COLON')
      this.expectNewline()
      this.expectIndent()

      elseBody = []
      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break
        elseBody.push(this.parseStatement())
        this.expectNewlineOrDedent()
      }
      this.consumeDedent()
    }

    return {
      kind: 'if',
      condition,
      body,
      elif: elifBlocks.length > 0 ? elifBlocks : undefined,
      else: elseBody,
      loc
    }
  }

  private parseFor(): AST.ForStatement {
    const loc = this.currentLoc()
    this.expectKeyword('for')
    const variable = this.expectIdentifier()
    this.expectKeyword('in')
    const iterable = this.parseExpression()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.Statement[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseStatement())
      this.expectNewlineOrDedent()
    }
    this.consumeDedent()

    return { kind: 'for', variable, iterable, body, loc }
  }

  private parseWhile(): AST.WhileStatement {
    const loc = this.currentLoc()
    this.expectKeyword('while')
    const condition = this.parseExpression()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.Statement[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseStatement())
      this.expectNewlineOrDedent()
    }
    this.consumeDedent()

    return { kind: 'while', condition, body, loc }
  }

  private parseBreak(): AST.BreakStatement {
    const loc = this.currentLoc()
    this.expectKeyword('break')
    return { kind: 'break', loc }
  }

  private parseContinue(): AST.ContinueStatement {
    const loc = this.currentLoc()
    this.expectKeyword('continue')
    return { kind: 'continue', loc }
  }

  private parseReturn(): AST.ReturnStatement {
    const loc = this.currentLoc()
    this.expectKeyword('return')

    // Check if there's a value to return
    let value: AST.Expression | undefined
    if (!this.check('NEWLINE') && !this.check('DEDENT') && !this.isAtEnd()) {
      value = this.parseExpression()
    }

    return { kind: 'return', value, loc }
  }

  // ============================================================================
  // Layout Definition
  // ============================================================================

  private parseLayout(): AST.LayoutDef {
    const loc = this.currentLoc()
    this.expectKeyword('layout')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const layout: AST.LayoutDef = {
      kind: 'layout',
      name,
      coordinate: 'voxel',
      rooms: [],
      doors: [],
      terminals: [],
      switches: [],
      wallLights: [],
      assets: [],
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD') {
        switch (token.value) {
          case 'coordinate':
            this.advance()
            this.expect('COLON')
            const coord = this.expectIdentifier()
            if (coord !== 'voxel' && coord !== 'world') {
              throw this.error(`Invalid coordinate system: ${coord}`)
            }
            layout.coordinate = coord
            this.expectNewlineOrDedent()
            break
          case 'rooms':
            layout.rooms = this.parseRoomsBlock()
            break
          case 'doors':
            layout.doors = this.parseDoorsBlock()
            break
          case 'terminals':
            layout.terminals = this.parseTerminalsBlock()
            break
          case 'switches':
            layout.switches = this.parseSwitchesBlock()
            break
          case 'assets':
            layout.assets = this.parseLayoutAssetsBlock()
            break
          case 'wallLights':
            layout.wallLights = this.parseWallLightsBlock()
            break
          default:
            throw this.error(`Unexpected keyword '${token.value}' in layout`)
        }
      } else {
        throw this.error(`Unexpected token in layout: ${token.value}`)
      }
    }

    this.consumeDedent()
    return layout
  }

  private parseRoomsBlock(): AST.RoomDef[] {
    this.expectKeyword('rooms')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const rooms: AST.RoomDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const room = this.parseRoomDef()
      rooms.push(room)
    }

    this.consumeDedent()
    return rooms
  }

  private parseRoomDef(): AST.RoomDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expectKeyword('at')
    const position = this.parseVec3()
    this.expectKeyword('size')
    const size = this.parseVec3()

    let properties: Record<string, AST.Expression> | undefined

    if (this.check('COLON')) {
      this.advance()
      this.expectNewline()
      this.expectIndent()

      properties = {}
      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break

        const propName = this.expectIdentifier()
        this.expect('COLON')
        properties[propName] = this.parseExpression()
        this.expectNewlineOrDedent()
      }

      this.consumeDedent()
    } else {
      this.expectNewlineOrDedent()
    }

    return { kind: 'room', name, position, size, properties, loc }
  }

  private parseDoorsBlock(): AST.DoorDef[] {
    this.expectKeyword('doors')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const doors: AST.DoorDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const door = this.parseDoorDef()
      doors.push(door)
    }

    this.consumeDedent()
    return doors
  }

  private parseDoorDef(): AST.DoorDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expectKeyword('at')
    const position = this.parseVec3()
    this.expectKeyword('facing')
    const facing = this.expectIdentifier()

    let connects: [string, string] | undefined
    let control: string | undefined

    if (this.check('COLON')) {
      this.advance()
      this.expectNewline()
      this.expectIndent()

      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break

        const propName = this.expectIdentifier()
        if (propName === 'connects') {
          this.expect('COLON')
          const room1 = this.expectIdentifier()
          this.expect('BIARROW')
          const room2 = this.expectIdentifier()
          connects = [room1, room2]
        } else if (propName === 'control') {
          this.expect('COLON')
          control = this.expectIdentifier()
        }
        this.expectNewlineOrDedent()
      }

      this.consumeDedent()
    } else {
      this.expectNewlineOrDedent()
    }

    if (!connects) {
      throw this.error('Door must specify connects')
    }

    return { kind: 'door', name, position, facing, connects, control, loc }
  }

  private parseTerminalsBlock(): AST.TerminalDef[] {
    this.expectKeyword('terminals')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const terminals: AST.TerminalDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const terminal = this.parseTerminalDef()
      terminals.push(terminal)
    }

    this.consumeDedent()
    return terminals
  }

  private parseTerminalDef(): AST.TerminalDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expectKeyword('at')
    const position = this.parseVec3()

    let rotation = 0
    let type: string | undefined
    let properties: Record<string, AST.Expression> | undefined

    if (this.check('COLON')) {
      this.advance()
      this.expectNewline()
      this.expectIndent()

      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break

        const propName = this.expectIdentifier()
        this.expect('COLON')
        if (propName === 'rotation') {
          const rotToken = this.expect('NUMBER')
          rotation = parseFloat(rotToken.value)
        } else if (propName === 'type') {
          type = this.expectIdentifier()
        } else {
          properties = properties || {}
          properties[propName] = this.parseExpression()
        }
        this.expectNewlineOrDedent()
      }

      this.consumeDedent()
    } else {
      this.expectNewlineOrDedent()
    }

    return { kind: 'terminal', name, position, rotation, type, properties, loc }
  }

  private parseSwitchesBlock(): AST.SwitchDef[] {
    this.expectKeyword('switches')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const switches: AST.SwitchDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const sw = this.parseSwitchDef()
      switches.push(sw)
    }

    this.consumeDedent()
    return switches
  }

  private parseSwitchDef(): AST.SwitchDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expectKeyword('at')
    const position = this.parseVec3()

    let rotation = 0
    let status: string | undefined

    if (this.check('COLON')) {
      this.advance()
      this.expectNewline()
      this.expectIndent()

      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break

        const propName = this.expectIdentifier()
        this.expect('COLON')
        if (propName === 'rotation') {
          const rotToken = this.expect('NUMBER')
          rotation = parseFloat(rotToken.value)
        } else if (propName === 'status') {
          status = this.expectIdentifier()
        }
        this.expectNewlineOrDedent()
      }

      this.consumeDedent()
    } else {
      this.expectNewlineOrDedent()
    }

    return { kind: 'switch', name, position, rotation, status, loc }
  }

  private parseWallLightsBlock(): AST.WallLightDef[] {
    this.expectKeyword('wallLights')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const lights: AST.WallLightDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const light = this.parseWallLightDef()
      lights.push(light)
    }

    this.consumeDedent()
    return lights
  }

  private parseWallLightDef(): AST.WallLightDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expectKeyword('at')
    const position = this.parseVec3()

    let rotation = 0
    let color: AST.ColorLiteral | undefined
    let intensity: number | undefined

    if (this.check('COLON')) {
      this.advance()
      this.expectNewline()
      this.expectIndent()

      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break

        const propName = this.expectIdentifier()
        this.expect('COLON')
        if (propName === 'rotation') {
          const rotToken = this.expect('NUMBER')
          rotation = parseFloat(rotToken.value)
        } else if (propName === 'color') {
          const colorToken = this.expect('COLOR')
          color = { kind: 'color', value: colorToken.value, loc: this.currentLoc() }
        } else if (propName === 'intensity') {
          const intToken = this.expect('NUMBER')
          intensity = parseFloat(intToken.value)
        }
        this.expectNewlineOrDedent()
      }

      this.consumeDedent()
    } else {
      this.expectNewlineOrDedent()
    }

    return { kind: 'wallLight', name, position, rotation, color, intensity, loc }
  }

  private parseLayoutAssetsBlock(): AST.AssetInstanceDef[] {
    this.expectKeyword('assets')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const assets: AST.AssetInstanceDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const asset = this.parseAssetInstanceDef()
      assets.push(asset)
    }

    this.consumeDedent()
    return assets
  }

  private parseAssetInstanceDef(): AST.AssetInstanceDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expectKeyword('at')
    const position = this.parseVec3()

    let rotation: number | undefined
    let facing: string | undefined
    let asset: string | undefined
    let properties: Record<string, AST.Expression> | undefined

    if (this.checkKeyword('facing')) {
      this.advance()
      facing = this.expectIdentifier()
    }

    if (this.check('COLON')) {
      this.advance()
      this.expectNewline()
      this.expectIndent()

      while (!this.checkDedent() && !this.isAtEnd()) {
        this.skipNewlines()
        if (this.checkDedent()) break

        const propName = this.expectIdentifier()
        this.expect('COLON')
        if (propName === 'asset') {
          asset = this.expectIdentifier()
        } else if (propName === 'rotation') {
          const rotToken = this.expect('NUMBER')
          rotation = parseFloat(rotToken.value)
        } else {
          properties = properties || {}
          properties[propName] = this.parseExpression()
        }
        this.expectNewlineOrDedent()
      }

      this.consumeDedent()
    } else {
      this.expectNewlineOrDedent()
    }

    if (!asset) {
      throw this.error('Asset instance must specify asset type')
    }

    return { kind: 'assetInstance', name, asset, position, rotation, facing, properties, loc }
  }

  // ============================================================================
  // Entity Definition
  // ============================================================================

  private parseEntity(): AST.EntityDef {
    const loc = this.currentLoc()
    this.expectKeyword('entity')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const entity: AST.EntityDef = {
      kind: 'entity',
      name,
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD') {
        switch (token.value) {
          case 'params':
            entity.params = this.parseParamsBlock()
            break
          case 'when':
          case 'on':
            entity.body = entity.body || []
            entity.body.push(this.parseStatement())
            break
          default:
            throw this.error(`Unexpected keyword '${token.value}' in entity`)
        }
      } else if (token.type === 'IDENTIFIER') {
        if (token.value === 'screen') {
          entity.screen = this.parseScreenBlock()
        } else if (token.value === 'render') {
          entity.render = this.parseRenderBlock()
        } else if (token.value === 'styles') {
          entity.styles = this.parseStylesBlock()
        } else {
          throw this.error(`Unexpected identifier '${token.value}' in entity`)
        }
      } else {
        throw this.error(`Unexpected token in entity: ${token.value}`)
      }
    }

    this.consumeDedent()
    return entity
  }

  private parseScreenBlock(): AST.ScreenBlock {
    const loc = this.currentLoc()
    this.advance()  // skip 'screen'
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    let size: AST.Vec2 | undefined
    let font: string | undefined
    let fontSize: number | undefined
    let background: AST.ColorLiteral | undefined
    let lineHeight: number | undefined
    let padding: number | undefined

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const propName = this.expectIdentifier()
      this.expect('COLON')

      if (propName === 'size') {
        size = this.parseVec2()
      } else if (propName === 'font') {
        font = this.expect('STRING').value
      } else if (propName === 'fontSize') {
        fontSize = parseFloat(this.expect('NUMBER').value)
      } else if (propName === 'background') {
        const color = this.expect('COLOR')
        background = { kind: 'color', value: color.value, loc: this.currentLoc() }
      } else if (propName === 'lineHeight') {
        lineHeight = parseFloat(this.expect('NUMBER').value)
      } else if (propName === 'padding') {
        padding = parseFloat(this.expect('NUMBER').value)
      }
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()

    if (!size) {
      throw this.error('Screen must specify size')
    }

    return { kind: 'screen', size, font, fontSize, background, lineHeight, padding, loc }
  }

  private parseRenderBlock(): AST.RenderBlock {
    const loc = this.currentLoc()
    this.advance()  // skip 'render'
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.RenderStatement[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const stmt = this.parseRenderStatement()
      body.push(stmt)
    }

    this.consumeDedent()
    return { kind: 'render', body, loc }
  }

  private parseRenderStatement(): AST.RenderStatement {
    const token = this.current()

    if (token.type === 'KEYWORD' && token.value === 'match') {
      return this.parseRenderMatch()
    }

    if (token.type === 'IDENTIFIER') {
      switch (token.value) {
        case 'text':
          return this.parseTextRender()
        case 'row':
          return this.parseRowRender()
        case 'code':
          return this.parseCodeRender()
      }
    }

    throw this.error(`Expected render statement, got '${token.value}'`)
  }

  private parseRenderMatch(): AST.MatchBlock {
    const loc = this.currentLoc()
    this.expectKeyword('match')
    const expression = this.parseExpression()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const cases: AST.MatchCase[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const caseLoc = this.currentLoc()
      const pattern = this.parseExpression()

      // Support both arrow syntax (PATTERN ->) and colon syntax (PATTERN:)
      const body: AST.Statement[] = []
      if (this.check('ARROW')) {
        this.advance()
        // Arrow syntax: can be inline or block
        if (this.check('NEWLINE')) {
          this.expectNewline()
          this.expectIndent()
          while (!this.checkDedent() && !this.isAtEnd()) {
            this.skipNewlines()
            if (this.checkDedent()) break
            body.push(this.parseRenderStatement() as unknown as AST.Statement)
            this.expectNewlineOrDedent()
          }
          this.consumeDedent()
        } else {
          // Single line
          body.push(this.parseRenderStatement() as unknown as AST.Statement)
          this.expectNewlineOrDedent()
        }
      } else if (this.check('COLON')) {
        // Colon syntax: always block
        this.advance()
        this.expectNewline()
        this.expectIndent()
        while (!this.checkDedent() && !this.isAtEnd()) {
          this.skipNewlines()
          if (this.checkDedent()) break
          body.push(this.parseRenderStatement() as unknown as AST.Statement)
          this.expectNewlineOrDedent()
        }
        this.consumeDedent()
      } else {
        throw this.error(`Expected '->' or ':' after match pattern, got ${this.current().type}`)
      }

      cases.push({ kind: 'matchCase', pattern, body, loc: caseLoc })
    }

    this.consumeDedent()
    return { kind: 'match', expression, cases, loc }
  }

  private parseTextRender(): AST.TextRenderStatement {
    const loc = this.currentLoc()
    this.advance()  // skip 'text'
    const content = this.parseExpression()
    let centered = false
    if (this.checkIdentifier('centered')) {
      this.advance()
      centered = true
    }
    this.expectNewlineOrDedent()
    return { kind: 'text', content, centered, loc }
  }

  private parseRowRender(): AST.RowRenderStatement {
    const loc = this.currentLoc()
    this.advance()  // skip 'row'
    const label = this.parseExpression()
    const value = this.parseExpression()
    this.expectNewlineOrDedent()
    return { kind: 'row', label, value, loc }
  }

  private parseCodeRender(): AST.CodeRenderStatement {
    const loc = this.currentLoc()
    this.advance()  // skip 'code'
    const content = this.parseExpression()
    let lineNumbers = false
    if (this.checkIdentifier('lineNumbers')) {
      this.advance()
      this.expect('COLON')
      const val = this.expect('BOOLEAN')
      lineNumbers = val.value === 'true'
    }
    this.expectNewlineOrDedent()
    return { kind: 'code', content, lineNumbers, loc }
  }

  private parseStylesBlock(): AST.StylesBlock {
    const loc = this.currentLoc()
    this.advance()  // skip 'styles'
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const styles: AST.StyleDef[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const style = this.parseStyleDef()
      styles.push(style)
    }

    this.consumeDedent()
    return { kind: 'styles', styles, loc }
  }

  private parseStyleDef(): AST.StyleDef {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const properties: Record<string, AST.Expression> = {}

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const propName = this.expectIdentifier()
      this.expect('COLON')
      properties[propName] = this.parseExpression()
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'style', name, properties, loc }
  }

  // ============================================================================
  // Machine Definition
  // ============================================================================

  private parseMachine(): AST.MachineDef {
    const loc = this.currentLoc()
    this.expectKeyword('machine')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const states: AST.MachineState[] = []
    let initial: string | undefined

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'IDENTIFIER') {
        if (token.value === 'initial') {
          this.advance()
          this.expect('COLON')
          initial = this.expectIdentifier()
          this.expectNewlineOrDedent()
        } else if (token.value === 'states') {
          this.advance()
          this.expect('COLON')
          this.expectNewline()
          this.expectIndent()

          while (!this.checkDedent() && !this.isAtEnd()) {
            this.skipNewlines()
            if (this.checkDedent()) break
            states.push(this.parseMachineState())
          }

          this.consumeDedent()
        }
      } else {
        throw this.error(`Unexpected token in machine: ${token.value}`)
      }
    }

    this.consumeDedent()

    if (!initial) {
      throw this.error('Machine must specify initial state')
    }

    return { kind: 'machine', name, states, initial, loc }
  }

  private parseMachineState(): AST.MachineState {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const transitions: AST.MachineTransition[] = []
    let enter: AST.Statement[] | undefined
    let exit: AST.Statement[] | undefined

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD' && token.value === 'on') {
        this.advance()
        const event = this.expectIdentifier()
        this.expect('ARROW')
        const target = this.expectIdentifier()

        let guard: AST.Expression | undefined
        let actions: AST.Statement[] | undefined

        if (this.checkKeyword('when')) {
          this.advance()
          guard = this.parseExpression()
        }

        if (this.check('COLON')) {
          this.advance()
          this.expectNewline()
          this.expectIndent()
          actions = []
          while (!this.checkDedent() && !this.isAtEnd()) {
            this.skipNewlines()
            if (this.checkDedent()) break
            actions.push(this.parseStatement())
            this.expectNewlineOrDedent()
          }
          this.consumeDedent()
        } else {
          this.expectNewlineOrDedent()
        }

        transitions.push({ kind: 'transition', event, target, guard, actions, loc: this.currentLoc() })
      } else if (token.type === 'IDENTIFIER' && token.value === 'enter') {
        this.advance()
        this.expect('COLON')
        this.expectNewline()
        this.expectIndent()
        enter = []
        while (!this.checkDedent() && !this.isAtEnd()) {
          this.skipNewlines()
          if (this.checkDedent()) break
          enter.push(this.parseStatement())
          this.expectNewlineOrDedent()
        }
        this.consumeDedent()
      } else if (token.type === 'IDENTIFIER' && token.value === 'exit') {
        this.advance()
        this.expect('COLON')
        this.expectNewline()
        this.expectIndent()
        exit = []
        while (!this.checkDedent() && !this.isAtEnd()) {
          this.skipNewlines()
          if (this.checkDedent()) break
          exit.push(this.parseStatement())
          this.expectNewlineOrDedent()
        }
        this.consumeDedent()
      } else {
        throw this.error(`Unexpected token in machine state: ${token.value}`)
      }
    }

    this.consumeDedent()
    return { kind: 'machineState', name, on: transitions, enter, exit, loc }
  }

  // ============================================================================
  // Config Definition
  // ============================================================================

  private parseConfig(): AST.ConfigDef {
    const loc = this.currentLoc()
    this.expectKeyword('config')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const properties = this.parseConfigProperties()

    this.consumeDedent()
    return { kind: 'config', name, properties, loc }
  }

  private parseConfigProperties(): Record<string, AST.ConfigValue> {
    const properties: Record<string, AST.ConfigValue> = {}

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const propName = this.expectIdentifier()
      this.expect('COLON')

      // Check if this is a nested object (has newline + indent) or a value
      if (this.check('NEWLINE')) {
        this.expectNewline()
        if (this.check('INDENT')) {
          this.expectIndent()
          // Nested config object
          const nested = this.parseConfigProperties()
          this.consumeDedent()
          properties[propName] = {
            kind: 'configObject',
            properties: nested,
            loc: this.currentLoc()
          }
        } else {
          // Empty value - shouldn't happen but handle gracefully
          properties[propName] = { kind: 'number', value: 0, loc: this.currentLoc() }
        }
      } else {
        // Inline value
        properties[propName] = this.parseExpression()
        this.expectNewlineOrDedent()
      }
    }

    return properties
  }

  // ============================================================================
  // Function Definition (Phase 8c)
  // ============================================================================

  private parseFunction(): AST.FunctionDef {
    const loc = this.currentLoc()
    this.expectKeyword('def')
    const name = this.expectIdentifier()
    this.expect('LPAREN')

    // Parse parameters
    const params: AST.FunctionParam[] = []
    if (!this.check('RPAREN')) {
      params.push(this.parseFunctionParam())
      while (this.check('COMMA')) {
        this.advance()
        params.push(this.parseFunctionParam())
      }
    }
    this.expect('RPAREN')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    // Parse body - will be implemented fully in Phase 8c
    const body: AST.Statement[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseStatement())
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'function', name, params, body, loc }
  }

  private parseFunctionParam(): AST.FunctionParam {
    const loc = this.currentLoc()
    const name = this.expectIdentifier()
    let defaultValue: AST.Expression | undefined

    if (this.check('EQUALS')) {
      this.advance()
      defaultValue = this.parseExpression()
    }

    return { kind: 'functionParam', name, default: defaultValue, loc }
  }

  // ============================================================================
  // Rule Definition (Phase 8f)
  // ============================================================================

  private parseRule(): AST.RuleDef {
    const loc = this.currentLoc()
    this.expectKeyword('rule')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    let trigger: 'tick' | string = 'tick'
    let condition: AST.Expression | undefined
    const effects: AST.Statement[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD' && token.value === 'trigger') {
        this.advance()
        this.expect('COLON')
        trigger = this.expectIdentifier()
        this.expectNewlineOrDedent()
      } else if (token.type === 'KEYWORD' && token.value === 'when') {
        this.advance()
        this.expect('COLON')
        condition = this.parseExpression()
        this.expectNewlineOrDedent()
      } else if (token.type === 'KEYWORD' && token.value === 'effect') {
        this.advance()
        this.expect('COLON')
        this.expectNewline()
        this.expectIndent()
        while (!this.checkDedent() && !this.isAtEnd()) {
          this.skipNewlines()
          if (this.checkDedent()) break
          effects.push(this.parseStatement())
          this.expectNewlineOrDedent()
        }
        this.consumeDedent()
      } else {
        throw this.error(`Unexpected token in rule: ${token.value}`)
      }
    }

    this.consumeDedent()
    return { kind: 'rule', name, trigger, condition, effects, loc }
  }

  // ============================================================================
  // Scenario Definition (Phase 8g)
  // ============================================================================

  private parseScenario(): AST.ScenarioDef {
    const loc = this.currentLoc()
    this.expectKeyword('scenario')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const initial: Record<string, AST.Expression> = {}
    const handlers: AST.OnBlock[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD' && token.value === 'initial') {
        this.advance()
        this.expect('COLON')
        this.expectNewline()
        this.expectIndent()
        while (!this.checkDedent() && !this.isAtEnd()) {
          this.skipNewlines()
          if (this.checkDedent()) break
          const propName = this.expectIdentifier()
          this.expect('COLON')
          initial[propName] = this.parseExpression()
          this.expectNewlineOrDedent()
        }
        this.consumeDedent()
      } else if (token.type === 'KEYWORD' && token.value === 'on') {
        handlers.push(this.parseOnBlock())
      } else {
        throw this.error(`Unexpected token in scenario: ${token.value}`)
      }
    }

    this.consumeDedent()
    return { kind: 'scenario', name, initial, handlers, loc }
  }

  // ============================================================================
  // Behavior Definition (Phase 8h)
  // ============================================================================

  private parseBehavior(): AST.BehaviorDef {
    const loc = this.currentLoc()
    this.expectKeyword('behavior')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const handlers: AST.OnBlock[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD' && token.value === 'on') {
        handlers.push(this.parseOnBlock())
      } else {
        throw this.error(`Unexpected token in behavior: ${token.value}`)
      }
    }

    this.consumeDedent()
    return { kind: 'behavior', name, handlers, loc }
  }

  private parseOnBlock(): AST.OnBlock {
    const loc = this.currentLoc()
    this.expectKeyword('on')
    const event = this.expectIdentifier()

    let condition: AST.Expression | undefined
    if (this.checkKeyword('when')) {
      this.advance()
      condition = this.parseExpression()
    }

    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const body: AST.Statement[] = []
    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break
      body.push(this.parseStatement())
      this.expectNewlineOrDedent()
    }

    this.consumeDedent()
    return { kind: 'on', event, condition, body, loc }
  }

  // ============================================================================
  // Condition Definition (Phase 11.1)
  // ============================================================================

  /**
   * Parse a condition definition:
   *   condition escape_galley
   *     type: victory
   *     trigger: $player_room == "corridor" and $previous_room == "galley"
   *     message: "You escaped!"
   *     effect:
   *       emit "game:victory"
   */
  private parseCondition(): AST.ConditionDef {
    const loc = this.currentLoc()
    this.expectKeyword('condition')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    let conditionType: 'victory' | 'defeat' | 'checkpoint' = 'victory'
    let trigger: AST.Expression | undefined
    let message: AST.Expression | undefined
    const effects: AST.Statement[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD' && token.value === 'type') {
        this.advance()
        this.expect('COLON')
        const typeValue = this.expectIdentifier()
        if (typeValue !== 'victory' && typeValue !== 'defeat' && typeValue !== 'checkpoint') {
          throw this.error(`Invalid condition type '${typeValue}', expected victory, defeat, or checkpoint`)
        }
        conditionType = typeValue
        this.expectNewlineOrDedent()
      } else if (token.type === 'KEYWORD' && token.value === 'trigger') {
        this.advance()
        this.expect('COLON')
        trigger = this.parseExpression()
        this.expectNewlineOrDedent()
      } else if (token.type === 'KEYWORD' && token.value === 'message') {
        this.advance()
        this.expect('COLON')
        message = this.parseExpression()
        this.expectNewlineOrDedent()
      } else if (token.type === 'KEYWORD' && token.value === 'effect') {
        this.advance()
        this.expect('COLON')
        this.expectNewline()
        this.expectIndent()
        while (!this.checkDedent() && !this.isAtEnd()) {
          this.skipNewlines()
          if (this.checkDedent()) break
          effects.push(this.parseStatement())
          this.expectNewlineOrDedent()
        }
        this.consumeDedent()
      } else {
        throw this.error(`Unexpected token in condition: ${token.value}`)
      }
    }

    this.consumeDedent()

    if (!trigger) {
      throw this.error(`Condition '${name}' must have a trigger`)
    }

    return {
      kind: 'condition',
      name,
      conditionType,
      trigger,
      message,
      effects,
      loc
    }
  }

  // ============================================================================
  // Game Definition (Phase 1 - Engine/Game Separation)
  // ============================================================================

  /**
   * Parse a game definition:
   *   game galley_escape
   *     ship: "galley"
   *     layout: "ships/galley/galley.layout.json"
   *     scenario: "galley_escape"
   *
   *     player:
   *       controller: first_person
   *       spawn_room: "galley"
   *       spawn_position: (0, 0.1, 0)
   *
   *     on_start:
   *       start_scenario "galley_escape"
   */
  private parseGame(): AST.GameDef {
    const loc = this.currentLoc()
    this.expectKeyword('game')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const game: AST.GameDef = {
      kind: 'game',
      name,
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD') {
        switch (token.value) {
          case 'ship':
            this.advance()
            this.expect('COLON')
            game.ship = this.expect('STRING').value
            this.expectNewlineOrDedent()
            break
          case 'layout':
            this.advance()
            this.expect('COLON')
            game.layout = this.expect('STRING').value
            this.expectNewlineOrDedent()
            break
          case 'scenario':
            this.advance()
            this.expect('COLON')
            game.scenario = this.expect('STRING').value
            this.expectNewlineOrDedent()
            break
          case 'player':
            game.player = this.parsePlayerConfig()
            break
          case 'camera':
            game.camera = this.parseCameraConfig()
            break
          case 'sync':
            game.sync = this.parseSyncConfig()
            break
          case 'on':
            // Handle on_start, on_victory, on_gameover as "on start:", "on victory:", etc.
            this.advance()
            const eventType = this.expectIdentifier()
            this.expect('COLON')
            this.expectNewline()
            this.expectIndent()

            const handlers: AST.Statement[] = []
            while (!this.checkDedent() && !this.isAtEnd()) {
              this.skipNewlines()
              if (this.checkDedent()) break
              handlers.push(this.parseStatement())
              this.expectNewlineOrDedent()
            }
            this.consumeDedent()

            if (eventType === 'start') {
              game.onStart = handlers
            } else if (eventType === 'victory') {
              game.onVictory = handlers
            } else if (eventType === 'gameover') {
              game.onGameover = handlers
            }
            break
          default:
            throw this.error(`Unexpected keyword '${token.value}' in game`)
        }
      } else if (token.type === 'IDENTIFIER') {
        // Generic property: name: value
        const propName = token.value
        this.advance()
        this.expect('COLON')
        game.properties = game.properties || {}
        game.properties[propName] = this.parseExpression()
        this.expectNewlineOrDedent()
      } else {
        throw this.error(`Unexpected token in game: ${token.value}`)
      }
    }

    this.consumeDedent()
    return game
  }

  /**
   * Parse player configuration block:
   *   player:
   *     controller: first_person
   *     spawn_room: "galley"
   *     spawn_position: (0, 0.1, 0)
   *     collision: cylinder { height: 1.6, radius: 0.35 }
   */
  private parsePlayerConfig(): AST.PlayerConfig {
    const loc = this.currentLoc()
    this.expectKeyword('player')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const config: AST.PlayerConfig = {
      kind: 'playerConfig',
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD' || token.type === 'IDENTIFIER') {
        const propName = token.value
        this.advance()
        this.expect('COLON')

        switch (propName) {
          case 'controller':
            config.controller = this.expectIdentifier()
            break
          case 'spawn_room':
            config.spawnRoom = this.expect('STRING').value
            break
          case 'spawn_position':
            config.spawnPosition = this.parseVec3()
            break
          case 'collision':
            config.collision = this.parseCollisionConfig()
            break
          default:
            // Skip unknown properties
            this.parseExpression()
        }
        this.expectNewlineOrDedent()
      } else {
        throw this.error(`Unexpected token in player config: ${token.value}`)
      }
    }

    this.consumeDedent()
    return config
  }

  /**
   * Parse collision configuration:
   *   collision: cylinder { height: 1.6, radius: 0.35 }
   *   collision: box { width: 1, height: 2, depth: 1 }
   *   collision: none
   */
  private parseCollisionConfig(): AST.PlayerConfig['collision'] {
    const typeToken = this.current()

    if (typeToken.type === 'IDENTIFIER' || typeToken.type === 'KEYWORD') {
      const typeName = typeToken.value
      this.advance()

      if (typeName === 'none') {
        return { type: 'none', params: {} }
      }

      if (typeName !== 'cylinder' && typeName !== 'box') {
        throw this.error(`Unknown collision type '${typeName}', expected cylinder, box, or none`)
      }

      // Parse params: { height: 1.6, radius: 0.35 }
      const params: Record<string, AST.Expression> = {}
      if (this.check('LBRACE')) {
        this.advance()
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          const paramName = this.expectIdentifier()
          this.expect('COLON')
          params[paramName] = this.parseExpression()
          if (this.check('COMMA')) {
            this.advance()
          }
        }
        this.expect('RBRACE')
      }

      return { type: typeName as 'cylinder' | 'box', params }
    }

    throw this.error(`Expected collision type, got ${typeToken.type}`)
  }

  /**
   * Parse camera configuration block:
   *   camera:
   *     type: orthographic
   *     position: (0, 15, 0)
   *     lookAt: (0, 0, 0)
   *     viewSize: 14
   */
  private parseCameraConfig(): AST.CameraConfigDef {
    const loc = this.currentLoc()
    this.expectKeyword('camera')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const config: AST.CameraConfigDef = {
      kind: 'cameraConfig',
      type: 'perspective', // default
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD' || token.type === 'IDENTIFIER') {
        const propName = token.value
        this.advance()
        this.expect('COLON')

        switch (propName) {
          case 'type':
            const typeValue = this.expectIdentifier()
            if (typeValue !== 'perspective' && typeValue !== 'orthographic') {
              throw this.error(`Invalid camera type '${typeValue}', expected perspective or orthographic`)
            }
            config.type = typeValue
            break
          case 'position':
            config.position = this.parseVec3()
            break
          case 'lookAt':
            config.lookAt = this.parseVec3()
            break
          case 'fov':
            const fovExpr = this.parseExpression()
            if (fovExpr.kind === 'number') {
              config.fov = fovExpr.value
            }
            break
          case 'viewSize':
            const viewSizeExpr = this.parseExpression()
            if (viewSizeExpr.kind === 'number') {
              config.viewSize = viewSizeExpr.value
            }
            break
          default:
            // Skip unknown properties
            this.parseExpression()
        }
        this.expectNewlineOrDedent()
      } else {
        throw this.error(`Unexpected token in camera config: ${token.value}`)
      }
    }

    this.consumeDedent()
    return config
  }

  /**
   * Parse sync configuration block:
   *   sync:
   *     ball: "ball.position"
   *     paddle_left: "paddle_left.position"
   */
  private parseSyncConfig(): AST.SyncConfigDef {
    const loc = this.currentLoc()
    this.expectKeyword('sync')
    this.expect('COLON')
    this.expectNewline()
    this.expectIndent()

    const config: AST.SyncConfigDef = {
      kind: 'syncConfig',
      entries: {},
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'IDENTIFIER') {
        const entityName = token.value
        this.advance()
        this.expect('COLON')
        const statePath = this.expect('STRING').value
        config.entries[entityName] = statePath
        this.expectNewlineOrDedent()
      } else {
        throw this.error(`Unexpected token in sync config: ${token.value}`)
      }
    }

    this.consumeDedent()
    return config
  }

  // ============================================================================
  // Interaction Definition (Phase 2 - Engine/Game Separation)
  // ============================================================================

  /**
   * Parse an interaction definition:
   *   interaction switch_use
   *     target: entity where voxel_type in [SWITCH, SWITCH_BUTTON]
   *     range: 2.0
   *     prompt: "Press [E] to use {name}"
   *     prompt_broken: "{name} [DAMAGED]"
   *
   *     on_interact:
   *       if $target.status == FAULT:
   *         emit "sparks"
   *       else:
   *         toggle $target.state
   */
  private parseInteraction(): AST.InteractionDef {
    const loc = this.currentLoc()
    this.expectKeyword('interaction')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const interaction: AST.InteractionDef = {
      kind: 'interaction',
      name,
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD') {
        switch (token.value) {
          case 'target':
            this.advance()
            this.expect('COLON')
            interaction.target = this.parseInteractionTarget()
            this.expectNewlineOrDedent()
            break
          case 'range':
            this.advance()
            this.expect('COLON')
            interaction.range = this.parseExpression()
            this.expectNewlineOrDedent()
            break
          case 'prompt':
            this.advance()
            this.expect('COLON')
            interaction.prompt = this.parseExpression()
            this.expectNewlineOrDedent()
            break
          case 'prompt_broken':
            this.advance()
            this.expect('COLON')
            interaction.promptBroken = this.parseExpression()
            this.expectNewlineOrDedent()
            break
          case 'on_interact':
            this.advance()
            this.expect('COLON')
            this.expectNewline()
            this.expectIndent()

            const handlers: AST.Statement[] = []
            while (!this.checkDedent() && !this.isAtEnd()) {
              this.skipNewlines()
              if (this.checkDedent()) break
              handlers.push(this.parseStatement())
              this.expectNewlineOrDedent()
            }
            this.consumeDedent()
            interaction.onInteract = handlers
            break
          default:
            throw this.error(`Unexpected keyword '${token.value}' in interaction`)
        }
      } else if (token.type === 'IDENTIFIER') {
        // Generic property: name: value
        const propName = token.value
        this.advance()
        this.expect('COLON')
        interaction.properties = interaction.properties || {}
        interaction.properties[propName] = this.parseExpression()
        this.expectNewlineOrDedent()
      } else {
        throw this.error(`Unexpected token in interaction: ${token.value}`)
      }
    }

    this.consumeDedent()
    return interaction
  }

  /**
   * Parse interaction target:
   *   target: entity where voxel_type in [SWITCH, SWITCH_BUTTON]
   *   target: entity where type == "terminal"
   *   target: switch
   */
  private parseInteractionTarget(): AST.InteractionTarget {
    const loc = this.currentLoc()
    const target: AST.InteractionTarget = {
      kind: 'interactionTarget',
      loc
    }

    // Check for "entity" keyword followed by optional "where" clause
    const token = this.current()
    if (token.type === 'KEYWORD' && token.value === 'entity') {
      this.advance()

      // Check for "where" condition
      if (this.check('KEYWORD') && this.current().value === 'where') {
        this.advance()
        target.condition = this.parseExpression()
      }
    } else if (token.type === 'IDENTIFIER') {
      // Simple entity type: target: switch
      target.entityType = token.value
      this.advance()
    } else {
      throw this.error(`Expected entity type or 'entity where', got ${token.type}`)
    }

    return target
  }

  // ============================================================================
  // Display Template Definition
  // ============================================================================

  /**
   * Parse display template:
   *   display-template status_terminal
   *     width: 40
   *     header: "═══ {location} STATUS ═══"
   *     rows:
   *       - label: "O2 LEVEL"
   *         value: "{o2_level}%"
   *         color:
   *           nominal when o2_level >= 50
   */
  private parseDisplayTemplate(): AST.DisplayTemplateDef {
    const loc = this.currentLoc()
    this.expectKeyword('display-template')
    const name = this.expectIdentifier()
    this.expectNewline()
    this.expectIndent()

    const template: AST.DisplayTemplateDef = {
      kind: 'displayTemplate',
      name,
      loc
    }

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const token = this.current()

      if (token.type === 'KEYWORD') {
        switch (token.value) {
          case 'width':
            this.advance()
            this.expect('COLON')
            template.width = this.parseExpression()
            this.expectNewlineOrDedent()
            break
          case 'height':
            this.advance()
            this.expect('COLON')
            template.height = this.parseExpression()
            this.expectNewlineOrDedent()
            break
          case 'header':
            this.advance()
            this.expect('COLON')
            template.header = this.parseExpression()
            this.expectNewlineOrDedent()
            break
          case 'footer':
            this.advance()
            this.expect('COLON')
            template.footer = this.parseExpression()
            this.expectNewlineOrDedent()
            break
          case 'rows':
            this.advance()
            this.expect('COLON')
            this.expectNewline()
            this.expectIndent()
            template.rows = this.parseDisplayRows()
            this.consumeDedent()
            break
          default:
            throw this.error(`Unexpected keyword '${token.value}' in display-template`)
        }
      } else if (token.type === 'IDENTIFIER') {
        // Generic property: name: value
        const propName = token.value
        this.advance()
        this.expect('COLON')
        template.properties = template.properties || {}
        template.properties[propName] = this.parseExpression()
        this.expectNewlineOrDedent()
      } else {
        throw this.error(`Unexpected token in display-template: ${token.value}`)
      }
    }

    this.consumeDedent()
    return template
  }

  /**
   * Parse display rows:
   *   - label: "O2 LEVEL"
   *     value: "{o2_level}%"
   *     color:
   *       nominal when o2_level >= 50
   */
  private parseDisplayRows(): AST.DisplayRow[] {
    const rows: AST.DisplayRow[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      // Expect '-' for list item
      if (this.current().type !== 'MINUS') {
        throw this.error(`Expected '-' for row item, got ${this.current().type}`)
      }
      this.advance()

      const loc = this.currentLoc()
      const row: AST.DisplayRow = {
        kind: 'displayRow',
        loc
      }

      // Parse row properties (label, value, color)
      this.expectKeyword('label')
      this.expect('COLON')
      row.label = this.parseExpression()
      this.expectNewline()

      this.expectIndent()

      // Value
      this.expectKeyword('value')
      this.expect('COLON')
      row.value = this.parseExpression()
      this.expectNewlineOrDedent()

      // Optional color conditions
      if (!this.checkDedent() && this.check('KEYWORD') && this.current().value === 'color') {
        this.advance()
        this.expect('COLON')
        this.expectNewline()
        this.expectIndent()

        row.colorConditions = this.parseColorConditions()
        this.consumeDedent()
      }

      this.consumeDedent()
      rows.push(row)
    }

    return rows
  }

  /**
   * Parse color conditions:
   *   nominal when o2_level >= 50
   *   warning when o2_level >= 20
   *   error when o2_level < 20
   */
  private parseColorConditions(): AST.DisplayColorCondition[] {
    const conditions: AST.DisplayColorCondition[] = []

    while (!this.checkDedent() && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.checkDedent()) break

      const loc = this.currentLoc()

      // Color name (nominal, warning, error, or custom)
      const colorToken = this.current()
      if (colorToken.type !== 'KEYWORD' && colorToken.type !== 'IDENTIFIER') {
        throw this.error(`Expected color name, got ${colorToken.type}`)
      }
      const colorName = colorToken.value
      this.advance()

      // 'when' keyword
      this.expectKeyword('when')

      // Condition expression
      const condition = this.parseExpression()

      conditions.push({
        kind: 'displayColorCondition',
        colorName,
        condition,
        loc
      })

      this.expectNewlineOrDedent()
    }

    return conditions
  }

  // ============================================================================
  // Expression Parsing
  // ============================================================================

  private parseExpression(): AST.Expression {
    return this.parseOr()
  }

  private parseOr(): AST.Expression {
    let left = this.parseAnd()

    while (this.checkKeyword('or')) {
      const loc = this.currentLoc()
      this.advance()
      const right = this.parseAnd()
      left = { kind: 'binary', operator: 'or', left, right, loc }
    }

    return left
  }

  private parseAnd(): AST.Expression {
    let left = this.parseEquality()

    while (this.checkKeyword('and')) {
      const loc = this.currentLoc()
      this.advance()
      const right = this.parseEquality()
      left = { kind: 'binary', operator: 'and', left, right, loc }
    }

    return left
  }

  private parseEquality(): AST.Expression {
    let left = this.parseComparison()

    while (this.check('EQUALS') && this.peek().type === 'EQUALS') {
      const loc = this.currentLoc()
      this.advance()
      this.advance()
      const right = this.parseComparison()
      left = { kind: 'binary', operator: '==', left, right, loc }
    }

    return left
  }

  private parseComparison(): AST.Expression {
    let left = this.parseAdditive()

    while (this.check('LT') || this.check('GT')) {
      const loc = this.currentLoc()
      const op = this.current().value
      this.advance()

      // Check for <= or >=
      let operator = op
      if (this.check('EQUALS')) {
        this.advance()
        operator = op + '='
      }

      const right = this.parseAdditive()
      left = { kind: 'binary', operator, left, right, loc }
    }

    return left
  }

  private parseAdditive(): AST.Expression {
    let left = this.parseMultiplicative()

    while (this.check('PLUS') || this.check('MINUS') || this.check('AT')) {
      const loc = this.currentLoc()
      const op = this.current().value
      this.advance()
      const right = this.parseMultiplicative()
      left = { kind: 'binary', operator: op, left, right, loc }
    }

    return left
  }

  private parseMultiplicative(): AST.Expression {
    let left = this.parseUnary()

    while (this.check('STAR') || this.check('SLASH')) {
      const loc = this.currentLoc()
      const op = this.current().value
      this.advance()
      const right = this.parseUnary()
      left = { kind: 'binary', operator: op, left, right, loc }
    }

    return left
  }

  private parseUnary(): AST.Expression {
    if (this.checkKeyword('not')) {
      const loc = this.currentLoc()
      this.advance()
      const operand = this.parseUnary()
      return { kind: 'unary', operator: 'not', operand, loc }
    }

    if (this.check('MINUS')) {
      const loc = this.currentLoc()
      this.advance()
      const operand = this.parseUnary()
      return { kind: 'unary', operator: '-', operand, loc }
    }

    return this.parsePostfix()
  }

  private parsePostfix(): AST.Expression {
    let expr = this.parsePrimary()

    while (true) {
      if (this.check('DOT')) {
        const loc = this.currentLoc()
        this.advance()
        const property = this.expectIdentifier()
        expr = { kind: 'member', object: expr, property, loc }
      } else if (this.check('LPAREN')) {
        // Function call
        const loc = this.currentLoc()
        if (expr.kind === 'identifier') {
          this.advance()
          const args: AST.Expression[] = []
          if (!this.check('RPAREN')) {
            args.push(this.parseExpression())
            while (this.check('COMMA')) {
              this.advance()
              args.push(this.parseExpression())
            }
          }
          this.expect('RPAREN')
          expr = { kind: 'call', name: expr.name, args, loc }
        } else {
          break
        }
      } else {
        break
      }
    }

    return expr
  }

  private parsePrimary(): AST.Expression {
    const token = this.current()
    const loc = this.currentLoc()

    // Reactive reference: $identifier
    if (token.type === 'DOLLAR') {
      this.advance()
      const path: string[] = []
      path.push(this.expectIdentifier())
      while (this.check('DOT')) {
        this.advance()
        path.push(this.expectIdentifier())
      }
      return { kind: 'reactive', path, loc }
    }

    // Number
    if (token.type === 'NUMBER') {
      this.advance()
      return { kind: 'number', value: parseFloat(token.value), loc }
    }

    // String
    if (token.type === 'STRING') {
      this.advance()
      return { kind: 'string', value: token.value, loc }
    }

    // Boolean
    if (token.type === 'BOOLEAN') {
      this.advance()
      return { kind: 'boolean', value: token.value === 'true', loc }
    }

    // Color
    if (token.type === 'COLOR') {
      this.advance()
      return { kind: 'color', value: token.value, loc }
    }

    // Duration
    if (token.type === 'DURATION') {
      return this.parseDuration()
    }

    // Vector or grouped expression
    if (token.type === 'LPAREN') {
      return this.parseVectorOrGroup()
    }

    // List
    if (token.type === 'LBRACKET') {
      return this.parseList()
    }

    // Identifier
    if (token.type === 'IDENTIFIER' || token.type === 'KEYWORD') {
      this.advance()
      return { kind: 'identifier', name: token.value, loc }
    }

    throw this.error(`Unexpected token in expression: '${token.value}'`)
  }

  private parseVectorOrGroup(): AST.Vec2 | AST.Vec3 | AST.Expression {
    const loc = this.currentLoc()
    this.expect('LPAREN')

    const first = this.parseExpression()

    if (this.check('COMMA')) {
      this.advance()
      const second = this.parseExpression()

      if (this.check('COMMA')) {
        this.advance()
        const third = this.parseExpression()
        this.expect('RPAREN')
        return { kind: 'vec3', x: first, y: second, z: third, loc }
      }

      this.expect('RPAREN')
      return { kind: 'vec2', x: first, y: second, loc }
    }

    this.expect('RPAREN')
    return first
  }

  private parseList(): AST.ListLiteral {
    const loc = this.currentLoc()
    this.expect('LBRACKET')

    const elements: AST.Expression[] = []
    if (!this.check('RBRACKET')) {
      elements.push(this.parseExpression())
      while (this.check('COMMA')) {
        this.advance()
        elements.push(this.parseExpression())
      }
    }

    this.expect('RBRACKET')
    return { kind: 'list', elements, loc }
  }

  private parseVec2(): AST.Vec2 {
    const result = this.parseVectorOrGroup()
    if (result.kind !== 'vec2') {
      throw this.error('Expected vec2')
    }
    return result
  }

  private parseVec3(): AST.Vec3 {
    const result = this.parseVectorOrGroup()
    if (result.kind !== 'vec3') {
      throw this.error('Expected vec3')
    }
    return result
  }

  private parseDuration(): AST.DurationLiteral {
    const loc = this.currentLoc()
    const token = this.expect('DURATION')

    // Parse duration value: 300ms, 2s, 1m, 1h
    const match = token.value.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/)
    if (!match) {
      throw this.error(`Invalid duration: ${token.value}`)
    }

    const value = parseFloat(match[1]!)
    const unit = match[2] as 'ms' | 's' | 'm' | 'h'

    // Convert to milliseconds
    let ms = value
    switch (unit) {
      case 's': ms = value * 1000; break
      case 'm': ms = value * 60000; break
      case 'h': ms = value * 3600000; break
    }

    return { kind: 'duration', value: ms, unit, loc }
  }

  private parseOptionalComment(): string | undefined {
    // Comments are handled by lexer, this is a placeholder
    return undefined
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: 0, column: 0 }
  }

  private peek(): Token {
    return this.tokens[this.pos + 1] ?? { type: 'EOF', value: '', line: 0, column: 0 }
  }

  private currentLoc(): AST.SourceLocation {
    const token = this.current()
    return { line: token.line, column: token.column }
  }

  private advance(): Token {
    const token = this.current()
    this.pos++
    return token
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF'
  }

  private check(type: TokenType): boolean {
    return this.current().type === type
  }

  private checkKeyword(value: string): boolean {
    const token = this.current()
    return token.type === 'KEYWORD' && token.value === value
  }

  private checkIdentifier(value: string): boolean {
    const token = this.current()
    return token.type === 'IDENTIFIER' && token.value === value
  }

  private checkDedent(): boolean {
    return this.current().type === 'DEDENT'
  }

  private expect(type: TokenType): Token {
    const token = this.current()
    if (token.type !== type) {
      throw this.error(`Expected ${type}, got ${token.type} ('${token.value}')`)
    }
    return this.advance()
  }

  private expectKeyword(value: string): void {
    const token = this.current()
    if (token.type !== 'KEYWORD' || token.value !== value) {
      throw this.error(`Expected keyword '${value}', got '${token.value}'`)
    }
    this.advance()
  }

  private expectIdentifier(): string {
    const token = this.current()
    if (token.type !== 'IDENTIFIER' && token.type !== 'KEYWORD') {
      throw this.error(`Expected identifier, got ${token.type} ('${token.value}')`)
    }
    this.advance()
    return token.value
  }

  private expectNewline(): void {
    if (!this.check('NEWLINE')) {
      throw this.error(`Expected newline, got ${this.current().type}`)
    }
    this.advance()
    this.skipNewlines()
  }

  private expectNewlineOrDedent(): void {
    if (this.check('NEWLINE')) {
      this.advance()
      this.skipNewlines()
    }
    // Dedent is okay too, will be consumed later
  }

  private expectIndent(): void {
    if (!this.check('INDENT')) {
      throw this.error(`Expected indent, got ${this.current().type}`)
    }
    this.advance()
  }

  private consumeDedent(): void {
    if (this.check('DEDENT')) {
      this.advance()
    }
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance()
    }
  }

  private expectString(expr: AST.Expression): string {
    if (expr.kind !== 'string') {
      throw this.error('Expected string')
    }
    return expr.value
  }

  private expectVec3(expr: AST.Expression): AST.Vec3 {
    if (expr.kind !== 'vec3') {
      throw this.error('Expected vec3')
    }
    return expr
  }

  private error(message: string): ParseError {
    const token = this.current()
    return new ParseError(message, token.line, token.column)
  }
}

/**
 * Convenience function to parse Forge source code.
 */
export function parse(source: string): AST.ForgeModule {
  const parser = new ForgeParser(source)
  return parser.parse()
}
