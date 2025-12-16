# Forge Language Support

Syntax highlighting for Forge DSL files (`.forge`).

## Installation

### Option 1: Symlink (Recommended for Development)

```bash
# macOS/Linux
ln -s "$(pwd)/.vscode/extensions/forge-lang" ~/.vscode/extensions/forge-lang

# Then restart VS Code
```

### Option 2: Copy Extension

```bash
cp -r .vscode/extensions/forge-lang ~/.vscode/extensions/
```

### Option 3: Install via VSIX

```bash
cd .vscode/extensions/forge-lang
npx vsce package
code --install-extension forge-lang-0.1.0.vsix
```

## Features

- Syntax highlighting for all Forge constructs
- Comment toggling with `#`
- Auto-closing brackets and quotes
- Indent-based folding

## Supported Syntax

### Definition Keywords
`asset`, `entity`, `layout`, `machine`

### Block Keywords
`params`, `geometry`, `parts`, `states`, `animations`, `screen`, `render`, `styles`, `events`, `rooms`, `doors`, `terminals`, `switches`, `assets`

### Types
- Primitives: `int`, `float`, `bool`, `string`, `color`
- Compound: `vec2`, `vec3`, `range`, `list`, `enum`, `ref`
- Voxel types: `HULL`, `FLOOR`, `DOOR_PANEL`, `LED_GREEN`, etc.

### Reactive Expressions
Variables prefixed with `$` are highlighted as reactive references.

### Colors
Hex colors like `#1a2744` are recognized.
