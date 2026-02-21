import { create } from 'zustand'

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

type View = 'all-tracks' | 'artists' | 'albums' | 'artist-detail' | 'album-detail' | 'riemann' | 'demoscene'
type ArtistViewMode = 'track' | 'album'

interface LibraryState {
  // Library data
  tracks: Track[]
  artists: ArtistInfo[]
  albumArtists: ArtistInfo[]
  albums: AlbumInfo[]
  stats: LibraryStats | null

  // Navigation
  currentView: View
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
  shuffle: boolean
  repeatMode: 'off' | 'one' | 'all'

  // EQ
  eqEnabled: boolean
  eqPreamp: number
  eqBands: number[]

  // Scan
  scanProgress: ScanProgress | null
  isScanning: boolean

  // Navigation override — set by Riemann navigator for drift/walk modes
  driftNext: (() => void) | null

  // Actions
  loadLibrary: () => Promise<void>
  selectFolder: () => Promise<void>
  setView: (view: View) => void
  setArtistViewMode: (mode: ArtistViewMode) => void
  selectArtist: (artist: string) => void
  selectAlbum: (album: string, artist?: string) => void
  setSearchQuery: (query: string) => void
  playTrack: (track: Track, trackList?: Track[]) => void
  togglePlayPause: () => void
  nextTrack: () => void
  prevTrack: () => void
  setVolume: (volume: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  seekTo: (time: number) => void
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
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  artists: [],
  albumArtists: [],
  albums: [],
  stats: null,
  currentView: 'all-tracks',
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
  shuffle: false,
  repeatMode: 'off',
  eqEnabled: false,
  eqPreamp: 0,
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  scanProgress: null,
  isScanning: false,
  driftNext: null,

  loadLibrary: async () => {
    const [tracks, artists, albumArtists, albums, stats] = await Promise.all([
      window.api.getTracks() as Promise<Track[]>,
      window.api.getArtists() as Promise<ArtistInfo[]>,
      window.api.getAlbumArtists() as Promise<ArtistInfo[]>,
      window.api.getAlbums() as Promise<AlbumInfo[]>,
      window.api.getLibraryStats() as Promise<LibraryStats>
    ])
    set({ tracks, artists, albumArtists, albums, stats })
  },

  selectFolder: async () => {
    set({ isScanning: true })
    await window.api.selectFolder()
  },

  setView: (view) => {
    set({ currentView: view, selectedArtist: null, selectedAlbum: null })
    if (view === 'all-tracks') {
      get().loadLibrary()
    }
  },

  setArtistViewMode: (mode) => {
    set({ artistViewMode: mode, selectedArtist: null, currentView: 'all-tracks' })
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

  playTrack: (track, trackList) => {
    const list = trackList || get().tracks
    const index = list.findIndex(t => t.id === track.id)
    set({
      currentTrack: track,
      isPlaying: true,
      queue: list,
      queueIndex: index >= 0 ? index : 0
    })
  },

  togglePlayPause: () => {
    set(state => ({ isPlaying: !state.isPlaying }))
  },

  nextTrack: () => {
    const { queue, queueIndex, shuffle, driftNext } = get()
    if (driftNext) {
      driftNext()
      return
    }
    if (queue.length === 0) return
    let nextIndex: number
    if (shuffle) {
      // Pick a random index different from current (if possible)
      if (queue.length === 1) {
        nextIndex = 0
      } else {
        do {
          nextIndex = Math.floor(Math.random() * queue.length)
        } while (nextIndex === queueIndex)
      }
    } else if (queueIndex < queue.length - 1) {
      nextIndex = queueIndex + 1
    } else {
      return // end of queue, no wrap in nextTrack (repeat handled in AudioEngine)
    }
    set({
      currentTrack: queue[nextIndex],
      queueIndex: nextIndex,
      isPlaying: true
    })
  },

  prevTrack: () => {
    const { queue, queueIndex } = get()
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1
      set({
        currentTrack: queue[prevIndex],
        queueIndex: prevIndex,
        isPlaying: true
      })
    }
  },

  setVolume: (volume) => set({ volume }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  seekTo: (time) => {
    set({ seekTarget: time })
  },

  toggleShuffle: () => {
    set(state => ({ shuffle: !state.shuffle }))
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

  setDriftNext: (fn) => set({ driftNext: fn })
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
