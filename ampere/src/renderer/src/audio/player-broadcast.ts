import type { PlayerState } from '../../../../preload/index'

/**
 * Pure player-state broadcast helpers, extracted from AudioEngine so they can
 * be unit-tested headlessly (no DOM, no React). The compact (Winamp) window is
 * the only consumer of these frames, so the loop should do nothing when it is
 * closed.
 */

interface BroadcastTrack {
  title: string | null
  file_name: string
  artist: string | null
  album: string | null
  artwork_path: string | null
  bitrate: number | null
  sample_rate: number | null
  codec: string | null
  duration: number
}

export interface BroadcastState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  currentTrack: BroadcastTrack | null
  queue: BroadcastTrack[]
  queueIndex: number
  shuffle: boolean
  repeatMode: 'off' | 'one' | 'all'
  eqEnabled: boolean
  eqPreamp: number
  eqBands: number[]
}

// Cache the projected queueTracks; only recompute when the queue array
// reference changes (it's stable except on real queue mutations).
let cachedQueueRef: unknown = null
let cachedQueueTracks: { title: string; artist: string | null; duration: number }[] = []

export function buildPlayerState(state: BroadcastState, frequencyData: number[]): PlayerState {
  if (state.queue !== cachedQueueRef) {
    cachedQueueRef = state.queue
    cachedQueueTracks = state.queue.map(t => ({
      title: t.title || t.file_name,
      artist: t.artist,
      duration: t.duration,
    }))
  }

  const track = state.currentTrack!
  return {
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    duration: state.duration,
    volume: state.volume,
    trackTitle: track.title || track.file_name,
    trackArtist: track.artist,
    trackAlbum: track.album,
    artworkPath: track.artwork_path,
    bitrate: track.bitrate,
    sampleRate: track.sample_rate,
    codec: track.codec,
    queueIndex: state.queueIndex,
    queueLength: state.queue.length,
    shuffle: state.shuffle,
    repeatMode: state.repeatMode,
    frequencyData,
    eqEnabled: state.eqEnabled,
    eqPreamp: state.eqPreamp,
    eqBands: state.eqBands,
    queueTracks: cachedQueueTracks,
  }
}

/**
 * Decide-and-send for one broadcast tick. Returns true iff a frame was sent.
 * Skips entirely when the compact window is closed (no listener) or no track
 * is loaded — this stops the 4Hz loop from extracting frequency data and
 * crossing the IPC bridge during normal full-window playback.
 */
export function runBroadcastTick(opts: {
  compactOpen: boolean
  state: BroadcastState
  getFrequencyData: () => number[]
  send: (state: PlayerState) => void
}): boolean {
  if (!opts.compactOpen || !opts.state.currentTrack) return false
  opts.send(buildPlayerState(opts.state, opts.getFrequencyData()))
  return true
}
