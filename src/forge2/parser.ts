/**
 * Forge 2.0 Parser
 *
 * Recursive descent parser for indent-based syntax.
 * Handles all core constructs: expressions, statements, schemas.
 */

import type {
  Token,
  TokenType,
  Expression,
  Statement,
  Program,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  NullLiteral,
  Identifier,
  VectorLiteral,
  ListLiteral,
  MapLiteral,
  MapEntry,
  MemberExpression,
  CallExpression,
  BinaryExpression,
  UnaryExpression,
  ConditionalExpression,
  ArrowFunction,
  ReactiveRef,
  LetStatement,
  SetStatement,
  FunctionDeclaration,
  IfStatement,
  ForStatement,
  WhileStatement,
  MatchStatement,
  MatchCase,
  Pattern,
  ReturnStatement,
  OnStatement,
  EmitStatement,
  ImportStatement,
  ImportSpecifier,
  ExpressionStatement,
  BlockStatement,
  SchemaDeclaration,
  SchemaField,
  TypeAnnotation,
  InstanceDeclaration,
  Parameter,
  ColorLiteral,
} from './types'

// ============================================================================
// Parser Class
// ============================================================================

export class Parser {
  private tokens: Token[]
  private pos: number = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  /**
   * Parse the entire program.
   */
  parse(): Program {
    const imports: ImportStatement[] = []
    const body: Statement[] = []

    while (!this.isAtEnd()) {
      this.skipNewlines()
      if (this.isAtEnd()) break

      const stmt = this.parseStatement()
      if (stmt.type === 'ImportStatement') {
        imports.push(stmt as ImportStatement)
      } else {
        body.push(stmt)
      }
    }

    return {
      type: 'Program',
      imports,
      body,
    }
  }

  // ==========================================================================
  // Statements
  // ==========================================================================

  private parseStatement(): Statement {
    // Skip leading newlines
    this.skipNewlines()

    if (this.check('LET')) return this.parseLetStatement()
    if (this.check('SET')) return this.parseSetStatement()
    if (this.check('FN')) return this.parseFunctionDeclaration()
    if (this.check('IF')) return this.parseIfStatement()
    if (this.check('FOR')) return this.parseForStatement()
    if (this.check('WHILE')) return this.parseWhileStatement()
    if (this.check('MATCH')) return this.parseMatchStatement()
    if (this.check('RETURN')) return this.parseReturnStatement()
    if (this.check('ON')) return this.parseOnStatement()
    if (this.check('EMIT')) return this.parseEmitStatement()
    if (this.check('IMPORT')) return this.parseImportStatement()
    if (this.check('FROM')) return this.parseFromImportStatement()
    if (this.check('SCHEMA')) return this.parseSchemaDeclaration()

    // Check for instance declaration: schema_name instance_name:
    if (this.check('IDENTIFIER') && this.checkAhead(1, 'IDENTIFIER') && this.checkAhead(2, 'COLON')) {
      return this.parseInstanceDeclaration()
    }

    // Expression statement
    const expr = this.parseExpression()
    this.expectNewlineOrEnd()
    return { type: 'ExpressionStatement', expression: expr }
  }

  private parseLetStatement(): LetStatement {
    this.consume('LET', 'Expected "let"')
    const name = this.consume('IDENTIFIER', 'Expected variable name').value
    this.consume('EQUALS', 'Expected "=" after variable name')
    const value = this.parseExpression()
    this.expectNewlineOrEnd()
    return { type: 'LetStatement', name, value }
  }

  private parseSetStatement(): SetStatement {
    this.consume('SET', 'Expected "set"')
    const target = this.parseExpression()
    this.consume('COLON', 'Expected ":" after set target')
    const value = this.parseExpression()
    this.expectNewlineOrEnd()
    return { type: 'SetStatement', target, value }
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    this.consume('FN', 'Expected "fn"')
    const name = this.consume('IDENTIFIER', 'Expected function name').value
    const params = this.parseParameterList()
    this.consume('COLON', 'Expected ":" after function parameters')
    const body = this.parseBlock()
    return { type: 'FunctionDeclaration', name, params, body }
  }

