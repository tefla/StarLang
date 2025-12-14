# Puzzle Design

## Puzzle Philosophy

Every puzzle in StarLang follows four core rules:

1. **The solution is in the code**: No pixel-hunting, no arbitrary combinations, no "adventure game logic"
2. **Multiple approaches are valid**: The "intended" solution isn't the only solution
3. **Failure has consequences, not game-overs**: Wrong answers make things harder, not impossible
4. **Puzzles ARE the tutorial**: Never provide explicit tutorials, hints, or instruction overlays

### Puzzles as Tutorials

**Critical Design Principle**: The game never explains mechanics through tutorials, hint systems, or instructional text. Instead, each puzzle is designed to force discovery of a specific skill through necessity.

The player learns by:
- **Failing first**: Trying the obvious approach (e.g., pressing a broken switch) and having it not work
- **Investigating**: Using STATUS terminals and error messages to understand what's wrong
- **Experimenting**: Making changes and observing consequences
- **Succeeding**: Solving the puzzle and internalizing the mechanic

This approach means:
- No "Press E to interact" tutorials - the player discovers interaction through environmental cues
- No "Edit code to change the world" explanations - Puzzle 1 forces this discovery
- No hint buttons or "stuck?" prompts - the ship's own systems provide breadcrumbs
- No HUD overlays explaining game mechanics - everything is diegetic (in-world)

Each puzzle teaches exactly one or two new concepts. The sequence is carefully designed so skills compound:

| Puzzle | Forces Discovery Of |
|--------|---------------------|
| 1 - Broken Switch | Terminals exist, code editing works, changes affect world |
| 2 - O2 Crisis | STATUS vs config files, node references, tradeoffs |
| 3 - Frozen Door | Systems affect each other, physical vs software state |
| 4 - Permission Block | Permission system, credential inheritance, exploits |
| 5 - Sealed Bridge | Chaining systems, signals, documentation diving |
| 6 - The Anomaly | Moral choice, synthesizing all skills |

---

## Puzzle Taxonomy

### Type 1: Configuration Puzzles

The system is misconfigured. Fix the config.

**Example**: O2 is venting to space because the outlet target is wrong. Change the target to something valid.

**Skills tested**: Reading StarLang, understanding node references, basic editing

### Type 2: Permission Puzzles

You understand the fix but can't make it—you don't have access.

**Example**: The door definition is on an engineering terminal. You're a cook.

**Skills tested**: Understanding the permission system, finding alternative paths, exploiting legacy code

### Type 3: Signal Puzzles

Multiple systems interact. You need to trigger a cascade or break a loop.

**Example**: The door unseals when atmosphere is stable. Atmosphere stabilizes when the scrubber has power. Power routing is locked. But the fire suppression system can seal/unseal doors and has a power override...

**Skills tested**: Tracing signal paths, understanding dependencies, predicting consequences

### Type 4: Information Puzzles

You don't know what to change because you don't understand the system.

**Example**: The documentation says to "reset the phase coupling" but you don't know which node that is or what values to set.

**Skills tested**: Documentation navigation, inference, experimentation

### Type 5: Bypass Puzzles

A control mechanism is broken. Find an alternative path.

**Example**: The door switch is faulty. You can't fix the switch, but you can change what controls the door.

**Skills tested**: Understanding system dependencies, creative problem-solving, code structure

---

## Puzzle Catalogue

### Puzzle 1: The Broken Switch (Opening)

**Location**: Galley
**Urgency**: High (O2 slowly depleting, door is locked)
**Type**: Bypass (Type 5)

**Setup**: The player wakes up in the galley. The door to the corridor won't open. The door switch on the wall is marked "FAULT" - pressing it produces sparks but doesn't work.

**Implementation Details** (Current):
- Door switch has `status: "FAULT"` in layout data
- Pressing FAULT switch triggers spark particle effect, no door action
- Engineering terminal in galley mounts `galley.sl`
- Door definition: `door galley_exit { connects: [galley, corridor], control: door_switch }`

