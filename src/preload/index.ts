import { contextBridge, ipcRenderer } from 'electron'

export interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  trackTitle: string | null
  trackArtist: string | null
  trackAlbum: string | null
  artworkPath: string | null
  bitrate: number | null
  sampleRate: number | null
  codec: string | null
  queueIndex: number
  queueLength: number
  shuffle: boolean
  repeatMode: 'off' | 'one' | 'all'
  frequencyData: number[]
  eqEnabled: boolean
  eqPreamp: number
  eqBands: number[]
  queueTracks: QueueTrackInfo[]
}

export interface QueueTrackInfo {
  title: string
  artist: string | null
  duration: number
}

export interface ElectronAPI {
  selectFolder(): Promise<string | null>
  getTracks(filter?: { artist?: string; album?: string }): Promise<unknown[]>
  getArtists(): Promise<unknown[]>
  getAlbumArtists(): Promise<unknown[]>
  getTracksByAlbumArtist(artist: string): Promise<unknown[]>
  getAlbumsByAlbumArtist(artist: string): Promise<unknown[]>
  getAlbums(artist?: string): Promise<unknown[]>
  getTrackPath(trackId: string): Promise<string | null>
  getArtworkUrl(artworkPath: string): string
  onScanProgress(callback: (progress: unknown) => void): () => void
  updatePlayCount(trackId: string): Promise<void>
  getLibraryStats(): Promise<unknown>
  searchTracks(query: string): Promise<unknown[]>
  setRating(trackId: string, rating: number): Promise<void>
  // Winamp skin import
  selectWszSkin(): Promise<ArrayBuffer | null>
  // Compact mode
  setWindowMode(mode: 'library' | 'compact'): Promise<void>
  getWindowMode(): Promise<'library' | 'compact'>
  windowMinimize(): Promise<void>
  windowClose(): Promise<void>
  setCompactSize(width: number, height: number): Promise<void>
  remotePlayerCommand(command: string, ...args: unknown[]): void
  onPlayerCommand(callback: (command: string, ...args: unknown[]) => void): () => void
  sendPlayerState(state: PlayerState): void
  onPlayerStateUpdate(callback: (state: PlayerState) => void): () => void
}

const api: ElectronAPI = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getTracks: (filter?) => ipcRenderer.invoke('get-tracks', filter),
  getArtists: () => ipcRenderer.invoke('get-artists'),
  getAlbumArtists: () => ipcRenderer.invoke('get-album-artists'),
  getTracksByAlbumArtist: (artist) => ipcRenderer.invoke('get-tracks-by-album-artist', artist),
  getAlbumsByAlbumArtist: (artist) => ipcRenderer.invoke('get-albums-by-album-artist', artist),
  getAlbums: (artist?) => ipcRenderer.invoke('get-albums', artist),
  getTrackPath: (trackId) => ipcRenderer.invoke('get-track-path', trackId),
  getArtworkUrl: (artworkPath: string) => {
    if (!artworkPath) return ''
    return `atom://${artworkPath}`
  },
  onScanProgress: (callback) => {
    const handler = (_event: unknown, progress: unknown): void => callback(progress)
    ipcRenderer.on('scan-progress', handler)
    return () => ipcRenderer.removeListener('scan-progress', handler)
  },
  updatePlayCount: (trackId) => ipcRenderer.invoke('update-play-count', trackId),
  getLibraryStats: () => ipcRenderer.invoke('get-library-stats'),
  searchTracks: (query) => ipcRenderer.invoke('search-tracks', query),
  setRating: (trackId, rating) => ipcRenderer.invoke('set-rating', trackId, rating),
  // Winamp skin import
  selectWszSkin: () => ipcRenderer.invoke('select-wsz-skin'),
  // Compact mode
  setWindowMode: (mode) => ipcRenderer.invoke('set-window-mode', mode),
  getWindowMode: () => ipcRenderer.invoke('get-window-mode'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  setCompactSize: (width, height) => ipcRenderer.invoke('set-compact-size', width, height),
  remotePlayerCommand: (command, ...args) => ipcRenderer.send('remote-player-command', command, ...args),
  onPlayerCommand: (callback) => {
    const handler = (_event: unknown, command: string, ...args: unknown[]): void => callback(command, ...args)
    ipcRenderer.on('player-command', handler)
    return () => ipcRenderer.removeListener('player-command', handler)
  },
  sendPlayerState: (state) => ipcRenderer.send('player-state-update', state),
  onPlayerStateUpdate: (callback) => {
    const handler = (_event: unknown, state: PlayerState): void => callback(state)
    ipcRenderer.on('player-state-update', handler)
    return () => ipcRenderer.removeListener('player-state-update', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
