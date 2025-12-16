/**
 * Tests for PlayerSystem
 */

import { test, expect, describe, beforeEach } from 'bun:test'
import * as THREE from 'three'
import { PlayerSystem, type PlayerConfig } from './PlayerSystem'

const defaultConfig: PlayerConfig = {
  moveSpeed: 2.0,
  lookSensitivity: 0.002,
  fov: 75,
  near: 0.1,
  far: 100,
  maxPitch: Math.PI / 2 - 0.1,
  height: 1.6,
  radius: 0.35,
  keys: {
    forward: ['KeyW', 'ArrowUp'],
    backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight']
  }
}

let player: PlayerSystem

beforeEach(() => {
  player = new PlayerSystem(defaultConfig)
})

describe('PlayerSystem', () => {
  test('creates player with config', () => {
    expect(player).toBeDefined()
    expect(player.camera).toBeDefined()
    expect(player.state).toBeDefined()
  })

  test('camera has correct config', () => {
    expect(player.camera.fov).toBe(75)
    expect(player.camera.near).toBe(0.1)
    expect(player.camera.far).toBe(100)
  })

  test('initial position is at height', () => {
    expect(player.state.position.y).toBe(1.6)
  })

  test('setPosition sets position with height offset', () => {
    player.setPosition(10, 0, 20)
    expect(player.state.position.x).toBe(10)
    expect(player.state.position.y).toBe(1.6)  // 0 + height
    expect(player.state.position.z).toBe(20)
  })

  test('getPosition returns eye position', () => {
    player.setPosition(5, 0, 10)
    const pos = player.getPosition()
    expect(pos.x).toBe(5)
    expect(pos.y).toBe(1.6)
    expect(pos.z).toBe(10)
  })

  test('getGroundPosition returns feet position', () => {
    player.setPosition(5, 0, 10)
    const groundPos = player.getGroundPosition()
    expect(groundPos.x).toBe(5)
    expect(groundPos.y).toBe(0)  // Ground level
    expect(groundPos.z).toBe(10)
  })

  test('setEnabled controls player state', () => {
    expect(player.isEnabled()).toBe(true)
    player.setEnabled(false)
    expect(player.isEnabled()).toBe(false)
    player.setEnabled(true)
    expect(player.isEnabled()).toBe(true)
  })

  test('update does nothing when disabled', () => {
    const initialPos = player.state.position.clone()
    player.setEnabled(false)
    player.update(1 / 60)
    expect(player.state.position.equals(initialPos)).toBe(true)
  })

  test('getLookDirection returns camera direction', () => {
    const direction = player.getLookDirection()
    expect(direction).toBeDefined()
    expect(direction.z).toBeLessThan(0)  // Looking forward (negative Z)
  })

  test('setCollisionObjects stores collision objects', () => {
    const obj1 = new THREE.Mesh()
    const obj2 = new THREE.Mesh()
    player.setCollisionObjects([obj1, obj2])
    expect((player as any).collisionObjects.length).toBe(2)
  })

  test('raycast finds intersection', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const obj = new THREE.Mesh(geometry, material)
    obj.position.set(0, 1.6, -2)
    obj.userData.interactable = true
    obj.updateMatrixWorld()

    const intersection = player.raycast([obj])
    expect(intersection).toBeDefined()
  })

  test('raycast returns null when no objects', () => {
    const intersection = player.raycast([])
    expect(intersection).toBeNull()
  })

  test('resize updates camera aspect', () => {
    player.resize(1920, 1080)
    expect(player.camera.aspect).toBeCloseTo(1920 / 1080)
  })

  test('setRoomChangeCallback stores callback', () => {
    let roomChanged = false
    player.setRoomChangeCallback((roomId) => {
      roomChanged = true
    })
    expect((player as any).onRoomChange).toBeDefined()
  })

  test('custom key bindings work', () => {
    const customPlayer = new PlayerSystem({
      ...defaultConfig,
      keys: {
        forward: ['KeyI'],
        backward: ['KeyK'],
        left: ['KeyJ'],
        right: ['KeyL']
      }
    })

    expect(customPlayer).toBeDefined()
    expect((customPlayer as any).config.keys.forward).toEqual(['KeyI'])
  })
})
