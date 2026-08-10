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
import { createDriftState, DriftState, NavModeId, NavStep, selectNext } from '../riemann/modes'
import { sessionSignals, SessionSignal } from '../riemann/session-affinity'

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
   * Ask the active mode for the next track. Null when it cannot move.
   * `globalPreference` is supplied by the caller — the library store owns
   * inferred ratings, and reaching back for them here would make the two
   * stores mutually dependent.
   */
  next: (
    mode: NavModeId,
    currentTrackId: string,
    globalPreference?: (trackId: string) => number
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

  next: (mode, currentTrackId, globalPreference) => {
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
      session: globalPreference ? { signals, globalPreference } : undefined
    })
    set({ lastTier: step?.tier ?? null })
    return step
  }
}))
