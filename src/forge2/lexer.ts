/**
 * Forge 2.0 Lexer
 *
 * Minimal tokenizer for indent-based syntax with ~12 core keywords.
 * Handles significant whitespace (Python-style indentation).
 */

import type { Token, TokenType, SourceLocation, SourceSpan } from './types'

// ============================================================================
// Keywords
// ============================================================================

const KEYWORDS: Record<string, TokenType> = {
  // Variable/mutation
  let: 'LET',
  set: 'SET',

  // Functions
  fn: 'FN',

  // Control flow
  if: 'IF',
  elif: 'ELIF',
  else: 'ELSE',
  for: 'FOR',
  while: 'WHILE',
  match: 'MATCH',
  return: 'RETURN',

  // Events
  on: 'ON',
  emit: 'EMIT',

  // Modules
  import: 'IMPORT',
  from: 'FROM',

  // Schemas
  schema: 'SCHEMA',
  extends: 'EXTENDS',

  // Operators
  in: 'IN',
  when: 'WHEN',
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  then: 'THEN',

  // Literals
  true: 'BOOLEAN',
  false: 'BOOLEAN',
  null: 'NULL',
}

// ============================================================================
// Lexer Class
// ============================================================================

export class Lexer {
  private source: string
  private filename: string
  private pos: number = 0
  private line: number = 1
  private column: number = 1

  private tokens: Token[] = []
  private indentStack: number[] = [0]
  private atLineStart: boolean = true
  private pendingTokens: Token[] = []

  constructor(source: string, filename: string = '<input>') {
    this.source = source
    this.filename = filename
  }

  /**
   * Tokenize the entire source.
   */
  tokenize(): Token[] {
    while (!this.isAtEnd()) {
      this.scanToken()
    }

    // Emit remaining DEDENTs at EOF
    while (this.indentStack.length > 1) {
      this.indentStack.pop()
      this.tokens.push(this.makeToken('DEDENT', ''))
    }

    this.tokens.push(this.makeToken('EOF', ''))
    return this.tokens
  }

  // ==========================================================================
  // Scanning
  // ==========================================================================

  private scanToken(): void {
    // Handle line start indentation
    if (this.atLineStart) {
      this.handleIndentation()
      this.atLineStart = false
    }

    // Skip whitespace (but not newlines)
    this.skipWhitespace()

    if (this.isAtEnd()) return

    const char = this.peek()

    // Color literals (check before comments since both start with #)
    if (char === '#' && this.isHexDigit(this.peekNext())) {
      this.scanColor()
      return
    }

    // Comments
    if (char === '#') {
      this.skipComment()
      return
    }

    // Newlines
    if (char === '\n') {
      this.advance()
      // Only emit NEWLINE if last token wasn't already NEWLINE/INDENT/DEDENT
      const last = this.tokens[this.tokens.length - 1]
      if (last && !['NEWLINE', 'INDENT', 'DEDENT'].includes(last.type)) {
        this.tokens.push(this.makeToken('NEWLINE', '\n'))
      }
      this.line++
      this.column = 1
      this.atLineStart = true
      return
    }

    // Numbers
    if (this.isDigit(char) || (char === '-' && this.isDigit(this.peekNext()))) {
      this.scanNumber()
      return
    }

    // Strings
    if (char === '"' || char === "'") {
      this.scanString(char)
      return
    }

    // Identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      this.scanIdentifier()
      return
    }

