import { create } from 'zustand'
import { getAttentionWeight } from './attention'
import { buildShufflePermutation } from '../utils/shuffle'
import { isNavMode, PlayMode } from '../riemann/modes'
import { useNavigationStore } from './navigation'

export interface Track {
  id: string
  embedded_id: string | null
  file_path: string
  file_name: string
  file_size: number
  title: string | null
  artist: string | null
  album: string | null
  album_artist: string | null
  genre: string | null
  year: number | null
  track_number: number | null
  disc_number: number | null
  duration: number
  bitrate: number | null
  sample_rate: number | null
  codec: string | null
  artwork_path: string | null
  play_count: number
  last_played: string | null
  rating: number
  date_added: string
  date_modified: string
  sync_status: string
  cloud_path: string | null
  last_accessed: string | null
  pinned: number
  source_id: string | null
  inferred_rating: number | null
}

export interface ArtistInfo {
  artist: string
  track_count: number
  album_count: number
}

export interface AlbumInfo {
  album: string
  artist: string | null
  album_artist: string | null
  track_count: number
  artwork_path: string | null
  year: number | null
}

export interface ScanProgress {
  phase: 'discovering' | 'scanning' | 'complete' | 'error'
  current: number
  total: number
  currentFile?: string
  error?: string
}

export interface LibraryStats {
  total_tracks: number
  total_artists: number
  total_album_artists: number
  total_albums: number
  total_duration: number
}

type View = 'all-tracks' | 'artists' | 'albums' | 'artist-detail' | 'album-detail' | 'riemann' | 'demoscene' | 'settings'
type ArtistViewMode = 'track' | 'album'

interface LibraryState {
  // Library data
  /** The currently displayed list — filtered by search, artist, or album view. */
  tracks: Track[]
  /**
   * The whole library, independent of any filter. Nav modes walk a graph over
   * every track, so resolving a step against the filtered `tracks` would miss
   * anything outside the current view and silently fall back to queue order.
   */
  libraryTracks: Track[]
  artists: ArtistInfo[]
  albumArtists: ArtistInfo[]
  albums: AlbumInfo[]
  stats: LibraryStats | null

  // Navigation
  currentView: View
  /**
   * UI surface the user last acted from — stamped onto every feedback event.
   * Usually tracks `currentView`, but the compact window drives playback
   * remotely from a different renderer, so it sets this explicitly.
   */
  activeSurface: string
  artistViewMode: ArtistViewMode
  selectedArtist: string | null
  selectedAlbum: string | null
  searchQuery: string

  // Player
  currentTrack: Track | null
  isPlaying: boolean
  queue: Track[]
  queueIndex: number
  volume: number
  currentTime: number
  duration: number
  seekTarget: number | null
  /**
   * The single active play strategy: queue orders ('linear' / 'random') or a
   * graph-walking nav mode. Replaces the old shuffle-boolean-plus-driftNext
   * pair, where precedence between the two was implicit.
   */
  playMode: PlayMode
  /** Mode to restore when the random override is switched back off. */
  modeBeforeRandom: PlayMode
  /** Mirrors `playMode === 'random'`. Kept so PlayerBar and the compact window need no change. */
  shuffle: boolean
  shuffledIndices: number[]
  shufflePosition: number
  repeatMode: 'off' | 'one' | 'all'

  // EQ
  eqEnabled: boolean
  eqPreamp: number
  eqBands: number[]

  // Scan
  scanProgress: ScanProgress | null
  isScanning: boolean

  // Cloud-first download state
  downloadingTrackId: string | null

  // Navigation override — set by Riemann navigator for drift/walk modes
  driftNext: (() => void) | null

