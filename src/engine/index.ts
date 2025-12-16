// Engine Module - Generic systems for game runtime
// These systems are driven by Forge definitions

export { ScreenRenderer, type RenderContext } from './ScreenRenderer'
export { EntitySystem, ScreenEntity, type Entity } from './EntitySystem'
export { ForgeLoader, forgeLoader, type ForgeLoadResult } from './ForgeLoader'
export {
  GameRunner,
  createGameRunner,
  createGameRunnerFromSource,
  type PlayerConfig,
  type GameConfig,
  type GameLifecycleHandlers,
} from './GameRunner'