  private parseIfStatement(): IfStatement {
    // Consume either IF or ELIF
    if (this.check('IF')) {
      this.advance()
    } else if (this.check('ELIF')) {
      this.advance()
    } else {
      throw this.error('Expected "if" or "elif"')
    }

    const test = this.parseExpression()
    this.consume('COLON', 'Expected ":" after condition')
    const consequent = this.parseBlock()

    let alternate: BlockStatement | IfStatement | undefined

    this.skipNewlines()
    if (this.check('ELIF')) {
      alternate = this.parseIfStatement()  // Recursively handle elif
    } else if (this.check('ELSE')) {
      this.advance()
      this.consume('COLON', 'Expected ":" after else')
      alternate = this.parseBlock()
    }

    return { type: 'IfStatement', test, consequent, alternate }
  }

  private parseForStatement(): ForStatement {
    this.consume('FOR', 'Expected "for"')
    const variable = this.consume('IDENTIFIER', 'Expected variable name').value
    this.consume('IN', 'Expected "in" after variable')
    const iterable = this.parseExpression()
    this.consume('COLON', 'Expected ":" after iterable')
    const body = this.parseBlock()
    return { type: 'ForStatement', variable, iterable, body }
  }

  private parseWhileStatement(): WhileStatement {
    this.consume('WHILE', 'Expected "while"')
    const test = this.parseExpression()
    this.consume('COLON', 'Expected ":" after while condition')
    const body = this.parseBlock()
    return { type: 'WhileStatement', test, body }
  }

  private parseMatchStatement(): MatchStatement {
    this.consume('MATCH', 'Expected "match"')
    const discriminant = this.parseExpression()
    this.consume('COLON', 'Expected ":" after match expression')
    this.expectNewlineOrEnd()
    this.consume('INDENT', 'Expected indented block')

    const cases: MatchCase[] = []
    while (!this.check('DEDENT') && !this.isAtEnd()) {
      this.skipNewlines()
      cases.push(this.parseMatchCase())
    }

    if (this.check('DEDENT')) this.advance()
    return { type: 'MatchStatement', discriminant, cases }
  }

  private parseMatchCase(): MatchCase {
    const pattern = this.parsePattern()
    let guard: Expression | undefined

    if (this.check('WHEN')) {
      this.advance()
      guard = this.parseExpression()
    }

    this.consume('COLON', 'Expected ":" after pattern')
    const body = this.parseBlock()
    return { pattern, guard, body }
  }

  private parsePattern(): Pattern {
    if (this.check('IDENTIFIER') && this.peek().value === '_') {
      this.advance()
      return { type: 'WildcardPattern' }
    }

    if (this.check('IDENTIFIER')) {
      const name = this.advance().value
      return { type: 'IdentifierPattern', name }
    }

    if (this.check('LBRACKET')) {
      this.advance()
      const elements: Pattern[] = []
      while (!this.check('RBRACKET')) {
        elements.push(this.parsePattern())
        if (!this.check('RBRACKET')) {
          this.consume('COMMA', 'Expected "," between patterns')
        }
      }
      this.consume('RBRACKET', 'Expected "]"')
      return { type: 'ListPattern', elements }
    }

    // Literal pattern
    const value = this.parsePrimary()
    return { type: 'LiteralPattern', value }
  }

  private parseReturnStatement(): ReturnStatement {
    this.consume('RETURN', 'Expected "return"')
    let argument: Expression | undefined

    if (!this.check('NEWLINE') && !this.check('DEDENT') && !this.isAtEnd()) {
      argument = this.parseExpression()
    }

    this.expectNewlineOrEnd()
    return { type: 'ReturnStatement', argument }
  }

  private parseOnStatement(): OnStatement {
    this.consume('ON', 'Expected "on"')
    const event = this.parseExpression()
    let condition: Expression | undefined

    if (this.check('WHEN')) {
      this.advance()
      condition = this.parseExpression()
    }

    this.consume('COLON', 'Expected ":" after event')
    const body = this.parseBlock()
    return { type: 'OnStatement', event, condition, body }
  }

