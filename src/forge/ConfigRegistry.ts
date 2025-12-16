// ConfigRegistry - Centralized configuration storage loaded from Forge files
// Provides type-safe access to game configuration values

/**
 * ConfigRegistry stores configuration values loaded from .config.forge files.
 * Values are accessed via dot-notation paths like "audio.volumes.master".
 */
export class ConfigRegistry {
  private configs = new Map<string, Record<string, unknown>>()

  /**
   * Register a configuration namespace with its values.
   * @param name - The config namespace (e.g., "audio", "lighting")
   * @param values - The configuration values object
   */
  register(name: string, values: Record<string, unknown>): void {
    this.configs.set(name, values)
  }

  /**
   * Get a configuration value by dot-notation path.
   * @param path - Dot-notation path like "audio.volumes.master"
   * @returns The value or undefined if not found
   */
  get<T>(path: string): T | undefined {
    const parts = path.split('.')
    if (parts.length === 0) return undefined

    const configName = parts[0]!
    const config = this.configs.get(configName)
    if (!config) return undefined

    let value: unknown = config
    for (let i = 1; i < parts.length; i++) {
      if (value === null || typeof value !== 'object') return undefined
      value = (value as Record<string, unknown>)[parts[i]!]
    }

    return value as T
  }

  /**
   * Get a configuration value, throwing if not found.
   * @param path - Dot-notation path like "audio.volumes.master"
   * @returns The value
   * @throws Error if the path is not found
   */
  getRequired<T>(path: string): T {
    const value = this.get<T>(path)
    if (value === undefined) {
      throw new Error(`Required config value not found: ${path}`)
    }
    return value
  }

  /**
   * Get a configuration value with a default fallback.
   * @param path - Dot-notation path
   * @param defaultValue - Value to return if path not found
   * @returns The value or the default
   */
  getOrDefault<T>(path: string, defaultValue: T): T {
    const value = this.get<T>(path)
    return value !== undefined ? value : defaultValue
  }

  /**
   * Check if a configuration path exists.
   */
  has(path: string): boolean {
    return this.get(path) !== undefined
  }

  /**
   * Get all registered config namespaces.
   */
  getNamespaces(): string[] {
    return Array.from(this.configs.keys())
  }

  /**
   * Get entire config namespace as an object.
   */
  getNamespace(name: string): Record<string, unknown> | undefined {
    return this.configs.get(name)
  }

  /**
   * Clear all registered configs.
   */
  clear(): void {
    this.configs.clear()
  }
}

// Global singleton instance
export const configRegistry = new ConfigRegistry()

