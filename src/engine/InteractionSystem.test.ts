/**
 * Tests for InteractionSystem
 */

import { test, expect, describe, beforeEach } from 'bun:test'
import * as THREE from 'three'
import { InteractionSystem, InteractableEntity, InteractionTarget } from './InteractionSystem'
import { createVM, ForgeVM } from '../forge/vm'

let vm: ForgeVM
let system: InteractionSystem

beforeEach(() => {
  vm = createVM()

  // Load test interactions
  vm.loadSource(`
interaction switch_use
  target: switch
  range: 2.0
  prompt: "Press [E] to use {name}"
  prompt_broken: "{name} is broken"

  on_interact:
    emit "switch:toggle"
    set last_interaction: "switch"

interaction terminal_use
  target: terminal
  range: 1.5
  prompt: "Press [E] to access {name}"

  on_interact:
    emit "terminal:access"
    set last_interaction: "terminal"

interaction any_interactable
  target: entity where interactable == true
  prompt: "Inspect {name}"

  on_interact:
    emit "entity:inspect"
`)

  system = new InteractionSystem(vm, {
    interactionRange: 3.0,
    interactionKey: 'KeyE'
  })
})

describe('InteractionSystem', () => {
  test('creates system with default options', () => {
    const sys = new InteractionSystem(vm)
    expect(sys).toBeDefined()
    expect(sys.getCurrentTarget()).toBeNull()
    expect(sys.getCurrentInteraction()).toBeNull()
  })

  test('creates system with custom options', () => {
    const sys = new InteractionSystem(vm, {
      interactionRange: 5.0,
      interactionKey: 'KeyF'
    })
    expect(sys).toBeDefined()
  })

  test('extractEntityData from object userData', () => {
    const obj = new THREE.Mesh()
    obj.userData = {
      type: 'switch',
      id: 'test_switch',
      name: 'Test Switch',
      status: 'OK'
    }

    const intersection: THREE.Intersection = {
      distance: 1.5,
      point: new THREE.Vector3(1, 2, 3),
      object: obj,
      face: null,
      faceIndex: 0,
      uv: undefined,
      uv1: undefined,
      normal: undefined,
      instanceId: undefined
    }

    // Access private method via type assertion
    const target = (system as any).extractEntityData(intersection)
    expect(target).toBeDefined()
    expect(target.entity.type).toBe('switch')
    expect(target.entity.id).toBe('test_switch')
    expect(target.entity.name).toBe('Test Switch')
  })

  test('extractEntityData traverses parent chain', () => {
    const parent = new THREE.Group()
    parent.userData = {
      type: 'terminal',
      id: 'terminal_1'
    }

    const child = new THREE.Mesh()
    parent.add(child)

    const intersection: THREE.Intersection = {
      distance: 1.0,
      point: new THREE.Vector3(0, 0, 0),
      object: child,
      face: null,
      faceIndex: 0,
      uv: undefined,
      uv1: undefined,
      normal: undefined,
      instanceId: undefined
    }

    const target = (system as any).extractEntityData(intersection)
    expect(target).toBeDefined()
    expect(target.entity.type).toBe('terminal')
    expect(target.entity.id).toBe('terminal_1')
  })

  test('update finds interactable target', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = { type: 'switch', id: 'sw1', name: 'Switch 1' }
    obj.position.set(0, 0, -2)
    obj.updateMatrixWorld()  // Required for raycasting

    const origin = new THREE.Vector3(0, 0, 0)
    const direction = new THREE.Vector3(0, 0, -1)

    system.update(origin, direction, [obj])

    const target = system.getCurrentTarget()
    expect(target).toBeDefined()
    expect(target!.entity.id).toBe('sw1')
  })

  test('update clears target when no intersection', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = { type: 'switch', id: 'sw1' }
    obj.position.set(0, 0, -2)
    obj.updateMatrixWorld()  // Required for raycasting

    const origin = new THREE.Vector3(0, 0, 0)
    const direction = new THREE.Vector3(0, 0, -1)

    // First update finds target
    system.update(origin, direction, [obj])
    expect(system.getCurrentTarget()).toBeDefined()

    // Second update looks away - should clear target
    const awayDirection = new THREE.Vector3(1, 0, 0)
    system.update(origin, awayDirection, [obj])
    expect(system.getCurrentTarget()).toBeNull()
  })

  test('finds matching interaction from Forge', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = { type: 'switch', id: 'sw1', name: 'Test Switch' }
    obj.position.set(0, 0, -2)
    obj.updateMatrixWorld()  // Required for raycasting

    const origin = new THREE.Vector3(0, 0, 0)
    const direction = new THREE.Vector3(0, 0, -1)

    system.update(origin, direction, [obj])

    const interaction = system.getCurrentInteraction()
    expect(interaction).toBeDefined()
    expect(interaction!.name).toBe('switch_use')
  })

  test('executeInteraction runs Forge handler', () => {
    let interactionExecuted = false
    vm.on('switch:toggle', () => { interactionExecuted = true })

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = { type: 'switch', id: 'sw1', name: 'Switch' }
    obj.position.set(0, 0, -2)
    obj.updateMatrixWorld()  // Required for raycasting

    const origin = new THREE.Vector3(0, 0, 0)
    const direction = new THREE.Vector3(0, 0, -1)

    system.update(origin, direction, [obj])

    // Simulate E key press
    ;(system as any).executeInteraction()

    expect(interactionExecuted).toBe(true)
    expect(vm.getStateValue('last_interaction')).toBe('switch')
  })

  test('callback fires on target change', () => {
    let targetChanged = false
    let lastTarget: InteractionTarget | null = null

    const sys = new InteractionSystem(vm, {
      callbacks: {
        onTargetChanged: (target) => {
          targetChanged = true
          lastTarget = target
        }
      }
    })

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = { type: 'switch', id: 'sw1' }
    obj.position.set(0, 0, -2)
    obj.updateMatrixWorld()  // Required for raycasting

    const origin = new THREE.Vector3(0, 0, 0)
    const direction = new THREE.Vector3(0, 0, -1)

    sys.update(origin, direction, [obj])

    expect(targetChanged).toBe(true)
    expect(lastTarget).toBeDefined()
    expect(lastTarget!.entity.id).toBe('sw1')
  })

  test('callback fires on interact', () => {
    let interacted = false
    let interactionName = ''
    let targetEntity: InteractableEntity | null = null

    const sys = new InteractionSystem(vm, {
      callbacks: {
        onInteract: (name, entity) => {
          interacted = true
          interactionName = name
          targetEntity = entity
        }
      }
    })

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = { type: 'terminal', id: 't1', name: 'Terminal 1' }
    obj.position.set(0, 0, -1)
    obj.updateMatrixWorld()  // Required for raycasting

    sys.update(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), [obj])
    ;(sys as any).executeInteraction()

    expect(interacted).toBe(true)
    expect(interactionName).toBe('terminal_use')
    expect(targetEntity!.id).toBe('t1')
  })

  test('setInteractionRange updates range', () => {
    system.setInteractionRange(5.0)
    expect((system as any).interactionRange).toBe(5.0)
  })

  test('respects interaction range', () => {
    system.setInteractionRange(2.0)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = { type: 'switch', id: 'sw1' }
    obj.position.set(0, 0, -5)  // Beyond range

    const origin = new THREE.Vector3(0, 0, 0)
    const direction = new THREE.Vector3(0, 0, -1)

    system.update(origin, direction, [obj])

    // Should not find target because it's too far
    expect(system.getCurrentTarget()).toBeNull()
  })

  test('matches interaction by condition', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.userData = {
      type: 'custom',
      id: 'obj1',
      name: 'Custom Object',
      interactable: true
    }
    obj.position.set(0, 0, -1)
    obj.updateMatrixWorld()  // Required for raycasting

    system.update(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), [obj])

    const interaction = system.getCurrentInteraction()
    expect(interaction).toBeDefined()
    expect(interaction!.name).toBe('any_interactable')
  })
})
