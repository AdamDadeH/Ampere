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

export interface TrackPathResult {
  url: string
  available: boolean
  downloading: boolean
  syncStatus: string
}

export interface ElectronAPI {
  selectFolder(): Promise<string | null>
  getTracks(filter?: { artist?: string; album?: string }): Promise<unknown[]>
  getArtists(): Promise<unknown[]>
  getAlbumArtists(): Promise<unknown[]>
  getTracksByAlbumArtist(artist: string): Promise<unknown[]>
  getAlbumsByAlbumArtist(artist: string): Promise<unknown[]>
  getAlbums(artist?: string): Promise<unknown[]>
  getTrackPath(trackId: string): Promise<TrackPathResult | null>
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
  // Riemann navigator
  getTracksWithoutFeatures(): Promise<{ id: string; file_path: string }[]>
  upsertTrackFeatures(trackId: string, featuresJson: string): Promise<void>
  getTrackFeatures(): Promise<{ track_id: string; features_json: string }[]>
  getTrackFeaturesWithCoords(): Promise<{ track_id: string; features_json: string; umap_x: number; umap_y: number; umap_z: number }[]>
  bulkSetUmapCoords(coords: { trackId: string; x: number; y: number; z: number }[]): Promise<void>
  getFeatureCount(): Promise<number>
  readAudioFile(filePath: string): Promise<ArrayBuffer>
  // Cloud-first: downloads + prefetch
  prefetchTracks(trackIds: string[]): Promise<Record<string, string>>
  requestTrackDownload(trackId: string): Promise<boolean>
  onDownloadComplete(callback: (trackId: string) => void): () => void
  onDownloadProgress(callback: (data: { trackId: string; progress: number }) => void): () => void
  // Cloud-first: storage sources
  detectProtonDrive(): Promise<{ path: string; email: string }[]>
  getStorageSources(): Promise<unknown[]>
  addStorageSource(source: { id: string; type: string; root_path: string; label?: string; proton_email?: string }): Promise<void>
  removeStorageSource(sourceId: string): Promise<void>
  // Cloud-first: cache management
  getCacheStats(): Promise<{ totalTracks: number; cachedTracks: number; cloudOnlyTracks: number; pinnedTracks: number; cachedBytes: number; pinnedBytes: number }>
  setCacheLimit(bytes: number): Promise<void>
  pinTrack(trackId: string): Promise<void>
  unpinTrack(trackId: string): Promise<void>
  evictCache(): Promise<{ evicted: number; freedBytes: number }>
  // Feedback
  recordFeedback(trackId: string, eventType: string, eventValue: number | null, attentionWeight: number, source: string | null): Promise<void>
  getTrackFeedback(trackId: string): Promise<{ id: number; track_id: string; event_type: string; event_value: number | null; attention_weight: number; source: string | null; created_at: string }[]>
  recomputeInferredRatings(): Promise<void>
  onInferredRatingsUpdated(callback: (ratings: { id: string; inferred_rating: number }[]) => void): () => void
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
  },
  // Riemann navigator
  getTracksWithoutFeatures: () => ipcRenderer.invoke('get-tracks-without-features'),
  upsertTrackFeatures: (trackId, featuresJson) => ipcRenderer.invoke('upsert-track-features', trackId, featuresJson),
  getTrackFeatures: () => ipcRenderer.invoke('get-track-features'),
  getTrackFeaturesWithCoords: () => ipcRenderer.invoke('get-track-features-with-coords'),
  bulkSetUmapCoords: (coords) => ipcRenderer.invoke('bulk-set-umap-coords', coords),
  getFeatureCount: () => ipcRenderer.invoke('get-feature-count'),
  readAudioFile: (filePath) => ipcRenderer.invoke('read-audio-file', filePath),
  // Cloud-first: downloads + prefetch
  prefetchTracks: (trackIds) => ipcRenderer.invoke('prefetch-tracks', trackIds),
  requestTrackDownload: (trackId) => ipcRenderer.invoke('request-track-download', trackId),
  onDownloadComplete: (callback) => {
    const handler = (_event: unknown, trackId: string): void => callback(trackId)
    ipcRenderer.on('download-complete', handler)
    return () => ipcRenderer.removeListener('download-complete', handler)
  },
  onDownloadProgress: (callback) => {
    const handler = (_event: unknown, data: { trackId: string; progress: number }): void => callback(data)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },
  // Cloud-first: storage sources
  detectProtonDrive: () => ipcRenderer.invoke('detect-proton-drive'),
  getStorageSources: () => ipcRenderer.invoke('get-storage-sources'),
  addStorageSource: (source) => ipcRenderer.invoke('add-storage-source', source),
  removeStorageSource: (sourceId) => ipcRenderer.invoke('remove-storage-source', sourceId),
  // Cloud-first: cache management
  getCacheStats: () => ipcRenderer.invoke('get-cache-stats'),
  setCacheLimit: (bytes) => ipcRenderer.invoke('set-cache-limit', bytes),
  pinTrack: (trackId) => ipcRenderer.invoke('pin-track', trackId),
  unpinTrack: (trackId) => ipcRenderer.invoke('unpin-track', trackId),
  evictCache: () => ipcRenderer.invoke('evict-cache'),
  // Feedback
  recordFeedback: (trackId, eventType, eventValue, attentionWeight, source) =>
    ipcRenderer.invoke('record-feedback', trackId, eventType, eventValue, attentionWeight, source),
  getTrackFeedback: (trackId) => ipcRenderer.invoke('get-track-feedback', trackId),
  recomputeInferredRatings: () => ipcRenderer.invoke('recompute-inferred-ratings'),
  onInferredRatingsUpdated: (callback) => {
    const handler = (_event: unknown, ratings: { id: string; inferred_rating: number }[]): void => callback(ratings)
    ipcRenderer.on('inferred-ratings-updated', handler)
    return () => ipcRenderer.removeListener('inferred-ratings-updated', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
