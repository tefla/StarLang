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
      get buttonColor() { return configRegistry.getOrDefault('ui.gameover.button_color', '#ff4444') },
    },
    victory: {
      get background() { return configRegistry.getOrDefault('ui.victory.background', 'rgba(0, 20, 40, 0.95)') },
      get textColor() { return configRegistry.getOrDefault('ui.victory.text_color', '#77dd77') },
      get buttonColor() { return configRegistry.getOrDefault('ui.victory.button_color', '#77dd77') },
    },
    message: {
      get displayDuration() { return configRegistry.getOrDefault('ui.message.display_duration', 2000) },
    },
  },

  // Voxel colors
  voxelColors: {
    get(type: string): number {
      return configRegistry.getOrDefault(`voxel-colors.${type}`, 0x888888)
    },
  },
}
