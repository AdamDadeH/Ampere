/**
 * Navigation mode registry.
 *
 * A mode answers one question: given where we are, which track is next?
 * It returns a choice — it does not play anything, move a camera, or touch a
 * store. That separation is what lets the same mode run from the main player
 * and the 3D view without either one owning the other's side effects.
 *
 * Adding a mode means adding an entry here and a label in NAV_MODES.
 */
import { createDriftState, embeddingDriftNext, DriftState } from './navigation'
import { semanticDriftNext } from './semantic-drift'
import { NavData } from './nav-data'
import { evidenceWeight, pickBest, SessionSignal } from './session-affinity'

/** Modes that walk a graph, as opposed to the queue orders (linear/random). */
export type NavModeId = 'drift' | 'journey' | 'session'

/** Every play mode the selector offers. */
export type PlayMode = 'linear' | 'random' | NavModeId

export interface NavStep {
  trackId: string
  /**
   * Provenance recorded on the resulting `track_started` event. Journeys
   * encode tier + coherence into the string so the policy's bias is
   * measurable from the log rather than invisible.
   *   drift   → 'drift'
   *   journey → 'journey:<tier>:<coherence>'   e.g. 'journey:texture:0.70'
   */
  source: string
  /** Semantic tier the journey stepped along; null for spatial drift. */
  tier: string | null
}

export interface NavContext {
  data: NavData
  state: DriftState
  currentTrackId: string
  /** Journey coherence, 0–1. Ignored by spatial drift. */
  coherence: number
  /**
   * Live session context. Absent when nothing has been played yet this
   * session, in which case the session mode has nothing to go on.
   */
  session?: {
    signals: SessionSignal[]
    /** Global preference for a track, normalized to [0, 1]. */
    globalPreference: (trackId: string) => number
  }
}

export interface NavMode {
  id: NavModeId
  label: string
  /** Short description for the selector UI. */
  description: string
  /** Whether this mode can run against the given graph. */
  isAvailable: (data: NavData) => boolean
  next: (ctx: NavContext) => NavStep | null
}

const spatialDrift: NavMode = {
  id: 'drift',
  label: 'Drift',
  description: 'Steps to the nearest unheard track in audio-embedding space.',
  isAvailable: (data) => data.unitVectors.size > 0,
  next: ({ data, state, currentTrackId }) => {
    const trackId = embeddingDriftNext(state, data.unitVectors, currentTrackId)
    return trackId ? { trackId, source: 'drift', tier: null } : null
  }
}

const semanticJourney: NavMode = {
  id: 'journey',
  label: 'Journey',
  description: 'Walks the Semantic ID hierarchy — needs CLAP embeddings.',
  isAvailable: (data) => data.semanticIndex !== null,
  next: ({ data, state, currentTrackId, coherence }) => {
    if (!data.semanticIndex) return null
    const step = semanticDriftNext(
      state,
      data.semanticIndex,
      currentTrackId,
      { coherence },
      data.featureMap
    )
    if (!step) return null
    return {
      trackId: step.trackId,
      source: `journey:${step.tier}:${coherence.toFixed(2)}`,
      tier: step.tier
    }
  }
}

const sessionMode: NavMode = {
  id: 'session',
  label: 'Session',
  description: 'Follows what you are sustaining right now, over your overall taste.',
  isAvailable: (data) => data.unitVectors.size > 0,
  next: ({ data, state, session }) => {
    if (!session) return null
    const candidates: { trackId: string; globalPreference: number }[] = []
    for (const trackId of data.unitVectors.keys()) {
      candidates.push({ trackId, globalPreference: session.globalPreference(trackId) })
    }
    const best = pickBest(candidates, session.signals, data.unitVectors, state.visited)
    if (!best) return null
    // Record how much the session was actually steering, so a play can later
    // be attributed to session evidence rather than to the global prior.
    const beta = evidenceWeight(session.signals.length)
    return {
      trackId: best.trackId,
      source: `session:${session.signals.length}:${beta.toFixed(2)}`,
      tier: null
    }
  }
}

export const NAV_MODES: Record<NavModeId, NavMode> = {
  drift: spatialDrift,
  journey: semanticJourney,
  session: sessionMode
}

export function isNavMode(mode: PlayMode): mode is NavModeId {
  return mode === 'drift' || mode === 'journey' || mode === 'session'
}

/**
 * Pick the next track for a nav mode.
 *
 * A journey against a graph with no Semantic IDs (the Meyda map) falls back to
 * spatial drift, matching what the 3D view did before this was extracted.
 * Returns null when neither can move — the caller decides what to do then.
 */
export function selectNext(mode: NavModeId, ctx: NavContext): NavStep | null {
  const chosen = NAV_MODES[mode]
  if (chosen && chosen.isAvailable(ctx.data)) return chosen.next(ctx)
  if (mode === 'journey') return spatialDrift.next(ctx)
  return null
}

export { createDriftState }
export type { DriftState }
