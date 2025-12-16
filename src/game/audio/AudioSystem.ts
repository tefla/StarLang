// Audio System - Spatial sound and procedural audio for the ship environment

import * as THREE from 'three'
import { Config } from '../../forge/ConfigRegistry'

export class AudioSystem {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private listener: THREE.Vector3 = new THREE.Vector3()
  private listenerDirection: THREE.Vector3 = new THREE.Vector3()

  // Ambient loop
  private ambientOscillator: OscillatorNode | null = null
  private ambientGain: GainNode | null = null
  private isAmbientPlaying = false

  // Volume levels - loaded from config with defaults
  private get masterVolume() { return Config.audio.masterVolume }
  private get ambientVolume() { return Config.audio.ambientVolume }
  private get sfxVolume() { return Config.audio.sfxVolume }

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
  private calculateSpatialVolume(sourcePosition: THREE.Vector3, maxDistance?: number): number {
    const range = maxDistance ?? Config.audio.defaultRange
    const distance = this.listener.distanceTo(sourcePosition)
    if (distance > range) return 0
    return 1 - (distance / range)
  }

  // Door whoosh sound - filtered noise sweep
  playDoorSound(position: THREE.Vector3, isOpening: boolean) {
    const ctx = this.ensureContext()
    if (!this.masterGain) return

    const spatialVolume = this.calculateSpatialVolume(position)
    if (spatialVolume < 0.05) return

    const duration = Config.audio.door.duration
    const freqStart = Config.audio.door.openFreqStart
    const freqEnd = Config.audio.door.openFreqEnd
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
      filter.frequency.setValueAtTime(freqStart, now)
      filter.frequency.exponentialRampToValueAtTime(freqEnd, now + duration)
    } else {
      filter.frequency.setValueAtTime(freqEnd, now)
      filter.frequency.exponentialRampToValueAtTime(freqStart, now + duration)
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

    const spatialVolume = this.calculateSpatialVolume(position, Config.audio.switchRange)
    if (spatialVolume < 0.05) return

    const now = ctx.currentTime

    if (working) {
      // Satisfying mechanical click
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(Config.audio.switch.pressFreq, now)
      osc.frequency.exponentialRampToValueAtTime(Config.audio.switch.pressEndFreq, now + 0.05)

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
        osc2.frequency.setValueAtTime(Config.audio.switch.releaseFreq, ctx.currentTime)
        osc2.frequency.exponentialRampToValueAtTime(Config.audio.switch.releaseEndFreq, ctx.currentTime + 0.03)

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
    const cracklesMin = Config.audio.sparks.numCracklesMin
    const cracklesMax = Config.audio.sparks.numCracklesMax
    const numCrackles = cracklesMin + Math.floor(Math.random() * (cracklesMax - cracklesMin + 1))

    const filterFreqMin = Config.audio.sparks.filterFreqMin
    const filterFreqRange = Config.audio.sparks.filterFreqMax - filterFreqMin

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
      filter.frequency.value = filterFreqMin + Math.random() * filterFreqRange

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
    this.ambientOscillator.frequency.value = Config.audio.ambient.baseFreq

    // Add subtle modulation
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = Config.audio.ambient.lfoRate

    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 5

    lfo.connect(lfoGain)
    lfoGain.connect(this.ambientOscillator.frequency)

    // Second harmonic
    const harmonic = ctx.createOscillator()
    harmonic.type = 'sine'
    harmonic.frequency.value = Config.audio.ambient.harmonicFreq

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
    const frequency = critical ? Config.audio.warning.criticalFreq : Config.audio.warning.normalFreq
    const beepDuration = critical ? Config.audio.warning.criticalDuration : Config.audio.warning.normalDuration
    const numBeeps = critical ? Config.audio.warning.criticalBeeps : Config.audio.warning.normalBeeps

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
    const frequencies = Config.audio.terminal.accessTones
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
    const frequencies = Config.audio.compile.successTones // C5, E5, G5 - major chord

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
    osc1.frequency.value = Config.audio.compile.errorFreq1

    const osc2 = ctx.createOscillator()
    osc2.type = 'sawtooth'
    osc2.frequency.value = Config.audio.compile.errorFreq2 // Slight detuning for dissonance

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
    const clampedVolume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) {
      this.masterGain.gain.value = clampedVolume
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