**Investigation**:
- Player tries the obvious: press the switch. Sparks fly, nothing happens
- Player notices the engineering terminal across the room
- Approaching it, they see "Press E to use terminal"
- Terminal shows the galley.sl file with the ship configuration

**Discovery**: The door is controlled by `door_switch`, which is broken. The player realizes they can edit the code.

**Solution Options**:

1. **Remove switch dependency**: Delete or comment out `control: door_switch`
   - Door becomes manually operable

2. **Reassign to working switch**: Change `control: light_switch`
   - Now the light switch opens the door (clever but confusing)

3. **Add direct open**: Add `state: OPEN` or `locked: false` to door definition
   - Door opens immediately on compile

**Teaching**: This puzzle forces discovery of:
- Terminals exist and can be interacted with
- Code is visible and editable
- Saving code recompiles and changes the world
- The connection between code and physical objects

**Why This Works as Tutorial**:
The player's first instinct (press the switch) fails. This creates a problem that demands investigation. The terminal is visible but not explained. When they figure out they can edit code and see the door open, they've learned the core mechanic through experience, not instruction.

---

### Puzzle 2: Wrong Wiring

**Location**: Corridor (after escaping galley)
**Urgency**: High (dark corridor, O2 dropping)
**Type**: Configuration (Type 1) - 2-hop reference chain

**Setup**: The player enters the corridor. It's dark - almost pitch black except for the faint glow of the STATUS terminal (which runs on emergency power). The STATUS display shows O2 is dropping and main power is offline.

**The Core Problem**: The corridor's systems are configured to draw from the wrong sources. Someone (during the incident?) changed the references to point to systems on deck 3 instead of deck 4.

**Key Design Note**: This is a DEFINITION problem, not a STATE problem. The `.sl` files don't contain `enabled: false` - they contain wrong references. A shipyard wouldn't deliver a ship with disabled systems; they'd deliver correctly wired systems. The puzzle is that the wiring (references) got changed.

**File 1: `corridor.sl`**
```starlang
room corridor {
  display_name: "Corridor 4A"
  deck: 4

  # These references are WRONG - pointing to deck 3 systems
  power_source: junction_3b      # ← Should be junction_4a
  air_supply: scrubber_alpha     # ← Should be scrubber_beta
}

lights corridor_main {
  location: corridor
  power: junction_3b.main        # ← Same wrong reference
}
```

**File 2: `ship_systems.sl`** (or player finds via STATUS terminal)
```starlang
# Deck 3 systems
junction junction_3b {
  location: deck_3
  serves: [medbay, science_lab]
}

scrubber scrubber_alpha {
  location: deck_3
  serves: [medbay, science_lab]
}

# Deck 4 systems - THE CORRECT ONES
junction junction_4a {
  location: deck_4
  serves: [galley, corridor, cold_storage]
}

scrubber scrubber_beta {
  location: deck_4
  serves: [galley, corridor, cold_storage]
}
```

**Discovery Flow**:
1. Enter dark corridor, STATUS terminal glows faintly
2. STATUS shows: "Main Power: NO SOURCE" and "O2: CRITICAL - NO SUPPLY"
3. Open `corridor.sl` → see `power_source: junction_3b` and `air_supply: scrubber_alpha`
4. Think: "What junctions exist? Which one is correct?"
5. Find `ship_systems.sl` (mounted on same terminal, or visible in file list)
6. See that `junction_4a` and `scrubber_beta` are for deck 4
7. Fix references: change `junction_3b` → `junction_4a`, `scrubber_alpha` → `scrubber_beta`
8. Lights come on, O2 stabilizes

**Solution**:
Edit `corridor.sl`:
```starlang
room corridor {
  power_source: junction_4a      # Fixed!
  air_supply: scrubber_beta      # Fixed!
}
```

**Why 2-Hop Matters**:
- Hop 1: corridor.sl contains wrong references
- Hop 2: ship_systems.sl reveals what the correct references should be
- Player must cross-reference between files to find the answer

**Teaching**: This puzzle forces discovery of:
- Definitions contain references to other nodes
- References must point to correct/appropriate systems
- You need to look at multiple files to understand the ship
- The ship is a connected system with topology

