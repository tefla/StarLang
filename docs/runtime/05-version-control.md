# Version Control (slvc)

## Overview

StarLang includes a built-in version control system called **slvc** (StarLang Version Control). It serves two purposes:

1. **Gameplay**: Let players view history, revert mistakes, and understand what changed
2. **Narrative**: Embed story elements in commit messages and history

slvc is intentionally simpler than Git. No branches, no merging, no remotes. Just linear history with commits.

---

## Core Concepts

### Commits

A commit is a snapshot of a file at a point in time.

```
Commit {
  hash: string          // Short unique identifier (7 chars)
  file: string          // Which file
  timestamp: timestamp  // Ship time
  author: string        // Who made the change
  credential: string    // What permission level
  message: string       // Description
  content: string       // Full file content at this point
  parent: string | null // Previous commit hash
}
```

### The Log

Each file has a linear history of commits:

```
file: /deck_4/section_7/galley.sl

  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ 5b4c3d2 │────▶│ 6c5d4e3 │────▶│ 7d6e5f4 │ ─ ─ ─ ▶ (current)
  └─────────┘     └─────────┘     └─────────┘
   Initial         Chen, M.        SYSTEM
   install         maintenance     emergency
```

### Working Copy

The "working copy" is the current content of the file. When the player edits, they modify the working copy. When they save, a new commit is created.

---

## Commands

### slvc log

View commit history for a file.

```
> slvc log /deck_4/section_7/galley.sl

[7d6e5f4] 2287.203.14:22:58 - SYSTEM (automatic)
    Emergency atmosphere reroute
    
[6c5d4e3] 2287.156.09:15:33 - Chen, M. (Engineer)
    Increased scrubber capacity for extended shift
    
[5b4c3d2] 2287.098.11:00:00 - SYSTEM (initial)
    Initial configuration - galley systems
```

**Options:**
- `--limit N` - Show only N most recent commits
- `--since DATE` - Show commits after date
- `--author NAME` - Filter by author
- `--search TEXT` - Search commit messages

### slvc show

View the content of a specific commit.

```
> slvc show 6c5d4e3

commit 6c5d4e3
Author: Chen, M. (Engineer)
Date: 2287.156.09:15:33
Message: Increased scrubber capacity for extended shift

--- Content ---
# Galley - Deck 4, Section 7
...
scrubber galley_scrubber {
  capacity: 100%       # <-- This was 80% before
  ...
}
```

### slvc diff

Compare two commits, or a commit to working copy.

```
> slvc diff 6c5d4e3 7d6e5f4

--- 6c5d4e3 (Chen, M. - 2287.156.09:15:33)
+++ 7d6e5f4 (SYSTEM - 2287.203.14:22:58)

@@ -12,7 +12,7 @@
 node galley_outlet : AtmoOutlet {
-  target: atmo.deck4_return
+  target: VOID.external    # ERROR: Invalid target
   flow_rate: 2.4
 }
```

```
> slvc diff 7d6e5f4

--- 7d6e5f4 (SYSTEM - 2287.203.14:22:58)
+++ working copy

@@ -12,7 +12,7 @@
 node galley_outlet : AtmoOutlet {
-  target: VOID.external    # ERROR: Invalid target
+  target: galley_intake
   flow_rate: 2.4
 }
```

### slvc revert

Revert a file to a previous commit's content.

```
> slvc revert /deck_4/section_7/galley.sl 6c5d4e3

WARNING: This will create a new commit reverting to the state
at commit 6c5d4e3 (Chen, M. - 2287.156.09:15:33).

The underlying conditions that triggered subsequent changes
may still exist. The system may re-apply automatic changes.

Proceed? [y/N] y

Created commit 8f9e0a1: Reverted to 6c5d4e3
Recompiling... done.

NOTE: Atmospheric routing conflict detected. SYSTEM may
re-apply emergency routing if underlying fault persists.
```

### slvc blame

Show who last modified each line.

```
> slvc blame /deck_4/section_7/galley.sl

5b4c3d2 (SYSTEM      2287.098) | # Galley - Deck 4, Section 7
5b4c3d2 (SYSTEM      2287.098) | 
5b4c3d2 (SYSTEM      2287.098) | room galley {
5b4c3d2 (SYSTEM      2287.098) |   display_name: "Galley"
...
7d6e5f4 (SYSTEM      2287.203) |   target: VOID.external    # <-- Emergency change
6c5d4e3 (Chen, M.    2287.156) |   flow_rate: 2.4
```

---

## Automatic Commits

The ship makes automatic commits when:

1. **Emergency responses**: System-triggered changes get committed
2. **Player saves**: Manual saves create commits
3. **Initial state**: Ship configuration at journey start

Automatic commits have `SYSTEM (automatic)` as the author.

---

## Narrative Through History

The commit history tells a story. When the player investigates, they find:

### Normal Operations

```
[6c5d4e3] 2287.156.09:15:33 - Chen, M. (Engineer)
    Increased scrubber capacity for extended shift

[4a3b2c1] 2287.142.16:20:00 - Chen, M. (Engineer)
    Fixed temperature calibration, was reading 2C high

[3f2e1d0] 2287.089.08:45:22 - Torres, J. (Operations)
    Updated meal schedule for new crew rotation
```

