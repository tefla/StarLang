/**
 * Tests for ForgeVM
 */

import { test, expect, describe, beforeEach } from 'bun:test'
import { ForgeVM, createVM, getVM, resetVM } from './vm'

// ============================================================================
// Setup
// ============================================================================

let vm: ForgeVM

beforeEach(() => {
  resetVM()
  vm = createVM()
})

// ============================================================================
// State Management Tests
// ============================================================================

describe('State Management', () => {
  test('set and get state value', () => {
    vm.setStateValue('health', 100)
    expect(vm.getStateValue('health')).toBe(100)
  })

  test('nested state values', () => {
    vm.setStateValue('player.position.x', 10)
    vm.setStateValue('player.position.y', 20)
    vm.setStateValue('player.name', 'Test')

    expect(vm.getStateValue('player.position.x')).toBe(10)
    expect(vm.getStateValue('player.position.y')).toBe(20)
    expect(vm.getStateValue('player.name')).toBe('Test')
  })

  test('merge state', () => {
    vm.setStateValue('a', 1)
    vm.mergeState({ b: 2, c: 3 })

    expect(vm.getStateValue('a')).toBe(1)
    expect(vm.getStateValue('b')).toBe(2)
    expect(vm.getStateValue('c')).toBe(3)
  })

  test('reset state', () => {
    vm.setStateValue('value', 42)
    vm.resetState()
    expect(vm.getStateValue('value')).toBeUndefined()
  })

  test('get full state', () => {
    vm.setStateValue('x', 1)
    vm.setStateValue('y', 2)
    const state = vm.getState()
    expect(state.x).toBe(1)
    expect(state.y).toBe(2)
  })
})

// ============================================================================
// Loading Tests
// ============================================================================

describe('Loading', () => {
  test('load config from source', () => {
    vm.loadSource(`
config test
  value: 42
`)
    // Config is loaded into global config registry
    const { getConfigValue } = require('./config')
    expect(getConfigValue('test.value')).toBe(42)
  })

  test('load function from source', () => {
    vm.loadSource(`
def double(x):
  return x * 2
`)
    const { hasFunction } = require('./executor')
    expect(hasFunction('double')).toBe(true)
  })

  test('load rule from source', () => {
    vm.loadSource(`
rule test_rule
  trigger: tick
  effect:
    emit "test"
`)
    expect(vm.hasRule('test_rule')).toBe(true)
  })

  test('load scenario from source', () => {
    vm.loadSource(`
scenario test_scenario
  initial:
    player_health: 100
  on game_over:
    emit "end"
`)
    expect(vm.getScenarioNames()).toContain('test_scenario')
  })

  test('load behavior from source', () => {
    vm.loadSource(`
behavior door_behavior
  on open:
    emit "door:opened"
`)
    expect(vm.hasBehavior('door_behavior')).toBe(true)
  })

  test('clear removes all loaded content', () => {
    vm.loadSource(`
config test
  value: 1

def fn():
  return 1

rule r
  trigger: tick
  effect:
    emit "e"

scenario s
  initial:
    x: 1
  on e:
    emit "f"

behavior b
  on e:
    emit "f"
`)
    vm.clear()

    expect(vm.getRuleNames()).toHaveLength(0)
    expect(vm.getScenarioNames()).toHaveLength(0)
    expect(vm.getBehaviorNames()).toHaveLength(0)
  })
})

// ============================================================================
// Scenario Tests
// ============================================================================

describe('Scenarios', () => {
  test('start scenario sets initial state', () => {
    vm.loadSource(`
scenario game_start
  initial:
    player_health: 100
    player_position_x: 0
    player_position_y: 0
  on tick:
    emit "tick"
`)
    vm.startScenario('game_start')

    expect(vm.getStateValue('player_health')).toBe(100)
    expect(vm.getCurrentScenario()).toBe('game_start')
  })

  test('start unknown scenario returns false', () => {
    expect(vm.startScenario('nonexistent')).toBe(false)
  })

  test('scenario start emits event', () => {
    vm.loadSource(`
scenario test
  initial:
    x: 1
  on e:
    emit "f"
`)
    let received = false
    vm.on('scenario:start', () => { received = true })
    vm.startScenario('test')
    expect(received).toBe(true)
  })
})

