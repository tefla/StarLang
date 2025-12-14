# Puzzle Design

## Puzzle Philosophy

Every puzzle in StarLang follows four core rules:

1. **The solution is in the code**: No pixel-hunting, no arbitrary combinations, no "adventure game logic"
2. **Multiple approaches are valid**: The "intended" solution isn't the only solution
3. **Failure has consequences, not game-overs**: Wrong answers make things harder, not impossible
4. **Puzzles ARE the tutorial**: Never provide explicit tutorials, hints, or instruction overlays

### The Ship Was Correct

**Critical Narrative Principle**: The ship's operating system was delivered correctly by the shipyard. Every StarLang definition was accurate. Every reference pointed to the right system. Every configuration was valid.

Then the incident happened.

The player wakes to find:
- **Physical hardware damaged** - switches broken, junctions offline, conduits ruptured
- **Systems disrupted** - power rerouted incorrectly, atmosphere compromised
- **The ship fighting to survive** - emergency protocols engaged, areas sealed

**Puzzles are workarounds, not bug fixes.** The player isn't fixing bad code—they're adapting working software to route around physical damage. This creates emergent gameplay:

- A broken switch means finding another way to control the door
- A damaged power junction means rerouting to a backup or sharing from another system
- A ruptured conduit means reconfiguring flow paths

The ship has **redundant systems** built in for exactly this scenario. The puzzle is discovering and activating these alternatives.

### Emergent Gameplay Through Redundancy

The ship was designed with backup systems:
- Multiple power junctions per deck
- Backup atmosphere scrubbers
- Alternative routing paths
- Emergency overrides

This means:
- **Multiple valid solutions** exist for each puzzle
- Players can be **creative** in how they work around problems
- The ship feels like a **real, engineered system**
- Later puzzles can involve **combining** or **trading off** between systems

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
| 1 - Broken Switch | Terminals exist, code editing works, software bypasses damaged hardware |
| 2 - Damaged Junction | Redundant systems exist, STATUS shows damage, rerouting to backups |
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
**Type**: Bypass (Type 5) - Hardware damage, software workaround

**Narrative Context**: The door switch was physically damaged during the incident. The StarLang code is correct (`control: door_switch`), but the hardware it references is broken. The player must adapt the software to work around the physical damage.

**Setup**: The player wakes up in the galley. The door to the corridor won't open. The door switch on the wall is marked "FAULT" - pressing it produces sparks but doesn't work.

**Implementation Details** (Current):
- Door switch has `status: "FAULT"` in layout data (physical damage)
- Pressing FAULT switch triggers spark particle effect, no door action
- Engineering terminal in galley mounts `galley.sl`
- Door definition: `door galley_exit { connects: [galley, corridor], control: door_switch }`

**Investigation**:
- Player tries the obvious: press the switch. Sparks fly, nothing happens
- Player notices the engineering terminal across the room
- Approaching it, they see "Press E to use terminal"
- Terminal shows the galley.sl file with the ship configuration

**Discovery**: The door is controlled by `door_switch`, which is physically broken. The player realizes they can edit the code to bypass the damaged hardware.

**Solution Options**:

1. **Remove switch dependency**: Delete or comment out `control: door_switch`
   - Door becomes manually operable (no switch needed)

2. **Reassign to working switch**: Change `control: light_switch`
   - The light switch (which still works) now controls the door

3. **Add direct trigger**: Use an always-true condition or signal
   - More advanced, teaches signals early

**Teaching**: This puzzle forces discovery of:
- Terminals exist and can be interacted with
- Code is visible and editable
- Saving code recompiles and changes the world
- **Software can route around hardware damage**

**Why This Works**:
The code is correct—`door_switch` IS what should control the door. But the physical switch is broken. The player learns that when hardware fails, you adapt the software. This sets up the entire game's puzzle philosophy.

---

### Puzzle 2: The Damaged Junction

**Location**: Corridor (after escaping galley)
**Urgency**: High (dark corridor, O2 dropping)
**Type**: Configuration (Type 1) - Rerouting around physical damage

