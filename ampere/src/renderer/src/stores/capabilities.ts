import { create } from 'zustand'

/**
 * What this install can actually do.
 *
 * Two things vary between installs and neither is a preference:
 *
 * - **Semantic index** — CLAP embeddings and RQ-VAE Semantic IDs, produced by
 *   the standalone `vq` Python project. Most installs will never run it.
 * - **Audio features** — 56-dim Meyda vectors, extracted in-app, needing
 *   nothing external.
 *
 * These are *derived*, never set. A flag someone can toggle is a flag that can
 * disagree with the database, and the failure mode is a feature that claims to
 * work and then does nothing. Truth comes from counting rows.
 *
 * The rule for anything depending on either: read the capability, and when it
 * is absent either hide the control or say plainly what is missing. Never
 * offer something that will quietly do nothing.
 */
interface CapabilityState {
  /** Tracks with CLAP embeddings + Semantic IDs. */
  semanticTracks: number
  /** Tracks with in-app Meyda feature vectors. */
  featureTracks: number
  loaded: boolean

  /** Journeys need the Semantic ID hierarchy; nothing else does. */
  hasSemanticIndex: () => boolean
  /** Drift and session need comparable vectors from either source. */
  hasNavigableFeatures: () => boolean

  refresh: () => Promise<void>
}

export const useCapabilityStore = create<CapabilityState>((set, get) => ({
  semanticTracks: 0,
  featureTracks: 0,
  loaded: false,

  hasSemanticIndex: () => get().semanticTracks > 0,
  hasNavigableFeatures: () => get().semanticTracks > 0 || get().featureTracks > 0,

  refresh: async () => {
    try {
      const [semanticTracks, featureTracks] = await Promise.all([
        window.api.getSemanticCount().catch(() => 0),
        window.api.getFeatureCount().catch(() => 0)
      ])
      set({ semanticTracks, featureTracks, loaded: true })
    } catch (err) {
      console.error('Failed to read capabilities', err)
      set({ loaded: true })
    }
  }
}))
