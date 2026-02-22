/**
 * Audio signal processor — transforms raw FFT data into smoothed, usable signals.
 *
 * Generic foundation for any audio-reactive consumer: visualizers, frequency bars,
 * haptic drivers, LED controllers, etc. Not tied to any specific output modality.
 *
 * Usage:
 *   audioSignalProcessor.update(dt)   // call once per frame
 *   const { bands, beat, phase } = audioSignalProcessor.signal  // read anywhere
 *
 * Key design decisions (informed by Butterchurn/Milkdrop):
 *   - Asymmetric smoothing: fast attack, slow release — beats snap, decay is graceful
 *   - FPS-adaptive rates: smoothing behaves identically at 30fps or 144fps
 *   - Phase accumulators: audio modulates rate-of-change, not absolute position.
 *     Consumers use phase values instead of raw time to avoid discontinuous lurching.
 */

import { analyserBridge } from './analyser-bridge'

export interface FrequencyBands {
  subBass: number   // 0–60 Hz
  bass: number      // 60–250 Hz
  mid: number       // 250–2000 Hz
  treble: number    // 2000–6000 Hz
  presence: number  // 6000+ Hz
}

export interface AudioSignal {
  /** Smoothed frequency bands, each 0–1 */
  bands: FrequencyBands
  /** Beat pulse intensity 0–1 (onset detection on bass) */
  beat: number
  /** Overall energy 0–1 (weighted mix of bands) */
  energy: number
  /** Accumulated phase counters — advance at audio-modulated rates.
   *  Use these instead of multiplying time by audio values. */
  phase: {
    base: number    // steady ~1.0/s advance
    bass: number    // modulated by bass energy
    mid: number     // modulated by mid energy
    treble: number  // modulated by treble energy
  }
  /** Elapsed time since processor started (seconds) */
  time: number
  /** Frame delta time (seconds) */
  dt: number
}

// Smoothing rates (Butterchurn-inspired asymmetric attack/release)
const ATTACK_RATE = 0.15   // fast rise — respond quickly to onsets
const RELEASE_RATE = 0.45  // slow fall — smooth, graceful decay
const BASE_FPS = 30        // reference FPS for rate adaptation

// Beat detection
const BEAT_THRESHOLD = 1.4
const BEAT_DECAY = 0.92

const BAND_KEYS = ['subBass', 'bass', 'mid', 'treble', 'presence'] as const

class AudioSignalProcessor {
  private frequencyData: Uint8Array | null = null

  // Smoothing state
  private smoothedBands: FrequencyBands = { subBass: 0, bass: 0, mid: 0, treble: 0, presence: 0 }

  // Beat detection state
  private smoothedBassForBeat = 0
  private prevBassForBeat = 0

  // Phase accumulators
  private _phase = { base: 0, bass: 0, mid: 0, treble: 0 }
  private totalTime = 0

  /** Current processed signal — read this after calling update() */
  readonly signal: AudioSignal = {
    bands: { subBass: 0, bass: 0, mid: 0, treble: 0, presence: 0 },
    beat: 0,
    energy: 0,
    phase: { base: 0, bass: 0, mid: 0, treble: 0 },
    time: 0,
    dt: 0,
  }

  /** Advance the processor by one frame. Call once per rAF tick. */
  update(dt: number): void {
    // Clamp dt to avoid explosion after tab-switch or debugger pause
    const clampedDt = Math.min(dt, 0.1)
    this.totalTime += clampedDt

    const raw = this.readRawBands()
    this.smooth(raw, clampedDt)
    this.detectBeat()
    this.accumulatePhase(clampedDt)
    this.writeSignal(clampedDt)
  }

  // --- Raw FFT reading ---

  private ensureFrequencyData(): Uint8Array | null {
    const node = analyserBridge.node
    if (!node) return null
    if (!this.frequencyData || this.frequencyData.length !== node.frequencyBinCount) {
      this.frequencyData = new Uint8Array(node.frequencyBinCount)
    }
    node.getByteFrequencyData(this.frequencyData)
    return this.frequencyData
  }

  private readRawBands(): FrequencyBands {
    const data = this.ensureFrequencyData()
    if (!data) return { subBass: 0, bass: 0, mid: 0, treble: 0, presence: 0 }

    const binCount = data.length
    const sampleRate = analyserBridge.node?.context.sampleRate ?? 44100
    const binWidth = sampleRate / (binCount * 2)

    const bin = (freq: number): number => Math.min(Math.round(freq / binWidth), binCount - 1)

    const subBassEnd = bin(60)
    const bassEnd = bin(250)
    const midEnd = bin(2000)
    const trebleEnd = bin(6000)

    return {
      subBass: avgBins(data, 0, subBassEnd),
      bass: avgBins(data, subBassEnd, bassEnd),
      mid: avgBins(data, bassEnd, midEnd),
      treble: avgBins(data, midEnd, trebleEnd),
      presence: avgBins(data, trebleEnd, binCount),
    }
  }

  // --- Asymmetric smoothing (Butterchurn pattern) ---

  private smooth(raw: FrequencyBands, dt: number): void {
    for (const key of BAND_KEYS) {
      const target = raw[key]
      const current = this.smoothedBands[key]
      const rate = target > current ? ATTACK_RATE : RELEASE_RATE
      // FPS-adaptive: rate^(baseFPS / actualFPS)
      const adapted = Math.pow(rate, (1 / BASE_FPS) / Math.max(dt, 0.001))
      this.smoothedBands[key] = current * adapted + target * (1 - adapted)
    }
  }

  // --- Beat detection ---

  private detectBeat(): void {
    const bassEnergy = this.smoothedBands.subBass * 0.4 + this.smoothedBands.bass * 0.6
    this.smoothedBassForBeat = this.smoothedBassForBeat * BEAT_DECAY + bassEnergy * (1 - BEAT_DECAY)

    let pulse = 0
    if (bassEnergy > this.smoothedBassForBeat * BEAT_THRESHOLD && bassEnergy > this.prevBassForBeat) {
      pulse = Math.min(
        (bassEnergy - this.smoothedBassForBeat) / Math.max(this.smoothedBassForBeat, 0.01),
        1
      )
    }
    this.prevBassForBeat = bassEnergy
    this.signal.beat = pulse
  }

  // --- Phase accumulators (audio modulates rate, not position) ---

  private accumulatePhase(dt: number): void {
    const b = this.smoothedBands
    this._phase.base += dt
    this._phase.bass += dt * (1.0 + b.bass * 0.5)
    this._phase.mid += dt * (1.0 + b.mid * 0.3)
    this._phase.treble += dt * (1.0 + b.treble * 0.4)
  }

  // --- Write to public signal ---

  private writeSignal(dt: number): void {
    const b = this.smoothedBands
    const s = this.signal
    s.bands.subBass = b.subBass
    s.bands.bass = b.bass
    s.bands.mid = b.mid
    s.bands.treble = b.treble
    s.bands.presence = b.presence
    s.energy = b.bass * 0.4 + b.mid * 0.3 + b.treble * 0.3
    s.phase.base = this._phase.base
    s.phase.bass = this._phase.bass
    s.phase.mid = this._phase.mid
    s.phase.treble = this._phase.treble
    s.time = this.totalTime
    s.dt = dt
  }
}

function avgBins(data: Uint8Array, start: number, end: number): number {
  if (start >= end) return 0
  let sum = 0
  for (let i = start; i < end && i < data.length; i++) sum += data[i]
  return sum / ((end - start) * 255)
}

/** Singleton processor — call update(dt) once per frame, read .signal anywhere */
export const audioSignalProcessor = new AudioSignalProcessor()