// Type-safe config accessors for common config paths
export const Config = {
  // Game rules
  gameRules: {
    get o2DepletionRate() { return configRegistry.getOrDefault('game-rules.atmosphere.o2_depletion_rate', 0.05) },
    get o2WarningThreshold() { return configRegistry.getOrDefault('game-rules.atmosphere.o2_warning_threshold', 19) },
    get o2CriticalThreshold() { return configRegistry.getOrDefault('game-rules.atmosphere.o2_critical_threshold', 16) },
    get o2GameoverThreshold() { return configRegistry.getOrDefault('game-rules.atmosphere.o2_gameover_threshold', 12) },
    get initialO2Level() { return configRegistry.getOrDefault('game-rules.atmosphere.initial_o2_level', 19.5) },
    get victoryTargetRoom() { return configRegistry.getOrDefault('game-rules.victory.target_room', 'corridor') },
    get victorySourceRoom() { return configRegistry.getOrDefault('game-rules.victory.source_room', 'galley') },
    defaults: {
      room: {
        get o2Level() { return configRegistry.getOrDefault('game-rules.defaults.room.o2_level', 21.0) },
        get temperature() { return configRegistry.getOrDefault('game-rules.defaults.room.temperature', 22.0) },
        get pressure() { return configRegistry.getOrDefault('game-rules.defaults.room.pressure', 1.0) },
        get powered() { return configRegistry.getOrDefault('game-rules.defaults.room.powered', true) },
      },
      door: {
        get state() { return configRegistry.getOrDefault('game-rules.defaults.door.state', 'CLOSED') },
      },
    },
  },

  // Audio
  audio: {
    get masterVolume() { return configRegistry.getOrDefault('audio.volumes.master', 0.5) },
    get ambientVolume() { return configRegistry.getOrDefault('audio.volumes.ambient', 0.15) },
    get sfxVolume() { return configRegistry.getOrDefault('audio.volumes.sfx', 0.4) },
    get defaultRange() { return configRegistry.getOrDefault('audio.spatial.default_range', 15) },
    get switchRange() { return configRegistry.getOrDefault('audio.spatial.switch_range', 8) },
    door: {
      get duration() { return configRegistry.getOrDefault('audio.door.duration', 0.6) },
      get openFreqStart() { return configRegistry.getOrDefault('audio.door.open_freq_start', 200) },
      get openFreqEnd() { return configRegistry.getOrDefault('audio.door.open_freq_end', 2000) },
    },
    switch: {
      get pressFreq() { return configRegistry.getOrDefault('audio.switch.press_freq', 800) },
      get pressEndFreq() { return configRegistry.getOrDefault('audio.switch.press_end_freq', 200) },
      get releaseFreq() { return configRegistry.getOrDefault('audio.switch.release_freq', 600) },
      get releaseEndFreq() { return configRegistry.getOrDefault('audio.switch.release_end_freq', 150) },
    },
    warning: {
      get normalFreq() { return configRegistry.getOrDefault('audio.warning.normal_freq', 660) },
      get normalBeeps() { return configRegistry.getOrDefault('audio.warning.normal_beeps', 2) },
      get normalDuration() { return configRegistry.getOrDefault('audio.warning.normal_duration', 0.2) },
      get criticalFreq() { return configRegistry.getOrDefault('audio.warning.critical_freq', 880) },
      get criticalBeeps() { return configRegistry.getOrDefault('audio.warning.critical_beeps', 3) },
      get criticalDuration() { return configRegistry.getOrDefault('audio.warning.critical_duration', 0.15) },
    },
    terminal: {
      get accessTones() { return configRegistry.getOrDefault<number[]>('audio.terminal.access_tones', [400, 500, 600]) },
    },
    compile: {
      get successTones() { return configRegistry.getOrDefault<number[]>('audio.compile.success_tones', [523, 659, 784]) },
      get errorFreq1() { return configRegistry.getOrDefault('audio.compile.error_freq_1', 150) },
      get errorFreq2() { return configRegistry.getOrDefault('audio.compile.error_freq_2', 155) },
    },
    ambient: {
      get baseFreq() { return configRegistry.getOrDefault('audio.ambient.base_freq', 60) },
      get harmonicFreq() { return configRegistry.getOrDefault('audio.ambient.harmonic_freq', 120) },
      get lfoRate() { return configRegistry.getOrDefault('audio.ambient.lfo_rate', 0.5) },
    },
    sparks: {
      get numCracklesMin() { return configRegistry.getOrDefault('audio.sparks.num_crackles_min', 3) },
      get numCracklesMax() { return configRegistry.getOrDefault('audio.sparks.num_crackles_max', 7) },
      get filterFreqMin() { return configRegistry.getOrDefault('audio.sparks.filter_freq_min', 2000) },
      get filterFreqMax() { return configRegistry.getOrDefault('audio.sparks.filter_freq_max', 5000) },
    },
  },

  // Lighting
  lighting: {
    scene: {
      get backgroundColor() { return configRegistry.getOrDefault('lighting.scene.background_color', 0x101520) },
      get fogColor() { return configRegistry.getOrDefault('lighting.scene.fog_color', 0x101520) },
      get fogNear() { return configRegistry.getOrDefault('lighting.scene.fog_near', 30) },
      get fogFar() { return configRegistry.getOrDefault('lighting.scene.fog_far', 100) },
    },
    ambient: {
      get color() { return configRegistry.getOrDefault('lighting.ambient.color', 0x404050) },
      get intensity() { return configRegistry.getOrDefault('lighting.ambient.intensity', 0.4) },
    },
    directional: {
      get color() { return configRegistry.getOrDefault('lighting.directional.color', 0xffffff) },
      get intensity() { return configRegistry.getOrDefault('lighting.directional.intensity', 0.6) },
      get shadowMapSize() { return configRegistry.getOrDefault('lighting.directional.shadow_map_size', 2048) },
      get shadowBounds() { return configRegistry.getOrDefault('lighting.directional.shadow_bounds', 30) },
    },
    ceiling: {
      get color() { return configRegistry.getOrDefault('lighting.ceiling.color', 0xffffee) },
      get intensity() { return configRegistry.getOrDefault('lighting.ceiling.intensity', 1.5) },
      get decay() { return configRegistry.getOrDefault('lighting.ceiling.decay', 1) },
    },
    wall: {
      get distance() { return configRegistry.getOrDefault('lighting.wall.distance', 8) },
      get decay() { return configRegistry.getOrDefault('lighting.wall.decay', 1.5) },
      get offset() { return configRegistry.getOrDefault('lighting.wall.offset', 0.12) },
    },
    doorStatus: {
      get open() { return configRegistry.getOrDefault('lighting.door_status.open', 0x77dd77) },
      get closed() { return configRegistry.getOrDefault('lighting.door_status.closed', 0x888888) },
      get locked() { return configRegistry.getOrDefault('lighting.door_status.locked', 0xffb347) },
      get sealed() { return configRegistry.getOrDefault('lighting.door_status.sealed', 0xff6b6b) },
    },
  },

  // Particles
  particles: {
    sparks: {
      get maxCount() { return configRegistry.getOrDefault('particles.sparks.max_count', 50) },
      get defaultEmit() { return configRegistry.getOrDefault('particles.sparks.default_emit', 15) },
      get colors() { return configRegistry.getOrDefault<number[]>('particles.sparks.colors', [0xffff88, 0xffaa44, 0xff6622]) },
      get colorWeights() { return configRegistry.getOrDefault<number[]>('particles.sparks.color_weights', [0.3, 0.4, 0.3]) },
      get lifetimeMin() { return configRegistry.getOrDefault('particles.sparks.lifetime_min', 0.3) },
      get lifetimeMax() { return configRegistry.getOrDefault('particles.sparks.lifetime_max', 0.7) },
      get gravity() { return configRegistry.getOrDefault('particles.sparks.gravity', -9.8) },
      get drag() { return configRegistry.getOrDefault('particles.sparks.drag', 0.98) },
    },
  },

  // Player
  player: {
    movement: {
      get walkSpeed() { return configRegistry.getOrDefault('player.movement.walk_speed', 5) },
      get lookSensitivity() { return configRegistry.getOrDefault('player.movement.look_sensitivity', 0.002) },
    },
    collision: {
      get height() { return configRegistry.getOrDefault('player.collision.height', 1.7) },
      get radius() { return configRegistry.getOrDefault('player.collision.radius', 0.3) },
      get checkHeights() { return configRegistry.getOrDefault<number[]>('player.collision.check_heights', [0.1, 0.5, 1.0, 1.6]) },
    },
    camera: {
      get fov() { return configRegistry.getOrDefault('player.camera.fov', 75) },
      get near() { return configRegistry.getOrDefault('player.camera.near', 0.1) },
      get far() { return configRegistry.getOrDefault('player.camera.far', 1000) },
      get maxPitch() { return configRegistry.getOrDefault('player.camera.max_pitch', Math.PI / 2 - 0.1) },
    },
    keys: {
      get forward() { return configRegistry.getOrDefault<string[]>('player.keys.forward', ['KeyW', 'ArrowUp']) },
      get backward() { return configRegistry.getOrDefault<string[]>('player.keys.backward', ['KeyS', 'ArrowDown']) },
      get left() { return configRegistry.getOrDefault<string[]>('player.keys.left', ['KeyA', 'ArrowLeft']) },
      get right() { return configRegistry.getOrDefault<string[]>('player.keys.right', ['KeyD', 'ArrowRight']) },
      get interact() { return configRegistry.getOrDefault<string[]>('player.keys.interact', ['KeyE']) },
    },
    interaction: {
      get range() { return configRegistry.getOrDefault('player.interaction.range', 2.5) },
      get switchHeightOffset() { return configRegistry.getOrDefault('player.interaction.switch_height_offset', 48) },
    },
  },

  // UI
  ui: {
    warning: {
      get displayDuration() { return configRegistry.getOrDefault('ui.warning.display_duration', 5000) },
      get colorNormal() { return configRegistry.getOrDefault('ui.warning.color_normal', 'rgba(255, 150, 50, 0.9)') },
      get colorCritical() { return configRegistry.getOrDefault('ui.warning.color_critical', 'rgba(200, 0, 0, 0.95)') },
    },
    gameover: {
      get background() { return configRegistry.getOrDefault('ui.gameover.background', 'rgba(0, 0, 0, 0.9)') },
      get title() { return configRegistry.getOrDefault('ui.gameover.title', 'OXYGEN DEPLETED') },
      get subtitle() { return configRegistry.getOrDefault('ui.gameover.subtitle', 'You succumbed to hypoxia.') },
      get titleColor() { return configRegistry.getOrDefault('ui.gameover.title_color', '#ff4444') },
      get buttonText() { return configRegistry.getOrDefault('ui.gameover.button_text', 'RESTART') },
      get buttonColor() { return configRegistry.getOrDefault('ui.gameover.button_color', '#ff4444') },
    },
    victory: {
      get background() { return configRegistry.getOrDefault('ui.victory.background', 'rgba(0, 20, 40, 0.95)') },
      get title() { return configRegistry.getOrDefault('ui.victory.title', 'ESCAPE SUCCESSFUL') },
      get subtitle() { return configRegistry.getOrDefault('ui.victory.subtitle', "You've escaped the galley and reached the corridor.") },
      get note() { return configRegistry.getOrDefault('ui.victory.note', 'Act 1 Complete - More to explore ahead...') },
      get titleColor() { return configRegistry.getOrDefault('ui.victory.title_color', '#77dd77') },
      get buttonText() { return configRegistry.getOrDefault('ui.victory.button_text', 'CONTINUE EXPLORING') },
      get buttonColor() { return configRegistry.getOrDefault('ui.victory.button_color', '#77dd77') },
    },
    message: {
      get displayDuration() { return configRegistry.getOrDefault('ui.message.display_duration', 2000) },
    },
    editor: {
      get statusReady() { return configRegistry.getOrDefault('ui.editor.status_ready', 'Ready') },
      get statusSuccess() { return configRegistry.getOrDefault('ui.editor.status_success', 'Compiled successfully!') },
      get statusError() { return configRegistry.getOrDefault('ui.editor.status_error', 'Compile error') },
      get colorSuccess() { return configRegistry.getOrDefault('ui.editor.color_success', '#77dd77') },
      get colorError() { return configRegistry.getOrDefault('ui.editor.color_error', '#ff6b6b') },
    },
    prompts: {
      get switchNormal() { return configRegistry.getOrDefault('ui.prompts.switch_normal', 'Press [E] to use {name}') },
      get switchBroken() { return configRegistry.getOrDefault('ui.prompts.switch_broken', '{name} - Not responding') },
      get terminalStatus() { return configRegistry.getOrDefault('ui.prompts.terminal_status', '{name}') },
      get terminalEngineering() { return configRegistry.getOrDefault('ui.prompts.terminal_engineering', 'Press [E] to use terminal') },
    },
  },

  // Voxel colors (legacy accessor - uses voxel-types config)
  voxelColors: {
    get(type: string): number {
      // Try new voxel-types config first, fall back to legacy voxel-colors
      const fromTypes = configRegistry.get<number>(`voxel-types.${type}.color`)
      if (fromTypes !== undefined) return fromTypes
      return configRegistry.getOrDefault(`voxel-colors.${type}`, 0x888888)
    },
  },

  // Voxel type catalog - full type definitions with properties
  voxelTypes: {
    getColor(type: string): number {
      const color = configRegistry.get<number>(`voxel-types.${type}.color`)
      if (color !== undefined) return color
      // Fall back to legacy voxel-colors config
      return configRegistry.getOrDefault(`voxel-colors.${type}`, 0x888888)
    },
    isSolid(type: string): boolean {
      return configRegistry.getOrDefault(`voxel-types.${type}.solid`, true)
    },
    isTransparent(type: string): boolean {
      return configRegistry.getOrDefault(`voxel-types.${type}.transparent`, false)
    },
    isPassable(type: string): boolean {
      return configRegistry.getOrDefault(`voxel-types.${type}.passable`, false)
    },
    // Dynamic ID mapping
    getIdByName(name: string): number | undefined {
      return configRegistry.get<number>(`voxel-types.${name}.id`)
    },
    getNameById(id: number): string | undefined {
      const config = configRegistry.getNamespace('voxel-types')
      if (!config) return undefined
      for (const [name, props] of Object.entries(config)) {
        if (name === 'type_groups') continue
        if (typeof props === 'object' && props !== null && (props as { id?: number }).id === id) {
          return name
        }
      }
      return undefined
    },
    getAllTypes(): Array<{ name: string; id: number }> {
      const config = configRegistry.getNamespace('voxel-types')
      if (!config) return []
      const types: Array<{ name: string; id: number }> = []
      for (const [name, props] of Object.entries(config)) {
        if (name === 'type_groups') continue
        if (typeof props === 'object' && props !== null && typeof (props as { id?: number }).id === 'number') {
          types.push({ name, id: (props as { id: number }).id })
        }
      }
      return types.sort((a, b) => a.id - b.id)
    },
    getTypeGroup(groupName: string): number[] {
      const typeNames = configRegistry.get<string[]>(`voxel-type-groups.${groupName}`)
      if (!typeNames) return []
      return typeNames.map(name => this.getIdByName(name)).filter((id): id is number => id !== undefined)
    },
    isValid(type: string): boolean {
      return configRegistry.has(`voxel-types.${type}.id`)
    },
  },

  // Entity system
  entitySystem: {
    terminal: {
      get updateInterval() { return configRegistry.getOrDefault('entity-system.terminal.update_interval', 1.0) },
      get screenWidth() { return configRegistry.getOrDefault('entity-system.terminal.screen_width', 0.8) },
      get screenOffset() { return configRegistry.getOrDefault('entity-system.terminal.screen_offset', 0.01) },
      get searchRadius() { return configRegistry.getOrDefault('entity-system.terminal.search_radius', 2.0) },
    },
  },

  // Screen/terminal colors
  screenColors: {
    get background() { return configRegistry.getOrDefault('screen-colors.background', '#1a2744') },
    get scanlineOpacity() { return configRegistry.getOrDefault('screen-colors.scanline_opacity', 0.1) },
    text: {
      get normal() { return configRegistry.getOrDefault('screen-colors.text.normal', '#d0d0d0') },
      get muted() { return configRegistry.getOrDefault('screen-colors.text.muted', '#9ca3af') },
      get lineNumbers() { return configRegistry.getOrDefault('screen-colors.text.line_numbers', '#6b7280') },
    },
    status: {
      get header() { return configRegistry.getOrDefault('screen-colors.status.header', '#4a6fa5') },
      get success() { return configRegistry.getOrDefault('screen-colors.status.success', '#77dd77') },
      get warning() { return configRegistry.getOrDefault('screen-colors.status.warning', '#ffb347') },
      get error() { return configRegistry.getOrDefault('screen-colors.status.error', '#ff6b6b') },
      get prompt() { return configRegistry.getOrDefault('screen-colors.status.prompt', '#77dd77') },
    },
    keywords: {
      get nominal() { return configRegistry.getOrDefault<string[]>('screen-colors.keywords.nominal', ['NOMINAL', 'OK']) },
      get warning() { return configRegistry.getOrDefault<string[]>('screen-colors.keywords.warning', ['WARNING', 'WARN']) },
      get error() { return configRegistry.getOrDefault<string[]>('screen-colors.keywords.error', ['ERROR', 'CRITICAL']) },
    },
  },

  // Voxel world construction parameters
  voxelWorld: {
    construction: {
      get wallThickness() { return configRegistry.getOrDefault('voxel-world.construction.wall_thickness', 8) },
      get floorThickness() { return configRegistry.getOrDefault('voxel-world.construction.floor_thickness', 8) },
      get ceilingThickness() { return configRegistry.getOrDefault('voxel-world.construction.ceiling_thickness', 8) },
    },
    door: {
      get width() { return configRegistry.getOrDefault('voxel-world.door.width', 48) },
      get height() { return configRegistry.getOrDefault('voxel-world.door.height', 88) },
    },
  },

  // Bridge configuration (state mappings and event routes)
  bridge: {
    get stateMappings(): Array<{ runtimePath: string; forgePath: string; direction: string }> {
      const raw = configRegistry.get<Array<{ runtime: string; forge: string; direction: string }>>('bridge.state_mappings')
      if (!raw) return []
      return raw.map(m => ({
        runtimePath: m.runtime,
        forgePath: m.forge,
        direction: m.direction
      }))
    },
    get eventRoutes(): Array<{ from: string; sourceName: string; targetName: string }> {
      const raw = configRegistry.get<Array<{ from: string; source: string; target: string }>>('bridge.event_routes')
      if (!raw) return []
      return raw.map(r => ({
        from: r.from,
        sourceName: r.source,
        targetName: r.target
      }))
    },
  },

  // Node type catalog
  nodeTypes: {
    getCategory(type: string): string {
      return configRegistry.getOrDefault(`node-types.${type}.category`, 'unknown')
    },
    getDescription(type: string): string {
      return configRegistry.getOrDefault(`node-types.${type}.description`, '')
    },
    hasAtmosphere(type: string): boolean {
      return configRegistry.getOrDefault(`node-types.${type}.has_atmosphere`, false)
    },
    getStates(type: string): string[] {
      return configRegistry.getOrDefault<string[]>(`node-types.${type}.states`, [])
    },
    getStatuses(type: string): string[] {
      return configRegistry.getOrDefault<string[]>(`node-types.${type}.statuses`, [])
    },
    getTerminalTypes(): string[] {
      return configRegistry.getOrDefault<string[]>('node-types.TERMINAL.terminal_types', [])
    },
    isValid(type: string): boolean {
      return configRegistry.has(`node-types.${type}.category`)
    },
    getValidTypes(): string[] {
      const config = configRegistry.getNamespace('node-types')
      if (!config) return []
      return Object.keys(config).filter(key =>
        typeof config[key] === 'object' && config[key] !== null && 'category' in (config[key] as object)
      )
    },
  },

  // Role catalog
  roles: {
    getLevel(role: string): number {
      return configRegistry.getOrDefault(`roles.${role}.level`, 0)
    },
    getDescription(role: string): string {
      return configRegistry.getOrDefault(`roles.${role}.description`, '')
    },
    getInherits(role: string): string[] {
      return configRegistry.getOrDefault<string[]>(`roles.${role}.inherits`, [])
    },
    getDepartments(role: string): string[] {
      return configRegistry.getOrDefault<string[]>(`roles.${role}.departments`, [])
    },
    hasAccessAll(role: string): boolean {
      return configRegistry.getOrDefault(`roles.${role}.access_all`, false)
    },
    isValid(role: string): boolean {
      return configRegistry.has(`roles.${role}.level`)
    },
    getValidRoles(): string[] {
      const config = configRegistry.getNamespace('roles')
      if (!config) return []
      return Object.keys(config).filter(key =>
        typeof config[key] === 'object' && config[key] !== null && 'level' in (config[key] as object)
      )
    },
  },

  // Prefab catalog
  prefabs: {
    getCategories(): string[] {
      return configRegistry.getOrDefault<string[]>('prefabs.categories', [])
    },
    isValidCategory(category: string): boolean {
      const categories = this.getCategories()
      return categories.includes(category)
    },
  },

  // Interaction configuration
  interactions: {
    getInteractableTypes(): string[] {
      return configRegistry.getOrDefault<string[]>('interactions.interactable_types', [])
    },
    isInteractable(type: string): boolean {
      const types = this.getInteractableTypes()
      return types.includes(type)
    },
    getEntityStatuses(): string[] {
      return configRegistry.getOrDefault<string[]>('interactions.entity_statuses', [])
    },
  },
}
