# Terminal Types

## Overview

Terminals are the player's interface to ship systems. Different terminal types offer different capabilities, from simple status displays to full code editors. The variety of terminals creates natural progression gates and varied gameplay.

---

## Terminal Type Summary

| Type | Shows | Editable | Found In |
|------|-------|----------|----------|
| STATUS | Live sensor data | No | Corridors, public areas |
| APPLICATION | Purpose-built GUIs | GUI controls only | Work areas |
| COMMAND | Text interface for queries | Commands only | Various |
| ENGINEERING | Code editor | Full .sl files | Engineering areas |

---

## Status Terminals

### Purpose

Read-only displays showing live data. The player can observe but not control.

### Example

```
╔══════════════════════════════════════╗
║  ENVIRONMENTAL MONITOR - CORRIDOR 4A ║
╠══════════════════════════════════════╣
║                                      ║
║  Temperature    21.8°C    ✓          ║
║  Humidity       44%       ✓          ║
║  O2 Level       20.9%     ✓          ║
║  CO2 Level      0.04%     ✓          ║
║  Pressure       1.01 atm  ✓          ║
║                                      ║
║  Last updated: 16:42:15              ║
║                                      ║
╚══════════════════════════════════════╝
```

### Definition

```starlang
terminal corridor_4a_status {
  location: corridor_4a
  type: STATUS
  power_source: power.corridor_4
  
  access: credential(CREW) OR HIGHER
  
  displays: [
    sensor.temp_corridor_4a,
    sensor.humidity_corridor_4a,
    sensor.o2_corridor_4a,
    sensor.co2_corridor_4a,
    sensor.pressure_corridor_4a
  ]
  
  refresh_rate: 1Hz
}
```

### Implementation

```typescript
function StatusTerminal({ terminalId }: { terminalId: string }) {
  const def = useDefinition(terminalId)
  const sensorIds = def.properties.displays
  
  return (
    <TerminalFrame title={def.properties.display_name}>
      <div className="status-grid">
        {sensorIds.map(sensorId => (
          <SensorReading key={sensorId} sensorId={sensorId} />
        ))}
      </div>
      <TerminalFooter>
        Last updated: <LiveTime />
      </TerminalFooter>
    </TerminalFrame>
  )
}

function SensorReading({ sensorId }: { sensorId: string }) {
  const reading = useShipState(`${sensorId}.current_reading`)
  const status = useShipState(`${sensorId}.status`)
  const def = useDefinition(sensorId)
  
  return (
    <div className="sensor-reading">
      <span className="label">{def.properties.display_name}</span>
      <span className="value">{formatReading(reading, def.type)}</span>
      <StatusIndicator status={status} />
    </div>
  )
}
```

---

## Application Terminals

### Purpose

GUI applications for specific tasks. The player interacts through controls, not code. Changes write to values that StarLang monitors.

### Example: Food Inventory

```
╔══════════════════════════════════════╗
║  FOOD INVENTORY SYSTEM v2.4.1        ║
╠══════════════════════════════════════╣
║                                      ║
║  COLD STORAGE (-18.2°C)              ║
║  ┌────────────────────────────────┐  ║
║  │ Temperature: -18.2°C   [SET]  │  ║
║  │ Target:      -18.0°C          │  ║
║  └────────────────────────────────┘  ║
║                                      ║
║  INVENTORY                           ║
║  ├─ Protein     124 kg  ████████░░  ║
║  ├─ Vegetables   89 kg  ██████░░░░  ║
║  ├─ Dairy        45 kg  ████░░░░░░  ║
║  └─ Grains      312 kg  ██████████  ║
║                                      ║
║  [Meal Planning]  [Request Restock]  ║
╚══════════════════════════════════════╝
```

### Example: Door Control Panel

```
╔══════════════════════════════════════╗
║  DOOR CONTROL - COLD STORAGE ACCESS  ║
╠══════════════════════════════════════╣
║                                      ║
║  Status: CLOSED                      ║
║  Lock: NONE                          ║
║  Power: OK                           ║
║                                      ║
║  ┌──────────────────────────────┐    ║
║  │         [  OPEN  ]           │    ║
║  └──────────────────────────────┘    ║
║                                      ║
║  Temperature Warning                 ║
║  Cold storage: -18.2°C               ║
║  Opening door will cause temp rise   ║
║                                      ║
╚══════════════════════════════════════╝
```

### Definition

```starlang
terminal galley_inventory {
  location: galley
  type: APPLICATION
  power_source: power.local_4
  
  access: credential(COOK) OR HIGHER
  
  application: "food_inventory"
  
  # What state the application can read
  reads: [
    cold_storage.temperature,
    cold_storage.inventory,
    dry_goods.inventory,
    fresh_goods.inventory
  ]
  
  # What state the application can write
  writes: [
    cold_storage.target_temperature
  ]
}
```