### The Days Before

```
[8a7b6c5] 2287.203.14:20:47 - Okafor, A. (Chief Engineer)
    [CORRUPTED]

[7d6e5f4] 2287.203.14:19:22 - Okafor, A. (Chief Engineer)
    Disabled safety interlock 7 (maintenance override)
    
[6c5d4e3] 2287.203.09:45:11 - Okafor, A. (Chief Engineer)
    Added monitoring hook to signal_intercept module
```

### Suspicious Patterns

The player might notice:

- Okafor made many commits in the hours before the incident
- Some commit messages are cryptic or corrupted
- Safety interlocks were disabled "for maintenance" but never re-enabled
- There are references to "anomalous signals" in comments

---

## Permission-Gated History

Some logs require elevated permissions to view.

```
> slvc log /deck_2/engineering/reactor.sl

ACCESS DENIED

Required: credential(ENGINEERING) OR HIGHER
You have: credential(COOK)

Some commits in this file's history contain information
classified above your access level.
```

When the player gains ENGINEERING credentials:

```
> slvc log /deck_2/engineering/reactor.sl

[9f8e7d6] 2287.203.14:21:03 - SYSTEM (automatic)
    Emergency SCRAM initiated
    
[8a7b6c5] 2287.203.14:20:47 - Okafor, A. (Chief Engineer)
    ╔══════════════════════════════════════════════════╗
    ║ COMMIT MESSAGE CORRUPTED                         ║
    ║ Data integrity failure at block 0x7F3A          ║
    ║ Partial recovery: "...found it. It's been here  ║
    ║ since before we launched. It's not..."          ║
    ╚══════════════════════════════════════════════════╝
    
[7d6e5f4] 2287.203.14:19:22 - Okafor, A. (Chief Engineer)
    Disabled safety interlock 7 - need to isolate subsystem
    for detailed analysis. Will re-enable after diagnostic.
```

---

## Implementation

### Data Storage

Commits are stored in a simple structure:

```
CommitStore {
  commits: Map<string, Commit>           // hash → commit
  fileHeads: Map<string, string>         // file → current commit hash
  
  getCommit(hash: string): Commit
  getHistory(file: string): Commit[]
  createCommit(file: string, content: string, message: string): Commit
  getFileAtCommit(file: string, hash: string): string
}
```

### Hash Generation

Hashes are generated from content (simplified):

```
function generateHash(content: string, timestamp: number): string {
  const data = content + timestamp.toString()
  const hash = simpleHash(data)
  return hash.substring(0, 7)  // Short hash
}
```

### Revert Mechanics

Revert creates a NEW commit with old content:

```
function revert(file: string, targetHash: string): Commit {
  // Get content at target commit
  const oldContent = commitStore.getFileAtCommit(file, targetHash)
  
  // Create new commit with that content
  const newCommit = commitStore.createCommit(
    file,
    oldContent,
    `Reverted to ${targetHash}`
  )
  
  // Trigger recompile
  runtime.recompile(file, oldContent)
  
  return newCommit
}
```

---

## Edge Cases

### Reverting Doesn't Fix Everything

If the player reverts the galley config to before the incident, the physical cause of the problem (ruptured atmosphere line) is still there. The system may immediately re-apply emergency changes.

```
> slvc revert galley.sl 6c5d4e3

Reverted to 6c5d4e3.
Recompiling...

WARNING: Atmosphere fault detected in deck4_return line.
SYSTEM is re-applying emergency routing.

New commit created: 9a8b7c6
  "SYSTEM (automatic): Emergency atmosphere reroute"
```

The player learns: code isn't magic. Physical problems need physical solutions (or workarounds in code that acknowledge the physical reality).

### Corrupted History

Some commits have corrupted messages or content—narrative effect of the incident.

```
> slvc show 8a7b6c5

commit 8a7b6c5
Author: Okafor, A. (Chief Engineer)
Date: 2287.203.14:20:47
Message: [DATA CORRUPTION - 73% recovered]
         "...found it. It's been here since before we..."
         [BLOCK UNREADABLE]
         "...not what we thought. The signals are..."
         [END OF RECOVERABLE DATA]

--- Content ---
[PARTIAL CONTENT ONLY - 847 of 2341 bytes recovered]

# Reactor core monitoring
# Emergency overrides

@permissions {
  [CORRUPTED]
}

safety_interlock interlock_7 {
  [CORRUPTED - 12 lines]
}

# Okafor note: The pattern repeats every 4.7 hours.
# It's responding to something. Or someone.
```

---

## UI Integration

The terminal displays version control information:

```
╔══════════════════════════════════════════════════════════════╗
║  FILE: /deck_4/section_7/galley.sl                           ║
║  Last commit: 7d6e5f4 (SYSTEM - 2287.203.14:22:58)           ║
║  Status: MODIFIED (unsaved changes)                          ║
╠══════════════════════════════════════════════════════════════╣
║   1 │ # Galley - Deck 4, Section 7                           ║
║   2 │ ...                                                    ║
...
╠══════════════════════════════════════════════════════════════╣
║  [Save] [Compile] [Revert] [History] [Blame]                 ║
╚══════════════════════════════════════════════════════════════╝
```

Clicking [History] opens the log view. Clicking [Blame] shows per-line attribution.
