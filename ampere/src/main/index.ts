import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join, extname } from 'path'
import { pathToFileURL } from 'url'
import { createReadStream, readFileSync, statSync } from 'fs'
import { createServer, Server } from 'http'
import { LibraryDatabase } from './database'
import { LocalStorageProvider } from './storage/local-provider'
import { AUDIO_EXTENSIONS } from './storage/provider'
import { FolderScanner } from './scanner'
import { MusicMetadataExtractor } from './scanner/music-extractor'
import { detectProtonDrive, isProtonDrivePath, isFileMaterialized, requestDownload, waitForMaterialization } from './storage/proton-drive'
import { autoRegisterProtonDriveSources, findSourceForPath, getSourceTypeForPath } from './storage/sources'
import { CacheManager } from './storage/cache-manager'

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

let db: LibraryDatabase
let scanner: FolderScanner
let cacheManager: CacheManager
let mainWindow: BrowserWindow | null = null
let compactWindow: BrowserWindow | null = null
let audioServer: Server | null = null
let audioServerPort = 0
let inferredRatingInterval: ReturnType<typeof setInterval> | null = null

// Track active downloads so we don't double-trigger
const activeDownloads = new Map<string, Promise<boolean>>()

function startAudioServer(): Promise<number> {
  return new Promise((resolve) => {
    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type, X-Download-Status'
    }

    audioServer = createServer((req, res) => {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS)
        res.end()
        return
      }

      const filePath = decodeURIComponent(req.url?.slice(1) || '')
      if (!filePath) {
        res.writeHead(400, CORS_HEADERS)
        res.end('Missing file path')
        return
      }

      const ext = extname(filePath).toLowerCase()
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

      // For Proton Drive files, check if materialized before attempting to serve
      if (isProtonDrivePath(filePath) && !isFileMaterialized(filePath)) {
        res.writeHead(202, { ...CORS_HEADERS, 'X-Download-Status': 'downloading' })
        res.end()
        // Trigger download in background (if not already in progress)
        triggerDownload(filePath)
        return
      }

      let stat
      try {
        stat = statSync(filePath)
      } catch {
        res.writeHead(404, CORS_HEADERS)
        res.end('File not found')
        return
      }

      // Touch the file for LRU cache tracking
      if (isProtonDrivePath(filePath)) {
        touchFileByPath(filePath)
      }

      const range = req.headers.range
      if (range) {
        // Handle range requests for seeking
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
        const chunkSize = end - start + 1

        res.writeHead(206, {
          ...CORS_HEADERS,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType
        })
        createReadStream(filePath, { start, end }).pipe(res)
      } else {
        res.writeHead(200, {
          ...CORS_HEADERS,
          'Content-Length': stat.size,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes'
        })
        createReadStream(filePath).pipe(res)
      }
    })

    audioServer.listen(0, '127.0.0.1', () => {
      const addr = audioServer!.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      console.log(`Audio server listening on port ${port}`)
      resolve(port)
    })
  })
}

/** Trigger a download for a cloud-only file, deduplicating concurrent requests */
function triggerDownload(filePath: string): Promise<boolean> {
  const existing = activeDownloads.get(filePath)
  if (existing) return existing

  const promise = (async () => {
    try {
      await requestDownload(filePath)
      const result = await waitForMaterialization(filePath, 60_000)
      if (result && db) {
        const track = db.getTrackByPath(filePath)
        if (track) {
          db.updateSyncStatus(track.id, 'cached')
          notifyDownloadComplete(track.id)
        }
      }
      return result
    } finally {
      activeDownloads.delete(filePath)
    }
  })()

  activeDownloads.set(filePath, promise)
  return promise
}

/** Update last_accessed for a file by looking up its track ID */
function touchFileByPath(filePath: string): void {
  // This is called from the audio server hot path — keep it lightweight.
  // We'll batch these or do them async in the future if needed.
  try {
    cacheManager?.touchByPath(filePath)
  } catch {
    // Non-fatal
  }
}

/** Notify renderer that a download completed */
function notifyDownloadComplete(trackId: string): void {
  const windows = [mainWindow, compactWindow]
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('download-complete', trackId)
    }
  }
}

