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

### Puzzle 2: The Oxygen Crisis

**Location**: Corridor (after escaping galley)
**Urgency**: High (O2 dropping fast)
**Type**: Configuration (Type 1)

**Setup**: The player enters the corridor. Victory message briefly appears, but then alarms sound. The corridor STATUS terminal shows O2 at 16% and dropping fast. The galley was fine - what's happening here?

**Implementation Details** (Planned):
- Corridor has `AtmoOutlet` node with `target: VOID.external` (venting to space)
- O2 depletion rate calculated from outlet config
- STATUS terminal shows live O2/temp/pressure from runtime state
- Engineering terminal in corridor mounts `env_config.sl`

**Investigation**:
```
═══ Corridor Status ═══

ENVIRONMENTAL STATUS
────────────────────
  O2 Level:    16.2%  ✗ CRITICAL
  Temperature: 21.0°C ✓
  Pressure:    0.94atm ⚠ LOW

────────────────────
System Status: CRITICAL
```

**Discovery**: Player finds engineering terminal, opens `env_config.sl`:

```starlang
# Atmosphere routing - Deck 4
outlet corridor_outlet {
  location: corridor
  target: VOID.external    # ERROR - this is wrong!
  flow_rate: 2.4
}

intake corridor_intake {
  location: corridor
  source: life_support.main
  flow_rate: 1.2
}
```

**Solution Options**:

1. **Basic - Closed loop**: Change `target: corridor_intake`
   - Recycles air, stops venting
   - Side effect: CO2 builds up slowly (becomes a problem later if not properly fixed)

2. **Better - Redirect**: Change `target: cold_storage.intake`
   - Valid target, air flows to cold storage
   - Side effect: Cold storage warms up, food begins to spoil

3. **Best - Restore original**: Use `slvc revert env_config.sl`
   - Requires discovering version control exists
   - Restores proper routing to life support recycler
   - No negative side effects

**Teaching**: This puzzle forces discovery of:
- STATUS terminals show live state that changes
- Configuration files exist separately from main definitions
- Node references (outlets have targets that must point somewhere valid)
- Multiple solutions exist with different tradeoffs
- Actions have consequences beyond the immediate fix

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