**What This Does NOT Teach** (saved for later puzzles):
- Version control (slvc) - too early
- Permissions - not blocked yet
- Signals - not needed here

---

### Puzzle 3: The Frozen Door

**Location**: Cold Storage to Medical Bay
**Urgency**: Low (you want access, not survival)
**Type**: Signal (Type 3)

**Setup**: Through a window, you can see a first aid kit in the medical bay. The door mechanism is frozen—ice in the tracks.

**Investigation**:
```
> status door_cold_to_medical

DOOR: door_cold_to_medical
  state: JAMMED
  jam_reason: MECHANICAL (ice obstruction)
  power: OK
  last_opened: 2287.198.11:22:07
```

**Discovery**: The door isn't software-locked, it's physically frozen. But you notice cold storage and the medical corridor share a heating conduit (visible in the definitions or a schematic).

**Solution Options**:

1. **Intended**: Crank cold storage heating demand to max. This pulls heat through the shared conduit, thawing the door. Side effect: your galley gets colder (heat is redistributed)

2. **Clever**: Find the conduit definition and reverse the flow direction, actively pushing heat toward the door

3. **Brute force**: There's a maintenance panel in the corridor that lets you physically cut power to the door, then force it open manually (but then it won't close properly)

**Teaching**: Systems affect each other. Physical state and software state are different. Sometimes the solution isn't in the broken thing but in an adjacent system.

---

### Puzzle 4: The Permission Escalation

**Location**: Maintenance Junction Alpha
**Urgency**: Medium (you need engineering access to proceed)
**Type**: Permission (Type 2)

**Setup**: You found an engineering tablet wedged behind a panel. Dead battery. The charging ports require engineering credentials to activate—you're a cook.

**Investigation**:
```
> status charger_junction_4a

CHARGER: charger_junction_4a
  state: STANDBY
  access: credential(ENGINEER) required
  power_source: power.junction_4a_aux
```

**Discovery**: The charger is on the same power bus as the emergency lighting. Emergency lighting is categorised as "passenger comfort" and you have access to environmental controls.

```starlang
power_bus junction_4a_aux {
  consumers: [
    charger_junction_4a,
    lighting.emergency.junction_4a,  # You can control this
    ...
  ]
}
```

**Solution**:

Create a fake lighting node that draws power from the bus:

```starlang
node fake_light : EmergencyLight {
  location: junction_4a
  power_source: power.junction_4a_aux
  state: ACTIVE
}
```

Wire the tablet to your "light." It's drawing power, just not for lighting.

**Alternative**: Find an engineering terminal that's already logged in somewhere (left open during the incident).

**Teaching**: Permissions aren't perfect. Legacy systems have gaps. Thinking about *how* the permission system works lets you route around it.

---

### Puzzle 5: The Sealed Bridge

**Location**: Deck 1 access
**Urgency**: Late game
**Type**: Signal + Permission (Type 3 + Type 2)

**Setup**: The bridge is sealed behind blast doors. Captain-level access required. You don't have it and can't fake it—the bridge has actual security.

**Investigation**: The blast doors are controlled by a dedicated security system. But they have safety overrides for emergencies.

```starlang
door bridge_blast_door {
  lock: SECURITY_SEAL

  unseal_requires: ANY [
    credential(CAPTAIN),
    credential(SECURITY_OVERRIDE),
    signal(bridge.internal_emergency),
    # Fire, decompression, or medical emergency inside bridge
  ]
}
```

**Problem**: You can't signal an emergency you're not inside.

**Discovery**: Deep in the documentation, you find that the bridge has an atmospheric sensor. And atmospheric sensors report to the central life support monitoring system. And that system has a testing mode that engineering can access...

**Solution**:

1. Use engineering credentials to access life support testing
2. Find the bridge atmospheric sensor in the test harness
3. Inject a simulated "decompression" reading
4. The sensor reports emergency to the security system
5. Blast doors unseal for evacuation

**Complication**: This triggers ship-wide alerts. You have about 60 seconds to get through before automated systems figure out it's a false alarm and reseal.

