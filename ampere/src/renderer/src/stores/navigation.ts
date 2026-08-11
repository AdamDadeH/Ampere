/**
 * Navigation state for the graph-walking play modes.
 *
 * Lives outside the library store because it is a separate concern, and
 * outside RiemannNavigator because modes must keep working when the 3D view
 * is not mounted — that is the whole point of extracting them.
 *
 * The 3D view already builds this graph for its scene, so it hands the result
 * over via `adoptData` instead of making the app load and project it twice.
 */
import { create } from 'zustand'
import { FeatureSource, NavData, loadNavData, bestAvailableSource } from '../riemann/nav-data'
import {
  cloneDriftState, createDriftState, DriftState, NAV_MODES, NavModeId, NavStep, selectNext
} from '../riemann/modes'
import { sessionSignals, SessionSignal } from '../riemann/session-affinity'

/**
 * The next pick, decided while the current track is still playing.
 *
 * Computed early not to hide inference latency — that is milliseconds — but so
 * the chosen track's audio can be prefetched. For a cloud-backed library that
 * is the difference between instant and several seconds of materialising.
 *
 * Two branches because the answer can depend on how the current track ends:
 * sustaining it and abandoning it push the session in different directions.
 * Outcome-independent modes fill both with the same step.
 */
interface PendingStep {
  /** Track that was playing when this was computed; stale if it has changed. */
  fromTrackId: string
  mode: NavModeId
  onListen: NavStep | null
  onSkip: NavStep | null
}

interface NavigationState {
  data: NavData | null
  isLoading: boolean
  source: FeatureSource
  driftState: DriftState | null
  /** Journey coherence, 0–1. Higher keeps steps closer to the current track. */
  coherence: number
  /** Semantic tier of the last journey step, for display. */
  lastTier: string | null
  /** Signed preference signals from the session in progress, oldest first. */
  signals: SessionSignal[]
  /** Next pick decided during playback, or null when nothing is precomputed. */
  pending: PendingStep | null

  /** Load the graph if it isn't loaded already. Safe to call repeatedly. */
  ensureLoaded: () => Promise<void>
  /** Take a graph the 3D view has already built. */
  adoptData: (data: NavData, source: FeatureSource) => void
  setSource: (source: FeatureSource) => Promise<void>
  setCoherence: (coherence: number) => void
  /** Begin a fresh walk from a track, discarding visit history. */
  resetWalk: (trackId: string) => void
  /** Record that a track was played, so a walk won't revisit it. */
  markVisited: (trackId: string) => void
  /** Pull the live session's events and reduce them to signals. */
  refreshSession: () => Promise<void>
  /**
   * Decide the next track (both branches) without committing to it, and warm
   * its audio. Speculative: runs against a cloned walk so nothing is marked
   * visited until a step is actually taken.
   */
  precompute: (
    mode: NavModeId,
    currentTrackId: string,
    globalPreference: (trackId: string) => number,
    lastPlayedAt?: (trackId: string) => number | null
  ) => void
  /**
   * Take the precomputed step for how the track actually ended, committing it
   * to the real walk. Null when nothing usable was precomputed.
   */
  consumePending: (currentTrackId: string, mode: NavModeId, sustained: boolean) => NavStep | null
  /**
   * Ask the active mode for the next track. Null when it cannot move.
   * `globalPreference` is supplied by the caller — the library store owns
   * inferred ratings, and reaching back for them here would make the two
   * stores mutually dependent.
   */
  next: (
    mode: NavModeId,
    currentTrackId: string,
    globalPreference?: (trackId: string) => number,
    lastPlayedAt?: (trackId: string) => number | null
  ) => NavStep | null
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  data: null,
  isLoading: false,
  source: 'clap',
  driftState: null,
  coherence: 0.7,
  lastTier: null,
  signals: [],
  pending: null,

