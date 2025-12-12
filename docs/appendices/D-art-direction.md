# Appendix D: Art Direction

## Visual Philosophy

### The Core Feeling

**Functional, not futuristic.** The Meridian isn't a sleek sci-fi starship—it's a working vessel. Think submarine meets hospital meets office building. Everything has a purpose. Nothing is purely decorative.

**Alone, not abandoned.** The ship isn't derelict. Systems are running. Lights are on. The emptiness comes from the absence of people, not decay.

**Information-dense.** Every screen shows data. Every panel has labels. The ship wants to tell you things—if you know how to read them.

---

## Colour Palette

### Primary Colours

| Colour | Hex | Usage |
|--------|-----|-------|
| Deep Navy | `#1a2744` | Backgrounds, headers |
| Soft Blue | `#4a6fa5` | Interactive elements, active states |
| Off-White | `#e8e8e8` | Text on dark backgrounds |
| Warm Grey | `#9ca3af` | Secondary text, borders |

### Status Colours

| Colour | Hex | Meaning |
|--------|-----|---------|
| Soft Green | `#77dd77` | OK, operational |
| Amber | `#ffb347` | Warning, attention needed |
| Coral Red | `#ff6b6b` | Critical, error |
| Slate Grey | `#64748b` | Offline, inaccessible |

### Accent Colours

| Colour | Hex | Usage |
|--------|-----|-------|
| Teal | `#2dd4bf` | Player position, highlights |
| Purple | `#a78bfa` | Version control, history |
| Orange | `#fb923c` | Credentials, permissions |

---

## Typography

### Font Choices

| Context | Font | Weight | Notes |
|---------|------|--------|-------|
| UI Headers | Inter / System Sans | Medium | Clean, professional |
| Body Text | Inter / System Sans | Regular | Readable at small sizes |
| Code | JetBrains Mono / Fira Code | Regular | Monospace, clear glyphs |
| Terminal | JetBrains Mono / Fira Code | Regular | Slight glow effect |

### Text Styling

- **Headers**: 16-20px, medium weight, title case
- **Body**: 14px, regular weight
- **Code**: 13px, monospace
- **Labels**: 12px, uppercase or small caps

---

## Ship View (2D Map)

### Room Representation

Rooms are represented as simplified shapes—rectangles with rounded corners. The map isn't architecturally accurate; it's a functional diagram.

```
┌────────────────┐
│                │  ← Room shape (rounded rect)
│    GALLEY      │  ← Room name (center)
│                │
└───────┬────────┘
        │         ← Door indicator
```

### Visual States

| State | Fill | Border | Icon |
|-------|------|--------|------|
| Normal | Soft blue | Grey | None |
| Player here | Soft blue | Teal (2px) | Player dot |
| Warning | Amber tint | Yellow | ⚠️ |
| Critical | Red tint | Red | ⚠️ pulse |
| Inaccessible | Dark grey | Dark grey | 🔒 |
| Unexplored | Dark, no detail | Dashed | ? |

### Door Indicators

| State | Visual |
|-------|--------|
| Open | Gap in wall, green line |
| Closed | Solid line, grey |
| Locked | Solid line, orange dot |
| Sealed | Solid line, red glow |

### Interactables

Terminals and objects are small icons within rooms:
- 📺 Terminal (interactive)
- 📦 Container (searchable)
- 🔧 Panel (engineering access)

---

## Terminal UI

### Frame Design

Terminals have a consistent frame:

```
╔══════════════════════════════════════╗  ← Double-line border
║  TERMINAL TITLE                      ║  ← Header bar
╠══════════════════════════════════════╣  ← Separator
║                                      ║
║  Content area                        ║
║                                      ║
╠══════════════════════════════════════╣  ← Footer separator
║  [Button] [Button]                   ║  ← Action buttons
╚══════════════════════════════════════╝
```

### Terminal Variants

| Type | Header Color | Border Style |
|------|--------------|--------------|
| Status | Navy | Standard |
| Application | Navy | Standard |
| Command | Navy + green cursor | Standard |
| Engineering | Navy + "ENGINEERING" badge | Highlighted |

### Code Editor

```
╔══════════════════════════════════════════════════════════════╗
║  /deck_4/section_7/galley.sl                    [Modified]   ║
╠══════════════════════════════════════════════════════════════╣
║  1 │ # Galley - Deck 4, Section 7                            ║
║  2 │                                                         ║
║  3 │ room galley {                    ← Syntax highlighting  ║
║  4 │   display_name: "Galley"                                ║
║  5 │   deck: 4                                               ║
╠══════════════════════════════════════════════════════════════╣
║  Line 3 | Col 1                                              ║
╚══════════════════════════════════════════════════════════════╝
```

Syntax highlighting:
- Keywords: Blue
- Strings: Green
- Numbers: Orange
- Comments: Grey
- Errors: Red underline

---

## Header Bar

Always visible, showing vital stats:

```
┌─────────────────────────────────────────────────────────────────┐
│  ████████░░ O2: 82%    ██████████ PWR: 100%    ⏱ 16:42:07     │
└─────────────────────────────────────────────────────────────────┘
```

- Progress bars for resources
- Pulse animation when critical
- Click to expand details

---

## Animation Guidelines

### General Principles

- **Purposeful**: Animation conveys information, not decoration
- **Subtle**: Nothing flashy or distracting
- **Quick**: 150-300ms for most transitions

### Specific Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Door state change | Slide open/close | 200ms |
| Status change | Color fade | 300ms |
| Alert pulse | Slow glow | 2s loop |
| Terminal open | Fade in | 150ms |
| Gauge fill | Smooth ease | 300ms |
| Error shake | Horizontal wiggle | 200ms |

---

## Mood and Atmosphere

### Lighting

The ship is lit by artificial light—slightly cool, even. Emergency lighting (amber) appears in compromised areas. No dramatic shadows; this is a workplace, not a horror game.

### Sound Design Hints

(See Audio Direction for full details)
- Ambient hum of life support
- Distant mechanical sounds
- Terminal beeps and chirps
- No music during gameplay (optional ambient for menus)

### Emotional Beats

| Moment | Visual Treatment |
|--------|------------------|
| Wake up | Slightly overexposed, then normalize |
| Crisis | Red tint on status, pulsing alerts |
| Discovery | Highlight on new information |
| Success | Brief green flash, then normal |
| Revelation | Subtle zoom, slower animations |

---

## Asset List (Jam Scope)

### Required

- [ ] Ship map tileset (rooms, corridors, doors)
- [ ] Terminal frame graphics
- [ ] Status icons (OK, warning, critical)
- [ ] Player indicator
- [ ] Font files (or use system fonts)

### Nice to Have

- [ ] Room detail sprites (furniture, equipment)
- [ ] Character portrait (Riley)
- [ ] Animated terminal cursor
- [ ] Particle effects for atmosphere

### Can Skip

- [ ] Detailed room interiors
- [ ] Character animations
- [ ] Cutscene art
