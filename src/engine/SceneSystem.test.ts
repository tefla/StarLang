/**
 * Tests for SceneSystem
 */

import { test, expect, describe, beforeEach, mock } from 'bun:test'
import * as THREE from 'three'
import { SceneSystem, type SceneConfig } from './SceneSystem'

// Mock entity for testing
const createMockEntity = (id: string, isInteractable: boolean = true) => ({
  id,
  group: new THREE.Group(),
  isInteractable,
  update: mock(() => {}),
  dispose: mock(() => {})
})

let sceneSystem: SceneSystem

beforeEach(() => {
  sceneSystem = new SceneSystem()
})

describe('SceneSystem', () => {
  test('creates scene with default config', () => {
    expect(sceneSystem).toBeDefined()
    expect(sceneSystem.scene).toBeInstanceOf(THREE.Scene)
  })

  test('creates scene with custom config', () => {
    const config: SceneConfig = {
      backgroundColor: 0xff0000,
      fog: { color: 0x000000, near: 5, far: 100 },
      ambient: { color: 0x222222, intensity: 0.5 },
      directional: { color: 0xffffff, intensity: 1.0 }
    }

    const customScene = new SceneSystem(config)
    expect(customScene.scene).toBeDefined()
    expect(customScene.scene.fog).toBeDefined()
  })

  test('entitySystem is initialized', () => {
    expect(sceneSystem.entitySystem).toBeDefined()
  })

  test('sparkEffect is enabled by default', () => {
    expect(sceneSystem.sparkEffect).toBeDefined()
  })

  test('sparkEffect can be disabled', () => {
    const config: SceneConfig = { enableParticles: false }
    const noParticles = new SceneSystem(config)
    expect(noParticles.sparkEffect).toBeNull()
  })

  describe('mesh management', () => {
    test('addMesh adds mesh to scene', () => {
      const mesh = new THREE.Mesh()
      sceneSystem.addMesh('test-mesh', mesh)
      expect(sceneSystem.getObject('test-mesh')).toBe(mesh)
    })

    test('removeMesh removes mesh from scene', () => {
      const mesh = new THREE.Mesh()
      sceneSystem.addMesh('test-mesh', mesh)
      sceneSystem.removeMesh('test-mesh')
      expect(sceneSystem.getObject('test-mesh')).toBeUndefined()
    })
  })

  describe('point lights', () => {
    test('addPointLight creates and returns light', () => {
      const light = sceneSystem.addPointLight({
        id: 'test-light',
        position: new THREE.Vector3(0, 5, 0),
        color: 0xffffff,
        intensity: 1.0
      })

      expect(light).toBeInstanceOf(THREE.PointLight)
      expect(sceneSystem.getPointLight('test-light')).toBe(light)
    })

    test('removePointLight removes light', () => {
      sceneSystem.addPointLight({
        id: 'test-light',
        position: new THREE.Vector3(0, 5, 0),
        color: 0xffffff,
        intensity: 1.0
      })

      sceneSystem.removePointLight('test-light')
      expect(sceneSystem.getPointLight('test-light')).toBeUndefined()
    })

    test('setPointLightIntensity updates intensity', () => {
      const light = sceneSystem.addPointLight({
        id: 'test-light',
        position: new THREE.Vector3(0, 5, 0),
        color: 0xffffff,
        intensity: 1.0
      })

      sceneSystem.setPointLightIntensity('test-light', 0.5)
      expect(light.intensity).toBe(0.5)
    })

    test('toggleAllLights controls all lights', () => {
      const light1 = sceneSystem.addPointLight({
        id: 'light1',
        position: new THREE.Vector3(0, 5, 0),
        color: 0xffffff,
        intensity: 1.0
      })

      const light2 = sceneSystem.addPointLight({
        id: 'light2',
        position: new THREE.Vector3(5, 5, 0),
        color: 0xffffff,
        intensity: 1.0
      })

      sceneSystem.toggleAllLights(false)
      expect(light1.intensity).toBe(0)
      expect(light2.intensity).toBe(0)

      sceneSystem.toggleAllLights(true, 2.0)
      expect(light1.intensity).toBe(2.0)
      expect(light2.intensity).toBe(2.0)
    })
  })

  describe('object management', () => {
    test('addObject adds object to scene', () => {
      const obj = new THREE.Group()
      sceneSystem.addObject('test-obj', obj)
      expect(sceneSystem.getObject('test-obj')).toBe(obj)
    })

    test('removeObject removes object from scene', () => {
      const obj = new THREE.Group()
      sceneSystem.addObject('test-obj', obj)
      sceneSystem.removeObject('test-obj')
      expect(sceneSystem.getObject('test-obj')).toBeUndefined()
    })
  })

  describe('interactables', () => {
    test('addInteractable registers object', () => {
      const obj = new THREE.Group()
      sceneSystem.addInteractable(obj)
      expect(sceneSystem.getInteractables()).toContain(obj)
    })

    test('removeInteractable unregisters object', () => {
      const obj = new THREE.Group()
      sceneSystem.addInteractable(obj)
      sceneSystem.removeInteractable(obj)
      expect(sceneSystem.getInteractables()).not.toContain(obj)
    })

    test('does not add duplicate interactables', () => {
      const obj = new THREE.Group()
      sceneSystem.addInteractable(obj)
      sceneSystem.addInteractable(obj)
      expect(sceneSystem.getInteractables().filter(o => o === obj).length).toBe(1)
    })
  })

  describe('collision objects', () => {
    test('addCollisionObject registers object', () => {
      const obj = new THREE.Group()
      sceneSystem.addCollisionObject(obj)
      expect(sceneSystem.getCollisionObjects()).toContain(obj)
    })

    test('removeCollisionObject unregisters object', () => {
      const obj = new THREE.Group()
      sceneSystem.addCollisionObject(obj)
      sceneSystem.removeCollisionObject(obj)
      expect(sceneSystem.getCollisionObjects()).not.toContain(obj)
    })
  })

  describe('entity management', () => {
    test('addEntity adds entity group to scene', () => {
      const entity = createMockEntity('test-entity')
      sceneSystem.addEntity(entity as any)

      // Check entity is in scene
      expect(sceneSystem.scene.children).toContain(entity.group)
    })

    test('addEntity auto-registers interactable entities', () => {
      const entity = createMockEntity('test-entity', true)
      sceneSystem.addEntity(entity as any)

      expect(sceneSystem.getInteractables()).toContain(entity.group)
    })

    test('addEntity does not auto-register non-interactable entities', () => {
      const entity = createMockEntity('test-entity', false)
      sceneSystem.addEntity(entity as any)

      expect(sceneSystem.getInteractables()).not.toContain(entity.group)
    })

    test('removeEntity removes from scene and interactables', () => {
      const entity = createMockEntity('test-entity', true)
      sceneSystem.addEntity(entity as any)
      sceneSystem.removeEntity(entity as any)

      expect(sceneSystem.scene.children).not.toContain(entity.group)
      expect(sceneSystem.getInteractables()).not.toContain(entity.group)
    })
  })

  describe('update', () => {
    test('update calls entitySystem update', () => {
      const originalUpdate = sceneSystem.entitySystem.update.bind(sceneSystem.entitySystem)
      let updateCalled = false
      sceneSystem.entitySystem.update = (deltaTime, context) => {
        updateCalled = true
        return originalUpdate(deltaTime, context)
      }

      sceneSystem.update(1 / 60)
      expect(updateCalled).toBe(true)
    })
  })

  describe('emitSparks', () => {
    test('emitSparks works when particles enabled', () => {
      const position = new THREE.Vector3(0, 1, 0)
      // Should not throw
      expect(() => sceneSystem.emitSparks(position, 10)).not.toThrow()
    })

    test('emitSparks is safe when particles disabled', () => {
      const noParticles = new SceneSystem({ enableParticles: false })
      const position = new THREE.Vector3(0, 1, 0)
      // Should not throw
      expect(() => noParticles.emitSparks(position, 10)).not.toThrow()
    })
  })

  describe('clear', () => {
    test('clearDynamic removes objects and lights', () => {
      sceneSystem.addObject('obj', new THREE.Group())
      sceneSystem.addPointLight({
        id: 'light',
        position: new THREE.Vector3(0, 5, 0),
        color: 0xffffff,
        intensity: 1.0
      })
      sceneSystem.addInteractable(new THREE.Group())
      sceneSystem.addCollisionObject(new THREE.Group())

      sceneSystem.clearDynamic()

      expect(sceneSystem.getObject('obj')).toBeUndefined()
      expect(sceneSystem.getPointLight('light')).toBeUndefined()
      expect(sceneSystem.getInteractables().length).toBe(0)
      expect(sceneSystem.getCollisionObjects().length).toBe(0)
    })

    test('clear also clears voxel world', () => {
      // Just test that clear works - voxel world is null by default
      sceneSystem.clear()
      expect(sceneSystem.voxelWorld).toBeNull()
      expect(sceneSystem.voxelRenderer).toBeNull()
    })
  })

  describe('dispose', () => {
    test('dispose clears everything', () => {
      sceneSystem.dispose()
      expect(sceneSystem.sparkEffect).toBeNull()
    })
  })
})
