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

# ============================================
# Ambient Systems - Environmental sound sources
# ============================================

# Pipes - carry air, water, coolant through the ship
pipe galley_water_main {
  display_name: "Water Supply Line"
  location: galley
  material: COPPER
  contents: WATER
  diameter: 2
}

pipe galley_atmo_duct {
  display_name: "Atmosphere Duct"
  location: galley
  material: STEEL
  contents: AIR
  diameter: 6
}

pipe corridor_coolant {
  display_name: "Coolant Line"
  location: corridor
  material: COMPOSITE
  contents: COOLANT
  diameter: 3
}

pipe engineering_main {
  display_name: "Main Coolant Feed"
  location: engineering
  material: STEEL
  contents: COOLANT
  diameter: 8
}

# Vents - air circulation and atmosphere control
vent galley_intake {
  display_name: "Galley Air Intake"
  location: galley
  size: MEDIUM
}

vent galley_exhaust {
  display_name: "Galley Exhaust"
  location: galley
  size: SMALL
}

vent corridor_main_vent {
  display_name: "Corridor Ventilation"
  location: corridor
  size: LARGE
}

vent engineering_vent {
  display_name: "Engineering Vent"
  location: engineering
  size: LARGE
}

# Conduits - power distribution
conduit galley_power {
  display_name: "Galley Power Feed"
  location: galley
  voltage: LOW
}

conduit corridor_lighting {
  display_name: "Corridor Lighting Circuit"
  location: corridor
  voltage: LOW
}

conduit engineering_main_power {
  display_name: "Engineering Main Power"
  location: engineering
  voltage: HIGH
}

# Hull sections - structural elements that creak and groan
hull_section galley_bulkhead {
  display_name: "Galley Bulkhead"
  location: galley
  structural_integrity: 1.0
}

hull_section corridor_hull {
  display_name: "Corridor Hull Panel"
  location: corridor
  structural_integrity: 0.95
}

hull_section engineering_frame {
  display_name: "Engineering Frame"
  location: engineering
  structural_integrity: 0.9
}
`
