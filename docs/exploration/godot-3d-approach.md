# Exploration: Godot 3D Approach

This document explores using Godot Engine for a 3D implementation of StarLang, as an alternative to the current 2D canvas-based design.

## Why Consider 3D?

The current design uses a split-screen layout with a 2D top-down ship map. A 3D approach could offer:

### Immersion Benefits

1. **Physical Presence** - Walking through corridors, seeing the scale of the ship, creates a stronger sense of being Riley Chen alone on the Meridian
2. **Environmental Storytelling** - 3D spaces can show more detail: personal effects, damage, the emptiness of crew areas
3. **Spatial Puzzles** - Some puzzles could involve physically locating terminals, finding alternate routes through damaged sections
4. **Atmosphere** - Lighting, fog, the hum of machinery—3D excels at creating mood

### Alignment with Game Design

The game's core theme is isolation and discovery. A first-person 3D view of empty corridors, sealed doors, and flickering terminals reinforces this better than an abstract map.

---

## Godot 4 Capabilities

### 3D Rendering

Godot 4 introduced a modern Vulkan-based renderer with:

- **Forward+ and Mobile renderers** - Forward+ for high-end, Mobile/Compatibility for broader support
- **Volumetric fog** - Perfect for atmospheric spaceship interiors
- **Global illumination** - SDFGI and VoxelGI for realistic lighting
- **SSAO/SSIL** - Ambient occlusion and indirect lighting
- **Lightmaps** - Baked lighting for static scenes (performance-friendly)

For StarLang's "functional workplace" aesthetic, even moderate 3D quality would enhance the experience.

### Web Export (HTML5)

Godot 4 can export to web via WebAssembly:

**Capabilities:**
- Full 3D rendering via WebGL 2.0
- Exports to `.html`, `.wasm`, `.pck` files
- Can be hosted on any static web server
- itch.io compatible

**Limitations:**
- Must use **Compatibility** renderer (not Forward+/Vulkan)
- Single-threaded execution (Godot 4.3+ improved this significantly)
- No GDExtension support in web builds
- Larger file sizes than native (but acceptable for a jam game)
- Audio may have quirks on some browsers

**Recommendation:** Web export is viable for StarLang. The Compatibility renderer handles spaceship interiors well, and recent Godot 4.3+ releases have addressed major web export issues.

### Relevant Demos

The [Abandoned Spaceship Godot 4 Demo](https://perfoon.itch.io/abandoned-spaceship-godot-4-demo) demonstrates:
- Spaceship interior environments
- Lightmaps for baked lighting
- Volumetric fog
- Runs well in browser

---

## Architecture Options

### Option A: Pure GDScript

Build everything in Godot using GDScript.

**Pros:**
- Native Godot experience, best documentation
- Full web export support
- Fastest iteration with hot reload

**Cons:**
- Must reimplement StarLang parser in GDScript
- No TypeScript/JavaScript ecosystem
- Different language from potential future web-only version

**Parser Implementation:**
```gdscript
# starlang_parser.gd
class_name StarLangParser

func parse(source: String) -> Dictionary:
    var lexer = StarLangLexer.new()
    var tokens = lexer.tokenize(source)
    var ast = _parse_declarations(tokens)
    return ast

func _parse_declarations(tokens: Array) -> Array:
    # Recursive descent parser
    pass
```

### Option B: GodotJS (TypeScript/JavaScript)

Use [GodotJS](https://github.com/godotjs/GodotJS) to write game logic in TypeScript.

**Pros:**
- Use TypeScript for the parser (familiar, excellent tooling)
- Could potentially share parser code with a web-only version
- Type safety and modern JS features

**Cons:**
- Still maturing (core functionality works but under testing)
- Web export uses browser JS, so behavior may differ from V8 in editor
- Additional complexity layer
- Smaller community for troubleshooting

**Implementation:**
```typescript
// starlang_parser.ts
export class StarLangParser {
  parse(source: string): ShipDefinition {
    const lexer = new StarLangLexer(source);
    const tokens = lexer.tokenize();
    return this.parseDeclarations(tokens);
  }
}

// Exposed to Godot nodes
export function parseShipFile(path: string): ShipDefinition {
  const content = FileAccess.open(path, FileAccess.READ).get_as_text();
  return new StarLangParser().parse(content);
}
```

### Option C: Hybrid Approach

- **Godot** for 3D rendering, player movement, UI
- **External runtime** (Bun/TypeScript) for StarLang parsing and ship state
- Communication via WebSocket or file system

**Pros:**
- Full TypeScript ecosystem for complex parser logic
- Could run ship simulation headless for testing
- Clear separation of concerns

**Cons:**
- Complex architecture for a jam game
- Two processes to manage
- Web export becomes problematic

**Recommendation:** For jam scope, **Option A (Pure GDScript)** is most practical. For a post-jam extended version, Option B could be explored.

---

## 3D Perspective Options

### First-Person View

Player sees through Riley's eyes, walking through the ship.

**Pros:**
- Maximum immersion
- Standard FPS controls (WASD + mouse)
- Personal connection to the character

**Cons:**
- Harder to show "the whole picture" of a system
- Navigation can be disorienting in complex spaces
- More art assets needed (every wall, ceiling, floor)

### Third-Person / Over-Shoulder

Camera follows behind Riley.

**Pros:**
- See your character (more personal)
- Better spatial awareness
- Slightly easier to navigate

**Cons:**
- More animation work (character model needs to move believably)
- Camera collision issues in tight corridors

### Isometric 3D

3D environment viewed from a fixed high angle.

**Pros:**
- Keeps the "overview" feeling of the 2D design
- Easier to show system connections visually
- Less art required (no ceilings, simpler walls)
- Familiar from games like Disco Elysium, Baldur's Gate 3

**Cons:**
- Less immersive than first-person
- Might feel like "3D for 3D's sake"

**Recommendation:** **First-Person** aligns best with the isolation theme and "Riley alone on the ship" narrative. Consider a key to toggle to a 2D deck map overlay for navigation.

---

## UI Integration in 3D

The current design has a split-screen: terminal panel + ship map. In 3D, this changes.

### Diegetic Terminals

Terminals exist as 3D objects in the world. Player approaches and interacts.

```
                    ┌─────────────────────┐
                    │  TERMINAL SCREEN    │
                    │  (3D object with    │
                    │   2D UI rendered)   │
                    │                     │
                    └─────────────────────┘
                           ↑
                        Riley
```

**Implementation:**
1. Terminal mesh with a `SubViewport` rendering the 2D terminal UI
2. Player interacts → camera focuses on terminal
3. ESC to step back

### HUD Elements

Some UI stays as a HUD overlay:

- **O2/Power meters** - Top of screen (always visible)
- **Context prompts** - "Press E to access terminal"
- **Mini-map** - Optional corner overlay showing nearby rooms

### Code Editor Approach

Two options:

**A) Full-Screen Overlay**
When editing code, a full-screen semi-transparent code editor appears. World visible but dimmed behind.

**B) In-World Screen**
Code editing happens on the terminal's screen. Player can look around while editing (adds tension but harder UX).