    // Operators and punctuation
    this.scanOperator()
  }

  private handleIndentation(): void {
    let indent = 0

    // Count leading spaces/tabs
    while (!this.isAtEnd()) {
      const char = this.peek()
      if (char === ' ') {
        indent++
        this.advance()
      } else if (char === '\t') {
        indent += 2  // Treat tabs as 2 spaces
        this.advance()
      } else {
        break
      }
    }

    // Skip blank lines and comments
    if (this.isAtEnd() || this.peek() === '\n' || this.peek() === '#') {
      return
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1]!

    if (indent > currentIndent) {
      this.indentStack.push(indent)
      this.tokens.push(this.makeToken('INDENT', ''))
    } else if (indent < currentIndent) {
      while (
        this.indentStack.length > 1 &&
        this.indentStack[this.indentStack.length - 1]! > indent
      ) {
        this.indentStack.pop()
        this.tokens.push(this.makeToken('DEDENT', ''))
      }
    }
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek()
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance()
      } else {
        break
      }
    }
  }

  private skipComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance()
    }
  }

  // ==========================================================================
  // Token Scanners
  // ==========================================================================

  private scanNumber(): void {
    const start = this.pos
    const startLoc = this.location()

    if (this.peek() === '-') {
      this.advance()
    }

    while (this.isDigit(this.peek())) {
      this.advance()
    }

    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance()  // consume '.'
      while (this.isDigit(this.peek())) {
        this.advance()
      }
    }

    const value = this.source.slice(start, this.pos)
    this.tokens.push(this.makeTokenSpan('NUMBER', value, startLoc))
  }

  private scanString(quote: string): void {
    const start = this.pos
    const startLoc = this.location()

    this.advance()  // opening quote

    let value = ''
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance()
        const escaped = this.advance()
        switch (escaped) {
          case 'n': value += '\n'; break
          case 't': value += '\t'; break
          case 'r': value += '\r'; break
          case '\\': value += '\\'; break
          case '"': value += '"'; break
          case "'": value += "'"; break
          default: value += escaped
        }
      } else if (this.peek() === '\n') {
        throw this.error('Unterminated string')
      } else {
        value += this.advance()
      }
    }

    if (this.isAtEnd()) {
      throw this.error('Unterminated string')
    }

    this.advance()  // closing quote
    this.tokens.push(this.makeTokenSpan('STRING', value, startLoc))
  }

  private scanIdentifier(): void {
    const start = this.pos
    const startLoc = this.location()

    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
      this.advance()
    }

    const value = this.source.slice(start, this.pos)
    const type = KEYWORDS[value] || 'IDENTIFIER'

    this.tokens.push(this.makeTokenSpan(type, value, startLoc))
  }

  private scanColor(): void {
    const start = this.pos
    const startLoc = this.location()

    this.advance()  // #

    while (this.isHexDigit(this.peek())) {
      this.advance()
    }

    const value = this.source.slice(start + 1, this.pos)  // without #
    this.tokens.push(this.makeTokenSpan('STRING', value, startLoc))  // Store as string with # prefix context
    // Actually, let's use a special approach - store the full value
    this.tokens.pop()
    this.tokens.push({
      type: 'STRING',
      value: '#' + value,
      span: { start: startLoc, end: this.location(), file: this.filename }
    })
  }

  private scanOperator(): void {
    const startLoc = this.location()
    const char = this.advance()

    // Two-character operators
    const next = this.peek()
    const twoChar = char + next

    const twoCharOps: Record<string, TokenType> = {
      '->': 'ARROW',
      '<=': 'LTE',
      '>=': 'GTE',
      '==': 'EQ',
      '!=': 'NEQ',
    }

    if (twoCharOps[twoChar]) {
      this.advance()
      this.tokens.push(this.makeTokenSpan(twoCharOps[twoChar]!, twoChar, startLoc))
      return
    }

    // Single-character operators
    const singleCharOps: Record<string, TokenType> = {
      '(': 'LPAREN',
      ')': 'RPAREN',
      '[': 'LBRACKET',
      ']': 'RBRACKET',
      '{': 'LBRACE',
      '}': 'RBRACE',
      ':': 'COLON',
      ',': 'COMMA',
      '.': 'DOT',
      '=': 'EQUALS',
      '+': 'PLUS',
      '-': 'MINUS',
      '*': 'STAR',
      '/': 'SLASH',
      '%': 'PERCENT',
      '<': 'LT',
      '>': 'GT',
      '@': 'AT',
      '#': 'HASH',
      '$': 'DOLLAR',
    }

    const type = singleCharOps[char]
    if (type) {
      this.tokens.push(this.makeTokenSpan(type, char, startLoc))
    } else {
      throw this.error(`Unexpected character: ${char}`)
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private isAtEnd(): boolean {
    return this.pos >= this.source.length
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0'
    return this.source[this.pos]!
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.source.length) return '\0'
    return this.source[this.pos + 1]!
  }

  private advance(): string {
    const char = this.source[this.pos]!
    this.pos++
    this.column++
    return char
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9'
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_'
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char)
  }

  private isHexDigit(char: string): boolean {
    return this.isDigit(char) ||
           (char >= 'a' && char <= 'f') ||
           (char >= 'A' && char <= 'F')
  }

  private location(): SourceLocation {
    return {
      line: this.line,
      column: this.column,
      offset: this.pos,
    }
  }

  private makeToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      span: {
        start: this.location(),
        end: this.location(),
        file: this.filename,
      },
    }
  }

  private makeTokenSpan(type: TokenType, value: string, start: SourceLocation): Token {
    return {
      type,
      value,
      span: {
        start,
        end: this.location(),
        file: this.filename,
      },
    }
  }

  private error(message: string): Error {
    return new Error(`${this.filename}:${this.line}:${this.column}: ${message}`)
  }
}

/**
 * Convenience function to tokenize source.
 */
export function tokenize(source: string, filename?: string): Token[] {
  const lexer = new Lexer(source, filename)
  return lexer.tokenize()
}
