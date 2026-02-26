/**
 * Preset system — shader selection, feedback parameters, auto-cycling, crossfade transitions.
 */

export type ShaderName = 'plasma' | 'starfield' | 'fractal' | 'ocean' | 'clouds' | 'creation' | 'voronoi' | 'deadMall' | 'deadOffice' | 'thunderstorm' | 'deepPool' | 'stormclouds' | 'terrain' | 'aurora' | 'solar' | 'menger' | 'neonCity' | 'desert' | 'forest' | 'nebula' | 'crystalCave' | 'bioluminescent' | 'warp' | 'glacier' | 'sandstorm' | 'eventHorizon' | 'fogPeaks' | 'frozenDunes' | 'infiniteCorridor' | 'neonRain' | 'backrooms' | 'causticPool' | 'electricNoise' | 'interiorLight' | 'deepStars' | 'hyperloop' | 'infiniteArcs' | 'backroomsDark' | 'electricStorm' | 'plasmaOrb' | 'organicCells'

export type PresetCategory = 'demoscene' | 'liminal' | 'seeds'

export interface FeedbackParams {
  decay: number     // 0–1, how much of previous frame to retain
  zoom: number      // per-frame zoom (1.0 = none, 1.005 = gentle zoom in)
  rotation: number  // radians per second of feedback rotation
}

export interface Preset {
  shader: ShaderName
  name: string
  category: PresetCategory
  feedback: FeedbackParams
}

export const PRESETS: Preset[] = [
  // --- Demoscene ---
  {
    shader: 'plasma',
    name: 'Amiga Plasma',
    category: 'demoscene',
    feedback: { decay: 0.82, zoom: 1.004, rotation: 0.15 },
  },
  {
    shader: 'starfield',
    name: 'Star Voyage',
    category: 'demoscene',
    feedback: { decay: 0.65, zoom: 1.006, rotation: 0.0 },
  },
  {
    shader: 'fractal',
    name: 'Kali Fractal',
    category: 'demoscene',
    feedback: { decay: 0.80, zoom: 1.003, rotation: 0.08 },
  },
  {
    shader: 'ocean',
    name: 'Deep Ocean',
    category: 'demoscene',
    feedback: { decay: 0.70, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'clouds',
    name: 'Nebula Drift',
    category: 'demoscene',
    feedback: { decay: 0.85, zoom: 1.003, rotation: 0.05 },
  },
  {
    shader: 'creation',
    name: 'Creation',
    category: 'demoscene',
    feedback: { decay: 0.78, zoom: 1.005, rotation: 0.12 },
  },
  {
    shader: 'voronoi',
    name: 'Voronoi Cells',
    category: 'demoscene',
    feedback: { decay: 0.72, zoom: 1.004, rotation: 0.06 },
  },
  // --- Liminal (stable, good enough to show) ---
  {
    shader: 'stormclouds',
    name: 'Stormclouds',
    category: 'liminal',
    feedback: { decay: 0.45, zoom: 1.001, rotation: 0.0 },
  },
  {
    shader: 'terrain',
    name: 'Mountain Flyover',
    category: 'liminal',
    feedback: { decay: 0.50, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'aurora',
    name: 'Aurora Borealis',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.001, rotation: 0.0 },
  },
  {
    shader: 'solar',
    name: 'Solar Surface',
    category: 'seeds',
    feedback: { decay: 0.50, zoom: 1.002, rotation: 0.02 },
  },
  {
    shader: 'menger',
    name: 'Menger Halls',
    category: 'seeds',
    feedback: { decay: 0.65, zoom: 1.003, rotation: 0.0 },
  },
{
    shader: 'neonCity',
    name: 'Neon City',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'desert',
    name: 'Desert Dunes',
    category: 'demoscene',
    feedback: { decay: 0.45, zoom: 1.001, rotation: 0.0 },
  },
  {
    shader: 'forest',
    name: 'Deep Forest',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'nebula',
    name: 'Deep Nebula',
    category: 'demoscene',
    feedback: { decay: 0.60, zoom: 1.003, rotation: 0.03 },
  },
  {
    shader: 'crystalCave',
    name: 'Crystal Cave',
    category: 'seeds',
    feedback: { decay: 0.60, zoom: 1.002, rotation: 0.01 },
  },
  {
    shader: 'bioluminescent',
    name: 'Bioluminescent Deep',
    category: 'seeds',
    feedback: { decay: 0.50, zoom: 1.001, rotation: 0.0 },
  },
  {
    shader: 'warp',
    name: 'Warp Speed',
    category: 'seeds',
    feedback: { decay: 0.40, zoom: 1.005, rotation: 0.0 },
  },
  {
    shader: 'glacier',
    name: 'Glacier Cave',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.002, rotation: 0.0 },
  },
  // --- Gen4 offspring ---
  {
    shader: 'sandstorm',
    name: 'Sandstorm',
    category: 'seeds',
    feedback: { decay: 0.50, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'eventHorizon',
    name: 'Event Horizon',
    category: 'seeds',
    feedback: { decay: 0.65, zoom: 1.003, rotation: 0.04 },
  },
  {
    shader: 'fogPeaks',
    name: 'Fog Peaks',
    category: 'seeds',
    feedback: { decay: 0.45, zoom: 1.001, rotation: 0.0 },
  },
  {
    shader: 'frozenDunes',
    name: 'Frozen Dunes',
    category: 'seeds',
    feedback: { decay: 0.50, zoom: 1.002, rotation: 0.0 },
  },
  // --- Gen5 offspring (more extreme) ---
  {
    shader: 'infiniteCorridor',
    name: 'Infinite Corridor',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'neonRain',
    name: 'Neon Rain',
    category: 'seeds',
    feedback: { decay: 0.60, zoom: 1.003, rotation: 0.0 },
  },
  {
    shader: 'backrooms',
    name: 'Backrooms',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.001, rotation: 0.0 },
  },
  {
    shader: 'causticPool',
    name: 'Caustic Pool',
    category: 'seeds',
    feedback: { decay: 0.75, zoom: 1.003, rotation: 0.05 },
  },
  {
    shader: 'electricNoise',
    name: 'Electric Noise',
    category: 'seeds',
    feedback: { decay: 0.80, zoom: 1.004, rotation: 0.1 },
  },
  {
    shader: 'interiorLight',
    name: 'Interior Light',
    category: 'seeds',
    feedback: { decay: 0.70, zoom: 1.002, rotation: 0.0 },
  },
  {
    shader: 'deepStars',
    name: 'Deep Stars',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.003, rotation: 0.02 },
  },
  {
    shader: 'hyperloop',
    name: 'Hyperloop',
    category: 'seeds',
    feedback: { decay: 0.75, zoom: 1.006, rotation: 0.08 },
  },
  {
    shader: 'infiniteArcs',
    name: 'Infinite Arcs',
    category: 'seeds',
    feedback: { decay: 0.65, zoom: 1.004, rotation: 0.03 },
  },
  // --- Gen6: perturbation / mutation / fusion ---
  {
    shader: 'backroomsDark',
    name: 'Backrooms Dark',
    category: 'seeds',
    feedback: { decay: 0.55, zoom: 1.001, rotation: 0.0 },
  },
  {
    shader: 'electricStorm',
    name: 'Electric Storm',
    category: 'seeds',
    feedback: { decay: 0.78, zoom: 1.004, rotation: 0.08 },
  },
  {
    shader: 'plasmaOrb',
    name: 'Plasma Orb',
    category: 'seeds',
    feedback: { decay: 0.70, zoom: 1.003, rotation: 0.06 },
  },
  {
    shader: 'organicCells',
    name: 'Organic Cells',
    category: 'seeds',
    feedback: { decay: 0.65, zoom: 1.002, rotation: 0.0 },
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
  // Stay within the same category when auto-cycling
  const currentCategory = PRESETS[currentIndex].category
  const candidates = PRESETS
    .map((p, i) => ({ index: i, category: p.category }))
    .filter(p => p.category === currentCategory && p.index !== currentIndex)

  if (candidates.length === 0) return currentIndex
  return candidates[Math.floor(Math.random() * candidates.length)].index
}