**Recommendation:** Full-screen overlay for code editing. The game's core loop involves significant code reading/writing—comfort matters.

---

## Simplified 3D Scope for Jam

A full 3D spaceship is ambitious. For jam scope:

### Minimal Viable 3D

- **5-8 rooms** across 2 deck segments
- **Modular corridor kit** - Reusable pieces (straight, corner, T-junction)
- **Simple room layouts** - Galley, Crew Mess, Cold Storage, Corridors
- **Low-poly aesthetic** - Matches "functional, not futuristic" art direction
- **Baked lighting** - No dynamic shadows needed

### Asset Approach

1. Use free/CC0 sci-fi assets as placeholder
2. Modular pieces snap together on grid
3. Focus on terminal props (most interactive element)

### Example Room: Galley

```
┌────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░ ┌────┐                        ┌────┐ ░░ │
│ ░░ │SINK│    ┌──────────────┐    │OVEN│ ░░ │
│ ░░ └────┘    │   COUNTER    │    └────┘ ░░ │
│ ░░           └──────────────┘           ░░ │
│ ░░      ┌───────┐     ┌───────┐        ░░ │
│ ░░      │ TABLE │     │ TABLE │        ░░ │
│ ░░      └───────┘     └───────┘        ░░ │
│ ░░                                      ░░ │
│ ░░  [TERMINAL]                [DOOR→]  ░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────────┘
```

---

## Pros and Cons Summary

### 3D Godot Approach

| Pros | Cons |
|------|------|
| Deeper immersion | More development time |
| Better atmosphere | More assets needed |
| Web export works | Parser must be in GDScript |
| Cross-platform | Learning curve if new to Godot |
| Free and open source | Web builds have limitations |
| Great documentation | 3D scope creep risk |

### 2D Canvas Approach (Current Plan)

| Pros | Cons |
|------|------|
| Faster to implement | Less immersive |
| Bun/TypeScript ecosystem | Abstract representation |
| Simpler art requirements | Doesn't leverage spatial storytelling |
| Full web compatibility | — |
| Matches jam timeline | — |

---

## Recommendation

**For the LangJam deadline:** Stick with the 2D approach. It's faster to implement and the game's core (the language) works regardless of presentation.

**For post-jam or extended development:** A 3D Godot version is compelling. The first-person exploration of an empty ship, physically finding terminals, adds significant emotional weight to Riley's journey.

### If Pursuing 3D

1. Start with a **GDScript prototype** of basic movement + one room
2. Get web export working early (test on itch.io)
3. Use **modular, low-poly assets**
4. Implement StarLang parser in GDScript (can port from TypeScript design)
5. Build terminals as SubViewport + 2D UI

---

## Next Steps (If Exploring Further)

1. [ ] Create Godot 4 project with Compatibility renderer
2. [ ] Build test scene: one corridor + galley room
3. [ ] Implement first-person controller (CharacterBody3D)
4. [ ] Add interactive terminal with SubViewport UI
5. [ ] Test web export to itch.io
6. [ ] Port basic StarLang lexer to GDScript as proof-of-concept

---

## Resources

- [Godot Web Export Documentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- [Abandoned Spaceship Godot 4 Demo](https://perfoon.itch.io/abandoned-spaceship-godot-4-demo) - Example of spaceship interiors
- [GodotJS](https://github.com/godotjs/GodotJS) - TypeScript/JavaScript support for Godot
- [Your First 3D Game (GDQuest)](https://www.gdquest.com/tutorial/godot/3d/first-3d-game-godot-4/) - Beginner 3D tutorial
- [Arcade-style Spaceship Recipe](https://kidscancode.org/godot_recipes/4.x/3d/spaceship/index.html) - Spaceship movement mechanics
