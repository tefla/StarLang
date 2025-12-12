// Particle System - Visual effects for sparks, dust, etc.

import * as THREE from 'three'

interface Particle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  life: number
  maxLife: number
  size: number
  color: THREE.Color
}

export class SparkEffect {
  private particles: Particle[] = []
  private geometry: THREE.BufferGeometry
  private material: THREE.PointsMaterial
  private points: THREE.Points
  private maxParticles = 50

  constructor(scene: THREE.Scene) {
    // Create geometry with max particles
    this.geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(this.maxParticles * 3)
    const colors = new Float32Array(this.maxParticles * 3)
    const sizes = new Float32Array(this.maxParticles)

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    // Spark material
    this.material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    scene.add(this.points)
  }

  emit(position: THREE.Vector3, count: number = 15) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // Remove oldest particle
        this.particles.shift()
      }

      // Random velocity - sparks fly outward and fall
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.5, // Mostly upward
        (Math.random() - 0.5) * 2
      )

      // Spark colors - orange/yellow/white
      const colorChoice = Math.random()
      let color: THREE.Color
      if (colorChoice < 0.3) {
        color = new THREE.Color(0xffff88) // White-yellow
      } else if (colorChoice < 0.7) {
        color = new THREE.Color(0xffaa44) // Orange
      } else {
        color = new THREE.Color(0xff6622) // Red-orange
      }

      const particle: Particle = {
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        )),
        velocity,
        life: 0.3 + Math.random() * 0.4, // 0.3-0.7 seconds
        maxLife: 0.3 + Math.random() * 0.4,
        size: 0.02 + Math.random() * 0.03,
        color,
      }

      this.particles.push(particle)
    }
  }

  update(deltaTime: number) {
    const gravity = new THREE.Vector3(0, -9.8, 0)
    const drag = 0.98

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!

      // Apply gravity and drag
      p.velocity.add(gravity.clone().multiplyScalar(deltaTime))
      p.velocity.multiplyScalar(drag)

      // Update position
      p.position.add(p.velocity.clone().multiplyScalar(deltaTime))

      // Decrease life
      p.life -= deltaTime

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }

    // Update geometry
    const positions = this.geometry.attributes.position!.array as Float32Array
    const colors = this.geometry.attributes.color!.array as Float32Array
    const sizes = this.geometry.attributes.size!.array as Float32Array

    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i]!
        const lifeRatio = p.life / p.maxLife

        positions[i * 3] = p.position.x
        positions[i * 3 + 1] = p.position.y
        positions[i * 3 + 2] = p.position.z

        // Fade color based on life
        colors[i * 3] = p.color.r * lifeRatio
        colors[i * 3 + 1] = p.color.g * lifeRatio
        colors[i * 3 + 2] = p.color.b * lifeRatio

        sizes[i] = p.size * lifeRatio
      } else {
        // Hide unused particles
        positions[i * 3] = 0
        positions[i * 3 + 1] = -1000
        positions[i * 3 + 2] = 0
        sizes[i] = 0
      }
    }

    this.geometry.attributes.position!.needsUpdate = true
    this.geometry.attributes.color!.needsUpdate = true
    this.geometry.attributes.size!.needsUpdate = true
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
