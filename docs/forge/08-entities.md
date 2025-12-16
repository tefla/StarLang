# Forge Entities

Entities define interactive objects with screen displays, input handling, and reactive behavior.

## Entity Structure

```forge
entity entity-name
  params:
    # Configurable parameters

  screen:
    # Display configuration

  styles:
    # Named style definitions

  render:
    # Screen content rendering

  on event:
    # Event handlers
```

## Parameters

```forge
params:
  type: enum(STATUS, ENGINEERING, COMMAND) = STATUS
  display_name: string = "Terminal"
  location: string = "unknown"
  focused: bool = false
  powered: bool = true
```

## Screen Configuration

Define the display properties:

```forge
screen:
  size: (512, 384)         # Width x Height in pixels
  font: "JetBrains Mono"   # Font family
  fontSize: 16             # Font size in pixels
  background: #1a2744      # Background color
  lineHeight: 20           # Line spacing
  padding: 20              # Edge padding
```

## Styles

Define named text styles:

```forge
styles:
  header:
    color: #4a6fa5

  success:
    color: #77dd77

  warning:
    color: #ffb347

  error:
    color: #ff6b6b

  prompt:
    color: #77dd77

  muted:
    color: #9ca3af
```

## Render Block

Define what appears on screen:

### Text Statement

```forge
render:
  text "Static text"
  text "Text with {$variable} substitution"
  text "Centered text" centered
  text ""  # Blank line
```

### Row Statement

Display label-value pairs:

```forge
render:
  row "O2 Level:" "{$location.o2_level}%"
  row "Temperature:" "{$location.temperature}C"
  row "Status:" "{$status}"
```

### Code Statement

Display code blocks:

```forge
render:
  code "{$file_content}"
  code "{$log_output}" lineNumbers
```

### Match in Render

Conditional rendering:

```forge
render:
  match $type:
    STATUS:
      text "=== STATUS TERMINAL ===" centered
      row "O2:" "{$o2}%"
      row "Temp:" "{$temp}C"

    ENGINEERING:
      text "=== ENGINEERING ===" centered
      text "System Status: DEGRADED"
      code "{$code_content}"

    COMMAND:
      text "=== COMMAND ===" centered
      text "> {$input}_"
```

## Event Handlers

```forge
on focus:
  set focused: true
  emit "terminal:focus"

on blur:
  set focused: false

on click when $type == ENGINEERING:
  emit "terminal:open_editor"

on keypress when $focused:
  match $key:
    Escape -> emit "terminal:close"
    Enter -> emit "terminal:submit"
```

## Complete Example

```forge
# Terminal Entity - Interactive screen terminals
entity terminal
  params:
    type: enum(STATUS, ENGINEERING, COMMAND) = STATUS
    display_name: string = "Terminal"
    location: string = "unknown"
    focused: bool = false

  screen:
    size: (512, 384)
    font: "JetBrains Mono"
    fontSize: 16
    background: #1a2744
    lineHeight: 20
    padding: 20

  render:
    match $type:
      STATUS:
        text "=== {$display_name} ===" centered
        text ""
        text "ENVIRONMENTAL STATUS"
        text "--------------------"
        text ""
        row "  O2 Level:" "{$location.o2_level}%"
        row "  Temperature:" "{$location.temperature}C"
        row "  Pressure:" "{$location.pressure}atm"
        text ""
        text "--------------------"
        row "System Status:" "{$status}"

      ENGINEERING:
        text "=== ENGINEERING TERMINAL ===" centered
        text ""
        text "System Status: DEGRADED"
        text "AI Core: OFFLINE"
        text ""
        text "Ship configuration loaded."
        text ""
        text "---------------------------------"

      COMMAND:
        text "=== COMMAND INTERFACE ===" centered
        text "User: Riley Chen (Cook)"
        text ""
        text "> _"

  styles:
    header:
      color: #4a6fa5
    success:
      color: #77dd77
    warning:
      color: #ffb347
    error:
      color: #ff6b6b
    prompt:
      color: #77dd77
    muted:
      color: #9ca3af

  on focus:
    set focused: true
    emit "terminal:focus"

  on blur:
    set focused: false

  on click when $type == ENGINEERING:
    emit "terminal:open_editor"

  on keypress when $focused:
    match $key:
      Escape -> emit "terminal:close"
      Enter -> emit "terminal:submit"
```

## Display Templates

For reusable display layouts, use `display-template`:

```forge
display-template status_terminal
  width: 40
  header: "═══ {location} STATUS ═══"

  rows:
    - label: "O2 LEVEL"
      value: "{o2_level}%"
      color:
        nominal when o2_level >= 50
        warning when o2_level >= 20
        error when o2_level < 20

    - label: "TEMPERATURE"
      value: "{temperature}°C"

    - label: "PRESSURE"
      value: "{pressure} kPa"
```

Templates are rendered by the VM:

```typescript
const rendered = vm.renderDisplayTemplate('status_terminal', {
  location: 'Galley',
  o2_level: 18.5,
  temperature: 22,
  pressure: 101
})

// Result:
// {
//   header: "═══ Galley STATUS ═══",
//   rows: [
//     { label: "O2 LEVEL", value: "18.5%", color: "warning" },
//     { label: "TEMPERATURE", value: "22°C", color: "nominal" },
//     { label: "PRESSURE", value: "101 kPa", color: "nominal" }
//   ]
// }
```

## Entity Rendering

Entities are rendered by `ScreenEntity` in the engine:

```typescript
class ScreenEntity {
  // Creates canvas texture for terminal display
  private createTexture(): THREE.CanvasTexture

  // Renders entity content based on definition
  render(entity: EntityDef, data: Record<string, unknown>): void

  // Updates display when state changes
  update(delta: number): void
}
```