  private parseEmitStatement(): EmitStatement {
    this.consume('EMIT', 'Expected "emit"')
    const event = this.parseExpression()
    let data: Expression | undefined

    if (this.check('LBRACE')) {
      data = this.parseMapLiteral()
    }

    this.expectNewlineOrEnd()
    return { type: 'EmitStatement', event, data }
  }

  private parseImportStatement(): ImportStatement {
    this.consume('IMPORT', 'Expected "import"')
    const source = this.consume('STRING', 'Expected module path').value

    let namespace: string | undefined
    if (this.check('IDENTIFIER') && this.peek().value === 'as') {
      this.advance()
      namespace = this.consume('IDENTIFIER', 'Expected namespace name').value
    }

    this.expectNewlineOrEnd()
    return { type: 'ImportStatement', source, namespace }
  }

  private parseFromImportStatement(): ImportStatement {
    this.consume('FROM', 'Expected "from"')
    const source = this.consume('STRING', 'Expected module path').value
    this.consume('IMPORT', 'Expected "import"')

    const specifiers: ImportSpecifier[] = []

    if (this.check('LBRACE')) {
      this.advance()
      while (!this.check('RBRACE')) {
        const imported = this.consume('IDENTIFIER', 'Expected import name').value
        let local = imported

        if (this.check('IDENTIFIER') && this.peek().value === 'as') {
          this.advance()
          local = this.consume('IDENTIFIER', 'Expected local name').value
        }

        specifiers.push({ imported, local })

        if (!this.check('RBRACE')) {
          this.consume('COMMA', 'Expected "," between imports')
        }
      }
      this.consume('RBRACE', 'Expected "}"')
    } else {
      // Single import
      const imported = this.consume('IDENTIFIER', 'Expected import name').value
      specifiers.push({ imported, local: imported })
    }

    this.expectNewlineOrEnd()
    return { type: 'ImportStatement', source, specifiers }
  }

  private parseSchemaDeclaration(): SchemaDeclaration {
    this.consume('SCHEMA', 'Expected "schema"')
    const name = this.consume('IDENTIFIER', 'Expected schema name').value

    let extendsSchema: string | undefined
    if (this.check('EXTENDS')) {
      this.advance()
      extendsSchema = this.consume('IDENTIFIER', 'Expected parent schema name').value
    }

    this.consume('COLON', 'Expected ":" after schema name')
    this.expectNewlineOrEnd()
    this.consume('INDENT', 'Expected indented block')

    const fields: SchemaField[] = []
    const methods: FunctionDeclaration[] = []

    while (!this.check('DEDENT') && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.check('DEDENT')) break

      // Check for required/optional sections
      if (this.check('IDENTIFIER')) {
        const name = this.peek().value
        if (name === 'required' || name === 'optional') {
          this.advance()
          this.consume('COLON', `Expected ":" after ${name}`)
          this.expectNewlineOrEnd()
          this.consume('INDENT', 'Expected indented block')

          while (!this.check('DEDENT') && !this.isAtEnd()) {
            this.skipNewlines()
            if (this.check('DEDENT')) break
            fields.push(this.parseSchemaField(name === 'required'))
          }

          if (this.check('DEDENT')) this.advance()
          continue
        }
      }

      // Method or field definition
      if (this.check('FN')) {
        // Method using 'fn' keyword
        methods.push(this.parseFunctionDeclaration())
      } else if (this.check('IDENTIFIER') && this.checkAhead(1, 'COLON')) {
        // Could be field or method
        const fieldName = this.advance().value
        this.consume('COLON', 'Expected ":"')

        if (this.check('FN')) {
          // Method defined as: name: fn(...):
          this.advance()
          const params = this.parseParameterList()
          this.consume('COLON', 'Expected ":" after parameters')
          const body = this.parseBlock()
          methods.push({ type: 'FunctionDeclaration', name: fieldName, params, body })
        } else {
          // Field with type annotation
          const typeAnnotation = this.parseTypeAnnotation()
          let defaultValue: Expression | undefined

          if (this.check('EQUALS')) {
            this.advance()
            defaultValue = this.parseExpression()
          }

          this.expectNewlineOrEnd()
          fields.push({
            name: fieldName,
            type: typeAnnotation,
            required: false,  // Top-level fields default to optional
            defaultValue,
          })
        }
      } else {
        // Skip unknown content
        this.advance()
      }
    }

