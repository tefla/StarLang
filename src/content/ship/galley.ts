// First Puzzle: Escape the Galley
// Player wakes up in the galley with a locked door. Must edit the code to unlock it.

export const GALLEY_SHIP = `
# StarLang Ship Definition - Galley Section
# First puzzle: Player must unlock the door to escape

# The galley where the player starts
room galley {
  display_name: "Galley"
  deck: 4
  section: 7
  position: { x: 0, y: 0, z: 0 }
  size: { width: 6, height: 3, depth: 6 }
  adjacent: [corridor]
}

# Corridor outside the galley (escape target)
room corridor {
  display_name: "Corridor 4-A"
  deck: 4
  section: 7
  position: { x: 8, y: 0, z: 0 }
  size: { width: 8, height: 3, depth: 4 }
  adjacent: [galley, engineering]
}

# Engineering bay (future area)
room engineering {
  display_name: "Engineering Bay"
  deck: 4
  section: 8
  position: { x: 18, y: 0, z: 0 }
  size: { width: 8, height: 3, depth: 8 }
  adjacent: [corridor]
}

# The main puzzle: this door is LOCKED
# Player must change 'locked: true' to 'locked: false'
door galley_exit {
  display_name: "Galley Exit"
  connects: [galley, corridor]
  position: { x: 2.8, y: 0, z: 0 }
  rotation: 90
  locked: true
}

# Door from corridor to engineering (unlocked)
door engineering_door {
  display_name: "Engineering Access"
  connects: [corridor, engineering]
  position: { x: 13.1, y: 0, z: 0 }
  rotation: 90
  locked: false
}

# Status terminal in galley (shows O2 levels)
terminal galley_status {
  display_name: "Galley Status"
  terminal_type: STATUS
  location: galley
  position: { x: -2.8, y: 0, z: 0 }
  rotation: 90
}

# Engineering terminal - the key to solving the puzzle
terminal galley_engineering {
  display_name: "Engineering Terminal"
  terminal_type: ENGINEERING
  location: galley
  position: { x: 1.5, y: 0, z: -2 }
  rotation: 180
  mounted_files: ["galley.sl"]
}

# Status terminal in corridor
terminal corridor_status {
  display_name: "Corridor Status"
  terminal_type: STATUS
  location: corridor
  position: { x: 8, y: 0, z: 1.5 }
  rotation: 0
}
`

// Tutorial text displayed on the engineering terminal when the player first uses it
export const TUTORIAL_TEXT = `
════════════════════════════════════════
 EMERGENCY SYSTEMS NOTICE
════════════════════════════════════════

Riley Chen,

You've been woken from cryo early.
Something is wrong with the ship.

The galley door has locked due to
a system malfunction. You'll need to
use this engineering terminal to
override the lock.

Find the door definition in the code:

  door galley_exit {
    ...
    locked: true    <-- Change to false
  }

Press Ctrl+S to save and compile.

Good luck.

- Ship AI (partial function)
`