/** Push updated inferred ratings to all renderer windows */
function broadcastInferredRatings(): void {
  const ratings = db.getInferredRatings()
  const windows = [mainWindow, compactWindow]
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('inferred-ratings-updated', ratings)
    }
  }
}

/** Notify renderer of download progress */
function notifyDownloadProgress(trackId: string, progress: number): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-progress', { trackId, progress })
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createCompactWindow(): void {
  if (compactWindow && !compactWindow.isDestroyed()) return

  // Center compact window on mainWindow's position
  let x: number | undefined
  let y: number | undefined
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [wx, wy] = mainWindow.getPosition()
    const [ww, wh] = mainWindow.getSize()
    x = Math.round(wx + (ww - 400) / 2)
    y = Math.round(wy + (wh - 150) / 2)
  }

  compactWindow = new BrowserWindow({
    width: 400,
    height: 150,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    minimizable: true,
    maximizable: false,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    compactWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?mode=compact')
  } else {
    compactWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'compact' }
    })
  }

  compactWindow.on('closed', () => {
    compactWindow = null
    // Show library window when compact is closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })
}

function setupIPC(): void {
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Music Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folderPath = result.filePaths[0]

    // Determine source context for the selected folder
    const source = findSourceForPath(db, folderPath)
    const sourceContext = source
      ? { sourceId: source.id, sourceType: source.type as 'local' | 'proton-drive' }
      : { sourceId: null, sourceType: getSourceTypeForPath(folderPath) }

    // Start scanning in background
    scanner.scan(folderPath, mainWindow, sourceContext).catch(err => {
      console.error('Scan failed:', err)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scan-progress', {
          phase: 'error',
          current: 0,
          total: 0,
          error: err.message
        })
      }
    })

    return folderPath
  })

  ipcMain.handle('get-tracks', (_event, filter?: { artist?: string; album?: string }) => {
    if (filter?.artist && filter?.album) {
      return db.getTracksByAlbum(filter.album, filter.artist)
    }
    if (filter?.artist) {
      return db.getTracksByArtist(filter.artist)
    }
    if (filter?.album) {
      return db.getTracksByAlbum(filter.album)
    }
    return db.getAllTracks()
  })

  ipcMain.handle('get-artists', () => db.getArtists())

  ipcMain.handle('get-album-artists', () => db.getAlbumArtists())

  ipcMain.handle('get-tracks-by-album-artist', (_event, artist: string) => db.getTracksByAlbumArtist(artist))

  ipcMain.handle('get-albums-by-album-artist', (_event, artist: string) => db.getAlbumsByAlbumArtist(artist))

  ipcMain.handle('get-albums', (_event, artist?: string) => db.getAlbums(artist))

  ipcMain.handle('get-track-path', (_event, trackId: string) => {
    const track = db.getTrack(trackId)
    if (!track) return null

    const isPD = isProtonDrivePath(track.file_path)
    const materialized = isPD ? isFileMaterialized(track.file_path) : true

    return {
      url: `http://127.0.0.1:${audioServerPort}/${encodeURIComponent(track.file_path)}`,
      available: materialized,
      downloading: activeDownloads.has(track.file_path),
      syncStatus: track.sync_status
    }
  })

  ipcMain.handle('update-play-count', (_event, trackId: string) => {
    db.incrementPlayCount(trackId)
  })

  ipcMain.handle('get-library-stats', () => db.getLibraryStats())

  ipcMain.handle('search-tracks', (_event, query: string) => db.searchTracks(query))

  ipcMain.handle('set-rating', (_event, trackId: string, rating: number) => {
    db.setRating(trackId, rating)
  })

  ipcMain.handle('select-wsz-skin', async () => {
    const win = compactWindow || mainWindow
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Winamp Skins', extensions: ['wsz', 'zip'] }],
      title: 'Load Winamp Skin'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const data = readFileSync(result.filePaths[0])
    return data.buffer
  })

  ipcMain.handle('set-compact-size', (_event, width: number, height: number) => {
    if (compactWindow && !compactWindow.isDestroyed()) {
      const [cx, cy] = compactWindow.getPosition()
      const [cw] = compactWindow.getSize()
      compactWindow.setSize(width, height)
      compactWindow.setPosition(Math.round(cx + (cw - width) / 2), cy)
    }
  })

  // Compact mode IPC
  ipcMain.handle('set-window-mode', (_event, mode: 'library' | 'compact') => {
    if (mode === 'compact') {
      createCompactWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide()
      }
    } else {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
      }
      if (compactWindow && !compactWindow.isDestroyed()) {
        compactWindow.close()
      }
    }
  })

  ipcMain.handle('get-window-mode', (event) => {
    if (compactWindow && !compactWindow.isDestroyed() &&
        event.sender === compactWindow.webContents) {
      return 'compact'
    }
    return 'library'
  })

  ipcMain.handle('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.handle('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  // Riemann feature extraction IPC
  ipcMain.handle('get-tracks-without-features', () => db.getTracksWithoutFeatures())
  ipcMain.handle('upsert-track-features', (_event, trackId: string, featuresJson: string) => {
    db.upsertTrackFeatures(trackId, featuresJson)
  })
  ipcMain.handle('get-track-features', () => db.getTrackFeatures())
  ipcMain.handle('get-track-features-with-coords', () => db.getTrackFeaturesWithCoords())
  ipcMain.handle('bulk-set-umap-coords', (_event, coords: { trackId: string; x: number; y: number; z: number }[]) => {
    db.bulkSetUmapCoords(coords)
  })
  ipcMain.handle('get-feature-count', () => db.getFeatureCount())
  ipcMain.handle('read-audio-file', async (_event, filePath: string) => {
    // For Proton Drive files, ensure materialized before reading
    if (isProtonDrivePath(filePath) && !isFileMaterialized(filePath)) {
      await requestDownload(filePath)
      const ready = await waitForMaterialization(filePath, 30_000)
      if (!ready) throw new Error(`Timed out waiting for file download: ${filePath}`)
    }
    const data = readFileSync(filePath)
    return data.buffer
  })

  // Cloud-first: download request from renderer
  ipcMain.handle('request-track-download', async (_event, trackId: string) => {
    const track = db.getTrack(trackId)
    if (!track) return false

    if (!isProtonDrivePath(track.file_path)) return true // Already local
    if (isFileMaterialized(track.file_path)) {
      db.updateSyncStatus(trackId, 'cached')
      return true
    }

    db.updateSyncStatus(trackId, 'downloading')
    const result = await triggerDownload(track.file_path)
    if (result) {
      db.updateSyncStatus(trackId, 'cached')
    }
    return result
  })

  // Cloud-first: storage source management
  ipcMain.handle('detect-proton-drive', () => detectProtonDrive())

  ipcMain.handle('get-storage-sources', () => db.getStorageSources())

  ipcMain.handle('add-storage-source', (_event, source: { id: string; type: string; root_path: string; label?: string; proton_email?: string }) => {
    db.addStorageSource(source)
  })

  ipcMain.handle('remove-storage-source', (_event, sourceId: string) => {
    db.removeStorageSource(sourceId)
  })

  // Cloud-first: cache management
  ipcMain.handle('get-cache-stats', () => db.getCacheStats())

  ipcMain.handle('set-cache-limit', (_event, bytes: number) => {
    cacheManager.setMaxSize(bytes)
  })

  ipcMain.handle('pin-track', (_event, trackId: string) => {
    db.pinTrack(trackId)
  })

  ipcMain.handle('unpin-track', (_event, trackId: string) => {
    db.unpinTrack(trackId)
  })

  ipcMain.handle('evict-cache', async () => {
    return cacheManager.evict()
  })

  // Prefetch: fire-and-forget download of upcoming tracks
  ipcMain.handle('prefetch-tracks', async (_event, trackIds: string[]) => {
    const results: Record<string, string> = {}
    for (const trackId of trackIds) {
      const track = db.getTrack(trackId)
      if (!track) {
        results[trackId] = 'not_found'
        continue
      }
      if (!isProtonDrivePath(track.file_path)) {
        results[trackId] = 'local'
        continue
      }
      if (isFileMaterialized(track.file_path)) {
        results[trackId] = 'cached'
        continue
      }
      // Trigger download (deduplicates via activeDownloads)
      triggerDownload(track.file_path)
      results[trackId] = 'downloading'
    }
    return results
  })

  // Feedback
  ipcMain.handle('record-feedback', (_event, trackId: string, eventType: string, eventValue: number | null, attentionWeight: number, source: string | null) => {
    db.recordFeedback(trackId, eventType, eventValue, attentionWeight, source)
  })

  ipcMain.handle('get-track-feedback', (_event, trackId: string) => {
    return db.getTrackFeedback(trackId)
  })

  ipcMain.handle('recompute-inferred-ratings', () => {
    db.recomputeInferredRatings()
    broadcastInferredRatings()
  })

  ipcMain.on('remote-player-command', (_event, command: string, ...args: unknown[]) => {
    // Forward from compact window to library window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('player-command', command, ...args)
    }
  })

  ipcMain.on('player-state-update', (_event, state: unknown) => {
    // Forward from library window to compact window
    if (compactWindow && !compactWindow.isDestroyed()) {
      compactWindow.webContents.send('player-state-update', state)
    }
  })
}

