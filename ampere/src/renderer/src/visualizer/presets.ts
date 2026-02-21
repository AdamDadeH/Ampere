/**
 * Preset system — shader selection, feedback parameters, auto-cycling, crossfade transitions.
 */

export type ShaderName = 'plasma' | 'tunnel' | 'starfield' | 'fractal' | 'ocean' | 'clouds' | 'creation' | 'voronoi'

export interface FeedbackParams {
  decay: number     // 0–1, how much of previous frame to retain
  zoom: number      // per-frame zoom (1.0 = none, 1.005 = gentle zoom in)
  rotation: number  // radians per second of feedback rotation
}

export interface Preset {
  shader: ShaderName
  name: string
  feedback: FeedbackParams
}

export const PRESETS: Preset[] = [
  {
    shader: 'plasma',
    name: 'Amiga Plasma',
    feedback: { decay: 0.82, zoom: 1.004, rotation: 0.15 },
  },
  {
    shader: 'tunnel',
    name: 'Infinite Tunnel',
    feedback: { decay: 0.88, zoom: 1.008, rotation: 0.0 },
  },
  {
    shader: 'starfield',
    name: 'Star Voyage',
    feedback: { decay: 0.65, zoom: 1.006, rotation: 0.0 },
  },
  {
    shader: 'fractal',
    name: 'Kali Fractal',
    feedback: { decay: 0.80, zoom: 1.003, rotation: 0.08 },
  },
  {
    shader: 'ocean',
    name: 'Deep Ocean',
    feedback: { decay: 0.70, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'clouds',
    name: 'Nebula Drift',
    feedback: { decay: 0.85, zoom: 1.003, rotation: 0.05 },
  },
  {
    shader: 'creation',
    name: 'Creation',
    feedback: { decay: 0.78, zoom: 1.005, rotation: 0.12 },
  },
  {
    shader: 'voronoi',
    name: 'Voronoi Cells',
    feedback: { decay: 0.72, zoom: 1.004, rotation: 0.06 },
  },
]

const CYCLE_INTERVAL = 30_000   // 30 seconds between auto-switches
const CROSSFADE_DURATION = 2.0  // seconds
const BEAT_SWITCH_CHANCE = 0.08 // chance per strong beat to trigger early switch

export interface PresetState {
  currentIndex: number
  nextIndex: number | null
  crossfadeProgress: number   // 0 = fully current, 1 = fully next
  lastSwitchTime: number
  transitioning: boolean
}

export function createPresetState(): PresetState {
  return {
    currentIndex: 0,
    nextIndex: null,
    crossfadeProgress: 0,
    lastSwitchTime: performance.now(),
    transitioning: false,
  }
}

function pickNextIndex(currentIndex: number): number {
  let next: number
  do {
    next = Math.floor(Math.random() * PRESETS.length)
  } while (next === currentIndex && PRESETS.length > 1)
  return next
}

function startTransition(state: PresetState): void {
  state.nextIndex = pickNextIndex(state.currentIndex)
  state.crossfadeProgress = 0
  state.transitioning = true
}

export interface PresetFrame {
  current: ShaderName
  next: ShaderName | null
  mix: number
  feedback: FeedbackParams
}

/**
 * Update preset state each frame. Returns current/next shader, crossfade mix,
 * and the active feedback parameters (interpolated during transitions).
 */
export function updatePresets(
  state: PresetState,
  dt: number,
  beatPulse: number,
  trackChanged: boolean
): PresetFrame {
  const now = performance.now()

  // Trigger transition on track change
  if (trackChanged && !state.transitioning) {
    startTransition(state)
    state.lastSwitchTime = now
  }

  // Auto-cycle timer
  if (!state.transitioning && now - state.lastSwitchTime > CYCLE_INTERVAL) {
    startTransition(state)
    state.lastSwitchTime = now
  }

  // Beat-triggered early switch
  if (!state.transitioning && beatPulse > 0.7 && Math.random() < BEAT_SWITCH_CHANCE) {
    startTransition(state)
    state.lastSwitchTime = now
  }

  // Advance crossfade with cosine easing (slow start, fast middle, slow end)
  if (state.transitioning && state.nextIndex !== null) {
    state.crossfadeProgress += dt / CROSSFADE_DURATION
    if (state.crossfadeProgress >= 1.0) {
      state.currentIndex = state.nextIndex
      state.nextIndex = null
      state.crossfadeProgress = 0
      state.transitioning = false
    }
  }

  // Cosine-eased mix (Milkdrop pattern)
  const rawMix = state.crossfadeProgress
  const easedMix = 0.5 - 0.5 * Math.cos(rawMix * Math.PI)

  // Interpolate feedback params during transition
  const curFB = PRESETS[state.currentIndex].feedback
  let feedback: FeedbackParams
  if (state.nextIndex !== null) {
    const nxtFB = PRESETS[state.nextIndex].feedback
    feedback = {
      decay: curFB.decay + (nxtFB.decay - curFB.decay) * easedMix,
      zoom: curFB.zoom + (nxtFB.zoom - curFB.zoom) * easedMix,
      rotation: curFB.rotation + (nxtFB.rotation - curFB.rotation) * easedMix,
    }
  } else {
    feedback = curFB
  }

  return {
    current: PRESETS[state.currentIndex].shader,
    next: state.nextIndex !== null ? PRESETS[state.nextIndex].shader : null,
    mix: easedMix,
    feedback,
  }
}
