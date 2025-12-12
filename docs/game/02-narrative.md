# Narrative Design

## The Setup

### The Ship: UTS Meridian

A mid-size colony transport vessel carrying 847 passengers and 62 crew to the Tau Ceti system. Journey time: 14 years. Most of that time, everyone is in stasis—but for the first three weeks after departure and the last three weeks before arrival, crew and passengers are awake for orientation, adjustment, and preparation.

The ship is three weeks out from Earth. Everyone should be awake. Instead, everyone is in stasis except you.

### The Character: Riley Chen

A cook. Not the head chef—one of three assistants responsible for crew meals during the waking periods. No technical background. No special training. No reason to be awake right now.

Riley was in stasis with everyone else. The emergency systems woke exactly one person: the lowest-priority crew member it could find who was still medically viable. The systems needed a human to respond to a situation outside automated parameters. They got a cook.

### The Situation

The ship has suffered significant damage. The exact nature isn't immediately clear, but the effects are:

- Most of the ship is sealed off (emergency protocols)
- Stasis pods are inaccessible (damaged sections, locked doors)
- Life support is compromised (not failing, but degraded)
- The bridge is unreachable
- Communications are offline
- The ship is still traveling toward Tau Ceti on autopilot

Riley can't wake anyone else. Can't call for help. Can't access the critical systems. All they can do is work with what they have: the galley, a few adjacent rooms, and a terminal that knows they're "just a cook."

---

## The Mystery

### What Happened?

This is the central question. The player uncovers the answer gradually through:

- **Version control logs**: Who changed what, and when?
- **Personal terminals**: Messages, notes, unsent communications
- **System logs**: Automated records of failures and responses
- **Configuration changes**: What was deliberately altered vs. what broke?

### The Layers

**Layer 1: The Accident** (Easy to uncover)

A cascade failure in the primary life support system triggered emergency protocols. The ship sealed itself, put everyone in stasis, and woke someone to assess the situation. This much is in the automated logs.

**Layer 2: The Cause** (Medium difficulty)

The cascade started with a disabled safety interlock. Chief Engineer Okafor turned it off for "maintenance" and never turned it back on. Was it an accident? Negligence?

**Layer 3: The Truth** (Deep investigation)

The interlock wasn't forgotten—it was deliberately left off. Okafor discovered something in the ship's core systems: dormant code that shouldn't be there. Code with timestamps from before the ship was built. Code that responds to signals it shouldn't be receiving.

Okafor was trying to isolate and study it when the ship... reacted.

**Layer 4: The Implication** (Optional/Ending dependent)

The Meridian isn't just a colony ship. Someone—Earth government? The corporation? Another entity?—buried something in its systems. Something that's been listening. Something that decided the investigation needed to stop.

The player can choose what to do with this knowledge. Wake the crew and expose it? Purge it and say nothing? Leave it alone and hope it stays dormant?

---

## Character Notes

### Riley Chen (Player Character)

- **Background**: Culinary school, short-order cooking, got the ship job for adventure, not ambition
- **Personality**: Practical, adaptable, a little anxious but steady under pressure
- **Voice**: Internal monologue is wry, self-deprecating, occasionally profane
- **Arc**: From "I'm just a cook, I can't do this" to "I'm just a cook, and I did this"

The player never sees Riley—this is first-person perspective. Riley's personality comes through in:

- How they react to discoveries (text comments)
- Notes they leave themselves
- Choices the player makes on their behalf

### Chief Engineer Amara Okafor (Absent but central)

- **Background**: 20 years in fleet engineering, published papers, respected expert
- **Personality**: Meticulous, paranoid about safety (ironic), kept detailed logs
- **Role**: The person who found the anomaly and tried to handle it alone
- **Discovery**: Through her logs, commit messages, and personal notes

### Other Crew (Background)

The player finds traces of other crew members—terminal sessions, personal effects, messages—but never interacts with them directly. They're all in stasis, inaccessible.

