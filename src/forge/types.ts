// Forge AST Type Definitions
// Defines the structure of parsed Forge DSL

// ============================================================================
// Base Types
// ============================================================================

export interface SourceLocation {
  line: number
  column: number
}

export interface ASTNode {
  loc: SourceLocation
}

// ============================================================================
// Literals and Values
// ============================================================================

export interface NumberLiteral extends ASTNode {
  kind: 'number'
  value: number
}

export interface StringLiteral extends ASTNode {
  kind: 'string'
  value: string
}

export interface BooleanLiteral extends ASTNode {
  kind: 'boolean'
  value: boolean
}

export interface ColorLiteral extends ASTNode {
  kind: 'color'
  value: string  // #rrggbb or #rgb
}

export interface DurationLiteral extends ASTNode {
  kind: 'duration'
  value: number  // milliseconds
  unit: 'ms' | 's' | 'm' | 'h'
}

export interface Identifier extends ASTNode {
  kind: 'identifier'
  name: string
}

export interface Vec2 extends ASTNode {
  kind: 'vec2'
  x: Expression
  y: Expression
}

export interface Vec3 extends ASTNode {
  kind: 'vec3'
  x: Expression
  y: Expression
  z: Expression
}

export interface Range extends ASTNode {
  kind: 'range'
  start: Expression
  end: Expression
}

// Reactive reference: $identifier or $path.to.value
export interface ReactiveRef extends ASTNode {
  kind: 'reactive'
  path: string[]
}

// Member access: obj.field
export interface MemberAccess extends ASTNode {
  kind: 'member'
  object: Expression
  property: string
}

// Binary operations: +, -, *, /, ==, !=, <, >, <=, >=, and, or
export interface BinaryOp extends ASTNode {
  kind: 'binary'
  operator: string
  left: Expression
  right: Expression
}

// Unary operations: not, -
export interface UnaryOp extends ASTNode {
  kind: 'unary'
  operator: string
  operand: Expression
}

// Function call: easeInOut(value)
export interface FunctionCall extends ASTNode {
  kind: 'call'
  name: string
  args: Expression[]
}

