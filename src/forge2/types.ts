/**
 * Forge 2.0 AST Types
 *
 * A minimal, extensible language where everything is data.
 * ~12 core keywords, convention-based design, optional schemas.
 */

// ============================================================================
// Source Location
// ============================================================================

export interface SourceLocation {
  line: number
  column: number
  offset: number
}

export interface SourceSpan {
  start: SourceLocation
  end: SourceLocation
  file?: string
}

// ============================================================================
// Tokens
// ============================================================================

export type TokenType =
  // Literals
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'NULL'
  | 'IDENTIFIER'

  // Keywords (~12 core)
  | 'LET'
  | 'SET'
  | 'FN'
  | 'IF'
  | 'ELIF'
  | 'ELSE'
  | 'FOR'
  | 'WHILE'
  | 'MATCH'
  | 'RETURN'
  | 'ON'
  | 'EMIT'
  | 'IMPORT'
  | 'FROM'
  | 'SCHEMA'
  | 'EXTENDS'
  | 'IN'
  | 'WHEN'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'THEN'

  // Punctuation
  | 'LPAREN'      // (
  | 'RPAREN'      // )
  | 'LBRACKET'    // [
  | 'RBRACKET'    // ]
  | 'LBRACE'      // {
  | 'RBRACE'      // }
  | 'COLON'       // :
  | 'COMMA'       // ,
  | 'DOT'         // .
  | 'ARROW'       // ->
  | 'EQUALS'      // =
  | 'PLUS'        // +
  | 'MINUS'       // -
  | 'STAR'        // *
  | 'SLASH'       // /
  | 'PERCENT'     // %
  | 'LT'          // <
  | 'GT'          // >
  | 'LTE'         // <=
  | 'GTE'         // >=
  | 'EQ'          // ==
  | 'NEQ'         // !=
  | 'AT'          // @
  | 'HASH'        // #
  | 'DOLLAR'      // $

  // Structure
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  span: SourceSpan
}

// ============================================================================
// AST Nodes - Base
// ============================================================================

export interface BaseNode {
  type: string
  span?: SourceSpan
}

// ============================================================================
// AST Nodes - Expressions
// ============================================================================

export interface NumberLiteral extends BaseNode {
  type: 'NumberLiteral'
  value: number
}

export interface StringLiteral extends BaseNode {
  type: 'StringLiteral'
  value: string
}

export interface BooleanLiteral extends BaseNode {
  type: 'BooleanLiteral'
  value: boolean
}

export interface NullLiteral extends BaseNode {
  type: 'NullLiteral'
}

export interface Identifier extends BaseNode {
  type: 'Identifier'
  name: string
}

/** Vector literal: (x, y, z) - sugar for a list */
export interface VectorLiteral extends BaseNode {
  type: 'VectorLiteral'
  elements: Expression[]
}

/** List literal: [1, 2, 3] */
export interface ListLiteral extends BaseNode {
  type: 'ListLiteral'
  elements: Expression[]
}

/** Map literal: { key: value, ... } */
export interface MapLiteral extends BaseNode {
  type: 'MapLiteral'
  entries: MapEntry[]
}

export interface MapEntry {
  key: Expression  // Usually Identifier or StringLiteral
  value: Expression
}

/** Color literal: #ff0000 */
export interface ColorLiteral extends BaseNode {
  type: 'ColorLiteral'
  value: string  // Hex string without #
}

/** Member access: obj.prop or obj[expr] */
export interface MemberExpression extends BaseNode {
  type: 'MemberExpression'
  object: Expression
  property: Expression
  computed: boolean  // true for obj[expr], false for obj.prop
}

/** Function call: fn(args) */
export interface CallExpression extends BaseNode {
  type: 'CallExpression'
  callee: Expression
  arguments: Expression[]
}

/** Binary operation: a + b */
export interface BinaryExpression extends BaseNode {
  type: 'BinaryExpression'
  operator: string
  left: Expression
  right: Expression
}

/** Unary operation: -x, not x */
export interface UnaryExpression extends BaseNode {
  type: 'UnaryExpression'
  operator: string
  argument: Expression
  prefix: boolean
}

/** Ternary: if cond then a else b (expression form) */
export interface ConditionalExpression extends BaseNode {
  type: 'ConditionalExpression'
  test: Expression
  consequent: Expression
  alternate: Expression
}

/** Lambda: fn(x) -> x * 2 */
export interface ArrowFunction extends BaseNode {
  type: 'ArrowFunction'
  params: Parameter[]
  body: Expression | BlockStatement
}