**Narrative Context**: The corridor's primary power junction (junction_4a) was damaged during the incident. The StarLang code correctly references junction_4a, but that physical hardware is now offline. The player must reroute the corridor to draw from an alternative source.

**Setup**: The player enters the corridor. It's dark—almost pitch black except for the faint glow of the STATUS terminal (which runs on emergency power). The STATUS display shows the primary junction is offline and O2 is dropping.

**The Core Problem**: Physical damage, not bad code. The corridor.sl correctly says `power_source: junction_4a`, but junction_4a is damaged and offline. The ship has backup systems—the player must find and use them.

**File 1: `corridor.sl`** (code is correct, hardware is damaged)
```starlang
room corridor {
  display_name: "Corridor 4A"
  deck: 4

  # These references are CORRECT - but junction_4a is damaged
  power_source: junction_4a      # Hardware offline!
  air_supply: scrubber_4a        # Also damaged!
}

lights corridor_main {
  location: corridor
  power: junction_4a.main        # Can't draw from damaged junction
}
```

**File 2: `ship_systems.sl`** (shows what's available)
```starlang
# Primary systems (DAMAGED)
junction junction_4a {
  location: deck_4
  serves: [galley, corridor, cold_storage]
  # STATUS: OFFLINE (physical damage from incident)
}

scrubber scrubber_4a {
  location: deck_4
  serves: [galley, corridor, cold_storage]
  # STATUS: OFFLINE (physical damage from incident)
}

# Backup systems (OPERATIONAL)
junction junction_4b {
  location: deck_4
  serves: [backup_deck_4]
  # STATUS: STANDBY - available for rerouting
}

scrubber scrubber_4b {
  location: deck_4
  serves: [backup_deck_4]
  # STATUS: STANDBY - available for rerouting
}
```

**STATUS Terminal Shows**:
```
CORRIDOR 4A - SYSTEM STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
POWER:      ■ OFFLINE
  Source:   junction_4a
  Status:   HARDWARE FAULT - physical damage detected

ATMOSPHERE: ■ CRITICAL
  Source:   scrubber_4a
  Status:   HARDWARE FAULT - physical damage detected
  O2:       17.2% (dropping)

BACKUP SYSTEMS AVAILABLE:
  junction_4b: STANDBY
  scrubber_4b: STANDBY
```

**Discovery Flow**:
1. Enter dark corridor, STATUS terminal glows faintly
2. STATUS shows: junction_4a OFFLINE, scrubber_4a OFFLINE
3. Notice: "BACKUP SYSTEMS AVAILABLE: junction_4b, scrubber_4b"
4. Open `corridor.sl` → see it correctly references the damaged systems
5. Open `ship_systems.sl` → find the backup systems
6. Reroute: change references from damaged `_4a` systems to backup `_4b` systems
7. Lights come on, O2 stabilizes

**Solution Options**:

1. **Use backup systems**: Change `junction_4a` → `junction_4b`, `scrubber_4a` → `scrubber_4b`
   - Clean solution using ship's built-in redundancy

2. **Share from galley**: If galley uses a different junction, reroute corridor to share
   - Creative solution, may have power draw consequences

3. **Partial fix**: Fix just power OR just atmosphere first
   - Viable if player is panicking about O2

**Teaching**: This puzzle forces discovery of:
- **Physical damage requires software adaptation**
- The ship has redundant systems for emergencies
- STATUS terminals show what's working and what's not
- Multiple files define the ship's systems
- Rerouting is about changing references, not "fixing bugs"

**Why This Works**:
The code was correct. The hardware broke. The player isn't debugging—they're adapting. This reinforces that StarLang definitions are CORRECT, but the physical world has changed. The ship's designers anticipated failures and built in backups. The player's job is to activate them.

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
| Opening | 1 - Broken Switch | Single workaround | Terminals, editing, bypass damaged hardware |
| Early | 2 - Damaged Junction | Rerouting to backup | Redundant systems, STATUS displays, multi-file |
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