**Teaching**: Big puzzles require chaining multiple systems. Information from documentation matters. The security system isn't broken—you're exploiting its correct behaviour.

---

### Puzzle 6: The Anomaly

**Location**: Engineering Core
**Urgency**: Endgame
**Type**: Information + Signal (Type 4 + Type 3)

**Setup**: You've found Okafor's research. There's code in the navigation system that shouldn't exist. It's dormant now but it triggered the cascade that nearly killed everyone.

**Investigation**: The anomalous code is hidden in layers of legitimate navigation calculations. It activates in response to specific signal patterns—patterns that look like... searching?

**The Question**: What do you do?

**Option A - Purge**:

Delete the anomalous code. But it's deeply integrated. Removing it might break navigation. You'd need to understand it well enough to excise cleanly.

```
> slvc diff anomaly_code navigation.sl

WARNING: 847 interconnected references
Removing this code may affect: [nav_primary, nav_backup,
  course_correction, stellar_reference, ...]
```

**Option B - Isolate**:

Cut its ability to receive signals. It can't activate if it can't hear.

```starlang
signal_filter navigation_quarantine {
  blocks: [
    signals matching /0x7F3A.*/,  # The patterns Okafor identified
  ]
  applies_to: [navigation.*]
}
```

But you're not sure you've found all the trigger patterns.

**Option C - Communicate**:

Okafor was studying it. Her notes suggest it might be... waiting. Not malicious, just watching. What if you could understand what it wants?

This path requires decoding Okafor's research, finding the signal patterns, and deliberately activating the anomaly in a controlled way.

**Option D - Ignore**:

It's dormant. The crew needs to be woken. This isn't your problem. Let the experts handle it once everyone's safe.

**Teaching**: The final puzzle isn't mechanical—it's moral. The game's language and systems have been teaching you to think about consequences, dependencies, and unintended effects. Now apply that to a choice.

---

## Difficulty Progression

| Phase | Puzzle | Complexity | New Concepts |
|-------|--------|------------|--------------|
| Opening | 1 - Broken Switch | Single change | Terminals, editing, cause-effect |
| Early | 2 - O2 Crisis | Multi-node awareness | Status vs config, references, tradeoffs |
| Early-Mid | 3 - Frozen Door | Cross-system | Physical state, connected systems |
| Mid | 4 - Permission Block | Permission exploitation | Access control, categorization gaps |
| Late | 5 - Sealed Bridge | Multi-system chain | Signals, documentation, timing |
| Final | 6 - Anomaly | Synthesis + choice | Everything combined |

---

## Anti-Tutorial Design

The game actively avoids tutorial patterns:

### What We DON'T Do

- **No modal tutorials**: Never pause the game to explain mechanics
- **No hint buttons**: The player either figures it out or explores until they do
- **No glowing objectives**: Environmental storytelling, not waypoints
- **No "Press X to Y" overlays**: Interaction prompts are minimal and diegetic
- **No difficulty modes**: The puzzle sequence is the difficulty curve
- **No skip options**: Every puzzle teaches something needed later

### What We DO Instead

- **Obvious failure states**: The broken switch sparks. The STATUS terminal shows dropping O2. Problems are visible.
- **Verbose ship systems**: Error messages, status displays, and logs provide breadcrumbs
- **Multiple valid solutions**: If the "intended" path isn't found, creative alternatives work
- **Recoverable mistakes**: Bad edits can be reverted. The ship is resilient.
- **Environmental cues**: Terminals glow. Broken things look broken. Warnings are visible.

### The Learning Loop

Every puzzle follows this pattern:

1. **Encounter obstacle** → Player's path is blocked
2. **Obvious attempt fails** → Pressing the switch sparks, door doesn't open
3. **Investigate** → Player looks around, finds terminal
4. **Discover tool** → Code is editable, saving recompiles
5. **Experiment** → Make a change, see result
6. **Succeed** → Problem solved, skill internalized
7. **New obstacle uses skill** → Next puzzle builds on learned mechanic

The player never needs to be told "you can edit code to change the ship." They discover it because there's no other way forward.