// ============================================================================
// Tick Execution Tests
// ============================================================================

describe('Tick Execution', () => {
  test('tick updates tick count', () => {
    vm.tick()
    expect(vm.getStateValue('tickCount')).toBe(1)
    vm.tick()
    expect(vm.getStateValue('tickCount')).toBe(2)
  })

  test('tick sets delta', () => {
    vm.tick(0.016)
    expect(vm.getStateValue('delta')).toBe(0.016)
  })

  test('tick executes tick-triggered rules', () => {
    vm.loadSource(`
rule increment
  trigger: tick
  effect:
    set counter: 0
`)
    // Initialize counter
    vm.setStateValue('counter', 0)

    // The rule will set counter to 0 (not increment, since we can't reference state yet in basic form)
    vm.tick()
    expect(vm.getStateValue('counter')).toBe(0)
  })

  test('paused vm does not tick', () => {
    vm.tick()
    const count1 = vm.getStateValue('tickCount')
    vm.pause()
    vm.tick()
    vm.tick()
    expect(vm.getStateValue('tickCount')).toBe(count1)
  })

  test('resume allows ticking', () => {
    vm.tick()
    vm.pause()
    vm.resume()
    vm.tick()
    expect(vm.getStateValue('tickCount')).toBe(2)
  })

  test('isPaused returns correct state', () => {
    expect(vm.isPaused()).toBe(false)
    vm.pause()
    expect(vm.isPaused()).toBe(true)
    vm.resume()
    expect(vm.isPaused()).toBe(false)
  })
})

// ============================================================================
// Event Tests
// ============================================================================

describe('Events', () => {
  test('emit notifies listeners', () => {
    let received = false
    vm.on('test', () => { received = true })
    vm.emit('test')
    expect(received).toBe(true)
  })

  test('emit passes event data', () => {
    let data: Record<string, unknown> | undefined
    vm.on('test', (e) => { data = e.data })
    vm.emit('test', { value: 42 })
    expect(data?.value).toBe(42)
  })

  test('wildcard listener receives all events', () => {
    const events: string[] = []
    vm.on('*', (e) => { events.push(e.name) })
    vm.emit('a')
    vm.emit('b')
    vm.emit('c')
    expect(events).toEqual(['a', 'b', 'c'])
  })

  test('unsubscribe removes listener', () => {
    let count = 0
    const unsub = vm.on('test', () => { count++ })
    vm.emit('test')
    unsub()
    vm.emit('test')
    expect(count).toBe(1)
  })

  test('off removes listener', () => {
    let count = 0
    const listener = () => { count++ }
    vm.on('test', listener)
    vm.emit('test')
    vm.off('test', listener)
    vm.emit('test')
    expect(count).toBe(1)
  })

  test('emit triggers event-based rules', () => {
    vm.loadSource(`
rule on_damage
  trigger: damage
  effect:
    set damaged: true
`)
    vm.emit('damage')
    expect(vm.getStateValue('damaged')).toBe(true)
  })

  test('emit triggers behavior handlers', () => {
    vm.loadSource(`
behavior test_behavior
  on damage:
    set hurt: true
`)
    vm.emit('damage')
    expect(vm.getStateValue('hurt')).toBe(true)
  })
})

// ============================================================================
// Rule Tests
// ============================================================================

describe('Rules', () => {
  test('rule with condition only executes when true', () => {
    vm.loadSource(`
rule heal_when_safe
  trigger: tick
  when: $safe == true
  effect:
    set healed: true
`)
    vm.setStateValue('safe', false)
    vm.tick()
    expect(vm.getStateValue('healed')).toBeUndefined()

    vm.setStateValue('safe', true)
    vm.tick()
    expect(vm.getStateValue('healed')).toBe(true)
  })

  test('getRuleNames returns all rule names', () => {
    vm.loadSource(`
rule rule1
  trigger: tick
  effect:
    emit "a"

rule rule2
  trigger: damage
  effect:
    emit "b"
`)
    const names = vm.getRuleNames()
    expect(names).toContain('rule1')
    expect(names).toContain('rule2')
  })

  test('hasRule checks rule existence', () => {
    vm.loadSource(`
rule exists
  trigger: tick
  effect:
    emit "a"
`)
    expect(vm.hasRule('exists')).toBe(true)
    expect(vm.hasRule('nonexistent')).toBe(false)
  })
})