    if (this.check('DEDENT')) this.advance()
    return { type: 'SchemaDeclaration', name, extends: extendsSchema, fields, methods }
  }

  private parseSchemaField(required: boolean): SchemaField {
    const name = this.consume('IDENTIFIER', 'Expected field name').value
    this.consume('COLON', 'Expected ":" after field name')
    const typeAnnotation = this.parseTypeAnnotation()

    let defaultValue: Expression | undefined
    if (this.check('EQUALS')) {
      this.advance()
      defaultValue = this.parseExpression()
    }

    this.expectNewlineOrEnd()
    return { name, type: typeAnnotation, required, defaultValue }
  }

  private parseTypeAnnotation(): TypeAnnotation {
    const name = this.consume('IDENTIFIER', 'Expected type name').value

    // Parameterized types: list<T>, map<K, V>
    if (this.check('LT')) {
      this.advance()

      if (name === 'list') {
        const element = this.parseTypeAnnotation()
        this.consume('GT', 'Expected ">"')
        return { kind: 'list', element }
      }

      if (name === 'map') {
        const key = this.parseTypeAnnotation()
        this.consume('COMMA', 'Expected ","')
        const value = this.parseTypeAnnotation()
        this.consume('GT', 'Expected ">"')
        return { kind: 'map', key, value }
      }
    }

    // enum("a", "b", "c")
    if (name === 'enum' && this.check('LPAREN')) {
      this.advance()
      const values: string[] = []
      while (!this.check('RPAREN')) {
        values.push(this.consume('STRING', 'Expected enum value').value)
        if (!this.check('RPAREN')) {
          this.consume('COMMA', 'Expected ","')
        }
      }
      this.consume('RPAREN', 'Expected ")"')
      return { kind: 'enum', values }
    }

    // vec3, vec2
    if (name.startsWith('vec')) {
      const size = parseInt(name.slice(3)) || undefined
      return { kind: 'vec', size }
    }

    return { kind: 'simple', name }
  }

  private parseInstanceDeclaration(): InstanceDeclaration {
    const schema = this.consume('IDENTIFIER', 'Expected schema name').value
    const name = this.consume('IDENTIFIER', 'Expected instance name').value
    this.consume('COLON', 'Expected ":"')
    this.expectNewlineOrEnd()
    this.consume('INDENT', 'Expected indented block')

    const fields: MapEntry[] = []

    while (!this.check('DEDENT') && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.check('DEDENT')) break

      const key: Identifier = {
        type: 'Identifier',
        name: this.consume('IDENTIFIER', 'Expected field name').value,
      }
      this.consume('COLON', 'Expected ":"')
      const value = this.parseExpression()
      this.expectNewlineOrEnd()

      fields.push({ key, value })
    }

    if (this.check('DEDENT')) this.advance()
    return { type: 'InstanceDeclaration', schema, name, fields }
  }

  // ==========================================================================
  // Blocks
  // ==========================================================================

  private parseBlock(): BlockStatement {
    this.expectNewlineOrEnd()
    this.consume('INDENT', 'Expected indented block')

    const body: Statement[] = []
    while (!this.check('DEDENT') && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.check('DEDENT')) break
      body.push(this.parseStatement())
    }

    if (this.check('DEDENT')) this.advance()
    return { type: 'BlockStatement', body }
  }

  private parseParameterList(): Parameter[] {
    this.consume('LPAREN', 'Expected "("')
    const params: Parameter[] = []

    while (!this.check('RPAREN')) {
      const name = this.consume('IDENTIFIER', 'Expected parameter name').value
      let defaultValue: Expression | undefined

      if (this.check('EQUALS')) {
        this.advance()
        defaultValue = this.parseExpression()
      }

      params.push({ name, defaultValue })

      if (!this.check('RPAREN')) {
        this.consume('COMMA', 'Expected ","')
      }
    }

    this.consume('RPAREN', 'Expected ")"')
    return params
  }

  // ==========================================================================
  // Expressions
  // ==========================================================================

  private parseExpression(): Expression {
    return this.parseTernary()
  }

  private parseTernary(): Expression {
    // if cond then a else b (expression form)
    if (this.check('IF')) {
      this.advance()
      const test = this.parseOr()
      this.consume('THEN', 'Expected "then"')
      const consequent = this.parseOr()
      this.consume('ELSE', 'Expected "else"')
      const alternate = this.parseTernary()
      return {
        type: 'ConditionalExpression',
        test,
        consequent,
        alternate,
      }
    }

    return this.parseOr()
  }

  private parseOr(): Expression {
    let left = this.parseAnd()

    while (this.check('OR')) {
      this.advance()
      const right = this.parseAnd()
      left = { type: 'BinaryExpression', operator: 'or', left, right }
    }

    return left
  }

  private parseAnd(): Expression {
    let left = this.parseEquality()

    while (this.check('AND')) {
      this.advance()
      const right = this.parseEquality()
      left = { type: 'BinaryExpression', operator: 'and', left, right }
    }

    return left
  }

  private parseEquality(): Expression {
    let left = this.parseComparison()

    while (this.check('EQ') || this.check('NEQ')) {
      const operator = this.advance().value
      const right = this.parseComparison()
      left = { type: 'BinaryExpression', operator, left, right }
    }

    return left
  }

  private parseComparison(): Expression {
    let left = this.parseAdditive()

    while (this.check('LT') || this.check('GT') || this.check('LTE') || this.check('GTE')) {
      const operator = this.advance().value
      const right = this.parseAdditive()
      left = { type: 'BinaryExpression', operator, left, right }
    }

    return left
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative()

    while (this.check('PLUS') || this.check('MINUS')) {
      const operator = this.advance().value
      const right = this.parseMultiplicative()
      left = { type: 'BinaryExpression', operator, left, right }
    }

    return left
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary()

    while (this.check('STAR') || this.check('SLASH') || this.check('PERCENT')) {
      const operator = this.advance().value
      const right = this.parseUnary()
      left = { type: 'BinaryExpression', operator, left, right }
    }

    return left
  }

  private parseUnary(): Expression {
    if (this.check('NOT')) {
      this.advance()
      const argument = this.parseUnary()
      return { type: 'UnaryExpression', operator: 'not', argument, prefix: true }
    }

    if (this.check('MINUS')) {
      this.advance()
      const argument = this.parseUnary()
      return { type: 'UnaryExpression', operator: '-', argument, prefix: true }
    }

    return this.parsePostfix()
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary()

    while (true) {
      if (this.check('DOT')) {
        this.advance()
        // Allow keywords as property names (e.g., voxel.set, object.type)
        const property: Identifier = {
          type: 'Identifier',
          name: this.consumePropertyName(),
        }
        expr = { type: 'MemberExpression', object: expr, property, computed: false }
      } else if (this.check('LBRACKET')) {
        this.advance()
        const property = this.parseExpression()
        this.consume('RBRACKET', 'Expected "]"')
        expr = { type: 'MemberExpression', object: expr, property, computed: true }
      } else if (this.check('LPAREN')) {
        expr = this.parseCallExpression(expr)
      } else {
        break
      }
    }

    return expr
  }

  private parseCallExpression(callee: Expression): CallExpression {
    this.consume('LPAREN', 'Expected "("')
    const args: Expression[] = []

    while (!this.check('RPAREN')) {
      args.push(this.parseExpression())
      if (!this.check('RPAREN')) {
        this.consume('COMMA', 'Expected ","')
      }
    }

    this.consume('RPAREN', 'Expected ")"')
    return { type: 'CallExpression', callee, arguments: args }
  }

  private parsePrimary(): Expression {
    // Reactive reference: $var or $var.path
    if (this.check('DOLLAR')) {
      return this.parseReactiveRef()
    }

    // Lambda: fn(params) -> expr or fn(params): block
    if (this.check('FN')) {
      return this.parseLambda()
    }

    // Number
    if (this.check('NUMBER')) {
      const value = parseFloat(this.advance().value)
      return { type: 'NumberLiteral', value }
    }

    // String
    if (this.check('STRING')) {
      const token = this.advance()
      // Check if it's a color literal (starts with #)
      if (token.value.startsWith('#')) {
        return { type: 'ColorLiteral', value: token.value.slice(1) }
      }
      return { type: 'StringLiteral', value: token.value }
    }

    // Boolean
    if (this.check('BOOLEAN')) {
      const value = this.advance().value === 'true'
      return { type: 'BooleanLiteral', value }
    }

    // Null
    if (this.check('NULL')) {
      this.advance()
      return { type: 'NullLiteral' }
    }

    // Identifier
    if (this.check('IDENTIFIER')) {
      const name = this.advance().value
      return { type: 'Identifier', name }
    }

    // Parentheses (grouping) or Vector
    if (this.check('LPAREN')) {
      return this.parseParenOrVector()
    }

    // List literal
    if (this.check('LBRACKET')) {
      return this.parseListLiteral()
    }

    // Map literal
    if (this.check('LBRACE')) {
      return this.parseMapLiteral()
    }

    throw this.error(`Unexpected token: ${this.peek().type}`)
  }

  private parseReactiveRef(): ReactiveRef {
    this.consume('DOLLAR', 'Expected "$"')
    const path: string[] = []

    path.push(this.consume('IDENTIFIER', 'Expected identifier after $').value)

    while (this.check('DOT')) {
      this.advance()
      path.push(this.consume('IDENTIFIER', 'Expected property name').value)
    }

    return { type: 'ReactiveRef', path }
  }

  private parseLambda(): ArrowFunction {
    this.consume('FN', 'Expected "fn"')
    const params = this.parseParameterList()

    if (this.check('ARROW')) {
      // fn(x) -> expr
      this.advance()
      const body = this.parseExpression()
      return { type: 'ArrowFunction', params, body }
    } else if (this.check('COLON')) {
      // fn(x): block
      this.advance()
      const body = this.parseBlock()
      return { type: 'ArrowFunction', params, body }
    }

    throw this.error('Expected "->" or ":" after lambda parameters')
  }

  private parseParenOrVector(): Expression {
    this.consume('LPAREN', 'Expected "("')

    if (this.check('RPAREN')) {
      this.advance()
      return { type: 'VectorLiteral', elements: [] }
    }

    const first = this.parseExpression()

    if (this.check('COMMA')) {
      // Vector: (x, y, z)
      const elements: Expression[] = [first]
      while (this.check('COMMA')) {
        this.advance()
        elements.push(this.parseExpression())
      }
      this.consume('RPAREN', 'Expected ")"')
      return { type: 'VectorLiteral', elements }
    }

    // Grouping: (expr)
    this.consume('RPAREN', 'Expected ")"')
    return first
  }

  private parseListLiteral(): ListLiteral {
    this.consume('LBRACKET', 'Expected "["')
    const elements: Expression[] = []

    while (!this.check('RBRACKET')) {
      elements.push(this.parseExpression())
      if (!this.check('RBRACKET')) {
        this.consume('COMMA', 'Expected ","')
      }
    }

    this.consume('RBRACKET', 'Expected "]"')
    return { type: 'ListLiteral', elements }
  }

  private parseMapLiteral(): MapLiteral {
    this.consume('LBRACE', 'Expected "{"')
    const entries: MapEntry[] = []

    // Skip newlines and indentation after opening brace (for multiline maps)
    this.skipWhitespaceInExpression()

    while (!this.check('RBRACE')) {
      let key: Expression

      if (this.check('IDENTIFIER')) {
        // Shorthand: { foo } means { foo: foo }
        const name = this.advance().value
        key = { type: 'Identifier', name }

        if (this.check('COLON')) {
          this.advance()
          const value = this.parseExpression()
          entries.push({ key, value })
        } else {
          // Shorthand
          entries.push({ key, value: { type: 'Identifier', name } as Identifier })
        }
      } else if (this.check('STRING')) {
        key = { type: 'StringLiteral', value: this.advance().value }
        this.consume('COLON', 'Expected ":"')
        const value = this.parseExpression()
        entries.push({ key, value })
      } else if (this.check('LBRACKET')) {
        // Computed key: { [expr]: value }
        this.advance()
        key = this.parseExpression()
        this.consume('RBRACKET', 'Expected "]"')
        this.consume('COLON', 'Expected ":"')
        const value = this.parseExpression()
        entries.push({ key, value })
      } else {
        throw this.error('Expected key in map literal')
      }

      // After each entry, allow comma or newline as separator
      this.skipWhitespaceInExpression()
      if (this.check('COMMA')) {
        this.advance()
        this.skipWhitespaceInExpression()
      }
      // If we're not at RBRACE after skipping whitespace, continue parsing entries
    }

    this.consume('RBRACE', 'Expected "}"')
    return { type: 'MapLiteral', entries }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.tokens[this.pos]?.type === 'EOF'
  }

  private peek(): Token {
    return this.tokens[this.pos]!
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return type === 'EOF'
    return this.peek().type === type
  }

  private checkAhead(offset: number, type: TokenType): boolean {
    const index = this.pos + offset
    if (index >= this.tokens.length) return false
    return this.tokens[index]!.type === type
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++
    return this.tokens[this.pos - 1]!
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    throw this.error(message)
  }

  /**
   * Consume a property name - allows both identifiers and keywords.
   * This enables patterns like `voxel.set()`, `object.type`, etc.
   */
  private consumePropertyName(): string {
    const token = this.peek()
    // Keywords that are valid as property names
    const keywordTypes = [
      'LET', 'SET', 'FN', 'IF', 'ELIF', 'ELSE', 'FOR', 'WHILE', 'MATCH',
      'RETURN', 'ON', 'EMIT', 'IMPORT', 'FROM', 'SCHEMA', 'TRUE', 'FALSE',
      'NULL', 'AND', 'OR', 'NOT', 'IN', 'WHEN', 'EXTENDS', 'REQUIRED',
      'OPTIONAL', 'DEF'
    ]

    if (token.type === 'IDENTIFIER') {
      this.advance()
      return token.value
    }

    if (keywordTypes.includes(token.type)) {
      this.advance()
      // Return the lowercase version of keywords as property names
      return token.value.toLowerCase()
    }

    throw this.error('Expected property name')
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance()
    }
  }

  /**
   * Skip whitespace tokens inside expressions (maps, lists, function calls).
   * This allows multiline expressions without breaking indentation-based blocks.
   */
  private skipWhitespaceInExpression(): void {
    while (this.check('NEWLINE') || this.check('INDENT') || this.check('DEDENT')) {
      this.advance()
    }
  }

  private expectNewlineOrEnd(): void {
    if (!this.check('NEWLINE') && !this.check('DEDENT') && !this.check('EOF')) {
      // Allow for inline expressions to continue
      if (!this.check('COMMA') && !this.check('RPAREN') && !this.check('RBRACKET') && !this.check('RBRACE')) {
        throw this.error('Expected newline or end of input')
      }
    }
    this.skipNewlines()
  }

  private error(message: string): Error {
    const token = this.peek()
    const loc = token.span?.start
    const locStr = loc ? `${loc.line}:${loc.column}` : 'unknown'
    return new Error(`Parse error at ${locStr}: ${message} (got ${token.type}: "${token.value}")`)
  }
}

/**
 * Convenience function to parse source.
 */
export function parse(tokens: Token[]): Program {
  const parser = new Parser(tokens)
  return parser.parse()
}
