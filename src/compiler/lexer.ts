// StarLang Lexer - Tokenizes source code

export type TokenType =
  | 'KEYWORD'      // room, door, terminal, sensor, signal
  | 'IDENTIFIER'   // names
  | 'STRING'       // "quoted strings"
  | 'NUMBER'       // 123, 45.67
  | 'BOOLEAN'      // true, false
  | 'LBRACE'       // {
  | 'RBRACE'       // }
  | 'LBRACKET'     // [
  | 'RBRACKET'     // ]
  | 'COLON'        // :
  | 'COMMA'        // ,
  | 'DOT'          // .
  | 'COMMENT'      // # comment
  | 'NEWLINE'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  line: number
  column: number
}

const KEYWORDS = new Set([
  'room', 'door', 'terminal', 'sensor', 'signal', 'switch',
  'true', 'false'
])

export class Lexer {
  private source: string
  private pos = 0
  private line = 1
  private column = 1
  private tokens: Token[] = []

  constructor(source: string) {
    this.source = source
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.scanToken()
    }
    this.tokens.push({ type: 'EOF', value: '', line: this.line, column: this.column })
    return this.tokens
  }

  private scanToken() {
    const char = this.source[this.pos]!

    // Skip whitespace (except newlines)
    if (char === ' ' || char === '\t' || char === '\r') {
      this.advance()
      return
    }

    // Newline
    if (char === '\n') {
      this.tokens.push({ type: 'NEWLINE', value: '\n', line: this.line, column: this.column })
      this.line++
      this.column = 1
      this.pos++
      return
    }

    // Comment
    if (char === '#') {
      const start = this.pos
      while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
        this.advance()
      }
      // Skip comments in token output
      return
    }

    // String
    if (char === '"') {
      this.scanString()
      return
    }

    // Number
    if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))) {
      this.scanNumber()
      return
    }

    // Identifier or keyword
    if (this.isAlpha(char)) {
      this.scanIdentifier()
      return
    }

    // Single character tokens
    const singleTokens: Record<string, TokenType> = {
      '{': 'LBRACE',
      '}': 'RBRACE',
      '[': 'LBRACKET',
      ']': 'RBRACKET',
      ':': 'COLON',
      ',': 'COMMA',
      '.': 'DOT',
    }

    if (char in singleTokens) {
      this.tokens.push({
        type: singleTokens[char]!,
        value: char,
        line: this.line,
        column: this.column
      })
      this.advance()
      return
    }

    // Unknown character
    throw new Error(`Unexpected character '${char}' at line ${this.line}, column ${this.column}`)
  }

  private scanString() {
    const startLine = this.line
    const startColumn = this.column
    this.advance() // Skip opening quote

    let value = ''
    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === '\n') {
        throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}`)
      }
      if (this.source[this.pos] === '\\' && this.pos + 1 < this.source.length) {
        this.advance()
        const escaped = this.source[this.pos]
        switch (escaped) {
          case 'n': value += '\n'; break
          case 't': value += '\t'; break
          case '"': value += '"'; break
          case '\\': value += '\\'; break
          default: value += escaped
        }
      } else {
        value += this.source[this.pos]
      }
      this.advance()
    }

    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}`)
    }

    this.advance() // Skip closing quote
    this.tokens.push({ type: 'STRING', value, line: startLine, column: startColumn })
  }

  private scanNumber() {
    const startColumn = this.column
    let value = ''

    if (this.source[this.pos] === '-') {
      value += '-'
      this.advance()
    }

    while (this.pos < this.source.length && this.isDigit(this.source[this.pos]!)) {
      value += this.source[this.pos]
      this.advance()
    }

    if (this.pos < this.source.length && this.source[this.pos] === '.') {
      value += '.'
      this.advance()
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos]!)) {
        value += this.source[this.pos]
        this.advance()
      }
    }

    this.tokens.push({ type: 'NUMBER', value, line: this.line, column: startColumn })
  }

  private scanIdentifier() {
    const startColumn = this.column
    let value = ''

    while (this.pos < this.source.length && this.isAlphaNumeric(this.source[this.pos]!)) {
      value += this.source[this.pos]
      this.advance()
    }

    if (value === 'true' || value === 'false') {
      this.tokens.push({ type: 'BOOLEAN', value, line: this.line, column: startColumn })
    } else if (KEYWORDS.has(value)) {
      this.tokens.push({ type: 'KEYWORD', value, line: this.line, column: startColumn })
    } else {
      this.tokens.push({ type: 'IDENTIFIER', value, line: this.line, column: startColumn })
    }
  }

  private advance() {
    this.pos++
    this.column++
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? ''
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
}