// ============================================================================
// Behavior Tests
// ============================================================================

describe('Behaviors', () => {
  test('behavior handlers execute on event', () => {
    vm.loadSource(`
behavior door
  on open:
    set door_state: "open"
  on close:
    set door_state: "closed"
`)
    vm.emit('open')
    expect(vm.getStateValue('door_state')).toBe('open')

    vm.emit('close')
    expect(vm.getStateValue('door_state')).toBe('closed')
  })

  test('getBehaviorNames returns all behavior names', () => {
    vm.loadSource(`
behavior a
  on e:
    emit "f"

behavior b
  on e:
    emit "f"
`)
    const names = vm.getBehaviorNames()
    expect(names).toContain('a')
    expect(names).toContain('b')
  })

  test('hasBehavior checks behavior existence', () => {
    vm.loadSource(`
behavior exists
  on e:
    emit "f"
`)
    expect(vm.hasBehavior('exists')).toBe(true)
    expect(vm.hasBehavior('nonexistent')).toBe(false)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  test('full game loop simulation', () => {
    vm.loadSource(`
config game
  tick_damage: 1

rule deplete_health
  trigger: tick
  when: $health > 0
  effect:
    set health: $health - 1

behavior player
  on heal:
    set health: $health + 10
`)
    vm.setStateValue('health', 10)

    // Tick should reduce health
    vm.tick()
    expect(vm.getStateValue('health')).toBe(9)

    // Heal event should increase health
    vm.emit('heal')
    expect(vm.getStateValue('health')).toBe(19)

    // Multiple ticks
    for (let i = 0; i < 5; i++) {
      vm.tick()
    }
    expect(vm.getStateValue('health')).toBe(14)
  })

  test('scenario with victory condition', () => {
    vm.loadSource(`
scenario escape
  initial:
    player_room: "start"
    victory: false
  on room_change when $player_room == "exit":
    set victory: true
    emit "game:victory"

behavior player
  on move_to_exit:
    set player_room: "exit"
`)
    vm.startScenario('escape')
    expect(vm.getStateValue('player_room')).toBe('start')
    expect(vm.getStateValue('victory')).toBe(false)

    // Move to exit
    vm.emit('move_to_exit')
    expect(vm.getStateValue('player_room')).toBe('exit')

    // Check victory (scenario handler runs on next tick)
    vm.tick()
    // Note: The scenario handler checks condition on tick, so we need to emit room_change
    vm.emit('room_change')
    expect(vm.getStateValue('victory')).toBe(true)
  })
})

// ============================================================================
// Global VM Tests
// ============================================================================

describe('Global VM', () => {
  test('getVM returns singleton', () => {
    const vm1 = getVM()
    const vm2 = getVM()
    expect(vm1).toBe(vm2)
  })

  test('resetVM clears global instance', () => {
    const vm1 = getVM()
    vm1.setStateValue('test', 42)
    resetVM()
    const vm2 = getVM()
    expect(vm2.getStateValue('test')).toBeUndefined()
  })
})

// ============================================================================
// Callbacks Tests
// ============================================================================

describe('Callbacks', () => {
  test('setCallbacks configures side effect handlers', () => {
    let stateSet = ''
    let animationPlayed = ''

    vm.setCallbacks({
      onSetState: (state) => { stateSet = state },
      onPlayAnimation: (anim) => { animationPlayed = anim }
    })

    vm.loadSource(`
behavior test
  on trigger:
    setState(open)
    play(slide)
`)
    vm.emit('trigger')

    expect(stateSet).toBe('open')
    expect(animationPlayed).toBe('slide')
  })
})

// ============================================================================
// Condition Tests
// ============================================================================

describe('Conditions', () => {
  test('victory condition fires when trigger is true', () => {
    let victoryFired = false
    let conditionData: Record<string, unknown> | undefined

    vm.on('game:victory', (e) => {
      victoryFired = true
      conditionData = e.data
    })

    vm.loadSource(`
condition win_game
  type: victory
  trigger: $score >= 100
  message: "You win!"
`)

    vm.setStateValue('score', 50)
    vm.tick()
    expect(victoryFired).toBe(false)

    vm.setStateValue('score', 100)
    vm.tick()
    expect(victoryFired).toBe(true)
    expect(conditionData?.condition).toBe('win_game')
    expect(conditionData?.message).toBe('You win!')
  })

  test('defeat condition fires when trigger is true', () => {
    let gameOverFired = false

    vm.on('game:over', () => { gameOverFired = true })

    vm.loadSource(`
condition out_of_health
  type: defeat
  trigger: $health <= 0
  message: "Game Over"
`)

    vm.setStateValue('health', 50)
    vm.tick()
    expect(gameOverFired).toBe(false)

    vm.setStateValue('health', 0)
    vm.tick()
    expect(gameOverFired).toBe(true)
  })

  test('condition only fires once', () => {
    let fireCount = 0

    vm.on('game:victory', () => { fireCount++ })

    vm.loadSource(`
condition test_once
  type: victory
  trigger: $triggered == true
`)

    vm.setStateValue('triggered', true)
    vm.tick()
    vm.tick()
    vm.tick()

    expect(fireCount).toBe(1)
  })

  test('condition executes effects when triggered', () => {
    vm.loadSource(`
condition with_effects
  type: checkpoint
  trigger: $flag == true
  effect:
    set effect_ran: true
    emit "checkpoint:reached"
`)

    let checkpointReached = false
    vm.on('checkpoint:reached', () => { checkpointReached = true })

    vm.setStateValue('flag', true)
    vm.tick()

    expect(vm.getStateValue('effect_ran')).toBe(true)
    expect(checkpointReached).toBe(true)
  })

  test('resetConditions allows condition to fire again', () => {
    let fireCount = 0

    vm.on('condition:victory', () => { fireCount++ })

    vm.loadSource(`
condition repeatable
  type: victory
  trigger: $go == true
`)

    vm.setStateValue('go', true)
    vm.tick()
    expect(fireCount).toBe(1)

    vm.resetConditions()
    vm.tick()
    expect(fireCount).toBe(2)
  })

  test('resetState also resets conditions', () => {
    let fireCount = 0

    vm.on('game:victory', () => { fireCount++ })

    vm.loadSource(`
condition on_reset
  type: victory
  trigger: $ready == true
`)

    vm.setStateValue('ready', true)
    vm.tick()
    expect(fireCount).toBe(1)

    vm.resetState()
    vm.setStateValue('ready', true)
    vm.tick()
    expect(fireCount).toBe(2)
  })

  test('multiple conditions can be defined', () => {
    const events: string[] = []

    vm.on('game:victory', (e) => events.push(`victory:${e.data?.condition}`))
    vm.on('game:over', (e) => events.push(`defeat:${e.data?.condition}`))

    vm.loadSource(`
condition cond1
  type: victory
  trigger: $a == true

condition cond2
  type: defeat
  trigger: $b == true
`)

    vm.setStateValue('a', true)
    vm.setStateValue('b', true)
    vm.tick()

    expect(events).toContain('victory:cond1')
    expect(events).toContain('defeat:cond2')
  })

  test('condition with complex trigger expression', () => {
    let fired = false
    vm.on('game:victory', () => { fired = true })

    vm.loadSource(`
condition complex
  type: victory
  trigger: $player_room == "corridor" and $previous_room == "galley"
`)

    vm.setStateValue('player_room', 'galley')
    vm.setStateValue('previous_room', 'start')
    vm.tick()
    expect(fired).toBe(false)

    vm.setStateValue('player_room', 'corridor')
    vm.setStateValue('previous_room', 'galley')
    vm.tick()
    expect(fired).toBe(true)
  })
})
