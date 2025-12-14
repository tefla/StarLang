// StarLang Parser - Parses tokens into AST

import { Lexer } from './lexer'
import type { Token, TokenType } from './lexer'

export type ASTNodeType = 'ROOM' | 'DOOR' | 'TERMINAL' | 'SENSOR' | 'SIGNAL' | 'SWITCH' | 'PIPE' | 'VENT' | 'CONDUIT' | 'HULL_SECTION'

export interface ASTNode {
  type: ASTNodeType
  name: string
  properties: Record<string, ASTValue>
  line: number
}

export type ASTValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'identifier'; value: string }
  | { type: 'array'; value: ASTValue[] }
  | { type: 'object'; value: Record<string, ASTValue> }

export interface ParseResult {
  success: boolean
  nodes: ASTNode[]
  errors: ParseError[]
}

export interface ParseError {
  message: string
  line: number
  column: number
}

export class Parser {
  private tokens: Token[] = []
  private pos = 0
  private errors: ParseError[] = []

  parse(source: string): ParseResult {
    const lexer = new Lexer(source)
    this.tokens = lexer.tokenize()
    this.pos = 0
    this.errors = []

    const nodes: ASTNode[] = []

    while (!this.isAtEnd()) {
      this.skipNewlines()
      if (this.isAtEnd()) break

      try {
        const node = this.parseDefinition()
        if (node) nodes.push(node)
      } catch (error) {
        if (error instanceof Error) {
          this.errors.push({
            message: error.message,
            line: this.current().line,
            column: this.current().column
          })
        }
        // Recover by skipping to next definition
        this.synchronize()
      }
    }

    return {
      success: this.errors.length === 0,
      nodes,
      errors: this.errors
    }
  }

  private parseDefinition(): ASTNode | null {
    const keyword = this.current()
    if (keyword.type !== 'KEYWORD') {
      throw new Error(`Expected definition keyword, got ${keyword.type}`)
    }

    const type = keyword.value.toUpperCase() as ASTNodeType
    const validTypes = ['ROOM', 'DOOR', 'TERMINAL', 'SENSOR', 'SIGNAL', 'SWITCH', 'PIPE', 'VENT', 'CONDUIT', 'HULL_SECTION']
    if (!validTypes.includes(type)) {
      throw new Error(`Unknown definition type: ${keyword.value}`)
    }

    this.advance() // consume keyword

    const nameToken = this.expect('IDENTIFIER', 'Expected name after keyword')
    const name = nameToken.value

    this.expect('LBRACE', 'Expected { after name')
    this.skipNewlines()

    const properties = this.parseProperties()

    this.skipNewlines()
    this.expect('RBRACE', 'Expected } to close definition')

    return {
      type,
      name,
      properties,
      line: keyword.line
    }
  }

  private parseProperties(): Record<string, ASTValue> {
    const props: Record<string, ASTValue> = {}

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      this.skipNewlines()
      if (this.check('RBRACE')) break

      const keyToken = this.expect('IDENTIFIER', 'Expected property name')
      const key = keyToken.value

      this.expect('COLON', 'Expected : after property name')

      const value = this.parseValue()
      props[key] = value

      this.skipNewlines()

      // Optional comma
      if (this.check('COMMA')) {
        this.advance()
      }

      this.skipNewlines()
    }

    return props
  }

  private parseValue(): ASTValue {
    const token = this.current()

    switch (token.type) {
      case 'STRING':
        this.advance()
        return { type: 'string', value: token.value }

      case 'NUMBER':
        this.advance()
        return { type: 'number', value: parseFloat(token.value) }

      case 'BOOLEAN':
        this.advance()
        return { type: 'boolean', value: token.value === 'true' }

      case 'IDENTIFIER':
        this.advance()
        return { type: 'identifier', value: token.value }

      case 'LBRACKET':
        return this.parseArray()

      case 'LBRACE':
        return this.parseObject()

      default:
        throw new Error(`Unexpected token ${token.type} when parsing value`)
    }
  }

  private parseArray(): ASTValue {
    this.expect('LBRACKET', 'Expected [')
    const values: ASTValue[] = []

    this.skipNewlines()

    while (!this.check('RBRACKET') && !this.isAtEnd()) {
      values.push(this.parseValue())

      this.skipNewlines()
      if (this.check('COMMA')) {
        this.advance()
        this.skipNewlines()
      }
    }

    this.expect('RBRACKET', 'Expected ]')
    return { type: 'array', value: values }
  }

  private parseObject(): ASTValue {
    this.expect('LBRACE', 'Expected {')
    this.skipNewlines()

    const obj: Record<string, ASTValue> = {}

    while (!this.check('RBRACE') && !this.isAtEnd()) {
      const keyToken = this.expect('IDENTIFIER', 'Expected property name')
      this.expect('COLON', 'Expected :')
      obj[keyToken.value] = this.parseValue()

      this.skipNewlines()
      if (this.check('COMMA')) {
        this.advance()
        this.skipNewlines()
      }
    }

    this.expect('RBRACE', 'Expected }')
    return { type: 'object', value: obj }
  }

  private skipNewlines() {
    while (this.check('NEWLINE')) {
      this.advance()
    }
  }

  private synchronize() {
    this.advance()
    while (!this.isAtEnd()) {
      if (this.previous().type === 'RBRACE') return
      if (this.current().type === 'KEYWORD') return
      this.advance()
    }
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: 0, column: 0 }
  }

  private previous(): Token {
    return this.tokens[this.pos - 1] ?? { type: 'EOF', value: '', line: 0, column: 0 }
  }

  private check(type: TokenType): boolean {
    return this.current().type === type
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++
    return this.previous()
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    throw new Error(`${message} at line ${this.current().line}, got ${this.current().type}`)
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF'
  }
}
