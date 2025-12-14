// Audio System - Spatial sound and procedural audio for the ship environment

import * as THREE from 'three'

export class AudioSystem {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private listener: THREE.Vector3 = new THREE.Vector3()
  private listenerDirection: THREE.Vector3 = new THREE.Vector3()

  // Ambient loop
  private ambientOscillator: OscillatorNode | null = null
  private ambientGain: GainNode | null = null
  private isAmbientPlaying = false

  // Volume levels
  private masterVolume = 0.5
  private ambientVolume = 0.15
  private sfxVolume = 0.4

  constructor() {
    // Audio context created on first user interaction
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = this.masterVolume
      this.masterGain.connect(this.audioContext.destination)
    }

    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    return this.audioContext
  }

  updateListener(position: THREE.Vector3, direction: THREE.Vector3) {
    this.listener.copy(position)
    this.listenerDirection.copy(direction)
  }

  // Calculate volume based on distance (simple linear falloff)
  private calculateSpatialVolume(sourcePosition: THREE.Vector3, maxDistance = 15): number {
    const distance = this.listener.distanceTo(sourcePosition)
    if (distance > maxDistance) return 0
    return 1 - (distance / maxDistance)
  }

  // Door whoosh sound - filtered noise sweep
  playDoorSound(position: THREE.Vector3, isOpening: boolean) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position)
    if (spatialVolume < 0.05) return

    const duration = 0.6
    const now = ctx.currentTime

    // Create noise buffer
    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = buffer

    // Bandpass filter for whoosh
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 2

    // Opening: sweep low to high, Closing: high to low
    if (isOpening) {
      filter.frequency.setValueAtTime(200, now)
      filter.frequency.exponentialRampToValueAtTime(2000, now + duration)
    } else {
      filter.frequency.setValueAtTime(2000, now)
      filter.frequency.exponentialRampToValueAtTime(200, now + duration)
    }

    // Volume envelope
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(this.sfxVolume * spatialVolume * 0.6, now + 0.05)
    gain.gain.linearRampToValueAtTime(this.sfxVolume * spatialVolume * 0.3, now + duration * 0.5)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    noiseSource.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    noiseSource.start(now)
    noiseSource.stop(now + duration)
  }

  // Switch click sound - sharp transient
  playSwitchClick(position: THREE.Vector3, working: boolean = true) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position, 8)
    if (spatialVolume < 0.05) return

    const now = ctx.currentTime

    if (working) {
      // Satisfying mechanical click
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(this.sfxVolume * spatialVolume * 0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.1)

      // Second click (release)
      setTimeout(() => {
        const osc2 = ctx.createOscillator()
        osc2.type = 'square'
        osc2.frequency.setValueAtTime(600, ctx.currentTime)
        osc2.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.03)

        const gain2 = ctx.createGain()
        gain2.gain.setValueAtTime(this.sfxVolume * spatialVolume * 0.2, ctx.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)

        osc2.connect(gain2)
        gain2.connect(this.masterGain!)
        osc2.start(ctx.currentTime)
        osc2.stop(ctx.currentTime + 0.06)
      }, 80)
    } else {
      // Broken switch - dull thud, no satisfying click
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(100, now)
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.1)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(this.sfxVolume * spatialVolume * 0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.2)
    }
  }

  // Sparks/electrical crackle for broken equipment
  playSparks(position: THREE.Vector3) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position, 10)
    if (spatialVolume < 0.05) return

    const now = ctx.currentTime

    // Multiple short crackles
    const numCrackles = 3 + Math.floor(Math.random() * 4)

    for (let i = 0; i < numCrackles; i++) {
      const delay = i * (0.03 + Math.random() * 0.05)

      // Create short noise burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.02)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize)
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer

      // High-pass for crackle
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 2000 + Math.random() * 3000

      const gain = ctx.createGain()
      gain.gain.value = this.sfxVolume * spatialVolume * (0.2 + Math.random() * 0.2)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      source.start(now + delay)
    }
  }

  // Start ambient ship hum
  startAmbient() {
    if (this.isAmbientPlaying) return

    const ctx = this.ensureContext()
    if (!this.masterGain) return

    this.isAmbientPlaying = true

    // Low frequency hum
    this.ambientOscillator = ctx.createOscillator()
    this.ambientOscillator.type = 'sine'
    this.ambientOscillator.frequency.value = 60

    // Add subtle modulation
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.5

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 5

    lfo.connect(lfoGain)
    lfoGain.connect(this.ambientOscillator.frequency)

    // Second harmonic
    const harmonic = ctx.createOscillator()
    harmonic.type = 'sine'
    harmonic.frequency.value = 120

    const harmonicGain = ctx.createGain()
    harmonicGain.gain.value = this.ambientVolume * 0.3

    harmonic.connect(harmonicGain)

    // Main gain
    this.ambientGain = ctx.createGain()
    this.ambientGain.gain.value = this.ambientVolume

    this.ambientOscillator.connect(this.ambientGain)
    harmonicGain.connect(this.ambientGain)
    this.ambientGain.connect(this.masterGain)

    this.ambientOscillator.start()
    harmonic.start()
    lfo.start()
  }

  stopAmbient() {
    if (!this.isAmbientPlaying) return

    if (this.ambientOscillator) {
      this.ambientOscillator.stop()
      this.ambientOscillator.disconnect()
      this.ambientOscillator = null
    }

    if (this.ambientGain) {
      this.ambientGain.disconnect()
      this.ambientGain = null
    }

    this.isAmbientPlaying = false
  }

  // Warning beep for low O2
  playWarningBeep(critical: boolean = false) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const now = ctx.currentTime
    const frequency = critical ? 880 : 660
    const beepDuration = critical ? 0.15 : 0.2
    const numBeeps = critical ? 3 : 2

    for (let i = 0; i < numBeeps; i++) {
      const beepStart = now + i * (beepDuration + 0.1)

      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = frequency

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, beepStart)
      gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.3, beepStart + 0.01)
      gain.gain.setValueAtTime(this.sfxVolume * 0.3, beepStart + beepDuration - 0.02)
      gain.gain.linearRampToValueAtTime(0, beepStart + beepDuration)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(beepStart)
      osc.stop(beepStart + beepDuration)
    }
  }

  // Terminal interaction sound
  playTerminalAccess() {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const now = ctx.currentTime

    // Rising tones
    const frequencies = [400, 500, 600]
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const gain = ctx.createGain()
      const start = now + i * 0.08
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.15, start + 0.02)
      gain.gain.linearRampToValueAtTime(0, start + 0.1)

      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(start)
      osc.stop(start + 0.12)
    })
  }

  // Compile success/error sounds
  playCompileSuccess() {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const now = ctx.currentTime
    const frequencies = [523, 659, 784] // C5, E5, G5 - major chord

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const gain = ctx.createGain()
      const start = now + i * 0.05
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.2, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4)

      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(start)
      osc.stop(start + 0.45)
    })
  }

  playCompileError() {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const now = ctx.currentTime

    // Dissonant buzz
    const osc1 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc1.frequency.value = 150

    const osc2 = ctx.createOscillator()
    osc2.type = 'sawtooth'
    osc2.frequency.value = 155 // Slight detuning for dissonance

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(this.sfxVolume * 0.2, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.3)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 800

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.35)
    osc2.stop(now + 0.35)
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume
    }
  }

  // ============================================
  // Ambient System Sounds
  // ============================================

  // Pipe sounds - metallic clangs, water hammer, flow
  playPipeSound(position: THREE.Vector3, intensity: number = 0.5) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position, 12)
    if (spatialVolume < 0.05) return

    const now = ctx.currentTime
    const volume = this.sfxVolume * spatialVolume * 0.4 * intensity

    // Randomly choose pipe sound type
    const soundType = Math.random()

    if (soundType < 0.4) {
      // Metallic clang/ping
      const freq = 200 + Math.random() * 400
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.3)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volume, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

      // Add metallic resonance
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = freq * 2
      filter.Q.value = 10

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.35)

    } else if (soundType < 0.7) {
      // Water hammer / thunk
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(80 + Math.random() * 40, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volume * 1.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.25)

    } else {
      // Flow/gurgle - filtered noise
      const duration = 0.3 + Math.random() * 0.3
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize * 0.5)
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(300, now)
      filter.frequency.linearRampToValueAtTime(150, now + duration)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.05)
      gain.gain.linearRampToValueAtTime(0, now + duration)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      source.start(now)
    }
  }

  // Vent sounds - air whoosh, rattle, hum
  playVentSound(position: THREE.Vector3, intensity: number = 0.5) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position, 10)
    if (spatialVolume < 0.05) return

    const now = ctx.currentTime
    const volume = this.sfxVolume * spatialVolume * 0.35 * intensity

    const soundType = Math.random()

    if (soundType < 0.5) {
      // Air whoosh
      const duration = 0.4 + Math.random() * 0.4
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        const env = Math.sin(t * Math.PI)
        data[i] = (Math.random() * 2 - 1) * env
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800 + Math.random() * 400
      filter.Q.value = 1

      const gain = ctx.createGain()
      gain.gain.value = volume * 0.6

      source.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      source.start(now)

    } else if (soundType < 0.8) {
      // Rattle/flutter
      const numRattles = 3 + Math.floor(Math.random() * 5)
      for (let i = 0; i < numRattles; i++) {
        const delay = i * (0.02 + Math.random() * 0.03)

        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.value = 100 + Math.random() * 50

        const rattleGain = ctx.createGain()
        rattleGain.gain.setValueAtTime(volume * 0.3, now + delay)
        rattleGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.03)

        osc.connect(rattleGain)
        rattleGain.connect(this.masterGain)
        osc.start(now + delay)
        osc.stop(now + delay + 0.04)
      }

    } else {
      // Low hum variation
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const baseFreq = 50 + Math.random() * 30
      osc.frequency.setValueAtTime(baseFreq, now)
      osc.frequency.linearRampToValueAtTime(baseFreq * (0.9 + Math.random() * 0.2), now + 0.5)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.1)
      gain.gain.linearRampToValueAtTime(0, now + 0.5)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.55)
    }
  }

  // Conduit sounds - electrical hum, buzz, crackle
  playConduitSound(position: THREE.Vector3, intensity: number = 0.5) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position, 8)
    if (spatialVolume < 0.05) return

    const now = ctx.currentTime
    const volume = this.sfxVolume * spatialVolume * 0.3 * intensity

    const soundType = Math.random()

    if (soundType < 0.4) {
      // Electrical buzz
      const duration = 0.2 + Math.random() * 0.3
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc2.type = 'sawtooth'
      osc1.frequency.value = 60
      osc2.frequency.value = 62 // Slight detune for buzz

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.02)
      gain.gain.setValueAtTime(volume * 0.4, now + duration - 0.02)
      gain.gain.linearRampToValueAtTime(0, now + duration)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + duration + 0.05)
      osc2.stop(now + duration + 0.05)

    } else if (soundType < 0.7) {
      // Quick crackle
      const numCrackles = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < numCrackles; i++) {
        const delay = i * (0.02 + Math.random() * 0.04)
        const bufferSize = Math.floor(ctx.sampleRate * 0.015)
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let j = 0; j < bufferSize; j++) {
          data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize)
        }

        const source = ctx.createBufferSource()
        source.buffer = buffer

        const filter = ctx.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.value = 3000 + Math.random() * 2000

        const crackleGain = ctx.createGain()
        crackleGain.gain.value = volume * 0.5

        source.connect(filter)
        filter.connect(crackleGain)
        crackleGain.connect(this.masterGain)
        source.start(now + delay)
      }

    } else {
      // Power fluctuation tone
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(120, now)
      osc.frequency.linearRampToValueAtTime(115, now + 0.1)
      osc.frequency.linearRampToValueAtTime(120, now + 0.2)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volume * 0.5, now)
      gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.1)
      gain.gain.linearRampToValueAtTime(0, now + 0.25)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.3)
    }
  }

  // Hull sounds - groans, creaks, pops, stress
  playHullSound(position: THREE.Vector3, intensity: number = 0.5) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position, 15)
    if (spatialVolume < 0.05) return

    const now = ctx.currentTime
    const volume = this.sfxVolume * spatialVolume * 0.5 * intensity

    const soundType = Math.random()

    if (soundType < 0.4) {
      // Deep groan
      const duration = 0.5 + Math.random() * 0.5
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const startFreq = 30 + Math.random() * 20
      osc.frequency.setValueAtTime(startFreq, now)
      osc.frequency.linearRampToValueAtTime(startFreq * 0.8, now + duration)

      // Add some wobble
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 2 + Math.random() * 3
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 5
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume, now + 0.1)
      gain.gain.linearRampToValueAtTime(0, now + duration)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      lfo.start(now)
      osc.stop(now + duration + 0.1)
      lfo.stop(now + duration + 0.1)

    } else if (soundType < 0.7) {
      // Metallic creak
      const duration = 0.15 + Math.random() * 0.15
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const freq = 150 + Math.random() * 100
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + duration)

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = freq
      filter.Q.value = 5

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volume * 0.6, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + duration + 0.05)

    } else {
      // Thermal pop/tick
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800 + Math.random() * 400, now)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(volume * 0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start(now)
      osc.stop(now + 0.1)
    }
  }

  dispose() {
    this.stopAmbient()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

// Singleton instance
export const audioSystem = new AudioSystem()
