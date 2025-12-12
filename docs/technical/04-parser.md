# Parser

## Overview

The parser transforms StarLang source code (text) into an Abstract Syntax Tree (AST). It handles:

- Tokenization (lexing)
- Syntax analysis
- Error reporting with helpful messages

---

## Lexer

The lexer breaks source text into tokens.

### Token Types

```typescript
enum TokenType {
  // Literals
  IDENTIFIER,     // galley, door_to_cold
  STRING,         // "Galley"
  NUMBER,         // 42, 3.14
  UNIT_NUMBER,    // 22C, 2.4kW, 30s
  
  // Keywords
  ROOM,           // room
  DOOR,           // door
  NODE,           // node
  SENSOR,         // sensor
  RELAY,          // relay
  TERMINAL,       // terminal
  SIGNAL,         // signal
  IF,             // if
  ELSE,           // else
  AND,            // AND
  OR,             // OR
  NOT,            // NOT
  ANY,            // ANY
  ALL,            // ALL
  TRUE,           // true
  FALSE,          // false
  
  // Symbols
  LBRACE,         // {
  RBRACE,         // }
  LBRACKET,       // [
  RBRACKET,       // ]
  LPAREN,         // (
  RPAREN,         // )
  COLON,          // :
  COMMA,          // ,
  DOT,            // .
  PIPE,           // |
  ARROW,          // →
  
  // Operators
  EQ,             // ==
  NE,             // !=
  LT,             // <
  GT,             // >
  LE,             // <=
  GE,             // >=
  
  // Special
  COMMENT,        // # ...
  NEWLINE,
  EOF
}

interface Token {
  type: TokenType
  value: string
  line: number
  column: number
}
```

### Lexer Implementation

```typescript
class Lexer {
  private source: string
  private pos: number = 0
  private line: number = 1
  private column: number = 1
  
  constructor(source: string) {
    this.source = source
  }
  
  tokenize(): Token[] {
    const tokens: Token[] = []
    
    while (!this.isAtEnd()) {
      this.skipWhitespace()
      if (this.isAtEnd()) break
      
      const token = this.nextToken()
      if (token.type !== TokenType.COMMENT) {
        tokens.push(token)
      }
    }
    
    tokens.push(this.makeToken(TokenType.EOF, ''))
    return tokens
  }
  
  private nextToken(): Token {
    const char = this.peek()
    
    // Comments
    if (char === '#') {
      return this.readComment()
    }
    
    // Strings
    if (char === '"') {
      return this.readString()
    }
    
    // Numbers
    if (this.isDigit(char) || (char === '-' && this.isDigit(this.peekNext()))) {
      return this.readNumber()
    }
    
    // Identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      return this.readIdentifier()
    }
    
    // Symbols
    return this.readSymbol()
  }
  
  private readNumber(): Token {
    const start = this.pos
    
    // Optional negative
    if (this.peek() === '-') this.advance()
    
    // Integer part
    while (this.isDigit(this.peek())) this.advance()
    
    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance() // consume '.'
      while (this.isDigit(this.peek())) this.advance()
    }
    
    // Unit suffix (C, kW, atm, s, etc.)
    const unitStart = this.pos
    while (this.isAlpha(this.peek()) || this.peek() === '/') {
      this.advance()
    }
    
    const value = this.source.slice(start, this.pos)
    const hasUnit = this.pos > unitStart
    
    return this.makeToken(
      hasUnit ? TokenType.UNIT_NUMBER : TokenType.NUMBER,
      value
    )
  }
  
  private readIdentifier(): Token {
    const start = this.pos
    
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_') {
      this.advance()
    }
    
    const value = this.source.slice(start, this.pos)
    const type = KEYWORDS[value] || TokenType.IDENTIFIER
    
    return this.makeToken(type, value)
  }
  
  // ... more methods
}

const KEYWORDS: Record<string, TokenType> = {
  'room': TokenType.ROOM,
  'door': TokenType.DOOR,
  'node': TokenType.NODE,
  'sensor': TokenType.SENSOR,
  'relay': TokenType.RELAY,
  'terminal': TokenType.TERMINAL,
  'signal': TokenType.SIGNAL,
  'if': TokenType.IF,
  'else': TokenType.ELSE,
  'AND': TokenType.AND,
  'OR': TokenType.OR,
  'NOT': TokenType.NOT,
  'ANY': TokenType.ANY,
  'ALL': TokenType.ALL,
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,
}
```

