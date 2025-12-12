// Galley Section - StarLang ship definition
// Position/size data is in galley.layout.ts (hidden from player)

export const GALLEY_SHIP = `
# Ship Configuration - Deck 4, Section 7

room galley {
  display_name: "Galley"
  deck: 4
  section: 7
  adjacent: [corridor]
}

room corridor {
  display_name: "Corridor 4-A"
  deck: 4
  section: 7
  adjacent: [galley, engineering]
}

room engineering {
  display_name: "Engineering Bay"
  deck: 4
  section: 8
  adjacent: [corridor]
}

door galley_exit {
  display_name: "Galley Exit"
  connects: [galley, corridor]
  control: door_switch
}

door engineering_door {
  display_name: "Engineering Access"
  connects: [corridor, engineering]
  control: engineering_switch
}

switch door_switch {
  display_name: "Door Control"
  location: galley
}

switch light_switch {
  display_name: "Light Switch"
  location: galley
}

switch engineering_switch {
  display_name: "Engineering Door"
  location: corridor
}

terminal galley_status {
  display_name: "Galley Status"
  terminal_type: STATUS
  location: galley
}

terminal galley_engineering {
  display_name: "Engineering Terminal"
  terminal_type: ENGINEERING
  location: galley
  mounted_files: ["galley.sl"]
}

terminal corridor_status {
  display_name: "Corridor Status"
  terminal_type: STATUS
  location: corridor
}
`