  ensureLoaded: async () => {
    const { data, isLoading } = get()
    if (data || isLoading) return
    set({ isLoading: true })
    try {
      // Most installs never run the vq pipeline, so choose whatever features
      // exist rather than assuming CLAP.
      const source = await bestAvailableSource()
      if (!source) { set({ data: null, isLoading: false }); return }
      const loaded = await loadNavData(source)
      set({ data: loaded, source, isLoading: false })
    } catch (err) {
      console.error('Failed to load navigation data', err)
      set({ isLoading: false })
    }
  },

  adoptData: (data, source) => set({ data, source }),

  setSource: async (source) => {
    set({ source, data: null, driftState: null, lastTier: null, isLoading: true })
    try {
      const loaded = await loadNavData(source)
      set({ data: loaded, isLoading: false })
    } catch (err) {
      console.error('Failed to load navigation data', err)
      set({ isLoading: false })
    }
  },

  setCoherence: (coherence) => set({ coherence }),

  resetWalk: (trackId) => set({ driftState: createDriftState(trackId), lastTier: null }),

  markVisited: (trackId) => {
    const { driftState } = get()
    if (!driftState) return
    driftState.visited.add(trackId)
    driftState.trajectory.push(trackId)
  },

  refreshSession: async () => {
    try {
      const events = await window.api.getCurrentSessionFeedback()
      set({ signals: sessionSignals(events) })
    } catch (err) {
      console.error('Failed to load session feedback', err)
    }
  },

  precompute: (mode, currentTrackId, globalPreference, lastPlayedAt) => {
    const { data, coherence, signals, driftState } = get()
    if (!data) return

    const base = driftState ?? createDriftState(currentTrackId)
    const nowMs = Date.now()
    const build = (hypothetical: SessionSignal[]): NavStep | null =>
      selectNext(mode, {
        data,
        // Cloned: a speculative step must not mark anything visited.
        state: cloneDriftState(base),
        currentTrackId,
        coherence,
        session: { signals: hypothetical, globalPreference, lastPlayedAt, nowMs }
      })

    let onListen: NavStep | null
    let onSkip: NavStep | null
    if (NAV_MODES[mode]?.outcomeDependent) {
      onListen = build([...signals, { trackId: currentTrackId, strength: 1 }])
      onSkip = build([...signals, { trackId: currentTrackId, strength: -1 }])
    } else {
      onListen = build(signals)
      onSkip = onListen
    }

    set({ pending: { fromTrackId: currentTrackId, mode, onListen, onSkip } })

    // Warm whichever tracks could come next. Distinct ids only — the two
    // branches usually agree for outcome-independent modes.
    const ids = Array.from(new Set([onListen?.trackId, onSkip?.trackId].filter(Boolean) as string[]))
    if (ids.length > 0) window.api.prefetchTracks(ids).catch(console.error)
  },

  consumePending: (currentTrackId, mode, sustained) => {
    const { pending, driftState } = get()
    if (!pending) return null
    // Anything can have happened since — a manual pick, a mode switch.
    if (pending.fromTrackId !== currentTrackId || pending.mode !== mode) {
      set({ pending: null })
      return null
    }

    const step = sustained ? pending.onListen : pending.onSkip
    set({ pending: null })
    if (!step) return null

    // Commit to the real walk only now that the step is actually being taken.
    const committed = driftState ?? createDriftState(currentTrackId)
    committed.visited.add(step.trackId)
    committed.trajectory.push(step.trackId)
    set({ driftState: committed, lastTier: step.tier })
    return step
  },

  next: (mode, currentTrackId, globalPreference, lastPlayedAt) => {
    const { data, coherence, signals } = get()
    if (!data) return null

    let { driftState } = get()
    if (!driftState) {
      driftState = createDriftState(currentTrackId)
      set({ driftState })
    }

    const step = selectNext(mode, {
      data,
      state: driftState,
      currentTrackId,
      coherence,
      session: globalPreference
        ? { signals, globalPreference, lastPlayedAt, nowMs: Date.now() }
        : undefined
    })
    set({ lastTier: step?.tier ?? null })
    return step
  }
}))