---

## Parser

The parser builds an AST from tokens.

### AST Nodes

```typescript
interface ASTNode {
  type: string
  line: number
  column: number
}

interface FileNode extends ASTNode {
  type: 'File'
  permissions?: PermissionsNode
  declarations: DeclarationNode[]
}

interface DeclarationNode extends ASTNode {
  type: 'Declaration'
  nodeType: string       // 'room', 'door', 'sensor', etc.
  id: string
  subtype?: string       // For 'node X : Subtype'
  properties: PropertyNode[]
}

interface PropertyNode extends ASTNode {
  type: 'Property'
  name: string
  value: ValueNode
}

type ValueNode =
  | LiteralNode
  | ListNode
  | ObjectNode
  | ReferenceNode
  | ConditionNode
  | ActionBlockNode

interface LiteralNode extends ASTNode {
  type: 'Literal'
  value: string | number | boolean
  unit?: string
}

interface ListNode extends ASTNode {
  type: 'List'
  elements: ValueNode[]
}

interface ObjectNode extends ASTNode {
  type: 'Object'
  properties: PropertyNode[]
}

interface ReferenceNode extends ASTNode {
  type: 'Reference'
  path: string[]  // ['atmo', 'deck4_main']
}

interface ConditionNode extends ASTNode {
  type: 'Condition'
  operator: 'AND' | 'OR' | 'NOT' | 'ANY' | 'ALL' | 'COMPARE'
  operands?: ConditionNode[]
  left?: ValueNode
  right?: ValueNode
  compareOp?: '==' | '!=' | '<' | '>' | '<=' | '>='
}

interface ActionBlockNode extends ASTNode {
  type: 'ActionBlock'
  capture?: string  // For |temp| { ... }
  statements: StatementNode[]
}

interface StatementNode extends ASTNode {
  type: 'Statement'
  action: string  // 'trigger', 'clear', 'announce', etc.
  args: ValueNode[]
  block?: ActionBlockNode  // For 'if' and 'after'
}
```

### Parser Implementation

```typescript
class Parser {
  private tokens: Token[]
  private pos: number = 0
  private errors: ParseError[] = []
  
  constructor(tokens: Token[]) {
    this.tokens = tokens
  }
  
  parse(): ParseResult {
    const declarations: DeclarationNode[] = []
    let permissions: PermissionsNode | undefined
    
    while (!this.isAtEnd()) {
      // Check for @permissions block
      if (this.check(TokenType.AT) && this.peekNext()?.value === 'permissions') {
        permissions = this.parsePermissions()
        continue
      }
      
      // Parse declaration
      const decl = this.parseDeclaration()
      if (decl) {
        declarations.push(decl)
      }
    }
    
    return {
      ast: { type: 'File', permissions, declarations, line: 1, column: 1 },
      errors: this.errors
    }
  }
  
  private parseDeclaration(): DeclarationNode | null {
    // Expect type keyword
    const typeToken = this.advance()
    if (!this.isDeclarationType(typeToken.type)) {
      this.error(`Expected declaration type, got '${typeToken.value}'`)
      this.synchronize()
      return null
    }
    
    // Expect identifier
    const idToken = this.expect(TokenType.IDENTIFIER, 'Expected node identifier')
    
    // Optional subtype
    let subtype: string | undefined
    if (this.match(TokenType.COLON)) {
      const subtypeToken = this.expect(TokenType.IDENTIFIER, 'Expected subtype')
      subtype = subtypeToken.value
    }
    
    // Expect opening brace
    this.expect(TokenType.LBRACE, `Expected '{' after declaration`)
    
    // Parse properties
    const properties: PropertyNode[] = []
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const prop = this.parseProperty()
      if (prop) {
        properties.push(prop)
      }
    }
    
    // Expect closing brace
    this.expect(TokenType.RBRACE, `Expected '}' at end of declaration`)
    
    return {
      type: 'Declaration',
      nodeType: typeToken.value,
      id: idToken.value,
      subtype,
      properties,
      line: typeToken.line,
      column: typeToken.column
    }
  }
  
  private parseProperty(): PropertyNode | null {
    const nameToken = this.advance()
    
    if (nameToken.type !== TokenType.IDENTIFIER) {
      this.error(`Expected property name, got '${nameToken.value}'`)
      this.synchronize()
      return null
    }
    
    this.expect(TokenType.COLON, `Expected ':' after property name`)
    
    const value = this.parseValue()
    
    return {
      type: 'Property',
      name: nameToken.value,
      value,
      line: nameToken.line,
      column: nameToken.column
    }
  }
  
  private parseValue(): ValueNode {
    // List
    if (this.check(TokenType.LBRACKET)) {
      return this.parseList()
    }
    
    // Object
    if (this.check(TokenType.LBRACE)) {
      return this.parseObject()
    }
    
    // Action block with capture
    if (this.check(TokenType.PIPE)) {
      return this.parseActionBlock()
    }
    
    // ANY/ALL condition
    if (this.check(TokenType.ANY) || this.check(TokenType.ALL)) {
      return this.parseAnyAllCondition()
    }
    
    // Reference, literal, or simple expression
    return this.parseExpression()
  }
  
  // ... more parsing methods
}
```

