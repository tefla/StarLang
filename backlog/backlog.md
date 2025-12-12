# StarLang Backlog

## Minimal Playable Slice

### Core Rendering & UI
- [ ] Basic 2D canvas renderer for ship view
- [ ] Split-screen layout (ship map right, terminal/editor left)
- [ ] Simple room rendering (rectangles with labels)
- [ ] Player character sprite and movement

### StarLang Parser & Runtime
- [ ] Lexer for StarLang syntax
- [ ] Parser for minimal subset (rooms, doors, basic properties)
- [ ] AST representation for parsed code
- [ ] Runtime that builds ship structure from AST
- [ ] State management (separate definition from runtime state)

### Terminal & Editor
- [ ] Code editor component with syntax highlighting
- [ ] File browser to view .sl files
- [ ] Hot-reload: compile on save and update ship
- [ ] Basic error display for parse/compile errors

### Game Logic
- [ ] Door interaction (click to open/close)
- [ ] Door state persistence across recompiles
- [ ] Lock system (doors can have simple locked state)
- [ ] Player movement constraints (can't walk through walls/locked doors)

### First Puzzle
- [ ] Initial ship layout: 2-3 rooms, 1-2 locked doors
- [ ] Player starts in one room with O2 running low
- [ ] Terminal accessible showing door definition
- [ ] Goal: modify door lock condition to escape room
- [ ] Victory condition: reach specific room

### Content
- [ ] Write minimal ship definition (galley.sl, doors.sl)
- [ ] Write tutorial text/hints for first puzzle
- [ ] Create simple O2 display that counts down

## Future Features (Post-MVP)
- [ ] Signals system
- [ ] Sensors and relays
- [ ] Permission system
- [ ] Version control (slvc)
- [ ] Multiple puzzles
- [ ] Narrative integration
- [ ] Audio/polish