app.whenReady().then(async () => {
  // Register custom protocol for serving local files (artwork)
  protocol.handle('atom', (request) => {
    let filePath = decodeURIComponent(request.url.replace(/^atom:\/\//, ''))
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // Start local audio server for streaming with range request support
  audioServerPort = await startAudioServer()

  db = new LibraryDatabase()
  const provider = new LocalStorageProvider(AUDIO_EXTENSIONS)
  const extractor = new MusicMetadataExtractor()
  scanner = new FolderScanner(db, provider, extractor)

  // Cloud-first: auto-detect Proton Drive sources and migrate existing tracks
  const newSources = autoRegisterProtonDriveSources(db)
  for (const source of newSources) {
    const migrated = db.migrateProtonDriveSyncStatus(source.root_path, source.id)
    if (migrated > 0) {
      console.log(`Cloud-first: migrated ${migrated} existing tracks to source "${source.label}" (sync_status: local → cached)`)
    }
  }
  // Also handle already-registered sources that haven't had their tracks migrated yet
  const allSources = db.getStorageSources()
  for (const source of allSources) {
    if (source.type === 'proton-drive') {
      const migrated = db.migrateProtonDriveSyncStatus(source.root_path, source.id)
      if (migrated > 0) {
        console.log(`Cloud-first: migrated ${migrated} additional tracks for source "${source.label}"`)
      }
    }
  }

  // Initialize cache manager and run initial eviction pass
  cacheManager = new CacheManager(db)
  cacheManager.evict().then(({ evicted, freedBytes }) => {
    if (evicted > 0) {
      console.log(`Startup eviction: freed ${(freedBytes / 1024 / 1024).toFixed(1)} MB (${evicted} files)`)
    }
  }).catch(err => console.error('Startup eviction failed:', err))

  setupIPC()
  createWindow()

  // Deferred startup recompute of inferred ratings
  setTimeout(() => {
    try {
      db.recomputeInferredRatings()
      broadcastInferredRatings()
    } catch (e) { console.error('Startup inferred rating recompute failed:', e) }
  }, 5000)

  // Recompute inferred ratings every 10 minutes
  inferredRatingInterval = setInterval(() => {
    try {
      db.recomputeInferredRatings()
      broadcastInferredRatings()
    } catch (e) { console.error('Periodic inferred rating recompute failed:', e) }
  }, 10 * 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit when library is just hidden (compact mode active)
  if (process.platform !== 'darwin') {
    const hasVisible = BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isVisible())
    if (!hasVisible && !(mainWindow && !mainWindow.isDestroyed())) {
      app.quit()
    }
  }
})

app.on('before-quit', () => {
  if (inferredRatingInterval) clearInterval(inferredRatingInterval)
  cacheManager?.stop()
  db?.close()
  audioServer?.close()
})
