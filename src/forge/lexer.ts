// Forge Lexer - Tokenizes Forge DSL source code
// Indent-based blocks with reactive expressions and timeline literals

export type TokenType =
  // Structure
  | 'KEYWORD'      // asset, entity, layout, machine, etc.
  | 'IDENTIFIER'   // names
  | 'STRING'       // "quoted strings"
  | 'NUMBER'       // 123, 45.67
  | 'BOOLEAN'      // true, false
  | 'COLOR'        // #rrggbb, #rgb
  | 'DURATION'     // 300ms, 2s
  // Brackets
  | 'LPAREN'       // (
  | 'RPAREN'       // )
  | 'LBRACKET'     // [
  | 'RBRACKET'     // ]
  | 'LBRACE'       // {
  | 'RBRACE'       // }
  // Operators
  | 'COLON'        // :
  | 'COMMA'        // ,
  | 'DOT'          // .
  | 'ARROW'        // ->
  | 'BIARROW'      // <->
  | 'AT'           // @
  | 'DOLLAR'       // $
  | 'PERCENT'      // %
  | 'EQUALS'       // =
  | 'LT'           // <
  | 'GT'           // >
  | 'PLUS'         // +
  | 'MINUS'        // -
  | 'STAR'         // *
  | 'SLASH'        // /
  | 'RANGE'        // ..
  // Indentation
  | 'INDENT'       // Increase in indentation
  | 'DEDENT'       // Decrease in indentation
  | 'NEWLINE'      // End of line
  | 'EOF'          // End of file

export interface Token {
  type: TokenType
  value: string
  line: number
  column: number
}

export class LexerError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(`${message} at line ${line}, column ${column}`)
    this.name = 'LexerError'
  }
}

// Keywords organized by category
const STRUCTURE_KEYWORDS = new Set([
  'asset', 'entity', 'layout', 'machine', 'config', 'rule', 'scenario', 'behavior',
  'params', 'geometry', 'parts', 'states', 'animations',
  'when', 'on', 'match', 'extends', 'base',
  'def', 'return', 'trigger', 'effect', 'initial'
])

const GEOMETRY_KEYWORDS = new Set([
  'voxel', 'voxels', 'box', 'repeat', 'child',
  'from', 'to', 'step', 'size', 'at', 'as'
])

const ANIMATION_KEYWORDS = new Set([
  'animate', 'spin', 'bob', 'pulse', 'fade',
  'using', 'loop', 'play', 'setState', 'emit', 'stopAnimation'
])

const LAYOUT_KEYWORDS = new Set([
  'rooms', 'doors', 'terminals', 'switches', 'assets', 'wallLights',
  'connects', 'facing', 'monitors', 'control', 'coordinate'
])

const CONTROL_KEYWORDS = new Set([
  'if', 'elif', 'else', 'and', 'or', 'not', 'in',
  'for', 'while', 'break', 'continue'
])

const TYPE_KEYWORDS = new Set([
  'enum', 'ref', 'list', 'float', 'int', 'bool', 'string'
])

const BOOLEAN_KEYWORDS = new Set(['true', 'false'])

// Combine all keywords
const ALL_KEYWORDS = new Set([
  ...STRUCTURE_KEYWORDS,
  ...GEOMETRY_KEYWORDS,
  ...ANIMATION_KEYWORDS,
  ...LAYOUT_KEYWORDS,
  ...CONTROL_KEYWORDS,
  ...TYPE_KEYWORDS
])

// Cardinal directions (treated as identifiers but have special meaning)
const DIRECTIONS = new Set(['north', 'east', 'south', 'west'])

// Easing functions
const EASING_FUNCTIONS = new Set([
  'linear', 'easeIn', 'easeOut', 'easeInOut',
  'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'step'
])

export class ForgeLexer {
  private source: string
  private pos = 0
  private line = 1
  private column = 1
  private tokens: Token[] = []

  // Indentation tracking
  private indentStack: number[] = [0]
  private atLineStart = true
  private pendingIndent = 0

  constructor(source: string) {
    this.source = source
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      if (this.atLineStart) {
        this.handleIndentation()
      }
      this.scanToken()
    }

    // Emit remaining DEDENTs at EOF
    while (this.indentStack.length > 1) {
      this.indentStack.pop()
      this.tokens.push({ type: 'DEDENT', value: '', line: this.line, column: this.column })
    }

