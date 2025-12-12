// Galley Section - Physical Layout Data
// This data is NOT visible to the player - they only see/edit StarLang

import type { ShipLayout } from '../../types/layout'

export const GALLEY_LAYOUT: ShipLayout = {
  rooms: {
    galley: {
      position: { x: 0, y: 0, z: 0 },
      size: { width: 6, height: 3, depth: 6 }
    },
    corridor: {
      // Left edge at x=3 (connects with galley right edge)
      position: { x: 7, y: 0, z: 0 },
      size: { width: 8, height: 3, depth: 6 }  // Match galley depth for wall alignment
    },
    engineering: {
      // Left edge at x=11 (connects with corridor right edge)
      position: { x: 15, y: 0, z: 0 },
      size: { width: 8, height: 3, depth: 8 }
    }
  },

  doors: {
    galley_exit: {
      // At shared wall between galley and corridor (x=3)
      position: { x: 3, y: 0, z: 0 },
      rotation: 90
    },
    engineering_door: {
      // At shared wall between corridor and engineering (x=11)
      position: { x: 11, y: 0, z: 0 },
      rotation: 90
    }
  },

  terminals: {
    galley_status: {
      position: { x: -2.8, y: 0, z: 0 },
      rotation: 90
    },
    galley_engineering: {
      position: { x: 1.5, y: 0, z: -2 },
      rotation: 180
    },
    corridor_status: {
      position: { x: 7, y: 0, z: 1.5 },
      rotation: 180
    }
  },

  switches: {
    door_switch: {
      // On right wall near door - but broken
      position: { x: 2.85, y: 0, z: -1 },
      rotation: 270,  // Face into galley (toward -X)
      status: 'FAULT'
    },
    light_switch: {
      // On back wall - working, player can rewire door to this
      position: { x: 1, y: 0, z: -2.85 },
      rotation: 0,  // Face into galley (toward +Z)
      status: 'OK'
    },
    engineering_switch: {
      // In corridor on right wall
      position: { x: 10.85, y: 0, z: 1 },
      rotation: 270,  // Face into corridor (toward -X)
      status: 'OK'
    }
  }
}
