import { test, expect, describe, beforeEach } from 'bun:test'
import { GameRunner, createGameRunnerFromSource } from './GameRunner'

describe('GameRunner', () => {
  let runner: GameRunner

  beforeEach(() => {
    runner = new GameRunner()
  })

  test('loads game definition', () => {
    runner.loadGameSource(`
game test_game
  ship: "test_ship"
  layout: "test.layout.json"
  scenario: "test_scenario"
`)

    expect(runner.getGameNames()).toEqual(['test_game'])
  })

  test('getGame returns game definition', () => {
    runner.loadGameSource(`
game my_game
  ship: "my_ship"
  layout: "my.layout.json"
`)

    const game = runner.getGame('my_game')
    expect(game).toBeDefined()
    expect(game?.name).toBe('my_game')
    expect(game?.ship).toBe('my_ship')
  })

  test('getGame returns undefined for nonexistent game', () => {
    expect(runner.getGame('nonexistent')).toBeUndefined()
  })

  test('getGameConfig returns config with defaults', () => {
    runner.loadGameSource(`
game config_test
  ship: "test_ship"
  layout: "test.layout.json"
  scenario: "test_scenario"
`)

    const config = runner.getGameConfig('config_test')
    expect(config).not.toBeNull()
    expect(config!.name).toBe('config_test')
    expect(config!.ship).toBe('test_ship')
    expect(config!.layout).toBe('test.layout.json')
    expect(config!.scenario).toBe('test_scenario')

    // Check defaults
    expect(config!.player.controller).toBe('first_person')
    expect(config!.player.spawnRoom).toBe('start')
    expect(config!.player.spawnPosition).toEqual({ x: 0, y: 0.1, z: 0 })
    expect(config!.player.collision.type).toBe('cylinder')
    expect(config!.player.collision.height).toBe(1.6)
    expect(config!.player.collision.radius).toBe(0.35)
  })

  test('getGameConfig uses player config from game', () => {
    runner.loadGameSource(`
game player_config_test
  ship: "test"

  player:
    controller: first_person
    spawn_room: "galley"
    spawn_position: (1, 2, 3)
    collision: cylinder { height: 1.8, radius: 0.4 }
`)

    const config = runner.getGameConfig('player_config_test')
    expect(config).not.toBeNull()
    expect(config!.player.controller).toBe('first_person')
    expect(config!.player.spawnRoom).toBe('galley')
    expect(config!.player.spawnPosition).toEqual({ x: 1, y: 2, z: 3 })
    expect(config!.player.collision.type).toBe('cylinder')
    expect(config!.player.collision.height).toBe(1.8)
    expect(config!.player.collision.radius).toBe(0.4)
  })

  test('startGame returns config and sets active game', () => {
    runner.loadGameSource(`
game start_test
  ship: "test"
  layout: "test.layout.json"
  scenario: "test_scenario"
`)

    expect(runner.isGameActive()).toBe(false)

    const config = runner.startGame('start_test')
    expect(config).not.toBeNull()
    expect(config!.name).toBe('start_test')
    expect(runner.isGameActive()).toBe(true)
  })

  test('startGame returns null for nonexistent game', () => {
    const config = runner.startGame('nonexistent')
    expect(config).toBeNull()
    expect(runner.isGameActive()).toBe(false)
  })

  test('lifecycle handlers are called', () => {
    const events: string[] = []

    runner.loadGameSource(`
game lifecycle_test
  ship: "test"

  on start:
    emit "test:started"

  on victory:
    emit "test:victory"

  on gameover:
    emit "test:gameover"
`)

    runner.setHandlers({
      onStart: () => events.push('start'),
      onVictory: () => events.push('victory'),
      onGameover: () => events.push('gameover'),
    })

    runner.startGame('lifecycle_test')
    expect(events).toContain('start')

    runner.triggerVictory()
    expect(events).toContain('victory')

    runner.triggerGameover()
    expect(events).toContain('gameover')
  })

  test('getActiveGameConfig returns null when no game active', () => {
    expect(runner.getActiveGameConfig()).toBeNull()
  })

  test('getActiveGameConfig returns config when game active', () => {
    runner.loadGameSource(`
game active_test
  ship: "test"
  layout: "test.layout.json"
`)

    runner.startGame('active_test')
    const config = runner.getActiveGameConfig()
    expect(config).not.toBeNull()
    expect(config!.name).toBe('active_test')
  })

  test('stopGame clears active game', () => {
    runner.loadGameSource(`
game stop_test
  ship: "test"
`)

    runner.startGame('stop_test')
    expect(runner.isGameActive()).toBe(true)

    runner.stopGame()
    expect(runner.isGameActive()).toBe(false)
  })

  test('clear removes all games', () => {
    runner.loadGameSource(`
game clear_test
  ship: "test"
`)

    expect(runner.getGameNames().length).toBe(1)

    runner.clear()
    expect(runner.getGameNames().length).toBe(0)
    expect(runner.isGameActive()).toBe(false)
  })
})

describe('createGameRunnerFromSource', () => {
  test('creates runner with loaded game', () => {
    const runner = createGameRunnerFromSource(`
game source_test
  ship: "test"
  scenario: "test"
`)

    expect(runner.getGameNames()).toEqual(['source_test'])
    expect(runner.getGame('source_test')).toBeDefined()
  })
})