---

## Error Handling

The parser produces helpful error messages.

### Error Recovery

When an error occurs, the parser tries to recover and continue:

```typescript
private synchronize(): void {
  // Skip tokens until we find a likely recovery point
  while (!this.isAtEnd()) {
    // End of statement/property
    if (this.previous()?.type === TokenType.RBRACE) return
    
    // Start of new declaration
    if (this.isDeclarationType(this.peek().type)) return
    
    // Property name followed by colon
    if (this.check(TokenType.IDENTIFIER) && 
        this.peekNext()?.type === TokenType.COLON) return
    
    this.advance()
  }
}
```

### Error Messages

```typescript
interface ParseError {
  message: string
  line: number
  column: number
  suggestion?: string
}

// Example error generation
private error(message: string, suggestion?: string): void {
  const token = this.peek()
  this.errors.push({
    message,
    line: token.line,
    column: token.column,
    suggestion
  })
}

// Usage
if (token.value === 'rooom') {
  this.error(
    `Unknown declaration type 'rooom'`,
    `Did you mean 'room'?`
  )
}
```

### Error Display

```
ERROR: galley.sl:13:10

  12 │ node galley_outlet : AtmoOutlet {
→ 13 │   target: VOID.external
     │          ^^^^
  14 │   flow_rate: 2.4

Unexpected token 'VOID'
Did you mean a node reference? Try: atmo.deck4_return
```

---

## Full Example

### Input

```starlang
room galley {
  display_name: "Galley"
  deck: 4
  adjacent: [crew_mess, cold_storage]
}
```

### Tokens

```
ROOM        'room'      line 1
IDENTIFIER  'galley'    line 1
LBRACE      '{'         line 1
IDENTIFIER  'display_name'  line 2
COLON       ':'         line 2
STRING      '"Galley"'  line 2
IDENTIFIER  'deck'      line 3
COLON       ':'         line 3
NUMBER      '4'         line 3
IDENTIFIER  'adjacent'  line 4
COLON       ':'         line 4
LBRACKET    '['         line 4
IDENTIFIER  'crew_mess' line 4
COMMA       ','         line 4
IDENTIFIER  'cold_storage'  line 4
RBRACKET    ']'         line 4
RBRACE      '}'         line 5
EOF                     line 5
```

### AST

```json
{
  "type": "File",
  "declarations": [
    {
      "type": "Declaration",
      "nodeType": "room",
      "id": "galley",
      "properties": [
        {
          "type": "Property",
          "name": "display_name",
          "value": { "type": "Literal", "value": "Galley" }
        },
        {
          "type": "Property",
          "name": "deck",
          "value": { "type": "Literal", "value": 4 }
        },
        {
          "type": "Property",
          "name": "adjacent",
          "value": {
            "type": "List",
            "elements": [
              { "type": "Reference", "path": ["crew_mess"] },
              { "type": "Reference", "path": ["cold_storage"] }
            ]
          }
        }
      ]
    }
  ]
}
```