// List literal: [a, b, c]
export interface ListLiteral extends ASTNode {
  kind: 'list'
  elements: Expression[]
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | ColorLiteral
  | DurationLiteral
  | Identifier
  | Vec2
  | Vec3
  | Range
  | ReactiveRef
  | MemberAccess
  | BinaryOp
  | UnaryOp
  | FunctionCall
  | ListLiteral

// ============================================================================
// Type Annotations
// ============================================================================

export interface TypeAnnotation extends ASTNode {
  kind: 'type'
  name: string  // float, int, bool, string, enum, ref, list
  constraint?: Range  // for float[0..10]
  enumValues?: string[]  // for enum(A, B, C)
  elementType?: TypeAnnotation  // for list<T>
  refTarget?: string  // for ref(room)
}

// ============================================================================
// Params Block
// ============================================================================

export interface ParamDef extends ASTNode {
  kind: 'param'
  name: string
  type: TypeAnnotation
  default?: Expression
}

export interface ParamsBlock extends ASTNode {
  kind: 'params'
  params: ParamDef[]
}

// ============================================================================
// Geometry Primitives
// ============================================================================

// Single voxel: (x, y, z) as TYPE
export interface VoxelPrimitive extends ASTNode {
  kind: 'voxel'
  position: Vec3
  type: string
  comment?: string
}

// Box: box (x1, y1, z1) to (x2, y2, z2) as TYPE
// or: box (x, y, z) size (w, h, d) as TYPE
export interface BoxPrimitive extends ASTNode {
  kind: 'box'
  from: Vec3
  to?: Vec3
  size?: Vec3
  type: string
}

// Repeat pattern: repeat x from 0 to 10 step 2: ...
export interface RepeatPattern extends ASTNode {
  kind: 'repeat'
  variables: { name: string; from: Expression; to: Expression; step?: Expression }[]
  body: GeometryPrimitive[]
}

// Child reference: child fan-blades at (x, y, z)
export interface ChildRef extends ASTNode {
  kind: 'child'
  asset: string
  position: Vec3
  condition?: Expression  // when $powered
  body?: Statement[]  // nested statements (animate, etc.)
}

export type GeometryPrimitive =
  | VoxelPrimitive
  | BoxPrimitive
  | RepeatPattern
  | ChildRef

// ============================================================================
// Geometry Block
// ============================================================================

export interface GeometryBlock extends ASTNode {
  kind: 'geometry'
  primitives: GeometryPrimitive[]
}

// ============================================================================
// Parts Block (named geometry groups)
// ============================================================================

export interface Part extends ASTNode {
  kind: 'part'
  name: string
  geometry: GeometryPrimitive[]
  position?: Vec3  // at: (x, y, z)
}

export interface PartsBlock extends ASTNode {
  kind: 'parts'
  parts: Part[]
}

// ============================================================================
// States Block
// ============================================================================

export interface PropertyBinding extends ASTNode {
  kind: 'property'
  target: string  // part.property
  value: Expression
}

export interface StateDefinition extends ASTNode {
  kind: 'state'
  name: string
  bindings: PropertyBinding[]
}

export interface StatesBlock extends ASTNode {
  kind: 'states'
  states: StateDefinition[]
}

// ============================================================================
// Animations Block
// ============================================================================

// Timeline keyframe: 0% -> stateName
export interface Keyframe extends ASTNode {
  kind: 'keyframe'
  percent: number
  state: string
  easing?: string
}

export interface AnimationDefinition extends ASTNode {
  kind: 'animation'
  name: string
  duration: DurationLiteral
  loop?: boolean
  keyframes: Keyframe[]
}

export interface AnimationsBlock extends ASTNode {
  kind: 'animations'
  animations: AnimationDefinition[]
}

// ============================================================================
// Statements (actions, conditionals)
// ============================================================================

// animate spin on z at $speed
export interface AnimateStatement extends ASTNode {
  kind: 'animate'
  animation: string  // spin, bob, pulse, fade
  axis?: string  // x, y, z
  speed?: Expression
  params?: Record<string, Expression>
}

// setState(open)
export interface SetStateStatement extends ASTNode {
  kind: 'setState'
  state: string
}

// play(animation)
export interface PlayStatement extends ASTNode {
  kind: 'play'
  animation: string
}

// stopAnimation(animation)
export interface StopAnimationStatement extends ASTNode {
  kind: 'stopAnimation'
  animation: string
}

// emit "event:name"
export interface EmitStatement extends ASTNode {
  kind: 'emit'
  event: string
}

// set property: value
export interface SetStatement extends ASTNode {
  kind: 'set'
  property: string
  value: Expression
}

// when $condition: ...
export interface WhenBlock extends ASTNode {
  kind: 'when'
  condition: Expression
  body: Statement[]
  else?: Statement[]
}

// match expression: CASE -> action
export interface MatchCase extends ASTNode {
  kind: 'matchCase'
  pattern: Expression
  body: Statement[]
}

export interface MatchBlock extends ASTNode {
  kind: 'match'
  expression: Expression
  cases: MatchCase[]
}

// on event: ...
export interface OnBlock extends ASTNode {
  kind: 'on'
  event: string
  condition?: Expression  // when condition
  body: Statement[]
}

export type Statement =
  | AnimateStatement
  | SetStateStatement
  | PlayStatement
  | StopAnimationStatement
  | EmitStatement
  | SetStatement
  | WhenBlock
  | MatchBlock
  | OnBlock
  | IfStatement
  | ForStatement
  | WhileStatement
  | BreakStatement
  | ContinueStatement
  | ReturnStatement

// ============================================================================
// Layout Elements
// ============================================================================

export interface RoomDef extends ASTNode {
  kind: 'room'
  name: string
  position: Vec3
  size: Vec3
  properties?: Record<string, Expression>
}

export interface DoorDef extends ASTNode {
  kind: 'door'
  name: string
  position: Vec3
  facing: string  // north, east, south, west
  connects: [string, string]  // room <-> room
  control?: string  // switch reference
}

export interface TerminalDef extends ASTNode {
  kind: 'terminal'
  name: string
  position: Vec3
  rotation: number
  type?: string
  properties?: Record<string, Expression>
}

export interface SwitchDef extends ASTNode {
  kind: 'switch'
  name: string
  position: Vec3
  rotation: number
  status?: string  // OK, FAULT, etc.
}

export interface WallLightDef extends ASTNode {
  kind: 'wallLight'
  name: string
  position: Vec3
  rotation: number
  color?: ColorLiteral
  intensity?: number
}

export interface AssetInstanceDef extends ASTNode {
  kind: 'assetInstance'
  name: string
  asset: string
  position: Vec3
  rotation?: number
  facing?: string
  properties?: Record<string, Expression>
}

// ============================================================================
// Top-Level Definitions
// ============================================================================

export interface AssetDef extends ASTNode {
  kind: 'asset'
  name: string
  displayName?: string
  description?: string
  anchor?: Vec3
  params?: ParamsBlock
  geometry?: GeometryBlock
  parts?: PartsBlock
  children?: ChildRef[]
  states?: StatesBlock
  animations?: AnimationsBlock
  body?: Statement[]  // when/on blocks at asset level
}

export interface LayoutDef extends ASTNode {
  kind: 'layout'
  name: string
  coordinate: 'voxel' | 'world'
  rooms: RoomDef[]
  doors: DoorDef[]
  terminals: TerminalDef[]
  switches: SwitchDef[]
  wallLights: WallLightDef[]
  assets: AssetInstanceDef[]
}

export interface EntityDef extends ASTNode {
  kind: 'entity'
  name: string
  params?: ParamsBlock
  screen?: ScreenBlock
  render?: RenderBlock
  styles?: StylesBlock
  body?: Statement[]
}

export interface ScreenBlock extends ASTNode {
  kind: 'screen'
  size: Vec2
  font?: string
  fontSize?: number
  background?: ColorLiteral
  lineHeight?: number
  padding?: number
}

export interface StyleDef extends ASTNode {
  kind: 'style'
  name: string
  properties: Record<string, Expression>
}

export interface StylesBlock extends ASTNode {
  kind: 'styles'
  styles: StyleDef[]
}

export interface RenderBlock extends ASTNode {
  kind: 'render'
  body: RenderStatement[]
}

export interface TextRenderStatement extends ASTNode {
  kind: 'text'
  content: Expression
  centered?: boolean
}

export interface RowRenderStatement extends ASTNode {
  kind: 'row'
  label: Expression
  value: Expression
}

export interface CodeRenderStatement extends ASTNode {
  kind: 'code'
  content: Expression
  lineNumbers?: boolean
}

export type RenderStatement =
  | TextRenderStatement
  | RowRenderStatement
  | CodeRenderStatement
  | MatchBlock

export interface MachineDef extends ASTNode {
  kind: 'machine'
  name: string
  states: MachineState[]
  initial: string
}

export interface MachineState extends ASTNode {
  kind: 'machineState'
  name: string
  on: MachineTransition[]
  enter?: Statement[]
  exit?: Statement[]
}

export interface MachineTransition extends ASTNode {
  kind: 'transition'
  event: string
  target: string
  guard?: Expression
  actions?: Statement[]
}

// ============================================================================
// Config Definition
// ============================================================================

/**
 * Config value can be a literal, nested config object, or expression.
 */
export type ConfigValue = Expression | ConfigObject

export interface ConfigObject extends ASTNode {
  kind: 'configObject'
  properties: Record<string, ConfigValue>
}

/**
 * Top-level config definition.
 * Example:
 *   config atmosphere
 *     o2:
 *       depletion_rate: 0.05
 *       warning_threshold: 19
 */
export interface ConfigDef extends ASTNode {
  kind: 'config'
  name: string
  properties: Record<string, ConfigValue>
}

// ============================================================================
// Function Definition (for Phase 8c)
// ============================================================================

export interface FunctionParam extends ASTNode {
  kind: 'functionParam'
  name: string
  default?: Expression
}

export interface FunctionDef extends ASTNode {
  kind: 'function'
  name: string
  params: FunctionParam[]
  body: Statement[]
}

// ============================================================================
// Control Flow Statements (for Phase 8d)
// ============================================================================

export interface IfStatement extends ASTNode {
  kind: 'if'
  condition: Expression
  body: Statement[]
  elif?: { condition: Expression; body: Statement[] }[]
  else?: Statement[]
}

export interface ForStatement extends ASTNode {
  kind: 'for'
  variable: string
  iterable: Expression
  body: Statement[]
}

export interface WhileStatement extends ASTNode {
  kind: 'while'
  condition: Expression
  body: Statement[]
}

export interface BreakStatement extends ASTNode {
  kind: 'break'
}

export interface ContinueStatement extends ASTNode {
  kind: 'continue'
}

export interface ReturnStatement extends ASTNode {
  kind: 'return'
  value?: Expression
}

// ============================================================================
// Rule Definition (for Phase 8f)
// ============================================================================

export interface RuleDef extends ASTNode {
  kind: 'rule'
  name: string
  trigger: 'tick' | string  // 'tick' or event name
  condition?: Expression
  effects: Statement[]
}

// ============================================================================
// Scenario Definition (for Phase 8g)
// ============================================================================

export interface ScenarioDef extends ASTNode {
  kind: 'scenario'
  name: string
  initial: Record<string, Expression>
  handlers: OnBlock[]
}

// ============================================================================
// Behavior Definition (for Phase 8h)
// ============================================================================

export interface BehaviorDef extends ASTNode {
  kind: 'behavior'
  name: string
  handlers: OnBlock[]
}

// ============================================================================
// Condition Definition (for Phase 11.1)
// ============================================================================

/**
 * Game condition that triggers victory, defeat, or checkpoint.
 * Checked every tick by ForgeVM.
 *
 * Example:
 *   condition escape_galley
 *     type: victory
 *     trigger: $player_room == "corridor" and $previous_room == "galley"
 *     message: "You escaped the galley!"
 *     effect:
 *       emit "game:victory"
 */
export interface ConditionDef extends ASTNode {
  kind: 'condition'
  name: string
  conditionType: 'victory' | 'defeat' | 'checkpoint'
  trigger: Expression
  message?: Expression
  effects: Statement[]
}

// ============================================================================
// Interaction Definition (player-entity interactions)
// ============================================================================

/**
 * Target specification for interactions.
 * Defines what entities can be interacted with.
 *
 * Examples:
 *   target: entity where type == "switch"
 *   target: entity where voxel_type in [SWITCH, SWITCH_BUTTON]
 *   target: entity where interactable == true
 */
export interface InteractionTarget extends ASTNode {
  kind: 'interactionTarget'
  entityType?: string  // Optional specific entity type
  condition?: Expression  // Filter condition (e.g., voxel_type in [...])
}

/**
 * Interaction definition - defines player-entity interactions.
 *
 * Example:
 *   interaction switch_use
 *     target: entity where voxel_type in [SWITCH, SWITCH_BUTTON]
 *     range: 2.0
 *     prompt: "Press [E] to use {name}"
 *
 *     on_interact:
 *       if $target.status == FAULT:
 *         emit "sparks" at $target.position
 *         play_sound "switch_broken"
 *       else:
 *         toggle $target.state
 *         play_sound "switch_click"
 */
export interface InteractionDef extends ASTNode {
  kind: 'interaction'
  name: string
  target?: InteractionTarget
  range?: Expression  // Interaction range in meters
  prompt?: Expression  // Prompt text template
  promptBroken?: Expression  // Prompt when target is broken/fault
  onInteract?: Statement[]  // Statements to execute on interaction
  properties?: Record<string, Expression>  // Additional properties
}

// ============================================================================
// Game Definition (entry point for game content)
// ============================================================================

/**
 * Player configuration within a game definition.
 */
export interface PlayerConfig extends ASTNode {
  kind: 'playerConfig'
  controller?: string  // first_person, third_person, fixed_camera
  spawnRoom?: string
  spawnPosition?: Vec3
  collision?: {
    type: 'cylinder' | 'box' | 'none'
    params: Record<string, Expression>
  }
}

/**
 * Game definition - entry point that defines what to load and how to start.
 *
 * Example:
 *   game galley_escape
 *     ship: "galley"
 *     layout: "ships/galley/galley.layout.json"
 *     scenario: "galley_escape"
 *
 *     player:
 *       controller: first_person
 *       spawn_room: "galley"
 *       spawn_position: [0, 0.1, 0]
 *
 *     on_start:
 *       start_scenario "galley_escape"
 *       play_ambient "ship_hum"
 */
export interface GameDef extends ASTNode {
  kind: 'game'
  name: string
  ship?: string
  layout?: string
  scenario?: string
  player?: PlayerConfig
  onStart?: Statement[]
  onVictory?: Statement[]
  onGameover?: Statement[]
  properties?: Record<string, Expression>
}

// ============================================================================
// Module (file)
// ============================================================================

export type TopLevelDef =
  | AssetDef
  | LayoutDef
  | EntityDef
  | MachineDef
  | ConfigDef
  | FunctionDef
  | RuleDef
  | ScenarioDef
  | BehaviorDef
  | ConditionDef
  | GameDef
  | InteractionDef

export interface ForgeModule extends ASTNode {
  kind: 'module'
  definitions: TopLevelDef[]
}