### Implementation

Application terminals render custom components based on `application` property:

```typescript
const APPLICATION_COMPONENTS: Record<string, React.ComponentType<AppProps>> = {
  'food_inventory': FoodInventoryApp,
  'door_control': DoorControlApp,
  'life_support_overview': LifeSupportApp,
  'power_management': PowerManagementApp,
  'crew_roster': CrewRosterApp,
}

function ApplicationTerminal({ terminalId }: { terminalId: string }) {
  const def = useDefinition(terminalId)
  const AppComponent = APPLICATION_COMPONENTS[def.properties.application]
  
  if (!AppComponent) {
    return <UnknownApplicationError app={def.properties.application} />
  }
  
  return (
    <TerminalFrame title={def.properties.display_name}>
      <AppComponent 
        reads={def.properties.reads}
        writes={def.properties.writes}
      />
    </TerminalFrame>
  )
}
```

---

## Command Terminals

### Purpose

Text-based interface for querying ship systems. The player types commands, sees text output. Can run `status`, `slvc`, and other queries.

### Example Session

```
╔══════════════════════════════════════════════════════════════╗
║  COMMAND INTERFACE                                           ║
║  User: Riley Chen (Cook)                                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  > status galley                                             ║
║                                                              ║
║  ROOM: galley                                                ║
║    Temperature: 22.4°C                                       ║
║    O2 Level: 18.2% (LOW)                                     ║
║    Pressure: 0.96 atm                                        ║
║    Doors:                                                    ║
║      galley_to_cold: OPEN                                    ║
║      galley_to_corridor: SEALED                              ║
║                                                              ║
║  > slvc log galley.sl --limit 3                              ║
║                                                              ║
║  [7d6e5f4] 2287.203.14:22:58 - SYSTEM (automatic)            ║
║      Emergency atmosphere reroute                            ║
║  [6c5d4e3] 2287.156.09:15:33 - Chen, M.                      ║
║      Increased scrubber capacity                             ║
║  [5b4c3d2] 2287.098.11:00:00 - SYSTEM (initial)              ║
║      Initial configuration                                   ║
║                                                              ║
║  > _                                                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `status <node>` | Show node state | `status galley` |
| `status <node> --verbose` | Detailed state | `status door_galley_to_cold --verbose` |
| `slvc log <file>` | Version history | `slvc log galley.sl` |
| `slvc diff <hash1> <hash2>` | Compare versions | `slvc diff 6c5d4e3 7d6e5f4` |
| `slvc show <hash>` | Show commit | `slvc show 6c5d4e3` |
| `slvc blame <file>` | Line-by-line attribution | `slvc blame galley.sl` |
| `help` | List commands | `help` |
| `help <command>` | Command help | `help status` |
| `signals` | List active signals | `signals` |
| `trace <signal>` | Trace signal | `trace atmo.critical` |
| `docs <search>` | Search documentation | `docs atmosphere routing` |

### Implementation

```typescript
function CommandTerminal({ terminalId }: { terminalId: string }) {
  const runtime = useRuntime()
  const [history, setHistory] = useState<CommandEntry[]>([])
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const executeCommand = async (command: string) => {
    // Add command to history
    setHistory(h => [...h, { type: 'input', text: `> ${command}` }])
    
    try {
      const result = await runtime.query(command)
      setHistory(h => [...h, { type: 'output', text: result.output }])
    } catch (error) {
      setHistory(h => [...h, { 
        type: 'error', 
        text: `Error: ${error.message}` 
      }])
    }
    
    setInput('')
  }
  
  return (
    <TerminalFrame title="Command Interface" className="command-terminal">
      <div className="output-area">
        {history.map((entry, i) => (
          <div key={i} className={`entry entry--${entry.type}`}>
            {entry.text}
          </div>
        ))}
      </div>
      <div className="input-area">
        <span className="prompt">&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
              executeCommand(input.trim())
            }
          }}
        />
      </div>
    </TerminalFrame>
  )
}
```

---

## Engineering Terminals

### Purpose

Full code editor for viewing and editing StarLang files. This is where the real gameplay happens—reading definitions, understanding systems, making changes.

### Features

- File browser (mounted files)
- Syntax-highlighted code editor
- Error display with line numbers
- Save/compile/revert commands
- Version control integration

### Example

```
╔══════════════════════════════════════════════════════════════╗
║  ENGINEERING WORKSTATION                                     ║
║  User: Chen, M. (Engineer) [Session inherited]               ║
╠══════════════════════════════════════════════════════════════╣
║  Files:                  │ /deck_4/section_7/galley.sl  [M]  ║
║  ├─ galley.sl        [M] │────────────────────────────────── ║
║  ├─ cold_storage.sl      │  1 │ # Galley - Deck 4, Section 7 ║
║  ├─ crew_mess.sl         │  2 │                              ║
║  └─ env_config.sl        │  3 │ room galley {                ║
║                          │  4 │   display_name: "Galley"     ║
║                          │  5 │   deck: 4                    ║
║                          │  6 │   adjacent: [crew_mess, ...]  ║
║                          │  7 │ }                            ║
║                          │  8 │                              ║
║                          │  9 │ node galley_outlet : ...      ║
║                          │ 10 │   target: galley_intake      ║
║                          │ 11 │   flow_rate: 2.4             ║
║                          │ 12 │ }                            ║
╠══════════════════════════════════════════════════════════════╣
║  No errors                                                   ║
╠══════════════════════════════════════════════════════════════╣
║  [Save] [Compile] [Revert] [History] [Help]                  ║
╚══════════════════════════════════════════════════════════════╝
```

### Definition

```starlang
terminal engineering_workstation_4a {
  location: maintenance_junction_4a
  type: ENGINEERING
  power_source: power.junction_4a
  
  access: credential(ENGINEERING) OR HIGHER
  
  # Files accessible from this terminal
  mounted_files: [
    "/deck_4/section_7/galley.sl",
    "/deck_4/section_7/cold_storage.sl",
    "/deck_4/section_7/crew_mess.sl",
    "/deck_4/env_config.sl",
    "/ship/systems/atmo.sl"        # Can view system files
  ]
  
  # Scope for status queries
  visible_scope: deck_4.*
  
  # Scope for editing (more restricted)
  edit_scope: [
    "/deck_4/section_7/*",
    "/deck_4/env_config.sl"
  ]
}
```

### Implementation

```typescript
function EngineeringTerminal({ terminalId }: { terminalId: string }) {
  const runtime = useRuntime()
  const def = useDefinition(terminalId)
  
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [errors, setErrors] = useState<CompileError[]>([])
  
  const isModified = content !== originalContent
  const canEdit = currentFile && isInScope(currentFile, def.properties.edit_scope)
  
  // Load file
  const loadFile = async (path: string) => {
    const result = await runtime.readFile(path)
    setCurrentFile(path)
    setContent(result.content)
    setOriginalContent(result.content)
    setErrors([])
  }
  
  // Save and compile
  const save = async () => {
    if (!currentFile || !canEdit) return
    
    const result = await runtime.recompile(currentFile, content)
    
    if (result.success) {
      setOriginalContent(content)
      setErrors([])
    } else {
      setErrors(result.errors)
    }
  }
  
  // Revert to last saved
  const revert = () => {
    setContent(originalContent)
    setErrors([])
  }
  
  return (
    <TerminalFrame title="Engineering Workstation" className="engineering-terminal">
      <div className="terminal-split">
        <FileList
          files={def.properties.mounted_files}
          currentFile={currentFile}
          modifiedFiles={isModified ? [currentFile] : []}
          onSelect={loadFile}
        />
        
        <div className="editor-area">
          <div className="editor-header">
            {currentFile}
            {isModified && <span className="modified-indicator">[Modified]</span>}
          </div>
          
          <CodeEditor
            value={content}
            onChange={canEdit ? setContent : undefined}
            readOnly={!canEdit}
            errors={errors}
            language="starlang"
          />
          
          {errors.length > 0 && (
            <div className="error-panel">
              {errors.map((err, i) => (
                <div key={i} className="error-line">
                  Line {err.line}: {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <TerminalFooter>
        <Button onClick={save} disabled={!isModified || !canEdit}>Save</Button>
        <Button onClick={revert} disabled={!isModified}>Revert</Button>
        <Button onClick={() => showHistory(currentFile)}>History</Button>
        <Button onClick={showHelp}>Help</Button>
      </TerminalFooter>
    </TerminalFrame>
  )
}
```

---

## Terminal Discovery

Players find terminals through exploration. Terminal locations are defined in room definitions:

```starlang
room maintenance_junction_4a {
  display_name: "Maintenance Junction 4-A"
  deck: 4
  
  # Terminals in this room
  terminals: [
    engineering_workstation_4a,  # Engineering terminal (jackpot!)
    junction_status_panel        # Status display
  ]
}
```

On the ship map, terminals appear as interactable objects. Clicking one opens it in the terminal panel (if the player has access).