  // Actions
  loadLibrary: () => Promise<void>
  selectFolder: () => Promise<void>
  setView: (view: View) => void
  setActiveSurface: (surface: string) => void
  setArtistViewMode: (mode: ArtistViewMode) => void
  selectArtist: (artist: string) => void
  selectAlbum: (album: string, artist?: string) => void
  setSearchQuery: (query: string) => void
  playTrack: (track: Track, trackList?: Track[], source?: string) => void
  togglePlayPause: () => void
  nextTrack: (reason?: 'auto_advance' | 'manual_skip' | 'not_feeling_it' | 'like_not_now') => void
  prevTrack: () => void
  setVolume: (volume: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  seekTo: (time: number) => void
  setPlayMode: (mode: PlayMode) => void
  /** Quick override to random; toggling off returns to the previous mode. */
  toggleShuffle: () => void
  cycleRepeat: () => void
  stopPlayback: () => void
  updatePlayCount: (trackId: string) => void
  setRating: (trackId: string, rating: number) => Promise<void>
  setEqEnabled: (enabled: boolean) => void
  setEqPreamp: (gain: number) => void
  setEqBand: (index: number, gain: number) => void
  setScanProgress: (progress: ScanProgress | null) => void
  setDriftNext: (fn: (() => void) | null) => void
  getUpcomingTrackIds: (count: number) => string[]
  togglePin: (trackId: string) => Promise<void>
  recordFeedback: (trackId: string, eventType: string, eventValue: number | null, source: string | null) => void
  lovingThis: () => void
  likeNotNow: () => void
  notFeelingIt: () => void
  applyInferredRatings: (ratings: { id: string; inferred_rating: number }[]) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  libraryTracks: [],
  artists: [],
  albumArtists: [],
  albums: [],
  stats: null,
  currentView: 'all-tracks',
  activeSurface: 'all-tracks',
  artistViewMode: 'album',
  selectedArtist: null,
  selectedAlbum: null,
  searchQuery: '',
  currentTrack: null,
  isPlaying: false,
  queue: [],
  queueIndex: -1,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  seekTarget: null,
  playMode: 'linear',
  modeBeforeRandom: 'linear',
  shuffle: false,
  shuffledIndices: [],
  shufflePosition: -1,
  repeatMode: 'off',
  eqEnabled: false,
  eqPreamp: 0,
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  scanProgress: null,
  isScanning: false,
  downloadingTrackId: null,
  driftNext: null,

  loadLibrary: async () => {
    const [tracks, artists, albumArtists, albums, stats] = await Promise.all([
      window.api.getTracks() as Promise<Track[]>,
      window.api.getArtists() as Promise<ArtistInfo[]>,
      window.api.getAlbumArtists() as Promise<ArtistInfo[]>,
      window.api.getAlbums() as Promise<AlbumInfo[]>,
      window.api.getLibraryStats() as Promise<LibraryStats>
    ])
    set({ tracks, libraryTracks: tracks, artists, albumArtists, albums, stats })
  },

  selectFolder: async () => {
    set({ isScanning: true })
    await window.api.selectFolder()
  },

  setActiveSurface: (surface) => set({ activeSurface: surface }),

  setView: (view) => {
    set({ currentView: view, activeSurface: view, selectedArtist: null, selectedAlbum: null })
    if (view === 'all-tracks') {
      get().loadLibrary()
    }
  },

  setArtistViewMode: (mode) => {
    set({ artistViewMode: mode, selectedArtist: null, currentView: 'all-tracks', activeSurface: 'all-tracks' })
  },

  selectArtist: async (artist) => {
    const mode = get().artistViewMode
    let tracks: Track[]
    let albums: AlbumInfo[]
    if (mode === 'album') {
      tracks = await window.api.getTracksByAlbumArtist(artist) as Track[]
      albums = await window.api.getAlbumsByAlbumArtist(artist) as AlbumInfo[]
    } else {
      tracks = await window.api.getTracks({ artist }) as Track[]
      albums = await window.api.getAlbums(artist) as AlbumInfo[]
    }
    set({
      currentView: 'artist-detail',
      activeSurface: 'artist-detail',
      selectedArtist: artist,
      selectedAlbum: null,
      tracks,
      albums
    })
  },

  selectAlbum: async (album, artist?) => {
    const tracks = await window.api.getTracks({ album, artist }) as Track[]
    set({
      currentView: 'album-detail',
      activeSurface: 'album-detail',
      selectedAlbum: album,
      tracks
    })
  },

  setSearchQuery: async (query) => {
    set({ searchQuery: query })
    if (query.trim()) {
      const tracks = await window.api.searchTracks(query) as Track[]
      set({ tracks })
    } else {
      get().loadLibrary()
    }
  },

  playTrack: (track, trackList, source) => {
    const list = trackList || get().tracks
    const index = list.findIndex(t => t.id === track.id)
    const seqIndex = index >= 0 ? index : 0
    const { shuffle, queue } = get()

    if (shuffle) {
      // Check if queue identity changed
      const queueChanged = list !== queue || list.length !== queue.length
      if (queueChanged) {
        // New queue — regenerate permutation with this track at position 0
        const perm = buildShufflePermutation(list.length, seqIndex, list.map(t => t.id))
        set({
          currentTrack: track,
          isPlaying: true,
          queue: list,
          queueIndex: seqIndex,
          shuffledIndices: perm,
          shufflePosition: 0
        })
      } else {
        // Same queue — find selected track in permutation
        const { shuffledIndices } = get()
        const posInPerm = shuffledIndices.indexOf(seqIndex)
        set({
          currentTrack: track,
          isPlaying: true,
          queue: list,
          queueIndex: seqIndex,
          shufflePosition: posInPerm >= 0 ? posInPerm : 0
        })
      }
    } else {
      set({
        currentTrack: track,
        isPlaying: true,
        queue: list,
        queueIndex: seqIndex
      })
    }
    get().recordFeedback(track.id, 'track_started', null, source || 'intentional_select')
  },

  togglePlayPause: () => {
    set(state => ({ isPlaying: !state.isPlaying }))
  },

  nextTrack: (reason) => {
    const { queue, queueIndex, shuffle, shuffledIndices, shufflePosition, repeatMode, driftNext, currentTrack, currentTime, duration } = get()

    // Record feedback for the outgoing track
    if (currentTrack) {
      if (reason === 'auto_advance') {
        const completion = duration > 0 ? currentTime / duration : 0
        get().recordFeedback(currentTrack.id, 'track_completed', completion, null)
      } else if (reason) {
        const completion = duration > 0 ? currentTime / duration : 0
        get().recordFeedback(currentTrack.id, 'track_skipped', completion, null)
      }
    }

    // Escape hatch for custom navigation registered from outside the registry.
    if (driftNext) {
      driftNext()
      return
    }

    // Graph-walking modes choose from the nav registry rather than the queue.
    const { playMode } = get()
    if (isNavMode(playMode) && currentTrack) {
      const nav = useNavigationStore.getState()
      // inferred_rating is the global model's output, 0–5; the session scorer
      // wants [0,1]. Unrated tracks sit at the midpoint rather than at zero,
      // so "no prediction" doesn't read as "disliked".
      const ratingById = new Map(get().libraryTracks.map(t => [t.id, t.inferred_rating]))
      const globalPreference = (trackId: string): number => {
        const r = ratingById.get(trackId)
        return r == null ? 0.5 : Math.max(0, Math.min(1, r / 5))
      }
      const step = nav.next(playMode, currentTrack.id, globalPreference)
      // Resolve against the full library, not the filtered view.
      const pool = get().libraryTracks.length ? get().libraryTracks : get().tracks
      const stepTrack = step ? pool.find(t => t.id === step.trackId) : undefined
      if (step && stepTrack) {
        get().playTrack(stepTrack, pool, step.source)
        // The outgoing track's outcome was recorded moments ago; pick it up so
        // the next step sees it. Async, so signals lag by at most one step.
        void nav.refreshSession()
        return
      }
      // Falling back to queue order is indistinguishable from the mode simply
      // working, so say why — otherwise a broken walk looks like linear play.
      console.warn(
        `[nav] ${playMode} could not step from ${currentTrack.id}; falling back to queue order.`,
        step ? 'Chosen track is not in the library list.' : nav.data ? 'No candidate from the graph.' : 'Graph not loaded yet.'
      )
    }

    if (queue.length === 0) return

    let nextQueueIndex: number
    let newShufflePosition = shufflePosition

    if (shuffle) {
      const nextPos = shufflePosition + 1
      if (nextPos < shuffledIndices.length) {
        newShufflePosition = nextPos
        nextQueueIndex = shuffledIndices[nextPos]
      } else if (repeatMode === 'all') {
        // Exhausted — regenerate permutation
        const perm = buildShufflePermutation(queue.length, queueIndex, queue.map(t => t.id))
        set({ shuffledIndices: perm })
        newShufflePosition = 0
        nextQueueIndex = perm[0]
      } else {
        // End of shuffle, no repeat
        set({ isPlaying: false })
        return
      }
    } else if (queueIndex < queue.length - 1) {
      nextQueueIndex = queueIndex + 1
    } else if (repeatMode === 'all') {
      nextQueueIndex = 0
    } else {
      set({ isPlaying: false })
      return
    }

    const incoming = queue[nextQueueIndex]
    set({
      currentTrack: incoming,
      queueIndex: nextQueueIndex,
      shufflePosition: newShufflePosition,
      isPlaying: true
    })

    // Record track_started for incoming track
    const incomingSource = shuffle ? 'shuffle' : 'auto_advance'
    get().recordFeedback(incoming.id, 'track_started', null, incomingSource)
  },

  prevTrack: () => {
    const { queue, shuffle, shuffledIndices, shufflePosition } = get()
    if (queue.length === 0) return

    if (shuffle) {
      if (shufflePosition > 0) {
        const prevPos = shufflePosition - 1
        const prevQueueIndex = shuffledIndices[prevPos]
        set({
          currentTrack: queue[prevQueueIndex],
          queueIndex: prevQueueIndex,
          shufflePosition: prevPos,
          isPlaying: true
        })
      }
    } else {
      const { queueIndex } = get()
      if (queueIndex > 0) {
        const prevIndex = queueIndex - 1
        set({
          currentTrack: queue[prevIndex],
          queueIndex: prevIndex,
          isPlaying: true
        })
      }
    }
  },

  setVolume: (volume) => set({ volume }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  seekTo: (time) => {
    const { currentTrack, currentTime } = get()
    const delta = time - currentTime
    if (currentTrack && Math.abs(delta) > 2) {
      if (delta < 0) {
        get().recordFeedback(currentTrack.id, 'seek_backward', Math.abs(delta), null)
      } else {
        get().recordFeedback(currentTrack.id, 'seek_forward', delta, null)
      }
    }
    set({ seekTarget: time })
  },

  setPlayMode: (mode) => {
    const { queue, queueIndex, currentTrack } = get()

    if (mode === 'random') {
      // Generate the permutation with the current track at position 0.
      const perm = queue.length > 0
        ? buildShufflePermutation(queue.length, queueIndex, queue.map(t => t.id))
        : []
      set({ playMode: 'random', shuffle: true, shuffledIndices: perm, shufflePosition: perm.length ? 0 : -1 })
      return
    }

    // Leaving random — the permutation is meaningless to the other modes.
    set({ playMode: mode, shuffle: false, shuffledIndices: [], shufflePosition: -1 })

    // A graph walk starts from wherever playback currently is, and needs its
    // graph. Both are no-ops if already done.
    if (isNavMode(mode)) {
      void useNavigationStore.getState().ensureLoaded()
      void useNavigationStore.getState().refreshSession()
      if (currentTrack) useNavigationStore.getState().resetWalk(currentTrack.id)
    }
  },

  toggleShuffle: () => {
    const { playMode, modeBeforeRandom } = get()
    if (playMode === 'random') {
      // Return to whatever was running before, rather than resetting to linear —
      // random is an override, not a destination.
      get().setPlayMode(modeBeforeRandom)
    } else {
      set({ modeBeforeRandom: playMode })
      get().setPlayMode('random')
    }
  },

  cycleRepeat: () => {
    set(state => {
      const cycle: Record<string, 'off' | 'one' | 'all'> = { off: 'all', all: 'one', one: 'off' }
      return { repeatMode: cycle[state.repeatMode] }
    })
  },

  stopPlayback: () => {
    set({ isPlaying: false, currentTime: 0 })
  },

  updatePlayCount: async (trackId) => {
    await window.api.updatePlayCount(trackId)
  },

  setRating: async (trackId, rating) => {
    await window.api.setRating(trackId, rating)
    const updateTrack = (t: Track): Track =>
      t.id === trackId ? { ...t, rating } : t
    set(state => ({
      tracks: state.tracks.map(updateTrack),
      queue: state.queue.map(updateTrack),
      currentTrack: state.currentTrack?.id === trackId
        ? { ...state.currentTrack, rating }
        : state.currentTrack,
    }))
  },

  setEqEnabled: (enabled) => {
    set({ eqEnabled: enabled })
    localStorage.setItem('proton-eq-state', JSON.stringify({
      enabled, preamp: get().eqPreamp, bands: get().eqBands,
    }))
  },

  setEqPreamp: (gain) => {
    set({ eqPreamp: gain })
    localStorage.setItem('proton-eq-state', JSON.stringify({
      enabled: get().eqEnabled, preamp: gain, bands: get().eqBands,
    }))
  },

  setEqBand: (index, gain) => {
    const bands = [...get().eqBands]
    bands[index] = gain
    set({ eqBands: bands })
    localStorage.setItem('proton-eq-state', JSON.stringify({
      enabled: get().eqEnabled, preamp: get().eqPreamp, bands,
    }))
  },

  setScanProgress: (progress) => {
    set({
      scanProgress: progress,
      isScanning: progress !== null && progress.phase !== 'complete' && progress.phase !== 'error'
    })
    if (progress?.phase === 'complete') {
      get().loadLibrary()
    }
  },

  setDriftNext: (fn) => set({ driftNext: fn }),

  getUpcomingTrackIds: (count) => {
    const { queue, queueIndex, shuffle, shuffledIndices, shufflePosition, driftNext, playMode } = get()
    if (driftNext || queue.length === 0) return []
    // A graph walk decides its next track at the moment of advancing, so queue
    // order predicts nothing here. Prefetching from it would warm three tracks
    // that will not play while missing the one that will. Returning nothing is
    // honest until the walk precomputes its pick.
    if (isNavMode(playMode)) return []

    const ids: string[] = []
    if (shuffle) {
      for (let i = 1; i <= count && shufflePosition + i < shuffledIndices.length; i++) {
        ids.push(queue[shuffledIndices[shufflePosition + i]].id)
      }
    } else {
      for (let i = 1; i <= count && queueIndex + i < queue.length; i++) {
        ids.push(queue[queueIndex + i].id)
      }
    }
    return ids
  },

  togglePin: async (trackId) => {
    const track = get().tracks.find(t => t.id === trackId) ||
                  get().queue.find(t => t.id === trackId)
    const isPinned = track?.pinned === 1

    if (isPinned) {
      await window.api.unpinTrack(trackId)
    } else {
      await window.api.pinTrack(trackId)
      // Trigger download if not already local
      window.api.requestTrackDownload(trackId).catch(console.error)
    }

    const newPinned = isPinned ? 0 : 1
    const updateTrack = (t: Track): Track =>
      t.id === trackId ? { ...t, pinned: newPinned } : t
    set(state => ({
      tracks: state.tracks.map(updateTrack),
      queue: state.queue.map(updateTrack),
      currentTrack: state.currentTrack?.id === trackId
        ? { ...state.currentTrack, pinned: newPinned }
        : state.currentTrack,
    }))
  },

  recordFeedback: (trackId, eventType, eventValue, source) => {
    const weight = getAttentionWeight()
    const { activeSurface } = get()
    window.api.recordFeedback(trackId, eventType, eventValue, weight, source, activeSurface).catch(console.error)
  },

  lovingThis: () => {
    const { currentTrack } = get()
    if (!currentTrack) return
    get().recordFeedback(currentTrack.id, 'explicit_positive', null, 'loving_this')
  },

  likeNotNow: () => {
    const { currentTrack } = get()
    if (!currentTrack) return
    get().recordFeedback(currentTrack.id, 'explicit_positive_not_now', null, 'like_not_now')
    get().nextTrack('like_not_now')
  },

  notFeelingIt: () => {
    const { currentTrack } = get()
    if (!currentTrack) return
    get().recordFeedback(currentTrack.id, 'explicit_negative', null, 'not_feeling_it')
    get().nextTrack('not_feeling_it')
  },

  applyInferredRatings: (ratings) => {
    const map = new Map(ratings.map(r => [r.id, r.inferred_rating]))
    const updateTrack = (t: Track): Track => {
      const inferred = map.get(t.id)
      return inferred !== undefined ? { ...t, inferred_rating: inferred } : t
    }
    set(state => ({
      tracks: state.tracks.map(updateTrack),
      queue: state.queue.map(updateTrack),
      currentTrack: state.currentTrack ? updateTrack(state.currentTrack) : null
    }))
  }
}))

// Restore saved EQ state
try {
  const savedEq = localStorage.getItem('proton-eq-state')
  if (savedEq) {
    const eq = JSON.parse(savedEq) as { enabled: boolean; preamp: number; bands: number[] }
    useLibraryStore.setState({
      eqEnabled: eq.enabled,
      eqPreamp: eq.preamp,
      eqBands: eq.bands,
    })
  }
} catch {
  // ignore corrupted EQ state
}