function startTransition(state: PresetState): void {
  state.nextIndex = pickNextIndex(state.currentIndex)
  state.crossfadeProgress = 0
  state.transitioning = true
}

/** Snap any in-progress transition immediately so manual switching chains correctly */
function snapTransition(state: PresetState): void {
  if (state.transitioning && state.nextIndex !== null) {
    state.currentIndex = state.nextIndex
    state.nextIndex = null
    state.crossfadeProgress = 0
    state.transitioning = false
  }
}

function startTransitionTo(state: PresetState, targetIndex: number): void {
  snapTransition(state)
  if (targetIndex === state.currentIndex) return
  state.nextIndex = targetIndex
  state.crossfadeProgress = 0
  state.transitioning = true
  state.lastSwitchTime = performance.now()
}

/** Cycle to the next preset across all presets */
export function cyclePreset(state: PresetState, direction: 1 | -1): string {
  snapTransition(state)
  const nextIndex = (state.currentIndex + direction + PRESETS.length) % PRESETS.length
  const target = PRESETS[nextIndex]

  startTransitionTo(state, nextIndex)
  return target.name
}

/** Switch to the first preset in a different category */
export function switchCategory(state: PresetState, direction: 1 | -1): string {
  snapTransition(state)
  const categories: PresetCategory[] = ['demoscene', 'liminal', 'seeds']
  const currentCategory = PRESETS[state.currentIndex].category
  const currentCatIdx = categories.indexOf(currentCategory)
  const nextCatIdx = (currentCatIdx + direction + categories.length) % categories.length
  const nextCategory = categories[nextCatIdx]

  const firstInCategory = PRESETS.findIndex(p => p.category === nextCategory)
  if (firstInCategory === -1) return PRESETS[state.currentIndex].name

  startTransitionTo(state, firstInCategory)
  return `${nextCategory}: ${PRESETS[firstInCategory].name}`
}

/** Get the current preset name, category, and position info */
export function currentPresetInfo(state: PresetState): { name: string; category: PresetCategory; position: string } {
  const preset = PRESETS[state.currentIndex]
  const inCategory = PRESETS.filter(p => p.category === preset.category)
  const posInCategory = inCategory.findIndex(p => p.shader === preset.shader) + 1
  return {
    name: preset.name,
    category: preset.category,
    position: `${posInCategory}/${inCategory.length}`,
  }
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