    this.tokens.push({ type: 'EOF', value: '', line: this.line, column: this.column })
    return this.tokens
  }

  private handleIndentation() {
    // Count leading spaces/tabs
    let indent = 0
    const startPos = this.pos

    while (this.pos < this.source.length) {
      const char = this.source[this.pos]
      if (char === ' ') {
        indent += 1
        this.pos++
        this.column++
      } else if (char === '\t') {
        indent += 2  // Treat tabs as 2 spaces
        this.pos++
        this.column++
      } else {
        break
      }
    }

    // Skip blank lines and comment-only lines
    if (this.pos < this.source.length) {
      const char = this.source[this.pos]
      if (char === '\n' || char === '#') {
        this.atLineStart = false
        return
      }
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1]!

    if (indent > currentIndent) {
      // Indent
      this.indentStack.push(indent)
      this.tokens.push({ type: 'INDENT', value: '', line: this.line, column: 1 })
    } else if (indent < currentIndent) {
      // Dedent (possibly multiple levels)
      while (this.indentStack.length > 1 && this.indentStack[this.indentStack.length - 1]! > indent) {
        this.indentStack.pop()
        this.tokens.push({ type: 'DEDENT', value: '', line: this.line, column: 1 })
      }

      // Check for inconsistent indentation
      if (this.indentStack[this.indentStack.length - 1] !== indent) {
        throw new LexerError(`Inconsistent indentation`, this.line, this.column)
      }
    }

    this.atLineStart = false
  }

  private scanToken() {
    if (this.pos >= this.source.length) return

    const char = this.source[this.pos]!

    // Skip spaces (not at line start)
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
      this.atLineStart = true
      return
    }

    // Color literal or comment (both start with #)
    if (char === '#') {
      // Check if it's a color (followed by hex digits) or a comment
      if (this.isHexDigit(this.peek(1))) {
        this.scanColor()
        return
      }
      // Otherwise it's a comment
      while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
        this.advance()
      }
      return
    }

    // String
    if (char === '"') {
      this.scanString()
      return
    }

    // Number or duration
    if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))) {
      this.scanNumberOrDuration()
      return
    }

    // Reactive reference ($identifier)
    if (char === '$') {
      this.tokens.push({ type: 'DOLLAR', value: '$', line: this.line, column: this.column })
      this.advance()
      return
    }

    // Percentage
    if (char === '%') {
      this.tokens.push({ type: 'PERCENT', value: '%', line: this.line, column: this.column })
      this.advance()
      return
    }

    // At symbol (for intensity)
    if (char === '@') {
      this.tokens.push({ type: 'AT', value: '@', line: this.line, column: this.column })
      this.advance()
      return
    }

    // Arrows and comparison
    if (char === '-' && this.peek(1) === '>') {
      this.tokens.push({ type: 'ARROW', value: '->', line: this.line, column: this.column })
      this.advance()
      this.advance()
      return
    }

    if (char === '<' && this.peek(1) === '-' && this.peek(2) === '>') {
      this.tokens.push({ type: 'BIARROW', value: '<->', line: this.line, column: this.column })
      this.advance()
      this.advance()
      this.advance()
      return
    }

    // Range operator (..)
    if (char === '.' && this.peek(1) === '.') {
      this.tokens.push({ type: 'RANGE', value: '..', line: this.line, column: this.column })
      this.advance()
      this.advance()
      return
    }

    // Identifier or keyword
    if (this.isAlpha(char)) {
      this.scanIdentifier()
      return
    }

    // Single/double character tokens
    const tokenMap: Record<string, TokenType> = {
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
      '<': 'LT',
      '>': 'GT',
      '+': 'PLUS',
      '-': 'MINUS',
      '*': 'STAR',
      '/': 'SLASH',
    }

    if (char in tokenMap) {
      this.tokens.push({
        type: tokenMap[char]!,
        value: char,
        line: this.line,
        column: this.column
      })
      this.advance()
      return
    }

    throw new LexerError(`Unexpected character '${char}'`, this.line, this.column)
  }

  private scanString() {
    const startLine = this.line
    const startColumn = this.column
    this.advance() // Skip opening quote

    let value = ''
    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === '\n') {
        throw new LexerError(`Unterminated string`, startLine, startColumn)
      }
      if (this.source[this.pos] === '\\' && this.pos + 1 < this.source.length) {
        this.advance()
        const escaped = this.source[this.pos]
        switch (escaped) {
          case 'n': value += '\n'; break
          case 't': value += '\t'; break
          case '"': value += '"'; break
          case '\\': value += '\\'; break
          case '{': value += '{'; break
          case '}': value += '}'; break
          default: value += escaped
        }
      } else {
        value += this.source[this.pos]
      }
      this.advance()
    }

    if (this.pos >= this.source.length) {
      throw new LexerError(`Unterminated string`, startLine, startColumn)
    }

    this.advance() // Skip closing quote
    this.tokens.push({ type: 'STRING', value, line: startLine, column: startColumn })
  }

  private scanColor() {
    const startColumn = this.column
    this.advance() // Skip #

    let value = '#'
    while (this.pos < this.source.length && this.isHexDigit(this.source[this.pos]!)) {
      value += this.source[this.pos]
      this.advance()
    }

    // Validate color length (3, 4, 6, or 8 hex digits)
    const hexLen = value.length - 1
    if (hexLen !== 3 && hexLen !== 4 && hexLen !== 6 && hexLen !== 8) {
      throw new LexerError(`Invalid color literal '${value}'`, this.line, startColumn)
    }

    this.tokens.push({ type: 'COLOR', value, line: this.line, column: startColumn })
  }

  private scanNumberOrDuration() {
    const startColumn = this.column
    let value = ''

    if (this.source[this.pos] === '-') {
      value += '-'
      this.advance()
    }

    // Integer part
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos]!)) {
      value += this.source[this.pos]
      this.advance()
    }

    // Decimal part
    if (this.pos < this.source.length && this.source[this.pos] === '.') {
      // Check if it's a range operator (..)
      if (this.peek(1) === '.') {
        // It's a range, emit the number and let the next iteration handle ..
        this.tokens.push({ type: 'NUMBER', value, line: this.line, column: startColumn })
        return
      }

      value += '.'
      this.advance()
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos]!)) {
        value += this.source[this.pos]
        this.advance()
      }
    }

    // Check for duration suffix (ms, s, m, h)
    const suffixStart = this.pos
    let suffix = ''
    while (this.pos < this.source.length && this.isAlpha(this.source[this.pos]!)) {
      suffix += this.source[this.pos]
      this.advance()
    }

    if (suffix === 'ms' || suffix === 's' || suffix === 'm' || suffix === 'h') {
      this.tokens.push({ type: 'DURATION', value: value + suffix, line: this.line, column: startColumn })
    } else if (suffix) {
      // Not a duration, push back the suffix
      this.pos = suffixStart
      this.column -= suffix.length
      this.tokens.push({ type: 'NUMBER', value, line: this.line, column: startColumn })
    } else {
      this.tokens.push({ type: 'NUMBER', value, line: this.line, column: startColumn })
    }
  }

  private scanIdentifier() {
    const startColumn = this.column
    let value = ''

    // Allow hyphens in identifiers (e.g., wall-fan, door-sliding)
    while (this.pos < this.source.length &&
           (this.isAlphaNumeric(this.source[this.pos]!) || this.source[this.pos] === '-')) {
      value += this.source[this.pos]
      this.advance()
    }

    if (BOOLEAN_KEYWORDS.has(value)) {
      this.tokens.push({ type: 'BOOLEAN', value, line: this.line, column: startColumn })
    } else if (ALL_KEYWORDS.has(value)) {
      this.tokens.push({ type: 'KEYWORD', value, line: this.line, column: startColumn })
    } else {
      this.tokens.push({ type: 'IDENTIFIER', value, line: this.line, column: startColumn })
    }
  }

  private advance() {
    this.pos++
    this.column++
  }

  private peek(offset = 1): string {
    return this.source[this.pos + offset] ?? ''
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9'
  }

  private isHexDigit(char: string): boolean {
    return this.isDigit(char) ||
           (char >= 'a' && char <= 'f') ||
           (char >= 'A' && char <= 'F')
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

/**
 * Convenience function to tokenize a string.
 */
export function tokenize(source: string): Token[] {
  const lexer = new ForgeLexer(source)
  return lexer.tokenize()
}