/** Reactive reference: $variable */
export interface ReactiveRef extends BaseNode {
  type: 'ReactiveRef'
  path: string[]  // ['ball', 'position', 'x']
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | VectorLiteral
  | ListLiteral
  | MapLiteral
  | ColorLiteral
  | MemberExpression
  | CallExpression
  | BinaryExpression
  | UnaryExpression
  | ConditionalExpression
  | ArrowFunction
  | ReactiveRef

// ============================================================================
// AST Nodes - Statements
// ============================================================================

/** Variable declaration: let x = value */
export interface LetStatement extends BaseNode {
  type: 'LetStatement'
  name: string
  value: Expression
}

/** Mutation: set x: value or set obj.prop: value */
export interface SetStatement extends BaseNode {
  type: 'SetStatement'
  target: Expression  // Identifier or MemberExpression
  value: Expression
}

/** Function definition: fn name(params): body */
export interface FunctionDeclaration extends BaseNode {
  type: 'FunctionDeclaration'
  name: string
  params: Parameter[]
  body: BlockStatement
}

export interface Parameter {
  name: string
  defaultValue?: Expression
  typeAnnotation?: TypeAnnotation
}

/** If statement */
export interface IfStatement extends BaseNode {
  type: 'IfStatement'
  test: Expression
  consequent: BlockStatement
  alternate?: BlockStatement | IfStatement  // elif chains
}

/** For loop: for item in list: body */
export interface ForStatement extends BaseNode {
  type: 'ForStatement'
  variable: string
  iterable: Expression
  body: BlockStatement
}

/** While loop: while cond: body */
export interface WhileStatement extends BaseNode {
  type: 'WhileStatement'
  test: Expression
  body: BlockStatement
}

/** Match statement (pattern matching) */
export interface MatchStatement extends BaseNode {
  type: 'MatchStatement'
  discriminant: Expression
  cases: MatchCase[]
}

export interface MatchCase {
  pattern: Pattern
  guard?: Expression  // Optional "when" clause
  body: BlockStatement
}

export type Pattern =
  | { type: 'LiteralPattern'; value: Expression }
  | { type: 'IdentifierPattern'; name: string }
  | { type: 'WildcardPattern' }  // _
  | { type: 'ListPattern'; elements: Pattern[] }
  | { type: 'MapPattern'; entries: { key: string; pattern: Pattern }[] }

/** Return statement */
export interface ReturnStatement extends BaseNode {
  type: 'ReturnStatement'
  argument?: Expression
}

/** Event handler: on "event": body or on "event" when cond: body */
export interface OnStatement extends BaseNode {
  type: 'OnStatement'
  event: Expression  // Usually StringLiteral
  condition?: Expression  // Optional "when" clause
  body: BlockStatement
}

/** Emit event: emit "event" or emit "event" { data } */
export interface EmitStatement extends BaseNode {
  type: 'EmitStatement'
  event: Expression
  data?: Expression
}

/** Import: import "module" or from "module" import { a, b } */
export interface ImportStatement extends BaseNode {
  type: 'ImportStatement'
  source: string
  specifiers?: ImportSpecifier[]
  namespace?: string  // import "x" as y
}

export interface ImportSpecifier {
  imported: string
  local: string
}

/** Expression statement (for side effects) */
export interface ExpressionStatement extends BaseNode {
  type: 'ExpressionStatement'
  expression: Expression
}

/** Block of statements */
export interface BlockStatement extends BaseNode {
  type: 'BlockStatement'
  body: Statement[]
}

export type Statement =
  | LetStatement
  | SetStatement
  | FunctionDeclaration
  | IfStatement
  | ForStatement
  | WhileStatement
  | MatchStatement
  | ReturnStatement
  | OnStatement
  | EmitStatement
  | ImportStatement
  | ExpressionStatement
  | BlockStatement
  | SchemaDeclaration
  | InstanceDeclaration

// ============================================================================
// AST Nodes - Schema System (Optional Structure)
// ============================================================================

/** Schema definition */
export interface SchemaDeclaration extends BaseNode {
  type: 'SchemaDeclaration'
  name: string
  extends?: string
  fields: SchemaField[]
  methods: FunctionDeclaration[]
}

export interface SchemaField {
  name: string
  type: TypeAnnotation
  required: boolean
  defaultValue?: Expression
}

/** Type annotations for schema fields */
export type TypeAnnotation =
  | { kind: 'simple'; name: string }  // string, number, bool
  | { kind: 'list'; element: TypeAnnotation }  // list<T>
  | { kind: 'map'; key: TypeAnnotation; value: TypeAnnotation }  // map<K, V>
  | { kind: 'enum'; values: string[] }  // enum("a", "b", "c")
  | { kind: 'vec'; size?: number }  // vec3, vec2
  | { kind: 'fn'; params: TypeAnnotation[]; returns: TypeAnnotation }  // fn type
  | { kind: 'union'; types: TypeAnnotation[] }  // A | B

/** Instance of a schema: schema_name instance_name: fields */
export interface InstanceDeclaration extends BaseNode {
  type: 'InstanceDeclaration'
  schema: string
  name: string
  fields: MapEntry[]
}

// ============================================================================
// Program (Root Node)
// ============================================================================

export interface Program extends BaseNode {
  type: 'Program'
  body: Statement[]
  imports: ImportStatement[]
}

// ============================================================================
// Runtime Types
// ============================================================================

/** Runtime value types */
export type ForgeValue =
  | number
  | string
  | boolean
  | null
  | ForgeValue[]
  | ForgeMap
  | ForgeFunction
  | ForgeSchema
  | ForgeInstance

export interface ForgeMap {
  [key: string]: ForgeValue
}

export interface ForgeFunction {
  __type: 'function'
  params: Parameter[]
  body: BlockStatement | Expression
  closure: Environment
  name?: string
}

export interface ForgeSchema {
  __type: 'schema'
  name: string
  extends?: string
  fields: SchemaField[]
  methods: Map<string, ForgeFunction>
}

export interface ForgeInstance {
  __type: 'instance'
  schema: string
  data: ForgeMap
}

/** Environment for variable lookup */
export interface Environment {
  parent?: Environment
  bindings: Map<string, ForgeValue>
}

/** Event handler registration */
export interface EventHandler {
  event: string
  condition?: Expression
  body: BlockStatement
  environment: Environment
}