- **Captain Torres**: Disciplined, formal, by-the-book. Last logs show concern about Okafor's behaviour
- **Dr. Yusuf**: Ship's physician. Medical logs show Okafor requested anti-anxiety medication
- **Chen Wei**: Another cook (no relation). Left a half-written message to family on a terminal

---

## Environmental Storytelling

The narrative is delivered through discoverable content, not cutscenes or dialogue.

### Version Control as Story

```
> slvc log /deck_2/engineering/reactor.sl

[9f8e7d6] 2287.203.14:21:03 - SYSTEM (automatic)
    Emergency SCRAM initiated

[8a7b6c5] 2287.203.14:20:47 - Okafor, A. (Chief Engineer)
    [CORRUPTED]

[7d6e5f4] 2287.203.14:19:22 - Okafor, A. (Chief Engineer)
    Disabled safety interlock 7 (maintenance override)

[6c5d4e3] 2287.203.09:45:11 - Okafor, A. (Chief Engineer)
    Added monitoring hook to signal_intercept module

[5b4c3d2] 2287.200.22:30:55 - Okafor, A. (Chief Engineer)
    Investigating anomalous signal pattern - DO NOT MERGE
```

Each entry is a breadcrumb. The player who reads carefully sees the story: Okafor found something, started investigating, got paranoid, made a mistake, and then... something happened in that corrupted commit.

### Personal Terminals

```
TERMINAL: Okafor, A. - Personal
LAST SESSION: 2287.203.14:18:44 (3 minutes before incident)

> UNSENT MESSAGE TO: Torres, M. (Captain)

Captain,

I need to speak with you urgently. Not on official channels.
I've found something in the navigation subsystem that doesn't
belong there. It's not a bug. It's not a feature. It's

[MESSAGE ABANDONED]
```

### Environmental Details

- A coffee cup, cold, still sitting by a terminal
- A family photo on a bunk (Chen Wei's)
- Emergency lighting that's been on for hours
- Frost on a window where atmosphere is leaking
- A child's drawing stuck to a wall in crew quarters

---

## Themes

### Competence and Identity

"I'm just a cook" becomes "I'm the cook who saved the ship." The game is about discovering capability you didn't know you had. Not through power fantasy but through problem-solving under pressure.

### Isolation and Connection

Riley is alone, but surrounded by evidence of other lives. The people in stasis are both absent and present. The goal is to reach them, wake them, reconnect.

### Systems and Trust

The ship is a system built by people who thought they understood it. They were wrong. What else do we build that we don't fully understand? (Resonates with programming themes—complex systems have emergent behaviour.)

### Discovery and Responsibility

Finding the truth creates obligations. What do you do with dangerous knowledge? Who do you tell? Do you have the right to decide?

---

## Endings (Sketch)

### The Safe Ending

Fix enough systems to stabilize life support. Wake the crew through normal channels. Report what you found. Let others handle it.

### The Hero Ending

Find and neutralize the anomalous code. Wake the crew. They'll never know how close they came.

### The Whistleblower Ending

Transmit everything you found—logs, code, evidence—back to Earth before doing anything else. Whatever happens next, the truth is out.

### The Uncertain Ending

Leave the anomaly alone. It went dormant after the incident. Maybe it was defending itself. Maybe it was protecting something. You don't understand it well enough to act. Wake the crew and say nothing.

---

## Narrative Pacing

| Game Phase | Narrative Focus |
|------------|-----------------|
| Opening | Survival, immediate crisis, no bandwidth for mystery |
| Early game | First hints something is wrong beyond "accident" |
| Mid game | Okafor's investigation becomes clear, questions multiply |
| Late game | The truth about the anomaly, moral choices emerge |
| Ending | Player decides what to do with knowledge |

The mystery should never overshadow survival. The player investigates because they *want* to, not because the game forces them. Completing the game without uncovering the full mystery is valid—but less satisfying.
